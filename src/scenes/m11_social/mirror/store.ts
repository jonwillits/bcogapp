import { makeRng, type Rng } from '../../../sim/random'
import type { ProgressStore } from '../../../sim/social/progress/store'
import { CELLS, GRASPS, MirrorCells, acrossView, ownView, type Grasp } from '../../../sim/social/mirror/cells'
import { GRASPS_PER_STEP, REST_S, TEST_EACH, type GraspEvent, type PartnerMode, type TestResult } from '../../../sim/social/mirror/schedule'
import type { PartStore } from '../contract'
import { STEPS, stepSpec, type Step, type StepSpec } from './steps'

/**
 * Part 6's state (spec §10): the live scene on the frame loop. Grasp
 * events come from the keys or from "Run 40 grasps", the other macaque's
 * from the step's schedule, and at every step of the loop the four visual
 * inputs and the motor drive are set from the grasps in progress and the
 * cells step (the same arithmetic as the headless `schedule.ts`). A test
 * runs with learning off and reports each cell's mean firing to each kind
 * seen from across. Every step asks its prediction before it runs.
 */

export type StepState = 'intro' | 'predict' | 'running' | 'done'
export const TRACE_SECONDS = 30
export const TRACE_HZ = 20
export const STEP_MODE: Record<Step, PartnerMode> = { 1: 'none', 2: 'copy', 3: 'random', 4: 'opposite' }

export interface TraceSample {
  precision: number
  wholeHand: number
}

export interface Mark {
  t: number
  who: 'you' | 'other'
  grasp: Grasp
}

export class MirrorStore implements PartStore {
  readonly seed: number
  readonly progress: ProgressStore
  step: Step = 1
  state: StepState = 'intro'
  readonly done: Step[] = []
  readonly drafts: Record<string, string> = {}
  version = 0
  cells = new MirrorCells()
  /** The cells as Step 2 left them, for Step 4. */
  afterStep2: MirrorCells | null = null
  time = 0
  events: GraspEvent[] = []
  /** The student's grasps still to perform automatically, as start times. */
  private auto: { start: number; grasp: Grasp }[] = []
  /** The random partner's next grasp time. */
  private nextRandom = Infinity
  graspsThisStep = 0
  testing: { until: number; sums: Record<Grasp, { p: number; w: number; n: number }> } | null = null
  testResults: Partial<Record<Step, TestResult>> = {}
  readonly trace: TraceSample[] = []
  readonly marks: Mark[] = []
  sideView = false
  private sinceSample = 0
  private readonly rng: Rng
  private listeners = new Set<() => void>()

