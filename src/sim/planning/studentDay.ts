import type { Rng } from '../random'
import { Body, type Command, type Locomotion, type Pose } from '../rodent/body'
import { rad } from '../rodent/spatial/angles'
import { pushOutOf } from '../memory/logs/clearings'
import type { Footprint } from '../rodent/range'
import { ITEM_LABEL, MORNING_SECONDS, PICK_UP_SECONDS, PLACE_XZ, PLACES, RECIPES, WALK_SPEED, WINDOW_SECONDS, YIELDS, type Item, type Made, type Place } from './range/places'
import { NEED_TABLE, type Cue, type Need } from './range/needs'
import { chainFor } from './range/chains'
import { canMake, execute, PUT_DOWN_SECONDS, type Segment, type Standing } from './range/acts'

/**
 * Part 3, Step 1 (spec §7.6): the student moves a hominin of their own
 * through a day in the range, with Lab 9's keys and views. The hominin has
 * two named hands, left (the J key) and right (the K key): an empty hand
 * picks up what is nearest, a full hand puts its item down where the
 * hominin stands, and Enter makes what the hands allow. An item put down
 * stays on the ground and can be picked up again; a flake struck at the
 * outcrop lands on the ground beside it (Jon's walk, 2026-11-11). The day
 * runs on the range's own clock, scaled so that a morning of MORNING_SECONDS
 * of range time takes a few real minutes; the body walks at the hominins'
 * walking speed in range time. The elder does the day's errands in sight,
 * scripted by the scene. It is not scored.
 */

/** Range seconds per real second. */
export const TIME_SCALE = 2.5
/** How near a place the hominin must stand to use it, meters. */
export const REACH = 6
/** How near an item on the ground the hominin must stand to pick it up, meters. */
export const ITEM_REACH = 2.5
/** The range's bound: a circle around camp beyond which the body is clamped, meters. */
export const RANGE_BOUND = 150

export const STUDENT_LOCOMOTION: Locomotion = { speed: WALK_SPEED * TIME_SCALE, backSpeed: 0.5 * TIME_SCALE, turnRate: rad(120), radius: 0.35, viewDistance: 200 }

export type Phase = 'dawn' | 'morning' | 'midday' | 'afternoon' | 'done'

/** 0 is the left hand (J), 1 the right (K). */
export type Hand = 0 | 1
export const HAND_NAME: Record<Hand, string> = { 0: 'left hand', 1: 'right hand' }
export const HAND_KEY: Record<Hand, string> = { 0: 'J', 1: 'K' }

/** Range seconds the act at the need's place takes (cutting, breaking, probing, digging); the window is WINDOW_SECONDS. */
export const EAT_SECONDS = 15

/** Over the view when the student stands at the need's place holding what it requires: the act is a press away. */
export const AT_THE_PLACE_LINE = 'You are at the place holding what the need requires. Press Enter, or the button under the view.'

/** The act at the need's place, as the Enter button names it (Jon, 2026-11-11: the day should end with something you press). */
export function eatLabel(need: Need): string {
  return need === 'carcass' ? 'cut meat from the carcass with the flake' : need === 'marrow' ? 'break a bone with the cobble for its marrow' : need === 'termites' ? 'take termites from the mound with the probe' : 'dig a tuber with the digging stick'
}

/** The same act under way, for the bar. */
export function eatingLabel(need: Need): string {
  return need === 'carcass' ? 'Cutting meat from the carcass.' : need === 'marrow' ? 'Breaking a bone for its marrow.' : need === 'termites' ? 'Taking termites from the mound.' : 'Digging a tuber.'
}

export interface ActInProgress {
  kind: 'pickUp' | 'make' | 'putDown' | 'eat'
  item?: Item
  what?: Made
  hand?: Hand
  /** The ground item being picked up, if any. */
  groundId?: number
  /** Range seconds left. */
  left: number
  total: number
}

/** An item lying in the range, where it was put down or struck off. */
export interface GroundItem {
  id: number
  item: Item
  x: number
  z: number
}

