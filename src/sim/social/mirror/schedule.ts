import { makeRng, type Rng } from '../../random'
import { CELLS, GRASPS, acrossView, ownView, type Grasp, MirrorCells } from './cells'

/**
 * The steps of Part 6 (spec §10.3) as a timeline the scene plays and the
 * tests run headless. Every grasp is an event with a start, a kind and
 * whose hand it is; at each step the four visual inputs are set from the
 * grasps in progress (own hand seen on `ownViewShare` of the student's
 * grasps, drawn when the grasp begins; the other macaque's hand always
 * seen), the student's motor drive from its grasp in progress, and the
 * cells step.
 *
 * The other macaque's schedule: *copy* (the student's grasp, a moment
 * later), *random* (as often, independent of the student, either kind), or
 * *opposite* (the other grasp, a moment later).
 */

export type PartnerMode = 'none' | 'copy' | 'random' | 'opposite'

export interface GraspEvent {
  start: number
  grasp: Grasp
  who: 'you' | 'other'
  /** Student's grasps only: whether the macaque sees its own hand this time. */
  ownSeen: boolean
}

export const DT = 0.02
/** Rest between a student's grasps in a run of 40, seconds. */
export const REST_S = 1.2
export const GRASPS_PER_STEP = 40
/** The test: 10 of each kind by the other macaque, in a seeded order, each followed by a rest. */
export const TEST_EACH = 10

export interface Timeline {
  events: GraspEvent[]
  /** Seconds the timeline runs for. */
  duration: number
}

const other = (g: Grasp): Grasp => (g === 'precision' ? 'wholeHand' : 'precision')

/** A run of n student grasps, half of each kind in a seeded order (as "Run 40 grasps" plays them), with the other macaque on its schedule. */
export function runOf(n: number, mode: PartnerMode, rng: Rng): Timeline {
  const events: GraspEvent[] = []
  let t = 0.5
  const period = CELLS.graspSeconds + REST_S
  const kinds: Grasp[] = Array.from({ length: n }, (_, i) => GRASPS[i % 2])
  for (let i = kinds.length - 1; i > 0; i--) {
    const j = rng.int(i + 1)
    ;[kinds[i], kinds[j]] = [kinds[j], kinds[i]]
  }
  for (let i = 0; i < n; i++) {
    const grasp: Grasp = kinds[i]
    events.push({ start: t, grasp, who: 'you', ownSeen: rng.next() < CELLS.ownViewShare })
    if (mode === 'copy') events.push({ start: t + CELLS.copyLatency, grasp, who: 'other', ownSeen: false })
    if (mode === 'opposite') events.push({ start: t + CELLS.copyLatency, grasp: other(grasp), who: 'other', ownSeen: false })
    t += period
  }
  if (mode === 'random') {
    // As often as the student, but independent: n grasps at random times in the same span, either kind.
    const span = t
    for (let i = 0; i < n; i++) events.push({ start: rng.range(0.5, span - CELLS.graspSeconds), grasp: GRASPS[rng.int(2)], who: 'other', ownSeen: false })
  }
  events.sort((a, b) => a.start - b.start)
  return { events, duration: t + CELLS.graspSeconds }
}

/** The test: the student does nothing; the other macaque performs 10 of each kind in a seeded order. */
export function testTimeline(rng: Rng): Timeline {
  const kinds: Grasp[] = [...Array<Grasp>(TEST_EACH).fill('precision'), ...Array<Grasp>(TEST_EACH).fill('wholeHand')]
  for (let i = kinds.length - 1; i > 0; i--) {
    const j = rng.int(i + 1)
    ;[kinds[i], kinds[j]] = [kinds[j], kinds[i]]
  }
  const events: GraspEvent[] = kinds.map((grasp, i) => ({ start: 0.5 + i * (CELLS.graspSeconds + 0.8), grasp, who: 'other', ownSeen: false }))
  return { events, duration: 0.5 + kinds.length * (CELLS.graspSeconds + 0.8) }
}

/** The inputs at time t: the four visual inputs and the student's grasp in progress. */
export function inputsAt(timeline: Timeline, t: number): { x: number[]; performing: Grasp | null } {
  const x = [0, 0, 0, 0]
  let performing: Grasp | null = null
  for (const e of timeline.events) {
    if (t < e.start || t >= e.start + CELLS.graspSeconds) continue
    if (e.who === 'you') {
      performing = e.grasp
      if (e.ownSeen) x[ownView(e.grasp)] = 1
    } else x[acrossView(e.grasp)] = 1
  }
  return { x, performing }
}

/** Play a timeline through the cells headless, learning on. */
export function play(cells: MirrorCells, timeline: Timeline, learn = true): void {
  for (let t = 0; t < timeline.duration; t += DT) {
    const { x, performing } = inputsAt(timeline, t)
    cells.step(DT, x, performing, learn)
  }
}

export interface TestResult {
  /** Mean firing of each cell during the other macaque's grasps of each kind, seen from across the table. */
  precisionCell: { toPrecision: number; toWholeHand: number }
  wholeHandCell: { toPrecision: number; toWholeHand: number }
}

/** Run the test with learning off: the cells' mean firing to each kind seen from across. */
export function runTest(cells: MirrorCells, seed: number): TestResult {
  const timeline = testTimeline(makeRng(seed))
  const sums = { precision: { precision: 0, wholeHand: 0 }, wholeHand: { precision: 0, wholeHand: 0 } }
  const counts = { precision: 0, wholeHand: 0 }
  for (let t = 0; t < timeline.duration; t += DT) {
    const { x, performing } = inputsAt(timeline, t)
    cells.step(DT, x, performing, false)
    const seen = x[2] ? 'precision' : x[3] ? 'wholeHand' : null
    if (!seen) continue
    sums.precision[seen] += cells.precision.firing
    sums.wholeHand[seen] += cells.wholeHand.firing
    counts[seen]++
  }
  return {
    precisionCell: { toPrecision: sums.precision.precision / counts.precision, toWholeHand: sums.precision.wholeHand / counts.wholeHand },
    wholeHandCell: { toPrecision: sums.wholeHand.precision / counts.precision, toWholeHand: sums.wholeHand.wholeHand / counts.wholeHand },
  }
}

/** The resting output of a cell with no input, for reading the test. */
export function restingFiring(): number {
  const c = new MirrorCells()
  return c.precision.output([0, 0, 0, 0], 0)
}

export type Step = 1 | 2 | 3 | 4

/** The four steps run headless from a seed: each step's test result, in order. Step 3 resets the cells; Step 4 starts from the end of Step 2. */
export function runSteps(seed: number, grasps = GRASPS_PER_STEP): Record<Step, TestResult> & { afterStep2: MirrorCells } {
  const rng = makeRng(seed)
  const cells = new MirrorCells()
  play(cells, runOf(6, 'none', rng))
  const r1 = runTest(cells, seed + 1)
  play(cells, runOf(grasps, 'copy', rng))
  const r2 = runTest(cells, seed + 2)
  const afterStep2 = new MirrorCells()
  afterStep2.copyFrom(cells)
  cells.reset()
  play(cells, runOf(grasps, 'random', rng))
  const r3 = runTest(cells, seed + 3)
  play(afterStep2, runOf(grasps, 'opposite', rng))
  const r4 = runTest(afterStep2, seed + 4)
  return { 1: r1, 2: r2, 3: r3, 4: r4, afterStep2 }
}
