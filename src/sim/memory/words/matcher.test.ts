import { describe, it, expect } from 'vitest'
import { classify, editDistance, matches, normalize, singular } from './matcher'
import { ASSOCIATE_LISTS, UNRELATED } from './lists'

describe('matching fixtures (§5.4, §14)', () => {
  it('lower case and trimmed', () => {
    expect(normalize('  Piano ')).toBe('piano')
    expect(matches('PIANO', 'piano')).toBe(true)
  })
  it('singular and plural treated alike', () => {
    expect(singular('dogs')).toBe('dog')
    expect(singular('boxes')).toBe('box')
    expect(singular('cherries')).toBe('cherry')
    expect(singular('glass')).toBe('glass')
    expect(singular('bus')).toBe('bus')
    expect(matches('ladders', 'ladder')).toBe(true)
    expect(matches('glove', 'gloves')).toBe(true)
    expect(matches('pony', 'ponies')).toBe(true)
    expect(matches('ponies', 'pony')).toBe(true)
  })
  it('one edit for words of five letters or more: insertion, deletion, substitution, transposition', () => {
    expect(matches('pianno', 'piano')).toBe(true)
    expect(matches('pino', 'piano')).toBe(true)
    expect(matches('piamo', 'piano')).toBe(true)
    expect(matches('painо'.replace('о', 'o'), 'piano')).toBe(true)
    expect(matches('pianoo', 'piano')).toBe(true)
    expect(matches('pinao', 'piano')).toBe(true)
    expect(matches('pizza', 'piano')).toBe(false)
    expect(editDistance('abc', 'acb')).toBe(1)
    expect(editDistance('abc', 'abc')).toBe(0)
    expect(editDistance('abcd', 'dcba')).toBe(2)
  })
  it('no edit for shorter words', () => {
    expect(matches('tnet', 'tent')).toBe(false)
    expect(matches('tents', 'tent')).toBe(true)
    expect(matches('ten', 'tent')).toBe(false)
    expect(matches('fogs', 'fog')).toBe(true)
    expect(matches('fag', 'fog')).toBe(false)
  })
})

describe('classification', () => {
  // u1 begins train, gold, …; u2 begins letter, stone, …; u3 begins ticket, moon, …
  const list = UNRELATED[0]
  const earlier = [UNRELATED[1], UNRELATED[2]]
  it('a studied word of this list, with its position', () => {
    const [e] = classify(['Gold'], list, earlier)
    expect(e.kind).toBe('studied')
    expect(e.position).toBe(2)
    expect(e.word).toBe('gold')
  })
  it('the critical word of a list of associates', () => {
    const a = ASSOCIATE_LISTS[0]
    const [e] = classify(['mountain'], a, earlier)
    expect(e.kind).toBe('critical')
    expect(e.word).toBe('mountain')
    const [f] = classify(['mountain'], list, earlier)
    expect(f.kind).toBe('other')
  })
  it('a word from an earlier list, the most recent earlier list winning a tie', () => {
    const [e] = classify(['stone'], list, earlier)
    expect(e.kind).toBe('earlier')
    expect(e.fromEarlier).toBe(0)
    const [g] = classify(['moon'], list, earlier)
    expect(g.fromEarlier).toBe(1)
    const both = { ...UNRELATED[3], words: [...UNRELATED[3].words, 'moon'] }
    const [h] = classify(['moon'], list, [UNRELATED[2], both])
    expect(h.fromEarlier).toBe(1)
  })
  it('this list takes precedence over earlier lists and the critical word', () => {
    const l = { ...ASSOCIATE_LISTS[0], words: [...ASSOCIATE_LISTS[0].words.slice(0, 14), 'gold'] }
    const [e] = classify(['gold'], l, [list])
    expect(e.kind).toBe('studied')
  })
  it('an exact match outranks a one-edit match: rough after the rough list is the critical word, not tough', () => {
    const rough = ASSOCIATE_LISTS.find((l) => l.critical === 'rough')!
    const [e] = classify(['rough'], rough, [])
    expect(e.kind).toBe('critical')
    const [f] = classify(['tough'], rough, [])
    expect(f.kind).toBe('studied')
    expect(f.word).toBe('tough')
    // And an exact earlier-list word outranks a one-edit neighbor on this list.
    const withBrain = { ...list, words: [...list.words.slice(0, 14), 'brain'] }
    const [g] = classify(['drain'], withBrain, [{ ...UNRELATED[1], words: [...UNRELATED[1].words.slice(0, 14), 'drain'] }])
    expect(g.kind).toBe('earlier')
  })
  it('other for anything else, and a word typed twice counts once', () => {
    const out = classify(['zebra', 'gold', 'golds', 'zebra'], list, earlier)
    expect(out.map((e) => e.kind)).toEqual(['other', 'studied', 'studied', 'other'])
    expect(out.map((e) => e.duplicate)).toEqual([false, false, true, true])
  })
})
