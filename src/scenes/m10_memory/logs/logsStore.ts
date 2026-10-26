import type { ProgressStore } from '../../../sim/memory/progress/store'
import { makeClearings, type Clearing, type ClearingId } from '../../../sim/memory/logs/clearings'
import { planPart4, type BlockPlan, type Part4Plan } from '../../../sim/memory/logs/features'
import { NightSim, type NightRecord } from '../../../sim/memory/logs/night'
import { answerMap, finishNight, newBlockRun, nightRng, startNight, type BlockRun } from '../../../sim/memory/logs/block'
import { answersForNight, type MapAnswers } from '../../../sim/memory/logs/mapQuestion'
import type { Truth } from '../../../sim/memory/logs/refill'
import { SECOND_BLOCK_KEY, type Part4BlockResult, type Part4PracticeResult, type SecondBlockPrediction } from '../../../sim/memory/logs/results'
import type { UnitId } from '../../../sim/memory/parts'
import type { NightCommand, PartStore } from '../contract'

/**
 * Part 4's state (spec §8): the practice night, then two blocks of three
 * nights, each night followed by the map question, with the prediction
 * committed before the second block and the reveal only after both. Each
 * block is a unit (§4.3): begun through the progress store, completed with
 * its records, and, if the page was left partway, run again in the reserve
 * clearing. Nothing about errors, map answers or replays is computed for
 * display before both blocks are finished (`reveal.test.tsx`).
 */

export type LogsState = 'intro' | 'practice-intro' | 'night' | 'night-over' | 'map' | 'block-intro' | 'predict' | 'revealed'

/** The fade through black at the start of a night and the light's rise at dawn, seconds. */
export const FADE_S = 1.2
export const DAWN_S = 2.0

export const BLOCK_UNITS: UnitId[] = ['p4-block-1', 'p4-block-2']

export class LogsStore implements PartStore {
  readonly seed: number
  readonly progress: ProgressStore
  readonly plan: Part4Plan
  readonly clearings: Record<ClearingId, Clearing>
  state: LogsState = 'intro'
  /** −1 practice; 0 and 1 the blocks. */
  blockIndex: -1 | 0 | 1 = -1
  run: BlockRun | null = null
  /** The clearing the current block runs in (its own, or the reserve after a restart). */
  clearingId: ClearingId = 'practice'
  sim: NightSim | null = null
  practice: NightRecord | null = null
  /** The map question's answers so far, by log. */
  draft: MapAnswers = {}
  /** Whether the first map question has been answered (after it, the map line is said). */
  mapSeen = false
  prediction: SecondBlockPrediction | null = null
  committed: SecondBlockPrediction | null = null
  /** The finished blocks' results, by index. */
  results: (Part4BlockResult | null)[] = [null, null]
  fade = 0
  dawn = 0
  muted = false
  /** What was restarted, for the results' line. */
  restarted: boolean[] = [false, false]
  version = 0
  private listeners = new Set<() => void>()
  private practiceAttempt = 0

