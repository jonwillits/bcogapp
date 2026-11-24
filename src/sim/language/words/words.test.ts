import { describe, it, expect } from 'vitest'
import { makeRng } from '../../random'
import { demoConsistent, DEMO_TRIALS } from '../../../scenes/m13_language/words/demo'
import { makeDesign, LEARNING_TRIALS, MAX_SAME_OTHER, OBJECTS_ON_SCREEN, TEST_OBJECTS, WORDS_PER_SET, isCorrect } from './design'
import { keyMeasure, share } from './keyMeasure'
import { makeGuessCheck, guessCheckChoose } from './models/guessCheck'
import { makeTally, tallyChoose } from './models/tally'
import { fit, runModel, runs } from './fit'

/**
 * Spec §14, Part 3: the design's counts; each model, run on a fixture of
 * trials, reproduces hand-computed choices for fixed draws; guess and
 * check stores at most one object per word; the fitting finds each model's
 * parameter near the value that matches a scripted accuracy.
 */
describe('the design', () => {
  it('60 learning trials, each word 5 times, never on neighboring trials, 2 objects with the target, the other object the same on at most 2 of a word’s trials (Trueswell et al., 2013, p. 133); 12 test trials with 4', () => {
    for (const seed of [1, 2, 3]) {
      for (const m of [0, 1] as const) {
        const d = makeDesign(seed, m)
        // The paper's rule: no other object on more than MAX_SAME_OTHER of a word's 5 trials.
        for (let w = 0; w < WORDS_PER_SET; w++) {
          const withCount = Array(WORDS_PER_SET).fill(0)
          for (const t of d.learning.filter((t) => t.word === w)) for (const o of t.objects) if (o !== d.pairing[w]) withCount[o]++
          expect(Math.max(...withCount)).toBeLessThanOrEqual(MAX_SAME_OTHER)
        }
        expect(d.learning.length).toBe(LEARNING_TRIALS)
        const counts = Array(WORDS_PER_SET).fill(0)
        d.learning.forEach((t, i) => {
          counts[t.word]++
          expect(t.objects.length).toBe(OBJECTS_ON_SCREEN)
          expect(new Set(t.objects).size).toBe(OBJECTS_ON_SCREEN)
          expect(t.objects).toContain(d.pairing[t.word])
          if (i > 0) expect(t.word).not.toBe(d.learning[i - 1].word)
          expect(t.occurrence).toBe(counts[t.word])
        })
        expect(counts.every((c) => c === 5)).toBe(true)
        expect(d.test.length).toBe(WORDS_PER_SET)
        for (const t of d.test) {
          expect(t.objects.length).toBe(TEST_OBJECTS)
          expect(t.objects).toContain(d.pairing[t.word])
        }
        expect(new Set(d.pairing).size).toBe(WORDS_PER_SET)
      }
      expect(makeDesign(seed, 0).pairing).not.toEqual(makeDesign(seed, 1).pairing)
      expect(makeDesign(seed, 0).learning).toEqual(makeDesign(seed, 0).learning)
    }
  })
})

describe('the key measure', () => {
  it('counts 48 pairs, and splits them by the previous choice', () => {
    const d = makeDesign(4, 0)
    const perfect = d.learning.map((t) => d.pairing[t.word])
    const k = keyMeasure(d, perfect)
    expect(k.afterRight.n + k.afterWrong.n).toBe(48)
    expect(k.afterRight.n).toBe(48)
    expect(share(k.afterRight)).toBe(1)
    expect(k.accuracy).toBe(1)
    expect(k.byOccurrence).toEqual([1, 1, 1, 1, 1])
    const wrong = d.learning.map((t) => t.objects.find((o) => o !== d.pairing[t.word])!)
    const kw = keyMeasure(d, wrong)
    expect(kw.afterWrong.n).toBe(48)
    expect(share(kw.afterWrong)).toBe(0)
  })
})

