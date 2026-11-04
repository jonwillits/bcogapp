import { UNIT_IDS, type UnitId } from '../parts'
import {
  byteLength,
  isSavedState as isSavedStateOf,
  MAX_STATE_BYTES,
  MAX_STRING_LENGTH,
  newState as newStateOf,
  newUnitRecord,
  STATE_VERSION,
  type ProgressSchema,
  type SavedState as SavedStateOf,
  type UnitRecord,
  type UnitStatus,
} from '../../progress/state'

/**
 * What Lab 10 saves (spec §4.2): the seed, which units are complete, every
 * response the student made and every result computed from it (inside each
 * unit's `result`, which is the part's own object and opaque here), every
 * committed prediction, and the one flag, `sampleNights`. Version 1.
 *
 * Since 2026-11-01 the shape and its check live in `src/sim/progress/`,
 * shared with Lab 11; this file configures that layer with Lab 10's units
 * and flag, so a state saved before then still passes unchanged.
 */

export { STATE_VERSION, MAX_STATE_BYTES, MAX_STRING_LENGTH, newUnitRecord, byteLength }
export type { UnitRecord, UnitStatus }

export type Flag = 'sampleNights'
export const SCHEMA: ProgressSchema<UnitId, Flag> = { unitIds: UNIT_IDS, flags: ['sampleNights'] }

export type SavedState = SavedStateOf<UnitId, Flag>

export function newState(seed: number): SavedState {
  return newStateOf(seed, SCHEMA)
}

/** The schema check: version, seed, every unit a known one with a well-typed record, predictions strings, nothing executable, nothing oversized. */
export function isSavedState(x: unknown): x is SavedState {
  return isSavedStateOf(x, SCHEMA)
}
