import { describe, it, expect } from 'vitest'
import { makeRng } from '../../../random'
import { streamFor } from '../language'
import { testTrials, scoreTest } from '../test'
import { makeSrn, trainSrn, srnScorer, predictionErrors, HIDDEN, N, errorProfile } from './srn'

/**
 * The simple recurrent network learns the stream: after a few minutes its
 * prediction error is lower inside words than at word onsets (Elman, 1990,
 * Fig. 6), scoring moves no weight, and a stream fed in pieces gives the
 * same network as the stream fed at once.
 */
describe('the simple recurrent network', () => {
  it('has 12 inputs plus the context, 12 outputs, and is deterministic by seed', () => {
    const a = makeSrn(1)
    expect(a.hidden.length).toBe(HIDDEN)
    expect(a.hidden[0].weights.length).toBe(N + HIDDEN)
    expect(a.out.length).toBe(N)
    expect(a.hidden[3].weights).toEqual(makeSrn(1).hidden[3].weights)
  })
  it('after 7 minutes of a stream, its error at word onsets exceeds its error inside words, and the nonword test is above chance', () => {
    const s = streamFor(21, 504)
    const net = makeSrn(21)
    trainSrn(net, s.syllables)
    const probe = streamFor(22, 100)
    const errors = errorProfile(net, probe.syllables)
    // errors[i] is the error predicting syllable i+1 from syllable i; the prediction of a word's first syllable (position 0) is the onset case.
    const onset: number[] = []
    const inside: number[] = []
    errors.forEach((e, i) => (probe.position[i + 1] === 0 ? onset : inside).push(e))
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
    expect(mean(onset)).toBeGreaterThan(mean(inside))
    const score = scoreTest(testTrials('nonword', makeRng(1)), srnScorer(net), makeRng(2))
    expect(score).toBeGreaterThan(60)
  })
  it('scoring moves no weight, and training in pieces equals training at once', () => {
    const s = streamFor(5, 200)
    const net = makeSrn(5)
    trainSrn(net, s.syllables)
    const before = JSON.stringify(net.hidden.map((u) => u.weights))
    predictionErrors(net, ['ba', 'bu', 'pu'])
    srnScorer(net)(['tu', 'ti', 'bu'])
    expect(JSON.stringify(net.hidden.map((u) => u.weights))).toBe(before)
    const pieces = makeSrn(5)
    trainSrn(pieces, s.syllables, 0, 200)
    trainSrn(pieces, s.syllables, 199, 400)
    trainSrn(pieces, s.syllables, 399, s.syllables.length)
    expect(JSON.stringify(pieces.hidden.map((u) => u.weights))).toBe(before)
  })
})
