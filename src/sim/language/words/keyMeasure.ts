import { isCorrect, OCCURRENCES, type Design, type Trial } from './design'

/**
 * The key measure (spec §7.3): the share of choices correct on a word's
 * next occurrence, split by whether the choice for that word just before
 * was right or wrong, pooled over occurrences 2 to 5 of each word: 12
 * words × 4 = 48 pairs of choices. Also the overall accuracy over
 * occurrences 2 to 5, which is what each model's one parameter is fitted
 * to (and the key measure is not).
 */
export interface KeyMeasure {
  /** Correct on the next occurrence after a right choice: count correct, count of such pairs. */
  afterRight: { correct: number; n: number }
  afterWrong: { correct: number; n: number }
  /** Over occurrences 2 to 5. */
  accuracy: number
  /** Accuracy at each occurrence 1 to 5, as shares. */
  byOccurrence: number[]
}

export function keyMeasure(d: Design, choices: readonly number[]): KeyMeasure {
  const byWord: Trial[][] = Array.from({ length: d.pairing.length }, () => [])
  const chosenByWord: number[][] = Array.from({ length: d.pairing.length }, () => [])
  d.learning.forEach((t, i) => {
    byWord[t.word].push(t)
    chosenByWord[t.word].push(choices[i])
  })
  const afterRight = { correct: 0, n: 0 }
  const afterWrong = { correct: 0, n: 0 }
  let correctLater = 0
  let nLater = 0
  const occ = Array.from({ length: OCCURRENCES }, () => ({ c: 0, n: 0 }))
  byWord.forEach((trials, w) => {
    trials.forEach((t, k) => {
      const right = isCorrect(d, t, chosenByWord[w][k])
      occ[t.occurrence - 1].n++
      if (right) occ[t.occurrence - 1].c++
      if (k === 0) return
      const prevRight = isCorrect(d, trials[k - 1], chosenByWord[w][k - 1])
      const cell = prevRight ? afterRight : afterWrong
      cell.n++
      if (right) cell.correct++
      nLater++
      if (right) correctLater++
    })
  })
  return { afterRight, afterWrong, accuracy: nLater ? correctLater / nLater : 0, byOccurrence: occ.map((o) => (o.n ? o.c / o.n : 0)) }
}

export const share = (c: { correct: number; n: number }) => (c.n ? c.correct / c.n : NaN)
