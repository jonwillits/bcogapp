import type { ProgressStore } from '../../../sim/social/progress/store'
import type { UnitId } from '../../../sim/social/parts'
import { ANSWER_SECONDS, FEEDBACK_SECONDS, roundMaterials, type Item, type Member, type RoundMaterials } from '../../../sim/social/creatures/materials'
import { scoreRound, type MemoryAnswer, type RoundAnswers, type RoundScores } from '../../../sim/social/creatures/scoring'
import type { PartStore } from '../contract'

/**
 * Part 5's state (PART5_REDESIGN_2026-11-04.md §3, §5): two rounds, each a
 * unit from its instruction screen to the end of its sorting test. A
 * round: 48 training trials, each waiting for the student's "Go", then an
 * answer within 4 s and 1 s of feedback on a timer (the start is the
 * student's, the exposure is fixed: Jon, 2026-11-04); the memory test over
 * 24 items; in Round 1 the surprise
 * screen; the sorting test over the same 24 items. Then the predictions,
 * then the reveal. No score is computed for the screen before the
 * predictions are committed (`creatures.test.tsx`), and no string before
 * Round 1's sorting test names a group (`naming.test.ts`).
 */

/** 'second' is the sorting test; the word is kept out of this file's strings (PART5_REDESIGN §4, item 1). */
export type Phase = 'intro' | 'train' | 'memory' | 'surprise' | 'second' | 'between' | 'predict' | 'revealed'
export const ROUND_UNITS: [UnitId, UnitId] = ['p5-round1', 'p5-round2']
export const PREDICTION_KEYS = { memory: 'p5-pred-memory', second: 'p5-pred-second', newItems: 'p5-pred-new' } as const
/** The materials slot in which Round 1's surprise screen was first seen, so that a restart after it is noted. */
export const SURPRISE_SETTING = 'p5-surprise-slot'

export interface RoundResult {
  answers: RoundAnswers
  slot: number
  familyIndex: 0 | 1
  restarts: number
}

export interface Timers {
  set(fn: () => void, ms: number): unknown
  clear(id: unknown): void
}

const REAL_TIMERS: Timers = { set: (fn, ms) => setTimeout(fn, ms), clear: (id) => clearTimeout(id as ReturnType<typeof setTimeout>) }

export class CreaturesStore implements PartStore {
  readonly seed: number
  readonly progress: ProgressStore
  round: 0 | 1 = 0
  phase: Phase = 'intro'
  materials: RoundMaterials
  /** Training: the trial index, its stage ('ready' until the student presses Go), the answer given, whether it was right. */
  trial = 0
  trialStage: 'ready' | 'answer' | 'feedback' = 'ready'
  trialAnswer: string | null = null
  trialRight = false
  /** The members shown so far in this round's training. */
  private shown = new Set<number>()
  /** The memory and sorting tests' positions. */
  memoryIndex = 0
  secondIndex = 0
  answers: RoundAnswers = { training: [], memory: {}, sorting: {}, noticed: null }
  readonly drafts: Record<string, string> = {}
  version = 0
  private readonly timers: Timers
  private timer: unknown = null
  private listeners = new Set<() => void>()

