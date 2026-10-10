/**
 * Trial lists for the three student tests, each drawn from the run seed so
 * the same seed gives the same trials, and the bookkeeping of one test:
 * answers, the commit, and the log of glimpse durations.
 *
 * Commit-then-reveal is the rule everywhere a student is tested: a network's
 * answer for a trial set is not computed, held or rendered until the student
 * has committed. The tabs enforce it; `reveal.test.tsx` checks the markup.
 */
import type { Rng } from '../random'
import type { EraserKind } from './erasers'
import type { NoiseKind } from './noise'
import { shuffle } from './views'
import { PART2_TRIALS, PART4_PER_CONDITION } from './config'

export interface DisplayDrawing {
  id: string
  category: string
  label: number
  key: string
  strokes: [number[], number[]][]
  joints: [number, number, string][]
}

export interface PartsTrial {
  index: number
  drawing: DisplayDrawing
  eraser: EraserKind
}

/** Twelve display drawings of twelve different categories, six per eraser, in a seeded order. */
export function partsTrials(display: DisplayDrawing[], rng: Rng): PartsTrial[] {
  const byCategory = new Map<string, DisplayDrawing[]>()
  for (const d of display) byCategory.set(d.category, [...(byCategory.get(d.category) ?? []), d])
  const categories = shuffle([...byCategory.keys()], rng).slice(0, PART2_TRIALS)
  const chosen = categories.map((c) => { const ds = byCategory.get(c)!; return ds[rng.int(ds.length)] })
  const erasers: EraserKind[] = shuffle(chosen.map((_, i) => (i < PART2_TRIALS / 2 ? 'mid' : 'joints')), rng)
  return chosen.map((drawing, index) => ({ index, drawing, eraser: erasers[index] }))
}

export interface PhotoItem {
  file: string
  category: string
  label: number
  author: string
  title: string
  page: string
  license: string
}

export interface NoiseTrial {
  index: number
  photo: PhotoItem
  condition: NoiseKind
}

/** Thirty-six photographs, twelve per condition, no photograph twice, in a seeded order. */
export function noiseTrials(photos: PhotoItem[], rng: Rng): NoiseTrial[] {
  const pool = shuffle(photos, rng).slice(0, 3 * PART4_PER_CONDITION)
  const conditions: NoiseKind[] = shuffle(pool.map((_, i) => (['clean', 'A', 'B'] as NoiseKind[])[Math.floor(i / PART4_PER_CONDITION)]), rng)
  return pool.map((photo, index) => ({ index, photo, condition: conditions[index] }))
}

/** One glimpse trial's measured presentation, milliseconds, from the frame the image appeared to the frame the mask replaced it. */
export interface GlimpseRecord {
  trial: number
  shownMs: number
}

export interface TestState<A> {
  answers: (A | null)[]
  committed: boolean
  glimpses: GlimpseRecord[]
}

export function newTest<A>(n: number): TestState<A> {
  return { answers: new Array<A | null>(n).fill(null), committed: false, glimpses: [] }
}

export function allAnswered<A>(t: TestState<A>): boolean {
  return t.answers.every((a) => a !== null)
}

/** The mean and range of the durations actually shown, for the walk-through. */
export function glimpseSummary(records: GlimpseRecord[]): { n: number; mean: number; min: number; max: number } | null {
  if (!records.length) return null
  const v = records.map((r) => r.shownMs)
  return { n: v.length, mean: v.reduce((a, b) => a + b, 0) / v.length, min: Math.min(...v), max: Math.max(...v) }
}
