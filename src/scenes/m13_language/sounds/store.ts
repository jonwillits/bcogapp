import type { ProgressStore } from '../../../sim/language/progress/store'
import type { UnitId } from '../../../sim/language/parts'
import { StepStore } from '../steps'
import type { Step } from './screens'

/**
 * Part 1's state (spec §5): four steps, each opening on its instruction
 * screen and each independently accessible. Step 2 is one unit (the six
 * labels, from the first label to the commit); Step 3 is two units, one per
 * block, the second started by the student's press after the first is
 * saved; Steps 1 and 4 are explorations whose predictions stay committed.
 */

export const LABELS_UNIT: UnitId = 'p1-labels'
export const LABELING_UNIT: UnitId = 'p1-labeling'
export const ABX_UNIT: UnitId = 'p1-abx'

export class SoundsStore extends StepStore<Step> {
  constructor(seed: number, progress: ProgressStore) {
    super(seed, progress, [1, 2, 3, 4])
  }

  isDone(step: Step): boolean {
    if (step === 2) return this.progress.isComplete(LABELS_UNIT)
    if (step === 3) return this.progress.isComplete(LABELING_UNIT) && this.progress.isComplete(ABX_UNIT)
    return false
  }

  protected underWay(step: Step): boolean {
    // Between the two blocks of Step 3, the step is running: block 1 is saved and block 2 waits for its press.
    return step === 3 && this.progress.isComplete(LABELING_UNIT) && !this.progress.isComplete(ABX_UNIT)
  }

  get betweenBlocks(): boolean {
    return this.underWay(3) && !this.opened.has(3)
  }
}
