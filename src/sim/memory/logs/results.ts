import type { Clearing } from './clearings'
import { PAIR_KINDS, TEST_NIGHTS, nightsOfKind, pairKind, type PairKind, type WeekPlan } from './features'
import type { NightRecord } from './night'
import type { WeekAnswers } from './question'
import type { LastEmptied } from './refill'

/**
 * What Part 4 saves (spec §4.2, §8.7) and what Part 5 reads: the student's
 * own week. Saved through the progress store under the units `p4-practice`
 * and `p4-week`, with the two predictions under `p4-pairs` and `p4-trend`.
 * Plain data only, so it round-trips through JSON.
 *
 * **The measure of confusion between nights, from behavior** (§8.7). For
 * each of nights 3 to 6, a *when-decision* is any visit to a log emptied on
 * night n − 1 or night n − 2: a dig at it, or passing close by it
 * (`PASS_CLOSE_M`). A *when-error* is a dig at a log emptied on night n − 1,
 * or a log emptied on night n − 2 that was passed close by and never dug
 * that night. Each log counts once per night. The night's *share of
 * when-errors* is when-errors over when-decisions: a share, so that a
 * student who digs more does not appear to confuse more. The same is also
 * scored over digs alone (`digDecisions`, `digErrors`), since a log passed
 * on the way to another is a weaker sign of a decision than a dig; the
 * build records both (notes §4.8).
 */

export interface Part4PracticeResult {
  record: NightRecord
}

export interface Part4WeekResult {
  plan: WeekPlan
  records: NightRecord[]
  /** The state after each night; index 0 is the fresh week. */
  states: LastEmptied[]
  /** The end-of-week question's answers. */
  answers: WeekAnswers
  restarted: boolean
}

export type PairPrediction = 'more mistakes' | 'fewer mistakes' | 'about as many'
export const PAIR_PREDICTIONS: PairPrediction[] = ['more mistakes', 'fewer mistakes', 'about as many']
export const PAIR_PREDICTION_KEY = 'p4-pairs'
export const PAIR_QUESTION = 'On a night that follows two nights that looked alike, will you make more mistakes about which logs are full, fewer, or about as many as on a night that follows two nights that looked different?'

export type TrendPrediction = 'fewer' | 'more' | 'about the same'
export const TREND_PREDICTIONS: TrendPrediction[] = ['fewer', 'more', 'about the same']
export const TREND_PREDICTION_KEY = 'p4-trend'
export const TREND_QUESTION = 'Over the week, will your mistakes become fewer, more, or stay about the same?'

export interface Part4Predictions {
  pairs: PairPrediction | null
  trend: TrendPrediction | null
}

/** Everything Part 5 needs of the student's week, gathered from the progress store (or from the sample set). */
export interface StudentNights {
  seed: number
  week: Part4WeekResult
  predictions: Part4Predictions
  /** The nights were played by someone else (the sample set). */
  sample: boolean
}

export interface WhenLog {
  log: number
  /** The night the log was emptied on: n − 1 or n − 2. */
  emptiedOn: number
  dug: boolean
  passed: boolean
  /** A when-decision: dug or passed close by. */
  decision: boolean
  error: boolean
}

export interface WhenScore {
  night: number
  /** Loose-bark logs emptied on night n − 1 or n − 2. */
  atStake: number
  emptiedLastNight: number
  emptiedTwoAgo: number
  decisions: number
  errors: number
  /** Over digs alone. */
  digDecisions: number
  digErrors: number
  logs: WhenLog[]
}

/** The when-decisions and when-errors of one night (3 to 6), from its record and the state before it. Nights 1 and 2 score nothing. */
export function whenScore(record: NightRecord, lastBefore: LastEmptied, clearing: Clearing): WhenScore {
  const n = record.night
  const out: WhenScore = { night: n, atStake: 0, emptiedLastNight: 0, emptiedTwoAgo: 0, decisions: 0, errors: 0, digDecisions: 0, digErrors: 0, logs: [] }
  if (n < 3) return out
  for (const l of clearing.logs) {
    if (l.kind !== 'loose') continue
    const e = lastBefore[l.id]
    if (e !== n - 1 && e !== n - 2) continue
    out.atStake++
    if (e === n - 1) out.emptiedLastNight++
    else out.emptiedTwoAgo++
    const dug = record.digs.some((d) => d.log === l.id)
    const passed = record.passedClose[l.id] ?? false
    const decision = dug || passed
    const error = e === n - 1 ? dug : passed && !dug
    out.logs.push({ log: l.id, emptiedOn: e, dug, passed, decision, error })
    if (decision) out.decisions++
    if (error) out.errors++
    if (dug) {
      out.digDecisions++
      if (e === n - 1) out.digErrors++
    }
  }
  return out
}

export const shareOf = (errors: number, decisions: number): number | null => (decisions > 0 ? errors / decisions : null)

export interface KindSummary {
  kind: PairKind
  nights: number[]
  decisions: number
  errors: number
  share: number | null
  digDecisions: number
  digErrors: number
  digShare: number | null
  /** What a forager with no memory for nights would score over digs alone: logs emptied last night over all logs at stake. */
  baseline: number | null
}

export interface WeekSummary {
  order: WeekPlan['order']
  /** Nights 1 to 6; nights 1 and 2 carry zeros. */
  nights: WhenScore[]
  byKind: Record<PairKind, KindSummary>
  beetles: number[]
}

export function weekSummary(result: Part4WeekResult, clearing: Clearing): WeekSummary {
  const nights = result.records.map((r, i) => whenScore(r, result.states[i], clearing))
  const byKind = {} as Record<PairKind, KindSummary>
  for (const kind of PAIR_KINDS) {
    const ns = nightsOfKind(result.plan.order, kind)
    const scores = ns.map((n) => nights[n - 1]).filter(Boolean)
    const sum = (f: (s: WhenScore) => number) => scores.reduce((a, s) => a + f(s), 0)
    const decisions = sum((s) => s.decisions)
    const errors = sum((s) => s.errors)
    const digDecisions = sum((s) => s.digDecisions)
    const digErrors = sum((s) => s.digErrors)
    const atStake = sum((s) => s.atStake)
    byKind[kind] = { kind, nights: ns, decisions, errors, share: shareOf(errors, decisions), digDecisions, digErrors, digShare: shareOf(digErrors, digDecisions), baseline: shareOf(sum((s) => s.emptiedLastNight), atStake) }
  }
  return { order: result.plan.order, nights, byKind, beetles: result.records.map((r) => r.beetles) }
}

/** The kind of each test night, for a table's rows. */
export const testNightKinds = (order: WeekPlan['order']) => TEST_NIGHTS.map((n) => ({ night: n, kind: pairKind(order, n)! }))

const pct = (v: number | null) => (v === null ? '  —' : `${Math.round(100 * v)}%`.padStart(4))

/**
 * The result line for the class (§8.7, item 5): the order, the two shares,
 * and the four nightly shares, in one line a student can copy into the
 * report. Whether and how Jon pools these is his call (§16, item 8).
 */
export function resultLine(s: WeekSummary): string {
  const a = s.byKind['after a look-alike pair']
  const d = s.byKind['after a different pair']
  const nightly = TEST_NIGHTS.map((n) => pct(shareOf(s.nights[n - 1]?.errors ?? 0, s.nights[n - 1]?.decisions ?? 0)).trim()).join(' ')
  return `${s.order} · after look-alike pairs ${pct(a.share).trim()} · after different pairs ${pct(d.share).trim()} · nights 3 to 6: ${nightly}`
}
