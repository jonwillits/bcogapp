import { makeRng, type Rng } from '../random'
import { Body, RANGE_LOCOMOTION, STILL, type Command, type Pose } from './body'
import { LANDMARKS, NEAR_LANDMARKS, RANGE, SMALL_MOVE, LARGE_MOVE, impliedNest, pushOut, rotateNearLandmarks, visibleLandmarks, walkIsClear, type Light } from './range'
import { SENSE_NOISE } from './body'
import { angleDiff, wrap } from './spatial/angles'

/**
 * Part 1, The Way Home (spec §7): the homing trial runner and the four
 * programmed navigators. The student is the forager and the subject of the
 * experiment; their own homing is the data. Every trial keeps a complete
 * trip record — every step's pose and command, every beetle, every move of
 * the landmarks, the light, and the time spent in each camera view — and
 * the navigators run on that record after the student commits.
 */

export type Block = 'practice' | 'dark' | 'moonlight' | 'picture' | 'moved'
export type View = 'eye' | 'follow'
export type Phase = 'out' | 'return' | 'done'

export const BLOCKS: { id: Block; title: string; trials: number; minutes: number }[] = [
  { id: 'practice', title: 'Step 1 — Practice', trials: 2, minutes: 3 },
  { id: 'dark', title: 'Step 2 — Home in the dark', trials: 6, minutes: 6 },
  { id: 'moonlight', title: 'Step 3 — Home by moonlight', trials: 4, minutes: 4 },
  { id: 'picture', title: 'Step 4 — A picture of home', trials: 4, minutes: 5 },
  { id: 'moved', title: 'Step 5 — When the landmarks move', trials: 4, minutes: 5 },
]

export const DT = 0.02
/** A return is ended where the forager stands after this long. */
export const RETURN_CAP = 120
/** Step 4's set-down distances. */
export const PICTURE_NEAR = 3
export const PICTURE_FAR = 20

export interface Leg {
  x: number
  y: number
}

export interface TripStep {
  t: number
  x: number
  y: number
  heading: number
  forward: -1 | 0 | 1
  turn: -1 | 0 | 1
  light: Light
  phase: Phase
}

export interface TrialPlan {
  block: Block
  index: number
  /** Beetles, in order, for a trip out. Empty in the picture block. */
  legs: Leg[]
  /** Picture block: where the forager is set down, and facing where. */
  setDown?: Pose
  /** Moved block: how far the near landmarks are rotated about the last beetle, radians; 0 on an unmoved trial. */
  move: number
  lightOut: Light
  lightBack: Light
  treeHidden: boolean
}

export interface TrialRecord {
  plan: TrialPlan
  steps: TripStep[]
  /** When each beetle was taken, seconds. */
  beetlesAt: number[]
  /** Seconds in each view. */
  viewSeconds: { eye: number; follow: number }
  endpoint: { x: number; y: number } | null
  /** Distance from the endpoint to the true nest, meters. */
  error: number | null
  /** Moved block: 0 at the true nest, 1 at where the moved landmarks point. */
  conflictScore: number | null
  timedOut: boolean
  /** Length of the outward path, meters. */
  outwardLength: number
}

export type NavigatorId = 'runningSum' | 'landmarks' | 'averaging' | 'followingOne'

export const NAVIGATORS: { id: NavigatorId; label: string; line: string }[] = [
  { id: 'runningSum', label: 'Running sum only', line: 'Path integration with seeded noise in turn and step, and no landmarks: it walks the home vector its running sum gives.' },
  { id: 'landmarks', label: 'Landmarks only', line: 'Heads for where the landmarks say the nest is. In the dark, it has nothing to go on and stops where it is.' },
  { id: 'averaging', label: 'Averaging', line: 'Weights its running sum and the landmarks by how reliable each is: cue combination.' },
  { id: 'followingOne', label: 'Following one', line: 'Averages when the two disagree by a little, and follows the landmarks alone when they disagree by a lot.' },
]

export interface NavigatorResult {
  id: NavigatorId
  endpoint: { x: number; y: number }
  error: number
  /** Distance from the student's endpoint. */
  fromStudent: number | null
  conflictScore: number | null
}

