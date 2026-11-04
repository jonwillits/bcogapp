import { usableRate, zOf } from '../../fish/sdt'
import { type Item } from './materials'

/**
 * Part 5's scores for one round (PART5_REDESIGN_2026-11-04.md §6): the hit
 * rate to old items; the false-alarm rates to changed-detail items and to
 * new typical members; d′ for individuals from the hit rate and the
 * changed-detail false alarms, with Lab 7's repair of rates of 0 and 1;
 * and the sorting accuracy, under the best assignment of Kind 1 and Kind 2
 * to the two groups in Round 1 and by the names in Round 2.
 */

export type MemoryAnswer = 'seen' | 'new'

export interface RoundAnswers {
  /** The training trials: the member shown, the answer given ('seen' | 'first' | null for none in time), and whether it was right. */
  training: { member: number; answer: string | null; right: boolean }[]
  /** Memory test: item id → answer. */
  memory: Record<number, MemoryAnswer>
  /** Sorting test: item id → 0 or 1 (Kind 1 / Kind 2 in Round 1, the two names in Round 2). */
  sorting: Record<number, 0 | 1>
  /** Round 1 only: the answer to "Did you notice?". */
  noticed: 'yes' | 'no' | null
}

export interface RoundScores {
  hits: number
  hitRate: number
  falseAlarmsChanged: number
  falseAlarmRateChanged: number
  falseAlarmsNew: number
  falseAlarmRateNew: number
  dPrime: number
  sortedRight: number
  sortingAccuracy: number
  /** Round 1: whether Kind 1 was taken as the tall group (true) or the short group (false) under the best assignment; Round 2: null. */
  kindOneIsTall: boolean | null
  trainingRight: number
  trainingTrials: number
}

export function scoreRound(items: Item[], answers: RoundAnswers, bestAssignment: boolean): RoundScores {
  const old = items.filter((i) => i.kind === 'old')
  const changed = items.filter((i) => i.kind === 'changed')
  const fresh = items.filter((i) => i.kind === 'new')
  const hits = old.filter((i) => answers.memory[i.id] === 'seen').length
  const faChanged = changed.filter((i) => answers.memory[i.id] === 'seen').length
  const faNew = fresh.filter((i) => answers.memory[i.id] === 'seen').length
  const dPrime = zOf(usableRate(hits, old.length)) - zOf(usableRate(faChanged, changed.length))
  const right = (kindOneIsTall: boolean) => items.filter((i) => answers.sorting[i.id] !== undefined && (answers.sorting[i.id] === 0) === (kindOneIsTall ? i.group === 1 : i.group === 0)).length
  let sortedRight: number
  let kindOneIsTall: boolean | null = null
  if (bestAssignment) {
    const a = right(false)
    const b = right(true)
    kindOneIsTall = b > a
    sortedRight = Math.max(a, b)
  } else sortedRight = right(false)
  return {
    hits,
    hitRate: hits / old.length,
    falseAlarmsChanged: faChanged,
    falseAlarmRateChanged: faChanged / changed.length,
    falseAlarmsNew: faNew,
    falseAlarmRateNew: faNew / fresh.length,
    dPrime,
    sortedRight,
    sortingAccuracy: sortedRight / items.length,
    kindOneIsTall,
    trainingRight: answers.training.filter((t) => t.right).length,
    trainingTrials: answers.training.length,
  }
}
