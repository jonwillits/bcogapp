import type { Rng } from '../../random'
import { distanceToBoundary, radiusAt, type Shape } from '../shape'
import { angleDiff, deg, wrap } from './angles'
import { Estimate } from './estimate'
import { HeadDirection, N, type LandmarkView } from './ring'
import { MapStore, gridRate, placeRate, GRID_ANCHORING, PLACE_ANCHORING, PLACE_CELLS, GRID_CELLS_PER_GROUP, GRID_SPACINGS, type RoomDescription, type RoomMap } from './maps'
import { Stability } from './stability'

/**
 * The rat's spatial system (spec §6): the running estimate, the two
 * head-direction rings, the cell models, and the maps for rooms, behind one
 * small interface, so that Modules 10 and 12 can later drive it without
 * rebuilding it (§6.7).
 *
 * **Every cell here fires from the estimate, never from the true
 * position.** Nothing under `spatial/` imports the body or any pose
 * (`structure.test.ts`); what comes in is `Senses`: a turn signal, a step
 * signal, the landmarks in view as bearings and distances, a wall contact,
 * and the room as the rat perceives it. Inject an error into the estimate
 * and every place field moves with it (`system.test.ts`).
 *
 * **In this scene the cells respond only to the rat's own movement and
 * sensing.** `ratesAt` — activity for a position the rat is not at — is
 * what Module 10 will need for replay and imagining, and it throws unless
 * the system was built with `offline: true`, which `m09_rat` never passes
 * (`structure.test.ts`). That is how the interface forbids running the map
 * without moving, per scene, as Lab 7 scoped its hidden-layer ban.
 */

export interface Senses {
  dt: number
  /** The turn signal, radians per second, as the vestibular pathway reports it: the true turn with the body's noise added. */
  turn: number
  /** The step signal, meters per second, signed, with the body's noise added. */
  step: number
  /** Landmarks in view, each as an egocentric bearing and a distance. Empty in the dark. */
  landmarks: readonly { id: string; bearing: number; distance: number }[]
  /** A wall touched this step: the egocentric bearing of the contact, or null. */
  contact: { bearing: number } | null
  /**
   * The room's center as seen: its egocentric bearing and distance, with
   * the body's noise, while the walls can be seen. Null in the dark. This
   * is what seeing the walls gives: a position in the room up to the room's
   * own symmetry, which the heading estimate resolves (§9.2.6).
   */
  center: { bearing: number; distance: number } | null
  /** The room as perceived, when there is light to perceive it by; null in the dark. */
  room: RoomDescription | null
}

export interface SpatialOptions {
  /** The landmark ids the rings have view units for. */
  landmarks: readonly string[]
  /** Module 10's option. This scene never passes it. */
  offline?: boolean
  /** The rat's body radius, meters, for where a wall contact puts the estimate. */
  bodyRadius?: number
}

export interface CellRates {
  /** The eight head-direction cells shown: upper-ring units 0, 8, …, 56. */
  hd: number[]
  place: number[]
  /** Per group, per cell. */
  grid: number[][]
  /** The four border cells: the wall toward +x, +y, −x, −y. */
  border: number[]
}

/** Peak firing rates, spikes per second, that a rate of 1 stands for. */
export const PEAK_HZ = { hd: 40, place: 20, grid: 15, border: 20 } as const
/** A border cell fires within this distance of its wall, meters. */
export const BORDER_REACH = 0.08
/** A landmark closer than this, and stable, replaces the position estimate outright (resetting, §6.1). */
export const RESET_DISTANCE = 0.15
/** How precisely seeing the walls places the rat in the room, meters (sd). */
export const CENTER_FIX_SD = 0.06

export const HD_SHOWN = [0, 8, 16, 24, 32, 40, 48, 56] as const

export class SpatialSystem {
  readonly hd: HeadDirection
  readonly estimate = new Estimate()
  readonly maps: MapStore
  readonly stability = new Stability()
  /** The rates computed on the last step. */
  rates: CellRates = { hd: new Array(8).fill(0), place: new Array(PLACE_CELLS).fill(0), grid: GRID_SPACINGS.map(() => new Array(GRID_CELLS_PER_GROUP).fill(0)), border: [0, 0, 0, 0] }
  /** Which cells spiked on the last step, same layout as `rates`. */
  spikes: { hd: boolean[]; place: boolean[]; grid: boolean[][]; border: boolean[] } = { hd: new Array(8).fill(false), place: new Array(PLACE_CELLS).fill(false), grid: GRID_SPACINGS.map(() => new Array(GRID_CELLS_PER_GROUP).fill(false)), border: [false, false, false, false] }
  /** The room description last perceived, kept through the dark so the map stays. */
  room: RoomDescription | null = null
  /** Simulated seconds the current map has applied. */
  timeInRoom = 0
  time = 0
  private readonly offline: boolean
  private readonly rng: Rng
  private readonly bodyRadius: number
  /** Landmark ids that jumped on the last step. */
  jumped: string[] = []

