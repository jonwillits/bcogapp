import type { Rng } from '../random'
import { Body, type Command, type Locomotion, type Pose } from '../rodent/body'
import { rad } from '../rodent/spatial/angles'
import { pushOutOf } from '../memory/logs/clearings'
import type { Footprint } from '../rodent/range'
import { HANDS, MORNING_SECONDS, PICK_UP_SECONDS, PLACE_XZ, PLACES, RECIPES, WALK_SPEED, WINDOW_SECONDS, YIELDS, type Item, type Made, type Place } from './range/places'
import { NEED_TABLE, type Cue, type Need } from './range/needs'
import { chainFor } from './range/chains'
import { canMake, execute, makeWith, pickUp, type Segment, type Standing } from './range/acts'

/**
 * Part 3, Step 1 (spec §7.6): the student drives a hominin of their own
 * through a day in the range, with Lab 9's keys and views, picking up,
 * making, and putting down with the act key or the panel's buttons. The
 * day runs on the range's own clock, scaled so that a morning of
 * MORNING_SECONDS of range time takes a few real minutes; the body walks at
 * the hominins' walking speed in range time. The elder does the day's
 * errands in sight, scripted by the scene. It is not scored.
 */

/** Range seconds per real second. */
export const TIME_SCALE = 2.5
/** How near a place the hominin must stand to use it, meters. */
export const REACH = 6
/** The range's bound: a circle around camp beyond which the body is clamped, meters. */
export const RANGE_BOUND = 150

export const STUDENT_LOCOMOTION: Locomotion = { speed: WALK_SPEED * TIME_SCALE, backSpeed: 0.5 * TIME_SCALE, turnRate: rad(120), radius: 0.35, viewDistance: 200 }

export type Phase = 'dawn' | 'morning' | 'midday' | 'afternoon' | 'done'

export interface ActInProgress {
  kind: 'pickUp' | 'make' | 'putDown'
  item?: Item
  what?: Made
  /** Range seconds left. */
  left: number
  total: number
}

export interface StudentDayState {
  cue: Cue
  need: Need
  /** Range seconds since dawn. */
  clock: number
  phase: Phase
  hands: Item[]
  act: ActInProgress | null
  /** Whether the need is at its place now. */
  needPresent: boolean
  ate: boolean
  /** The last thing that happened, for the status line. */
  message: string
  /** A record of what the student did, for the day's summary. */
  log: string[]
}

/** The scattered trees and other obstacles of the range, as footprints the body cannot walk through; drawn by the view from the same list. */
export interface Obstacle {
  x: number
  z: number
  r: number
  kind: 'tree' | 'rock' | 'mound' | 'bigTree'
}

/** Whether a point lies within `margin` of the straight line between two places. */
function nearAnyPath(x: number, z: number, margin: number): boolean {
  for (const a of PLACES)
    for (const b of PLACES) {
      if (a >= b) continue
      const p = PLACE_XZ[a]
      const q = PLACE_XZ[b]
      const vx = q.x - p.x
      const vz = q.z - p.z
      const L2 = vx * vx + vz * vz
      const t = Math.max(0, Math.min(1, ((x - p.x) * vx + (z - p.z) * vz) / L2))
      const d = Math.hypot(x - (p.x + t * vx), z - (p.z + t * vz))
      if (d < margin) return true
    }
  return false
}

/** The obstacles, drawn once from a seed of their own: trees scattered off every path between places, the camp's stand of trees, the outcrop's rocks, the mounds. */
export function obstacles(rng: Rng): Obstacle[] {
  const out: Obstacle[] = []
  // The camp's stand of trees, around the camp but not on it.
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3
    out.push({ x: Math.cos(a) * 7, z: Math.sin(a) * 7, r: 0.6, kind: 'tree' })
  }
  // The lone large tree, a landmark, south-west.
  out.push({ x: -60, z: 60, r: 1.4, kind: 'bigTree' })
  // Scattered trees off the paths.
  let tries = 0
  while (out.length < 46 && tries++ < 4000) {
    const x = rng.range(-140, 140)
    const z = rng.range(-140, 140)
    if (Math.hypot(x, z) > 140 || Math.hypot(x, z) < 12) continue
    if (nearAnyPath(x, z, 6)) continue
    if (PLACES.some((p) => Math.hypot(x - PLACE_XZ[p].x, z - PLACE_XZ[p].z) < 12)) continue
    out.push({ x, z, r: 0.5 + rng.next() * 0.4, kind: 'tree' })
  }
  // The outcrop's rocks and the termite mounds are objects with footprints beside their places.
  out.push({ x: PLACE_XZ.outcrop.x + 3, z: PLACE_XZ.outcrop.z + 3, r: 2, kind: 'rock' })
  out.push({ x: PLACE_XZ.mounds.x + 3, z: PLACE_XZ.mounds.z - 2, r: 1, kind: 'mound' })
  out.push({ x: PLACE_XZ.mounds.x - 3, z: PLACE_XZ.mounds.z + 2, r: 1, kind: 'mound' })
  return out
}

