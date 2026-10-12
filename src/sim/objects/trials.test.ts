import { describe, it, expect } from 'vitest'
import { nextLevel, scoreAtLevel, settledLevel } from './trials'
import { STAIRCASE } from './config'

/** Part 4's staircase (Jon, 2026-10-12): harder when right, easier when wrong, within range; a settled level; a score read off the sweep. */
describe('the noise staircase', () => {
  it('moves one step harder on a right answer and one step easier on a wrong one', () => {
    expect(nextLevel('A', 0.2, true)).toBeCloseTo(0.25)
    expect(nextLevel('A', 0.2, false)).toBeCloseTo(0.15)
    expect(nextLevel('B', 0.35, true)).toBeCloseTo(0.45)
    expect(nextLevel('B', 0.35, false)).toBeCloseTo(0.25)
  })
  it('stays within its range', () => {
    expect(nextLevel('A', STAIRCASE.A.max, true)).toBe(STAIRCASE.A.max)
    expect(nextLevel('A', STAIRCASE.A.min, false)).toBe(STAIRCASE.A.min)
    expect(nextLevel('B', STAIRCASE.B.max, true)).toBe(STAIRCASE.B.max)
  })
  it('settles on the mean of the last six levels', () => {
    expect(settledLevel([0.2, 0.25, 0.3, 0.25, 0.3, 0.35, 0.3, 0.35])).toBeCloseTo((0.3 + 0.25 + 0.3 + 0.35 + 0.3 + 0.35) / 6)
    expect(settledLevel([])).toBeNull()
  })
  it('reads a score off the sweep by interpolation, and clamps beyond its ends', () => {
    const sweep = { '0.0': 0.9, '0.2': 0.5, '0.4': 0.1 }
    expect(scoreAtLevel(sweep, 0.1)).toBeCloseTo(0.7)
    expect(scoreAtLevel(sweep, 0.3)).toBeCloseTo(0.3)
    expect(scoreAtLevel(sweep, 0.9)).toBeCloseTo(0.1)
    expect(scoreAtLevel(sweep, -1)).toBeCloseTo(0.9)
  })
})
