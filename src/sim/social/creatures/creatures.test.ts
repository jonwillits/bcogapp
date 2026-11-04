import { describe, it, expect } from 'vitest'
import { GAP, MARKINGS, MATERIALS, PATCH_HUES, STEP, TRAINING_TRIALS, firstFamily, heightLevels, roundMaterials, testItems, trainingMembers, trainingOrder } from './materials'
import { makeRng } from '../../random'
import { scoreRound, type RoundAnswers } from './scoring'

/**
 * Part 5's acceptance tests (PART5_REDESIGN_2026-11-04.md §11): feature
 * balance, the heights, the test items, the training order, and the
 * scoring fixtures.
 */

const key = (m: string, p: number) => `${m}|${p}`

describe('the materials', () => {
  it('every training member has a unique combination of marking and patch color, each feature value once per group, and no feature value predicts the group', () => {
    for (const pair of MATERIALS) {
      for (const family of pair.families) {
        const members = trainingMembers(family, pair.shift)
        expect(members.length).toBe(12)
        expect(new Set(members.map((m) => key(m.marking, m.patch))).size).toBe(12)
        for (const group of [0, 1]) {
          const g = members.filter((m) => m.group === group)
          expect(g.length).toBe(6)
          expect(new Set(g.map((m) => m.marking)).size).toBe(6)
          expect(new Set(g.map((m) => m.patch)).size).toBe(6)
          expect(g.map((m) => m.level).sort()).toEqual([0, 0, 1, 1, 2, 2])
        }
        // No single feature value predicts the group above chance: each value is in both groups equally.
        for (const marking of MARKINGS) expect(members.filter((m) => m.marking === marking && m.group === 1).length).toBe(1)
        for (let p = 0; p < PATCH_HUES.length; p++) expect(members.filter((m) => m.patch === p && m.group === 1).length).toBe(1)
        // The body hue is not a patch hue.
        expect(PATCH_HUES.some((h) => Math.abs(h - family.hue) < 25)).toBe(false)
      }
    }
  })
  it('three height levels a group at 5% steps with a 25% gap, and a single threshold on height sorts every item', () => {
    const levels = heightLevels(100)
    expect(levels.length).toBe(6)
    for (let k = 1; k < 3; k++) expect(levels[k] / levels[k - 1]).toBeCloseTo(STEP, 9)
    for (let k = 4; k < 6; k++) expect(levels[k] / levels[k - 1]).toBeCloseTo(STEP, 9)
    expect(levels[3] / levels[2]).toBeCloseTo(GAP, 9)
    for (const [k, v] of [100, 105, 110.25, 137.8125, 144.703125, 151.93828125].entries()) expect(levels[k]).toBeCloseTo(v, 9)
    for (const pair of MATERIALS) {
      for (const family of pair.families) {
        const items = testItems(trainingMembers(family, pair.shift), family.base)
        const threshold = (heightLevels(family.base)[2] + heightLevels(family.base)[3]) / 2
        for (const item of items) expect(item.height > threshold ? 1 : 0).toBe(item.group)
      }
    }
  })
  it('24 test items: 12 old, 6 changed in exactly one feature at the same height, 6 new at a group’s height with a combination no training member had; the same 24 for both tests', () => {
    for (const pair of MATERIALS) {
      for (const family of pair.families) {
        const members = trainingMembers(family, pair.shift)
        const items = testItems(members, family.base)
        expect(items.length).toBe(24)
        expect(items.filter((i) => i.kind === 'old').length).toBe(12)
        expect(items.filter((i) => i.kind === 'changed').length).toBe(6)
        expect(items.filter((i) => i.kind === 'new').length).toBe(6)
        expect(new Set(items.map((i) => key(i.marking, i.patch))).size).toBe(24)
        const used = new Set(members.map((m) => key(m.marking, m.patch)))
        for (const i of items.filter((i) => i.kind === 'changed')) {
          const m = members[i.member!]
          expect(i.height).toBe(m.height)
          expect(i.group).toBe(m.group)
          const diffs = (i.marking !== m.marking ? 1 : 0) + (i.patch !== m.patch ? 1 : 0)
          expect(diffs).toBe(1)
          expect(used.has(key(i.marking, i.patch))).toBe(false)
        }
        for (const i of items.filter((i) => i.kind === 'new')) {
          expect(used.has(key(i.marking, i.patch))).toBe(false)
          expect(heightLevels(family.base).slice(i.group * 3, i.group * 3 + 3)).toContain(i.height)
        }
        expect(items.filter((i) => i.kind === 'changed' && i.group === 0).length).toBe(3)
        expect(items.filter((i) => i.kind === 'new' && i.group === 1).length).toBe(3)
      }
    }
    const r = roundMaterials(5, 0, 0)
    expect([...r.memoryOrder].sort((a, b) => a - b)).toEqual(r.items.map((i) => i.id))
    expect([...r.secondOrder].sort((a, b) => a - b)).toEqual(r.items.map((i) => i.id))
    expect(r.memoryOrder.join()).not.toBe(r.secondOrder.join())
  })
  it('48 training trials, each member four times, none twice in a row', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const order = trainingOrder(makeRng(seed))
      expect(order.length).toBe(TRAINING_TRIALS)
      for (let m = 0; m < 12; m++) expect(order.filter((x) => x === m).length).toBe(4)
      for (let i = 1; i < order.length; i++) expect(order[i]).not.toBe(order[i - 1])
    }
  })
  it('the seed decides which family comes first, balanced across seeds, and the reserve version is the other pair with other colors and pairings', () => {
    let firsts = 0
    for (let seed = 1; seed <= 200; seed++) firsts += firstFamily(seed)
    expect(firsts).toBeGreaterThan(70)
    expect(firsts).toBeLessThan(130)
    const a = roundMaterials(9, 0, 0)
    const b = roundMaterials(9, 1, 0)
    expect(a.family.family).not.toBe(b.family.family)
    const r = roundMaterials(9, 0, 1)
    expect(r.family.family).toBe(a.family.family)
    expect(r.family.hue).not.toBe(a.family.hue)
    expect(r.names).not.toEqual(a.names)
    expect(r.members.map((m) => key(m.marking, m.patch)).join()).not.toBe(a.members.map((m) => key(m.marking, m.patch)).join())
  })
})

