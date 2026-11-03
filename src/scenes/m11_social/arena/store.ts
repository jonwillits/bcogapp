import type { ProgressStore } from '../../../sim/social/progress/store'
import { ANIMAL_IDS, ANIMALS, lettersFor, runTest, type AnimalId, type RunResult, type Trial } from '../../../sim/social/arena/animals'
import { trainLearner, type Experience } from '../../../sim/social/arena/experience'

const EXPERIENCE_ORDER: Experience[] = ['usual', 'many']
const EXPERIENCE_SHORT: Record<Experience, string> = { usual: 'usual', many: 'many' }
import type { ContestLearner } from '../../../sim/social/arena/learner'
import { animalsByTests, type Matrix } from '../../../sim/social/arena/matrix'
import { TESTS, testById, type TestSpec } from '../../../sim/social/arena/trial'
import type { PartStore } from '../contract'
import { STEPS, stepSpec, type Step, type StepSpec } from './steps'

/**
 * Part 4's state (spec §8): three steps with Lab 9's Go to, Go back and
 * Redo; runs of 10 trials that play out on a timer with Skip ahead; a
 * table that accumulates; a diagnosis committed once; the reveal. No
 * animal's rule is rendered before the commit, and T8 is not reachable
 * before Step 3 (`arena.test.tsx`).
 */

export type StepState = 'intro' | 'predict' | 'running' | 'done'
export const DIAGNOSIS_KEY = 'p4-diagnosis'
/** The view's own timeline for a trial, in seconds; the speed setting plays it faster or slower. */
export const TRIAL_SECONDS = 1.2
/** Trials in a run (Jon, 2026-11-02: 20, so that one run tells the rules apart more often than 10 did). */
export const TRIALS_PER_RUN = 20
/** The speed setting: seconds a trial takes on the screen, from fast to slow. */
export const SPEED_RANGE = { min: 0.2, max: 1.5, step: 0.1 } as const
export const DEFAULT_TRIAL_SECONDS = 1.2

export interface Run extends RunResult {
  letter: string
  /** The learner's experience when it ran (the learner only), so that the table keeps its runs under each apart. */
  experience?: Experience
}

/** A row of the table: an animal, or the learner under one experience. */
export interface TableRow {
  animal: AnimalId
  experience?: Experience
  label: string
  cells: Record<string, { share: number; runs: number }>
}

export class ArenaStore implements PartStore {
  readonly seed: number
  readonly progress: ProgressStore
  readonly letters: Record<AnimalId, string>
  step: Step = 1
  state: StepState = 'intro'
  readonly done: Step[] = []
  readonly drafts: Record<string, string> = {}
  version = 0
  /** Every run so far, in order. */
  runs: Run[] = []
  runsUsed = 0
  /** The run now playing, its trial index, and the clock within the trial. */
  playing: { run: Run; index: number; clock: number } | null = null
  test: string = 'T1'
  animal: AnimalId = 'barriers'
  showSight = false
  /** Seconds a trial takes on the screen (the speed slider). */
  trialSeconds: number = DEFAULT_TRIAL_SECONDS
  experience: Experience = 'usual'
  /** The diagnosis in hand: per animal, the rule chosen. */
  readonly draftDiagnosis: Partial<Record<AnimalId, AnimalId>> = {}
  matrix: Matrix | null = null
  matrixProgress = 0
  badge = ''
  private learner: ContestLearner | null = null
  private learnerFor: Experience | null = null
  private timer: ReturnType<typeof setInterval> | null = null
  private listeners = new Set<() => void>()

