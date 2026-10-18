import type { Rng } from '../random'
import type { RoomDescription } from './spatial/maps'
import type { Senses } from './spatial/system'
import { angleDiff, rad, wrap } from './spatial/angles'
import { distanceToBoundary, inside, outwardNormal, type Shape } from './shape'

/**
 * The rat's body: its true pose, its locomotion, and what it senses. This
 * file is the only place the true pose lives, and nothing under `spatial/`
 * imports it (`structure.test.ts`). The body turns the true pose into the
 * numbers the spatial system is given: a noisy turn signal, a noisy step
 * signal, landmarks as bearings and distances while there is light enough,
 * a wall touched through the whiskers, and the room as perceived.
 */

export interface Pose {
  x: number
  y: number
  heading: number
}

/** What the student's keys, or a programmed policy, ask of the body on one step. */
export interface Command {
  /** 1 forward, −1 a slow step back, 0 still. */
  forward: -1 | 0 | 1
  /** 1 turn left (counterclockwise), −1 right, 0 none. */
  turn: -1 | 0 | 1
}

export const STILL: Command = { forward: 0, turn: 0 }

export interface Landmark {
  id: string
  /** Position relative to the room's center, meters. */
  x: number
  y: number
  /** For the scene's drawing and the room description. */
  color: string
  /** A near landmark gives a position; a distant one only a direction (the range's tall tree). */
  distant?: boolean
}

export interface Room {
  id: string
  shape: Shape
  wallColor: string
  floorColor: string
  landmarks: Landmark[]
}

export interface Locomotion {
  /** Meters per second when the forward key is held. */
  speed: number
  /** Meters per second stepping back. */
  backSpeed: number
  /** Radians per second when a turn key is held. */
  turnRate: number
  /** Body radius for wall contact, meters. */
  radius: number
  /** Landmarks are seen out to this distance when lit, meters. */
  viewDistance: number
}

/** In the recording box: about 0.5 m/s, a 20 cm body (§3.2). */
export const BOX_LOCOMOTION: Locomotion = { speed: 0.5, backSpeed: 0.2, turnRate: rad(120), radius: 0.04, viewDistance: 3 }
/** In the range: about 1.5 m/s, near landmarks within about 10 m in moonlight (§5.1). */
export const RANGE_LOCOMOTION: Locomotion = { speed: 1.5, backSpeed: 0.5, turnRate: rad(120), radius: 0.1, viewDistance: 10 }

/** The body's noise: the vestibular report of a turn, and the step signal. Seeded. */
export const SENSE_NOISE = {
  /** Added to the turn signal each step, radians per second, white. */
  turn: 0.1,
  /** A steady miscalibration of the turn signal, as a fraction: 1.005 reports turns half a percent large. */
  turnGain: 1.0,
  /** The step signal's error as a share of speed, white. */
  stepShare: 0.05,
  /** Added to the step signal, meters per second, white. */
  step: 0.01,
  /** How precisely the walls, seen, place the rat: meters, sd, per axis. */
  centerSd: 0.04,
} as const

/** The field of view either side of the head within which a landmark can be seen. */
export const FIELD_OF_VIEW = rad(100)

export class Body {
  x: number
  y: number
  heading: number
  readonly loco: Locomotion
  private readonly rng: Rng
  /** The turn and step actually taken on the last step, for the record. */
  lastTurn = 0
  lastStep = 0
  /** Whether a wall was touched on the last step, and the egocentric bearing of the contact. */
  contact: { bearing: number } | null = null

  constructor(rng: Rng, loco: Locomotion, pose: Pose = { x: 0, y: 0, heading: 0 }) {
    this.rng = rng
    this.loco = loco
    this.x = pose.x
    this.y = pose.y
    this.heading = pose.heading
  }

  get pose(): Pose {
    return { x: this.x, y: this.y, heading: this.heading }
  }

  place(pose: Pose): void {
    this.x = pose.x
    this.y = pose.y
    this.heading = pose.heading
    this.contact = null
  }

  /**
   * One step of locomotion inside a room (or none, in the open). Constant
   * speed while a key is held; no acceleration curve. Against a wall the
   * body slides and reports the contact through its whiskers.
   */
  step(dt: number, cmd: Command, room: Shape | null): void {
    const turn = cmd.turn * this.loco.turnRate
    this.heading = wrap(this.heading + turn * dt)
    const v = cmd.forward > 0 ? this.loco.speed : cmd.forward < 0 ? -this.loco.backSpeed : 0
    this.lastTurn = turn
    this.lastStep = v
    this.contact = null
    if (v === 0) {
      if (room && !inside(room, this.x, this.y, this.loco.radius - 1e-6)) this.contact = { bearing: this.contactBearing(room) }
      return
    }
    const x0 = this.x
    const y0 = this.y
    const nx = this.x + v * dt * Math.cos(this.heading)
    const ny = this.y + v * dt * Math.sin(this.heading)
    if (!room || inside(room, nx, ny, this.loco.radius)) {
      this.x = nx
      this.y = ny
      return
    }
    // Slide along the wall: take the part of the step tangent to the boundary.
    const [ox, oy] = outwardNormal(room, nx, ny)
    const dx = nx - this.x
    const dy = ny - this.y
    const along = dx - (dx * ox + dy * oy) * ox
    const alongY = dy - (dx * ox + dy * oy) * oy
    const sx = this.x + along
    const sy = this.y + alongY
    if (inside(room, sx, sy, this.loco.radius)) {
      this.x = sx
      this.y = sy
    } else {
      // Press into the wall: stay, but make sure we are inside.
      const r = Math.sqrt(this.x * this.x + this.y * this.y)
      if (r > 0 && !inside(room, this.x, this.y, this.loco.radius)) {
        const d = distanceToBoundary(room, 0, 0, this.x / r, this.y / r, this.loco.radius)
        this.x = (this.x / r) * d
        this.y = (this.y / r) * d
      }
    }
    this.contact = { bearing: this.contactBearing(room) }
    // The step signal reports the distance the body actually moved, not the key: pressed into a wall, the legs slip.
    this.lastStep = (Math.sqrt((this.x - x0) ** 2 + (this.y - y0) ** 2) / dt) * Math.sign(v)
  }

