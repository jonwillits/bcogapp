import { UNIT_IDS, partOf, reservesFor, resumes, unitsOfPart, type Part, type UnitId } from '../parts'
import { BROWSER_STORAGE, type RawStorage } from './storage'
import { newUnitRecord } from '../../progress/state'
import { SCHEMA, type Flag, type SavedState } from './state'
import { ProgressStore as GenericProgressStore, type InterruptedUnit as GenericInterruptedUnit, type ProgressSpec } from '../../progress/store'

/**
 * Lab 11's saved progress (spec §4): the shared layer in `src/sim/progress/`
 * configured with Lab 11's units, reserves, flag and locks.
 *
 * **Locks (§4.2).** Part 2 opens once Part 1's diagnosis is committed, since
 * Part 2 names the six rules; a student whose Part 1 is lost can open Part 2
 * with *Skip Part 1*, after which Part 1 stays locked for that seed. Parts
 * 0, 3, 4 and 5 are always open, in any order.
 *
 * **Migration (2026-11-04).** Part 5 was rebuilt with two units in place of
 * `p5-sets`, and Part 6 was removed. A state saved before that is read
 * with the old unit dropped and the new units added as not started, so
 * that Parts 1 to 4 keep their progress and the new Part 5 starts fresh.
 */

const RETIRED_UNITS = ['p5-sets']

/** Reads through a migration of a state saved under the old unit list; writes untouched. */
export function migrating(storage: RawStorage): RawStorage {
  return {
    read: () => {
      const raw = storage.read()
      if (raw === null || raw === '') return raw
      try {
        const x = JSON.parse(raw) as { units?: Record<string, unknown> }
        if (!x || typeof x !== 'object' || !x.units || typeof x.units !== 'object') return raw
        let changed = false
        for (const u of RETIRED_UNITS) {
          if (u in x.units) {
            delete x.units[u]
            changed = true
          }
        }
        for (const u of UNIT_IDS) {
          if (!(u in x.units)) {
            x.units[u] = newUnitRecord()
            changed = true
          }
        }
        return changed ? JSON.stringify(x) : raw
      } catch {
        return raw
      }
    },
    write: (text) => storage.write(text),
  }
}

export type InterruptedUnit = GenericInterruptedUnit<UnitId>

export const PART2_LOCK_LINE = 'Opens once Part 1’s diagnosis is committed, or with “Skip Part 1”.'
export const PART1_SKIPPED_LINE = 'Part 1 was skipped for this seed, and stays closed. “Clear my saved results” on the Open tab draws a new seed.'

export function specFor(storage: RawStorage): ProgressSpec<UnitId, Part, Flag> {
  return {
    schema: SCHEMA,
    storage: migrating(storage),
    reservesFor,
    resumes,
    partOf,
    unitsOfPart,
    canOpen: (part, state) => {
      switch (part) {
        case 1:
          return !state.skippedPart1
        case 2:
          return state.units['p1-diagnosis'].status === 'complete' || state.skippedPart1
        default:
          return true
      }
    },
    lockReason: (part) => (part === 1 ? PART1_SKIPPED_LINE : PART2_LOCK_LINE),
  }
}

export class ProgressStore extends GenericProgressStore<UnitId, Part, Flag> {
  constructor(storage: RawStorage = BROWSER_STORAGE, seed?: number) {
    super(specFor(storage), seed)
  }

  declare state: SavedState

  /** Skip Part 1: Part 2 opens, and Part 1 stays locked for this seed. */
  skipPart1(): void {
    this.setFlag('skippedPart1', true)
  }

  get part1Skipped(): boolean {
    return this.state.skippedPart1
  }
}
