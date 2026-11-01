import { makeRng } from '../random'

/**
 * A simulated class (spec §4.3, decision 14; §13, item 13): Parts 3 and 5
 * show a cloud of about 40 simulated students with the student's own
 * result as one marked point. **Every parameter of a cloud comes from an
 * entry here that names its source, the table or figure, and the page.**
 * Where a source gives a mean but no spread between people, or no source
 * has been found, the entry's `source` is null, the panel shows
 * *Simulated class pending* and no cloud, and the walk-through lists it.
 * Nothing is filled in to make a cloud appear; no parameter here was typed
 * from memory, chosen to look plausible, or borrowed from a measure of a
 * different kind.
 *
 * Each entry also has a slot for this term's real class: rows with no
 * names or identifiers, added later by Jon and shipped with the app. When
 * present, the panel shows the real class instead of the simulation,
 * labeled as this term's, with a toggle back. The app collects nothing.
 *
 * State at the build, 2026-11-01: every entry is pending. Heider and
 * Simmel (1944) report percentages of descriptions, not ratings (heider_1944,
 * pp. 248–252); Baker, Saxe and Tenenbaum (2009) report correlations with
 * the group mean and no per-participant spread (baker_2009, Table 1, p. 338);
 * Tajfel and Wilkes (1963) is not in the library (spec §11, to request).
 */

export interface ClassSource {
  /** The citation. */
  source: string
  /** The table or figure, and the page. */
  where: string
  /** The group mean and the spread between people, in the measure's units. */
  mean: number
  sd: number
  /** How the lab's procedure differs from the source's. */
  differed: string
  /** How a simulated student is drawn from the numbers. */
  draw: string
}

export interface RealRow {
  /** The measure's values for one student, in the order `measures` lists them. No names, no identifiers. */
  values: number[]
}

export interface ClassEntry {
  id: string
  /** The part and panel it belongs to. */
  panel: string
  /** The measures the cloud plots, in order: one or two. */
  measures: string[]
  /** One source per measure, or null while pending. */
  sources: (ClassSource | null)[]
  /** This term's real class, when Jon adds it; null until then. */
  real: RealRow[] | null
}

export const SIMULATED_STUDENTS = 40
export const CLASS_SEED = 0x51a55

export const CLASS_ENTRIES: ClassEntry[] = [
  {
    id: 'films',
    panel: 'Part 3, Step 1: ratings of the three films',
    measures: ['rating of the control film, 1 to 7', 'rating of the forward film, 1 to 7', 'rating of the reversed film, 1 to 7'],
    sources: [null, null, null],
    real: null,
  },
  {
    id: 'paths',
    panel: 'Part 3, Step 2: correlation with each model',
    measures: ['correlation with inverse planning', 'correlation with the “last moved toward” rule'],
    sources: [null, null],
    real: null,
  },
  {
    id: 'groups-boundary',
    panel: 'Part 5: the difference at the boundary, labeled against unlabeled',
    measures: ['labeled set: judged boundary difference as a share of the true one', 'unlabeled set: the same'],
    sources: [null, null],
    real: null,
  },
  {
    id: 'groups-spread',
    panel: 'Part 5: the spread within groups, labeled against unlabeled',
    measures: ['labeled set: judged spread within groups as a share of the true one', 'unlabeled set: the same'],
    sources: [null, null],
    real: null,
  },
]

export const classEntry = (id: string): ClassEntry => CLASS_ENTRIES.find((e) => e.id === id)!

export type Cloud = { kind: 'simulated'; points: number[][]; sources: ClassSource[] } | { kind: 'real'; points: number[][] } | { kind: 'pending' }

/** The cloud for an entry: this term's class if present, else the simulation if every measure has a source, else pending. */
export function cloudFor(entry: ClassEntry, preferReal = true): Cloud {
  if (preferReal && entry.real && entry.real.length > 0) return { kind: 'real', points: entry.real.map((r) => r.values) }
  if (entry.sources.some((s) => s === null)) return { kind: 'pending' }
  const sources = entry.sources as ClassSource[]
  const rng = makeRng(CLASS_SEED ^ entry.id.length)
  const points: number[][] = []
  for (let i = 0; i < SIMULATED_STUDENTS; i++) points.push(sources.map((s) => s.mean + s.sd * rng.normal()))
  return { kind: 'simulated', points, sources }
}

export const PENDING_CLASS_LINE = 'Simulated class pending: a simulated class appears here once its source is added to the course library.'
export const SIMULATED_CLASS_LINE = 'These students are simulated from a named published study; they are not this class.'
export const REAL_CLASS_LINE = 'These are this term’s results, without names.'
export const ONE_PERSON_LINE = 'One person’s judgments are noisy, and a group shows what one person cannot.'
