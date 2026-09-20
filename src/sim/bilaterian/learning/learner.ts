import type { RateUnit } from '../unit'
import {
  learnWeights,
  thirdFactor,
  weightChange,
  STEP_OF_DELAY_S,
  USUAL_OUTPUT_TAU_S,
  WEIGHT_CEILING,
  WEIGHT_FLOOR,
  type ConnectionLimits,
  type ThirdFactor,
} from './rule'

/**
 * Everything the learning layer holds for one animal: the settings on the
 * Learning tab, a fading mark on each connection, one held prediction, and a
 * small unit that estimates how well things are going.
 *
 * **Nothing here keeps a record of a particular occasion.** Every field is a
 * fixed-size number or a fixed-length list of them, overwritten in place.
 * There is no list of what happened when, and nothing to look one up in: a
 * weight is a residue that can say what tends to happen and can never say
 * what happened (§5.3.11). `noRecord.test.ts` holds this file to that.
 */

export interface LearningSettings {
  /** The learning layer as a whole. Off, the animal is Lab 4's. */
  on: boolean
  /** What supplies Φ. */
  factor: ThirdFactor
  /** η. */
  rate: number
  /** How long a connection stays a candidate after its input, seconds. */
  traceWindow: number
  /** γ, applied once per step of delay. */
  discount: number
  /** Long-term depression. Off when Part 1 begins, on purpose. */
  weakening: boolean
  /** Synaptic competition. Off when Part 1 begins, on purpose. */
  competition: boolean
}

export const DEFAULT_SETTINGS: LearningSettings = {
  on: true,
  factor: 'coincidence',
  rate: 0.3,
  traceWindow: 0,
  discount: 0.9,
  weakening: false,
  competition: false,
}

/** What reaches the connections on one step. */
export interface LearnerInputs {
  /** Each connection's input, in the unit's weight order. */
  x: readonly number[]
  /** The receiving unit's own output. */
  y: number
  /** What is arriving now, while an arrival is being resolved — 1 for food, 0 for nothing — and null otherwise. */
  arriving: number | null
  /** The scenario's target for this input, where it holds one. */
  target: number | null
  /** Good or bad news delivered on this step: +1 for a meal, −1 for harm. */
  news: number
}

export interface LearnerConfig {
  /** Per connection: whether the rule may move it, and between what limits. */
  limits: ConnectionLimits[]
  /**
   * Per connection: whether its input takes part in the prediction and in
   * the value estimate. The cell that reports what arrived does not predict
   * its own arrival.
   */
  predicts: boolean[]
}

export function plasticEverywhere(n: number): LearnerConfig {
  return {
    limits: Array.from({ length: n }, () => ({ plastic: true, min: WEIGHT_FLOOR, max: WEIGHT_CEILING })),
    predicts: Array.from({ length: n }, () => true),
  }
}

export class Learner {
  readonly settings: LearningSettings
  readonly config: LearnerConfig
  /** The actor: the unit whose weights decide what the animal does. */
  readonly actor: RateUnit
  /**
   * The critic: a unit over the same inputs whose output is an estimate of
   * how well things are going from here. Its output goes nowhere but into
   * the broadcast signal — it feeds no other unit, so it is not a second layer.
   */
  readonly critic: RateUnit
  /** eᵢ: the fading mark on each connection. With the window at zero it is the live input. */
  readonly eligibility: number[]
  /**
   * The held prediction. `value` was generated at `madeAt`, before the
   * arrival it is compared with, and is not recomputed while that arrival is
   * being resolved. §5.2.6: this register is what earns prediction learning
   * a name of its own.
   */
  readonly held = { value: 0, madeAt: 0 }
  /** When the arrival now being resolved began, or null. */
  arrivalBeganAt: number | null = null
  /** The critic's estimate now, and at the last step of delay. */
  value = 0
  private valueAtLastStep = 0
  private newsSinceLastStep = 0
  private sinceLastStep = 0
  /** Each input summed over the current step of delay, so a cue briefer than a step is still seen. */
  private readonly inputOverStep: number[]
  /** How active the receiving unit has been lately — what weakening measures its output against. */
  usualOutput = 0
  /** δ: the broadcast signal. One number, released to every eligible connection. */
  broadcast = 0
  /** Φ on the last step, whatever currently supplies it. */
  phi = 0
  /** Δbᵢ per second on the last step, for the printed arithmetic. */
  readonly changePerSecond: number[]
  time = 0

