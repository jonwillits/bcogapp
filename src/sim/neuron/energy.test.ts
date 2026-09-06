import { describe, it, expect } from 'vitest'
import { brainWatts, affordableRateHz, BRAIN_WATTS } from './energy'
import {
  travelTimeS,
  arrivingFraction,
  formatTime,
  formatDistance,
  BODY_SIZES_M,
} from './signals'

describe('the energy calculator (spec §7, §10)', () => {
  it('at 10 spikes per second returns well over 100 W', () => {
    expect(brainWatts(10)).toBeGreaterThan(100)
  })

  it('solving backwards for 20 W lands between 0.3 and 1.5 spikes per neuron per second', () => {
    const rate = affordableRateHz(BRAIN_WATTS)
    expect(rate).toBeGreaterThan(0.3)
    expect(rate).toBeLessThan(1.5)
    expect(brainWatts(rate)).toBeCloseTo(BRAIN_WATTS, 6)
  })
})

describe('the three signal types (spec §3.5)', () => {
  it('a diffusing chemical takes about ten seconds across 100 µm and quadruples per doubling', () => {
    const t = travelTimeS('chemical', 1e-4, 1)
    expect(t).toBeGreaterThan(8)
    expect(t).toBeLessThan(12)
    expect(travelTimeS('chemical', 2e-4, 1) / t).toBeCloseTo(4)
  })

  it('spikes take time in proportion to distance and arrive whole', () => {
    expect(travelTimeS('spikes', 2, 1) / travelTimeS('spikes', 1, 1)).toBeCloseTo(2)
    expect(arrivingFraction('spikes', 1)).toBe(1)
  })

  it('a graded signal is gone by a centimetre', () => {
    expect(arrivingFraction('graded', 1e-4)).toBeGreaterThan(0.85)
    expect(arrivingFraction('graded', 1e-2)).toBeLessThan(1e-3)
  })

  it('the largest bodies still report a computed chemical travel time rather than blanking', () => {
    const largest = BODY_SIZES_M[BODY_SIZES_M.length - 1]
    const t = travelTimeS('chemical', largest, 1)
    expect(Number.isFinite(t)).toBe(true)
    expect(formatTime(t)).toMatch(/years/)
  })

  it('names distances and times in the units a person would use', () => {
    expect(formatDistance(1e-6)).toBe('1 µm')
    expect(formatDistance(1e-4)).toBe('100 µm')
    expect(formatDistance(1e-3)).toBe('1 mm')
    expect(formatDistance(0.1)).toBe('100 mm')
    expect(formatDistance(1)).toBe('1 m')
    expect(formatTime(1e-4)).toBe('100 µs')
    expect(formatTime(0.5)).toBe('500 ms')
    expect(formatTime(10)).toBe('10 s')
    expect(formatTime(Infinity)).toBe('never')
  })
})
