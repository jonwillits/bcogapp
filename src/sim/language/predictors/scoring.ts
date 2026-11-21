import { VOCABULARY, kindOf, verbOf, nextTokens, start, step } from './grammar'

/**
 * Three scores for a next-token predictor on a set of sentences (Jon,
 * 2026-11-20): every token after a sentence's first is predicted from the
 * tokens before it, as the training script's held-out accuracy did, and the
 * most probable token is scored three ways.
 *
 *   agreement: over the positions where the actual next token is a verb,
 *     the share where the most probable verb form, among the verb forms
 *     only, is in the same number as the actual verb (the number the subject
 *     requires); the probes of agreement by depth are scored the same way.
 *   kind: over every position, the share where the most probable token is
 *     of a kind (noun, verb, who, the end mark) the grammar allows next.
 *   exact: over every position, the share where the most probable token is
 *     the actual next token.
 */
export interface Scores {
  agreement: number
  kind: number
  exact: number
  /** How many positions were scored, and how many of them had a verb as the actual next token. */
  positions: number
  verbPositions: number
}

/** The kinds the grammar allows next after a prefix: empty when the prefix is not a sentence the grammar allows. */
export function allowedKinds(prefix: readonly string[]): Set<string> {
  let st = start()
  for (const t of prefix) st = step(st, t)
  const out = new Set<string>()
  if (!st.ok || st.complete) return out
  for (const t of nextTokens(st)) out.add(kindOf(t) ?? '')
  return out
}

/** The verb tokens' indices in the vocabulary, with each one's number. */
const VERB_INDICES = VOCABULARY.map((t, j) => ({ j, v: verbOf(t) })).filter((x) => x.v) as { j: number; v: NonNullable<ReturnType<typeof verbOf>> }[]

/**
 * Score a predictor on sentences. `predictions(ids)` returns, for a sentence
 * as token indices, the predictor's probabilities over the vocabulary for
 * each token after the first (an array one shorter than the sentence; all
 * zeros where the predictor has no prediction, which scores as wrong).
 */
export function scoreSentences(sentences: readonly string[][], predictions: (ids: number[]) => ArrayLike<number>[]): Scores {
  let agreement = 0
  let kind = 0
  let exact = 0
  let positions = 0
  let verbPositions = 0
  for (const s of sentences) {
    const ids = s.map((t) => VOCABULARY.indexOf(t))
    const pred = predictions(ids)
    // The parser follows the sentence token by token, so the allowed kinds at each position come from one pass.
    let st = start()
    for (let i = 1; i < s.length; i++) {
      st = step(st, s[i - 1])
      const probs = pred[i - 1]
      const p = argmax(probs)
      const word = p >= 0 ? VOCABULARY[p] : null
      positions++
      if (word === s[i]) exact++
      if (word && st.ok && !st.complete) {
        const k = kindOf(word)
        if (nextTokens(st).some((t) => kindOf(t) === k)) kind++
      }
      const actual = verbOf(s[i])
      if (actual) {
        verbPositions++
        let best: { j: number; v: { number: string } } | null = null
        for (const x of VERB_INDICES) if (probs[x.j] > 0 && (!best || probs[x.j] > probs[best.j])) best = x
        if (best && best.v.number === actual.number) agreement++
      }
    }
  }
  return { agreement: verbPositions ? agreement / verbPositions : 0, kind: positions ? kind / positions : 0, exact: positions ? exact / positions : 0, positions, verbPositions }
}

/** The index of the largest value, the first of equals; −1 when every value is zero or the array is empty. */
export function argmax(values: ArrayLike<number>): number {
  let best = -1
  for (let j = 0; j < values.length; j++) if (values[j] > 0 && (best < 0 || values[j] > values[best])) best = j
  return best
}