/** The navigators' running-sum noise, set so that its error grows with path length (§7.6). */
export const NAVIGATOR_NOISE = {
  /** Heading noise per step, radians per second, white. */
  turn: 0.12,
  /** A small steady miscalibration of the turn signal. */
  turnGain: 1.01,
  /** Step noise as a share of speed. */
  stepShare: 0.06,
  /** The uncertainty a running sum carries per meter run, m². */
  variancePerMeter: 0.02,
  /** A landmark fix's variance, m². */
  landmarkVariance: 0.4 * 0.4,
  /**
   * Following one: averages when the two sources put the nest within this
   * distance of each other, meters, and follows the landmarks alone beyond
   * it. The small move (15°) puts them about 2 m apart from where Step 5's
   * trips end, the large move (60°) about 7 m.
   */
  conflictDistance: 3.5,
} as const

/** Plan every trial of a block from the seed. */
export function planBlock(block: Block, seed: number): TrialPlan[] {
  const rng = makeRng(seed ^ 0x9e3779b9)
  const spec = BLOCKS.find((b) => b.id === block)!
  const plans: TrialPlan[] = []
  if (block === 'picture') {
    const dists = [PICTURE_NEAR, PICTURE_FAR, PICTURE_NEAR, PICTURE_FAR]
    for (let i = 0; i < spec.trials; i++) {
      const a = rng.range(0, 2 * Math.PI)
      plans.push({ block, index: i, legs: [], setDown: { x: dists[i] * Math.cos(a), y: dists[i] * Math.sin(a), heading: rng.range(-Math.PI, Math.PI) }, move: 0, lightOut: 'moonlight', lightBack: 'moonlight', treeHidden: false })
    }
    return plans
  }
  if (block === 'moved') {
    const moves = [SMALL_MOVE, SMALL_MOVE, LARGE_MOVE, LARGE_MOVE].map((m) => (rng.next() < 0.5 ? -m : m))
    // In an order set by the seed.
    for (let i = moves.length - 1; i > 0; i--) {
      const j = rng.int(i + 1)
      ;[moves[i], moves[j]] = [moves[j], moves[i]]
    }
    for (let i = 0; i < spec.trials; i++) {
      // Short trips, so the near landmarks are in view at the last beetle.
      plans.push({ block, index: i, legs: legsFor(rng, 2 + rng.int(2), 3, 3.6), move: moves[i], lightOut: 'moonlight', lightBack: 'moonlight', treeHidden: true })
    }
    return plans
  }
  const legCounts = block === 'practice' ? [1, 1] : block === 'dark' ? [2, 3, 4, 2, 3, 4] : [3, 3, 3, 3]
  for (let i = 0; i < spec.trials; i++) {
    plans.push({
      block,
      index: i,
      legs: legsFor(rng, legCounts[i], 4.5, 7.5),
      move: 0,
      lightOut: 'moonlight',
      lightBack: block === 'dark' ? 'dark' : 'moonlight',
      treeHidden: false,
    })
  }
  return plans
}

/** A beetle, and the straight walk to it from the last, stay this far beyond any near landmark's footprint, so no landmark hides a beetle (Jon's walk, 2026-10-19). */
export const BEETLE_CLEARANCE = 1.0

/** Beetles each a few meters from the last, with a minimum angle between legs so no trip is a straight line, and each in the clear of the landmarks. */
function legsFor(rng: Rng, n: number, minLen: number, maxLen: number): Leg[] {
  const legs: Leg[] = []
  let x = 0
  let y = 0
  let heading = rng.range(0, 2 * Math.PI)
  for (let i = 0; i < n; i++) {
    let nx = x
    let ny = y
    let h = heading
    // Draw legs until the walk is clear of the landmarks; after many tries take the last.
    for (let tries = 0; tries < 40; tries++) {
      h = heading
      if (i > 0) {
        const turn = (rng.next() < 0.5 ? 1 : -1) * rng.range(Math.PI / 4, (3 * Math.PI) / 4)
        h = wrap(heading + turn)
      } else if (tries > 0) h = rng.range(0, 2 * Math.PI)
      const len = rng.range(minLen, maxLen)
      nx = x + len * Math.cos(h)
      ny = y + len * Math.sin(h)
      // Keep well inside the range.
      const r = Math.hypot(nx, ny)
      if (r > RANGE.radius - 6) {
        nx *= (RANGE.radius - 6) / r
        ny *= (RANGE.radius - 6) / r
      }
      if (walkIsClear(x, y, nx, ny, BEETLE_CLEARANCE)) break
    }
    x = nx
    y = ny
    heading = h
    legs.push({ x, y })
  }
  return legs
}

