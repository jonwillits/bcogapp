import type { Rng } from '../../random'
import { activate, type RateUnit } from '../../bilaterian/unit'
import { FISH_SIGMOID_WIDTH, randomDirection, sparseBaseline } from '../../fish/brain'
import { FEATURE_DIMS } from '../logs/features'

/**
 * The fast store (spec §9.3): each night stored after one exposure as a
 * sparse code, with the logs emptied that night. Its separation stage is
 * Lab 7's *Fixed at random* units with *Sparse*: a night's features and a
 * context component that drifts a little from night to night are expanded
 * into many units, of which only a few are active. A slider sets how
 * separate the codes are, by the expansion's size and the share of units
 * active. Retrieval is by content: the store is cued, and every stored
 * night contributes in proportion to its code's similarity to the cue.
 *
 * Confusions between nights arise only from overlap between codes. No
 * error rate is written in (§12, item 5). On one proposal the dentate
 * gyrus makes similar patterns less alike (§10.3.5); this program is not a
 * model of the dentate gyrus (§11, line 9).
 */

export type Separation = 'weak' | 'medium' | 'strong'

export const SEPARATIONS: Separation[] = ['weak', 'medium', 'strong']

/** The three settings of the slider: how many units, and what share of them is active for a typical night. Measured in `measure.probe.ts`. */
export const SEPARATION_SETTING: Record<Separation, { units: number; share: number; label: string }> = {
  weak: { units: 8, share: 0.5, label: 'weak: 8 units, half of them active' },
  medium: { units: 60, share: 0.15, label: 'medium: 60 units, about one in seven active' },
  strong: { units: 480, share: 0.03, label: 'strong: 480 units, about one in thirty active' },
}

/**
 * The context component: this many dimensions, drifting each night by a
 * step whose length is CONTEXT_DRIFT of the context's own length, then
 * renormalized, and weighted CONTEXT_SCALE against the features' four
 * ones, so that when the features are the same the context is what tells
 * nights apart. Measured in `measure.probe.ts`: the cosine between one
 * night's context and the next is about 0.6.
 */
export const CONTEXT_DIMS = 12
export const CONTEXT_DRIFT = 1.3
export const CONTEXT_SCALE = 2
export const INPUT_DIMS = FEATURE_DIMS + CONTEXT_DIMS
/** A random unit's weight length, as in Lab 7. */
const LENGTH = 2.5

export interface StoredNight {
  /** The sparse code. */
  code: number[]
  /** The logs emptied that night, 1 per log. */
  content: number[]
  /** For the screen: which night it was, in the student's numbering. */
  label: string
}

export interface Retrieval {
  /** Each stored night's share of the answer, summing to 1 (or all 0 with nothing stored). */
  contributions: number[]
  /** The blended content: for each log, the share of the answer that says it was emptied. */
  blended: number[]
  /** The stored nights in order of their contribution, largest first. */
  ranked: number[]
}

/** A context vector that drifts a little each night and keeps its length. */
export function driftContext(c: readonly number[], rng: Rng, drift = CONTEXT_DRIFT): number[] {
  const step = Array.from({ length: CONTEXT_DIMS }, () => rng.normal())
  const stepLen = Math.hypot(...step) || 1
  const out = c.map((v, i) => v + (drift * step[i]) / stepLen)
  const len = Math.hypot(...out) || 1
  return out.map((v) => v / len)
}

export function freshContext(rng: Rng): number[] {
  const c = Array.from({ length: CONTEXT_DIMS }, () => rng.normal())
  const len = Math.hypot(...c) || 1
  return c.map((v) => v / len)
}

/** The separation stage: a fixed random layer over the night's input, built once from the seed, never learned. */
export class SeparationStage {
  readonly units: RateUnit[]
  readonly setting: Separation
  constructor(setting: Separation, rng: Rng, override?: { units: number; share: number }) {
    this.setting = setting
    const { units, share } = override ?? SEPARATION_SETTING[setting]
    // The typical inputs the sparseness is set against: random nights with random contexts.
    const typical: number[][] = []
    for (let k = 0; k < 200; k++) typical.push(randomInput(rng))
    this.units = []
    for (let j = 0; j < units; j++) {
      const w = randomDirection(INPUT_DIMS, LENGTH, rng)
      this.units.push({ baseline: sparseBaseline(w, typical, share), threshold: 0, weights: w })
    }
  }

