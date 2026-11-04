import { partOf, reservesFor, unitsOfPart, type Part, type UnitId } from '../parts'
import { BROWSER_STORAGE, type RawStorage } from './storage'
import { SCHEMA, type Flag, type SavedState } from './state'
import { ProgressStore as GenericProgressStore, type InterruptedUnit as GenericInterruptedUnit, type ProgressSpec } from '../../progress/store'

/**
 * Lab 10's saved progress (spec §4.2–§4.4): the shared layer in
 * `src/sim/progress/` configured with Lab 10's units, reserves, flag and
 * locks. Since 2026-11-01 the mechanics (one state saved whole, the fallback
 * to memory, interrupted units discarded and restarted on their reserves,
 * the recognition test resuming) live there; what is Lab 10's is here.
 *
 * **Locks.** Parts 2 and 3 open once Part 1 is finished; Part 5 once Part 4
 * is, or through *Use a sample set of nights*. Parts 0, 1 and 4 are always
 * open.
 */

export type InterruptedUnit = GenericInterruptedUnit<UnitId>

function specFor(storage: RawStorage): ProgressSpec<UnitId, Part, Flag> {
  return {
    schema: SCHEMA,
    storage,
    reservesFor,
    resumes: (unit) => unit === 'p1-recognition',
    partOf,
    unitsOfPart: (part) => (part === 0 || part === 5 ? [] : unitsOfPart(part)),
    canOpen: (part, state) => {
      const finished = (p: Part) => unitsOfPart(p).every((u) => state.units[u].status === 'complete')
      switch (part) {
        case 2:
        case 3:
          return finished(1)
        case 5:
          return finished(4) || state.sampleNights
        default:
          return true
      }
    },
    lockReason: (part) => (part === 5 ? 'Opens once Part 4 is finished, or with a sample set of nights.' : 'Opens once Part 1 is finished.'),
  }
}

export class ProgressStore extends GenericProgressStore<UnitId, Part, Flag> {
  constructor(storage: RawStorage = BROWSER_STORAGE, seed?: number) {
    super(specFor(storage), seed)
  }

  declare state: SavedState

  useSampleNights(): void {
    this.setFlag('sampleNights', true)
  }

  /** Which part a unit belongs to, for the panels. */
  static partOf(unit: UnitId): Part {
    return partOf(unit)
  }
}
