import { describe, it, expect } from 'vitest'
import { arc } from './arc'
import { part2MaterialsFor, planPart2, scrambledGrid, subcategoryOf, topCategoryOf, WORD_SETS, wordsOf, GRID_COLUMNS, GRID_ROWS } from './sets'
import { makeRng } from '../../random'

const cat = (w: string) => (w.startsWith('a') ? 'A' : w.startsWith('b') ? 'B' : w.startsWith('c') ? 'C' : null)

describe('the adjusted ratio of clustering (Roenker, Thompson and Brown, 1971)', () => {
  it('perfect clustering gives 1', () => {
    const r = arc(['a1', 'a2', 'a3', 'b1', 'b2', 'b3', 'c1', 'c2'], cat)
    expect(r.N).toBe(8)
    expect(r.k).toBe(3)
    expect(r.R).toBe(5)
    expect(r.maxR).toBe(5)
    expect(r.arc).toBe(1)
  })
  it('a known order gives the formula’s value', () => {
    // a b a b a b c c: N 8, counts 3, 3, 2; R = 1 (c c); E = (9 + 9 + 4)/8 − 1 = 1.75; maxR = 5.
    const r = arc(['a1', 'b1', 'a2', 'b2', 'a3', 'b3', 'c1', 'c2'], cat)
    expect(r.R).toBe(1)
    expect(r.E).toBeCloseTo(1.75, 10)
    expect(r.maxR).toBe(5)
    expect(r.arc).toBeCloseTo((1 - 1.75) / (5 - 1.75), 10)
    expect(r.arc).toBeLessThan(0)
  })
  it('chance-level clustering gives about 0 on average over random orders', () => {
    const rng = makeRng(3)
    const words = ['a1', 'a2', 'a3', 'a4', 'b1', 'b2', 'b3', 'b4', 'c1', 'c2', 'c3', 'c4']
    let sum = 0
    const n = 2000
    for (let t = 0; t < n; t++) {
      const order = [...words]
      for (let i = order.length - 1; i > 0; i--) {
        const j = rng.int(i + 1)
        ;[order[i], order[j]] = [order[j], order[i]]
      }
      sum += arc(order, cat).arc!
    }
    expect(Math.abs(sum / n)).toBeLessThan(0.03)
  })
  it('a single category, or nothing recalled, returns null; intrusions and repeats are dropped', () => {
    expect(arc(['a1', 'a2', 'a3'], cat).arc).toBeNull()
    expect(arc([], cat).arc).toBeNull()
    const r = arc(['a1', 'zzz', 'a1', 'b1', 'yyy'], cat)
    expect(r.N).toBe(2)
    expect(r.output.map((o) => o.word)).toEqual(['a1', 'b1'])
  })
})

describe('Part 2’s plan', () => {
  it('the seed gives one set to each condition and holds the third; the scrambled grid is 6 × 4 with no two same-subcategory neighbors in a row', () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const p = planPart2(seed)
      expect(new Set([p.scrambled.set.id, p.organized.set.id, p.reserve.id]).size).toBe(3)
      expect(p.scrambled.grid.length).toBe(GRID_ROWS)
      for (const row of p.scrambled.grid) {
        expect(row.length).toBe(GRID_COLUMNS)
        for (let i = 1; i < row.length; i++) expect(subcategoryOf(p.scrambled.set, row[i])).not.toBe(subcategoryOf(p.scrambled.set, row[i - 1]))
      }
      expect(p.scrambled.grid.flat().sort()).toEqual(wordsOf(p.scrambled.set).sort())
    }
    expect(JSON.stringify(planPart2(5))).toBe(JSON.stringify(planPart2(5)))
  })
  it('every word of a set has a subcategory and a top category', () => {
    for (const s of WORD_SETS) for (const w of wordsOf(s)) {
      expect(subcategoryOf(s, w)).toBeTruthy()
      expect(topCategoryOf(s, w)).toBeTruthy()
    }
    expect(subcategoryOf(WORD_SETS[0], 'zebra')).toBeNull()
  })
  it('a restart takes the reserve set in the same condition, and a second restart has nothing', () => {
    const p = planPart2(21)
    expect(part2MaterialsFor(p, 'scrambled', 0)!.set.id).toBe(p.scrambled.set.id)
    const r = part2MaterialsFor(p, 'scrambled', 1)!
    expect(r.set.id).toBe(p.reserve.id)
    expect(r.grid!.length).toBe(GRID_ROWS)
    expect(part2MaterialsFor(p, 'organized', 1)!.set.id).toBe(p.reserve.id)
    expect(part2MaterialsFor(p, 'organized', 2)).toBeNull()
    expect(scrambledGrid(p.reserve, makeRng(1)).flat().length).toBe(24)
  })
})
