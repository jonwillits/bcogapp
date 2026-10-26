/**
 * The refill rule (spec §8.1, §8.3), stated to the student and run exactly
 * as stated: *After you empty a log, it is still empty the next night. The
 * night after that, it has beetles again.* A loose-bark log never emptied
 * is full. Smooth logs never have beetles. There is no other source of
 * change: no rival, no randomness. Every error the forager makes is an
 * error of memory.
 *
 * A block's state is, per log, the night it was last emptied (1-based
 * within the block) or null. A loose-bark log is full on night n unless it
 * was emptied on night n − 1.
 */

import type { LogKind } from './clearings'

export type LastEmptied = (number | null)[]

export function freshBlock(n: number): LastEmptied {
  return new Array<number | null>(n).fill(null)
}

/** Whether a log is full on night `night`, given its kind and when it was last emptied. */
export function isFull(kind: LogKind, lastEmptied: number | null, night: number): boolean {
  if (kind === 'smooth') return false
  return lastEmptied !== night - 1
}

export function fullOnNight(kinds: readonly LogKind[], last: LastEmptied, night: number): boolean[] {
  return kinds.map((k, i) => isFull(k, last[i], night))
}

/** The state after a night: every log emptied tonight records tonight. */
export function afterNight(last: LastEmptied, emptiedTonight: readonly boolean[], night: number): LastEmptied {
  return last.map((l, i) => (emptiedTonight[i] ? night : l))
}

/** What was true of a loose-bark log on night `night`, for the map question: when it was last emptied, as the question's words. */
export type Truth = 'tonight' | 'last night' | 'two nights ago' | 'never'

export function truthOf(lastEmptied: number | null, night: number): Truth {
  if (lastEmptied === null) return 'never'
  if (lastEmptied === night) return 'tonight'
  if (lastEmptied === night - 1) return 'last night'
  if (lastEmptied === night - 2) return 'two nights ago'
  return 'never'
}

/** The two rules, as the instruction screen states them and the fixed line beside the view repeats them (§8.1). */
export const KIND_RULE = 'Logs with loose bark have beetles under them unless the beetles have recently been eaten. Smooth logs never have beetles.'
export const REFILL_RULE = 'After you empty a log, it is still empty the next night. The night after that, it has beetles again.'
