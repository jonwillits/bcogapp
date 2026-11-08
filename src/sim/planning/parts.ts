/**
 * The parts and the units of Lab 12 (spec §4.1). A **unit** is the smallest
 * piece of an experiment that must be done in one sitting. A completed unit
 * is saved and never redone. An interrupted one restarts as the spec's table
 * says: the gambles and the delays resume with the remaining items (a
 * titration restarts its own series); each dispenser block and each puzzle
 * restarts from the start, and the restart is noted on the results screen;
 * the trees resume with the remaining trees drawn from the reserve pool;
 * each of Part 3's two driven days restarts from dawn. Explorations (Part 1
 * Step 4, Part 2 Step 2, Part 3 Steps 2 to 4, all of Part 4) have no units.
 * **Every part and every step is independently accessible** (decision 7):
 * there are no locks.
 */

export type Part = 0 | 1 | 2 | 3 | 4

export type UnitId = 'p1-gambles' | 'p1-delays' | 'p1-dispenser-0' | 'p1-dispenser-1' | 'p2-tower-3' | 'p2-tower-4' | 'p2-trees' | 'p3-day-1' | 'p3-day-2'

export const UNIT_IDS: UnitId[] = ['p1-gambles', 'p1-delays', 'p1-dispenser-0', 'p1-dispenser-1', 'p2-tower-3', 'p2-tower-4', 'p2-trees', 'p3-day-1', 'p3-day-2']

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
 * How many sets of materials each unit has. Every unit here has one: the
 * gambles' reserve framing problem and anchoring question are chosen inside
 * the unit from what the interrupted sitting had already shown (spec §5.2),
 * and the trees' reserve pool is drawn inside the unit (§6.4).
 */
export function reservesFor(_unit: UnitId): number {
  return 1
}

/** An interrupted unit that resumes keeps the responses already made and goes on from where the student stopped. */
export function resumes(unit: UnitId): boolean {
  return unit === 'p1-gambles' || unit === 'p1-delays' || unit === 'p2-trees'
}

export const PART_NAMES: Record<Part, string> = { 0: 'Part 0', 1: 'Part 1', 2: 'Part 2', 3: 'Part 3', 4: 'Part 4' }
