import { describe, it, expect } from 'vitest'
import { makeRng } from '../../random'
import { corpus, SETTINGS, VOCABULARY, nounOf, verbOf } from './grammar'
import { makeCountModel, countStream, embedding, nearest, contribution, sameCounts, principalPlane, clusterTree, cosine, correlation } from './counts'
import { makeNgram, predictFromOne, predictFromTwo } from './ngram'

/**
 * Spec §14, Part 4: the count model's counts match a hand-worked fixture at
 * every window size; the two orders add the same counts when before and
 * after are not separated and the window spans the sentence, and different
 * counts when they are; the prediction from counts is a count divided by
 * a count; on the corpus, cat's nearest neighbors are animate nouns. The
 * one similarity measure of Step 2 is the Pearson correlation (Jon,
 * 2026-11-17), checked on a hand-worked fixture.
 */
const idx = (t: string) => VOCABULARY.indexOf(t)
const toks = (s: string) => s.split(' ').map(idx)

describe('the count model', () => {
  it('matches a hand-worked fixture: the stream "dog chases cat ." with window 2 and separate counts', () => {
    const m = countStream(makeCountModel(2, true), toks('dog chases cat .'))
    // At "chases": dog is 1 back, weight 2. At "cat": chases 1 back (2), dog 2 back (1). At ".": cat (2), chases (1).
    expect(m.before[idx('chases')][idx('dog')]).toBe(2)
    expect(m.before[idx('cat')][idx('chases')]).toBe(2)
    expect(m.before[idx('cat')][idx('dog')]).toBe(1)
    expect(m.before[idx('.')][idx('cat')]).toBe(2)
    expect(m.before[idx('.')][idx('chases')]).toBe(1)
    expect(m.after[idx('dog')][idx('chases')]).toBe(2)
    expect(m.after[idx('dog')][idx('cat')]).toBe(1)
    expect(embedding(m, idx('dog')).length).toBe(2 * VOCABULARY.length)
    for (const w of [1, 3, 5, 8]) {
      const mm = countStream(makeCountModel(w, true), toks('dog chases cat .'))
      // dog is 2 back from cat: weight w − 1 when w ≥ 2, else 0.
      expect(mm.before[idx('cat')][idx('dog')]).toBe(w >= 2 ? w - 1 : 0)
      expect(mm.before[idx('cat')][idx('chases')]).toBe(w)
    }
  })
  it('dog chases cat and cat chases dog add the same counts with before and after summed and a window that spans the sentence, and different counts when separated', () => {
    const a = contribution(4, false, toks('dog chases cat .'))
    const b = contribution(4, false, toks('cat chases dog .'))
    // Summed, dog–cat and cat–dog pairs are the same pair; the end mark breaks the symmetry, so compare the words' rows only.
    for (const w of ['dog', 'cat', 'chases']) for (const v of ['dog', 'cat', 'chases']) expect(embedding(a, idx(w))[idx(v)], `${w} ${v}`).toBe(embedding(b, idx(w))[idx(v)])
    const c = contribution(4, true, toks('dog chases cat .'))
    const d = contribution(4, true, toks('cat chases dog .'))
    expect(sameCounts(c, d)).toBe(false)
    expect(c.before[idx('chases')][idx('dog')]).toBe(4)
    expect(d.before[idx('chases')][idx('dog')]).toBe(0)
  })
  it('correlation on a hand-worked fixture: in step gives 1, opposite gives −1, a constant list gives 0, and it is symmetric', () => {
    const f = (xs: number[]) => Float64Array.from(xs)
    expect(correlation(f([1, 2, 3]), f([2, 4, 6]))).toBeCloseTo(1, 12)
    expect(correlation(f([1, 2, 3]), f([3, 2, 1]))).toBeCloseTo(-1, 12)
    expect(correlation(f([1, 2, 3]), f([5, 5, 5]))).toBe(0)
    expect(correlation(f([5, 5, 5]), f([1, 2, 3]))).toBe(0)
    // By hand: centered a = [−1, 0, 1], centered b = [−2, 1, 1]; products sum to 3; spreads √2 and √6; 3 / √12 = 0.8660.
    expect(correlation(f([1, 2, 3]), f([0, 3, 3]))).toBeCloseTo(3 / Math.sqrt(12), 12)
    expect(correlation(f([0, 3, 3]), f([1, 2, 3]))).toBeCloseTo(3 / Math.sqrt(12), 12)
    // Correlation ignores a shift and a positive scale of either list; cosine does not ignore a shift.
    expect(correlation(f([1, 2, 3]), f([101, 102, 103]))).toBeCloseTo(1, 12)
    expect(cosine(f([1, 2, 3]), f([101, 102, 103]))).toBeLessThan(1)
    expect(correlation(f([]), f([]))).toBe(0)
  })
  it('on the corpus, cat’s nearest neighbors are nouns of its kind, and the views compute', () => {
    const all = corpus(makeRng(SETTINGS.corpusSeed), SETTINGS.corpusSentences).flat().map(idx)
    const m = countStream(makeCountModel(4, true), all)
    const near = nearest(m, idx('cat'), 5)
    expect(near.length).toBe(5)
    for (const n of near) expect(nounOf(VOCABULARY[n.word]), VOCABULARY[n.word]).toBeTruthy()
    expect(near[0].similarity).toBeGreaterThan(0.8)
    const nouns = VOCABULARY.filter((t) => nounOf(t)).map(idx)
    const plane = principalPlane(nouns.map((w) => embedding(m, w)))
    expect(plane.length).toBe(nouns.length)
    const tree = clusterTree(VOCABULARY.slice(0, 10).map((_, i) => embedding(m, i)))
    expect(tree.members.length).toBe(10)
    expect(cosine(embedding(m, idx('dog')), embedding(m, idx('dogs')))).toBeGreaterThan(0.5)
    expect(correlation(embedding(m, idx('dog')), embedding(m, idx('dogs')))).toBeGreaterThan(0.5)
    // The tree's heights are correlation distances: 0 at a leaf, below 1 at the root, and a parent at least as high as its children.
    const walk = (c: typeof tree): void => {
      if (!c.children) return expect(c.height).toBe(0)
      for (const ch of c.children) {
        expect(ch.height).toBeLessThanOrEqual(c.height + 1e-12)
        walk(ch)
      }
    }
    walk(tree)
    expect(tree.height).toBeLessThan(1)
  })
  it('the similarity demo’s four words: the two people correlate more with each other than either does with the food, at window 4 with before and after separate', () => {
    const all = corpus(makeRng(SETTINGS.corpusSeed), SETTINGS.corpusSentences).flat().map(idx)
    const m = countStream(makeCountModel(4, true), all)
    const r = (a: string, b: string) => correlation(embedding(m, idx(a)), embedding(m, idx(b)))
    expect(r('boy', 'boy')).toBeCloseTo(1, 9)
    expect(r('boy', 'girl')).toBeGreaterThan(r('boy', 'cookie'))
    expect(r('girl', 'dog')).toBeGreaterThan(r('girl', 'cookie'))
    expect(r('boy', 'cookie')).toBeLessThan(0.8)
  })
})

