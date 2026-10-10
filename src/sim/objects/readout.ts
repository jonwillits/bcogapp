/**
 * Part 3's readout: Lab 7's output unit, learning by Lab 5's Prediction
 * rule, with the frozen Standard network's penultimate layer as its inputs.
 *
 *   Δbᵢ = η · xᵢ · Φ,  Φ = a − p,  the prediction p held from before the
 *   outcome a arrives (1 for the target shoe, 0 for another object).
 *
 * Every Φ comes from `thirdFactor('prediction', …)` and every weight write
 * goes through `learnWeights`; `oneWriter`-style tests in this folder hold
 * this file to that. The unit's threshold is the criterion (*same shoe* at
 * or above it) and learning never writes it. In Lab 7 the inputs were two
 * receptors; here they are 1,024 numbers a deep network produced. The unit
 * is otherwise the same.
 */
import type { RateUnit } from '../bilaterian/unit'

/** The readout is a RateUnit: Lab 4's unit, Lab 7's output. */
export type Readout = RateUnit
import { learnWeights, thirdFactor, weightChange, type ConnectionLimits } from '../bilaterian/learning/rule'
import { predictionOf } from '../fish/brain'
import type { Rng } from '../random'

/** The number of inputs: the Standard network's penultimate layer. */
export const READOUT_INPUTS = 1024
/** Starting weights are small and not all alike, as under Lab 7's *Pass the error back*. */
export const START_WEIGHT_SPREAD = 0.05
/** Weight limits: wide, since 1,024 small inputs sum. */
export const READOUT_WEIGHT_RANGE = { min: -6, max: 6 } as const
export const READOUT_BASELINE_RANGE = { min: -6, max: 6 } as const
/** η, as the Learning panel offers it. Measured: 0.05 reaches the training target within a few hundred steps. */
export const READOUT_RATE_RANGE = { min: 0.001, max: 0.5 } as const
export const DEFAULT_READOUT_RATE = 0.05
/** The inputs are scaled so a typical penultimate activity has unit spread; measured over the scanned set. */
export const INPUT_SCALE = 1.0

const LIMITS: readonly ConnectionLimits[] = Array.from({ length: READOUT_INPUTS }, () => ({ plastic: true, min: READOUT_WEIGHT_RANGE.min, max: READOUT_WEIGHT_RANGE.max }))

export function makeReadout(rng: Rng): RateUnit {
  return {
    baseline: 0,
    threshold: 0,
    weights: Array.from({ length: READOUT_INPUTS }, () => rng.range(-START_WEIGHT_SPREAD, START_WEIGHT_SPREAD)),
  }
}

/** The evidence: b₀ + Σ bᵢxᵢ. The criterion (the threshold) is not in it. */
export function readoutEvidence(u: RateUnit, x: Float32Array): number {
  let e = u.baseline
  const w = u.weights
  for (let i = 0; i < w.length; i++) e += w[i] * x[i] * INPUT_SCALE
  return e
}

export interface ReadoutStep {
  evidence: number
  prediction: number
  phi: number
}

/**
 * One learning step on one image: predict, then the outcome arrives, then
 * every weight changes by η · xᵢ · Φ. Returns what the arithmetic panel prints.
 */
export function readoutLearn(u: RateUnit, x: Float32Array, outcome: 0 | 1, rate: number): ReadoutStep {
  const evidence = readoutEvidence(u, x)
  const prediction = predictionOf(evidence)
  const phi = thirdFactor('prediction', {
    output: prediction,
    weakening: false,
    usualOutput: 0,
    arriving: outcome,
    heldPrediction: prediction,
    target: null,
    broadcast: 0,
  })
  const changes = new Array<number>(u.weights.length)
  for (let i = 0; i < changes.length; i++) changes[i] = weightChange(rate, x[i] * INPUT_SCALE, phi)
  learnWeights(u, changes, LIMITS, false, { change: weightChange(rate, 1, phi), min: READOUT_BASELINE_RANGE.min, max: READOUT_BASELINE_RANGE.max })
  return { evidence, prediction, phi }
}

/** *Same shoe* when the evidence is at or above the criterion. */
export function readoutSays(u: RateUnit, x: Float32Array): boolean {
  return readoutEvidence(u, x) >= u.threshold
}
