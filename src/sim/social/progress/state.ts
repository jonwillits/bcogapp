import { UNIT_IDS, type UnitId } from '../parts'
import { isSavedState as isSavedStateOf, newState as newStateOf, type ProgressSchema, type SavedState as SavedStateOf } from '../../progress/state'

/**
 * What Lab 11 saves (spec §4): the seed, which units are complete, every
 * response the student made and every result computed from it (inside each
 * unit's `result`, the part's own object), every committed prediction, and
 * one flag, `skippedPart1` (§4.2: a student whose Part 1 is lost can open
 * Part 2 with *Skip Part 1*, and Part 1 then stays locked for that seed).
 * The shape and its check are the shared layer's (`src/sim/progress/`).
 */

export type Flag = 'skippedPart1'
export const SCHEMA: ProgressSchema<UnitId, Flag> = { unitIds: UNIT_IDS, flags: ['skippedPart1'] }

export type SavedState = SavedStateOf<UnitId, Flag>

export function newState(seed: number): SavedState {
  return newStateOf(seed, SCHEMA)
}

export function isSavedState(x: unknown): x is SavedState {
  return isSavedStateOf(x, SCHEMA)
}

export { STATE_VERSION, MAX_STATE_BYTES, MAX_STRING_LENGTH, type UnitRecord, type UnitStatus } from '../../progress/state'
