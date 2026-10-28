import type { ProgressStore } from '../../../sim/memory/progress/store'
import { makeClearings, type Clearing, type ClearingId } from '../../../sim/memory/logs/clearings'
import { WEEK_NIGHTS, describeFeatures, planWeek, type WeekPlan } from '../../../sim/memory/logs/features'
import { NightSim, PRACTICE_S, type DigOutcome, type NightRecord } from '../../../sim/memory/logs/night'
import { finishNight, newWeekRun, nightRng, startNight, weekDone, type WeekRun } from '../../../sim/memory/logs/week'
import { ANSWERS, type WeekAnswers } from '../../../sim/memory/logs/question'
import type { Truth } from '../../../sim/memory/logs/refill'
import { PAIR_PREDICTION_KEY, TREND_PREDICTION_KEY, type PairPrediction, type Part4PracticeResult, type Part4Predictions, type Part4WeekResult, type TrendPrediction } from '../../../sim/memory/logs/results'
import type { NightCommand, PartStore } from '../contract'

/**
 * Part 4's state (spec §8, revised 2026-10-27): the practice night, then
 * two predictions, then one week of six nights in one clearing, a short
 * screen between nights naming the next night and its features, the
 * unannounced question at the end of the week, and the reveal only after
 * it is committed. The week is one unit (§4.3): begun through the progress
 * store, completed with its records and the question's answers, and, if
 * the page was left partway, run again in the reserve clearing with the
 * same order of night features. Nothing about errors, shares or replays is
 * computed for display before the reveal (`logs.test.tsx`).
 *
 * The space bar pauses a night (Jon, 2026-10-27); the pauses are recorded
 * in the night's record and printed on the reveal, since a pause is time
 * to think about the logs.
 */

export type LogsState = 'intro' | 'practice-intro' | 'night' | 'night-over' | 'predict' | 'week-intro' | 'between' | 'question' | 'revealed'

/** The fade through black at the start of a night, seconds; the light's rise at dawn, which begins as the forager turns for home; and the pause at the nest once home, before the next screen. */
export const FADE_S = 1.2
export const DAWN_S = 4.0
export const HOME_S = 2.5
/** How long the result of a dig that found nothing stays as the large line, seconds. */
export const NOTICE_S = 2.5

export const WEEK_UNIT = 'p4-week' as const

export type BannerTone = 'plain' | 'act' | 'found' | 'none' | 'call' | 'nurse' | 'dawn' | 'pause'

export class LogsStore implements PartStore {
  readonly seed: number
  readonly progress: ProgressStore
  readonly plan: WeekPlan
  readonly clearings: Record<ClearingId, Clearing>
  state: LogsState = 'intro'
  /** Whether the running night is the practice night. */
  practicing = false
  run: WeekRun | null = null
  /** The clearing the week runs in (its own, or the reserve after a restart). */
  clearingId: ClearingId = 'practice'
  sim: NightSim | null = null
  practice: NightRecord | null = null
  /** The end-of-week question's answers so far, by log. */
  draft: WeekAnswers = {}
  /** The predictions chosen but not yet committed. */
  chosen: Part4Predictions = { pairs: null, trend: null }
  committed: Part4Predictions = { pairs: null, trend: null }
  result: Part4WeekResult | null = null
  fade = 0
  dawn = 0
  /** Seconds since the forager came home at dawn. */
  home = 0
  paused = false
  /** Until when the last dig's empty result is the large line. */
  private noticeUntil = -1
  private noticeOutcome: DigOutcome | null = null
  private digsSeen = 0
  muted = false
  /** The week was restarted in the reserve clearing. */
  restarted = false
  version = 0
  private listeners = new Set<() => void>()
  private practiceAttempt = 0

