import type { Rng } from '../../../random'
import type { Trial } from '../design'

/**
 * Tallying (spec §7.3). For every trial, it adds one to the count of the
 * word with every object present. On each occurrence, it picks among the
 * objects present with probabilities proportional to each object's count
 * with the word raised to the power β, so that a larger β favors the
 * highest count more strongly (β = 0 picks at random). It stores a count
 * for every word with every object, and reads no record of its own past
 * picks (structural test in `structure.test.ts`). Its one parameter is β.
 * The count is added before the pick, so the first occurrence is a pick
 * among equal counts.
 */
export interface Tally {
  beta: number
  counts: number[][]
}

export function makeTally(beta: number, nWords: number, nObjects: number): Tally {
  return { beta, counts: Array.from({ length: nWords }, () => Array(nObjects).fill(0)) }
}

export function tallyChoose(m: Tally, t: Trial, rng: Rng): number {
  const row = m.counts[t.word]
  for (const o of t.objects) row[o] += 1
  const w = t.objects.map((o) => Math.pow(row[o], m.beta))
  const total = w.reduce((a, b) => a + b, 0)
  let r = rng.next() * total
  for (let i = 0; i < t.objects.length; i++) {
    r -= w[i]
    if (r <= 0) return t.objects[i]
  }
  return t.objects[t.objects.length - 1]
}
