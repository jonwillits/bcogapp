import { UNIT_IDS, type UnitId } from '../parts'
import { isSavedState as isSavedStateOf, newState as newStateOf, type ProgressSchema, type SavedState as SavedStateOf } from '../../progress/state'

/**
 * What Lab 12 saves (spec §4): the seed, which units are complete, every
 * response the student made and every result computed from it (inside each
 * unit's `result`, the part's own object; a resuming unit's `partial` while
 * it is under way), every committed prediction, and the rewritable settings
 * (the Shallow planner's variant once Step 4 opens, notes). The shape and
 * its check are the shared layer's (`src/sim/progress/`). There are no flags:
 * nothing is locked.
 */

export type Flag = never
export const SCHEMA: ProgressSchema<UnitId, Flag> = { unitIds: UNIT_IDS, flags: [] }

export type SavedState = SavedStateOf<UnitId, Flag>

export function newState(seed: number): SavedState {
  return newStateOf(seed, SCHEMA)
}

export function isSavedState(x: unknown): x is SavedState {
  return isSavedStateOf(x, SCHEMA)
}

export { STATE_VERSION, MAX_STATE_BYTES, MAX_STRING_LENGTH, type UnitRecord, type UnitStatus } from '../../progress/state'
