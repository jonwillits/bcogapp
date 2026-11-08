import { makeRng } from '../random'

/**
 * A simulated class (spec §4.3, as Lab 11 built it; §11, item 13): Part 1's
 * reveals show a cloud of about 40 simulated students with the student's own
 * result as one marked point. **Every parameter of a cloud comes from an
 * entry here that names its source, the table or figure, and the page.**
 * Where a source gives a share but no spread between people, the cloud is a
 * draw of each simulated student's choice from the published share; where a
 * source gives a median and no spread, or no source is in the library, the
 * entry's `source` is null, the panel shows *Simulated class pending* and no
 * cloud, and the walk-through lists it. Nothing is filled in to make a cloud
 * appear; no parameter here was typed from memory.
 *
 * Each entry also has a slot for this term's real class: rows with no names
 * or identifiers, added later by Jon and shipped with the app. When present,
 * the panel shows the real class instead of the simulation, labeled as this
 * term's, with a toggle back. The app collects nothing.
 *
 * State at the build, 2026-11-08: the four reflection pairs and the framing
 * problem have sources with published shares (a share is a spread between
 * people: each simulated student chooses the sure option with that
 * probability); the anchor (medians only), the loss ratio (Tversky and
 * Kahneman 1992 not in the library) and the discounting rate k (no source
 * with a spread in students in the library) are pending.
 */

