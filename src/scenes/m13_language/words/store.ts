import type { ProgressStore } from '../../../sim/language/progress/store'
import type { UnitId } from '../../../sim/language/parts'
import { StepStore } from '../steps'
import { NOTICE_LINE, type Step } from './screens'

/**
 * Part 3's state (spec §7): Steps 1 and 2 are one unit, the learning trials
 * and the test, restarted on the reserve set if interrupted; Step 3 is an
 * exploration on the student's own trials, which names the two models, so
 * while the unit is not done it opens behind a one-line notice.
 */

export const WORDS_UNIT: UnitId = 'p3-words'

export class WordsStore extends StepStore<Step> {
  constructor(seed: number, progress: ProgressStore) {
    super(seed, progress, [1, 2, 3])
  }

  isDone(step: Step): boolean {
    return step !== 3 && this.progress.isComplete(WORDS_UNIT)
  }

  notice(step: Step): { line: string; goTo: Step } | null {
    if (step !== 3 || this.progress.isComplete(WORDS_UNIT)) return null
    return { line: NOTICE_LINE, goTo: 1 }
  }
}