  constructor(seed: number, progress: ProgressStore, timers: Timers = REAL_TIMERS) {
    this.seed = seed
    this.progress = progress
    this.timers = timers
    this.materials = roundMaterials(seed, 0, progress.materialsSlot(ROUND_UNITS[0]))
    this.resume()
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private changed(): void {
    this.version++
    for (const fn of this.listeners) fn()
  }

  private resume(): void {
    const done0 = this.progress.isComplete(ROUND_UNITS[0])
    const done1 = this.progress.isComplete(ROUND_UNITS[1])
    if (done0 && done1) {
      this.round = 1
      this.materials = roundMaterials(this.seed, 1, this.roundResult(1)!.slot)
      this.phase = this.predictionsCommitted ? 'revealed' : 'predict'
      return
    }
    if (done0) {
      this.round = 1
      this.materials = roundMaterials(this.seed, 1, this.progress.materialsSlot(ROUND_UNITS[1]))
      this.phase = 'between'
      return
    }
    this.round = 0
    this.phase = 'intro'
  }

  get unit(): UnitId {
    return ROUND_UNITS[this.round]
  }

  get predictionsCommitted(): boolean {
    return Object.values(PREDICTION_KEYS).every((k) => this.progress.prediction(k) !== null)
  }

  roundResult(round: 0 | 1): RoundResult | null {
    return this.progress.isComplete(ROUND_UNITS[round]) ? (this.progress.result(ROUND_UNITS[round]) as RoundResult) : null
  }

  // --------------------------------------------------------------- training

  /** Begin the round in hand: Round 1 from its instruction screen, Round 2 from its. */
  begin(): void {
    if (this.phase !== 'intro' && this.phase !== 'between') return
    this.progress.begin(this.unit)
    this.materials = roundMaterials(this.seed, this.round, this.progress.materialsSlot(this.unit))
    this.answers = { training: [], memory: {}, sorting: {}, noticed: null }
    this.shown = new Set()
    this.memoryIndex = 0
    this.secondIndex = 0
    this.trial = 0
    this.phase = 'train'
    this.startTrial()
  }

  private startTrial(): void {
    this.trialStage = 'ready'
    this.trialAnswer = null
    this.trialRight = false
    this.changed()
  }

  /** Go: the member in hand appears and its 4 seconds start. Every showing, the first included, waits for this. */
  go(): void {
    if (this.phase !== 'train' || this.trialStage !== 'ready') return
    this.trialStage = 'answer'
    this.changed()
    this.timer = this.timers.set(() => this.answerTimedOut(), ANSWER_SECONDS * 1000)
  }

  get currentMember(): Member | null {
    if (this.phase !== 'train') return null
    return this.materials.members[this.materials.training[this.trial]] ?? null
  }

  /** The right answer to this trial: in Round 1 whether the member has been shown before; in Round 2 its group. */
  rightAnswer(): string {
    const m = this.currentMember!
    if (this.round === 0) return this.shown.has(m.id) ? 'seen' : 'first'
    return String(m.group)
  }

  /** Answer the training trial: 'seen' or 'first' in Round 1; '0' or '1' (the two names) in Round 2. */
  answerTraining(answer: string): void {
    if (this.phase !== 'train' || this.trialStage !== 'answer') return
    if (this.timer) this.timers.clear(this.timer)
    this.recordTrial(answer)
  }

  private answerTimedOut(): void {
    if (this.phase !== 'train' || this.trialStage !== 'answer') return
    this.recordTrial(null)
  }

  private recordTrial(answer: string | null): void {
    const m = this.currentMember!
    const right = answer !== null && answer === this.rightAnswer()
    this.answers.training.push({ member: m.id, answer, right })
    this.shown.add(m.id)
    this.trialAnswer = answer
    this.trialRight = right
    this.trialStage = 'feedback'
    this.changed()
    this.timer = this.timers.set(() => this.nextTrial(), FEEDBACK_SECONDS * 1000)
  }

  private nextTrial(): void {
    this.trial++
    if (this.trial >= this.materials.training.length) {
      this.phase = 'memory'
      this.memoryIndex = 0
      this.changed()
      return
    }
    this.startTrial()
  }

  // --------------------------------------------------------------- the tests

  get currentMemoryItem(): Item | null {
    if (this.phase !== 'memory') return null
    const id = this.materials.memoryOrder[this.memoryIndex]
    return id === undefined ? null : this.materials.items[id]
  }

  answerMemory(answer: MemoryAnswer): void {
    const item = this.currentMemoryItem
    if (!item) return
    this.answers.memory[item.id] = answer
    this.memoryIndex++
    if (this.memoryIndex >= this.materials.memoryOrder.length) {
      this.phase = this.round === 0 ? 'surprise' : 'second'
      this.secondIndex = 0
      // The slot in which the surprise was first seen, kept from the first time.
      if (this.phase === 'surprise' && this.progress.setting(SURPRISE_SETTING) === null) this.progress.setSetting(SURPRISE_SETTING, String(this.materials.slot))
    }
    this.changed()
  }

  answerNoticed(noticed: 'yes' | 'no'): void {
    if (this.phase !== 'surprise') return
    this.answers.noticed = noticed
    this.phase = 'second'
    this.changed()
  }

  get currentSecondItem(): Item | null {
    if (this.phase !== 'second') return null
    const id = this.materials.secondOrder[this.secondIndex]
    return id === undefined ? null : this.materials.items[id]
  }

  /** The second test's answer for the item: 0 or 1, Kind 1 or Kind 2 in Round 1, the two names in Round 2. */
  answerSecond(choice: 0 | 1): void {
    const item = this.currentSecondItem
    if (!item) return
    this.answers.sorting[item.id] = choice
    this.secondIndex++
    if (this.secondIndex >= this.materials.secondOrder.length) this.finishRound()
    this.changed()
  }

  private finishRound(): void {
    const result: RoundResult = { answers: this.answers, slot: this.materials.slot, familyIndex: this.materials.familyIndex, restarts: this.progress.restarts(this.unit) }
    this.progress.complete(this.unit, result)
    if (this.round === 0) {
      this.round = 1
      this.materials = roundMaterials(this.seed, 1, this.progress.materialsSlot(ROUND_UNITS[1]))
      this.phase = 'between'
    } else this.phase = this.predictionsCommitted ? 'revealed' : 'predict'
  }

  // --------------------------------------------------------------- predictions and the reveal

  choose(key: string, value: string): void {
    this.drafts[key] = value
    this.changed()
  }

  get canCommit(): boolean {
    return this.phase === 'predict' && Object.values(PREDICTION_KEYS).every((k) => this.drafts[k] || this.progress.prediction(k))
  }

  commitPredictions(): void {
    if (!this.canCommit) return
    for (const k of Object.values(PREDICTION_KEYS)) if (this.drafts[k]) this.progress.commitPrediction(k, this.drafts[k])
    this.phase = 'revealed'
    this.changed()
  }

  /** Both rounds' scores, only once both are complete and the predictions committed. */
  scores(): { round1: RoundScores; round2: RoundScores } | null {
    if (!this.predictionsCommitted) return null
    const r0 = this.roundResult(0)
    const r1 = this.roundResult(1)
    if (!r0 || !r1) return null
    return { round1: scoreRound(roundMaterials(this.seed, 0, r0.slot).items, r0.answers, true), round2: scoreRound(roundMaterials(this.seed, 1, r1.slot).items, r1.answers, false) }
  }

  /** Round 1 was interrupted after its surprise screen had been seen, so the student already knew about the kinds. */
  get restartedAfterSurprise(): boolean {
    const r0 = this.roundResult(0)
    const seenIn = this.progress.setting(SURPRISE_SETTING)
    return !!r0 && r0.restarts > 0 && seenIn !== null && Number(seenIn) < r0.slot
  }

  dispose(): void {
    if (this.timer) this.timers.clear(this.timer)
  }
}
