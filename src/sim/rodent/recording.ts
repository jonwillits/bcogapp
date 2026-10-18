import { makeRng, type Rng } from '../random'
import { Body, Explorer, BOX_LOCOMOTION, STILL, type Command, type Pose, type Room } from './body'
import { FiringMaps } from './firingMap'
import { RECORDING_LANDMARKS, BOX_A } from './rooms'
import { angleDiff, deg, rad, wrap } from './spatial/angles'
import { CONTROL_BAR } from './spatial/ring'
import { SpatialSystem, HD_SHOWN } from './spatial/system'
import { GRID_SPACINGS, GRID_CELLS_PER_GROUP, PLACE_CELLS } from './spatial/maps'

/**
 * Part 3's recording session (spec §9): a rat in a recording box, with its
 * spatial system running and the experimenter's firing maps filling in.
 * Everything a step in Part 3 does is a method here, so that the scene
 * only draws and the tests run the same session headless.
 *
 * The experimenter's camera is this file: it knows the true pose and the
 * estimate both, prints their gap, and bins spikes by true position. The
 * spatial system never sees the true pose.
 */

export const DT = 0.02

export type CellKey = string

export const CELL_KEYS = {
  hd: HD_SHOWN.map((_, i) => `hd${i}`),
  place: Array.from({ length: PLACE_CELLS }, (_, i) => `place${i}`),
  grid: GRID_SPACINGS.map((_, g) => Array.from({ length: GRID_CELLS_PER_GROUP }, (_, c) => `grid${g}-${c}`)),
  border: ['border0', 'border1', 'border2', 'border3'],
}

export interface TracePoint {
  x: number
  y: number
  ex: number
  ey: number
}

export interface PinnedMaps {
  label: string
  maps: FiringMaps
}

export class RecordingSession {
  readonly seed: number
  readonly body: Body
  readonly spatial: SpatialSystem
  room: Room
  lit = true
  /** Where each moved card now stands, relative to the room's center. */
  readonly cardMoved = new Map<string, { x: number; y: number }>()
  /** The rat drives itself (`Let it explore by itself`) or takes the student's keys. */
  exploring = false
  maps: FiringMaps
  readonly pinned: PinnedMaps[] = []
  /** The last few seconds of true and estimated positions, for the overhead inset. */
  readonly trace: TracePoint[] = []
  readonly traceCap = 600
  time = 0
  /** Seconds in the current room when the card's control first crossed the bar, or null. */
  controlAt: number | null = null
  /** How many times the card has been moved while in sight, this room. */
  seenMoves = 0
  private readonly rng: Rng
  private readonly explorer: Explorer
  private cmd: Command = STILL

  constructor(seed: number, room: Room = BOX_A) {
    this.seed = seed
    this.rng = makeRng(seed)
    this.body = new Body(this.rng.fork(), BOX_LOCOMOTION, { x: -0.2, y: -0.2, heading: rad(45) })
    this.spatial = new SpatialSystem(this.rng.fork(), { landmarks: RECORDING_LANDMARKS, bodyRadius: BOX_LOCOMOTION.radius })
    this.explorer = new Explorer(this.rng.fork())
    this.room = room
    this.maps = new FiringMaps(room.shape.width, room.shape.length)
    // One first look so the map exists and the estimate is placed by what the rat sees.
    this.spatial.step(this.body.senses(DT, room, true, this.cardMoved))
  }

  /** The card of the current room. */
  get cardId(): string {
    return this.room.landmarks[0].id
  }

  get cardControl(): number {
    return this.spatial.hd.controlOf(this.cardId)
  }

  get cardControls(): boolean {
    return this.cardControl >= CONTROL_BAR
  }

  /** The student's keys this frame. */
  drive(cmd: Command): void {
    this.cmd = cmd
  }

  step(dt = DT): void {
    const cmd = this.exploring ? this.explorer.command(dt, this.body, this.room.shape) : this.cmd
    this.body.step(dt, cmd, this.room.shape)
    const senses = this.body.senses(dt, this.room, this.lit, this.cardMoved)
    this.spatial.step(senses)
    this.time += dt
    if (this.controlAt === null && this.cardControls) this.controlAt = this.spatial.timeInRoom
    // The experimenter's record.
    const sp = this.spatial.spikes
    const spiked: { key: string; hd?: boolean }[] = []
    sp.hd.forEach((v, i) => v && spiked.push({ key: CELL_KEYS.hd[i], hd: true }))
    sp.place.forEach((v, i) => v && spiked.push({ key: CELL_KEYS.place[i] }))
    sp.grid.forEach((g, gi) => g.forEach((v, c) => v && spiked.push({ key: CELL_KEYS.grid[gi][c] })))
    sp.border.forEach((v, i) => v && spiked.push({ key: CELL_KEYS.border[i] }))
    this.maps.record(dt, this.body.x, this.body.y, this.body.heading, spiked)
    const [ex, ey] = this.spatial.estimateInMap()
    this.trace.push({ x: this.body.x, y: this.body.y, ex, ey })
    if (this.trace.length > this.traceCap) this.trace.splice(0, this.trace.length - this.traceCap)
  }

  /** Run `seconds` of simulated time without drawing: *Skip ahead*. The same run as watching it. */
  run(seconds: number): void {
    const n = Math.round(seconds / DT)
    for (let i = 0; i < n; i++) this.step(DT)
  }