  constructor(seed: number, progress: ProgressStore) {
    this.seed = seed
    this.progress = progress
    this.letters = lettersFor(seed)
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

  /** The animals in letter order. */
  get order(): AnimalId[] {
    return [...ANIMAL_IDS].sort((a, b) => this.letters[a].localeCompare(this.letters[b]))
  }

  // --------------------------------------------------------------- steps

  open(s: Step): void {
    this.stopPlaying()
    this.step = s
    this.state = this.done.includes(s) ? 'done' : 'intro'
    this.changed()
  }

  begin(): void {
    if (this.state !== 'intro') return
    this.state = this.allCommitted(this.step) ? 'running' : 'predict'
    this.changed()
  }

  redo(): void {
    const i = this.done.indexOf(this.step)
    if (i >= 0) this.done.splice(i, 1)
    this.stopPlaying()
    this.state = 'intro'
    this.changed()
  }

  finish(): void {
    if (this.state !== 'running') return
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
    this.changed()
  }

  prediction(key: string): string | null {
    return this.progress.prediction(key)
  }

  // --------------------------------------------------------------- tests

  /** The tests the menu offers now: T8 only in Step 3 (§13, item 1). */
  get tests(): TestSpec[] {
    return TESTS.filter((t) => !t.heldOut || this.step === 3)
  }

  setTest(id: string): void {
    if (!this.tests.some((t) => t.id === id)) return
    this.test = id
    this.changed()
  }

  setAnimal(a: AnimalId): void {
    this.animal = a
    this.changed()
  }

  setShowSight(v: boolean): void {
    this.showSight = v
    this.changed()
  }

  setTrialSeconds(v: number): void {
    this.trialSeconds = Math.max(SPEED_RANGE.min, Math.min(SPEED_RANGE.max, v))
    this.changed()
  }

  setExperience(e: Experience): void {
    this.experience = e
    this.changed()
  }

  private learnerNow(): ContestLearner {
    if (!this.learner || this.learnerFor !== this.experience) {
      this.learner = trainLearner(this.experience, this.seed)
      this.learnerFor = this.experience
    }
    return this.learner
  }

  /** Run 10 trials of a test for an animal: the result is computed at once and the trials play out on a timer. */
  run(testId: string, animal: AnimalId): Run | null {
    const test = testById(testId)
    if (!this.tests.includes(test)) return null
    this.runsUsed++
    const result = runTest(animal, test, animal === 'learner' ? this.learnerNow() : null, this.seed * 1000 + this.runsUsed * 17 + testId.charCodeAt(1), TRIALS_PER_RUN)
    const run: Run = { ...result, letter: this.letters[animal] }
    if (animal === 'learner') run.experience = this.experience
    this.runs.push(run)
    this.startPlaying(run)
    return run
  }

  runCurrent(): void {
    this.run(this.test, this.animal)
  }

  /** T1 (or T8) for all five, one run each, played one after another. */
  runAll(testId: string): void {
    const queue = this.order.map((a) => this.run(testId, a)).filter((r): r is Run => r !== null)
    if (queue.length) this.startPlaying(queue[0], queue.slice(1))
  }

  private pending: Run[] = []

  private startPlaying(run: Run, rest: Run[] = []): void {
    this.playing = { run, index: 0, clock: 0 }
    this.pending = rest
    if (!this.timer) this.timer = setInterval(() => this.tickTimer(), 50)
    this.changed()
  }

  private tickTimer(): void {
    if (!this.playing) {
      if (this.timer) clearInterval(this.timer)
      this.timer = null
      return
    }
    // The view's timeline runs at the speed set: a whole trial in `trialSeconds` of wall clock.
    this.playing.clock += 0.05 * (TRIAL_SECONDS / this.trialSeconds)
    if (this.playing.clock >= TRIAL_SECONDS) {
      this.playing.clock = 0
      this.playing.index++
      if (this.playing.index >= this.playing.run.trials.length) {
        const next = this.pending.shift()
        this.playing = next ? { run: next, index: 0, clock: 0 } : null
      }
    }
    this.changed()
  }

  /** End the playing at once (no button since Jon's walk; the speed slider is the control). */
  skipToResult(): void {
    this.playing = null
    this.pending = []
    this.changed()
  }

  private stopPlaying(): void {
    this.playing = null
    this.pending = []
  }

  /** The trial on view: the one playing, or the last run's last trial. */
  get trialOnView(): { trial: Trial; run: Run; index: number; clock: number } | null {
    if (this.playing) return { trial: this.playing.run.trials[this.playing.index], run: this.playing.run, index: this.playing.index, clock: this.playing.clock }
    const last = this.runs[this.runs.length - 1]
    if (!last) return null
    return { trial: last.trials[last.trials.length - 1], run: last, index: last.trials.length - 1, clock: TRIAL_SECONDS }
  }

  /** The table: per animal and test, the share over every run of that pair (the mean of the runs' shares), and the number of runs. The learner's runs are pooled here across experiences; `tableRows` keeps them apart. */
  table(): Record<AnimalId, Record<string, { share: number; runs: number }>> {
    const out = {} as Record<AnimalId, Record<string, { share: number; runs: number }>>
    for (const a of ANIMAL_IDS) out[a] = {}
    for (const r of this.runs) {
      const cell = out[r.animal][r.test] ?? { share: 0, runs: 0 }
      cell.share = (cell.share * cell.runs + r.share) / (cell.runs + 1)
      cell.runs++
      out[r.animal][r.test] = cell
    }
    return out
  }

  /**
   * The table's rows in letter order: one per animal, and for the learner
   * one per experience it has run under, labeled with the experience once
   * it has run under both (Jon's walk, 2026-11-02: a run after "many
   * rooms" must not be pooled with the runs before it).
   */
  tableRows(): TableRow[] {
    const rows: TableRow[] = []
    for (const a of this.order) {
      const runs = this.runs.filter((r) => r.animal === a)
      const experiences: (Experience | undefined)[] = a === 'learner' ? EXPERIENCE_ORDER.filter((e) => runs.some((r) => r.experience === e)) : [undefined]
      const both = experiences.length > 1
      for (const e of experiences.length ? experiences : [undefined]) {
        const cells: TableRow['cells'] = {}
        for (const r of runs) {
          if (e !== undefined && r.experience !== e) continue
          const cell = cells[r.test] ?? { share: 0, runs: 0 }
          cell.share = (cell.share * cell.runs + r.share) / (cell.runs + 1)
          cell.runs++
          cells[r.test] = cell
        }
        rows.push({ animal: a, experience: e, label: both && e ? `${this.letters[a]} ${EXPERIENCE_SHORT[e]}` : this.letters[a], cells })
      }
    }
    return rows
  }

  testsRun(): string[] {
    const ids = new Set(this.runs.map((r) => r.test))
    return TESTS.filter((t) => ids.has(t.id)).map((t) => t.id)
  }

  // --------------------------------------------------------------- diagnosis

  diagnose(animal: AnimalId, rule: AnimalId): void {
    this.draftDiagnosis[animal] = rule
    this.changed()
  }

  get canCommitDiagnosis(): boolean {
    return ANIMAL_IDS.every((a) => this.draftDiagnosis[a] !== undefined) && !this.diagnosed
  }

  get diagnosed(): boolean {
    return this.progress.prediction(DIAGNOSIS_KEY) !== null
  }

  commitDiagnosis(): void {
    if (!this.canCommitDiagnosis) return
    this.progress.commitPrediction(DIAGNOSIS_KEY, JSON.stringify(ANIMAL_IDS.map((a) => this.draftDiagnosis[a])))
    this.changed()
  }

  diagnosis(): Partial<Record<AnimalId, AnimalId>> {
    const raw = this.progress.prediction(DIAGNOSIS_KEY)
    if (!raw) return {}
    try {
      const arr = JSON.parse(raw) as AnimalId[]
      const out: Partial<Record<AnimalId, AnimalId>> = {}
      ANIMAL_IDS.forEach((a, i) => (out[a] = arr[i]))
      return out
    } catch {
      return {}
    }
  }

  /** The build's matrix over twenty seeds, paid one seed per timer tick. */
  computeMatrix(): void {
    if (this.matrix || this.matrixProgress > 0) return
    const seeds = 20
    let k = 0
    const partial: Matrix[] = []
    const tick = () => {
      partial.push(animalsByTests(1, 'usual', 0, 1000 + k))
      k++
      this.matrixProgress = k / seeds
      this.badge = `Running the build’s matrix — seed ${k} of ${seeds}`
      if (k < seeds) {
        this.changed()
        setTimeout(tick, 0)
        return
      }
      const mean = {} as Matrix['mean']
      const sd = {} as Matrix['sd']
      for (const a of ANIMAL_IDS) {
        mean[a] = {}
        sd[a] = {}
        for (const t of TESTS) {
          const v = partial.map((m) => m.mean[a][t.id])
          const m = v.reduce((x, y) => x + y, 0) / v.length
          mean[a][t.id] = m
          sd[a][t.id] = Math.sqrt(v.reduce((x, y) => x + (y - m) * (y - m), 0) / Math.max(1, v.length - 1))
        }
      }
      this.matrix = { seeds, experience: 'usual', hidden: 0, mean, sd }
      this.badge = ''
      this.changed()
    }
    setTimeout(tick, 0)
  }

  rightCount(): number {
    const d = this.diagnosis()
    return ANIMAL_IDS.filter((a) => d[a] === a).length
  }
}

export { ANIMALS }