  constructor(seed: number, progress: ProgressStore) {
    this.seed = seed
    this.progress = progress
    this.rng = makeRng(seed ^ 0x6e1)
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  changed(): void {
    this.version++
    for (const fn of this.listeners) fn()
  }

  get spec(): StepSpec {
    return stepSpec(this.step)
  }

  get mode(): PartnerMode {
    return this.state === 'running' || this.state === 'done' ? STEP_MODE[this.step] : 'none'
  }

  // --------------------------------------------------------------- steps

  open(s: Step): void {
    if (this.step === 2 && s !== 2 && !this.afterStep2) this.snapshotStep2()
    this.step = s
    this.state = this.done.includes(s) ? 'done' : 'intro'
    this.auto = []
    this.testing = null
    this.graspsThisStep = 0
    this.nextRandom = Infinity
    if (s === 4) this.startStep4()
    this.changed()
  }

  private snapshotStep2(): void {
    this.afterStep2 = new MirrorCells()
    this.afterStep2.copyFrom(this.cells)
  }

  /** Step 4 starts from the end of Step 2 (§10.3). */
  private startStep4(): void {
    if (this.afterStep2) this.cells.copyFrom(this.afterStep2)
  }

  begin(): void {
    if (this.state !== 'intro') return
    this.state = this.allCommitted(this.step) ? 'running' : 'predict'
    if (this.state === 'running') this.onRunning()
    this.changed()
  }

  private onRunning(): void {
    if (this.step === 3) this.nextRandom = this.time + this.rng.range(0.5, 2.5)
  }

  redo(): void {
    const i = this.done.indexOf(this.step)
    if (i >= 0) this.done.splice(i, 1)
    this.state = 'intro'
    this.auto = []
    this.testing = null
    this.graspsThisStep = 0
    this.changed()
  }

  finish(): void {
    if (this.state !== 'running') return
    if (this.step === 2) this.snapshotStep2()
    if (!this.done.includes(this.step)) this.done.push(this.step)
    this.state = 'done'
    this.changed()
  }

  allCommitted(s: Step): boolean {
    return STEPS[s - 1].predictions.every((p) => this.progress.prediction(p.key) !== null)
  }

  choose(key: string, value: string): void {
    this.drafts[key] = value
    this.changed()
  }

  canCommit(): boolean {
    return this.spec.predictions.every((p) => this.drafts[p.key] || this.progress.prediction(p.key))
  }

  commitPredictions(): void {
    if (this.state !== 'predict' || !this.canCommit()) return
    for (const p of this.spec.predictions) if (this.drafts[p.key]) this.progress.commitPrediction(p.key, this.drafts[p.key])
    this.state = 'running'
    this.onRunning()
    this.changed()
  }

  prediction(key: string): string | null {
    return this.progress.prediction(key)
  }

  setSideView(v: boolean): void {
    this.sideView = v
    this.changed()
  }

  // --------------------------------------------------------------- grasps

  get active(): boolean {
    return this.state === 'running' || this.state === 'done'
  }

  /** The student's grasp in progress, if any. */
  get yourGrasp(): GraspEvent | null {
    return this.events.find((e) => e.who === 'you' && this.time >= e.start && this.time < e.start + CELLS.graspSeconds) ?? null
  }

  get otherGrasp(): GraspEvent | null {
    return this.events.find((e) => e.who === 'other' && this.time >= e.start && this.time < e.start + CELLS.graspSeconds) ?? null
  }

  /** The student performs a grasp now, unless one is in progress or a test is running. */
  grasp(kind: Grasp): boolean {
    if (!this.active || this.testing || this.yourGrasp) return false
    this.performGrasp(kind, this.time)
    return true
  }

  private performGrasp(kind: Grasp, t: number): void {
    this.events.push({ start: t, grasp: kind, who: 'you', ownSeen: this.rng.next() < CELLS.ownViewShare })
    this.marks.push({ t, who: 'you', grasp: kind })
    this.graspsThisStep++
    const mode = this.mode
    if (mode === 'copy') this.otherGrasps(kind, t + CELLS.copyLatency)
    if (mode === 'opposite') this.otherGrasps(kind === 'precision' ? 'wholeHand' : 'precision', t + CELLS.copyLatency)
  }

  private otherGrasps(kind: Grasp, t: number): void {
    this.events.push({ start: t, grasp: kind, who: 'other', ownSeen: false })
    this.marks.push({ t, who: 'other', grasp: kind })
  }

  /** Run 40 grasps: 20 of each kind in a seeded order, one every period. */
  runForty(): void {
    if (!this.active || this.testing) return
    const kinds: Grasp[] = Array.from({ length: GRASPS_PER_STEP }, (_, i) => GRASPS[i % 2])
    for (let i = kinds.length - 1; i > 0; i--) {
      const j = this.rng.int(i + 1)
      ;[kinds[i], kinds[j]] = [kinds[j], kinds[i]]
    }
    const period = CELLS.graspSeconds + REST_S
    const t0 = this.yourGrasp ? this.yourGrasp.start + period : this.time + 0.3
    this.auto = kinds.map((grasp, i) => ({ start: t0 + i * period, grasp }))
    this.changed()
  }

  get autoLeft(): number {
    return this.auto.length
  }

  resetCells(): void {
    this.cells.reset()
    this.changed()
  }

  /** The test: the student does nothing; the other macaque performs 10 of each kind in a seeded order; learning off. */
  runTest(): void {
    if (!this.active || this.testing) return
    this.auto = []
    const kinds: Grasp[] = [...Array<Grasp>(TEST_EACH).fill('precision'), ...Array<Grasp>(TEST_EACH).fill('wholeHand')]
    const rng = makeRng(this.seed + this.step * 101)
    for (let i = kinds.length - 1; i > 0; i--) {
      const j = rng.int(i + 1)
      ;[kinds[i], kinds[j]] = [kinds[j], kinds[i]]
    }
    const gap = CELLS.graspSeconds + 0.8
    const t0 = this.time + 0.8
    kinds.forEach((grasp, i) => this.otherGrasps(grasp, t0 + i * gap))
    this.testing = { until: t0 + kinds.length * gap, sums: { precision: { p: 0, w: 0, n: 0 }, wholeHand: { p: 0, w: 0, n: 0 } } }
    this.changed()
  }

  get testSecondsLeft(): number {
    return this.testing ? Math.max(0, this.testing.until - this.time) : 0
  }

  // --------------------------------------------------------------- the loop

  tick(dt: number): void {
    if (!this.active) return
    this.time += dt
    // The automatic grasps and the random partner.
    while (this.auto.length && this.auto[0].start <= this.time) {
      const g = this.auto.shift()!
      if (!this.yourGrasp) this.performGrasp(g.grasp, this.time)
    }
    if (this.mode === 'random' && !this.testing && this.time >= this.nextRandom) {
      this.otherGrasps(GRASPS[this.rng.int(2)], this.time)
      this.nextRandom = this.time + CELLS.graspSeconds + REST_S + this.rng.range(-0.8, 0.8)
    }
    // The inputs from the grasps in progress.
    const x = [0, 0, 0, 0]
    let performing: Grasp | null = null
    for (const e of this.events) {
      if (this.time < e.start || this.time >= e.start + CELLS.graspSeconds) continue
      if (e.who === 'you') {
        performing = e.grasp
        if (e.ownSeen) x[ownView(e.grasp)] = 1
      } else x[acrossView(e.grasp)] = 1
    }
    this.cells.step(dt, x, performing, !this.testing)
    if (this.testing) {
      const seen: Grasp | null = x[2] ? 'precision' : x[3] ? 'wholeHand' : null
      if (seen) {
        const s = this.testing.sums[seen]
        s.p += this.cells.precision.firing
        s.w += this.cells.wholeHand.firing
        s.n++
      }
      if (this.time >= this.testing.until) {
        const r = this.testing.sums
        this.testResults[this.step] = {
          precisionCell: { toPrecision: r.precision.p / Math.max(1, r.precision.n), toWholeHand: r.wholeHand.p / Math.max(1, r.wholeHand.n) },
          wholeHandCell: { toPrecision: r.precision.w / Math.max(1, r.precision.n), toWholeHand: r.wholeHand.w / Math.max(1, r.wholeHand.n) },
        }
        this.testing = null
      }
    }
    // The traces, sampled at TRACE_HZ for the last TRACE_SECONDS.
    this.sinceSample += dt
    if (this.sinceSample >= 1 / TRACE_HZ) {
      this.sinceSample = 0
      this.trace.push({ precision: this.cells.precision.firing, wholeHand: this.cells.wholeHand.firing })
      if (this.trace.length > TRACE_SECONDS * TRACE_HZ) this.trace.splice(0, this.trace.length - TRACE_SECONDS * TRACE_HZ)
    }
    // Events and marks older than the trace are dropped.
    const horizon = this.time - TRACE_SECONDS - 5
    if (this.events.length && this.events[0].start < horizon) this.events = this.events.filter((e) => e.start >= horizon)
    if (this.marks.length && this.marks[0].t < horizon) this.marks.splice(0, this.marks.findIndex((m) => m.t >= horizon))
  }

  clock(): number {
    return this.time
  }
}
