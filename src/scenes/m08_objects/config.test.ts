import { describe, it, expect } from 'vitest'
import { DEFAULT_MODES, GLIMPSE_MS, DELETION_LEVEL, PART2_TRIALS, PART4_PER_CONDITION, UNDECIDED_TESTS, VIEWS_PER_CONDITION } from '../../sim/objects/config'
import { DEFAULT_NOISE } from '../../sim/objects/noise'
import { isDev } from './ObjectsScene'

/**
 * Both viewing modes exist until Jon chooses (spec §7): the defaults are
 * Part 2 glimpse, Part 3 free, Part 4 glimpse, the glimpse is about a
 * fifth of a second, and the developer control is gated on `?dev=1`.
 */
describe('the configuration', () => {
  it('Part 2 and Part 3 are fixed as free (Jon, 2026-10-12); Part 4 loads as glimpse and is still undecided', () => {
    expect(DEFAULT_MODES).toEqual({ parts: 'free', views: 'free', noise: 'glimpse' })
    expect(UNDECIDED_TESTS).toEqual(['noise'])
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
  it('the noise strengths the walk-through starts from', () => {
    expect(DEFAULT_NOISE).toEqual({ A: 0.2, B: 0.35 })
  })
  it('?dev=1 in the query or after the hash shows the developer control; nothing else does', () => {
    expect(isDev('?dev=1', '#/m08-objects')).toBe(true)
    expect(isDev('', '#/m08-objects?dev=1')).toBe(true)
    expect(isDev('', '#/m08-objects')).toBe(false)
    expect(isDev('?dev=0', '#/m08-objects')).toBe(false)
  })
})
