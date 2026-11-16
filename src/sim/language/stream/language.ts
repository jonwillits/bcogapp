import { makeRng, type Rng } from '../../random'

/**
 * Part 2's language (spec §6): Saffran, Newport and Aslin's (1996, JML)
 * Experiment 1 language, p. 612. Four consonants (p, t, b, d) and three
 * vowels (a, i, u) make 12 syllables, which form six three-syllable words.
 * A stream puts the words in a random order, never the same word twice in
 * a row, as the original did (p. 612); the seed draws each student's
 * stream, and Steps 1 to 3 use the same stream from its beginning.
 *
 * The rate is 216 syllables a minute (p. 612), so one minute is 216
 * syllables (72 words), and 21 minutes is 4,536 syllables (1,512 words),
 * the original's whole exposure.
 */

export const WORDS = ['babupu', 'bupada', 'dutaba', 'patubi', 'pidabu', 'tutibu'] as const
export type Word = (typeof WORDS)[number]
export const SYLLABLES = ['pa', 'pi', 'pu', 'ta', 'ti', 'tu', 'ba', 'bi', 'bu', 'da', 'di', 'du'] as const
export type Syllable = (typeof SYLLABLES)[number]
export const SYLLABLES_PER_MINUTE = 216
export const WORDS_PER_MINUTE = SYLLABLES_PER_MINUTE / 3

export function syllablesOf(word: string): Syllable[] {
  return [word.slice(0, 2), word.slice(2, 4), word.slice(4, 6)] as Syllable[]
}

/** The word order of a stream of `nWords` words, from a seeded stream: no word twice in a row. */
export function wordOrder(rng: Rng, nWords: number): Word[] {
  const out: Word[] = []
  let last: Word | null = null
  for (let i = 0; i < nWords; i++) {
    const choices = WORDS.filter((w) => w !== last)
    const w = choices[rng.int(choices.length)]
    out.push(w)
    last = w
  }
  return out
}

export interface Stream {
  words: Word[]
  syllables: Syllable[]
  /** For each syllable, the index of its word in `words`. */
  wordIndex: number[]
  /** For each syllable, its position in its word: 0, 1 or 2. */
  position: number[]
}

/** The student's stream: the first `nWords` words of the sequence the seed draws (the same beginning for any length). */
export function streamFor(seed: number, nWords: number): Stream {
  const words = wordOrder(makeRng(seed ^ 0x5af2a), nWords)
  const syllables: Syllable[] = []
  const wordIndex: number[] = []
  const position: number[] = []
  words.forEach((w, i) => {
    syllablesOf(w).forEach((s, k) => {
      syllables.push(s)
      wordIndex.push(i)
      position.push(k)
    })
  })
  return { words, syllables, wordIndex, position }
}

/** The transitional probability from one syllable to the next: the count of the pair divided by the count of the first (§13.2.3). */
export interface Counts {
  single: Map<string, number>
  pair: Map<string, number>
}

export function countPairs(syllables: readonly string[]): Counts {
  const single = new Map<string, number>()
  const pair = new Map<string, number>()
  for (let i = 0; i < syllables.length; i++) {
    single.set(syllables[i], (single.get(syllables[i]) ?? 0) + 1)
    if (i + 1 < syllables.length) {
      const k = syllables[i] + ' ' + syllables[i + 1]
      pair.set(k, (pair.get(k) ?? 0) + 1)
    }
  }
  return { single, pair }
}

export function transitionalProbability(c: Counts, a: string, b: string): number {
  const n = c.single.get(a) ?? 0
  return n === 0 ? 0 : (c.pair.get(a + ' ' + b) ?? 0) / n
}

/** The table of transitional probabilities between all 12 syllables, from a stream (Step 2's results, section 2). */
export function tpTable(syllables: readonly string[]): number[][] {
  const c = countPairs(syllables)
  return SYLLABLES.map((a) => SYLLABLES.map((b) => transitionalProbability(c, a, b)))
}

/** Whether a pair of syllables lies inside one of the six words, in that order. */
export function withinWord(a: string, b: string): boolean {
  return WORDS.some((w) => w.includes(a + b))
}

/** A word's average transitional probability inside it (the paper's measure, p. 614, footnote 3): the mean of its two internal transitions. */
export function wordAverageTp(table: number[][], word: string): number {
  const [s1, s2, s3] = syllablesOf(word)
  const i = (s: string) => SYLLABLES.indexOf(s as Syllable)
  return (table[i(s1)][i(s2)] + table[i(s2)][i(s3)]) / 2
}
