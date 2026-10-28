/**
 * The parts and the units of Lab 10 (spec §4.3). A **unit** is the smallest
 * piece of an experiment that must be done in one sitting. A completed unit
 * is saved and never redone; an interrupted one is discarded on return and
 * run again with reserve materials, so that a student is never retested on
 * materials they have already seen. Part 5 is an exploration and has no
 * units.
 *
 * Shared by the saved-progress layer (`progress/`), the materials of Parts
 * 1 and 2 (`words/`), the logs of Part 4 (`logs/`), and the scene.
 */

export type Part = 0 | 1 | 2 | 3 | 4 | 5

/** Part 1 has seven study lists (Jon, 2026-10-25: three lists of associates; 2026-10-26: among four unrelated lists, the list-length condition cut) and one recognition test. */
export const PART1_LISTS = 7

export type UnitId =
  | `p1-list-${number}` // each study list and its recall, 0 to 6
  | 'p1-recognition'
  | 'p2-first'
  | 'p2-second'
  | 'p3-room'
  | 'p4-practice'
  | 'p4-week'

export const UNIT_IDS: UnitId[] = [
  ...Array.from({ length: PART1_LISTS }, (_, i) => `p1-list-${i}` as const),
  'p1-recognition',
  'p2-first',
  'p2-second',
  'p3-room',
  'p4-practice',
  'p4-week',
]

export function partOf(unit: UnitId): Part {
  if (unit.startsWith('p1')) return 1
  if (unit.startsWith('p2')) return 2
  if (unit.startsWith('p3')) return 3
  return 4
}

/** The units a part must have completed before it counts as finished. */
export function unitsOfPart(part: Part): UnitId[] {
  return UNIT_IDS.filter((u) => partOf(u) === part)
}

/**
 * How many sets of materials each unit has: the first is the one meant for
 * it, the rest are reserves for a restart (spec §4.3). A Part 1 list of
 * associates has no reserve of its own kind; an interrupted one continues
 * with an unrelated reserve list, which `words/` arranges.
 */
export function reservesFor(unit: UnitId): number {
  if (unit.startsWith('p1-list')) return 3 // the list, then two unrelated reserves
  if (unit === 'p1-recognition') return 1 // the same test resumes, minus the items answered
  if (unit.startsWith('p2')) return 2 // the set, then the third set
  if (unit === 'p3-room') return 2 // the arrangement, then the other arrangement
  if (unit === 'p4-practice') return 1 // the practice night again
  return 1 // the week again in the same clearing, from night 1 with every log full (2026-10-28)
}
