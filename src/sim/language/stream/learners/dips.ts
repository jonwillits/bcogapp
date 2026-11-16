import { countPairs, transitionalProbability, type Counts, type Syllable } from '../language'
import type { Scorer } from '../test'

/**
 * The first learner (spec §6.3): cut at the dips. It counts every pair of
 * neighboring syllables it has taken in, computes the transitional
 * probability of each, and places a cut wherever the transitional
 * probability is lower than at both neighboring pairs (§13.2.3). Its score
 * for a test string is the mean transitional probability inside the string.
 * It reads only the syllables it has taken in: never the word list or the
 * true boundaries (structural test in `structure.test.ts`).
 */
export interface DipsLearner {
  counts: Counts
  heard: number
}

export function trainDips(syllables: readonly Syllable[]): DipsLearner {
  return { counts: countPairs(syllables), heard: syllables.length }
}

export function dipsScorer(l: DipsLearner): Scorer {
  return (s) => {
    let sum = 0
    for (let i = 0; i + 1 < s.length; i++) sum += transitionalProbability(l.counts, s[i], s[i + 1])
    return sum / (s.length - 1)
  }
}

/** Where the learner cuts a sequence: before syllable i+1 wherever the transition i is lower than transitions i−1 and i+1. Returns the cut positions (the index of the syllable a cut precedes). */
export function dipsCuts(l: DipsLearner, syllables: readonly string[]): number[] {
  const tp: number[] = []
  for (let i = 0; i + 1 < syllables.length; i++) tp.push(transitionalProbability(l.counts, syllables[i], syllables[i + 1]))
  const cuts: number[] = []
  for (let i = 1; i + 1 < tp.length; i++) if (tp[i] < tp[i - 1] && tp[i] < tp[i + 1]) cuts.push(i + 1)
  return cuts
}
