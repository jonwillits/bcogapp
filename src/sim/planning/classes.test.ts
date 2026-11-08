import { describe, it, expect } from 'vitest'
import { CLASS_ENTRIES, classEntry, cloudFor, SIMULATED_STUDENTS } from './classes'

describe('the simulated class (spec §4.3, §11 item 13)', () => {
  it('every source names where its numbers come from, and a share or a mean with a spread, never both missing', () => {
    for (const e of CLASS_ENTRIES)
      for (const s of e.sources) {
        if (!s) continue
        expect(s.where, e.id).toMatch(/p\. \d+/)
        expect(s.share !== undefined || (s.mean !== undefined && s.sd !== undefined), e.id).toBe(true)
        expect(s.n, e.id).toBeGreaterThan(0)
      }
  })
  it('a pending entry yields pending and no cloud', () => {
    expect(cloudFor(classEntry('anchor')).kind).toBe('pending')
    expect(cloudFor(classEntry('lossRatio')).kind).toBe('pending')
    expect(cloudFor(classEntry('discountK')).kind).toBe('pending')
  })
  it('a sourced entry yields a fixed cloud of 40 students drawn from the published shares', () => {
    const a = cloudFor(classEntry('pair1'))
    const b = cloudFor(classEntry('pair1'))
    expect(a).toEqual(b)
    if (a.kind !== 'simulated') throw new Error('expected a simulation')
    expect(a.points.length).toBe(SIMULATED_STUDENTS)
    const gainShare = a.points.filter((p) => p[0] === 1).length / SIMULATED_STUDENTS
    expect(gainShare).toBeGreaterThan(0.6)
    const lossShare = a.points.filter((p) => p[1] === 1).length / SIMULATED_STUDENTS
    expect(lossShare).toBeLessThan(0.3)
  })
  it('this term’s real class replaces the simulation when present', () => {
    const e = { ...classEntry('pair1'), real: [{ values: [1, 0] }, { values: [0, 0] }] }
    expect(cloudFor(e)).toEqual({ kind: 'real', points: [[1, 0], [0, 0]] })
    expect(cloudFor(e, false).kind).toBe('simulated')
  })
  it('two entries never share a stream', () => {
    const ids = CLASS_ENTRIES.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
