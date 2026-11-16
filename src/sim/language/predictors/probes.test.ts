import { describe, it, expect } from 'vitest'
import { accepts, END, nounOf, verbOf } from './grammar'
import { makeProbes } from './probes'

describe('the agreement probes', () => {
  it('50 per depth; every one a legal sentence with the agreeing verb and not with the other; the nearest noun always differs in number from the subject', () => {
    const probes = makeProbes()
    for (const depth of [0, 1, 2, 3]) expect(probes.filter((p) => p.depth === depth).length, `depth ${depth}`).toBe(50)
    for (const p of probes) {
      expect(accepts([...p.prefix, p.agreeing, END]), p.prefix.join(' ')).toBe(true)
      expect(accepts([...p.prefix, p.other, END]), p.prefix.join(' ') + ' ' + p.other).toBe(false)
      expect(p.prefix.filter((t) => t === 'who').length).toBe(p.depth)
      const subj = nounOf(p.prefix[0])!
      expect(verbOf(p.agreeing)!.number).toBe(subj.number)
      const nouns = p.prefix.map((t) => nounOf(t)).filter((n) => n)
      if (p.depth > 0) expect(nouns[nouns.length - 1]!.number).not.toBe(subj.number)
    }
    expect(probes.find((p) => p.depth === 1)!.prefix.length).toBe(4)
  })
})
