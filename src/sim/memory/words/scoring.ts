import { UNRELATED_LENGTH, type StudyList } from './lists'
import type { Recall } from './design'
import { classify, type ClassifiedEntry } from './matcher'

/**
 * Part 1's scoring (spec §5.4, less list length, cut 2026-10-26): the
 * serial-position curves by condition, by single position and in three
 * bins; prior-list intrusions; the critical words recalled; the order of
 * output.
 */

export interface RecallRecord {
  slot: number
  list: StudyList
  recall: Recall
  /** What the student typed, in the order typed. */
  typed: string[]
  /** A list of associates was lost to a restart and this unrelated list stands in its place. */
  lostAssociates?: boolean
}

export type Condition = 'immediate' | 'delayed'
export const CONDITIONS: Condition[] = ['immediate', 'delayed']

export function conditionOf(r: RecallRecord): Condition | null {
  if (r.list.kind !== 'unrelated' || r.list.words.length !== UNRELATED_LENGTH) return null
  return r.recall
}

/** Every record classified against the lists studied before it. */
export function classifyAll(records: RecallRecord[]): ClassifiedEntry[][] {
  const sorted = [...records].sort((a, b) => a.slot - b.slot)
  return sorted.map((r, i) => classify(r.typed, r.list, sorted.slice(0, i).map((x) => x.list)))
}

function recordsSorted(records: RecallRecord[]): RecallRecord[] {
  return [...records].sort((a, b) => a.slot - b.slot)
}

export interface Curve {
  condition: Condition
  lists: number
  /** Proportion recalled at each position, 1-based positions in order. */
  byPosition: number[]
  /** The first three positions, the middle, the last three. */
  bins: { first: number; middle: number; last: number }
}

export const BIN = 3

export function serialPositionCurves(records: RecallRecord[]): Curve[] {
  const sorted = recordsSorted(records)
  const classified = classifyAll(sorted)
  return CONDITIONS.map((condition) => {
    const idx = sorted.map((r, i) => (conditionOf(r) === condition ? i : -1)).filter((i) => i >= 0)
    const length = UNRELATED_LENGTH
    const hits = new Array<number>(length).fill(0)
    for (const i of idx) {
      const got = new Set(classified[i].filter((e) => e.kind === 'studied' && !e.duplicate).map((e) => e.position!))
      for (const p of got) hits[p - 1]++
    }
    const n = idx.length
    const byPosition = hits.map((h) => (n ? h / n : 0))
    const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
    return {
      condition,
      lists: n,
      byPosition,
      bins: { first: mean(byPosition.slice(0, BIN)), middle: mean(byPosition.slice(BIN, length - BIN)), last: mean(byPosition.slice(length - BIN)) },
    }
  })
}

export interface Intrusion {
  slot: number
  typed: string
  word: string
  fromSlot: number
}

/** Words typed after one list that were on an earlier list, with which list each came from. */
export function priorListIntrusions(records: RecallRecord[]): { count: number; intrusions: Intrusion[] } {
  const sorted = recordsSorted(records)
  const classified = classifyAll(sorted)
  const intrusions: Intrusion[] = []
  sorted.forEach((r, i) => {
    for (const e of classified[i]) if (e.kind === 'earlier' && !e.duplicate) intrusions.push({ slot: r.slot, typed: e.typed, word: e.word!, fromSlot: sorted[e.fromEarlier!].slot })
  })
  return { count: intrusions.length, intrusions }
}

/** For each studied list of associates: whether its critical word was typed after that list. */
export function criticalRecalled(records: RecallRecord[]): { slot: number; critical: string; recalled: boolean }[] {
  const sorted = recordsSorted(records)
  const classified = classifyAll(sorted)
  return sorted
    .map((r, i) => (r.list.kind === 'associates' ? { slot: r.slot, critical: r.list.critical!, recalled: classified[i].some((e) => e.kind === 'critical') } : null))
    .filter((x): x is { slot: number; critical: string; recalled: boolean } => x !== null)
}

/** Of the immediate unrelated lists with any studied word recalled, the proportion whose first studied word came from the last three positions (§5.4, cuttable). */
export function orderOfOutput(records: RecallRecord[]): { lists: number; proportion: number } {
  const sorted = recordsSorted(records)
  const classified = classifyAll(sorted)
  let lists = 0
  let fromEnd = 0
  sorted.forEach((r, i) => {
    if (r.list.kind !== 'unrelated' || r.recall !== 'immediate') return
    const first = classified[i].find((e) => e.kind === 'studied')
    if (!first) return
    lists++
    if (first.position! > r.list.words.length - BIN) fromEnd++
  })
  return { lists, proportion: lists ? fromEnd / lists : 0 }
}
