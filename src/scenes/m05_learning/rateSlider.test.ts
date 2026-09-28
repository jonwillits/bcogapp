import { describe, it, expect } from 'vitest'
import { toSlider, fromSlider, RATE_SLIDER_STEP } from './LearningTab'
import { RATE_RANGE } from '../../sim/bilaterian/learning/rule'

/**
 * A student found that the learning-rate slider could reach 0.295 and 0.302
 * but never 0.3, the value the scene loads with (2026-09-28). Every rate the
 * handout tells a student to set has to be a value the slider can land on.
 */
describe('the learning-rate slider', () => {
  const reachable = new Set<number>()
  for (let v = toSlider(RATE_RANGE.min); v <= toSlider(RATE_RANGE.max) + 1e-9; v += RATE_SLIDER_STEP) reachable.add(fromSlider(v))

  it('can land on every rate the handout names, and on the default', () => {
    for (const rate of [0.01, 0.02, 0.05, 0.1, 0.3, 0.6, 1]) expect(reachable.has(rate), String(rate)).toBe(true)
  })

  it('the default rate maps to a slider position that maps back to itself', () => {
    expect(fromSlider(toSlider(0.3))).toBe(0.3)
  })

  it('stays inside the range at both ends', () => {
    expect(Math.min(...reachable)).toBe(RATE_RANGE.min)
    expect(Math.max(...reachable)).toBe(RATE_RANGE.max)
  })
})
