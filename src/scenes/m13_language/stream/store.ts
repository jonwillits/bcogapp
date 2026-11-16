import type { ProgressStore } from '../../../sim/language/progress/store'
import type { UnitId } from '../../../sim/language/parts'
import { StepStore } from '../steps'
import { NOTICE_LINE, type Step } from './screens'

/**
 * Part 2's state (spec §6): four steps. Step 1 is one unit (the first
 * minute and the committed answer); Step 2 is a unit that resumes (the
 * board is saved as it goes); Steps 3 and 4 are explorations. Steps 2 to 4
 * show the stream divided into words, so while Step 1 is not committed they
 * open behind a one-line notice (spec §11, item 3).
 */

export const MINUTE_UNIT: UnitId = 'p2-minute'
export const BOARD_UNIT: UnitId = 'p2-board'

export class StreamStore extends StepStore<Step> {
  constructor(seed: number, progress: ProgressStore) {
    super(seed, progress, [1, 2, 3, 4])
  }

  isDone(step: Step): boolean {
    if (step === 1) return this.progress.isComplete(MINUTE_UNIT)
    if (step === 2) return this.progress.isComplete(BOARD_UNIT)
    return false
  }

  protected underWay(step: Step): boolean {
    return step === 2 && this.progress.status(BOARD_UNIT) === 'in progress'
  }

  notice(step: Step): { line: string; goTo: Step } | null {
    if (step === 1 || this.progress.isComplete(MINUTE_UNIT)) return null
    return { line: NOTICE_LINE, goTo: 1 }
  }
}
