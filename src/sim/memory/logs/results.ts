import type { ClearingId } from './clearings'
import type { BlockPlan, Part4Plan } from './features'
import type { NightRecord } from './night'
import type { MapAnswers } from './mapQuestion'
import type { LastEmptied } from './refill'

/**
 * What Part 4 saves (spec §4.2, §8.7), and what Part 5 reads: the student's
 * own six nights. Saved through the progress store under the units
 * `p4-practice`, `p4-block-1` and `p4-block-2`, and the prediction key
 * `p4-second-block`. Plain data only, so it round-trips through JSON.
 */

export interface Part4PracticeResult {
  record: NightRecord
}

export interface Part4BlockResult {
  /** Which block of the plan this was: the first or the second run. */
  index: 0 | 1
  plan: BlockPlan
  /** The clearing the block ran in: the plan's, or the reserve after a restart. */
  clearing: ClearingId
  records: NightRecord[]
  answers: MapAnswers[]
  /** The state after each night; index 0 is the fresh block. */
  states: LastEmptied[]
  restarted: boolean
}

/** The prediction committed before the second block (§8.5). */
export type SecondBlockPrediction = 'more often' | 'less often' | 'about as often'
export const SECOND_BLOCK_PREDICTIONS: SecondBlockPrediction[] = ['more often', 'less often', 'about as often']
export const SECOND_BLOCK_KEY = 'p4-second-block'

/** Everything Part 5 needs of the student's nights, gathered from the progress store (or from the sample set). */
export interface StudentNights {
  seed: number
  plan: Part4Plan
  blocks: [Part4BlockResult, Part4BlockResult]
  prediction: SecondBlockPrediction | null
  /** The nights were played by someone else (the sample set). */
  sample: boolean
}
