import { describe, it, expect } from 'vitest'
import { makeRng } from '../../random'
import { WORDS, SYLLABLES, countPairs, streamFor, tpTable, transitionalProbability, withinWord, wordAverageTp, wordOrder } from './language'
import { nonwords, partwords, testTrials, scoreTest, nonwordPairsAbsent, possiblePairs } from './test'
import { trainDips, dipsScorer, dipsCuts } from './learners/dips'

/**
 * Spec §14, Part 2: transitional probabilities from a stream equal counts
 * divided by counts, on a fixture; the stream never repeats a word; the
 * foils follow the paper's rules; the dips learner's score and cuts are
 * what its rule says.
 */
describe('the language and the stream', () => {
  it('six words of twelve syllables; the paper’s ranges of transitional probability hold on a long stream', () => {
    expect(WORDS.length).toBe(6)
    // The inventory is 12 syllables (p. 612); the six words use 11 of them, and di occurs only in test foils.
    expect(new Set(WORDS.flatMap((w) => [w.slice(0, 2), w.slice(2, 4), w.slice(4, 6)])).size).toBe(11)
    expect(SYLLABLES.length).toBe(12)
    const s = streamFor(5, 1512)
    expect(s.syllables.length).toBe(4536)
    for (let i = 1; i < s.words.length; i++) expect(s.words[i]).not.toBe(s.words[i - 1])
    const t = tpTable(s.syllables)
    const within: number[] = []
    const across: number[] = []
    SYLLABLES.forEach((a, i) => SYLLABLES.forEach((b, j) => (t[i][j] > 0 ? (withinWord(a, b) ? within : across).push(t[i][j]) : null)))
    // The paper gives 0.31 to 1.0 within words (p. 612); counted as count of pair over count of first syllable, bu to pa and bu to pu come to about 0.25, since bu occurs in four words and ends two of them. Recorded in the as-built notes.
    expect(Math.min(...within)).toBeGreaterThan(0.2)
    expect(Math.max(...within)).toBeLessThanOrEqual(1)
    // The paper gives 0.1 to 0.2 across boundaries (p. 612); a long stream's table puts the lowest across-boundary pair near 0.05. Recorded in the as-built notes.
    expect(Math.max(...across)).toBeLessThan(0.3)
    expect(Math.min(...across)).toBeGreaterThan(0.03)
  })
  it('a transitional probability is a count divided by a count, on a fixture', () => {
    const c = countPairs(['pa', 'tu', 'bi', 'pa', 'tu', 'bi', 'pa', 'da'])
    expect(c.single.get('pa')).toBe(3)
    expect(c.pair.get('pa tu')).toBe(2)
    expect(transitionalProbability(c, 'pa', 'tu')).toBeCloseTo(2 / 3)
    expect(transitionalProbability(c, 'tu', 'bi')).toBe(1)
    expect(transitionalProbability(c, 'bi', 'pa')).toBe(1)
    expect(transitionalProbability(c, 'da', 'pa')).toBe(0)
  })
  it('the same seed gives the same stream, and different seeds differ; a shorter stream is the beginning of a longer one', () => {
    expect(streamFor(3, 100).words).toEqual(streamFor(3, 100).words)
    expect(streamFor(3, 100).words).not.toEqual(streamFor(4, 100).words)
    expect(streamFor(3, 500).words.slice(0, 100)).toEqual(streamFor(3, 100).words)
    expect(wordOrder(makeRng(1), 50).length).toBe(50)
  })
  it('the words’ average transitional probabilities split as the paper reports: three high (1.0, .75, .75) and three low (.5, .41, .37) on a long stream', () => {
    const t = tpTable(streamFor(11, 1512).syllables)
    const avgs = WORDS.map((w) => wordAverageTp(t, w)).sort((a, b) => b - a)
    expect(avgs[0]).toBeCloseTo(1, 1)
    expect(avgs[2]).toBeGreaterThan(0.65)
    expect(avgs[3]).toBeLessThan(0.6)
    expect(avgs[5]).toBeLessThan(0.45)
  })
})

