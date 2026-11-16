import type { Rng } from '../../random'
import { SYLLABLES, WORDS, countPairs, syllablesOf, type Stream, type Syllable } from './language'

/**
 * The original's 36-trial test in two versions (Saffran, Newport and Aslin,
 * 1996, p. 613): each of the six words against each of six foils, every
 * word paired with every foil once. The paper names two foils (the
 * part-words *pidata* and *bitaba*) and gives the rules for the rest:
 *
 *   nonwords    three syllables from the language that never followed one
 *               another in the stream, even across word boundaries, so that
 *               every transitional probability inside them is zero
 *   part-words  three made of a word's first two syllables plus another
 *               syllable (like pidata), and three of a word's last two
 *               syllables plus another (like bitaba)
 *
 * The paper does not list all twelve, so the rest are built here by its
 * rules, deterministically, and listed in the as-built notes. The paper's
 * own part-words show that the added syllable need not make a sequence the
 * stream contains (bi never precedes ta in any stream); the four built here
 * take an added syllable that does occur next to the pair across a word
 * boundary, which makes them the harder kind. The nonwords are chosen so
 * that no two of their pairs occur anywhere in any stream of the language.
 */

export type Foil = { kind: 'nonword' | 'partword'; syllables: Syllable[] }

/** The pairs that can ever occur in a stream: inside a word, or across a boundary from one word's last syllable to another's first. */
export function possiblePairs(): Set<string> {
  const s = new Set<string>()
  for (const w of WORDS) {
    const [a, b, c] = syllablesOf(w)
    s.add(a + ' ' + b)
    s.add(b + ' ' + c)
  }
  for (const w of WORDS) for (const v of WORDS) if (w !== v) s.add(syllablesOf(w)[2] + ' ' + syllablesOf(v)[0])
  return s
}

/** The six nonwords: three-syllable strings of the language's syllables in which neither pair ever occurs in any stream. Chosen in a fixed order so that every syllable is used and no nonword repeats a pair. */
export function nonwords(): Foil[] {
  const possible = possiblePairs()
  const used = new Set<string>()
  const out: Foil[] = []
  const syl = [...SYLLABLES]
  outer: for (const a of syl) {
    for (const b of syl) {
      if (a === b || possible.has(a + ' ' + b) || used.has(a + ' ' + b)) continue
      for (const c of syl) {
        if (c === a || c === b || possible.has(b + ' ' + c) || used.has(b + ' ' + c)) continue
        if (out.some((f) => f.syllables.join('') === a + b + c)) continue
        out.push({ kind: 'nonword', syllables: [a, b, c] })
        used.add(a + ' ' + b)
        used.add(b + ' ' + c)
        if (out.length === 6) break outer
        break
      }
    }
  }
  return out
}

/** The six part-words: the paper's two, pidata and bitaba, and four more by its rule: a word's first two syllables plus another syllable, or a word's last two plus another. */
export function partwords(): Foil[] {
  const firsts = new Set(WORDS.map((w) => syllablesOf(w)[0]))
  const lasts = new Set(WORDS.map((w) => syllablesOf(w)[2]))
  const out: Foil[] = [
    { kind: 'partword', syllables: ['pi', 'da', 'ta'] }, // the paper's: pidabu's last syllable altered (p. 613)
    { kind: 'partword', syllables: ['bi', 'ta', 'ba'] }, // the paper's: dutaba's first syllable altered (p. 613)
  ]
  // Two more of the first kind: from bupada and tutibu, with a following word's first syllable.
  for (const [w, add] of [
    ['bupada', 'du'],
    ['tutibu', 'pa'],
  ] as const) {
    const [a, b] = syllablesOf(w)
    if (!firsts.has(add as Syllable)) throw new Error('not a word-initial syllable')
    out.push({ kind: 'partword', syllables: [a, b, add as Syllable] })
  }
  // Two more of the second kind: from babupu and patubi, with a preceding word's last syllable.
  for (const [w, add] of [
    ['babupu', 'bi'],
    ['patubi', 'da'],
  ] as const) {
    const [, b, c] = syllablesOf(w)
    if (!lasts.has(add as Syllable)) throw new Error('not a word-final syllable')
    out.push({ kind: 'partword', syllables: [add as Syllable, b, c] })
  }
  return out
}

export interface Trial {
  word: Syllable[]
  foil: Foil
  /** Whether the word is played first. */
  wordFirst: boolean
}

/** One version of the 36-trial test: every word with every foil, in a seeded order, the word first on a seeded half. */
export function testTrials(kind: 'nonword' | 'partword', rng: Rng): Trial[] {
  const foils = kind === 'nonword' ? nonwords() : partwords()
  const trials: Trial[] = []
  for (const w of WORDS) for (const f of foils) trials.push({ word: syllablesOf(w), foil: f, wordFirst: rng.next() < 0.5 })
  for (let i = trials.length - 1; i > 0; i--) {
    const j = rng.int(i + 1)
    ;[trials[i], trials[j]] = [trials[j], trials[i]]
  }
  return trials
}

/** A learner's scorer: a number for any three-syllable string, higher meaning more word-like. */
export type Scorer = (syllables: readonly Syllable[]) => number

/** The percentage correct on a test: on each trial the learner's choice is the string with the higher score; a tie is broken by the seeded stream. */
export function scoreTest(trials: readonly Trial[], score: Scorer, rng: Rng): number {
  let correct = 0
  for (const t of trials) {
    const sw = score(t.word)
    const sf = score(t.foil.syllables)
    if (sw > sf) correct++
    else if (sw === sf && rng.next() < 0.5) correct++
  }
  return (100 * correct) / trials.length
}

/**
 * The test rule of Perruchet and Vinter (1998, p. 256), for a learner that
 * recognizes strings rather than scoring them: on each trial the word is
 * chosen if the learner has it as one unit above its threshold, and
 * otherwise the choice is random, by the seeded stream. The rule looks at
 * the word alone, so it cannot be written as a `Scorer`; the learner is
 * still given a string and nothing about which string is the word.
 */
export function scoreTestByRecognition(trials: readonly Trial[], knows: (syllables: readonly Syllable[]) => boolean, rng: Rng): number {
  let correct = 0
  for (const t of trials) {
    if (knows(t.word)) correct++
    else if (rng.next() < 0.5) correct++
  }
  return (100 * correct) / trials.length
}

/** A check used by the tests: every nonword's pairs are absent from this stream. */
export function nonwordPairsAbsent(stream: Stream): boolean {
  const c = countPairs(stream.syllables)
  return nonwords().every((f) => !c.pair.has(f.syllables[0] + ' ' + f.syllables[1]) && !c.pair.has(f.syllables[1] + ' ' + f.syllables[2]))
}