  constructor(rng: Rng, opts: SpatialOptions) {
    this.rng = rng
    this.hd = new HeadDirection(rng.fork(), opts.landmarks)
    this.maps = new MapStore(rng.fork())
    this.offline = opts.offline ?? false
    this.bodyRadius = opts.bodyRadius ?? 0.04
  }

  get map(): RoomMap | null {
    return this.maps.current
  }

  heading(): number {
    return this.hd.heading()
  }

  /**
   * A break in the rat's experience: it was picked up. The rings keep
   * running (the vestibular system works while carried), the landmarks'
   * last bearings are forgotten, and the estimate's uncertainty grows.
   */
  cut(): void {
    this.stability.cut()
    this.estimate.variance += 0.05
  }

  /** Remove the turn pathway: the vestibular lesion of §9.3.1. */
  removeTurnPathway(): void {
    this.hd.pathway = false
  }

  step(s: Senses): void {
    this.time += s.dt
    this.timeInRoom += s.dt

    // 1. The room: choose a map when there is light to see the room by. A new map's frame is the
    //    room's axis as seen, in the ring's coordinates.
    if (s.room) {
      const was = this.maps.current
      const h = this.heading()
      const r = this.maps.choose(s.room, h, s.room.axisBearing === null ? h : h + s.room.axisBearing)
      this.room = s.room
      if (r.changed) {
        this.timeInRoom = 0
        if (r.created || !was) this.estimate.variance += 0.5
      }
    }

    // 2. Stability: a landmark whose bearing jumps with no turn to match has moved. The bearing from the
    //    rat is the one to watch: it changes by under a degree a step as the rat walks.
    this.jumped = this.stability.step(s.landmarks, s.turn * s.dt)

    // 3. The rings: turn signal and the landmarks in view, each scaled by its stability and its distance.
    //    A landmark's bearing for the rings is its direction as seen from the room's center, which the
    //    system computes from two things it senses: the vector to the landmark and the vector to the
    //    center. Seen from the center, a card on the wall has one direction wherever the rat stands;
    //    seen from the rat it would swing with every step, and no heading could be learned from it.
    const views: LandmarkView[] = s.landmarks.map((l) => ({ id: l.id, bearing: s.center ? distalBearing(l, s.center) : l.bearing, strength: this.stability.of(l.id) * viewStrength(l.distance) }))
    this.hd.step(s.dt, s.turn, views)
    const heading = this.heading()

    // 4. The running sum, along the ring's heading.
    this.estimate.step(s.dt, heading, s.step)

    // 5. Corrections: a stable landmark's fix, and a wall touched.
    const map = this.maps.current
    if (map) {
      for (const l of s.landmarks) {
        const stable = this.stability.of(l.id)
        if (stable < 0.5) continue
        const a = heading + l.bearing
        const sx = this.estimate.x + l.distance * Math.cos(a)
        const sy = this.estimate.y + l.distance * Math.sin(a)
        const stored = map.landmarks.get(l.id)
        if (!stored) {
          map.landmarks.set(l.id, { x: sx, y: sy })
          continue
        }
        const fx = stored.x - l.distance * Math.cos(a)
        const fy = stored.y - l.distance * Math.sin(a)
        if (l.distance < RESET_DISTANCE) this.estimate.fix(fx, fy, 0)
        else {
          const sd = 0.03 + 0.12 * l.distance
          this.estimate.fix(fx, fy, (sd * sd) / stable)
        }
      }
      if (s.center) {
        const a = heading + s.center.bearing
        this.estimate.fix(-s.center.distance * Math.cos(a), -s.center.distance * Math.sin(a), CENTER_FIX_SD * CENTER_FIX_SD)
      }
      if (s.contact) {
        // The wall touched lies in the direction of the contact; in the map's frame that is a wall of the
        // stored shape at a known distance from the center. The estimate's coordinate along that
        // direction is set to the wall (resetting, §6.1); its coordinate across it is left alone.
        const a = heading + s.contact.bearing
        const inMap = snapToWall(map.shape, a - map.axis)
        const wall = radiusAt(map.shape, inMap) - this.bodyRadius
        const ux = Math.cos(inMap + map.axis)
        const uy = Math.sin(inMap + map.axis)
        this.estimate.resetAlong(ux, uy, wall * ux, wall * uy)
      }
    }

    // 6. The cells, from the estimate, and spikes from the rates.
    this.rates = this.ratesFrom(this.estimate.x, this.estimate.y, s.room?.shape ?? this.room?.shape ?? null)
    this.spikes = this.drawSpikes(this.rates, s.dt)
  }

  /**
   * Module 10's door, shut in this scene: cell activity for a position the
   * rat is not at. Throws unless the system was built with `offline: true`.
   */
  ratesAt(x: number, y: number): CellRates {
    if (!this.offline) throw new Error('This spatial system does not run the map without moving: it was built with offline off (Module 10 is where that door opens).')
    return this.ratesFrom(x, y, this.room?.shape ?? null)
  }

