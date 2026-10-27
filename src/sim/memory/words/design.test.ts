import { describe, it, expect } from 'vitest'
import { countChoice, materialsFor, nextCount, WRONG_OFFSETS, planPart1, recallSecondsFor, RECALL_S, SLOTS, WORD_ON_S, BLANK_S, DELAY_S } from './design'
import { ASSOCIATE_LISTS, UNRELATED_LENGTH } from './lists'

const SEEDS = Array.from({ length: 100 }, (_, i) => 1000 + i)

describe('Part 1’s design over 100 seeds (§14)', () => {
  it('seven lists of fifteen words: four unrelated, two immediate and two delayed, and three of associates recalled at once', () => {
    for (const seed of SEEDS) {
      const p = planPart1(seed)
      expect(p.slots.length).toBe(SLOTS)
      expect(SLOTS).toBe(7)
      const by = (f: (s: (typeof p.slots)[number]) => boolean) => p.slots.filter(f).length
      expect(by((s) => s.list.kind === 'associates'), `seed ${seed}`).toBe(3)
      expect(by((s) => s.list.kind === 'associates' && s.recall === 'immediate')).toBe(3)
      expect(by((s) => s.list.kind === 'unrelated' && s.recall === 'immediate')).toBe(2)
      expect(by((s) => s.list.kind === 'unrelated' && s.recall === 'delayed')).toBe(2)
      for (const s of p.slots) expect(s.list.words.length, `seed ${seed}, slot ${s.slot}`).toBe(UNRELATED_LENGTH)
      expect(new Set(p.slots.map((s) => s.list.id)).size).toBe(SLOTS)
    }
  })
  it('the lists of associates are never first or last, and are separated by at least one unrelated list', () => {
    for (const seed of SEEDS) {
      const p = planPart1(seed)
      const at = p.slots.filter((s) => s.list.kind === 'associates').map((s) => s.slot)
      expect(at[0], `seed ${seed}`).toBeGreaterThan(0)
      expect(at[at.length - 1], `seed ${seed}`).toBeLessThan(SLOTS - 1)
      for (let i = 1; i < at.length; i++) expect(at[i] - at[i - 1], `seed ${seed}`).toBeGreaterThanOrEqual(2)
    }
  })
  it('three studied lists of associates and three controls, all six used; with seven slots the rules put them at the second, fourth and sixth', () => {
    for (const seed of SEEDS) {
      const p = planPart1(seed)
      expect(p.studied.length).toBe(3)
      expect(p.controls.length).toBe(3)
      expect(new Set([...p.studied, ...p.controls].map((l) => l.id)).size).toBe(6)
      expect(p.slots.filter((s) => s.list.kind === 'associates').map((s) => s.slot)).toEqual([1, 3, 5])
    }
    expect(ASSOCIATE_LISTS.length).toBe(6)
  })
  it('a delayed list has a three-digit number to count from; an immediate one has none', () => {
    for (const seed of SEEDS.slice(0, 20)) {
      for (const s of planPart1(seed).slots) {
        if (s.recall === 'delayed') {
          expect(s.countFrom).toBeGreaterThanOrEqual(200)
          expect(s.countFrom).toBeLessThanOrEqual(999)
        } else expect(s.countFrom).toBeNull()
      }
    }
  })
  it('the same seed gives the same plan', () => {
    expect(JSON.stringify(planPart1(7))).toBe(JSON.stringify(planPart1(7)))
    expect(JSON.stringify(planPart1(7))).not.toBe(JSON.stringify(planPart1(8)))
  })
})

describe('reserve materials (§4.3, §5.3)', () => {
  it('a restart takes an unrelated reserve, two for the whole part, and then nothing', () => {
    const p = planPart1(1234)
    const slot = p.slots.find((s) => s.list.kind === 'unrelated')!
    const own = materialsFor(p, slot.slot, 0)!
    expect(own.list.id).toBe(slot.list.id)
    expect(own.lostAssociates).toBe(false)
    const r1 = materialsFor(p, slot.slot, 1)!
    const r2 = materialsFor(p, slot.slot, 2)!
    expect(r1.list.words.length).toBe(UNRELATED_LENGTH)
    expect(r2.list.words.length).toBe(UNRELATED_LENGTH)
    expect(r1.list.id).not.toBe(r2.list.id)
    expect(p.slots.some((s) => s.list.id === r1.list.id)).toBe(false)
    expect(p.slots.some((s) => s.list.id === r2.list.id)).toBe(false)
    expect(r1.recall).toBe(slot.recall)
    expect(r1.countFrom).toBe(slot.countFrom)
    expect(materialsFor(p, slot.slot, 3)).toBeNull()
    expect(p.reserves.length).toBe(2)
  })
  it('a list of associates has no reserve of its kind: the restart takes an unrelated list and says the list of associates was lost', () => {
    const p = planPart1(55)
    const a = p.slots.find((s) => s.list.kind === 'associates')!
    const m = materialsFor(p, a.slot, 1)!
    expect(m.list.kind).toBe('unrelated')
    expect(m.list.words.length).toBe(UNRELATED_LENGTH)
    expect(m.lostAssociates).toBe(true)
    expect(m.recall).toBe('immediate')
    expect(m.list.id).toBe(p.reserves[0].id)
  })
})

describe('presentation and the counting task', () => {
  it('the constants of §5.1', () => {
    expect(WORD_ON_S).toBe(1.5)
    expect(BLANK_S).toBeGreaterThan(0)
    expect(BLANK_S).toBeLessThan(0.5)
    expect(DELAY_S).toBe(30)
    expect(RECALL_S).toBe(60)
    for (const s of planPart1(1).slots) expect(recallSecondsFor(s.list)).toBe(RECALL_S)
  })
  it('each step offers the right next number and one wrong number near it, on either side, redrawn after a wrong click', () => {
    expect(nextCount(300, 0)).toBe(297)
    expect(nextCount(300, 3)).toBe(288)
    const sides = new Set<number>()
    const offsets = new Set<number>()
    for (const from of [200, 347, 999]) {
      for (let step = 0; step < 12; step++) {
        const c = countChoice(from, step, 0)
        expect(c.right).toBe(nextCount(from, step))
        expect(c.options).toContain(c.right)
        const wrong = c.options.find((o) => o !== c.right)!
        expect(WRONG_OFFSETS).toContain(wrong - c.right)
        sides.add(c.options.indexOf(c.right))
        offsets.add(wrong - c.right)
        expect(JSON.stringify(countChoice(from, step, 0))).toBe(JSON.stringify(c))
      }
    }
    expect(sides.size).toBe(2)
    expect(offsets.size).toBeGreaterThan(3)
    const redrawn = Array.from({ length: 12 }, (_, a) => JSON.stringify(countChoice(500, 0, a)))
    expect(new Set(redrawn).size).toBeGreaterThan(1)
  })
})