describe('the 36-trial tests', () => {
  it('six nonwords whose pairs never occur in any stream; six part-words, the paper’s two among them, each a word’s pair plus another syllable', () => {
    const nw = nonwords()
    expect(nw.length).toBe(6)
    const possible = possiblePairs()
    for (const f of nw) {
      expect(possible.has(f.syllables[0] + ' ' + f.syllables[1])).toBe(false)
      expect(possible.has(f.syllables[1] + ' ' + f.syllables[2])).toBe(false)
    }
    expect(nonwordPairsAbsent(streamFor(2, 1512))).toBe(true)
    const pw = partwords()
    expect(pw.length).toBe(6)
    expect(pw.map((f) => f.syllables.join(''))).toContain('pidata')
    expect(pw.map((f) => f.syllables.join(''))).toContain('bitaba')
    for (const f of pw) {
      const [a, b, c] = f.syllables
      expect(withinWord(a, b) || withinWord(b, c), f.syllables.join('')).toBe(true)
      expect(WORDS).not.toContain(f.syllables.join(''))
    }
    expect(new Set([...nw, ...pw].map((f) => f.syllables.join(''))).size).toBe(12)
  })
  it('each version pairs every word with every foil once: 36 trials', () => {
    for (const kind of ['nonword', 'partword'] as const) {
      const trials = testTrials(kind, makeRng(1))
      expect(trials.length).toBe(36)
      const keys = new Set(trials.map((t) => t.word.join('') + '|' + t.foil.syllables.join('')))
      expect(keys.size).toBe(36)
    }
  })
  it('a scorer that favors the word scores 100, one that favors the foil 0, and a constant scorer about 50 by the seeded tie-break', () => {
    const trials = testTrials('nonword', makeRng(2))
    expect(scoreTest(trials, (s) => (WORDS.includes(s.join('') as never) ? 1 : 0), makeRng(1))).toBe(100)
    expect(scoreTest(trials, (s) => (WORDS.includes(s.join('') as never) ? 0 : 1), makeRng(1))).toBe(0)
    let sum = 0
    for (let k = 0; k < 50; k++) sum += scoreTest(trials, () => 0, makeRng(k))
    expect(sum / 50).toBeGreaterThan(40)
    expect(sum / 50).toBeLessThan(60)
  })
})

describe('the dips learner', () => {
  it('its score is the mean transitional probability inside a string, and its cuts are the local dips', () => {
    const l = trainDips(['pa', 'tu', 'bi', 'pa', 'tu', 'bi', 'da', 'ta', 'pa', 'tu', 'bi'])
    const score = dipsScorer(l)
    expect(score(['pa', 'tu', 'bi'])).toBeCloseTo(1)
    expect(score(['bi', 'da', 'ta'])).toBeCloseTo((1 / 3 + 1) / 2)
    // tp: pa→tu 1, tu→bi 1, bi→pa 1/3, pa→tu 1, tu→bi 1, bi→da 1/3, da→ta 1, ta→pa 1, pa→tu 1, tu→bi 1
    expect(dipsCuts(l, ['pa', 'tu', 'bi', 'pa', 'tu', 'bi', 'da', 'ta', 'pa', 'tu', 'bi'])).toEqual([3, 6])
  })
  it('on 21 minutes of the language it passes the nonword test outright and does worse on part-words', () => {
    const s = streamFor(9, 1512)
    const l = trainDips(s.syllables)
    const nonword = scoreTest(testTrials('nonword', makeRng(1)), dipsScorer(l), makeRng(2))
    const partword = scoreTest(testTrials('partword', makeRng(1)), dipsScorer(l), makeRng(2))
    expect(nonword).toBe(100)
    expect(partword).toBeLessThanOrEqual(nonword)
  })
})
