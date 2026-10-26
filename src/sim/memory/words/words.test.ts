import { describe, it, expect } from 'vitest'
import { ASSOCIATE_LISTS, ASSOCIATES_LENGTH, NEW_WORDS, UNRELATED, UNRELATED_LENGTH } from './lists'
import { WORD_SETS, wordsOf } from './sets'
import { EDIT_FROM_LENGTH, editDistance, singular } from './matcher'
import { ROOM_NAMES } from '../room/items'

/**
 * The materials' exclusions (spec §5.2, §6.2, §14): no word is shared
 * between Part 1, Part 2 and Part 3, and no Part 1 unrelated word is an
 * associate in any list of associates used.
 */

/**
 * Part 3's item names and the room's furniture, as shipped; the room's own
 * test holds the list to the same rule. Candidates barred because a part
 * of their name is on a list of associates or on a Part 1 list: laptop
 * (top, on the mountain list), skateboard (boards, on the rough list),
 * toothbrush (tooth, on the sweet list), barrel and radio and hammer (Part
 * 1 lists), hay bale (hay) and cardboard box (card, boards).
 */
export const ROOM_WORDS = ROOM_NAMES

/** Every head noun and part of a compound in the room's names, singular, so "birdhouse" bars "bird" and "house" and "slippers" bars "slipper". */
export function roomStems(names: string[] = ROOM_WORDS): Set<string> {
  const out = new Set<string>()
  const add = (w: string) => {
    out.add(w)
    out.add(singular(w))
  }
  for (const name of names) {
    for (const part of name.toLowerCase().split(/[\s-]+/)) add(part)
    const whole = name.toLowerCase().replace(/[\s-]+/g, '')
    add(whole)
    // Compounds written as one word: split at a few known seams.
    for (const seam of ['bird', 'back', 'head', 'text', 'lap', 'tooth', 'skate', 'chain', 'wheel', 'pitch', 'note', 'hand']) {
      if (whole.startsWith(seam) && whole.length > seam.length + 2) {
        add(seam)
        add(whole.slice(seam.length))
      }
    }
  }
  return out
}

const part1Unrelated = UNRELATED.flatMap((l) => l.words)
const associates = ASSOCIATE_LISTS.flatMap((l) => l.words)
const criticals = ASSOCIATE_LISTS.map((l) => l.critical!)
const part2 = WORD_SETS.flatMap(wordsOf)
const room = roomStems()

const overlap = (a: string[], b: Iterable<string>) => {
  const bs = new Set([...b].map(singular))
  return a.filter((w) => bs.has(singular(w)))
}

describe('the lists as chosen', () => {
  it('six unrelated lists of fifteen, the length of a list of associates, no word repeated across them', () => {
    expect(UNRELATED.length).toBe(6)
    expect(UNRELATED_LENGTH).toBe(ASSOCIATES_LENGTH)
    for (const l of UNRELATED) expect(l.words.length, l.id).toBe(UNRELATED_LENGTH)
    expect(new Set(part1Unrelated.map(singular)).size).toBe(part1Unrelated.length)
    expect(NEW_WORDS.length).toBe(8)
    expect(new Set(NEW_WORDS).size).toBe(8)
  })
  it('six lists of associates of fifteen words, each with a critical word not on any of them, and the sleep list is not among them', () => {
    expect(ASSOCIATE_LISTS.length).toBe(6)
    for (const l of ASSOCIATE_LISTS) {
      expect(l.words.length, l.id).toBe(ASSOCIATES_LENGTH)
      expect(l.critical).toBeTruthy()
      expect(associates).not.toContain(l.critical)
    }
    expect(criticals).not.toContain('sleep')
    expect(criticals).not.toContain('chair')
    expect(criticals).not.toContain('window')
  })
  it('three word sets of twenty-four: two top categories, three subcategories of four, no word repeated', () => {
    expect(WORD_SETS.length).toBe(3)
    for (const s of WORD_SETS) {
      expect(s.categories.length, s.id).toBe(2)
      for (const c of s.categories) {
        expect(c.subcategories.length, c.label).toBe(3)
        for (const sub of c.subcategories) expect(sub.words.length, sub.label).toBe(4)
      }
      expect(wordsOf(s).length).toBe(24)
    }
    expect(new Set(part2).size).toBe(part2.length)
  })
})

describe('no word is shared between the parts (§14)', () => {
  it('Part 1’s unrelated words and new words are on no list of associates and are no critical word', () => {
    expect(overlap([...part1Unrelated, ...NEW_WORDS], associates)).toEqual([])
    expect(overlap([...part1Unrelated, ...NEW_WORDS], criticals)).toEqual([])
    expect(overlap(part1Unrelated, NEW_WORDS)).toEqual([])
  })
  it('Part 2’s sets share no word with Part 1 or with the lists of associates', () => {
    expect(overlap(part2, part1Unrelated)).toEqual([])
    expect(overlap(part2, NEW_WORDS)).toEqual([])
    expect(overlap(part2, associates)).toEqual([])
    expect(overlap(part2, criticals)).toEqual([])
  })
  it('Part 3’s item names, their parts and their furniture are in neither Part 1 nor Part 2', () => {
    expect(overlap([...part1Unrelated, ...NEW_WORDS], room)).toEqual([])
    expect(overlap(part2, room)).toEqual([])
    expect(overlap(associates, room)).toEqual([])
    expect(overlap(criticals, room)).toEqual([])
  })
  it('no two Part 1 words are within one edit of each other, so the lenient matcher cannot confuse them', () => {
    const words = [...part1Unrelated, ...NEW_WORDS]
    const near: string[] = []
    for (let i = 0; i < words.length; i++)
      for (let j = i + 1; j < words.length; j++)
        if (words[j].length >= EDIT_FROM_LENGTH && editDistance(words[i], words[j]) <= 1) near.push(`${words[i]}/${words[j]}`)
    expect(near).toEqual([])
    // Nor is any critical word within one edit of a Part 1 word.
    for (const c of criticals) for (const w of words) if (w.length >= EDIT_FROM_LENGTH) expect(editDistance(c, w), `${c}/${w}`).toBeGreaterThan(1)
  })
  it('a Part 1 list repeats no stem and holds no obvious pair from one category', () => {
    // Pairs that would share a category, kept out by hand; the test holds the hand.
    const groups = [
      ['nose', 'ear', 'chin', 'cheek', 'tongue', 'waist', 'skull', 'lung', 'kidney', 'brain', 'throat', 'stomach'],
      ['cat', 'dog', 'bear', 'camel', 'bull', 'mule', 'pony', 'moose', 'dove', 'pigeon', 'pig', 'horse'],
      ['train', 'cab', 'limo', 'cart', 'bus', 'truck'],
      ['gold', 'iron', 'copper', 'silver', 'steel', 'brass', 'tin'],
      ['dollar', 'penny', 'nickel', 'coin', 'dime'],
      ['sword', 'knife', 'cannon', 'bomb', 'gun', 'pistol'],
    ]
    for (const l of UNRELATED) {
      for (const g of groups) expect(l.words.filter((w) => g.includes(w)).length, `${l.id}: ${g[0]}…`).toBeLessThanOrEqual(1)
      expect(new Set(l.words.map(singular)).size, l.id).toBe(l.words.length)
    }
  })
})