  /**
   * The gap between the estimate and the truth, meters (the estimate taken
   * in its map's frame, which is the room's), and the ring's offset from
   * the true heading, degrees. The offset is arbitrary — the ring does not
   * know north — and what matters is whether it holds still.
   */
  errors(): { position: number; heading: number } {
    const [ex, ey] = this.spatial.estimateInMap()
    const dx = ex - this.body.x
    const dy = ey - this.body.y
    return { position: Math.sqrt(dx * dx + dy * dy), heading: deg(angleDiff(this.body.heading, this.spatial.heading())) }
  }

  /** Pin the maps recorded so far under a label and start fresh ones. */
  pin(label: string): void {
    this.pinned.push({ label, maps: this.maps })
    this.maps = new FiringMaps(this.room.shape.width, this.room.shape.length)
  }

  clearMaps(): void {
    this.maps = new FiringMaps(this.room.shape.width, this.room.shape.length)
  }

  lightsOut(): void {
    this.lit = false
  }

  lightsOn(): void {
    this.lit = true
  }

  /**
   * Move the card around the walls by `degrees` about the room's center. A
   * move is in sight when the rat can see the card both before and after
   * it, which the session counts. Returns whether it was.
   */
  turnCard(degrees: number): boolean {
    const l = this.room.landmarks[0]
    const now = this.cardMoved.get(l.id) ?? { x: l.x, y: l.y }
    const seenBefore = this.body.landmarksInView(this.room, this.lit, this.cardMoved).some((v) => v.id === l.id)
    const a = Math.atan2(now.y, now.x) + rad(degrees)
    const r = Math.sqrt(now.x * now.x + now.y * now.y)
    this.cardMoved.set(l.id, { x: r * Math.cos(a), y: r * Math.sin(a) })
    const seen = seenBefore && this.body.landmarksInView(this.room, this.lit, this.cardMoved).some((v) => v.id === l.id)
    if (seen) this.seenMoves++
    return seen
  }

  /** Whether a move of the card by `degrees` would keep it in the rat's view, from where the rat now stands and faces. */
  cardStaysInView(degrees: number): boolean {
    const l = this.room.landmarks[0]
    const now = this.cardMoved.get(l.id) ?? { x: l.x, y: l.y }
    const a = Math.atan2(now.y, now.x) + rad(degrees)
    const r = Math.sqrt(now.x * now.x + now.y * now.y)
    const moved = new Map(this.cardMoved)
    moved.set(l.id, { x: r * Math.cos(a), y: r * Math.sin(a) })
    return this.body.landmarksInView(this.room, this.lit, moved).some((v) => v.id === l.id && Math.abs(v.bearing) < rad(85))
  }

  /**
   * The rat is taken out of the box (the screen fades through black) and
   * put back, or put into another room. Its vestibular system works while
   * it is carried, so the rings track the carrying; the carry turns it by
   * a seeded angle, and it is set down at a seeded place.
   */
  carry(to: Room = this.room, pose?: Pose): void {
    const turn = this.rng.range(-Math.PI, Math.PI)
    // The carry: a few seconds of passive turning in the dark, which the turn pathway reports.
    const seconds = 4
    const n = Math.round(seconds / DT)
    for (let i = 0; i < n; i++) {
      this.body.heading = wrap(this.body.heading + turn / n)
      this.body.lastTurn = turn / seconds
      this.body.lastStep = 0
      this.body.contact = null
      this.spatial.step(this.body.senses(DT, this.room, false))
    }
    this.spatial.cut()
    if (to !== this.room) {
      this.room = to
      this.cardMoved.clear()
      this.seenMoves = 0
      this.controlAt = null
      this.maps = new FiringMaps(to.shape.width, to.shape.length)
      this.trace.length = 0
    }
    const [hx, hy] = [to.shape.width / 2, to.shape.length / 2]
    const p = pose ?? { x: this.rng.range(-hx * 0.5, hx * 0.5), y: this.rng.range(-hy * 0.5, hy * 0.5), heading: this.body.heading }
    this.body.place(p)
    this.body.lastTurn = 0
    this.body.lastStep = 0
    // The first look at the room chooses its map and places the estimate by what the rat sees.
    this.spatial.step(this.body.senses(DT, this.room, this.lit, this.cardMoved))
  }

  removeTurnPathway(): void {
    this.spatial.removeTurnPathway()
  }

  /** Preferred directions of the eight head-direction cells from the current maps, degrees. */
  hdPreferred(maps = this.maps): number[] {
    return CELL_KEYS.hd.map((k) => deg(maps.hdTuning(k).preferred))
  }

  hdTuningIndex(maps = this.maps): number {
    const idx = CELL_KEYS.hd.map((k) => maps.hdTuning(k).index)
    return idx.reduce((a, b) => a + b, 0) / idx.length
  }

  /** Share of the floor bins visited in the current maps. */
  coverage(): number {
    const s = this.room.shape
    return this.maps.coverage((x, y) => {
      const r = Math.sqrt(x * x + y * y)
      return r <= (s.roundness > 0 ? Math.min(s.width, s.length) / 2 : Math.max(s.width, s.length)) && insideShape(s, x, y)
    })
  }
}

function insideShape(s: { width: number; length: number; roundness: number }, x: number, y: number): boolean {
  const r = Math.sqrt(x * x + y * y)
  if (r < 1e-9) return true
  const phi = Math.atan2(y, x)
  const c = Math.cos(phi)
  const sn = Math.sin(phi)
  const a = s.width / 2
  const b = s.length / 2
  const rectR = Math.min(Math.abs(c) > 1e-9 ? a / Math.abs(c) : Infinity, Math.abs(sn) > 1e-9 ? b / Math.abs(sn) : Infinity)
  const R = s.roundness <= 0 ? rectR : (1 - s.roundness) * rectR + s.roundness * Math.min(a, b)
  return r <= R - 0.035
}
