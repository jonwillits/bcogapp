import type { RateUnit } from '../../bilaterian/unit'
import { activate } from '../../bilaterian/unit'
import { learnWeights, thirdFactor, weightChange, type ConnectionLimits } from '../../bilaterian/learning/rule'
import { FISH_SIGMOID_WIDTH } from '../../fish/brain'

/**
 * The tendency system (spec §9.1, §12 item 3): one weight per log, learned
 * by Lab 5's rule from the beetles found there. It is Lab 5's learner on
 * the Prediction setting: when the forager digs at log i, the input xᵢ is
 * 1, the prediction p is the unit's output, and when the outcome arrives,
 * a = 1 for beetles and 0 for nothing, Φ = a − p and Δbᵢ = η · xᵢ · Φ,
 * through `thirdFactor()` and written only by `learnWeights`.
 *
 * **It stores no occasion.** Its state is a fixed number of numbers,
 * overwritten in place: the weights, the one-hot input of the log being
 * dug, the prediction made when the dig began and held until the outcome.
 * There is no list of what happened when (`structure.test.ts`, carried
 * from Lab 5's no-record test). A weight is a residue that can say what
 * tends to pay off and never what happened last night.
 */

export const TENDENCY = {
  rate: 0.5,
  weightRange: { min: -6, max: 6 },
  width: FISH_SIGMOID_WIDTH,
} as const

export class TendencyUnit {
  readonly unit: RateUnit
  /** The one-hot input of the log being dug. */
  readonly x: number[]
  /** The prediction made when the dig began, held until the outcome. */
  held = 0
  /** Φ on the last outcome, for the printed arithmetic. */
  phi = 0
  private readonly limits: ConnectionLimits[]

  constructor(logs: number) {
    this.unit = { baseline: 0, threshold: 0, weights: new Array<number>(logs).fill(0) }
    this.x = new Array<number>(logs).fill(0)
    this.limits = Array.from({ length: logs }, () => ({ plastic: true, min: TENDENCY.weightRange.min, max: TENDENCY.weightRange.max }))
  }

  /** The tendency toward each log: the unit's output were that log alone the input. */
  tendency(i: number): number {
    return activate('sigmoid', this.unit.weights[i], 0, TENDENCY.width)
  }

  /** A dig begins at log i: the prediction is made now and held. */
  begin(i: number): void {
    this.x.fill(0)
    this.x[i] = 1
    this.held = this.tendency(i)
  }

  /** The outcome arrives: a = 1 for beetles, 0 for nothing. */
  outcome(a: number): void {
    this.phi = thirdFactor('prediction', { output: this.held, weakening: false, usualOutput: 0, arriving: a, heldPrediction: this.held, target: null, broadcast: 0 })
    const changes = this.x.map((xi) => weightChange(TENDENCY.rate, xi, this.phi))
    learnWeights(this.unit, changes, this.limits, false)
  }
}
