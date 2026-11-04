import { describe, it, expect } from 'vitest'
import { CLASS_ENTRIES, cloudFor, classEntry, PENDING_CLASS_LINE, SIMULATED_STUDENTS } from './classes'

/**
 * Every simulated cloud traces to a data-file entry with a source and page,
 * or shows Simulated class pending (spec §13, item 13; §16). A real class,
 * when present, replaces the simulation.
 */
describe('a simulated class', () => {
  it('every entry has a measure per source slot; an entry with any pending source shows no cloud', () => {
    for (const e of CLASS_ENTRIES) {
      expect(e.sources.length).toBe(e.measures.length)
      if (e.sources.some((s) => s === null)) expect(cloudFor(e)).toEqual({ kind: 'pending' })
    }
    expect(PENDING_CLASS_LINE).toMatch(/appears here once its source is added/)
  })
  it('a filled entry draws a fixed cloud of about 40 students from its named source, the same for every student', () => {
    const e = { ...classEntry('paths'), sources: [{ source: 'a test source', where: 'Table 1, p. 1', mean: 0.9, sd: 0.05, differed: 'x', draw: 'normal' }, { source: 'a test source', where: 'Table 1, p. 1', mean: 0.85, sd: 0.05, differed: 'x', draw: 'normal' }] }
    const a = cloudFor(e)
    const b = cloudFor(e)
    expect(a.kind).toBe('simulated')
    if (a.kind === 'simulated' && b.kind === 'simulated') {
      expect(a.points.length).toBe(SIMULATED_STUDENTS)
      expect(a.points).toEqual(b.points)
      expect(a.sources.length).toBe(2)
    }
  })
  it('a real class replaces the simulation, labeled as this term’s, and the toggle shows the simulation again', () => {
    const e = { ...classEntry('creatures-memory'), real: [{ values: [1.2, 1.0] }, { values: [1.1, 1.05] }] }
    expect(cloudFor(e)).toEqual({ kind: 'real', points: [[1.2, 1.0], [1.1, 1.05]] })
    expect(cloudFor(e, false)).toEqual({ kind: 'pending' })
  })
  it('no entry carries a parameter without a source: a source must name where its numbers come from', () => {
    for (const e of CLASS_ENTRIES) for (const s of e.sources) if (s) expect(s.where.length).toBeGreaterThan(0)
  })
})
