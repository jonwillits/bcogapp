import { makeRng } from '../../random'
import type { Design } from './design'
import { keyMeasure, share, type KeyMeasure } from './keyMeasure'
import { makeGuessCheck, guessCheckChoose } from './models/guessCheck'
import { makeTally, tallyChoose } from './models/tally'

/**
 * Running and fitting the two models on a student's own trials (spec §7.3):
 * each model's one parameter is fitted to the student's overall accuracy
 * over occurrences 2 to 5, by a grid search over the parameter with RUNS
 * seeded runs at each value, choosing the value whose mean accuracy is
 * nearest the student's. The models are then compared on the key measure,
 * which neither was fitted to. Each model runs RUNS times on the student's
 * trials at its parameter, and the panel shows each cell's mean and 90%
 * range.
 */
export const RUNS = 200
export type ModelId = 'guessCheck' | 'tally'
export const ALPHA_GRID = Array.from({ length: 41 }, (_, i) => i / 40)
export const BETA_GRID = Array.from({ length: 41 }, (_, i) => i * 0.25)

export function runModel(model: ModelId, param: number, d: Design, seed: number): number[] {
  const rng = makeRng(seed)
  const n = d.pairing.length
  if (model === 'guessCheck') {
    const m = makeGuessCheck(param, n)
    return d.learning.map((t) => guessCheckChoose(m, t, rng))
  }
  const m = makeTally(param, n, n)
  return d.learning.map((t) => tallyChoose(m, t, rng))
}

export interface ModelRuns {
  model: ModelId
  param: number
  measures: KeyMeasure[]
  /** The mean and the 5th and 95th percentiles over runs, for each cell. */
  afterRight: { mean: number; lo: number; hi: number }
  afterWrong: { mean: number; lo: number; hi: number }
  accuracy: { mean: number; lo: number; hi: number }
}

function summary(xs: number[]) {
  const s = xs.filter((x) => !Number.isNaN(x)).sort((a, b) => a - b)
  const q = (p: number) => s[Math.min(s.length - 1, Math.floor(p * (s.length - 1)))]
  return { mean: s.reduce((a, b) => a + b, 0) / s.length, lo: q(0.05), hi: q(0.95) }
}

export function runs(model: ModelId, param: number, d: Design, seed: number, n = RUNS): ModelRuns {
  const measures: KeyMeasure[] = []
  for (let k = 0; k < n; k++) measures.push(keyMeasure(d, runModel(model, param, d, seed + k * 7919 + 1)))
  return { model, param, measures, afterRight: summary(measures.map((m) => share(m.afterRight))), afterWrong: summary(measures.map((m) => share(m.afterWrong))), accuracy: summary(measures.map((m) => m.accuracy)) }
}

/** The grid value whose mean accuracy over `n` runs is nearest the target accuracy; ties go to the smaller value. Returns the value and the mean accuracy reached. */
export function fit(model: ModelId, d: Design, targetAccuracy: number, seed: number, n = 50): { param: number; accuracy: number; grid: { param: number; accuracy: number }[] } {
  const grid = (model === 'guessCheck' ? ALPHA_GRID : BETA_GRID).map((param) => {
    let sum = 0
    for (let k = 0; k < n; k++) sum += keyMeasure(d, runModel(model, param, d, seed + k * 104729 + 3)).accuracy
    return { param, accuracy: sum / n }
  })
  let best = grid[0]
  for (const g of grid) if (Math.abs(g.accuracy - targetAccuracy) < Math.abs(best.accuracy - targetAccuracy)) best = g
  return { param: best.param, accuracy: best.accuracy, grid }
}