export interface StudentDayState {
  cue: Cue
  need: Need
  /** Range seconds since dawn. */
  clock: number
  phase: Phase
  /** What each hand holds: index 0 the left, 1 the right. */
  slots: [Item | null, Item | null]
  /** The items in hand, left then right, for the rules that count them. */
  hands: Item[]
  /** Items lying in the range. */
  ground: GroundItem[]
  act: ActInProgress | null
  /** Whether the need is at its place now. */
  needPresent: boolean
  ate: boolean
  /** The last thing that happened, for the status line. */
  message: string
  /** A record of what the student did, for the day's summary. */
  log: string[]
}

/** What the panel offers now: one act for a key. */
export interface Offered {
  id: string
  label: string
  key: 'J' | 'K' | 'Enter'
  run: () => void
}

/** The scattered trees and other obstacles of the range, as footprints the body cannot walk through; drawn by the view from the same list, except `stone`, which the places' own shapes draw. */
export interface Obstacle {
  x: number
  z: number
  r: number
  kind: 'tree' | 'rock' | 'mound' | 'bigTree' | 'stone'
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

/** The obstacles, drawn once from a seed of their own: trees scattered off every path between places, the camp's stand of trees, the outcrop's rocks and stone, the mounds. */
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
  // The outcrop's own stone and the mound at the mounds' center, drawn by the view's place shapes, stop the body too (Jon walked through the outcrop, 2026-11-11).
  out.push({ x: PLACE_XZ.outcrop.x, z: PLACE_XZ.outcrop.z, r: 2.3, kind: 'stone' })
  out.push({ x: PLACE_XZ.outcrop.x - 2.5, z: PLACE_XZ.outcrop.z - 1, r: 0.9, kind: 'stone' })
  out.push({ x: PLACE_XZ.mounds.x, z: PLACE_XZ.mounds.z, r: 1.3, kind: 'stone' })
  return out
}

export function footprintsOf(obs: Obstacle[]): Footprint[] {
  return obs.map((o) => ({ ax: o.x, ay: o.z, bx: o.x, by: o.z, r: o.r }))
}

/** The footprint of the need's object while it lies at its place: the carcass and the bones have bulk; termites and tubers do not. */
export function needFootprint(need: Need): Footprint | null {
  const p = PLACE_XZ[NEED_TABLE[need].place]
  const r = need === 'carcass' ? 1.7 : need === 'marrow' ? 0.9 : 0
  return r ? { ax: p.x, ay: p.z, bx: p.x, by: p.z, r } : null
}

const an = (item: Item) => ITEM_LABEL[item]
const the = (item: Item) => ITEM_LABEL[item].replace(/^a /, 'the ')

export class StudentDay {
  readonly body: Body
  readonly state: StudentDayState
  readonly elderSegments: Segment[]
  readonly elderFinal: Standing
  private readonly prints: Footprint[]
  /** Range seconds a hand key or Enter was last honored at, so one press is one act. */
  private lastAct = -1
  /** The pose before the last step, so the view can draw the body between steps. */
  private prev: Pose
  private nextGroundId = 1

