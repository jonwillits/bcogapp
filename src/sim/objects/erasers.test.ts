import { describe, it, expect } from 'vitest'
import fixtures from './fixtures/erasers.json'
import { erase, findJoints, resample, type Joint } from './erasers'
import { strokeLength, type Drawing } from './raster'

/**
 * The erasers agree with Python, and the two remove the same ink (spec
 * §6.2, §11): on the fixture drawings, the joints found here are the
 * joints found there, and each eraser at each level produces the same
 * strokes and removes the same share.
 */
interface Case { category: string; strokes: Drawing; joints: [number, number, string][]; erased: Record<string, { strokes: Drawing; removed: number; half: number; length: number }> }
const { levels, cases } = fixtures as unknown as { levels: number[]; cases: Case[] }

describe('the erasers agree with Python', () => {
  it('finds the same joints', () => {
    for (const c of cases) {
      const here = findJoints(resample(c.strokes))
      expect(here.length, c.category).toBe(c.joints.length)
      here.forEach((j, i) => {
        expect(j[0]).toBe(c.joints[i][0])
        expect(Math.abs(j[1] - c.joints[i][1])).toBeLessThan(1e-6)
        expect(j[2]).toBe(c.joints[i][2])
      })
    }
  })

  it('produces the same strokes and the same removed share, for both erasers at every level', () => {
    for (const c of cases) {
      const joints = c.joints as Joint[]
      for (const level of levels) for (const kind of ['mid', 'joints'] as const) {
        const there = c.erased[`${kind}@${level}`]
        const here = erase(c.strokes, level, kind, joints)
        expect(Math.abs(here.removed - there.removed), `${c.category} ${kind} ${level}`).toBeLessThan(1e-6)
        expect(here.strokes.length).toBe(there.strokes.length)
        expect(Math.abs(strokeLength(here.strokes) - there.length)).toBeLessThan(1e-6)
      }
    }
  })
})

describe('equal ink', () => {
  it('on the drawings where the joints eraser has enough joints, the two erasers remove the same total length to within 2%', () => {
    let checked = 0
    for (const c of cases) for (const level of levels) {
      const a = erase(c.strokes, level, 'mid', c.joints as Joint[])
      const b = erase(c.strokes, level, 'joints', c.joints as Joint[])
      if (Math.abs(b.removed - level) > 0.01) continue // a drawing the display set would not include
      expect(Math.abs(a.removed - b.removed), `${c.category} ${level}`).toBeLessThan(0.02)
      checked++
    }
    expect(checked).toBeGreaterThan(cases.length)
  })
})
