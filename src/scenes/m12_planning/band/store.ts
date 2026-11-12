import { makeRng, type Rng } from '../../../sim/random'
import type { ProgressStore } from '../../../sim/planning/progress/store'
import type { UnitId } from '../../../sim/planning/parts'
import { HistoryRun, bandForRun, RUN_ORDER, type Band } from '../../../sim/planning/history'
import { runTest, TEST_IDS, type RunResult, type TestId } from '../../../sim/planning/tests'
import { MatrixRun } from '../../../sim/planning/matrix'
import type { HomininKind } from '../../../sim/planning/hominins/types'
import type { ShallowVariant } from '../../../sim/planning/hominins/planners'
import { StudentDay, obstacles, type Obstacle } from '../../../sim/planning/studentDay'
import { MORNING_SECONDS, WINDOW_SECONDS } from '../../../sim/planning/range/places'
import type { Cue } from '../../../sim/planning/range/needs'
import type { DriveCommand, PartStore } from '../contract'
import { SCREENS, type Step } from './screens'

/**
 * Part 3's state (spec §7): Step 1's two driven days (two units, each
 * restarted from dawn if interrupted); the band's history, lived in slices
 * once a run is wanted; runs of ten days from the end of the history; the
 * table; the diagnosis, committed once; Step 4's reveal with the build's
 * matrix, computed in slices; and the Shallow planner's variant, a setting
 * shown only in Step 4.
 */

export type StepState = 'intro' | 'predict' | 'running' | 'done'
export const DAY_UNIT = (n: 1 | 2): UnitId => (n === 1 ? 'p3-day-1' : 'p3-day-2')
export const DIAGNOSIS_KEY = 'p3-diagnosis'
export const VARIANT_KEY = 'p3-shallow-variant'
/** The Shallow planner's default variant. Jon chooses it from the build's tables on the walk (spec §7.5); until then, A. */
export const DEFAULT_VARIANT: ShallowVariant = 'A'
export const DAY_CUES: [Cue, Cue] = ['vultures', 'hyenas']
export const LETTERS = ['A', 'B', 'C', 'D', 'E'] as const
export type Letter = (typeof LETTERS)[number]
export const LETTER_COLORS: Record<Letter, string> = { A: '#4f9cff', B: '#f0a94b', C: '#34d399', D: '#c084fc', E: '#f87171' }
export const ELDER_COLOR = '#ffffff'

/** Steps of the student's day taken for each step of real time while waiting for midday. */
export const WAIT_SPEED = 8
export const STUDENT_COLOR = '#fde047'
/** How long a day plays past the window's end, range seconds. */
export const DAY_LENGTH = MORNING_SECONDS + WINDOW_SECONDS + 10
/** Days of history lived per slice: about 30 ms on the development Mac. */
const HISTORY_SLICE = 25

export interface DayRecord {
  cue: Cue
  ate: boolean
  log: string[]
  restarts: number
}

export interface Run extends RunResult {
  index: number
}

export function lettersFor(seed: number): Record<HomininKind, Letter> {
  const rng = makeRng(seed ^ 0x1e77e5)
  const letters = [...LETTERS]
  for (let i = letters.length - 1; i > 0; i--) {
    const j = rng.int(i + 1)
    ;[letters[i], letters[j]] = [letters[j], letters[i]]
  }
  const out = {} as Record<HomininKind, Letter>
  RUN_ORDER.forEach((k, i) => (out[k] = letters[i]))
  return out
}

export class BandStore implements PartStore {
  readonly seed: number
  readonly progress: ProgressStore
  readonly letters: Record<HomininKind, Letter>
  readonly obstacles: Obstacle[]
  step: Step = 1
  version = 0
  private listeners = new Set<() => void>()
  private opened = new Set<Step>()
  readonly drafts: Record<string, string> = {}

  // Step 1
  day: StudentDay | null = null
  dayIndex: 1 | 2 = 1
  private dayRng: Rng
  /** Seconds of the frame loop, for the figures' walk cycles. */
  seconds = 0