  /** The code for an input: each unit's output through the sigmoid at Lab 7's width. */
  encode(x: readonly number[]): number[] {
    return this.units.map((u) => {
      let net = u.baseline
      for (let i = 0; i < x.length; i++) net += u.weights[i] * x[i]
      return activate('sigmoid', net, 0, FISH_SIGMOID_WIDTH)
    })
  }

  /** How many units are active (at or above half) for an input. */
  active(x: readonly number[]): number {
    return this.encode(x).filter((v) => v >= 0.5).length
  }
}

/** A random night: one value per feature group and a random context, for setting the sparseness. */
function randomInput(rng: Rng): number[] {
  const x = new Array<number>(INPUT_DIMS).fill(0)
  x[rng.int(3)] = 1
  x[3 + rng.int(3)] = 1
  x[6 + rng.int(4)] = 1
  x[10 + rng.int(3)] = 1
  const c = freshContext(rng)
  for (let i = 0; i < CONTEXT_DIMS; i++) x[FEATURE_DIMS + i] = CONTEXT_SCALE * c[i]
  return x
}

export function cosine(a: readonly number[], b: readonly number[]): number {
  let ab = 0
  let aa = 0
  let bb = 0
  for (let i = 0; i < a.length; i++) {
    ab += a[i] * b[i]
    aa += a[i] * a[i]
    bb += b[i] * b[i]
  }
  return aa > 0 && bb > 0 ? ab / Math.sqrt(aa * bb) : 0
}

/** Retrieval sharpness: each stored night's contribution is its similarity raised to this power, normalized. */
export const RETRIEVAL_POWER = 4

export class FastStore {
  readonly stage: SeparationStage
  readonly nights: StoredNight[] = []
  constructor(stage: SeparationStage) {
    this.stage = stage
  }

  /** Store one night after one exposure. */
  store(x: readonly number[], content: readonly number[], label: string): StoredNight {
    const n: StoredNight = { code: this.stage.encode(x), content: [...content], label }
    this.nights.push(n)
    return n
  }

  /** Cue the store: every stored night contributes in proportion to its code's similarity to the cue's code. */
  retrieve(x: readonly number[]): Retrieval {
    const cue = this.stage.encode(x)
    const sims = this.nights.map((n) => Math.max(0, cosine(cue, n.code)) ** RETRIEVAL_POWER)
    const total = sims.reduce((a, b) => a + b, 0)
    const contributions = total > 0 ? sims.map((s) => s / total) : sims.map(() => 0)
    const width = this.nights[0]?.content.length ?? 0
    const blended = new Array<number>(width).fill(0)
    this.nights.forEach((n, i) => {
      for (let k = 0; k < width; k++) blended[k] += contributions[i] * n.content[k]
    })
    const ranked = contributions.map((_, i) => i).sort((a, b) => contributions[b] - contributions[a] || b - a)
    return { contributions, blended, ranked }
  }

  /** The similarity matrix between the stored nights' codes. */
  similarity(): number[][] {
    return this.nights.map((a) => this.nights.map((b) => cosine(a.code, b.code)))
  }

  /** Replay: the stored contents, in a seeded order. */
  replay(rng: Rng): StoredNight[] {
    const order = this.nights.map((_, i) => i)
    for (let i = order.length - 1; i > 0; i--) {
      const j = rng.int(i + 1)
      ;[order[i], order[j]] = [order[j], order[i]]
    }
    return order.map((i) => this.nights[i])
  }

  clear(): void {
    this.nights.length = 0
  }
}

/** The store's input for a night: the features and the context, side by side, the context weighted. */
export function nightInput(features: readonly number[], context: readonly number[], scale = CONTEXT_SCALE): number[] {
  return [...features, ...context.map((v) => scale * v)]
}