  /** The egocentric bearing of the wall being touched: the outward normal at the nearest boundary point, relative to the head. */
  private contactBearing(room: Shape): number {
    const [ox, oy] = outwardNormal(room, this.x, this.y)
    return angleDiff(this.heading, Math.atan2(oy, ox))
  }

  /** Landmarks of `room` as the body sees them now: bearing and distance, within the field of view and the view distance. Empty in the dark. */
  landmarksInView(room: Room, lit: boolean, cardMoved?: Map<string, { x: number; y: number }>): { id: string; bearing: number; distance: number }[] {
    if (!lit) return []
    const out: { id: string; bearing: number; distance: number }[] = []
    for (const l of room.landmarks) {
      const p = cardMoved?.get(l.id) ?? l
      const dx = p.x - this.x
      const dy = p.y - this.y
      const distance = Math.sqrt(dx * dx + dy * dy)
      if (!l.distant && distance > this.loco.viewDistance) continue
      const bearing = angleDiff(this.heading, Math.atan2(dy, dx))
      if (Math.abs(bearing) > FIELD_OF_VIEW) continue
      out.push({ id: l.id, bearing, distance })
    }
    return out
  }

  /** The room's center as seen from the walls around: bearing and distance, with a little noise. */
  private centerSeen(): { bearing: number; distance: number } {
    const dx = -this.x + SENSE_NOISE.centerSd * this.rng.normal()
    const dy = -this.y + SENSE_NOISE.centerSd * this.rng.normal()
    return { bearing: angleDiff(this.heading, Math.atan2(dy, dx)), distance: Math.sqrt(dx * dx + dy * dy) }
  }

  /** The senses handed to the spatial system this step. */
  senses(dt: number, room: Room, lit: boolean, cardMoved?: Map<string, { x: number; y: number }>): Senses {
    const n = SENSE_NOISE
    return {
      dt,
      turn: this.lastTurn * n.turnGain + n.turn * this.rng.normal(),
      step: this.lastStep * (1 + n.stepShare * this.rng.normal()) + n.step * this.rng.normal(),
      landmarks: this.landmarksInView(room, lit, cardMoved),
      contact: this.contact,
      center: lit ? this.centerSeen() : null,
      room: lit ? describe(room, this.heading) : null,
    }
  }
}

/**
 * A room as the rat perceives it in the light. The room's x axis, as the
 * walls and the card together show it, is given as a bearing from the
 * head; a round room shows no axis.
 */
export function describe(room: Room, heading: number): RoomDescription {
  return {
    shape: room.shape,
    wallColor: room.wallColor,
    floorColor: room.floorColor,
    landmarks: room.landmarks.map((l) => l.id),
    axisBearing: room.shape.roundness >= 0.95 ? null : angleDiff(heading, 0),
  }
}

/**
 * *Let it explore by itself*: a seeded foraging path. The turn rate wanders
 * (an Ornstein–Uhlenbeck process), the rat mostly moves forward with
 * pauses, and it turns away from a wall ahead. Covers at least 90% of a
 * 1 m box's floor bins within 10 simulated minutes (`recording.test.ts`).
 */
export class Explorer {
  private omega = 0
  private pause = 0
  private readonly rng: Rng
  constructor(rng: Rng) {
    this.rng = rng
  }

  command(dt: number, body: Body, room: Shape | null): Command {
    const theta = 1.0
    const sd = 1.2
    this.omega += -theta * this.omega * dt + sd * Math.sqrt(2 * theta * dt) * this.rng.normal()
    if (room) {
      const ahead = distanceToBoundary(room, body.x, body.y, Math.cos(body.heading), Math.sin(body.heading), body.loco.radius)
      if (ahead < 0.2) {
        // Turn away from the wall, toward whichever side has more room.
        const left = distanceToBoundary(room, body.x, body.y, Math.cos(body.heading + 1), Math.sin(body.heading + 1), body.loco.radius)
        const right = distanceToBoundary(room, body.x, body.y, Math.cos(body.heading - 1), Math.sin(body.heading - 1), body.loco.radius)
        this.omega = (left > right ? 1 : -1) * 2.5
      }
    }
    if (this.pause > 0) {
      this.pause -= dt
      return { forward: 0, turn: this.omega > 0.3 ? 1 : this.omega < -0.3 ? -1 : 0 }
    }
    if (this.rng.next() < 0.02 * dt) this.pause = this.rng.range(0.3, 1.2)
    return { forward: 1, turn: this.omega > 0.6 ? 1 : this.omega < -0.6 ? -1 : 0 }
  }
}
