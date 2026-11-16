import { describe, it, expect } from 'vitest'

/**
 * The learners and the models compute only what their procedures allow,
 * by structural tests on their source (spec §11, item 5): the dips learner
 * reads only the syllables it has taken in; the recurrent network learns
 * only by learnWeights; guess and check stores one object per word and
 * reads no count; tallying reads no record of its own past picks; no
 * learner or model imports the stream's word list, the word-object
 * pairing, or the true boundaries.
 */
const files = import.meta.glob('./**/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const src = (name: string) => {
  const hit = Object.entries(files).find(([p]) => p.endsWith(name))
  if (!hit) throw new Error(`no file ${name}`)
  return hit[1].replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

describe('the learners read only the stream', () => {
  it('the dips learner imports no word list, boundary, or test foil, and reads no position', () => {
    const s = src('stream/learners/dips.ts')
    expect(s).not.toMatch(/\bWORDS\b|withinWord|syllablesOf|wordIndex|position|nonwords|partwords/)
    expect(s).toMatch(/countPairs/)
  })
  it('the recurrent network imports no word list or boundary, and moves weights only through learnWeights', () => {
    const s = src('stream/learners/srn.ts')
    expect(s).not.toMatch(/\bWORDS\b|withinWord|wordIndex|position\b|nonwords|partwords/)
    expect(s).toMatch(/learnWeights\(/)
    expect(s).not.toMatch(/\.weights\[[^\]]+\]\s*=[^=]/)
  })
  it('the scorer gives a learner a string and nothing about which string is the word', () => {
    const s = src('stream/test.ts')
    expect(s).toMatch(/export type Scorer = \(syllables: readonly Syllable\[\]\) => number/)
  })
})

describe('the two word-learning models', () => {
  it('guess and check stores one object per word, reads no count, and imports no pairing', () => {
    const s = src('words/models/guessCheck.ts')
    expect(s).not.toMatch(/count|pairing|isCorrect|design\./i)
    expect(s).toMatch(/lastPick: number\[\]/)
    expect((s.match(/lastPick\[t\.word\] = /g) ?? []).length).toBe(1)
  })
  it('tallying reads no record of its own past picks and imports no pairing', () => {
    const s = src('words/models/tally.ts')
    expect(s).not.toMatch(/lastPick|history|pairing|isCorrect/)
    expect(s).toMatch(/counts: number\[\]\[\]/)
  })
  it('neither model file imports the design’s answer key', () => {
    for (const f of ['words/models/guessCheck.ts', 'words/models/tally.ts']) expect(src(f)).not.toMatch(/import .*pairing|makeDesign/)
  })
})

describe('the predictors', () => {
  it('the count model and the prediction from counts read only the token stream, and the runtime writes no weight', () => {
    expect(src('predictors/counts.ts')).not.toMatch(/accepts|nextTokens|parse/)
    expect(src('predictors/ngram.ts')).not.toMatch(/accepts|nextTokens|parse/)
    const rt = src('predictors/runtime/seqNet.ts')
    expect((rt.match(/weights\.set\(/g) ?? []).length).toBe(1)
  })
})