export function footprintsOf(obs: Obstacle[]): Footprint[] {
  return obs.map((o) => ({ ax: o.x, ay: o.z, bx: o.x, by: o.z, r: o.r }))
}

export class StudentDay {
  readonly body: Body
  readonly state: StudentDayState
  readonly elderSegments: Segment[]
  readonly elderFinal: Standing
  private readonly prints: Footprint[]
  /** Range seconds the act key was last honored at, so one press is one act. */
  private lastAct = -1

  constructor(cue: Cue, rng: Rng, obs: Obstacle[]) {
    this.body = new Body(rng, STUDENT_LOCOMOTION, { x: 0, y: -3, heading: Math.PI / 2 })
    const need = (Object.keys(NEED_TABLE) as Need[]).find((n) => NEED_TABLE[n].cue === cue)!
    this.state = { cue, need, clock: 0, phase: 'dawn', hands: [], act: null, needPresent: false, ate: false, message: 'Dawn. The band is at camp.', log: [] }
    this.prints = footprintsOf(obs)
    // The elder's errands for the day, as segments the view animates.
    let s: Standing = { place: 'camp', hands: [], elapsed: 0 }
    const segments: Segment[] = []
    for (const e of chainFor(need)) {
      const r = execute(s, e)
      segments.push(...r.segments)
      s = r.standing
    }
    this.elderSegments = segments
    this.elderFinal = s
  }

  /** The place within reach, or null. */
  nearPlace(): Place | null {
    let best: Place | null = null
    let bestD = REACH
    for (const p of PLACES) {
      const d = Math.hypot(this.body.x - PLACE_XZ[p].x, this.body.y - PLACE_XZ[p].z)
      if (d < bestD) {
        bestD = d
        best = p
      }
    }
    return best
  }

  /** The acts the panel offers now, in the order the act key tries them. */
  available(): { id: string; label: string; run: () => void }[] {
    const s = this.state
    if (s.act || s.phase === 'done') return []
    const out: { id: string; label: string; run: () => void }[] = []
    const here = this.nearPlace()
    const yields = here ? YIELDS[here] : undefined
    if (yields) out.push({ id: `pickUp-${yields}`, label: `Pick up ${yields === 'cobble' ? 'a cobble' : 'a sapling'}${s.hands.length >= HANDS ? ` (putting down ${s.hands[0] === 'diggingStick' ? 'the digging stick' : `the ${s.hands[0]}`})` : ''}`, run: () => this.startAct({ kind: 'pickUp', item: yields, left: PICK_UP_SECONDS, total: PICK_UP_SECONDS }) })
    for (const what of ['flake', 'probe', 'diggingStick'] as Made[]) {
      const r = RECIPES[what]
      if (!canMake(s.hands, what)) continue
      if (r.at && here !== r.at) continue
      out.push({ id: `make-${what}`, label: what === 'flake' ? 'Make a flake (strike the cobble on the outcrop’s stone)' : what === 'probe' ? 'Strip the sapling into a probe' : 'Sharpen the sapling into a digging stick', run: () => this.startAct({ kind: 'make', what, left: r.seconds, total: r.seconds }) })
    }
    for (const item of s.hands) out.push({ id: `putDown-${item}`, label: `Put down ${item === 'diggingStick' ? 'the digging stick' : `the ${item}`}`, run: () => this.startAct({ kind: 'putDown', item, left: 3, total: 3 }) })
    return out
  }

  private startAct(a: ActInProgress): void {
    this.state.act = a
    this.state.message = a.kind === 'pickUp' ? `Picking up ${a.item === 'cobble' ? 'a cobble' : 'a sapling'}.` : a.kind === 'make' ? `Making ${a.what === 'flake' ? 'a flake' : a.what === 'probe' ? 'a probe' : 'a digging stick'}.` : `Putting down the ${a.item}.`
  }

  private finishAct(): void {
    const a = this.state.act
    if (!a) return
    const s = this.state
    if (a.kind === 'pickUp' && a.item) {
      const r = pickUp(s.hands, a.item)
      s.hands = r.hands
      s.log.push(`${fmt(s.clock)}: picked up ${a.item === 'cobble' ? 'a cobble' : 'a sapling'}${r.dropped ? `, putting down the ${r.dropped}` : ''}`)
      s.message = `You hold ${describeHands(s.hands)}.`
    } else if (a.kind === 'make' && a.what) {
      const r = makeWith(s.hands, a.what)
      s.hands = r.hands
      s.log.push(`${fmt(s.clock)}: made ${a.what === 'flake' ? 'a flake' : a.what === 'probe' ? 'a probe' : 'a digging stick'}`)
      s.message = `You hold ${describeHands(s.hands)}.`
    } else if (a.kind === 'putDown' && a.item) {
      s.hands = s.hands.filter((it, i) => !(it === a.item && i === s.hands.indexOf(a.item!)))
      s.log.push(`${fmt(s.clock)}: put down the ${a.item}`)
      s.message = `You hold ${describeHands(s.hands)}.`
    }
    s.act = null
  }

