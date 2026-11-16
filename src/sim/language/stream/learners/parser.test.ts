import { describe, it, expect } from 'vitest'
import { makeRng } from '../../../random'
import { streamFor, SYLLABLES, WORDS, syllablesOf, type Syllable } from '../language'
import { testTrials, scoreTest, scoreTestByRecognition, nonwords, partwords } from '../test'
import { makeParser, trainParser, step, parserScorer, parserKnows, strongestUnits, unitWeight, keyOf, FORGETTING, GAIN, INTERFERENCE, PERCEPT_MAX_UNITS, PERCEPT_MIN_UNITS, SHAPING_THRESHOLD, START_WEIGHT, TEST_THRESHOLD } from './parser'

/**
 * PARSER follows Perruchet and Vinter (1998): its one time step reproduces
 * the paper's worked example (Table 1, p. 252) to the last digit; its
 * parameters are the paper's; it is deterministic by seed; after enough of
 * the stream the six words are its strongest units; on a stream with no
 * words it favors no word; and both test rules give sensible scores.
 */
/** A string of two-letter syllables, of any length, as syllables. */
const syl = (s: string): Syllable[] => (s.length === 6 ? syllablesOf(s) : (s.match(/../g) as Syllable[]))

describe('PARSER', () => {
  it('carries the paper’s parameters and nothing else: percepts of 1 to 3 units, start 1, gain 0.5, forgetting 0.05, interference 0.005, thresholds 1 (pp. 250 to 252, p. 256)', () => {
    expect([PERCEPT_MIN_UNITS, PERCEPT_MAX_UNITS]).toEqual([1, 3])
    expect(START_WEIGHT).toBe(1)
    expect(GAIN).toBe(0.5)
    expect(FORGETTING).toBe(0.05)
    expect(INTERFERENCE).toBe(0.005)
    expect(SHAPING_THRESHOLD).toBe(1)
    expect(TEST_THRESHOLD).toBe(1)
  })
  it('starts as the 12 syllables at weight 1 (p. 250, p. 251), and is deterministic by seed', () => {
    const p = makeParser(1)
    expect(p.units.size).toBe(SYLLABLES.length)
    for (const s of SYLLABLES) expect(unitWeight(p, [s])).toBe(1)
    const s = streamFor(1, 300)
    const a = makeParser(1)
    const b = makeParser(1)
    const c = makeParser(2)
    trainParser(a, s.syllables)
    trainParser(b, s.syllables)
    trainParser(c, s.syllables)
    expect(strongestUnits(a, 20)).toEqual(strongestUnits(b, 20))
    expect(strongestUnits(a, 20)).not.toEqual(strongestUnits(c, 20))
    expect(a.heard).toBe(s.syllables.length)
  })
  it('reproduces Table 1 (p. 252): babupada perceived as ba, bupa, da creates a unit at 1, its components gain 0.5, bu and pa take interference, and every other unit forgets 0.05', () => {
    const p = makeParser(0)
    const set = (u: string, w: number) => {
      const s = syl(u)
      const key = keyOf(s)
      if (p.units.has(key)) p.units.get(key)!.weight = w
      else {
        p.units.set(key, { syllables: s, weight: w })
        let b = p.byFirst.get(s[0])
        if (!b) p.byFirst.set(s[0], (b = new Set()))
        b.add(key)
      }
    }
    // Column 1 of Table 1: the state after 44 syllables (the two primitives at their initial weight and the units below 1 are not listed).
    const initial: [string, number][] = [
      ['bu', 3.5],
      ['pa', 3.1],
      ['ba', 2.55],
      ['du', 2.5],
      ['ta', 2.5],
      ['tu', 2.45],
      ['da', 2.4],
      ['bi', 1.7],
      ['bupa', 1.58],
      ['pu', 1],
      ['puduta', 1],
    ]
    for (const [u, w] of initial) set(u, w)
    // The random generator gave 3 (step a); the stream continued babupada...
    p.rng = { ...p.rng, int: () => 2 }
    const stream = [...syl('babupa'), ...syl('dapida')] as Syllable[]
    expect(step(p, stream)).toBe(true)
    expect(p.heard).toBe(4)
    const final: [string, number][] = [
      ['bu', 3.445],
      ['pa', 3.045],
      ['ba', 3],
      ['du', 2.45],
      ['ta', 2.45],
      ['tu', 2.4],
      ['da', 2.85],
      ['bi', 1.65],
      ['bupa', 2.03],
      ['puduta', 0.95],
      ['babupada', 1],
    ]
    for (const [u, w] of final) expect(unitWeight(p, syl(u)), u).toBeCloseTo(w, 10)
    // Table 1 prints pu at 0.95; a primitive is maintained at its initial weight (p. 253), so it reads 1 here.
    expect(unitWeight(p, ['pu'])).toBe(1)
  })
  it('after 21 minutes of a stream the six words are its strongest units on most streams, and at 7 minutes a word is already a unit above the threshold on most', () => {
    let wordsOnTop = 0
    let aWordKnown = 0
    for (let seed = 40; seed < 50; seed++) {
      const s = streamFor(seed, 1512)
      const p = makeParser(seed)
      trainParser(p, s.syllables.slice(0, 1512))
      if (WORDS.some((w) => unitWeight(p, syl(w)) >= SHAPING_THRESHOLD)) aWordKnown++
      const q = makeParser(seed)
      trainParser(q, s.syllables)
      const top = strongestUnits(q, 6).map((u) => u.unit)
      if (top.length === 6 && top.every((u) => (WORDS as readonly string[]).includes(u))) wordsOnTop++
    }
    expect(wordsOnTop).toBeGreaterThanOrEqual(5)
    expect(aWordKnown).toBeGreaterThanOrEqual(8)
  })
  it('on a stream of the same syllables in a random order, no word is a strong unit', () => {
    const rng = makeRng(7)
    const random: Syllable[] = Array.from({ length: 4536 }, () => SYLLABLES[rng.int(SYLLABLES.length)])
    const p = makeParser(7)
    trainParser(p, random)
    for (const w of WORDS) expect(unitWeight(p, syl(w))).toBeLessThan(SHAPING_THRESHOLD)
    const top = strongestUnits(p, 6)
    expect(top.filter((u) => (WORDS as readonly string[]).includes(u.unit)).length).toBe(0)
  })
  it('the spec’s scorer is the weight as a unit or zero; the paper’s recognition is a unit above 1; both tests score near chance at 30 seconds and high at 21 minutes', () => {
    const s = streamFor(3, 1512)
    const p = makeParser(3)
    trainParser(p, s.syllables)
    const score = parserScorer(p)
    const knows = parserKnows(p)
    for (const w of WORDS) {
      expect(score(syl(w))).toBe(unitWeight(p, syl(w)))
      expect(knows(syl(w))).toBe(unitWeight(p, syl(w)) > 1)
    }
    for (const f of nonwords()) expect(score(f.syllables)).toBe(0)
    const nw = testTrials('nonword', makeRng(1))
    const pw = testTrials('partword', makeRng(2))
    expect(scoreTest(nw, score, makeRng(3))).toBeGreaterThan(90)
    expect(scoreTest(pw, score, makeRng(4))).toBeGreaterThan(90)
    expect(scoreTestByRecognition(nw, knows, makeRng(5))).toBeGreaterThan(90)
    expect(scoreTestByRecognition(pw, knows, makeRng(6))).toBeGreaterThan(90)
    const early = makeParser(3)
    trainParser(early, s.syllables.slice(0, 108))
    const e = scoreTestByRecognition(nw, parserKnows(early), makeRng(7))
    expect(e).toBeGreaterThanOrEqual(30)
    expect(e).toBeLessThanOrEqual(75)
    expect(partwords().length).toBe(6)
  })
  it('a nothing-known learner scores at chance under the paper’s rule, by the seeded stream', () => {
    const nw = testTrials('nonword', makeRng(1))
    const xs = Array.from({ length: 50 }, (_, i) => scoreTestByRecognition(nw, () => false, makeRng(100 + i)))
    const mean = xs.reduce((a, b) => a + b, 0) / xs.length
    expect(mean).toBeGreaterThan(42)
    expect(mean).toBeLessThan(58)
    expect(scoreTestByRecognition(nw, () => true, makeRng(1))).toBe(100)
  })
})