describe('prediction from counts', () => {
  it('is a count divided by a count, on a fixture and on the corpus', () => {
    const n = makeNgram(toks('dog chases cat . dog eats . dog chases dog .'))
    const p = predictFromOne(n, idx('dog'))
    expect(p.denominator).toBe(4)
    expect(p.numerators[idx('chases')]).toBe(2)
    expect(p.probs[idx('chases')]).toBe(0.5)
    expect(p.probs[idx('eats')]).toBe(0.25)
    expect(p.probs[idx('.')]).toBe(0.25)
    const q = predictFromTwo(n, idx('dog'), idx('chases'))
    expect(q.denominator).toBe(2)
    expect(q.probs[idx('cat')]).toBe(0.5)
    expect(q.probs[idx('dog')]).toBe(0.5)
    const all = corpus(makeRng(SETTINGS.corpusSeed), SETTINGS.corpusSentences).flat().map(idx)
    const c = makeNgram(all)
    // After "chases" alone, the counts favor the singular verb's usual continuations: an object noun or a plural verb cannot be told from one word.
    const one = predictFromOne(c, idx('chases'))
    expect(one.probs.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6)
    const two = predictFromTwo(c, idx('Mary'), idx('chases'))
    expect(two.probs.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6)
    expect(verbOf('chase')).toBeTruthy()
  })
})
