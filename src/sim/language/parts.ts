/**
 * The parts and the units of Lab 13 (spec §4.1). A **unit** is the smallest
 * piece of an experiment that must be done in one sitting. A completed unit
 * is saved and never redone. An interrupted one restarts as the spec's
 * table says: Part 1's six spectrograms start again in a new order; each of
 * Part 1, Step 3's two blocks starts again from its start, and the restart
 * is noted on the results screen; Part 2's first minute starts again from
 * its start; Part 2's board goes on from where the student stopped; Part
 * 3's learning trials and test start again on the reserve set of 12 new
 * words and 12 new objects. Explorations (Part 1, Steps 1 and 4; Part 2,
 * Steps 3 and 4; Part 3, Step 3; all of Part 4) have no units. **Every part
 * and every step is independently accessible**: there are no locks.
 */

export type Part = 0 | 1 | 2 | 3 | 4

export type UnitId = 'p1-labels' | 'p1-labeling' | 'p1-abx' | 'p2-minute' | 'p2-board' | 'p3-words'

export const UNIT_IDS: UnitId[] = ['p1-labels', 'p1-labeling', 'p1-abx', 'p2-minute', 'p2-board', 'p3-words']

export function partOf(unit: UnitId): Part {
  if (unit.startsWith('p1')) return 1
  if (unit.startsWith('p2')) return 2
  return 3
}

/** The units a part must have completed before it counts as finished; an exploration has none. */
export function unitsOfPart(part: Part): UnitId[] {
  return UNIT_IDS.filter((u) => partOf(u) === part)
}

/**
 * How many sets of materials each unit has. Part 3's learning trials and
 * test have a reserve set of 12 new words and 12 new objects, used if the
 * first set was interrupted (spec §4.1, §7.1). Every other unit restarts on
 * its own materials: nothing is revealed before its commit, so nothing
 * needs replacing.
 */
export function reservesFor(unit: UnitId): number {
  return unit === 'p3-words' ? 2 : 1
}

/** An interrupted unit that resumes goes on from where the student stopped: only the board (spec §4.1). */
export function resumes(unit: UnitId): boolean {
  return unit === 'p2-board'
}

export const PART_NAMES: Record<Part, string> = { 0: 'Part 0', 1: 'Part 1', 2: 'Part 2', 3: 'Part 3', 4: 'Part 4' }
