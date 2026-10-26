import type { Rng } from '../../random'
import { activate, activationSlope, type RateUnit } from '../../bilaterian/unit'
import { learnWeights, thirdFactor, weightChange, type ConnectionLimits } from '../../bilaterian/learning/rule'
import { FISH_SIGMOID_WIDTH } from '../../fish/brain'
import { ALL_THINGS, N_INPUTS, N_PROPERTIES, PROPERTIES, RELATIONS, THINGS, inputFor, patternsOf, type Level, type Relation, type Thing } from './world'

/**
 * The slow learner (spec §9.4): a small network in the manner of the
 * reading's canary model (§10.2.10), built from Lab 4's rate units and Lab
 * 5's rule as Lab 7's fish is: things and a relation in, one hidden layer,
 * properties out. The output units' Φ is the Teacher setting, t − o, with
 * the target supplied by the world; a hidden unit's Φ is passed back from
 * the outputs it feeds through the connections its activity went forward
 * on, scaled by its slope (Lab 7's `passed-back`). Every weight is written
 * by `learnWeights` and nothing else (`oneWriter.test.ts`). The hidden
 * layer is this scene's, and Labs 4 and 5 still have none.
 *
 * It learns by passing the error back, which no one has found in a brain;
 * the reading's model learned the same way (§11, line 7).
 */

export const SLOW = {
  hidden: 8,
  rate: 0.1,
  startSpread: 0.3,
  width: FISH_SIGMOID_WIDTH,
  weightRange: { min: -12, max: 12 },
} as const

const LIMITS: ConnectionLimits[] = Array.from({ length: Math.max(N_INPUTS, 64) }, () => ({ plastic: true, min: SLOW.weightRange.min, max: SLOW.weightRange.max }))
const ALWAYS_ON = { min: SLOW.weightRange.min, max: SLOW.weightRange.max }

export interface DamageSetting {
  /** 0 to 1: the sd of the noise added to each hidden unit's net input, in units of a typical net input. */
  noise: number
}

export class SlowLearner {
  readonly hidden: RateUnit[]
  readonly outputs: RateUnit[]
  /** Scratch: the last pattern's hidden net inputs and outputs, and the output layer's outputs. */
  readonly net: number[] = []
  readonly h: number[] = []
  readonly o: number[] = []
  steps = 0
  /** The damage now applied when the network is read (never when it learns). */
  damage: DamageSetting = { noise: 0 }
  private readonly noiseRng: Rng

  constructor(rng: Rng, hidden: number = SLOW.hidden) {
    this.noiseRng = rng.fork()
    const start = () => rng.range(-SLOW.startSpread, SLOW.startSpread)
    this.hidden = Array.from({ length: hidden }, () => ({ baseline: start(), threshold: 0, weights: Array.from({ length: N_INPUTS }, start) }))
    this.outputs = Array.from({ length: N_PROPERTIES }, () => ({ baseline: start(), threshold: 0, weights: Array.from({ length: hidden }, start) }))
  }

  /** The forward pass, with the damage now set, writing into the scratch arrays. */
  forward(x: readonly number[], damaged = true): number[] {
    const H = this.hidden.length
    for (let j = 0; j < H; j++) {
      const u = this.hidden[j]
      let net = u.baseline
      for (let i = 0; i < x.length; i++) net += u.weights[i] * x[i]
      if (damaged && this.damage.noise > 0) net += this.damage.noise * NOISE_SCALE * this.noiseRng.normal()
      this.net[j] = net
      this.h[j] = activate('sigmoid', net, 0, SLOW.width)
    }
    this.net.length = H
    this.h.length = H
    for (let k = 0; k < this.outputs.length; k++) {
      const u = this.outputs[k]
      let net = u.baseline
      for (let j = 0; j < H; j++) net += u.weights[j] * this.h[j]
      this.o[k] = activate('sigmoid', net, 0, SLOW.width)
    }
    this.o.length = this.outputs.length
    return this.o
  }

