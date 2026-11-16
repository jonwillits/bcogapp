import type { ProgressStore } from '../../../sim/language/progress/store'
import { StepStore } from '../steps'
import type { Step } from './screens'

/**
 * Part 4's state (spec §8): five steps, every one an exploration, each with
 * its predictions committed before its first result.
 */
export class PredictorsStore extends StepStore<Step> {
  constructor(seed: number, progress: ProgressStore) {
    super(seed, progress, [1, 2, 3, 4, 5])
  }

  isDone(): boolean {
    return false
  }
}
