import { partOf, reservesFor, resumes, unitsOfPart, type Part, type UnitId } from '../parts'
import { BROWSER_STORAGE, type RawStorage } from './storage'
import { SCHEMA, type Flag, type SavedState } from './state'
import { ProgressStore as GenericProgressStore, type InterruptedUnit as GenericInterruptedUnit, type ProgressSpec } from '../../progress/store'

/**
 * Lab 12's saved progress (spec §4): the shared layer in `src/sim/progress/`
 * configured with Lab 12's units and reserves. **No part is ever locked**
 * (decision 7): every part, and every step within a part, opens at any time,
 * and a reveal waits only on its own experiment's commit.
 */

export type InterruptedUnit = GenericInterruptedUnit<UnitId>

export function specFor(storage: RawStorage): ProgressSpec<UnitId, Part, Flag> {
  return {
    schema: SCHEMA,
    storage,
    reservesFor,
    resumes,
    partOf,
    unitsOfPart,
    canOpen: () => true,
    lockReason: () => '',
  }
}

export class ProgressStore extends GenericProgressStore<UnitId, Part, Flag> {
  constructor(storage: RawStorage = BROWSER_STORAGE, seed?: number) {
    super(specFor(storage), seed)
  }

  declare state: SavedState
}