  /** The hidden activity for a thing: its representation, read with the 'is' relation, undamaged. */
  representation(thing: Thing): number[] {
    this.forward(inputFor(thing, 'is'), false)
    return [...this.h]
  }

  /**
   * One presentation: the world supplies the target for every property.
   * Δb = η · x · Φ for every connection, with Φ at an output t − o (the
   * Teacher setting) and at a hidden unit its share passed back.
   */
  learn(x: readonly number[], t: readonly number[], rate = SLOW.rate): void {
    this.forward(x, false)
    const H = this.hidden.length
    const phiOut: number[] = []
    for (let k = 0; k < this.outputs.length; k++) {
      phiOut[k] = thirdFactor('teacher', { output: this.o[k], weakening: false, usualOutput: 0, arriving: null, heldPrediction: 0, target: t[k], broadcast: 0 })
    }
    const phiHidden: number[] = []
    for (let j = 0; j < H; j++) {
      const slope = activationSlope('sigmoid', this.net[j], 0, SLOW.width)
      const downstream = this.outputs.map((u, k) => ({ weight: u.weights[j], phi: phiOut[k] }))
      phiHidden[j] = thirdFactor('passed-back', { output: this.h[j], weakening: false, usualOutput: 0, arriving: null, heldPrediction: 0, target: null, broadcast: 0, slope, downstream })
    }
    // Every change is computed before any weight moves.
    const outChanges = this.outputs.map((_, k) => this.h.map((hj) => weightChange(rate, hj, phiOut[k])))
    const outBase = phiOut.map((p) => weightChange(rate, 1, p))
    const hidChanges = this.hidden.map((_, j) => x.map((xi) => weightChange(rate, xi, phiHidden[j])))
    const hidBase = phiHidden.map((p) => weightChange(rate, 1, p))
    for (let k = 0; k < this.outputs.length; k++) learnWeights(this.outputs[k], outChanges[k], LIMITS, false, { change: outBase[k], ...ALWAYS_ON })
    for (let j = 0; j < H; j++) learnWeights(this.hidden[j], hidChanges[j], LIMITS, false, { change: hidBase[j], ...ALWAYS_ON })
    this.steps++
  }

  /** Whether the network's answer for one thing, one relation and one property is right, averaged over draws of the damage noise. */
  says(thing: Thing, relation: Relation, propertyIndex: number, draws = 1): number {
    const x = inputFor(thing, relation)
    let s = 0
    for (let d = 0; d < draws; d++) s += this.forward(x)[propertyIndex]
    return s / draws
  }

  /** The proportion of a set of properties the network gets right (output on the right side of 0.5), over the things given, with the damage now set. */
  proportionRight(things: readonly Thing[], level: Level | null = null, draws = 1): number {
    let right = 0
    let n = 0
    for (const thing of things)
      for (const relation of RELATIONS) {
        const x = inputFor(thing, relation)
        let sum: number[] = new Array<number>(N_PROPERTIES).fill(0)
        for (let d = 0; d < draws; d++) {
          const o = this.forward(x)
          for (let k = 0; k < o.length; k++) sum[k] += o[k]
        }
        for (let k = 0; k < N_PROPERTIES; k++) {
          const p = PROPERTIES[k]
          if (p.relation !== relation) continue
          if (level && p.level !== level) continue
          const want = p.things.includes(thing) ? 1 : 0
          const got = sum[k] / draws >= 0.5 ? 1 : 0
          n++
          if (want === got) right++
        }
      }
    return n ? right / n : 0
  }

  /**
   * Of the properties the things HAVE at a level, the share the network
   * still says yes to (output at or above 0.5, averaged over draws of the
   * damage noise). This is what the reading's damaged network lost in
   * order, specific before general; the proportion of all answers right
   * would hide it behind the many properties a thing does not have.
   */
  kept(things: readonly Thing[], level: Level, draws = 1): number {
    let kept = 0
    let n = 0
    for (const thing of things)
      for (let k = 0; k < N_PROPERTIES; k++) {
        const p = PROPERTIES[k]
        if (p.level !== level || !p.things.includes(thing)) continue
        n++
        if (this.says(thing, p.relation, k, draws) >= 0.5) kept++
      }
    return n ? kept / n : 0
  }