export interface ClassSource {
  /** The citation. */
  source: string
  /** The table or figure, and the page. */
  where: string
  /** For a binary measure: the published share choosing the option the measure counts; for a continuous measure: the mean and the spread between people. */
  share?: number
  mean?: number
  sd?: number
  /** The sample size the share or mean rests on. */
  n: number
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
export const CLASS_SEED = 0x12c1a5

const KT = 'Kahneman and Tversky (1979), Prospect theory: An analysis of decision under risk, Econometrica 47, 263–291'
const TK81 = 'Tversky and Kahneman (1981), The framing of decisions and the psychology of choice, Science 211, 453–458'
const DRAW_SHARE = 'Each simulated student chooses the sure option with the published probability, independently of the other items.'
const DIFFERED_KT = 'Their respondents were students and university faculty answering booklets in Israeli pounds, with a median monthly family income of about 3,000; the amounts here are the same numbers in dollars, in a lab, on a screen.'

export const CLASS_ENTRIES: ClassEntry[] = [
  {
    id: 'pair1',
    panel: 'Part 1, Step 1: pair 1, a sure 3,000 against an 80% chance of 4,000, in gains and in losses',
    measures: ['chose the sure option in the gain version', 'chose the sure option in the loss version'],
    sources: [
      { source: KT, where: 'Table I, Problem 3, p. 268 (N = 95)', share: 0.8, n: 95, differed: DIFFERED_KT, draw: DRAW_SHARE },
      { source: KT, where: 'Table I, Problem 3′, p. 268 (N = 95)', share: 0.08, n: 95, differed: DIFFERED_KT, draw: DRAW_SHARE },
    ],
    real: null,
  },
  {
    id: 'pair2',
    panel: 'Part 1, Step 1: pair 2, a sure $240 against a 25% chance of $1,000, and a sure loss of $750 against a 75% chance of losing $1,000',
    measures: ['chose the sure option in the gain version', 'chose the sure option in the loss version'],
    sources: [
      { source: TK81, where: 'Problem 3, p. 454 (N = 150)', share: 0.84, n: 150, differed: 'Their respondents were students in classrooms choosing the two decisions together; here the two are separated by other items.', draw: DRAW_SHARE },
      { source: TK81, where: 'Problem 3, p. 454 (N = 150)', share: 0.13, n: 150, differed: 'Their respondents were students in classrooms choosing the two decisions together; here the two are separated by other items.', draw: DRAW_SHARE },
    ],
    real: null,
  },
  {
    id: 'pair3',
    panel: 'Part 1, Step 1: pair 3, a 90% chance of 3,000 against a 45% chance of 6,000, in gains and in losses',
    measures: ['chose the more probable option in the gain version', 'chose the more probable option in the loss version'],
    sources: [
      { source: KT, where: 'Table I, Problem 7, p. 268 (N = 66)', share: 0.86, n: 66, differed: DIFFERED_KT, draw: 'Each simulated student chooses the more probable option with the published probability, independently of the other items.' },
      { source: KT, where: 'Table I, Problem 7′, p. 268 (N = 66)', share: 0.08, n: 66, differed: DIFFERED_KT, draw: 'Each simulated student chooses the more probable option with the published probability, independently of the other items.' },
    ],
    real: null,
  },
  {
    id: 'pair4',
    panel: 'Part 1, Step 1: pair 4, a 0.2% chance of 3,000 against a 0.1% chance of 6,000, in gains and in losses',
    measures: ['chose the more probable option in the gain version', 'chose the more probable option in the loss version'],
    sources: [
      { source: KT, where: 'Table I, Problem 8, p. 268 (N = 66)', share: 0.27, n: 66, differed: DIFFERED_KT, draw: 'Each simulated student chooses the more probable option with the published probability, independently of the other items.' },
      { source: KT, where: 'Table I, Problem 8′, p. 268 (N = 66)', share: 0.7, n: 66, differed: DIFFERED_KT, draw: 'Each simulated student chooses the more probable option with the published probability, independently of the other items.' },
    ],
    real: null,
  },
  {
    id: 'framing',
    panel: 'Part 1, Step 1: the framing problem, by version',
    measures: ['chose the certain program when the outcomes were described as lives saved', 'chose the certain program when the outcomes were described as deaths'],
    sources: [
      { source: TK81, where: 'Problem 1, p. 453 (N = 152)', share: 0.72, n: 152, differed: 'Their respondents were students in classrooms; the disease was given a place name there, and none here (as in the reading).', draw: 'Each simulated student in the lives-saved version chooses the certain program with the published probability.' },
      { source: TK81, where: 'Problem 2, p. 453 (N = 155)', share: 0.22, n: 155, differed: 'Their respondents were students in classrooms; the disease was given a place name there, and none here (as in the reading).', draw: 'Each simulated student in the deaths version chooses the certain program with the published probability.' },
    ],
    real: null,
  },
  {
    id: 'anchor',
    panel: 'Part 1, Step 1: the estimate after the wheel, by anchor',
    measures: ['estimate after the wheel stopped at 10', 'estimate after the wheel stopped at 65'],
    // Tversky and Kahneman (1974, p. 1128) report the medians, 25 and 45, and no spread between people.
    sources: [null, null],
    real: null,
  },
  {
    id: 'lossRatio',
    panel: 'Part 1, Step 1: the loss ratio',
    measures: ['the point of indifference divided by $50'],
    // Tversky and Kahneman (1992) is to be requested (spec §9); Huys et al.'s 1.4 is a fitted parameter of a different task, with no per-person spread reported in the summary.
    sources: [null],
    real: null,
  },
  {
    id: 'discountK',
    panel: 'Part 1, Step 2: the hyperbolic rate k',
    measures: ['k, per day'],
    // A source with the spread of k among college students is to be requested (spec §9).
    sources: [null],
    real: null,
  },
]

export const classEntry = (id: string): ClassEntry => {
  const e = CLASS_ENTRIES.find((x) => x.id === id)
  if (!e) throw new Error(`no class entry ${id}`)
  return e
}

export type Cloud = { kind: 'simulated'; points: number[][]; sources: ClassSource[] } | { kind: 'real'; points: number[][] } | { kind: 'pending' }

/** The cloud for an entry: this term's class if present, else the simulation if every measure has a source, else pending. A share draws a 0 or 1 per student; a mean and sd draw a normal value. */
export function cloudFor(entry: ClassEntry, preferReal = true): Cloud {
  if (preferReal && entry.real && entry.real.length > 0) return { kind: 'real', points: entry.real.map((r) => r.values) }
  if (entry.sources.some((s) => s === null)) return { kind: 'pending' }
  const sources = entry.sources as ClassSource[]
  let h = 0
  for (const c of entry.id) h = (h * 31 + c.charCodeAt(0)) >>> 0
  const rng = makeRng(CLASS_SEED ^ h)
  const points: number[][] = []
  for (let i = 0; i < SIMULATED_STUDENTS; i++) points.push(sources.map((s) => (s.share !== undefined ? (rng.next() < s.share ? 1 : 0) : (s.mean ?? 0) + (s.sd ?? 0) * rng.normal())))
  return { kind: 'simulated', points, sources }
}

export const PENDING_CLASS_LINE = 'Simulated class pending: a simulated class appears here once its source is added to the course library.'
export const SIMULATED_CLASS_LINE = 'These students are simulated from a named published study; they are not this class.'
export const REAL_CLASS_LINE = 'These are this term’s results, without names.'
export const PENDING_REFERENCE_LINE = 'Reference pending: the value appears here once its source is added to the course library.'
