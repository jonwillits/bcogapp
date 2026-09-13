/**
 * The rate unit of the chapter's §4.2.3: a weighted sum, a baseline, and an
 * activation function with a floor at zero and a ceiling at one.
 *
 *   y = f(b₀ + Σ bᵢxᵢ − θ)
 *
 * Both the baseline b₀ and the threshold θ are real parameters, and nothing
 * here derives one from the other, because §4.2.5's finding — that raising
 * the threshold and lowering the baseline slide the same line — is a thing
 * a student is asked to discover with two separate sliders.
 *
 * This is the general layer: any number of inputs, any number of units. Lab 4
 * instantiates it at one interneuron; Modules 5 and 7 configure it rather
 * than replace it. **Not** Module 3's Hodgkin–Huxley cell, which answers a
 * question this lab does not ask and would run a membrane inside every unit.
 */

export type Activation = 'threshold' | 'sigmoid'

export const ACTIVATIONS: { value: Activation; label: string }[] = [
  { value: 'threshold', label: 'threshold function (a hard step)' },
  { value: 'sigmoid', label: 'sigmoid function (an S-shaped curve)' },
]

/**
 * How wide the sigmoid's transition is, in units of net input. Narrow enough
 * that the chapter's AND and OR examples produce the same rows as the step,
 * wide enough that the S is visible on the input–output plot.
 */
export const SIGMOID_WIDTH = 0.15

export interface RateUnit {
  /** b₀ — the baseline; Lab 1's actuator bias. */
  baseline: number
  /** bᵢ — one weight per input; Lab 1's connection strengths. */
  weights: number[]
  /** θ — where the activation function turns on. */
  threshold: number
}

/** The bare sum, before the activation function: b₀ + Σ bᵢxᵢ. */
export function netInput(u: RateUnit, x: readonly number[]): number {
  let net = u.baseline
  for (let i = 0; i < u.weights.length; i++) net += u.weights[i] * (x[i] ?? 0)
  return net
}

/** The activation function alone: floor at 0, ceiling at 1. */
export function activate(kind: Activation, net: number, threshold: number): number {
  const drive = net - threshold
  if (kind === 'threshold') return drive >= 0 ? 1 : 0
  return 1 / (1 + Math.exp(-drive / SIGMOID_WIDTH))
}

export function unitOutput(u: RateUnit, x: readonly number[], kind: Activation): number {
  return activate(kind, netInput(u, x), u.threshold)
}

/** One layer: every unit over the same inputs. */
export function layerOutput(units: readonly RateUnit[], x: readonly number[], kind: Activation): number[] {
  return units.map((u) => unitOutput(u, x, kind))
}

/** A unit counts as firing at or above half its ceiling — for the step, exactly when it is on. */
export const FIRING = 0.5

/** The four input combinations, in the order the chapter's table lists them. */
export const TRUTH_ROWS: readonly (readonly [number, number])[] = [
  [0, 0],
  [0, 1],
  [1, 0],
  [1, 1],
]

/** Whether a two-input unit fires on each of the four rows. */
export function truthTableOf(u: RateUnit, kind: Activation): boolean[] {
  return TRUTH_ROWS.map(([a, b]) => unitOutput(u, [a, b], kind) >= FIRING)
}

/**
 * The decision boundary of a two-input unit, as the line x₂ = slope·x₁ + intercept
 * on which the net input equals the threshold. Null when b₂ is zero (the
 * line is vertical, x₁ = (θ − b₀)/b₁, or does not exist).
 */
export function decisionBoundary(u: RateUnit): { slope: number; intercept: number } | null {
  const [b1, b2] = u.weights
  if (!b2) return null
  return { slope: -b1 / b2, intercept: (u.threshold - u.baseline) / b2 }
}
