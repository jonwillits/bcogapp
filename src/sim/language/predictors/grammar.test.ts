import { describe, it, expect } from 'vitest'
import { makeRng } from '../../random'
import { accepts, corpus, nextTokens, nounOf, SETTINGS, start, step, verbOf, VOCABULARY, END } from './grammar'

/**
 * Spec §14, Part 4: the generator emits only sentences the parser accepts,
 * over 10,000 sentences; the parser rejects a fixture of ungrammatical
 * ones; and after every prefix of a generated sentence the parser's list of
 * legal next tokens contains the token that came next. Nesting runs to
 * three levels at most; the vocabulary is about 50 tokens.
 */
describe('the corpus grammar', () => {
  const sentences = corpus(makeRng(SETTINGS.corpusSeed), 10000)
  it('every generated sentence is accepted, and every prefix’s next token is among the legal ones', () => {
    for (const s of sentences) {
      expect(accepts(s), s.join(' ')).toBe(true)
      let st = start()
      for (const t of s) {
        expect(nextTokens(st), `${s.join(' ')} at ${t}`).toContain(t)
        st = step(st, t)
      }
      expect(st.complete).toBe(true)
    }
  })
  it('rejects ungrammatical strings: disagreement, a wrong object, a missing object, a missing end, a bare verb', () => {
    const bad = [
      ['boys', 'chases', 'cat', '.'],
      ['boy', 'eats', 'rock', '.'],
      ['boy', 'chases', '.'],
      ['boy', 'walks'],
      ['walks', '.'],
      ['rock', 'walks', '.'],
      ['boys', 'who', 'Mary', 'chases', 'walks', '.'],
      ['boy', 'who', 'chases', 'dog', 'cookie', '.'],
      ['cookie', 'who', 'boy', 'eats', 'walks', '.'],
    ]
    for (const b of bad) expect(accepts(b), b.join(' ')).toBe(false)
    expect(accepts(['boys', 'who', 'Mary', 'chases', 'walk', '.'])).toBe(true)
    expect(accepts(['boy', 'who', 'chases', 'dog', 'walks', '.'])).toBe(true)
    expect(accepts(['boys', 'who', 'girls', 'who', 'dogs', 'chase', 'see', 'hear', '.'])).toBe(true)
  })
  it('agreement holds through a relative clause: after boys who Mary chases, only plural verbs and who are legal', () => {
    let st = start()
    for (const t of ['boys', 'who', 'Mary', 'chases']) st = step(st, t)
    const next = nextTokens(st)
    for (const t of next) {
      if (t === 'who' || t === END) continue
      expect(verbOf(t)?.number, t).toBe('pl')
    }
    expect(next).toContain('chase')
    expect(next).not.toContain('chases')
    expect(next).not.toContain(END)
  })
  it('nesting stops at the deepest level, and the vocabulary is about 50 tokens with every form resolvable', () => {
    const deepest = Math.max(...sentences.map((s) => s.filter((t) => t === 'who').length))
    expect(deepest).toBeLessThanOrEqual(SETTINGS.maxDepth * 2)
    expect(VOCABULARY.length).toBeGreaterThanOrEqual(45)
    expect(VOCABULARY.length).toBeLessThanOrEqual(55)
    for (const t of VOCABULARY) expect(nounOf(t) || verbOf(t) || t === 'who' || t === END, t).toBeTruthy()
    const lengths = sentences.map((s) => s.length)
    expect(Math.max(...lengths)).toBeLessThanOrEqual(32)
  })
})