  constructor(seed: number, progress: ProgressStore) {
    this.seed = seed
    this.progress = progress
    this.plan = planWeek(seed)
    this.clearings = makeClearings(seed)
    const p = progress.result('p4-practice') as Part4PracticeResult | undefined
    if (p?.record) this.practice = p.record
    const r = progress.result(WEEK_UNIT) as Part4WeekResult | undefined
    if (r?.records?.length === WEEK_NIGHTS) {
      this.result = r
      this.restarted = r.restarted
    }
    this.committed = { pairs: (progress.prediction(PAIR_PREDICTION_KEY) as PairPrediction | null) ?? null, trend: (progress.prediction(TREND_PREDICTION_KEY) as TrendPrediction | null) ?? null }
    this.chosen = { ...this.committed }
    if (this.result) this.state = 'revealed'
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  changed(): void {
    this.version++
    for (const fn of this.listeners) fn()
  }

  get predictionsCommitted(): boolean {
    return this.committed.pairs !== null && this.committed.trend !== null
  }

  /** The clearing the week runs in now: its own, or the reserve after a restart. */
  clearingForWeek(): ClearingId {
    return this.progress.materialsSlot(WEEK_UNIT) === 0 ? 'week' : 'reserve'
  }

  get clearing(): Clearing {
    return this.clearings[this.clearingId]
  }

  /** The screen after the practice night, or after Begin once the practice is done: the predictions, the week, or the reveal. */
  private afterPractice(): LogsState {
    if (this.result) return 'revealed'
    return this.predictionsCommitted ? 'week-intro' : 'predict'
  }

  /** Part 4's Begin: to the practice night's screen, or on. */
  begin(): void {
    if (this.state !== 'intro') return
    this.state = this.practice ? this.afterPractice() : 'practice-intro'
    this.changed()
  }

  /** The practice night again (it may be redone). */
  openPractice(): void {
    this.state = 'practice-intro'
    this.changed()
  }

  beginPractice(): void {
    if (this.state !== 'practice-intro') return
    this.practicing = true
    this.clearingId = 'practice'
    this.progress.begin('p4-practice')
    this.practiceAttempt++
    const c = this.clearings.practice
    this.sim = new NightSim(c, c.logs.map(() => null), 1, this.plan.practice, nightRng(this.seed, 'practice', 1, this.practiceAttempt), { seconds: PRACTICE_S })
    this.openNight()
  }

  private openNight(): void {
    this.fade = FADE_S
    this.dawn = 0
    this.home = 0
    this.paused = false
    this.noticeUntil = -1
    this.noticeOutcome = null
    this.digsSeen = 0
    this.state = 'night'
    this.changed()
  }

  /** The practice night is over: on to the predictions, the week or the reveal. */
  goOnFromPractice(): void {
    if (this.state !== 'night-over') return
    this.state = this.afterPractice()
    this.sim = null
    this.changed()
  }

  choosePairs(p: PairPrediction): void {
    if (this.committed.pairs) return
    this.chosen = { ...this.chosen, pairs: p }
    this.changed()
  }

  chooseTrend(p: TrendPrediction): void {
    if (this.committed.trend) return
    this.chosen = { ...this.chosen, trend: p }
    this.changed()
  }

  get canCommitPredictions(): boolean {
    return this.chosen.pairs !== null && this.chosen.trend !== null && !this.predictionsCommitted
  }

  /** Commit both predictions before night 1; each is written once. */
  commitPredictions(): void {
    if (this.state !== 'predict' || !this.canCommitPredictions) return
    if (!this.committed.pairs && this.chosen.pairs) this.progress.commitPrediction(PAIR_PREDICTION_KEY, this.chosen.pairs)
    if (!this.committed.trend && this.chosen.trend) this.progress.commitPrediction(TREND_PREDICTION_KEY, this.chosen.trend)
    this.committed = { ...this.chosen }
    this.state = 'week-intro'
    this.changed()
  }

  /** The week's Begin: the unit begins, in its clearing or the reserve; the first between-nights screen follows. */
  beginWeek(): void {
    if (this.state !== 'week-intro' || !this.predictionsCommitted) return
    this.restarted = this.progress.materialsSlot(WEEK_UNIT) > 0
    this.clearingId = this.clearingForWeek()
    this.progress.begin(WEEK_UNIT)
    this.run = newWeekRun(this.plan, this.clearing)
    this.practicing = false
    this.state = 'between'
    this.changed()
  }

  /** The night about to run (1 to 6), on the between-nights screen. */
  get nextNight(): number {
    return (this.run?.records.length ?? 0) + 1
  }

  /** The next night's features line. */
  nextFeaturesLine(): string {
    return `Tonight: ${describeFeatures(this.plan.nights[this.nextNight - 1])}.`
  }

  /** Begin the next night of the week. */
  beginNight(): void {
    if (this.state !== 'between' || !this.run || weekDone(this.run)) return
    const attempt = this.progress.materialsSlot(WEEK_UNIT)
    this.sim = startNight(this.run, this.seed, attempt)
    this.openNight()
  }

  /** The space bar or the Pause button: pause or resume the running night. */
  pause(): void {
    if (this.state !== 'night' || !this.sim || this.sim.done || this.fade > 0) return
    this.paused = !this.paused
    if (this.paused) this.sim.recordPause(0, true)
    this.changed()
  }

  /** The frame loop's step. */
  tick(dt: number, cmd: NightCommand): void {
    if (this.state !== 'night' || !this.sim) return
    if (this.fade > 0) {
      this.fade = Math.max(0, this.fade - dt)
      if (this.fade > 0) return
    }
    if (this.paused) {
      this.sim.recordPause(dt, false)
      return
    }
    // The light rises from the moment the night's time is up, over the walk home; once home, a pause, then the next screen.
    if (this.sim.dawning) this.dawn = Math.min(DAWN_S, this.dawn + dt)
    if (this.sim.done) {
      this.home += dt
      if (this.home >= HOME_S && this.dawn >= DAWN_S) this.nightOver()
      return
    }
    this.sim.step(dt, cmd)
    // A dig that found nothing is said for a moment as the large line.
    while (this.digsSeen < this.sim.record.digs.length) {
      const d = this.sim.record.digs[this.digsSeen++]
      if (d.outcome !== 'beetles') {
        this.noticeUntil = this.sim.time + NOTICE_S
        this.noticeOutcome = d.outcome
      }
    }
  }

  private nightOver(): void {
    const sim = this.sim!
    if (this.practicing) {
      this.practice = sim.record
      this.progress.complete('p4-practice', { record: sim.record } satisfies Part4PracticeResult)
      this.state = 'night-over'
      this.changed()
      return
    }
    finishNight(this.run!, sim)
    if (weekDone(this.run!)) {
      this.draft = {}
      this.state = 'question'
    } else this.state = 'between'
    this.changed()
  }

  /** The end-of-week question: the student's marks. */
  mark(log: number, answer: Truth): void {
    if (this.state !== 'question') return
    this.draft = { ...this.draft, [log]: answer }
    this.changed()
  }

  answers(): Truth[] {
    return ANSWERS
  }

  get questionComplete(): boolean {
    return this.clearing.logs.filter((l) => l.kind === 'loose').every((l) => this.draft[l.id] !== undefined)
  }

  /** Commit the question: the week is complete and saved, and the reveal opens. */
  commitQuestion(): void {
    if (this.state !== 'question' || !this.run || !this.questionComplete) return
    const result: Part4WeekResult = { plan: this.run.plan, clearing: this.clearingId, records: this.run.records, states: this.run.states, answers: this.draft, restarted: this.restarted }
    this.result = result
    this.progress.complete(WEEK_UNIT, result)
    this.sim = null
    this.state = 'revealed'
    this.changed()
  }

  setMuted(m: boolean): void {
    this.muted = m
    this.changed()
  }

  /** What the reveal shows, or null before the week and its question are finished. */
  revealed(): { result: Part4WeekResult; predictions: Part4Predictions } | null {
    if (!this.result) return null
    return { result: this.result, predictions: this.committed }
  }

  /** The night's name over the view: *Practice night* or *Night n of 6*. */
  nightLabel(): string {
    const s = this.sim
    if (!s) return ''
    return this.practicing ? 'Practice night' : `Night ${s.night} of ${WEEK_NIGHTS}`
  }

  /** The status lines on the left while a night runs: one fact to a line, each worded one way. */
  statusLines(): string[] {
    const s = this.sim
    if (!s) return []
    const phase = this.paused
      ? 'Paused'
      : s.done
        ? 'Dawn: the night is over'
        : s.phase === 'returning'
          ? 'Dawn: walking home'
          : s.phase === 'digging'
            ? 'Digging'
            : s.phase === 'eating'
              ? 'Eating beetles'
              : s.phase === 'called'
                ? 'The young are calling: back to the nest'
                : s.phase === 'nursing'
                  ? 'Nursing'
                  : s.canDigAt
                    ? 'At a log: press “Enter” to dig'
                    : 'Foraging'
    const found = s.lastOutcome === 'beetles' ? 'Last dig: beetles' : s.lastOutcome === 'empty' ? 'Last dig: nothing, the log was empty' : s.lastOutcome === 'smooth' ? 'Last dig: nothing, a smooth log' : 'Last dig: none yet'
    return [this.nightLabel(), `Beetles eaten ${s.record.beetles}`, phase, found]
  }

  /**
   * The large line over the view, always present while a night runs (Jon,
   * 2026-10-27: the phase, and a dig's result, big and prominent like the
   * nursing was): what the animal is doing, what the last dig found, the
   * call, the nursing, the dawn, or the pause. Its color changes with the
   * tone; its size does not.
   */
  banner(): { text: string; tone: BannerTone } {
    const s = this.sim
    if (!s) return { text: '', tone: 'plain' }
    if (this.paused) return { text: 'Paused. Press the space bar to go on', tone: 'pause' }
    if (s.done) return { text: 'The night is over. You are home.', tone: 'dawn' }
    if (s.phase === 'returning') return { text: 'Dawn: the night is over', tone: 'dawn' }
    if (s.phase === 'nursing') return { text: 'Nursing the young', tone: 'nurse' }
    if (s.phase === 'called') return { text: 'The young are calling: go back to the nest', tone: 'call' }
    if (s.phase === 'digging') return { text: 'Digging', tone: 'act' }
    if (s.phase === 'eating') return { text: 'Beetles found. Eating', tone: 'found' }
    if (s.time < this.noticeUntil && this.noticeOutcome) return { text: this.noticeOutcome === 'smooth' ? 'Nothing here: a smooth log' : 'Nothing here: the log was empty', tone: 'none' }
    if (s.canDigAt) return { text: 'At a log: press “Enter” to dig', tone: 'act' }
    return { text: 'Foraging', tone: 'plain' }
  }
}