/** One trial, driven by the student. */
export class HomingTrial {
  readonly plan: TrialPlan
  readonly body: Body
  phase: Phase
  light: Light
  beetle = 0
  time = 0
  /** Seconds into the return. */
  returnTime = 0
  /** The near landmarks' positions once moved (Step 5), else null. */
  moved: Map<string, { x: number; y: number }> | null = null
  /** A startle: the screen is dark for these seconds at the last beetle (Step 5). */
  blackout = 0
  readonly record: TrialRecord
  private view: View = 'eye'

  constructor(plan: TrialPlan, seed: number) {
    this.plan = plan
    const rng = makeRng(seed ^ (plan.index + 1) * 7919)
    const start: Pose = plan.setDown ?? { x: 0, y: 0, heading: rng.range(-Math.PI, Math.PI) }
    this.body = new Body(rng.fork(), RANGE_LOCOMOTION, start)
    this.phase = plan.legs.length ? 'out' : 'return'
    this.light = plan.lightOut
    this.record = { plan, steps: [], beetlesAt: [], viewSeconds: { eye: 0, follow: 0 }, endpoint: null, error: null, conflictScore: null, timedOut: false, outwardLength: 0 }
  }

  /** Which view the student is in; the trial only counts the time. The view changes nothing below this line. */
  setView(v: View): void {
    this.view = v
  }

  get currentBeetle(): Leg | null {
    return this.phase === 'out' ? this.plan.legs[this.beetle] : null
  }

  get done(): boolean {
    return this.phase === 'done'
  }

  /** The landmarks the forager can see now. */
  visible() {
    return visibleLandmarks(this.body.x, this.body.y, this.blackout > 0 ? 'dark' : this.light, this.plan.treeHidden, this.moved ?? undefined)
  }

  step(dt: number, cmd: Command): void {
    if (this.phase === 'done') return
    this.time += dt
    this.record.viewSeconds[this.view] += dt
    if (this.blackout > 0) {
      this.blackout -= dt
      cmd = STILL
    }
    const before = { x: this.body.x, y: this.body.y }
    this.body.step(dt, cmd, null)
    // Stopped by the landmarks, where they stand now.
    const clear = pushOut(this.body.x, this.body.y, this.body.loco.radius, this.moved)
    this.body.x = clear.x
    this.body.y = clear.y
    // Kept within the range.
    const r = Math.hypot(this.body.x, this.body.y)
    if (r > RANGE.radius) {
      this.body.x *= RANGE.radius / r
      this.body.y *= RANGE.radius / r
    }
    if (this.phase === 'out') this.record.outwardLength += Math.hypot(this.body.x - before.x, this.body.y - before.y)
    this.record.steps.push({ t: this.time, x: this.body.x, y: this.body.y, heading: this.body.heading, forward: cmd.forward, turn: cmd.turn, light: this.light, phase: this.phase })
    if (this.phase === 'out') {
      const b = this.plan.legs[this.beetle]
      if (Math.hypot(b.x - this.body.x, b.y - this.body.y) <= RANGE.beetleReach) {
        this.record.beetlesAt.push(this.time)
        this.beetle++
        if (this.beetle >= this.plan.legs.length) this.startReturn()
      }
    } else {
      this.returnTime += dt
      if (this.returnTime >= RETURN_CAP) this.finish(true)
    }
  }

  private startReturn(): void {
    this.phase = 'return'
    this.light = this.plan.lightBack
    if (this.plan.block === 'moved') {
      this.blackout = 2
      if (this.plan.move !== 0) {
        const last = this.plan.legs[this.plan.legs.length - 1]
        this.moved = rotateNearLandmarks(last, this.plan.move)
      }
    }
  }

  /** The student presses *Here is my nest*. */
  here(): void {
    if (this.phase !== 'return') return
    this.finish(false)
  }

