import type { Rng } from '../../random'
import { activate, activationSlope, type RateUnit } from '../../bilaterian/unit'
import { learnWeights, thirdFactor, weightChange, type ConnectionLimits } from '../../bilaterian/learning/rule'
import { FISH_SIGMOID_WIDTH } from '../../fish/brain'
import { N_FEATURES, featuresOf } from './features'
import type { View } from './trial'

/**
 * The learner (spec §8.5): a subordinate whose choice comes from a network
 * trained on a history of contests, with no line-of-sight computation and
 * no record of what the dominant saw. From the observable features of a
 * piece (`features.ts`) it predicts whether the dominant takes that piece,
 * trained on the outcome of each contest by Lab 5's Prediction setting:
 * the prediction p is made from the features, the outcome a arrives (1 if
 * the dominant took the piece, 0 if not), Φ = a − p, and Δbᵢ = η · xᵢ · Φ
 * through `thirdFactor()` and written only by `learnWeights`. It goes to
 * the piece with the lower predicted chance.
 *
 * One layer first, as the spec asks. With a hidden layer (Lab 7's engine:
 * a hidden unit's Φ passed back from the output it feeds, scaled by its
 * slope), the same rule; `hidden: 0` is the one-layer learner. The
 * as-built notes record what each could learn.
 *
 * It stores no occasion: its state is a fixed number of weights.
 */

export const LEARNER = {
  rate: 0.3,
  width: FISH_SIGMOID_WIDTH,
  weightRange: { min: -8, max: 8 },
  startSpread: 0.3,
  /** Passes over the history of contests. */
  passes: 3,
  /** Two predictions closer than this are no preference, and the learner goes at random like any other animal whose rule gives none. */
  noPreference: 0.1,
} as const

const LIMITS: ConnectionLimits[] = Array.from({ length: 64 }, () => ({ plastic: true, min: LEARNER.weightRange.min, max: LEARNER.weightRange.max }))
const ALWAYS_ON = { min: LEARNER.weightRange.min, max: LEARNER.weightRange.max }

export class ContestLearner {
  readonly hidden: RateUnit[]
  readonly output: RateUnit
  contests = 0
  private readonly net: number[] = []
  private readonly h: number[] = []

  constructor(rng: Rng, hidden = 0) {
    const start = () => (hidden > 0 ? rng.range(-LEARNER.startSpread, LEARNER.startSpread) : 0)
    this.hidden = Array.from({ length: hidden }, () => ({ baseline: start(), threshold: 0, weights: Array.from({ length: N_FEATURES }, start) }))
    this.output = { baseline: 0, threshold: 0, weights: Array.from({ length: hidden > 0 ? hidden : N_FEATURES }, start) }
  }

  /** The predicted chance that the dominant takes a piece with these features. */
  predict(x: readonly number[]): number {
    const H = this.hidden.length
    let input: readonly number[] = x
    if (H > 0) {
      for (let j = 0; j < H; j++) {
        const u = this.hidden[j]
        let net = u.baseline
        for (let i = 0; i < x.length; i++) net += u.weights[i] * x[i]
        this.net[j] = net
        this.h[j] = activate('sigmoid', net, 0, LEARNER.width)
      }
      this.net.length = H
      this.h.length = H
      input = this.h
    }
    let net = this.output.baseline
    for (let i = 0; i < input.length; i++) net += this.output.weights[i] * input[i]
    return activate('sigmoid', net, 0, LEARNER.width)
  }

  /** One contest's lesson for one piece: the prediction is made, the outcome arrives, Φ = a − p. */
  learn(x: readonly number[], a: 0 | 1, rate = LEARNER.rate): void {
    const p = this.predict(x)
    const phi = thirdFactor('prediction', { output: p, weakening: false, usualOutput: 0, arriving: a, heldPrediction: p, target: null, broadcast: 0 })
    const H = this.hidden.length
    if (H === 0) {
      const changes = x.map((xi) => weightChange(rate, xi, phi))
      learnWeights(this.output, changes, LIMITS, false, { change: weightChange(rate, 1, phi), ...ALWAYS_ON })
      return
    }
    const phiHidden = this.hidden.map((u, j) => {
      void u
      const slope = activationSlope('sigmoid', this.net[j], 0, LEARNER.width)
      return thirdFactor('passed-back', { output: this.h[j], weakening: false, usualOutput: 0, arriving: null, heldPrediction: 0, target: null, broadcast: 0, slope, downstream: [{ weight: this.output.weights[j], phi }] })
    })
    const outChanges = this.h.map((hj) => weightChange(rate, hj, phi))
    const hidChanges = this.hidden.map((_, j) => x.map((xi) => weightChange(rate, xi, phiHidden[j])))
    const hidBase = phiHidden.map((ph) => weightChange(rate, 1, ph))
    learnWeights(this.output, outChanges, LIMITS, false, { change: weightChange(rate, 1, phi), ...ALWAYS_ON })
    for (let j = 0; j < H; j++) learnWeights(this.hidden[j], hidChanges[j], LIMITS, false, { change: hidBase[j], ...ALWAYS_ON })
  }

  /** Learn from one contest: which piece the dominant took (or neither). */
  learnContest(view: View, dominantTook: 0 | 1 | -1): void {
    for (const k of [0, 1] as const) this.learn(featuresOf(view, k), dominantTook === k ? 1 : 0)
    this.contests++
  }

  /** The piece with the lower predicted chance that the dominant takes it; null, no preference, when the two predictions are within `noPreference` of each other. */
  choose(view: View): 0 | 1 | null {
    const p0 = this.predict(featuresOf(view, 0))
    const p1 = this.predict(featuresOf(view, 1))
    if (Math.abs(p0 - p1) < LEARNER.noPreference) return null
    return p0 < p1 ? 0 : 1
  }

  predictions(view: View): [number, number] {
    return [this.predict(featuresOf(view, 0)), this.predict(featuresOf(view, 1))]
  }
}
