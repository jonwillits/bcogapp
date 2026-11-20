import { makeRng, type Rng } from '../../random'
import { activate, activationSlope, netInput, type RateUnit } from '../../bilaterian/unit'
import { learnWeights, thirdFactor, weightChange, type ConnectionLimits } from '../../bilaterian/learning/rule'
import { PATCH_BANDS, PATCH_FRAMES } from '../audio/spectrogram'

/**
 * Part 1, Step 4's classifier (spec §5.4): Lab 7's engine. The patch's
 * values in (PATCH_BANDS × PATCH_FRAMES numbers, each the energy in one
 * frequency band in one 10 ms frame), one hidden layer of HIDDEN sigmoid
 * units, three sigmoid outputs (b, d, g). It learns by *passed-back*
 * learning through `learnWeights`, and through nothing else: at each
 * output Φ is Lab 5's Teacher setting, the target (1 for the right label,
 * 0 for the others) minus the output; at each hidden unit Φ is passed back
 * from the three outputs through the connections its activity went forward
 * on, scaled by its own slope (`thirdFactor('passed-back')`). Every change
 * is Δb = η · x · Φ (`weightChange`), written only by `learnWeights`.
 *
 * The learning rate and the number of passes were chosen once, before any
 * measurement, so that training takes a few seconds at most: RATE and
 * PASSES below. Weights start from small seeded values. Nothing here is
 * tuned toward any listener's curve (spec §11, item 11).
 */

export const INPUTS = PATCH_BANDS * PATCH_FRAMES
export const HIDDEN = 12
export const LABELS = ['b', 'd', 'g'] as const
export type Label = (typeof LABELS)[number]
export const RATE = 0.02
export const PASSES = 12
/** The sigmoid's width, as Lab 7's fish uses it: a slope that is not zero almost everywhere. */
export const WIDTH = 0.25
export const WEIGHT_LIMIT = 10
const START_SPREAD = 0.05

export interface Token {
  patch: Float32Array
  label: Label
  voice: number
  shift: number
  vowel: string
}

export interface Classifier {
  hidden: RateUnit[]
  out: RateUnit[]
  /** The percentage correct on the test set after each pass. */
  curve: number[]
}

const LIMITS_IN: ConnectionLimits[] = Array.from({ length: INPUTS }, () => ({ plastic: true, min: -WEIGHT_LIMIT, max: WEIGHT_LIMIT }))
const LIMITS_HIDDEN: ConnectionLimits[] = Array.from({ length: HIDDEN }, () => ({ plastic: true, min: -WEIGHT_LIMIT, max: WEIGHT_LIMIT }))
const BASELINE = { min: -WEIGHT_LIMIT, max: WEIGHT_LIMIT }

function unit(n: number, rng: Rng): RateUnit {
  return { baseline: 0, weights: Array.from({ length: n }, () => (rng.next() * 2 - 1) * START_SPREAD), threshold: 0 }
}

export function makeClassifier(seed: number): Classifier {
  const rng = makeRng(seed ^ 0xc1a55)
  return { hidden: Array.from({ length: HIDDEN }, () => unit(INPUTS, rng)), out: Array.from({ length: LABELS.length }, () => unit(HIDDEN, rng)), curve: [] }
}

export interface Forward {
  hNet: number[]
  h: number[]
  o: number[]
}

export function forward(c: Classifier, x: ArrayLike<number>): Forward {
  const xs = Array.from(x)
  const hNet = c.hidden.map((u) => netInput(u, xs))
  const h = hNet.map((n, j) => activate('sigmoid', n, c.hidden[j].threshold, WIDTH))
  const o = c.out.map((u) => activate('sigmoid', netInput(u, h), u.threshold, WIDTH))
  return { hNet, h, o }
}

/** The network's three outputs, scaled to shares that sum to one: its labeling of a sound. */
export function shares(o: readonly number[]): number[] {
  const s = o.reduce((a, b) => a + b, 0) || 1
  return o.map((v) => v / s)
}

export function labelOf(o: readonly number[]): Label {
  let k = 0
  for (let i = 1; i < o.length; i++) if (o[i] > o[k]) k = i
  return LABELS[k]
}

