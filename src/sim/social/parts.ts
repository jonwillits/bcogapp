/**
 * The parts and the units of Lab 11 (spec §4.1). A **unit** is the smallest
 * piece of an experiment that must be done in one sitting. A completed unit
 * is saved and never redone; an interrupted one is discarded on return and
 * run again as the spec's table says: a match with the same partner from
 * round 1 with a new length drawn; the diagnosis with the same list,
 * unanswered; the three films again; the paths with the remaining paths
 * drawn from the reserve pool; each of Part 5's two rounds with the reserve
 * version of its family (PART5_REDESIGN_2026-11-04.md §5). Parts 2 and 4
 * are explorations and have no units. Part 6 was removed on 2026-11-04;
 * its number stays in the type so that its unreachable code compiles.
 *
 * Shared by the saved-progress layer (`progress/`), the materials of each
 * part, and the scene.
 */

export type Part = 0 | 1 | 2 | 3 | 4 | 5 | 6

export const PART1_PARTNERS = 6

export type UnitId =
  | `p1-match-${number}` // each partner's match, 0 to 5, in the seed's order
  | 'p1-diagnosis'
  | 'p3-films'
  | 'p3-paths'
  | 'p5-round1'
  | 'p5-round2'

export const UNIT_IDS: UnitId[] = [...Array.from({ length: PART1_PARTNERS }, (_, i) => `p1-match-${i}` as const), 'p1-diagnosis', 'p3-films', 'p3-paths', 'p5-round1', 'p5-round2']

export const unitOfMatch = (i: number): UnitId => `p1-match-${i}` as UnitId

export function partOf(unit: UnitId): Part {
  if (unit.startsWith('p1')) return 1
  if (unit.startsWith('p3')) return 3
  return 5
}

/** The units a part must have completed before it counts as finished; an exploration has none. */
export function unitsOfPart(part: Part): UnitId[] {
  return UNIT_IDS.filter((u) => partOf(u) === part)
}

/**
 * How many sets of materials each unit has: the first is the one meant for
 * it, the rest are reserves for a restart (spec §4.1). A match, the
 * diagnosis and the films have no reserve: they run again with the same
 * partner, the same list, the same films, and the restart is flagged on the
 * results screen. The paths resume (`resumes`), drawing the remaining paths
 * from the reserve pool. Each of Part 5's rounds has a reserve version.
 */
export function reservesFor(unit: UnitId): number {
  if (unit === 'p5-round1' || unit === 'p5-round2') return 2
  return 1
}

/** An interrupted paths unit resumes with the judgments already made, and the remaining paths come from the reserve pool. */
export function resumes(unit: UnitId): boolean {
  return unit === 'p3-paths'
}