  private finish(timedOut: boolean): void {
    this.phase = 'done'
    const e = { x: this.body.x, y: this.body.y }
    this.record.endpoint = e
    this.record.timedOut = timedOut
    this.record.error = Math.hypot(e.x - RANGE.nest.x, e.y - RANGE.nest.y)
    this.record.conflictScore = this.plan.block === 'moved' && this.plan.move !== 0 ? conflictScore(e, this.plan) : null
  }
}

/** 0 at the true nest, 1 at where the moved landmarks point: the endpoint's projection onto the line between them. */
export function conflictScore(e: { x: number; y: number }, plan: TrialPlan): number {
  const last = plan.legs[plan.legs.length - 1]
  const implied = impliedNest(last, plan.move)
  const vx = implied.x - RANGE.nest.x
  const vy = implied.y - RANGE.nest.y
  const L2 = vx * vx + vy * vy
  if (L2 < 1e-9) return 0
  return ((e.x - RANGE.nest.x) * vx + (e.y - RANGE.nest.y) * vy) / L2
}

/**
 * The four navigators, run on a trial's record. Each takes the recorded
 * outward trip — the same beetles, the same moves of the landmarks — and
 * returns where it ends. They are programs given the same trips, not models
 * of the student (§11, line 12).
 */
export function runNavigators(record: TrialRecord, seed: number): NavigatorResult[] {
  const plan = record.plan
  const rng = makeRng((seed ^ 0x51ed27) + plan.index * 104729)
  const out = record.steps.filter((s) => s.phase === 'out')
  const last = out.length ? out[out.length - 1] : (plan.setDown ? { x: plan.setDown.x, y: plan.setDown.y, heading: plan.setDown.heading } : { x: 0, y: 0, heading: 0 })
  const lightBack = plan.lightBack
  const moved = plan.block === 'moved' && plan.move !== 0 ? rotateNearLandmarks(plan.legs[plan.legs.length - 1], plan.move) : undefined
  const results: NavigatorResult[] = []
  for (const nav of NAVIGATORS) {
    const e = navigate(nav.id, out, last, lightBack, plan.treeHidden, moved, rng.fork(), plan.block === 'picture')
    results.push({
      id: nav.id,
      endpoint: e,
      error: Math.hypot(e.x - RANGE.nest.x, e.y - RANGE.nest.y),
      fromStudent: record.endpoint ? Math.hypot(e.x - record.endpoint.x, e.y - record.endpoint.y) : null,
      conflictScore: plan.block === 'moved' && plan.move !== 0 ? conflictScore(e, plan) : null,
    })
  }
  return results
}

/** The position the landmarks in view say the forager is at: exact up to the landmarks' own move, with a little noise. */
function landmarkFix(x: number, y: number, light: Light, treeHidden: boolean, moved: Map<string, { x: number; y: number }> | undefined, rng: Rng): { x: number; y: number } | null {
  const seen = visibleLandmarks(x, y, light, treeHidden, moved).filter((l) => !l.distant)
  if (!seen.length) return null
  // Each near landmark is known at its unmoved place; the fix is where the configuration seen puts the forager.
  let fx = 0
  let fy = 0
  for (const l of seen) {
    const home = NEAR_LANDMARKS.find((n) => n.id === l.id)!
    fx += home.x + (x - l.x)
    fy += home.y + (y - l.y)
  }
  fx /= seen.length
  fy /= seen.length
  return { x: fx + 0.4 * rng.normal(), y: fy + 0.4 * rng.normal() }
}