  /** One step of real time: the body moves if no act is under way, the clock runs at TIME_SCALE. */
  tick(dt: number, cmd: Command & { act: boolean }): void {
    const s = this.state
    if (s.phase === 'done') return
    const rt = dt * TIME_SCALE
    if (s.act) {
      s.act.left -= rt
      if (s.act.left <= 0) this.finishAct()
    } else {
      this.body.step(dt, cmd, null)
      const pushed = pushOutOf(this.body.x, this.body.y, this.body.loco.radius, this.prints)
      this.body.x = pushed.x
      this.body.y = pushed.y
      const r = Math.hypot(this.body.x, this.body.y)
      if (r > RANGE_BOUND) {
        this.body.x *= RANGE_BOUND / r
        this.body.y *= RANGE_BOUND / r
      }
      if (cmd.act && s.clock - this.lastAct > 0.5) {
        this.lastAct = s.clock
        const acts = this.available()
        if (acts.length) acts[0].run()
        else s.message = 'Nothing to do here: walk to a place, or hold what a making needs.'
      }
    }
    s.clock += rt
    if (s.phase === 'dawn' && s.clock > 1) s.phase = 'morning'
    if (s.phase === 'morning' && s.clock >= MORNING_SECONDS) {
      s.phase = 'midday'
      s.needPresent = true
      s.message = `Midday: ${needAppears(s.need)}`
      s.log.push(`${fmt(s.clock)}: midday; ${needAppears(s.need)}`)
    }
    if (s.phase === 'midday') {
      const spec = NEED_TABLE[s.need]
      const d = Math.hypot(this.body.x - PLACE_XZ[spec.place].x, this.body.y - PLACE_XZ[spec.place].z)
      if (!s.ate && d < REACH && s.hands.includes(spec.takes)) {
        s.ate = true
        s.message = `You reached ${spec.place === 'grassland' ? 'the grassland' : spec.place === 'oldKill' ? 'the old kill' : spec.place === 'mounds' ? 'the termite mounds' : 'the tuber flats'} holding ${spec.takesLabel.split(',')[0]}, and ate.`
        s.log.push(`${fmt(s.clock)}: ate`)
      }
      if (s.clock >= MORNING_SECONDS + WINDOW_SECONDS) {
        s.phase = 'afternoon'
        s.needPresent = false
        if (!s.ate) {
          s.message = 'The window closed. Nothing was eaten today.'
          s.log.push(`${fmt(s.clock)}: the window closed; nothing eaten`)
        }
      }
    }
    if (s.phase === 'afternoon' && s.clock >= MORNING_SECONDS + WINDOW_SECONDS + 10) s.phase = 'done'
  }

  get pose(): Pose {
    return this.body.pose
  }
}

export function describeHands(hands: readonly Item[]): string {
  if (!hands.length) return 'nothing'
  return hands.map((h) => (h === 'diggingStick' ? 'a digging stick' : `a ${h}`)).join(' and ')
}

export function needAppears(need: Need): string {
  switch (need) {
    case 'carcass':
      return 'a carcass lies on the grassland.'
    case 'marrow':
      return 'bones with marrow lie at the old kill.'
    case 'termites':
      return 'winged termites rise from the mounds.'
    case 'tubers':
      return 'tubers can be dug from the dry flats.'
  }
}

export const fmt = (rangeSeconds: number): string => {
  const m = Math.floor(rangeSeconds / 60)
  const s = Math.floor(rangeSeconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

/** Where a programmed hominin is at a moment of range time, from its day's segments: straight walks between places, standing still otherwise. */
export function positionAt(segments: readonly Segment[], t: number): { x: number; z: number; heading: number; moving: boolean; doing: string } {
  let last: Place = 'camp'
  let lastT0 = 0
  for (const s of segments) {
    if (s.kind === 'walk') {
      if (t >= s.t0 && t < s.t1) {
        const u = (t - s.t0) / Math.max(1e-6, s.t1 - s.t0)
        const a = PLACE_XZ[s.from]
        const b = PLACE_XZ[s.to]
        return { x: a.x + (b.x - a.x) * u, z: a.z + (b.z - a.z) * u, heading: Math.atan2(b.z - a.z, b.x - a.x), moving: true, doing: `walking to ${s.to}` }
      }
      if (t >= s.t1) {
        last = s.to
        lastT0 = s.t1
      }
    } else if (s.kind === 'wait') {
      if (t >= s.t0) return { x: PLACE_XZ[s.place].x, z: PLACE_XZ[s.place].z, heading: 0, moving: false, doing: `waiting at ${s.place}` }
    } else if (t >= s.t0 && t < s.t1) {
      const p = PLACE_XZ[s.place]
      return { x: p.x, z: p.z, heading: 0, moving: false, doing: s.kind === 'pickUp' ? `picking up ${s.item}` : s.kind === 'make' ? `making ${s.what}` : `putting down ${s.item}` }
    }
  }
  void lastT0
  const p = PLACE_XZ[last]
  return { x: p.x, z: p.z, heading: 0, moving: false, doing: `at ${last}` }
}