  /**
   * Take every unit from another network of the same shape (the new season
   * starts from the same youth twice). This is construction: new units are
   * made from copies, and no stored weight is written (`oneWriter.test.ts`).
   */
  copyFrom(other: SlowLearner): void {
    const units = (us: RateUnit[]) => us.map((u) => ({ baseline: u.baseline, threshold: u.threshold, weights: [...u.weights] }))
    const h = units(other.hidden)
    const o = units(other.outputs)
    ;(this.hidden as RateUnit[]).splice(0, this.hidden.length, ...h)
    ;(this.outputs as RateUnit[]).splice(0, this.outputs.length, ...o)
    this.steps = other.steps
  }

  /** The property table as the network answers it now: for each property and each thing, the mean output over draws. */
  table(things: readonly Thing[], draws = 1): number[][] {
    return PROPERTIES.map((p, k) => things.map((thing) => this.says(thing, p.relation, k, draws)))
  }
}

/** The damage noise's scale: an sd of one typical net input at `noise` = 1. Net inputs of a trained network run several units wide. */
export const NOISE_SCALE = 3

/** Present the patterns in a seeded interleaved order, `passes` times. */
export function trainInterleaved(net: SlowLearner, patterns: readonly { x: number[]; t: number[] }[], passes: number, rng: Rng, onPass?: (pass: number) => void): void {
  for (let p = 0; p < passes; p++) {
    const order = patterns.map((_, i) => i)
    for (let i = order.length - 1; i > 0; i--) {
      const j = rng.int(i + 1)
      ;[order[i], order[j]] = [order[j], order[i]]
    }
    for (const i of order) net.learn(patterns[i].x, patterns[i].t)
    onPass?.(p + 1)
  }
}

/** The youth: the old world's patterns, interleaved, for this many passes. Measured in `measure.probe.ts`; the targets hold at this length. */
export const YOUTH_PASSES = 600
/** The new season's training, in passes over its patterns (replay off) or over its patterns interleaved with the old (replay on). */
export const SEASON_PASSES = 1000

export function oldPatterns() {
  return patternsOf(THINGS)
}

export function newPatterns() {
  return patternsOf(ALL_THINGS.slice(THINGS.length))
}

/**
 * How far the things have separated in hidden space at three levels: the
 * mean distance between representations across the top split (stays put
 * against moves), across the middle splits (wood against plants, air
 * against ground), and within the pairs (each thing from its sibling),
 * each as a ratio to the mean distance between every pair of things.
 */
export function differentiation(net: SlowLearner): { top: number; middle: number; pairs: number } {
  const reps = new Map<Thing, number[]>()
  for (const t of THINGS) reps.set(t, net.representation(t))
  const d = (a: Thing, b: Thing) => {
    const x = reps.get(a)!
    const y = reps.get(b)!
    let s = 0
    for (let i = 0; i < x.length; i++) s += (x[i] - y[i]) ** 2
    return Math.sqrt(s)
  }
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length)
  const stays: Thing[] = ['loose-bark log', 'smooth log', 'seed grass', 'berry bush']
  const moves: Thing[] = ['owl', 'hawk', 'fox', 'snake']
  const top = mean(stays.flatMap((a) => moves.map((b) => d(a, b))))
  const middle = mean([
    ...(['loose-bark log', 'smooth log'] as Thing[]).flatMap((a) => (['seed grass', 'berry bush'] as Thing[]).map((b) => d(a, b))),
    ...(['owl', 'hawk'] as Thing[]).flatMap((a) => (['fox', 'snake'] as Thing[]).map((b) => d(a, b))),
  ])
  const pairs = mean([d('loose-bark log', 'smooth log'), d('seed grass', 'berry bush'), d('owl', 'hawk'), d('fox', 'snake')])
  return { top, middle, pairs }
}

export { ALL_THINGS, THINGS }