  constructor(seed: number, progress: ProgressStore) {
    this.seed = seed
    this.progress = progress
    this.plan = planPart4(seed)
    this.clearings = makeClearings(seed)
    // Read back what is saved: finished blocks, the practice night, the prediction.
    const p = progress.result('p4-practice') as Part4PracticeResult | undefined
    if (p?.record) this.practice = p.record
    for (const i of [0, 1] as const) {
      const r = progress.result(BLOCK_UNITS[i]) as Part4BlockResult | undefined
      if (r?.records?.length === 3) {
        this.results[i] = r
        this.restarted[i] = r.restarted
      }
    }
    this.committed = (progress.prediction(SECOND_BLOCK_KEY) as SecondBlockPrediction | null) ?? null
    this.prediction = this.committed
    if (this.results[0] && this.results[1]) {
      this.state = 'revealed'
      this.blockIndex = 1
      this.mapSeen = true
    } else if (this.results[0]) {
      this.state = this.committed ? 'block-intro' : 'predict'
      this.blockIndex = 1
      this.mapSeen = true
    }
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  changed(): void {
    this.version++
    for (const fn of this.listeners) fn()
  }

  /** The block a unit index runs, and the clearing it runs in now. */
  clearingFor(i: 0 | 1): ClearingId {
    const unit = BLOCK_UNITS[i]
    const slot = this.progress.materialsSlot(unit)
    return slot === 0 ? this.plan.blocks[i].clearing : this.plan.blocks[i].reserve
  }

  get block(): BlockPlan | null {
    return this.blockIndex === 0 || this.blockIndex === 1 ? this.plan.blocks[this.blockIndex] : null
  }

  get clearing(): Clearing {
    return this.clearings[this.clearingId]
  }

  /** Part 4's Begin: to the practice night's screen. */
  begin(): void {
    if (this.state !== 'intro') return
    this.state = this.practice ? (this.results[0] ? (this.results[1] ? 'revealed' : this.committed ? 'block-intro' : 'predict') : 'block-intro') : 'practice-intro'
    if (this.state === 'block-intro') this.blockIndex = this.results[0] ? 1 : 0
    this.changed()
  }

  /** The practice night again (it may be redone). */
  openPractice(): void {
    this.state = 'practice-intro'
    this.blockIndex = -1
    this.changed()
  }

  beginPractice(): void {
    if (this.state !== 'practice-intro') return
    this.blockIndex = -1
    this.clearingId = 'practice'
    this.progress.begin('p4-practice')
    this.practiceAttempt++
    const c = this.clearings.practice
    this.sim = new NightSim(c, c.logs.map(() => null), 1, this.plan.practice, nightRng(this.seed, 'practice', 'practice', 1, this.practiceAttempt))
    this.fade = FADE_S
    this.state = 'night'
    this.changed()
  }

  /** A block's Begin: the unit begins, in its clearing or the reserve. */
  beginBlock(): void {
    if (this.state !== 'block-intro' || this.blockIndex < 0) return
    const i = this.blockIndex as 0 | 1
    const unit = BLOCK_UNITS[i]
    this.restarted[i] = this.progress.materialsSlot(unit) > 0
    this.clearingId = this.clearingFor(i)
    this.progress.begin(unit)
    this.run = newBlockRun(this.plan.blocks[i], this.clearing)
    this.startNextNight()
    this.changed()
  }

  private startNextNight(): void {
    if (!this.run) return
    const attempt = this.progress.materialsSlot(BLOCK_UNITS[this.blockIndex as 0 | 1])
    this.sim = startNight(this.run, this.seed, attempt)
    this.fade = FADE_S
    this.dawn = 0
    this.state = 'night'
  }

  /** The frame loop's step. */
  tick(dt: number, cmd: NightCommand): void {
    if (this.state !== 'night' || !this.sim) return
    if (this.fade > 0) {
      this.fade = Math.max(0, this.fade - dt)
      if (this.fade > 0) return
    }
    if (this.sim.done) {
      this.dawn = Math.min(DAWN_S, this.dawn + dt)
      if (this.dawn >= DAWN_S) this.nightOver()
      return
    }
    this.sim.step(dt, cmd)
  }

  private nightOver(): void {
    const sim = this.sim!
    if (this.blockIndex < 0) {
      this.practice = sim.record
      this.progress.complete('p4-practice', { record: sim.record } satisfies Part4PracticeResult)
      this.state = 'night-over'
      this.changed()
      return
    }
    finishNight(this.run!, sim)
    this.draft = {}
    this.state = 'map'
    this.changed()
  }

  /** The practice night is over: on to the first block (or redo). */
  goOnFromPractice(): void {
    if (this.state !== 'night-over') return
    this.state = this.results[0] ? (this.results[1] ? 'revealed' : this.committed ? 'block-intro' : 'predict') : 'block-intro'
    this.blockIndex = this.results[0] ? 1 : 0
    this.sim = null
    this.changed()
  }

  /** The map question: what the night offers, and the student's marks. */
  get mapNight(): number {
    return this.run?.records.length ?? 0
  }

  mapAnswers(): Truth[] {
    return answersForNight(this.mapNight)
  }

  mark(log: number, answer: Truth): void {
    if (this.state !== 'map') return
    this.draft = { ...this.draft, [log]: answer }
    this.changed()
  }

  get mapComplete(): boolean {
    return this.clearing.logs.filter((l) => l.kind === 'loose').every((l) => this.draft[l.id] !== undefined)
  }

  /** Commit the map, then the next night, or the block's end. */
  commitMap(): void {
    if (this.state !== 'map' || !this.run || !this.mapComplete) return
    answerMap(this.run, this.draft)
    this.mapSeen = true
    if (this.run.records.length < 3) {
      this.startNextNight()
    } else {
      const i = this.blockIndex as 0 | 1
      const result: Part4BlockResult = { index: i, plan: this.run.plan, clearing: this.clearingId, records: this.run.records, answers: this.run.answers, states: this.run.states, restarted: this.restarted[i] }
      this.results[i] = result
      this.progress.complete(BLOCK_UNITS[i], result)
      this.sim = null
      if (i === 0) {
        this.state = this.committed ? 'block-intro' : 'predict'
        this.blockIndex = 1
      } else this.state = 'revealed'
    }
    this.changed()
  }

  predict(p: SecondBlockPrediction): void {
    if (this.committed) return
    this.prediction = p
    this.changed()
  }

  /** Commit the prediction before the second block; it is written once. */
  commitPrediction(): void {
    if (this.state !== 'predict' || !this.prediction || this.committed) return
    this.progress.commitPrediction(SECOND_BLOCK_KEY, this.prediction)
    this.committed = this.prediction
    this.state = 'block-intro'
    this.blockIndex = 1
    this.changed()
  }

  setMuted(m: boolean): void {
    this.muted = m
    this.changed()
  }

  /** What the reveal shows: both blocks, in the order run, or null before both are finished. */
  revealed(): { first: Part4BlockResult; second: Part4BlockResult; prediction: SecondBlockPrediction | null } | null {
    if (!this.results[0] || !this.results[1]) return null
    return { first: this.results[0], second: this.results[1], prediction: this.committed }
  }

  /** The status lines over the view while a night runs: one fact to a line, each worded one way. */
  statusLines(): string[] {
    const s = this.sim
    if (!s) return []
    const n = this.blockIndex < 0 ? 'Practice night' : `Night ${s.night} of 3`
    const phase = s.done
      ? 'Dawn: the night is over'
      : s.phase === 'digging'
        ? 'Digging'
        : s.phase === 'eating'
          ? 'Eating beetles'
          : s.phase === 'called'
            ? 'The young are calling: go back to the nest'
            : s.phase === 'nursing'
              ? 'Nursing'
              : s.canDigAt
                ? 'At a log: press “Enter” to dig'
                : 'Foraging'
    const found = s.lastOutcome === 'beetles' ? 'Last dig: beetles' : s.lastOutcome === 'empty' ? 'Last dig: nothing, the log was empty' : s.lastOutcome === 'smooth' ? 'Last dig: nothing, a smooth log' : 'Last dig: none yet'
    return [n, `Beetles eaten ${s.record.beetles}`, phase, found]
  }
}
