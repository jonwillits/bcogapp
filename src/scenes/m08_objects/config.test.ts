import { describe, it, expect } from 'vitest'
import { DEFAULT_MODES, GLIMPSE_MS, DELETION_LEVEL, PART2_TRIALS, PART4_PER_CONDITION } from '../../sim/objects/config'
import { DEFAULT_NOISE } from '../../sim/objects/noise'
import { isDev } from './ObjectsScene'

/**
 * Both viewing modes exist until Jon chooses (spec §7): the defaults are
 * Part 2 glimpse, Part 3 free, Part 4 glimpse, the glimpse is about a
 * fifth of a second, and the developer control is gated on `?dev=1`.
 */
describe('the configuration', () => {
  it('defaults: Part 2 glimpse, Part 3 free, Part 4 glimpse', () => {
    expect(DEFAULT_MODES).toEqual({ parts: 'glimpse', views: 'free', noise: 'glimpse' })
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