  constructor(cue: Cue, rng: Rng, obs: Obstacle[]) {
    this.body = new Body(rng, STUDENT_LOCOMOTION, { x: 0, y: -3, heading: Math.PI / 2 })
    this.prev = { x: this.body.x, y: this.body.y, heading: this.body.heading }
    const need = (Object.keys(NEED_TABLE) as Need[]).find((n) => NEED_TABLE[n].cue === cue)!
    this.state = { cue, need, clock: 0, phase: 'dawn', slots: [null, null], hands: [], ground: [], act: null, needPresent: false, ate: false, message: 'Dawn. The band is at camp.', log: [] }
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

  /** The item on the ground within reach, the nearest if several, or null. */
  nearGround(): GroundItem | null {
    let best: GroundItem | null = null
    let bestD = ITEM_REACH
    for (const g of this.state.ground) {
      const d = Math.hypot(this.body.x - g.x, this.body.y - g.z)
      if (d < bestD) {
        bestD = d
        best = g
      }
    }
    return best
  }

  /** What an empty hand would pick up here: an item on the ground first, else what the place yields. */
  private pickable(): { item: Item; ground: GroundItem | null } | null {
    const g = this.nearGround()
    if (g) return { item: g.item, ground: g }
    const here = this.nearPlace()
    const yields = here ? YIELDS[here] : undefined
    return yields ? { item: yields, ground: null } : null
  }

  /** The acts the panel offers now: one for each hand that can pick up or put down, and the makes the hands allow, the first of them on Enter. */
  available(): Offered[] {
    const s = this.state
    if (s.act || s.phase === 'done') return []
    const out: Offered[] = []
    const pick = this.pickable()
    for (const hand of [0, 1] as Hand[]) {
      const held = s.slots[hand]
      const key = HAND_KEY[hand] as 'J' | 'K'
      if (held) out.push({ id: `putDown-${held}@${hand}`, key, label: `${capital(HAND_NAME[hand])} (${key}): put down ${the(held)}`, run: () => this.startAct({ kind: 'putDown', item: held, hand, left: PUT_DOWN_SECONDS, total: PUT_DOWN_SECONDS }) })
      else if (pick) out.push({ id: `pickUp-${pick.item}@${hand}`, key, label: `${capital(HAND_NAME[hand])} (${key}): pick up ${pick.ground ? the(pick.item) : an(pick.item)}`, run: () => this.startAct({ kind: 'pickUp', item: pick.item, hand, groundId: pick.ground?.id, left: PICK_UP_SECONDS, total: PICK_UP_SECONDS }) })
    }
    const here = this.nearPlace()
    let first = true
    if (this.canEat()) {
      out.push({ id: 'eat', key: 'Enter', label: `Enter: ${eatLabel(s.need)}`, run: () => this.startAct({ kind: 'eat', left: EAT_SECONDS, total: EAT_SECONDS }) })
      first = false
    }
    for (const what of ['diggingStick', 'probe', 'flake'] as Made[]) {
      const r = RECIPES[what]
      if (!canMake(s.hands, what)) continue
      if (r.at && here !== r.at) continue
      out.push({ id: `make-${what}`, key: 'Enter', label: `${first ? 'Enter: ' : ''}${makeLabel(what)}`, run: () => this.startAct({ kind: 'make', what, left: r.seconds, total: r.seconds }) })
      first = false
    }
    return out
  }

  /** Midday, at the need's place, holding what the need requires, nothing eaten yet: the act at the place is possible. Eating is this act, not arrival (Jon, 2026-11-11). */
  canEat(): boolean {
    const s = this.state
    if (s.phase !== 'midday' || !s.needPresent || s.ate) return false
    const spec = NEED_TABLE[s.need]
    const d = Math.hypot(this.body.x - PLACE_XZ[spec.place].x, this.body.y - PLACE_XZ[spec.place].z)
    return d < REACH && s.hands.includes(spec.takes)
  }

  /** The hand key: the act offered for that hand, if any. */
  hand(hand: Hand): boolean {
    const key = HAND_KEY[hand]
    const a = this.available().find((x) => x.key === key)
    if (a) a.run()
    return !!a
  }

  /** Enter: the act at the need's place if it is possible, else the first make offered, if any. */
  make(): boolean {
    const a = this.available().find((x) => x.key === 'Enter')
    if (a) a.run()
    return !!a
  }

  private startAct(a: ActInProgress): void {
    this.state.act = a
    this.state.message = a.kind === 'pickUp' ? `Picking up ${a.groundId ? the(a.item!) : an(a.item!)} with the ${HAND_NAME[a.hand!]}.` : a.kind === 'make' ? `Making ${an(a.what!)}.` : a.kind === 'eat' ? eatingLabel(this.state.need) : `Putting down ${the(a.item!)}.`
  }

  private sync(): void {
    this.state.hands = this.state.slots.filter((x): x is Item => x !== null)
  }

  /** Where a put-down or struck-off item lands: a step ahead of the hominin and to the side of the hand, so the follow camera sees it past the body. */
  private dropPoint(side: number): { x: number; z: number } {
    const h = this.body.heading
    const ahead = 0.9
    const aside = 0.7
    return { x: this.body.x + ahead * Math.cos(h) - side * aside * Math.sin(h), z: this.body.y + ahead * Math.sin(h) + side * aside * Math.cos(h) }
  }

  private finishAct(): void {
    const a = this.state.act
    if (!a) return
    const s = this.state
    if (a.kind === 'pickUp' && a.item && a.hand !== undefined) {
      if (s.slots[a.hand] === null) {
        s.slots[a.hand] = a.item
        if (a.groundId !== undefined) s.ground = s.ground.filter((g) => g.id !== a.groundId)
        s.log.push(`${fmt(s.clock)}: picked up ${an(a.item)} (${HAND_NAME[a.hand]})`)
      }
      this.sync()
      s.message = `You hold ${describeHands(s.hands)}.`
    } else if (a.kind === 'make' && a.what) {
      const r = RECIPES[a.what]
      if (r.consumes) {
        const i = s.slots.indexOf(r.consumes)
        if (i >= 0) s.slots[i as Hand] = r.output
        s.log.push(`${fmt(s.clock)}: made ${an(a.what)}`)
        this.sync()
        s.message = `You hold ${describeHands(s.hands)}.`
      } else {
        // A flake struck off lands on the ground beside the stone; a hand must be free to pick it up.
        const d = this.dropPoint(1)
        s.ground.push({ id: this.nextGroundId++, item: r.output, x: d.x, z: d.z })
        s.log.push(`${fmt(s.clock)}: made ${an(a.what)}; it lies on the ground`)
        s.message = `${capital(an(a.what))} lies on the ground in front of you.`
      }
    } else if (a.kind === 'eat') {
      if (s.needPresent && !s.ate) {
        s.ate = true
        s.message = 'You ate. The day is a success.'
        s.log.push(`${fmt(s.clock)}: ate; ${eatLabel(s.need).replace(/ with the .*$/, '')}`)
      }
    } else if (a.kind === 'putDown' && a.item && a.hand !== undefined) {
      if (s.slots[a.hand] === a.item) {
        s.slots[a.hand] = null
        const d = this.dropPoint(a.hand === 0 ? -1 : 1)
        s.ground.push({ id: this.nextGroundId++, item: a.item, x: d.x, z: d.z })
        s.log.push(`${fmt(s.clock)}: put down ${the(a.item)}`)
      }
      this.sync()
      s.message = `${capital(the(a.item))} lies on the ground. You hold ${describeHands(s.hands)}.`
    }
    s.act = null
  }

  /** One step of real time: the body moves if no act is under way, the clock runs at TIME_SCALE. */
  tick(dt: number, cmd: Command & { act: boolean; left?: boolean; right?: boolean }): void {
    const s = this.state
    if (s.phase === 'done') return
    const rt = dt * TIME_SCALE
    this.prev = { x: this.body.x, y: this.body.y, heading: this.body.heading }
    if (s.act) {
      s.act.left -= rt
      if (s.act.left <= 0) this.finishAct()
    } else {
      this.body.step(dt, cmd, null)
      const prints = s.needPresent ? [...this.prints, needFootprint(s.need)].filter((f): f is Footprint => f !== null) : this.prints
      const pushed = pushOutOf(this.body.x, this.body.y, this.body.loco.radius, prints)
      this.body.x = pushed.x
      this.body.y = pushed.y
      const r = Math.hypot(this.body.x, this.body.y)
      if (r > RANGE_BOUND) {
        this.body.x *= RANGE_BOUND / r
        this.body.y *= RANGE_BOUND / r
      }
      if ((cmd.act || cmd.left || cmd.right) && s.clock - this.lastAct > 0.5) {
        this.lastAct = s.clock
        const done = cmd.left ? this.hand(0) : cmd.right ? this.hand(1) : this.make()
        if (!done) s.message = cmd.act ? 'Nothing can be made or eaten here with what you hold.' : s.slots[cmd.left ? 0 : 1] ? 'That hand is busy.' : 'Nothing within reach to pick up.'
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
      if (!s.ate && !s.act && d < REACH && s.hands.includes(spec.takes) && s.message !== AT_THE_PLACE_LINE) s.message = AT_THE_PLACE_LINE
      if (s.clock >= MORNING_SECONDS + WINDOW_SECONDS) {
        s.phase = 'afternoon'
        s.needPresent = false
        if (s.act?.kind === 'eat') s.act = null
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

  /** A paused day: the body is drawn where it stands, with no step before it to slide from. */
  hold(): void {
    this.prev = { x: this.body.x, y: this.body.y, heading: this.body.heading }
  }

  /** The pose `alpha` of a step before the current one, for drawing between steps: the body then moves at one rate across frames instead of a step at a time. */
  renderPose(alpha: number): Pose {
    const a = Math.max(0, Math.min(1, alpha))
    const p = this.prev
    const q = this.body.pose
    let dh = q.heading - p.heading
    while (dh > Math.PI) dh -= 2 * Math.PI
    while (dh < -Math.PI) dh += 2 * Math.PI
    return { x: p.x + (q.x - p.x) * a, y: p.y + (q.y - p.y) * a, heading: p.heading + dh * a }
  }

  /** The range clock `alpha` of a step back, matching `renderPose`. */
  renderClock(alpha: number, dt: number): number {
    return Math.max(0, this.state.clock - dt * TIME_SCALE * (1 - Math.max(0, Math.min(1, alpha))))
  }
}

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export function makeLabel(what: Made): string {
  return what === 'flake' ? 'make a flake by striking the cobble on the outcrop’s stone' : what === 'probe' ? 'strip the sapling into a probe' : 'sharpen the sapling into a digging stick'
}

export function describeHands(hands: readonly Item[]): string {
  if (!hands.length) return 'nothing'
  return hands.map((h) => ITEM_LABEL[h]).join(' and ')
}

/** One line per hand, for the status block. */
export function handLines(slots: readonly [Item | null, Item | null]): string[] {
  return ([0, 1] as Hand[]).map((h) => `${HAND_NAME[h]} (${HAND_KEY[h]})`.padEnd(16) + (slots[h] ? ITEM_LABEL[slots[h]!] : 'nothing').padStart(16))
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
  for (const s of segments) {
    if (s.kind === 'walk') {
      if (t >= s.t0 && t < s.t1) {
        const u = (t - s.t0) / Math.max(1e-6, s.t1 - s.t0)
        const a = PLACE_XZ[s.from]
        const b = PLACE_XZ[s.to]
        return { x: a.x + (b.x - a.x) * u, z: a.z + (b.z - a.z) * u, heading: Math.atan2(b.z - a.z, b.x - a.x), moving: true, doing: `walking to ${s.to}` }
      }
      if (t >= s.t1) last = s.to
    } else if (s.kind === 'wait') {
      if (t >= s.t0) return { x: PLACE_XZ[s.place].x, z: PLACE_XZ[s.place].z, heading: 0, moving: false, doing: `waiting at ${s.place}` }
    } else if (t >= s.t0 && t < s.t1) {
      const p = PLACE_XZ[s.place]
      return { x: p.x, z: p.z, heading: 0, moving: false, doing: s.kind === 'pickUp' ? `picking up ${s.item}` : s.kind === 'make' ? `making ${s.what}` : `putting down ${s.item}` }
    }
  }
  const p = PLACE_XZ[last]
  return { x: p.x, z: p.z, heading: 0, moving: false, doing: `at ${last}` }
}

/** The items a programmed hominin has put down by a moment, lying at the place where it stood, offset by `slot` so several hominins' items do not coincide. */
export function groundAt(segments: readonly Segment[], t: number, slot: number): GroundItem[] {
  const out: GroundItem[] = []
  let n = 0
  for (const s of segments) {
    if (s.kind === 'putDown' && t >= s.t1) {
      const p = PLACE_XZ[s.place]
      const a = (slot * 1.1 + n * 0.7) % (Math.PI * 2)
      out.push({ id: slot * 100 + n, item: s.item, x: p.x + 2.2 * Math.cos(a), z: p.z + 2.2 * Math.sin(a) })
      n++
    }
  }
  return out
}

