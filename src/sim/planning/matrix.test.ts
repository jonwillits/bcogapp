import { describe, it, expect } from 'vitest'
import { computeMatrix, separability, MATRIX_SEEDS } from './matrix'
import { liveHistory, RUN_ORDER } from './history'

/**
 * Spec §14, Part 3: the hominins × tests matrix over 20 seeds, for each
 * variant of the Shallow planner, with T1 identical across hominins to
 * within the spread of 85% compliance, and every pair separated by at least
 * one of T2 to T6 under variant A. Under variant B the matrix is reported,
 * not enforced.
 */
describe('the hominins × tests matrix', { timeout: 300_000 }, () => {
  const bands = MATRIX_SEEDS.map((s) => liveHistory(s))
  const A = computeMatrix('A', MATRIX_SEEDS, bands)
  const B = computeMatrix('B', MATRIX_SEEDS, bands)

  it('T1 tells no two hominins apart', () => {
    const t1 = RUN_ORDER.map((k) => A.cells[k].T1.mean)
    expect(Math.max(...t1) - Math.min(...t1)).toBeLessThan(0.1)
    for (const v of t1) expect(v).toBeGreaterThan(0.8)
  })

  it('every pair is separated by at least one of T2 to T6 under variant A, by a difference of 0.3 or more', () => {
    for (const row of separability(A)) {
      expect(row.separatingTests.filter((t) => t !== 'T1').length, `${row.a} vs ${row.b}`).toBeGreaterThan(0)
      expect(row.runsFor95, `${row.a} vs ${row.b}`).not.toBeNull()
    }
  })

  it('the expected profile holds where the spec gives one: who passes and who fails each test', () => {
    const pass = (k: (typeof RUN_ORDER)[number], t: 'T1' | 'T3' | 'T4' | 'T5' | 'T6') => A.cells[k][t].mean > 0.6
    const fail = (k: (typeof RUN_ORDER)[number], t: 'T3' | 'T4' | 'T5' | 'T6') => A.cells[k][t].mean < 0.3
    expect(fail('adapted', 'T3') && fail('adapted', 'T4') && fail('adapted', 'T5') && fail('adapted', 'T6')).toBe(true)
    expect(pass('learnedValue', 'T3') && fail('learnedValue', 'T4') && fail('learnedValue', 'T5') && fail('learnedValue', 'T6')).toBe(true)
    expect(pass('copier', 'T3') && pass('copier', 'T4') && pass('copier', 'T5') && fail('copier', 'T6')).toBe(true)
    expect(pass('shallow', 'T3') && pass('shallow', 'T4') && fail('shallow', 'T5') && pass('shallow', 'T6')).toBe(true)
    expect(pass('planner', 'T3') && pass('planner', 'T4') && pass('planner', 'T5') && pass('planner', 'T6')).toBe(true)
    // T2: Adapted goes every day; the Copier stops after day 1; the planners stop within the run.
    expect(A.cells.adapted.T2.mean).toBeGreaterThan(0.7)
    expect(A.cells.copier.T2.mean).toBeLessThan(0.1)
    expect(A.t2Strip.planner[9]).toBeLessThan(0.15)
    expect(A.t2Strip.shallow[9]).toBeLessThan(0.15)
  })

  it('variant B differs from A in the matrix only where the critic’s values come into play', () => {
    for (const k of RUN_ORDER) if (k !== 'shallow') expect(B.cells[k].T1.mean).toBeCloseTo(A.cells[k].T1.mean, 5)
    expect(B.cells.shallow.T5.mean).toBeLessThan(0.3)
  })
})