  // The band
  private history: HistoryRun | null = null
  band: Band | null = null
  private historyTimer: ReturnType<typeof setInterval> | null = null
  // Runs
  runs: Run[] = []
  runsUsed = 0
  test: TestId = 'T1'
  private runRng: Rng
  // Watching
  watching: { run: Run; day: number; clock: number } | null = null
  speed = 15
  follow: 'above' | Letter | 'elder' = 'above'
  // Diagnosis
  readonly draftDiagnosis: Partial<Record<Letter, HomininKind>> = {}
  // Matrix
  matrixRun: MatrixRun | null = null
  infoOpen = false

  constructor(seed: number, progress: ProgressStore) {
    this.seed = seed
    this.progress = progress
    this.letters = lettersFor(seed)
    this.obstacles = obstacles(makeRng(seed ^ 0x0b57))
    this.dayRng = makeRng(seed ^ 0xda1)
    this.runRng = makeRng(seed ^ 0x5e7)
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  changed(): void {
    this.version++
    for (const fn of this.listeners) fn()
  }

  // ---------------------------------------------------------------- steps

  open(step: Step): void {
    this.step = step
    this.watching = null
    if (step !== 1) this.ensureHistory()
    if (step === 4 && this.diagnosed) this.ensureMatrix()
    this.changed()
  }

  stateOf(step: Step): StepState {
    switch (step) {
      case 1:
        return this.progress.isComplete(DAY_UNIT(1)) && this.progress.isComplete(DAY_UNIT(2)) ? 'done' : this.opened.has(1) ? 'running' : 'intro'
      case 2:
      case 3:
        if (!this.opened.has(step)) return 'intro'
        return this.allCommitted(step) ? 'running' : 'predict'
      case 4:
        return this.opened.has(4) ? 'running' : 'intro'
    }
  }

  get state(): StepState {
    return this.stateOf(this.step)
  }

  begin(): void {
    this.opened.add(this.step)
    if (this.step === 1) this.startDay()
    this.changed()
  }

  reopen(): void {
    this.opened.delete(this.step)
    this.changed()
  }

  allCommitted(step: Step): boolean {
    return SCREENS[step].predictions.every((p) => this.progress.prediction(p.key) !== null)
  }

  choose(key: string, value: string): void {
    this.drafts[key] = value
    this.changed()
  }

  canCommit(): boolean {
    return SCREENS[this.step].predictions.every((p) => this.drafts[p.key] || this.progress.prediction(p.key))
  }

  commitPredictions(): void {
    if (!this.canCommit()) return
    for (const p of SCREENS[this.step].predictions) if (this.drafts[p.key]) this.progress.commitPrediction(p.key, this.drafts[p.key])
    this.changed()
  }

  prediction(key: string): string | null {
    return this.progress.prediction(key)
  }

  // ---------------------------------------------------------------- Step 1

  private startDay(): void {
    this.dayIndex = this.progress.isComplete(DAY_UNIT(1)) ? 2 : 1
    if (this.progress.isComplete(DAY_UNIT(this.dayIndex))) {
      this.day = null
      return
    }
    const unit = DAY_UNIT(this.dayIndex)
    if (this.progress.status(unit) !== 'in progress') this.progress.begin(unit)
    this.day = new StudentDay(DAY_CUES[this.dayIndex - 1], this.dayRng.fork(), this.obstacles)
  }

  /** The day is over and its summary read: save it and go on. */
  finishDay(): void {
    if (!this.day || this.day.state.phase !== 'done') return
    const unit = DAY_UNIT(this.dayIndex)
    const record: DayRecord = { cue: this.day.state.cue, ate: this.day.state.ate, log: this.day.state.log, restarts: this.progress.restarts(unit) }
    this.progress.complete(unit, record)
    this.day = null
    if (this.dayIndex === 1) this.startDay()
    this.changed()
  }

  dayRecord(n: 1 | 2): DayRecord | null {
    return this.progress.isComplete(DAY_UNIT(n)) ? (this.progress.result(DAY_UNIT(n)) as DayRecord) : null
  }

  /** Enter, or its button: eat at the need's place, or make what the hands allow. */
  act(): void {
    this.day?.make()
    this.changed()
  }

  /** The student's day stands still: Space or the Pause button (Jon, 2026-11-11). The information card pauses it too. */
  paused = false
  /** The clock runs at WAIT_SPEED steps a step while the student stands still, until midday or until anything is pressed (Jon, 2026-11-11: a fast chain left a long wait). */
  waiting = false

  togglePause(): void {
    if (this.step !== 1 || !this.day || this.day.state.phase === 'done') return
    this.paused = !this.paused
    this.waiting = false
    this.changed()
  }

  waitForMidday(): void {
    if (this.step !== 1 || !this.day || this.day.state.act || (this.day.state.phase !== 'dawn' && this.day.state.phase !== 'morning')) return
    this.waiting = true
    this.paused = false
    this.changed()
  }

  stopWaiting(): void {
    this.waiting = false
    this.changed()
  }

  /** J or K, or a hand's button: that hand picks up or puts down. */
  hand(side: 0 | 1): void {
    this.day?.hand(side)
    this.changed()
  }

  /** The fraction of a step left over after this frame's steps, from the frame loop; the view draws the body that much short of its last step, so it moves at one rate across frames. */
  alpha = 1

  frame(alpha: number): void {
    this.alpha = alpha
  }

  tick(dt: number, cmd: DriveCommand): void {
    this.seconds += dt
    if (this.step === 1 && this.day) {
      const pressed = cmd.forward !== 0 || cmd.turn !== 0 || cmd.act || !!cmd.left || !!cmd.right
      if (this.paused || this.infoOpen) {
        this.day.hold()
      } else if (this.waiting && !pressed) {
        for (let i = 0; i < WAIT_SPEED && this.waiting; i++) {
          this.day.tick(dt, { forward: 0, turn: 0, act: false })
          if (this.day.state.phase !== 'dawn' && this.day.state.phase !== 'morning') this.waiting = false
        }
        this.day.hold()
      } else {
        this.waiting = false
        this.day.tick(dt, cmd)
      }
      if (this.day.state.phase === 'done') this.paused = false
    }
    if (this.watching) {
      this.watching.clock += dt * this.speed
      if (this.watching.clock >= DAY_LENGTH) this.watching.clock = DAY_LENGTH
    }
  }

  // ---------------------------------------------------------------- the band

  /** Live the band's history a slice at a time, off the frame loop, until it is done. */
  ensureHistory(): void {
    if (this.band || this.historyTimer) return
    if (!this.history) this.history = new HistoryRun(this.seed)
    this.historyTimer = setInterval(() => {
      if (!this.history) return
      if (this.step === 1) return // not while the student is driving
      if (this.history.step(HISTORY_SLICE)) {
        this.band = this.history.band()
        if (this.historyTimer) clearInterval(this.historyTimer)
        this.historyTimer = null
      }
      this.changed()
    }, 20)
  }

  get historyProgress(): { lived: number; of: number } {
    return { lived: this.history?.progress ?? 0, of: this.history?.days ?? 500 }
  }

  get variant(): ShallowVariant {
    const s = this.progress.setting(VARIANT_KEY)
    return s === 'A' || s === 'B' ? s : DEFAULT_VARIANT
  }

  setVariant(v: ShallowVariant): void {
    this.progress.setSetting(VARIANT_KEY, v)
    this.changed()
  }

  setTest(t: TestId): void {
    this.test = t
    this.changed()
  }

  /** The tests the menu offers: T1 only in Step 2; all six in Step 3 and 4. */
  get tests(): TestId[] {
    return this.step === 2 ? ['T1'] : [...TEST_IDS]
  }

  /** Run ten days of a test for all five, from the end of the history; day 1 plays in the view. */
  run(test: TestId = this.test): Run | null {
    if (!this.band || !this.tests.includes(test)) return null
    this.runsUsed++
    const rng = this.runRng.fork()
    const result = runTest(test, bandForRun(this.band, this.variant, rng), rng)
    const run: Run = { ...result, index: this.runs.length + 1 }
    this.runs.push(run)
    this.watch(run, 0)
    return run
  }

  watch(run: Run, day: number): void {
    this.watching = { run, day, clock: 0 }
    this.changed()
  }

  stopWatching(): void {
    this.watching = null
    this.changed()
  }

  setSpeed(v: number): void {
    this.speed = Math.max(2, Math.min(60, v))
    this.changed()
  }

  setFollow(f: 'above' | Letter | 'elder'): void {
    this.follow = f
    this.changed()
  }

  get lastRun(): Run | null {
    return this.runs[this.runs.length - 1] ?? null
  }

  /** The letters in alphabetical order, with their kinds. */
  get order(): { letter: Letter; kind: HomininKind }[] {
    return RUN_ORDER.map((kind) => ({ letter: this.letters[kind], kind })).sort((a, b) => a.letter.localeCompare(b.letter))
  }

  /** The table: per letter and test, the mean share over the runs of that test, and the number of runs. */
  table(): Record<Letter, Partial<Record<TestId, { share: number; runs: number }>>> {
    const out = Object.fromEntries(LETTERS.map((l) => [l, {}])) as Record<Letter, Partial<Record<TestId, { share: number; runs: number }>>>
    for (const r of this.runs)
      for (const kind of RUN_ORDER) {
        const l = this.letters[kind]
        const cell = out[l][r.test] ?? { share: 0, runs: 0 }
        cell.share = (cell.share * cell.runs + r.shares[kind]) / (cell.runs + 1)
        cell.runs++
        out[l][r.test] = cell
      }
    return out
  }

  /** T2's strips, the most recent T2 run: per letter, ten days. */
  t2Strips(): Record<Letter, boolean[]> | null {
    const r = [...this.runs].reverse().find((x) => x.test === 'T2')
    if (!r) return null
    return Object.fromEntries(RUN_ORDER.map((k) => [this.letters[k], r.strip[k]])) as Record<Letter, boolean[]>
  }

  testsRun(): TestId[] {
    const set = new Set(this.runs.map((r) => r.test))
    return TEST_IDS.filter((t) => set.has(t))
  }

  // ---------------------------------------------------------------- diagnosis

  diagnose(letter: Letter, kind: HomininKind): void {
    this.draftDiagnosis[letter] = kind
    this.changed()
  }

  get canCommitDiagnosis(): boolean {
    return LETTERS.every((l) => this.draftDiagnosis[l] !== undefined) && !this.diagnosed
  }

  get diagnosed(): boolean {
    return this.progress.prediction(DIAGNOSIS_KEY) !== null
  }

  commitDiagnosis(): void {
    if (!this.canCommitDiagnosis) return
    this.progress.commitPrediction(DIAGNOSIS_KEY, JSON.stringify(LETTERS.map((l) => this.draftDiagnosis[l])))
    this.changed()
  }

  diagnosis(): Partial<Record<Letter, HomininKind>> {
    const raw = this.progress.prediction(DIAGNOSIS_KEY)
    if (!raw) return {}
    try {
      const arr = JSON.parse(raw) as HomininKind[]
      const out: Partial<Record<Letter, HomininKind>> = {}
      LETTERS.forEach((l, i) => (out[l] = arr[i]))
      return out
    } catch {
      return {}
    }
  }

  rightCount(): number {
    const d = this.diagnosis()
    return RUN_ORDER.filter((k) => d[this.letters[k]] === k).length
  }

  // ---------------------------------------------------------------- matrix

  ensureMatrix(): void {
    if (this.matrixRun) return
    this.matrixRun = new MatrixRun()
    const tick = () => {
      if (!this.matrixRun) return
      const done = this.matrixRun.step()
      this.changed()
      if (!done) setTimeout(tick, 0)
    }
    setTimeout(tick, 0)
  }

  setInfoOpen(v: boolean): void {
    this.infoOpen = v
    this.changed()
  }
}
