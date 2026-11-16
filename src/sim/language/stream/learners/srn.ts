import { makeRng, type Rng } from '../../../random'
import { activate, activationSlope, netInput, type RateUnit } from '../../../bilaterian/unit'
import { learnWeights, thirdFactor, weightChange, type ConnectionLimits } from '../../../bilaterian/learning/rule'
import { SYLLABLES, type Syllable } from '../language'
import type { Scorer } from '../test'

/**
 * The second learner (spec §6.3): a simple recurrent network (§13.2.9;
 * Elman, 1990, pp. 182–184). It takes one syllable at a time, coded as one
 * of 12 inputs, with a copy of its hidden layer from the step before fed
 * back as context through fixed one-to-one connections, and is trained to
 * predict the next syllable: its 12 outputs are compared with the next
 * syllable's code. It learns online through the stream, one pass, by
 * `learnWeights`: Φ at each output is the Teacher setting (the next
 * syllable's code minus the output), Φ at each hidden unit is passed back
 * from the outputs through the connections its activity went forward on,
 * scaled by its slope. The hidden-layer size and the learning rate were
 * chosen once, before any comparison with the adult results: HIDDEN and
 * RATE below.
 *
 * Its score for a test string: minus its mean prediction error on the
 * string's second and third syllables, with its context reset to the
 * starting value before each string. The prediction error at a syllable is
 * the sum over the 12 outputs of the squared difference between the output
 * and that syllable's code. Lower error is more word-like, so the scorer
 * returns the negative. Scoring moves no weight.
 */

export const HIDDEN = 12
export const RATE = 0.1
export const WIDTH = 0.25
export const WEIGHT_LIMIT = 10
const START_SPREAD = 0.1
/** The context units' starting value, as Elman's (1990, p. 182): 0.5. */
export const CONTEXT_START = 0.5
export const N = SYLLABLES.length

export interface Srn {
  hidden: RateUnit[]
  out: RateUnit[]
  context: number[]
  heard: number
}

const LIMITS_IN: ConnectionLimits[] = Array.from({ length: N + HIDDEN }, () => ({ plastic: true, min: -WEIGHT_LIMIT, max: WEIGHT_LIMIT }))
const LIMITS_HIDDEN: ConnectionLimits[] = Array.from({ length: HIDDEN }, () => ({ plastic: true, min: -WEIGHT_LIMIT, max: WEIGHT_LIMIT }))
const BASELINE = { min: -WEIGHT_LIMIT, max: WEIGHT_LIMIT }

function unit(n: number, rng: Rng): RateUnit {
  return { baseline: 0, weights: Array.from({ length: n }, () => (rng.next() * 2 - 1) * START_SPREAD), threshold: 0 }
}

export function makeSrn(seed: number): Srn {
  const rng = makeRng(seed ^ 0x5e11)
  return { hidden: Array.from({ length: HIDDEN }, () => unit(N + HIDDEN, rng)), out: Array.from({ length: N }, () => unit(HIDDEN, rng)), context: Array(HIDDEN).fill(CONTEXT_START), heard: 0 }
}

export function code(s: Syllable): number[] {
  const v = Array(N).fill(0)
  v[SYLLABLES.indexOf(s)] = 1
  return v
}

interface Forward {
  x: number[]
  hNet: number[]
  h: number[]
  o: number[]
}

function forward(net: Srn, s: Syllable, context: readonly number[]): Forward {
  const x = [...code(s), ...context]
  const hNet = net.hidden.map((u) => netInput(u, x))
  const h = hNet.map((n, j) => activate('sigmoid', n, net.hidden[j].threshold, WIDTH))
  const o = net.out.map((u) => activate('sigmoid', netInput(u, h), u.threshold, WIDTH))
  return { x, hNet, h, o }
}

/** One step of online learning: the current syllable in, the next syllable as the target; the hidden layer's activity becomes the next context. */
export function learnStep(net: Srn, current: Syllable, next: Syllable, rate = RATE): void {
  const f = forward(net, current, net.context)
  const target = code(next)
  const phiOut = net.out.map((_, k) => thirdFactor('teacher', { output: f.o[k], weakening: false, usualOutput: 0, arriving: null, heldPrediction: 0, target: target[k], broadcast: 0 }))
  const phiHidden = net.hidden.map((u, j) =>
    thirdFactor('passed-back', {
      output: f.h[j],
      weakening: false,
      usualOutput: 0,
      arriving: null,
      heldPrediction: 0,
      target: null,
      broadcast: 0,
      slope: activationSlope('sigmoid', f.hNet[j], u.threshold, WIDTH),
      downstream: net.out.map((o, k) => ({ weight: o.weights[j], phi: phiOut[k] })),
    }),
  )
  const outChanges = net.out.map((_, k) => f.h.map((hj) => weightChange(rate, hj, phiOut[k])))
  const outBaseline = phiOut.map((p) => weightChange(rate, 1, p))
  const hidChanges = net.hidden.map((_, j) => f.x.map((xi) => weightChange(rate, xi, phiHidden[j])))
  const hidBaseline = phiHidden.map((p) => weightChange(rate, 1, p))
  net.out.forEach((u, k) => learnWeights(u, outChanges[k], LIMITS_HIDDEN, false, { change: outBaseline[k], ...BASELINE }))
  net.hidden.forEach((u, j) => learnWeights(u, hidChanges[j], LIMITS_IN, false, { change: hidBaseline[j], ...BASELINE }))
  net.context = f.h
  net.heard++
}

/** Train online through a stream, one pass, from where the network is (so a stream can be fed in pieces and scored between them). */
export function trainSrn(net: Srn, syllables: readonly Syllable[], from = 0, to = syllables.length, rate = RATE): void {
  for (let i = Math.max(from, 0); i + 1 < Math.min(to, syllables.length); i++) learnStep(net, syllables[i], syllables[i + 1], rate)
  // The last syllable of the piece is fed in with the first of the next piece on the next call; nothing is skipped because `from` is the next call's start.
}

/** The prediction error at each position of a string after the first, with the context reset first: Σ (target − output)² over the 12 outputs. */
export function predictionErrors(net: Srn, s: readonly Syllable[]): number[] {
  let context: number[] = Array(HIDDEN).fill(CONTEXT_START)
  const errors: number[] = []
  for (let i = 0; i + 1 < s.length; i++) {
    const f = forward(net, s[i], context)
    const t = code(s[i + 1])
    let e = 0
    for (let k = 0; k < N; k++) e += (t[k] - f.o[k]) ** 2
    errors.push(e)
    context = f.h
  }
  return errors
}

export function srnScorer(net: Srn): Scorer {
  return (s) => {
    const e = predictionErrors(net, s)
    return -(e.reduce((a, b) => a + b, 0) / e.length)
  }
}

/** The network's prediction error at every syllable of a stream, with no learning: Elman's Fig. 6 (1990, p. 194), where error rises at word onsets. */
export function errorProfile(net: Srn, s: readonly Syllable[]): number[] {
  return predictionErrors(net, s)
}
