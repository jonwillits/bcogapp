import { describe, it, expect } from 'vitest'
import {
  activate,
  decisionBoundary,
  truthTableOf,
  unitOutput,
  TRUTH_ROWS,
  type RateUnit,
} from './unit'
import { WEIGHT_RANGE, BASELINE_RANGE, THRESHOLD_RANGE } from './circuit'

/**
 * The chapter-arithmetic tests and the shift-not-rotation test of the spec's
 * §9, plus the no-hidden-layer sweep. A student works §4.2.4 with the
 * chapter open, and must get the chapter's numbers.
 */

const and: RateUnit = { baseline: 0, weights: [1, 1], threshold: 2 }
const or: RateUnit = { baseline: 0, weights: [1, 1], threshold: 1 }

describe('the rate unit', () => {
  it('two strengths of 1 with a threshold of 2 fire only on (1,1)', () => {
    expect(truthTableOf(and, 'threshold')).toEqual([false, false, false, true])
  })

  it('the same strengths with a threshold of 1 fire on (0,1), (1,0) and (1,1)', () => {
    expect(truthTableOf(or, 'threshold')).toEqual([false, true, true, true])
  })

  it('the sigmoid gives the chapter’s rows too, and is graded between them', () => {
    expect(truthTableOf(and, 'sigmoid')).toEqual([false, false, false, true])
    expect(truthTableOf(or, 'sigmoid')).toEqual([false, true, true, true])
    const y = unitOutput(and, [0.9, 0.9], 'sigmoid')
    expect(y).toBeGreaterThan(0.05)
    expect(y).toBeLessThan(0.5)
  })

  it('both activation functions have a floor at zero and a ceiling at one', () => {
    for (const kind of ['threshold', 'sigmoid'] as const) {
      expect(activate(kind, -100, 0)).toBeCloseTo(0, 6)
      expect(activate(kind, 100, 0)).toBeCloseTo(1, 6)
      for (let net = -5; net <= 5; net += 0.1) {
        const y = activate(kind, net, 0.3)
        expect(y).toBeGreaterThanOrEqual(0)
        expect(y).toBeLessThanOrEqual(1)
      }
    }
  })

  it('NOT is an inhibitory input against a standing excitation', () => {
    const not: RateUnit = { baseline: 1, weights: [-2], threshold: 0.5 }
    expect(unitOutput(not, [0], 'threshold')).toBe(1)
    expect(unitOutput(not, [1], 'threshold')).toBe(0)
  })

  it('AND NOT needs a negative weight and then works', () => {
    const andNot: RateUnit = { baseline: 0, weights: [1, -1], threshold: 0.5 }
    expect(truthTableOf(andNot, 'threshold')).toEqual([false, false, true, false])
  })
})

describe('the decision boundary', () => {
  it('going from AND to OR by one number shifts the line and does not rotate it', () => {
    const a = decisionBoundary(and)!
    const o = decisionBoundary(or)!
    expect(Math.abs(a.slope - o.slope)).toBeLessThanOrEqual(0.01 * Math.abs(a.slope))
    expect(a.intercept).not.toBeCloseTo(o.intercept, 6)
    // Lowering the baseline by one does the same work as raising the threshold by one.
    const viaBaseline = decisionBoundary({ ...or, baseline: -1 })!
    expect(viaBaseline.slope).toBeCloseTo(a.slope, 9)
    expect(viaBaseline.intercept).toBeCloseTo(a.intercept, 9)
  })

  it('the four points fall on the side of the line the table says', () => {
    for (const u of [and, or]) {
      const b = decisionBoundary(u)!
      const table = truthTableOf(u, 'threshold')
      TRUTH_ROWS.forEach(([x1, x2], i) => {
        const above = x2 - (b.slope * x1 + b.intercept)
        // With b₂ > 0 the firing side is above the line.
        if (Math.abs(above) > 1e-9) expect(above > 0).toBe(table[i])
      })
    }
  })
})

describe('no hidden layer', () => {
  it('no student-reachable setting of one unit satisfies XOR', () => {
    // The whole slider space at slider resolution, for the threshold function.
    // The sigmoid fires at or above half exactly where the step does, so its
    // decision is the same. (It is a theorem — one line cannot cut the four
    // corners of a square the way XOR asks — but the sweep is the shipped
    // configuration checking itself.)
    const xor = [false, true, true, false]
    const steps = (r: { min: number; max: number; step: number }) =>
      Array.from({ length: Math.round((r.max - r.min) / r.step) + 1 }, (_, i) => r.min + i * r.step)
    const ws = steps(WEIGHT_RANGE)
    const bs = steps(BASELINE_RANGE)
    const ts = steps(THRESHOLD_RANGE)
    let tried = 0
    for (const b1 of ws)
      for (const b2 of ws)
        for (const b0 of bs)
          for (const th of ts) {
            tried++
            const d = b0 - th
            const rows = [d >= 0, d + b2 >= 0, d + b1 >= 0, d + b1 + b2 >= 0]
            if (rows.every((r, i) => r === xor[i])) throw new Error(`XOR at ${b1},${b2},${b0},${th}`)
          }
    expect(tried).toBeGreaterThan(10_000_000)
  })
})