  /** The coordinate a cell with wall anchoring `beta` reads: the running sum blended with the current room mapped onto the stored one. In the map's frame. */
  anchored(map: RoomMap, x: number, y: number, beta: number, current: Shape | null): [number, number] {
    if (!current || beta <= 0) return [x, y]
    const sx = map.shape.width / current.width
    const sy = map.shape.length / current.length
    return [(1 - beta) * x + beta * x * sx, (1 - beta) * y + beta * y * sy]
  }

  /** A position in the ring's coordinates, in the current map's frame. */
  toMapFrame(map: RoomMap, x: number, y: number): [number, number] {
    const c = Math.cos(-map.axis)
    const s = Math.sin(-map.axis)
    return [c * x - s * y, s * x + c * y]
  }

  /** A vector in the map's frame, in the ring's coordinates. */
  fromMapFrame(map: RoomMap, x: number, y: number): [number, number] {
    const c = Math.cos(map.axis)
    const s = Math.sin(map.axis)
    return [c * x - s * y, s * x + c * y]
  }

  private ratesFrom(ex: number, ey: number, current: Shape | null): CellRates {
    const map = this.maps.current
    const hd = HD_SHOWN.map((j) => this.hd.upperRate[j])
    if (!map) return { hd, place: new Array(PLACE_CELLS).fill(0), grid: GRID_SPACINGS.map(() => new Array(GRID_CELLS_PER_GROUP).fill(0)), border: [0, 0, 0, 0] }
    const [x, y] = this.toMapFrame(map, ex, ey)
    const [px, py] = this.anchored(map, x, y, PLACE_ANCHORING, current)
    const place = map.fields.map((f) => (f ? placeRate(f, px, py) : 0))
    const grid = map.grids.map((g, gi) => {
      const [gx, gy] = this.anchored(map, x, y, GRID_ANCHORING[gi], current)
      return g.offsets.map((_, c) => gridRate(g, c, gx, gy))
    })
    const shape = current ?? map.shape
    const border = [0, Math.PI / 2, Math.PI, -Math.PI / 2].map((a) => {
      const d = distanceToBoundary(shape, x, y, Math.cos(a), Math.sin(a), this.bodyRadius)
      return d < BORDER_REACH ? Math.exp(-(d * d) / (2 * 0.04 * 0.04)) : 0
    })
    return { hd, place, grid, border }
  }

  /** The estimate in the current map's frame, for the overhead inset and the tests. */
  estimateInMap(): [number, number] {
    const map = this.maps.current
    return map ? this.toMapFrame(map, this.estimate.x, this.estimate.y) : [this.estimate.x, this.estimate.y]
  }

  /** Move the estimate by a vector given in the map's frame (a test's injected error). */
  injectError(dx: number, dy: number): void {
    const map = this.maps.current
    const [rx, ry] = map ? this.fromMapFrame(map, dx, dy) : [dx, dy]
    this.estimate.x += rx
    this.estimate.y += ry
  }

  private drawSpikes(r: CellRates, dt: number) {
    const draw = (rate: number, peak: number) => this.rng.next() < rate * peak * dt
    return {
      hd: r.hd.map((v) => draw(v, PEAK_HZ.hd)),
      place: r.place.map((v) => draw(v, PEAK_HZ.place)),
      grid: r.grid.map((g) => g.map((v) => draw(v, PEAK_HZ.grid))),
      border: r.border.map((v) => draw(v, PEAK_HZ.border)),
    }
  }

  /** The eight shown head-direction cells' preferred directions, from the upper ring's layout. */
  static hdPreferred(i: number): number {
    return HeadDirection.preferred(HD_SHOWN[i])
  }

  /** For the panel: heading error in degrees against a heading the caller knows; the system itself never sees it. */
  static headingErrorDeg(estimated: number, truth: number): number {
    return deg(angleDiff(truth, estimated))
  }
}

/**
 * Which wall a contact in direction `dir` (map frame) is a contact with. A
 * room with corners has four walls, and a touch is a touch of the nearest
 * one, whatever the heading estimate's drift has done to the direction; a
 * round room has one wall everywhere, so the direction stands.
 */
export function snapToWall(shape: Shape, dir: number): number {
  if (shape.roundness >= 0.5) return dir
  return Math.round(dir / (Math.PI / 2)) * (Math.PI / 2)
}

/** The egocentric bearing a landmark would have from the room's center: the difference of the two seen vectors. */
export function distalBearing(l: { bearing: number; distance: number }, c: { bearing: number; distance: number }): number {
  const x = l.distance * Math.cos(l.bearing) - c.distance * Math.cos(c.bearing)
  const y = l.distance * Math.sin(l.bearing) - c.distance * Math.sin(c.bearing)
  return Math.atan2(y, x)
}

/** How fully a landmark is seen at a distance: fully within half a meter, fading to half at two meters. */
export function viewStrength(distance: number): number {
  return distance <= 0.5 ? 1 : Math.max(0.3, 1 - (distance - 0.5) / 3)
}

export { N, wrap }
