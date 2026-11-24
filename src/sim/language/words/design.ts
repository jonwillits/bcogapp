import { makeRng, type Rng } from '../../random'

/**
 * Part 3's design (spec §7.2), after Trueswell, Medina, Hafri and Gleitman
 * (2013). Until 2026-11-23 it was their Experiment 1: five objects a trial,
 * on which people reach only about 0.3 to 0.4 and Jon, walking it, gave up
 * at chance. It is now their Experiment 3's all-two-object condition
 * (pp. 141 to 142): 12 words, each occurring 5 times in the learning
 * trials, each time with its own object and 1 other drawn by the seed, in
 * 2 screen positions shuffled each trial: 60 trials. Chance is 1 in 2, and
 * the paper's learners rise from 0.50 to 0.90 by the fifth occurrence. The
 * other object on a word's trials is never the same object on more than 2
 * of its 5 trials (the paper's rule, p. 133). The order never puts one
 * word on two neighboring trials. The test, the spec's addition: each word
 * once more, with its own object and 3 others: 12 trials. The pairing of
 * words and objects is drawn by the seed. A reserve set of 12 words and 12
 * objects is used if the unit was interrupted (spec §4.1); its seed is a
 * fork of the same.
 */

export const WORDS_PER_SET = 12
export const OCCURRENCES = 5
export const LEARNING_TRIALS = WORDS_PER_SET * OCCURRENCES
export const OBJECTS_ON_SCREEN = 2
/** How many of a word's trials may show the same other object (Trueswell et al., 2013, p. 133). */
export const MAX_SAME_OTHER = 2
export const TEST_OBJECTS = 4

export interface Trial {
  /** The word's index, 0 to 11. */
  word: number
  /** The objects on screen, by index 0 to 11, in screen order; the target is among them. */
  objects: number[]
  /** This occurrence of the word, 1 to 5 (or 6 for the test). */
  occurrence: number
}

export interface Design {
  /** pairing[w] is the object index that word w names. */
  pairing: number[]
  learning: Trial[]
  test: Trial[]
}

function shuffle<T>(rng: Rng, xs: T[]): T[] {
  const a = xs.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = rng.int(i + 1)
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** An order of 60 word indices, each word 5 times, no word twice in a row: shuffled rounds with a repair at each round boundary. */
export function wordSequence(rng: Rng): number[] {
  for (let attempt = 0; attempt < 1000; attempt++) {
    const seq: number[] = []
    let ok = true
    for (let r = 0; r < OCCURRENCES; r++) {
      let round = shuffle(rng, Array.from({ length: WORDS_PER_SET }, (_, i) => i))
      let tries = 0
      while (seq.length && round[0] === seq[seq.length - 1] && tries++ < 50) round = shuffle(rng, round)
      if (seq.length && round[0] === seq[seq.length - 1]) {
        ok = false
        break
      }
      seq.push(...round)
    }
    if (ok) return seq
  }
  throw new Error('no sequence')
}

export function makeDesign(seed: number, materials: 0 | 1): Design {
  const rng = makeRng((seed ^ 0x3d5e) + materials * 7919)
  const pairing = shuffle(rng, Array.from({ length: WORDS_PER_SET }, (_, i) => i))
  const seq = wordSequence(rng)
  const seen = Array(WORDS_PER_SET).fill(0)
  /** with[w][o]: how many of word w's trials have shown object o as the other object. */
  const withCount = Array.from({ length: WORDS_PER_SET }, () => Array(WORDS_PER_SET).fill(0))
  const others = (target: number, n: number, allowed: (o: number) => boolean = () => true) => shuffle(rng, Array.from({ length: WORDS_PER_SET }, (_, i) => i).filter((o) => o !== target && allowed(o))).slice(0, n)
  const learning: Trial[] = seq.map((w) => {
    seen[w]++
    const target = pairing[w]
    const rest = others(target, OBJECTS_ON_SCREEN - 1, (o) => withCount[w][o] < MAX_SAME_OTHER)
    for (const o of rest) withCount[w][o]++
    return { word: w, objects: shuffle(rng, [target, ...rest]), occurrence: seen[w] }
  })
  const test: Trial[] = shuffle(rng, Array.from({ length: WORDS_PER_SET }, (_, i) => i)).map((w) => {
    const target = pairing[w]
    return { word: w, objects: shuffle(rng, [target, ...others(target, TEST_OBJECTS - 1)]), occurrence: OCCURRENCES + 1 }
  })
  return { pairing, learning, test }
}

export function isCorrect(d: Design, t: Trial, chosen: number): boolean {
  return d.pairing[t.word] === chosen
}
