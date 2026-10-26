import { byHand, emptyCounts, tally, type ByHand, type Counts } from '../../fish/sdt'
import { isPresent, typeOf, type Arrangement, type ItemType } from './arrangements'
import { itemById, type ItemKind } from './items'

/**
 * The checklist (spec §7.3) and its scoring (§7.4): for each of the
 * twenty-four item names, *In the room* or *Not in the room*, then
 * confidence from 1 to 4, worded as last year's lab worded it. Scored with
 * Lab 7's four outcomes, twice: once for the items that fit the room and
 * once for those that do not, each with hit and false-alarm rates, d′ and
 * the criterion, by Lab 7's `byHand`.
 */

export const CONFIDENCE_LABELS: Record<1 | 2 | 3 | 4, string> = {
  1: 'guessing',
  2: 'think maybe it was there',
  3: 'pretty sure',
  4: 'very sure',
}

export type Confidence = 1 | 2 | 3 | 4

export interface ChecklistAnswer {
  id: string
  inRoom: boolean
  confidence: Confidence
}

export type Outcome = 'hit' | 'miss' | 'falseAlarm' | 'correctRejection'

export function outcomeOf(arr: Arrangement, a: ChecklistAnswer): Outcome {
  const present = isPresent(arr, a.id)
  if (present) return a.inRoom ? 'hit' : 'miss'
  return a.inRoom ? 'falseAlarm' : 'correctRejection'
}

export interface KindScore {
  kind: ItemKind
  counts: Counts
  byHand: ByHand
  /** A rate of 0 or 1 was repaired before its z was taken. */
  repaired: boolean
  /** Mean confidence per outcome, or null where there were none. */
  confidence: Record<Outcome, number | null>
  meanConfidence: number | null
}

export interface ChecklistScore {
  fitting: KindScore
  unfitting: KindScore
  /** Mean confidence by outcome over all items. */
  confidence: Record<Outcome, number | null>
  /** Each answer with its type and outcome, for the reveal. */
  rows: { id: string; name: string; type: ItemType; inRoom: boolean; confidence: Confidence; outcome: Outcome }[]
}

function meanOf(v: number[]): number | null {
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null
}

function scoreKind(arr: Arrangement, answers: ChecklistAnswer[], kind: ItemKind): KindScore {
  const counts = emptyCounts()
  const conf: Record<Outcome, number[]> = { hit: [], miss: [], falseAlarm: [], correctRejection: [] }
  const all: number[] = []
  for (const a of answers) {
    if (itemById(a.id).kind !== kind) continue
    tally(counts, isPresent(arr, a.id), a.inRoom)
    conf[outcomeOf(arr, a)].push(a.confidence)
    all.push(a.confidence)
  }
  const repaired = counts.hits === 0 || counts.misses === 0 || counts.falseAlarms === 0 || counts.correctRejections === 0
  return {
    kind,
    counts,
    byHand: byHand(counts),
    repaired,
    confidence: { hit: meanOf(conf.hit), miss: meanOf(conf.miss), falseAlarm: meanOf(conf.falseAlarm), correctRejection: meanOf(conf.correctRejection) },
    meanConfidence: meanOf(all),
  }
}

export function scoreChecklist(arr: Arrangement, answers: ChecklistAnswer[]): ChecklistScore {
  const conf: Record<Outcome, number[]> = { hit: [], miss: [], falseAlarm: [], correctRejection: [] }
  const rows = answers.map((a) => {
    const outcome = outcomeOf(arr, a)
    conf[outcome].push(a.confidence)
    return { id: a.id, name: itemById(a.id).name, type: typeOf(arr, a.id), inRoom: a.inRoom, confidence: a.confidence, outcome }
  })
  return {
    fitting: scoreKind(arr, answers, 'fitting'),
    unfitting: scoreKind(arr, answers, 'unfitting'),
    confidence: { hit: meanOf(conf.hit), miss: meanOf(conf.miss), falseAlarm: meanOf(conf.falseAlarm), correctRejection: meanOf(conf.correctRejection) },
    rows,
  }
}

export const OUTCOME_LABEL: Record<Outcome, string> = { hit: 'Hit', miss: 'Miss', falseAlarm: 'False alarm', correctRejection: 'Correct rejection' }

/** What Part 3 saves when the unit completes. */
export interface Part3Result {
  arrangement: Arrangement
  answers: ChecklistAnswer[]
  /** How long the room was shown, by the clock, seconds. */
  roomSeconds: number
  restarted: boolean
}
