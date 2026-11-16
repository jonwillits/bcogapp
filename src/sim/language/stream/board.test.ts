import { describe, it, expect } from 'vitest'
import { streamFor, WORDS } from './language'
import { boardSyllables, coloring, isWord, neighbors, trayCount, uncovered, tpTableOf, BOARD_SYLLABLES, WORD_COLORS } from './board'

/** Spec §14, Part 2: checking a true word colors exactly its instances; checking anything else changes nothing; the counts are counts from the board. */
describe('the board', () => {
  const s = streamFor(5, 150)
  const b = boardSyllables(s)
  it('is the first 300 syllables; a found word colors exactly its instances; a part-word is not a word', () => {
    expect(b.length).toBe(BOARD_SYLLABLES)
    const c = coloring(b, ['babupu'])
    const n = c.filter((w) => w === 'babupu').length
    expect(n).toBe(3 * trayCount(b, ['ba', 'bu', 'pu']))
    expect(isWord(['pi', 'da', 'ta'])).toBeNull()
    expect(isWord(['pi', 'da', 'bu'])).toBe('pidabu')
    expect(coloring(b, []).every((w) => w === null)).toBe(true)
    expect(uncovered(b, [])).toBe(300)
    expect(uncovered(b, [...WORDS])).toBe(0)
  })
  it('the neighbor counts and the tray count are counts from the board', () => {
    const nb = neighbors(b, 'ba')
    expect(nb.occurrences).toBe(b.filter((x) => x === 'ba').length)
    expect(nb.after.reduce((a, x) => a + x.count, 0)).toBeLessThanOrEqual(nb.occurrences)
    expect(trayCount(b, ['bu'])).toBe(b.filter((x) => x === 'bu').length)
    expect(trayCount(b, [])).toBe(0)
  })
  it('the table marks the within-word cells, and the six colors are distinct with a pattern each', () => {
    const t = tpTableOf(s)
    expect(t.table.length).toBe(12)
    expect(t.within.flat().filter(Boolean).length).toBe(12)
    expect(new Set(Object.values(WORD_COLORS).map((c) => c.fill)).size).toBe(6)
    expect(new Set(Object.values(WORD_COLORS).map((c) => c.pattern)).size).toBe(6)
  })
})