function navigate(
  id: NavigatorId,
  out: TripStep[],
  last: { x: number; y: number; heading: number },
  light: Light,
  treeHidden: boolean,
  moved: Map<string, { x: number; y: number }> | undefined,
  rng: Rng,
  carried: boolean,
): { x: number; y: number } {
  const n = NAVIGATOR_NOISE
  // 1. The running sum over the outward trip, with its own seeded noise.
  let ex = 0
  let ey = 0
  let eh = out.length ? out[0].heading : last.heading
  let variance = 0.05
  let prevHeading = eh
  for (let i = 1; i < out.length; i++) {
    const s = out[i]
    const dt = s.t - out[i - 1].t
    const turn = angleDiff(prevHeading, s.heading) / dt
    prevHeading = s.heading
    eh += (turn * n.turnGain + n.turn * rng.normal()) * dt
    const d = Math.hypot(s.x - out[i - 1].x, s.y - out[i - 1].y)
    const step = d * (1 + n.stepShare * rng.normal())
    ex += step * Math.cos(eh)
    ey += step * Math.sin(eh)
    variance += n.variancePerMeter * d
  }
  // Being carried registers as no movement: the sum stays at the nest.
  if (carried) {
    ex = 0
    ey = 0
    eh = last.heading
    variance = 0.05
  }
  // The true position now, and the estimate of it.
  const pos = { x: last.x, y: last.y }
  const est = { x: ex, y: ey }
  if (id === 'runningSum') return walkHome(pos, est, eh, variance, light, treeHidden, moved, rng, 'none')
  if (id === 'landmarks') {
    const fix = landmarkFix(pos.x, pos.y, light, treeHidden, moved, rng)
    if (!fix) return pos
    // Straight to where the landmarks say the nest is: the move from the fix to the nest, applied to where it stands.
    return { x: pos.x - fix.x + RANGE.nest.x, y: pos.y - fix.y + RANGE.nest.y }
  }
  return walkHome(pos, est, eh, variance, light, treeHidden, moved, rng, id === 'averaging' ? 'average' : 'followOne')
}

/**
 * Walk the home vector from the estimate, step by step with the running
 * sum's noise, correcting by the landmarks in view as the procedure says,
 * until the estimate says home. Returns where the walker stands then. The
 * walker steers by its sensed heading, which drifts from the true one by
 * the turn noise, so its error on the way back grows as it did on the way
 * out. The running sum is kept apart from the combined estimate: a
 * landmark seen for ten seconds is one source, not a hundred, so each step
 * combines the sum as it stands with the fix as it stands, by their
 * reliabilities (cue combination, §9.2.3).
 */
function walkHome(
  pos: { x: number; y: number },
  sum: { x: number; y: number },
  sensedHeading: number,
  variance: number,
  light: Light,
  treeHidden: boolean,
  moved: Map<string, { x: number; y: number }> | undefined,
  rng: Rng,
  mode: 'none' | 'average' | 'followOne',
): { x: number; y: number } {
  const n = NAVIGATOR_NOISE
  const speed = RANGE_LOCOMOTION.speed
  const dt = 0.1
  let heading = sensedHeading
  let eh = sensedHeading
  let followingLandmarks = false
  const est = { x: sum.x, y: sum.y }
  for (let t = 0; t < RETURN_CAP; t += dt) {
    est.x = sum.x
    est.y = sum.y
    if (mode !== 'none') {
      const fix = landmarkFix(pos.x, pos.y, light, treeHidden, moved, rng)
      if (fix) {
        // How far apart the two sources put the nest: the gap between where each says the walker is.
        const disagree = Math.hypot(sum.x - fix.x, sum.y - fix.y)
        if (mode === 'followOne' && disagree > n.conflictDistance) followingLandmarks = true
        if (mode === 'followOne' && followingLandmarks) {
          est.x = fix.x
          est.y = fix.y
        } else {
          const k = variance / (variance + n.landmarkVariance)
          est.x = sum.x + k * (fix.x - sum.x)
          est.y = sum.y + k * (fix.y - sum.y)
        }
      }
    }
    if (Math.hypot(est.x, est.y) < 0.4) break
    const want = Math.atan2(-est.y, -est.x)
    const turn = Math.max(-RANGE_LOCOMOTION.turnRate, Math.min(RANGE_LOCOMOTION.turnRate, angleDiff(eh, want) / dt))
    heading = wrap(heading + turn * dt)
    eh = wrap(eh + (turn * n.turnGain + n.turn * rng.normal()) * dt)
    const stepLen = speed * dt
    pos.x += stepLen * Math.cos(heading)
    pos.y += stepLen * Math.sin(heading)
    const sensedStep = stepLen * (1 + n.stepShare * rng.normal())
    sum.x += sensedStep * Math.cos(eh)
    sum.y += sensedStep * Math.sin(eh)
    variance += n.variancePerMeter * stepLen
  }
  return { x: pos.x, y: pos.y }
}

export { LANDMARKS, SENSE_NOISE }
