import { describe, it, expect } from 'vitest'
import { DEFAULT_MODES, GLIMPSE_MS, DELETION_LEVEL, PART2_TRIALS, PART4_PER_CONDITION, STAIRCASE, UNDECIDED_TESTS, VIEWS_PER_CONDITION } from '../../sim/objects/config'
import { isDev } from './ObjectsScene'

/**
 * Both viewing modes exist until Jon chooses (spec §7): the defaults are
 * Part 2 glimpse, Part 3 free, Part 4 glimpse, the glimpse is about a
 * fifth of a second, and the developer control is gated on `?dev=1`.
 */
describe('the configuration', () => {
  it('every mode is decided (Jon, 2026-10-12): Parts 2 and 3 free, Part 4 glimpse', () => {
    expect(DEFAULT_MODES).toEqual({ parts: 'free', views: 'free', noise: 'glimpse' })
    expect(UNDECIDED_TESTS).toEqual([])
  })
  it('Part 3 has four views per condition, 24 trials per set (Jon, 2026-10-12)', () => {
    expect(VIEWS_PER_CONDITION).toBe(4)
  })
  it('the glimpse is about a fifth of a second', () => {
    expect(GLIMPSE_MS).toBe(200)
  })
  it('half the ink, twelve drawings, twelve photographs per condition', () => {
    expect(DELETION_LEVEL).toBe(0.5)
    expect(PART2_TRIALS).toBe(12)
    expect(PART4_PER_CONDITION).toBe(12)
  })
  it('the staircases start where the larger test was scored, and move one step a trial', () => {
    expect(STAIRCASE.A.start).toBe(0.2)
    expect(STAIRCASE.B.start).toBe(0.35)
    expect(STAIRCASE.A.step).toBe(0.05)
    expect(STAIRCASE.B.step).toBe(0.1)
  })
  it('?dev=1 in the query or after the hash exposes the benchmark hook; nothing else does', () => {
    expect(isDev('?dev=1', '#/m08-objects')).toBe(true)
    expect(isDev('', '#/m08-objects?dev=1')).toBe(true)
    expect(isDev('', '#/m08-objects')).toBe(false)
    expect(isDev('?dev=0', '#/m08-objects')).toBe(false)
  })
})
