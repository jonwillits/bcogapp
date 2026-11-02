import type { ProgressStore } from '../../../sim/social/progress/store'
import { PART1_PARTNERS, unitOfMatch, type UnitId } from '../../../sim/social/parts'
import { partnerMove } from '../../../sim/social/game/match'
import { points, ruleById, type Move, type RuleId } from '../../../sim/social/game/rules'
import { lengthFor, planPart1, MIN_ROUNDS, MAX_ROUNDS, type Part1Plan } from '../../../sim/social/game/plan'
import type { PartStore } from '../contract'

/**
 * Part 1's state (spec §5): six partners, each a match that is a unit of
 * work, played in any order once started; then the diagnosis, a unit; then
 * the reveal. No partner's move for a round is computed before the round's
 * two choices are committed together, and no partner's rule, name or
 * description is in the markup before the diagnosis is committed
 * (`partners.test.tsx`).
 */

export type PartnersState = 'intro' | 'choose' | 'match' | 'match-over' | 'diagnosis-intro' | 'diagnosis' | 'revealed'

export const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'] as const
export type Letter = (typeof LETTERS)[number]
export { lengthFor, planPart1, MIN_ROUNDS, MAX_ROUNDS, type Part1Plan }
export const MAX_NOTES_CHARS = 1500
export const DIAGNOSIS_UNIT: UnitId = 'p1-diagnosis'

export interface RoundRecord {
  predicted: Move
  partner: Move
  student: Move
  studentPoints: number
  partnerPoints: number
}

export interface MatchResult {
  partner: number
  letter: Letter
  length: number
  rounds: RoundRecord[]
  notes: string
  restarts: number
}

export interface DiagnosisResult {
  /** Per partner index: the rule whose description the student chose. */
  choices: RuleId[]
}

export class PartnersStore implements PartStore {
  readonly seed: number
  readonly progress: ProgressStore
  readonly plan: Part1Plan
  state: PartnersState = 'intro'
  /** The partner now being played. */
  partner = 0
  length = 0
  rounds: RoundRecord[] = []
  notes = ''
  /** The two choices for the round in hand, before the commit. */
  draftPredicted: Move | null = null
  draftMine: Move | null = null
  /** The last round revealed, for the lit cell. */
  lastRound: RoundRecord | null = null
  /** The diagnosis in hand. */
  draftDiagnosis: (RuleId | null)[] = Array.from({ length: PART1_PARTNERS }, () => null)
  version = 0
  private listeners = new Set<() => void>()

  constructor(seed: number, progress: ProgressStore) {
    this.seed = seed
    this.progress = progress
    this.plan = planPart1(seed)
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

  /** Where a reload lands: the intro, the choice of partner, the diagnosis, or the reveal. */
  private resume(): void {
    if (this.progress.isComplete(DIAGNOSIS_UNIT)) {
      this.state = 'revealed'
      return
    }
    if (this.allMatchesDone()) {
      this.state = 'diagnosis-intro'
      return
    }
    const anyStarted = LETTERS.some((_, i) => this.progress.isComplete(unitOfMatch(i)) || this.progress.restarts(unitOfMatch(i)) > 0)
    this.state = anyStarted ? 'choose' : 'intro'
  }

  matchDone(i: number): boolean {
    return this.progress.isComplete(unitOfMatch(i))
  }

  allMatchesDone(): boolean {
    return LETTERS.every((_, i) => this.matchDone(i))
  }

  matchesDone(): number {
    return LETTERS.filter((_, i) => this.matchDone(i)).length
  }

  result(i: number): MatchResult | null {
    return this.matchDone(i) ? (this.progress.result(unitOfMatch(i)) as MatchResult) : null
  }

  ruleOf(i: number) {
    return ruleById(this.plan.rules[i])
  }

  begin(): void {
    if (this.state !== 'intro') return
    this.state = 'choose'
    this.changed()
  }

  /** Start a partner's match: the unit is in progress, and a new length is drawn for a restart. */
  startMatch(i: number): void {
    if (this.state !== 'choose' || this.matchDone(i)) return
    this.partner = i
    this.length = lengthFor(this.seed, i, this.progress.restarts(unitOfMatch(i)))
    this.rounds = []
    this.notes = ''
    this.draftPredicted = null
    this.draftMine = null
    this.lastRound = null
    this.progress.begin(unitOfMatch(i))
    this.state = 'match'
    this.changed()
  }

  choosePredicted(m: Move): void {
    this.draftPredicted = m
    this.changed()
  }

  chooseMine(m: Move): void {
    this.draftMine = m
    this.changed()
  }

  setNotes(text: string): void {
    this.notes = text.slice(0, MAX_NOTES_CHARS)
    this.changed()
  }

  get canCommitRound(): boolean {
    return this.state === 'match' && this.draftPredicted !== null && this.draftMine !== null
  }

  /** Commit the round's two choices together: only now is the partner's move computed, from the history before the round. */
  commitRound(): void {
    if (!this.canCommitRound) return
    const history = this.rounds.map((r) => ({ student: r.student, partner: r.partner }))
    const partner = partnerMove(this.ruleOf(this.partner), history)
    const student = this.draftMine!
    const round: RoundRecord = { predicted: this.draftPredicted!, partner, student, studentPoints: points(student, partner), partnerPoints: points(partner, student) }
    this.rounds.push(round)
    this.lastRound = round
    // The two choices stay set for the next round (Jon, 2026-11-02: a
    // student who plays the same again should not have to press both
    // buttons again); the instruction screen says so.
    if (this.rounds.length >= this.length) this.state = 'match-over'
    this.changed()
  }

  get studentTotal(): number {
    return this.rounds.reduce((a, r) => a + r.studentPoints, 0)
  }

  get partnerTotal(): number {
    return this.rounds.reduce((a, r) => a + r.partnerPoints, 0)
  }

  /** Save the finished match: the unit is complete and never redone. */
  saveMatch(): void {
    if (this.state !== 'match-over') return
    const unit = unitOfMatch(this.partner)
    const result: MatchResult = { partner: this.partner, letter: LETTERS[this.partner], length: this.length, rounds: this.rounds, notes: this.notes, restarts: this.progress.restarts(unit) }
    this.progress.complete(unit, result)
    this.state = this.allMatchesDone() ? 'diagnosis-intro' : 'choose'
    this.changed()
  }

  beginDiagnosis(): void {
    if (this.state !== 'diagnosis-intro') return
    this.progress.begin(DIAGNOSIS_UNIT)
    this.state = 'diagnosis'
    this.changed()
  }

  diagnose(i: number, rule: RuleId): void {
    this.draftDiagnosis[i] = rule
    this.changed()
  }

  /** Take a partner's letter back off its description (the matching screen's tray). */
  undiagnose(i: number): void {
    this.draftDiagnosis[i] = null
    this.changed()
  }

  get canCommitDiagnosis(): boolean {
    return this.state === 'diagnosis' && this.draftDiagnosis.every((d) => d !== null)
  }

  commitDiagnosis(): void {
    if (!this.canCommitDiagnosis) return
    const result: DiagnosisResult = { choices: this.draftDiagnosis as RuleId[] }
    this.progress.complete(DIAGNOSIS_UNIT, result)
    this.state = 'revealed'
    this.changed()
  }

  diagnosis(): DiagnosisResult | null {
    return this.progress.isComplete(DIAGNOSIS_UNIT) ? (this.progress.result(DIAGNOSIS_UNIT) as DiagnosisResult) : null
  }
}