describe('scoring', () => {
  const r = roundMaterials(3, 0, 0)
  const answers = (memory: (kind: string) => 'seen' | 'new', sorting: (group: 0 | 1) => 0 | 1): RoundAnswers => ({
    training: r.training.map((member, k) => ({ member, answer: 'x', right: k % 2 === 0 })),
    memory: Object.fromEntries(r.items.map((i) => [i.id, memory(i.kind)])),
    sorting: Object.fromEntries(r.items.map((i) => [i.id, sorting(i.group)])),
    noticed: 'yes',
  })
  it('the five scores on scripted answers, Round 1’s best assignment, and d′ at rates of 0 and 1', () => {
    const perfect = scoreRound(r.items, answers((k) => (k === 'old' ? 'seen' : 'new'), (g) => (g === 0 ? 1 : 0)), true)
    expect(perfect.hitRate).toBe(1)
    expect(perfect.falseAlarmRateChanged).toBe(0)
    expect(perfect.falseAlarmRateNew).toBe(0)
    // Rates of 1 and 0 are repaired to 1 − 1/24 and 1/12 before z.
    expect(perfect.dPrime).toBeCloseTo(1.7317 + 1.3830, 2)
    expect(perfect.sortingAccuracy).toBe(1)
    expect(perfect.kindOneIsTall).toBe(true)
    expect(perfect.trainingRight).toBe(24)
    const byGroup = scoreRound(r.items, answers((k) => (k === 'new' ? 'seen' : k === 'old' ? 'seen' : 'new'), (g) => g), false)
    expect(byGroup.falseAlarmRateNew).toBe(1)
    expect(byGroup.kindOneIsTall).toBeNull()
    expect(byGroup.sortingAccuracy).toBe(1)
    const swapped = scoreRound(r.items, answers(() => 'new', (g) => g), true)
    expect(swapped.hitRate).toBe(0)
    expect(swapped.sortingAccuracy).toBe(1)
    expect(swapped.kindOneIsTall).toBe(false)
    const half = scoreRound(r.items, answers((k) => (k === 'old' ? 'seen' : 'seen'), () => 0), false)
    expect(half.hitRate).toBe(1)
    expect(half.falseAlarmRateChanged).toBe(1)
    // Both rates at 1 are repaired to 23/24 and 11/12 (Lab 7's rule), which differ a little, so d′ is small but not zero.
    expect(half.dPrime).toBeCloseTo(1.7317 - 1.383, 2)
    expect(half.sortingAccuracy).toBe(0.5)
  })
})