  constructor(actor: RateUnit, config: LearnerConfig, settings: Partial<LearningSettings> = {}) {
    this.actor = actor
    this.config = config
    this.settings = { ...DEFAULT_SETTINGS, ...settings }
    const n = actor.weights.length
    this.critic = { baseline: 0, threshold: 0, weights: new Array<number>(n).fill(0) }
    this.eligibility = new Array<number>(n).fill(0)
    this.changePerSecond = new Array<number>(n).fill(0)
    this.inputOverStep = new Array<number>(n).fill(0)
  }

  /** p: what the predicting connections currently say is about to arrive. */
  prediction(x: readonly number[]): number {
    let p = 0
    for (let i = 0; i < this.actor.weights.length; i++) {
      if (this.config.predicts[i]) p += this.actor.weights[i] * (x[i] ?? 0)
    }
    return p
  }

  /** The critic's estimate for an input. */
  valueOf(x: readonly number[]): number {
    let v = 0
    for (let i = 0; i < this.critic.weights.length; i++) {
      if (this.config.predicts[i]) v += this.critic.weights[i] * (x[i] ?? 0)
    }
    return v
  }

  /** A break in the animal's experience — it was picked up and put down. Nothing carries across it. */
  cut(): void {
    this.eligibility.fill(0)
    this.valueAtLastStep = 0
    this.newsSinceLastStep = 0
    this.sinceLastStep = 0
    this.inputOverStep.fill(0)
    this.broadcast = 0
    this.arrivalBeganAt = null
  }

  step(dt: number, input: LearnerInputs): void {
    const s = this.settings
    this.time += dt
    if (!s.on) {
      this.phi = 0
      this.changePerSecond.fill(0)
      return
    }
    const n = this.actor.weights.length

    // 1. The fading mark on each connection.
    const keep = s.traceWindow > 0 ? Math.exp(-dt / s.traceWindow) : 0
    for (let i = 0; i < n; i++) {
      const xi = input.x[i] ?? 0
      this.eligibility[i] = Math.max(xi, this.eligibility[i] * keep)
    }

    // 2. The prediction is made before an arrival and held through it.
    if (input.arriving === null) {
      this.held.value = this.prediction(input.x)
      this.held.madeAt = this.time
      this.arrivalBeganAt = null
    } else if (this.arrivalBeganAt === null) {
      this.arrivalBeganAt = this.time
    }

    // 3. The value estimate, revised once per step of delay against the
    //    next estimate it itself produces.
    this.value = this.valueOf(input.x)
    this.newsSinceLastStep += input.news
    this.sinceLastStep += dt
    for (let i = 0; i < n; i++) this.inputOverStep[i] += (input.x[i] ?? 0) * dt
    if (this.sinceLastStep >= STEP_OF_DELAY_S - 1e-9) {
      const overStep = this.valueOf(this.inputOverStep.map((sum) => sum / this.sinceLastStep))
      this.broadcast = this.newsSinceLastStep + s.discount * overStep - this.valueAtLastStep
      this.valueAtLastStep = overStep
      this.newsSinceLastStep = 0
      this.sinceLastStep = 0
      this.inputOverStep.fill(0)
    }

    // 4. Φ — the one thing the selector changes.
    this.usualOutput += ((input.y - this.usualOutput) * dt) / USUAL_OUTPUT_TAU_S
    this.phi = thirdFactor(s.factor, {
      output: input.y,
      weakening: s.weakening,
      usualOutput: this.usualOutput,
      arriving: input.arriving,
      heldPrediction: this.held.value,
      target: input.target,
      broadcast: this.broadcast,
    })

    // 5. Δbᵢ = η · xᵢ · Φ, for every connection, whatever Φ is.
    for (let i = 0; i < n; i++) this.changePerSecond[i] = weightChange(s.rate, this.eligibility[i], this.phi)
    learnWeights(this.actor, this.changePerSecond.map((c) => c * dt), this.config.limits, s.competition)

    // 6. The critic's own connections are eligible connections too, and the
    //    same broadcast number reaches them.
    const criticLimits = this.config.predicts.map((p) => ({ plastic: p, min: WEIGHT_FLOOR, max: WEIGHT_CEILING }))
    const criticChanges = this.eligibility.map((e) => weightChange(s.rate, e, this.broadcast) * dt)
    learnWeights(this.critic, criticChanges, criticLimits, false)
  }
}