describe('the two models on a fixture', () => {
  const trials = [
    { word: 0, objects: [3, 1, 4, 0, 2], occurrence: 1 },
    { word: 0, objects: [5, 3, 6, 7, 8], occurrence: 2 },
    { word: 0, objects: [8, 9, 3, 10, 11], occurrence: 3 },
  ]
  it('guess and check: a first random pick, then the same object when it is recalled and present, else random; one object stored per word', () => {
    const fixed = (vals: number[]) => {
      let i = 0
      return { next: () => vals[i++ % vals.length], int: (n: number) => Math.floor(vals[i++ % vals.length] * n), range: () => 0, normal: () => 0, fork: () => fixed(vals) }
    }
    // Draws: pick index 0 (object 3); recall succeeds (0.1 < 0.9) and 3 is present: 3 again; recall succeeds and 3 is present: 3 again.
    const m = makeGuessCheck(0.9, 1)
    const rng = fixed([0.0, 0.1, 0.1])
    expect(guessCheckChoose(m, trials[0], rng)).toBe(3)
    expect(guessCheckChoose(m, trials[1], rng)).toBe(3)
    expect(guessCheckChoose(m, trials[2], rng)).toBe(3)
    expect(m.lastPick).toEqual([3])
    // Recall fails (0.95 > 0.9): a random pick, index 2 of the second trial's objects: 6.
    const m2 = makeGuessCheck(0.9, 1)
    const rng2 = fixed([0.0, 0.95, 0.4])
    expect(guessCheckChoose(m2, trials[0], rng2)).toBe(3)
    expect(guessCheckChoose(m2, trials[1], rng2)).toBe(6)
    expect(Object.keys(m2)).toEqual(['alpha', 'lastPick'])
  })
  it('tallying: counts add one for every object present, and β = 0 picks at random while a large β picks the highest count', () => {
    const m = makeTally(8, 1, 12)
    const rng = makeRng(1)
    tallyChoose(m, trials[0], rng)
    expect(m.counts[0].filter((c) => c === 1).length).toBe(5)
    // After trial 2, object 3 has count 2 and the rest 1; with β = 8 it is picked 256 times in 260.
    let threes = 0
    for (let k = 0; k < 100; k++) {
      const mm = makeTally(8, 1, 12)
      const r = makeRng(k)
      tallyChoose(mm, trials[0], r)
      if (tallyChoose(mm, trials[1], r) === 3) threes++
    }
    expect(threes).toBeGreaterThan(90)
    tallyChoose(m, trials[1], rng)
    expect(m.counts[0][3]).toBe(2)
    const flat = makeTally(0, 1, 12)
    const picks = new Set<number>()
    for (let k = 0; k < 200; k++) picks.add(tallyChoose(flat, trials[0], makeRng(k)))
    expect(picks.size).toBe(5)
  })
  it('the fit finds a parameter whose accuracy is near a scripted student’s, and the runs give each cell a mean and a range', () => {
    const d = makeDesign(9, 0)
    for (const model of ['guessCheck', 'tally'] as const) {
      const truth = model === 'guessCheck' ? 0.7 : 2
      const scripted = keyMeasure(d, runModel(model, truth, d, 123)).accuracy
      const r = fit(model, d, scripted, 5, 30)
      expect(Math.abs(r.accuracy - scripted)).toBeLessThan(0.06)
      const rr = runs(model, r.param, d, 7, 40)
      expect(rr.measures.length).toBe(40)
      expect(rr.afterWrong.lo).toBeLessThanOrEqual(rr.afterWrong.mean)
      expect(rr.afterWrong.mean).toBeLessThanOrEqual(rr.afterWrong.hi)
    }
    expect(isCorrect(d, d.learning[0], d.pairing[d.learning[0].word])).toBe(true)
  })

  it('the six-trial demonstration follows the two rules it names on every trial', () => {
    expect(DEMO_TRIALS.length).toBe(6)
    expect(demoConsistent()).toEqual([])
  })
})