/** One learning step on one token: forward, Φ at each output and each hidden unit, Δb everywhere, written by learnWeights. */
export function learnOne(c: Classifier, t: Token, rate = RATE): void {
  const x = Array.from(t.patch)
  const f = forward(c, x)
  const phiOut = c.out.map((_, k) => thirdFactor('teacher', { output: f.o[k], weakening: false, usualOutput: 0, arriving: null, heldPrediction: 0, target: LABELS[k] === t.label ? 1 : 0, broadcast: 0 }))
  const phiHidden = c.hidden.map((u, j) =>
    thirdFactor('passed-back', {
      output: f.h[j],
      weakening: false,
      usualOutput: 0,
      arriving: null,
      heldPrediction: 0,
      target: null,
      broadcast: 0,
      slope: activationSlope('sigmoid', f.hNet[j], u.threshold, WIDTH),
      downstream: c.out.map((o, k) => ({ weight: o.weights[j], phi: phiOut[k] })),
    }),
  )
  // Changes are computed before any weight moves, as the fish does.
  const outChanges = c.out.map((_, k) => f.h.map((hj) => weightChange(rate, hj, phiOut[k])))
  const outBaseline = phiOut.map((p) => weightChange(rate, 1, p))
  const hidChanges = c.hidden.map((_, j) => x.map((xi) => weightChange(rate, xi, phiHidden[j])))
  const hidBaseline = phiHidden.map((p) => weightChange(rate, 1, p))
  c.out.forEach((u, k) => learnWeights(u, outChanges[k], LIMITS_HIDDEN, false, { change: outBaseline[k], ...BASELINE }))
  c.hidden.forEach((u, j) => learnWeights(u, hidChanges[j], LIMITS_IN, false, { change: hidBaseline[j], ...BASELINE }))
}

export function accuracy(c: Classifier, tokens: readonly Token[]): number {
  if (tokens.length === 0) return NaN
  let right = 0
  for (const t of tokens) if (labelOf(forward(c, t.patch).o) === t.label) right++
  return (100 * right) / tokens.length
}

/** The confusion table: rows are the right labels, columns the network's. */
export function confusion(c: Classifier, tokens: readonly Token[]): number[][] {
  const m = LABELS.map(() => LABELS.map(() => 0))
  for (const t of tokens) m[LABELS.indexOf(t.label)][LABELS.indexOf(labelOf(forward(c, t.patch).o))]++
  return m
}

/**
 * Train for PASSES passes over the training tokens in a seeded order,
 * scoring the test tokens after each pass. `onPass` lets the scene draw
 * the curve as it rises and keep the main thread free between passes.
 */
export function train(c: Classifier, training: readonly Token[], test: readonly Token[], seed: number, passes = PASSES, rate = RATE, onPass?: (pass: number, acc: number) => void): void {
  const rng = makeRng(seed ^ 0x7a1e)
  const order = training.map((_, i) => i)
  for (let p = 0; p < passes; p++) {
    for (let i = order.length - 1; i > 0; i--) {
      const j = rng.int(i + 1)
      ;[order[i], order[j]] = [order[j], order[i]]
    }
    for (const i of order) learnOne(c, training[i], rate)
    const acc = accuracy(c, test)
    c.curve.push(acc)
    onPass?.(p + 1, acc)
  }
}

/** The three runs' token splits (spec §5.4). */
export function splitRun1(all: readonly Token[], heldOut: readonly number[]) {
  return { training: all.filter((t) => !heldOut.includes(t.voice)), test: all.filter((t) => heldOut.includes(t.voice)) }
}
/** Run 2, one pitch: every voice at its own pitch only (the unshifted tokens of the training voices); tested on every shifted token, and on the held-out voices. */
export function splitOnePitch(all: readonly Token[], heldOut: readonly number[]) {
  const training = all.filter((t) => !heldOut.includes(t.voice) && t.shift === 0)
  return { training, test: all.filter((t) => !training.includes(t)) }
}
/** Run 2, one voice: voice 1 at its three pitches; tested on every other voice. */
export function splitOneVoice(all: readonly Token[], voice = 1) {
  return { training: all.filter((t) => t.voice === voice), test: all.filter((t) => t.voice !== voice) }
}

// ------------------------------------------------------------ several networks

/** The sample mean and the sample standard deviation (divided by n − 1) of a list; sd is 0 for fewer than two values. */
export function meanAndSd(xs: readonly number[]): { mean: number; sd: number } {
  const n = xs.length
  if (n === 0) return { mean: NaN, sd: 0 }
  const mean = xs.reduce((a, b) => a + b, 0) / n
  const sd = n < 2 ? 0 : Math.sqrt(xs.reduce((a, x) => a + (x - mean) ** 2, 0) / (n - 1))
  return { mean, sd }
}

/** Student's t for 9 degrees of freedom at 95%: the band over 10 networks. */
export const T_95_DF9 = 2.262

/**
 * At each pass, the mean over several curves and the 95% confidence interval
 * of that mean, mean ± t · sd / √n, with sd the sample standard deviation
 * across the curves at that pass. Passes a curve has not reached are skipped.
 */
export function meanBand(curves: readonly (readonly number[])[], t = T_95_DF9): { pass: number; mean: number; lo: number; hi: number; sd: number }[] {
  const n = curves.length
  const passes = Math.min(...curves.map((c) => c.length))
  if (n === 0 || !Number.isFinite(passes)) return []
  return Array.from({ length: passes }, (_, p) => {
    const { mean, sd } = meanAndSd(curves.map((c) => c[p]))
    const half = (t * sd) / Math.sqrt(n)
    return { pass: p + 1, mean, lo: mean - half, hi: mean + half, sd }
  })
}
