import type { Clearing } from './clearings'
import { WEEK_NIGHTS } from './features'
import { truthOf, type LastEmptied, type Truth } from './refill'

/**
 * The question at the end of the week (spec §8.6): after night 6's dawn,
 * with no warning before it, the student answers as a person, not as the
 * animal. The clearing from above, every log drawn by kind and by its
 * look; for each loose-bark log one of *Emptied tonight* (night 6),
 * *Emptied last night* (night 5), *Emptied two nights ago* (night 4) or
 * *Not emptied in the last three nights*. It is the only report in the
 * part and comes after all the foraging, so it cannot change how the
 * student foraged. The reveal sets what was marked against what was true
 * as a small confusion table (§8.7, item 4).
 */

export const ANSWERS: Truth[] = ['tonight', 'last night', 'two nights ago', 'never']

export const ANSWER_LABEL: Record<Truth, string> = {
  tonight: 'Emptied tonight',
  'last night': 'Emptied last night',
  'two nights ago': 'Emptied two nights ago',
  never: 'Not emptied in the last three nights',
}

export type WeekAnswers = Record<number, Truth>

/** What was true of each loose-bark log after the week's last night. */
export function truths(clearing: Clearing, lastAfterWeek: LastEmptied, night = WEEK_NIGHTS): Record<number, Truth> {
  const out: Record<number, Truth> = {}
  for (const l of clearing.logs) if (l.kind === 'loose') out[l.id] = truthOf(lastAfterWeek[l.id], night)
  return out
}

export interface ConfusionTable {
  /** cells[truth][marked] counts. */
  cells: Record<Truth, Record<Truth, number>>
  /** Marks of one night for another: the off-diagonal cells among the three nights. */
  confusions: number
  /** Logs emptied on one of the three nights, which could have been confused. */
  couldBeConfused: number
  right: number
  logs: number
}

export function confusionTable(truth: Record<number, Truth>, answers: WeekAnswers): ConfusionTable {
  const cells = {} as Record<Truth, Record<Truth, number>>
  for (const r of ANSWERS) {
    cells[r] = {} as Record<Truth, number>
    for (const c of ANSWERS) cells[r][c] = 0
  }
  let confusions = 0
  let couldBeConfused = 0
  let right = 0
  let logs = 0
  for (const k of Object.keys(truth)) {
    const id = Number(k)
    const t = truth[id]
    const m = answers[id] ?? 'never'
    cells[t][m]++
    logs++
    if (t === m) right++
    if (t !== 'never') {
      couldBeConfused++
      if (m !== 'never' && m !== t) confusions++
    }
  }
  return { cells, confusions, couldBeConfused, right, logs }
}
