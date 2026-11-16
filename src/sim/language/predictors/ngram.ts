import { VOCABULARY } from './grammar'

/**
 * Part 4, Step 3's prediction from counts (spec §8.4): the probability of
 * each next word given the one word before it, and given the two words
 * before it, each a count divided by a count:
 *
 *   P(next | w1)      = count(w1 next) / count(w1 followed by anything)
 *   P(next | w2 w1)   = count(w2 w1 next) / count(w2 w1 followed by anything)
 *
 * Counted over the corpus as one stream, end marks included, so that a
 * sentence's first word follows the end mark before it.
 */
export interface Ngram {
  vocab: string[]
  uni: Map<number, number>
  bi: Map<string, number>
  tri: Map<string, number>
  biContext: Map<string, number>
}

export function makeNgram(tokens: readonly number[], vocab: string[] = VOCABULARY): Ngram {
  const uni = new Map<number, number>()
  const bi = new Map<string, number>()
  const tri = new Map<string, number>()
  const biContext = new Map<string, number>()
  for (let i = 0; i + 1 < tokens.length; i++) {
    uni.set(tokens[i], (uni.get(tokens[i]) ?? 0) + 1)
    const b = tokens[i] + ' ' + tokens[i + 1]
    bi.set(b, (bi.get(b) ?? 0) + 1)
    if (i + 2 < tokens.length) {
      biContext.set(b, (biContext.get(b) ?? 0) + 1)
      const t = b + ' ' + tokens[i + 2]
      tri.set(t, (tri.get(t) ?? 0) + 1)
    }
  }
  return { vocab, uni, bi, tri, biContext }
}

export interface Prediction {
  /** The probability of each word in the vocabulary as the next word. */
  probs: number[]
  /** The division behind each probability, for the panel: numerator and denominator. */
  numerators: number[]
  denominator: number
}

/** From the one word before. */
export function predictFromOne(n: Ngram, w1: number): Prediction {
  const denominator = n.uni.get(w1) ?? 0
  const numerators = n.vocab.map((_, j) => n.bi.get(w1 + ' ' + j) ?? 0)
  return { probs: numerators.map((c) => (denominator ? c / denominator : 0)), numerators, denominator }
}

/** From the two words before. */
export function predictFromTwo(n: Ngram, w2: number, w1: number): Prediction {
  const key = w2 + ' ' + w1
  const denominator = n.biContext.get(key) ?? 0
  const numerators = n.vocab.map((_, j) => n.tri.get(key + ' ' + j) ?? 0)
  return { probs: numerators.map((c) => (denominator ? c / denominator : 0)), numerators, denominator }
}
