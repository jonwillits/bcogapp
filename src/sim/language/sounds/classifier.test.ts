import { describe, it, expect } from 'vitest'
import { makeClassifier, train, accuracy, forward, shares, splitRun1, HIDDEN, INPUTS, LABELS, type Token } from './classifier'
import { loadShippedTokens } from './tokens.node'

/**
 * Spec §14, Part 1: the classifier learns through Lab 7's rule (the
 * one-writer test holds it to learnWeights), is deterministic by seed, and
 * on the shipped tokens learns the held-out voices well above chance. Its
 * inputs equal the spectrogram's patch for the same sound by construction
 * (`tokens.node.ts` and the browser's loader both call `classifierPatch`).
 */
describe('the classifier', () => {
  it('has the spec’s shape, and the same seed gives the same network', () => {
    const a = makeClassifier(3)
    const b = makeClassifier(3)
    expect(a.hidden.length).toBe(HIDDEN)
    expect(a.hidden[0].weights.length).toBe(INPUTS)
    expect(a.out.length).toBe(LABELS.length)
    expect(a.hidden[2].weights).toEqual(b.hidden[2].weights)
    expect(shares([1, 1, 2])).toEqual([0.25, 0.25, 0.5])
  })
  it('learns a separable toy: three patterns to three labels', () => {
    const rngPatch = (k: number) => {
      const p = new Float32Array(INPUTS)
      for (let i = 0; i < INPUTS; i++) p[i] = (i % 3 === k ? 0.9 : 0.1) + ((i * 7919) % 13) / 130
      return p
    }
    const tokens: Token[] = LABELS.flatMap((label, k) => Array.from({ length: 10 }, (_, v) => ({ patch: rngPatch(k), label, voice: v, shift: 0, vowel: 'ah' })))
    const c = makeClassifier(1)
    train(c, tokens, tokens, 1, 6)
    expect(accuracy(c, tokens)).toBe(100)
    expect(forward(c, tokens[0].patch).o.length).toBe(3)
  })
  it('on the shipped tokens, trained on ten voices, it labels the two held-out voices well above chance (one seed)', () => {
    const s = loadShippedTokens()
    expect(s.tokens.length).toBe(540)
    const { training, test } = splitRun1(s.tokens, s.heldOutVoices)
    expect(training.length).toBe(450)
    expect(test.length).toBe(90)
    const c = makeClassifier(7)
    train(c, training, test, 7)
    expect(c.curve.length).toBe(12)
    expect(accuracy(c, test)).toBeGreaterThan(50)
  })
})
