import type { Clearing } from './clearings'
import { truthOf, type LastEmptied, type Truth } from './refill'

/**
 * The map question after each night (spec §8.6): for each loose-bark log
 * the student marks when it was emptied. Night 1 offers tonight or not
 * emptied; night 2 adds last night; night 3 adds two nights ago. The
 * confusion table (§8.7) has rows for what was true and columns for what
 * was marked; the cells that are confusions between nights are those where
 * both are nights and they differ. *Confusions between nights* is their
 * sum, out of the logs that could have been confused: the loose-bark logs
 * that were emptied on some night of the block so far.
 */

export const ANSWERS: Truth[] = ['tonight', 'last night', 'two nights ago', 'never']

export const ANSWER_LABEL: Record<Truth, string> = {
  tonight: 'Emptied tonight',
  'last night': 'Emptied last night',
  'two nights ago': 'Emptied two nights ago',
  never: 'Not emptied',
}

/** The answers a night's map question offers. */
export function answersForNight(night: number): Truth[] {
  return ANSWERS.filter((a) => a === 'never' || a === 'tonight' || (a === 'last night' && night >= 2) || (a === 'two nights ago' && night >= 3))
}

export type MapAnswers = Record<number, Truth>

/** What was true of each loose-bark log after night `night`, from the block's state after that night. */
export function truths(clearing: Clearing, lastAfterNight: LastEmptied, night: number): Record<number, Truth> {
  const out: Record<number, Truth> = {}
  for (const l of clearing.logs) if (l.kind === 'loose') out[l.id] = truthOf(lastAfterNight[l.id], night)
  return out
}

export interface ConfusionTable {
  /** rows[truth][marked] counts. */
  cells: Record<Truth, Record<Truth, number>>
  confusions: number
  couldBeConfused: number
  /** Marks right, out of the loose-bark logs. */
  right: number
  logs: number
}

export function confusionTable(truth: Record<number, Truth>, answers: MapAnswers): ConfusionTable {
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

/** Sum the tables of a block's nights. */
export function sumTables(tables: ConfusionTable[]): ConfusionTable {
  const out = confusionTable({}, {})
  for (const t of tables) {
    for (const r of ANSWERS) for (const c of ANSWERS) out.cells[r][c] += t.cells[r][c]
    out.confusions += t.confusions
    out.couldBeConfused += t.couldBeConfused
    out.right += t.right
    out.logs += t.logs
  }
  return out
}
