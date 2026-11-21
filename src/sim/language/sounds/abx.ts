import type { Rng } from '../../random'

/**
 * Part 1, Step 3's design and analysis (spec §5.3), after Liberman, Harris,
 * Hoffman and Griffith (1957).
 *
 * The lab plays the first 9 of the 14 synthesized steps (Jon, walk,
 * 2026-11-16): the b–d boundary alone makes the point, step 9 is the last
 * sure d by ear and in the paper's listener (Fig. 2, p. 361: d 83% at step
 * 9, g 78% at step 10), and the shorter series cuts the two blocks from
 * about 9 minutes to about 5. Steps 10 to 14 stay shipped and unplayed.
 *
 *   Block 1, labeling: each of the 9 sounds 6 times, in 6 shuffled rounds
 *   of 9: 54 trials. On each trial the sound plays LABELING_REPEATS times
 *   in a row, REPEAT_GAP_S apart (Jon, walk, 2026-11-20: repetition, for
 *   the sounds near the boundary; the original played each once). The
 *   original's interval was 6 s (p. 360); this step starts the next trial
 *   800 ms after the answer.
 *   Block 2, telling apart: ABX triads over the 7 two-step pairs (1, 3) to
 *   (7, 9), each in the four orders ABA, ABB, BAA, BAB: 28 triads in a
 *   seeded order, the sounds of a triad 1 s apart (p. 360), each triad
 *   played once (Jon, 2026-11-20: the three plays are block 1's only).
 *
 * The analysis: labeling curves (the share of each sound's 6 presentations
 * labeled b or d); discrimination (the share of each pair's 4 triads
 * correct); the discrimination predicted from the labels alone, by the
 * paper's formula (pp. 362–363); and where the two curves cross.
 */

export const STEPS = 9
export const LABELING_ROUNDS = 6
export const LABELING_GAP_MS = 800
/** How many times a labeling trial plays its sound, and the silence between the plays (Jon, 2026-11-20). */
export const LABELING_REPEATS = 3
export const REPEAT_GAP_S = 0.5
export const PAIRS: [number, number][] = Array.from({ length: STEPS - 2 }, (_, i) => [i + 1, i + 3])
export const ORDERS = ['ABA', 'ABB', 'BAA', 'BAB'] as const
export type Order = (typeof ORDERS)[number]
export const TRIAD_INTERVAL_S = 1.0
export type Label = 'b' | 'd'
export const LABELS: Label[] = ['b', 'd']

function shuffle<T>(rng: Rng, xs: T[]): T[] {
  const a = xs.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = rng.int(i + 1)
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** The 54 labeling trials: 6 rounds, each a shuffle of the 9 steps (1-based). */
export function labelingTrials(rng: Rng): number[] {
  const out: number[] = []
  for (let r = 0; r < LABELING_ROUNDS; r++) out.push(...shuffle(rng, Array.from({ length: STEPS }, (_, i) => i + 1)))
  return out
}

export interface Triad {
  pair: [number, number]
  order: Order
  /** The three sounds, in the order played. */
  sounds: [number, number, number]
  /** Whether X matched the first sound. */
  xIsFirst: boolean
}

export function triadOf(pair: [number, number], order: Order): Triad {
  const [a, b] = pair
  const sounds: [number, number, number] = order === 'ABA' ? [a, b, a] : order === 'ABB' ? [a, b, b] : order === 'BAA' ? [b, a, a] : [b, a, b]
  return { pair, order, sounds, xIsFirst: order === 'ABA' || order === 'BAB' }
}

/** The 28 triads in a seeded order. */
export function abxTrials(rng: Rng): Triad[] {
  const all: Triad[] = []
  for (const p of PAIRS) for (const o of ORDERS) all.push(triadOf(p, o))
  return shuffle(rng, all)
}

/** The labeling curves: for each step 1 to 9, the share of its presentations labeled b or d. */
export function labelingCurves(trials: readonly number[], answers: readonly Label[]): Record<Label, number[]> {
  const counts: Record<Label, number[]> = { b: Array(STEPS).fill(0), d: Array(STEPS).fill(0) }
  const n = Array(STEPS).fill(0)
  trials.forEach((step, i) => {
    const a = answers[i]
    if (!a) return
    counts[a][step - 1]++
    n[step - 1]++
  })
  const share = (l: Label) => counts[l].map((c, k) => (n[k] ? c / n[k] : 0))
  return { b: share('b'), d: share('d') }
}

/** Discrimination: for each two-step pair, the share of its triads answered correctly; plotted at the pair's middle step. */
export function discrimination(trials: readonly Triad[], answers: readonly ('first' | 'second')[]): { middle: number; correct: number; n: number }[] {
  return PAIRS.map(([a, b]) => {
    let correct = 0
    let n = 0
    trials.forEach((t, i) => {
      if (t.pair[0] !== a || !answers[i]) return
      n++
      if ((answers[i] === 'first') === t.xIsFirst) correct++
    })
    return { middle: (a + b) / 2, correct: n ? correct / n : 0, n }
  })
}

/**
 * The discrimination predicted from the labels alone (pp. 362–363). For a
 * pair of sounds A and B, with p the shares of A's labels and p′ of B's:
 *
 *   predicted = 1/2 + 1/4 · [ (p_b − p′_b)² + (p_d − p′_d)² ]
 *
 * (the paper's sum runs over its three labels; with two labels it has two terms)
 *
 * which is the paper's average over the ABA and ABB orders of
 * P Corr = 1·P_R + 0·P_W + ½·P_I, where P_R is the chance of hearing a
 * sequence that leads to a correct discrimination, P_W one that leads to a
 * wrong one, and P_I one that leads to either equally often. Identical
 * labels give 50%; labels that never agree give 100%, as for the paper's
 * two example pairs.
 */
export function predictedFromLabels(p: Record<Label, number>, q: Record<Label, number>): number {
  let s = 0
  for (const l of LABELS) s += (p[l] - q[l]) ** 2
  return 0.5 + 0.25 * s
}

export function predictedCurve(curves: Record<Label, number[]>): { middle: number; predicted: number }[] {
  return PAIRS.map(([a, b]) => ({ middle: (a + b) / 2, predicted: predictedFromLabels({ b: curves.b[a - 1], d: curves.d[a - 1] }, { b: curves.b[b - 1], d: curves.d[b - 1] }) }))
}

/** Where two labeling curves cross: the first step at which the second curve rises to meet or pass the first, as a fractional step by linear interpolation; null if they never cross. */
export function crossing(first: number[], second: number[]): number | null {
  for (let k = 0; k + 1 < first.length; k++) {
    const d0 = first[k] - second[k]
    const d1 = first[k + 1] - second[k + 1]
    if (d0 > 0 && d1 <= 0) {
      const t = d0 / (d0 - d1)
      return k + 1 + t
    }
  }
  return null
}
