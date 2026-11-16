import { describe, it, expect } from 'vitest'
import { makeRng } from '../../random'
import { abxTrials, crossing, discrimination, labelingCurves, labelingTrials, predictedFromLabels, predictedCurve, PAIRS, type Label } from './abx'

/**
 * Spec §14, Part 1: ABX scoring is exact; the predicted discrimination
 * matches the paper's formula on a fixture of labeling data worked by
 * hand, including the paper's two example pairs (p. 362).
 */
describe('Step 3’s design', () => {
  it('84 labeling trials, 6 of each step, no two rounds alike; 48 triads, every pair in every order once', () => {
    const t = labelingTrials(makeRng(1))
    expect(t.length).toBe(84)
    for (let s = 1; s <= 14; s++) expect(t.filter((x) => x === s).length).toBe(6)
    const a = abxTrials(makeRng(1))
    expect(a.length).toBe(48)
    const keys = new Set(a.map((x) => x.pair.join('-') + x.order))
    expect(keys.size).toBe(48)
    expect(a.find((x) => x.order === 'BAB')!.xIsFirst).toBe(true)
    expect(a.find((x) => x.order === 'BAA')!.sounds[2]).toBe(a.find((x) => x.order === 'BAA')!.sounds[1])
  })
  it('scores ABX exactly', () => {
    const a = abxTrials(makeRng(2))
    const right = a.map((t) => (t.xIsFirst ? 'first' : 'second')) as ('first' | 'second')[]
    expect(discrimination(a, right).every((d) => d.correct === 1 && d.n === 4)).toBe(true)
    const wrong = a.map((t) => (t.xIsFirst ? 'second' : 'first')) as ('first' | 'second')[]
    expect(discrimination(a, wrong).every((d) => d.correct === 0)).toBe(true)
    expect(discrimination(a, right)[0].middle).toBe(2)
    expect(PAIRS[11]).toEqual([12, 14])
  })
})

describe('the predicted discrimination (pp. 362–363)', () => {
  it('a hand-worked fixture: identical labels give 50%, opposite labels 100%, and a half-and-half case 62.5%', () => {
    expect(predictedFromLabels({ b: 1, d: 0, g: 0 }, { b: 1, d: 0, g: 0 })).toBe(0.5)
    expect(predictedFromLabels({ b: 1, d: 0, g: 0 }, { b: 0, d: 1, g: 0 })).toBe(1)
    // A labeled b always; B labeled b half the time and d half: Σ(p − p′)² = 0.25 + 0.25 = 0.5 → 0.5 + 0.125.
    expect(predictedFromLabels({ b: 1, d: 0, g: 0 }, { b: 0.5, d: 0.5, g: 0 })).toBe(0.625)
    // By hand from the paper's P Corr = P_R + 0.5 P_I for the ABA order with these labels: P_R = Σ p_i² (1 − p′_i) = 0.5, P_W = Σ p′_i p_i (1 − p_i) = 0, P_I = 0.5 → 0.75; ABB: P_R = Σ p′_i² (1 − p_i) = 0.25, P_W = Σ p_i p′_i (1 − p′_i) = 0.25, P_I = 0.5 → 0.5; the average is 0.625.
  })
  it('the paper’s two example pairs: stimuli 1 and 3 both b give 50%; 3 and 5 heard as b and d give 100%', () => {
    const curves: Record<Label, number[]> = { b: [1, 1, 1, 0.3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], d: [0, 0, 0, 0.7, 1, 1, 1, 1, 0.8, 0.2, 0, 0, 0, 0], g: [0, 0, 0, 0, 0, 0, 0, 0, 0.2, 0.8, 1, 1, 1, 1] }
    const pc = predictedCurve(curves)
    expect(pc[0]).toEqual({ middle: 2, predicted: 0.5 })
    expect(pc[2].predicted).toBe(1)
    expect(crossing(curves.b, curves.d)).toBeCloseTo(3.71, 2)
    expect(crossing(curves.d, curves.g)).toBeCloseTo(9.5, 2)
    expect(crossing(curves.g, curves.b)).toBeNull()
  })
  it('curves from answers: 6 presentations each', () => {
    const t = labelingTrials(makeRng(3))
    const answers = t.map((s) => (s <= 4 ? 'b' : s <= 9 ? 'd' : 'g')) as Label[]
    const c = labelingCurves(t, answers)
    expect(c.b[0]).toBe(1)
    expect(c.d[5]).toBe(1)
    expect(c.g[13]).toBe(1)
    expect(c.b[4] + c.d[4] + c.g[4]).toBe(1)
  })
})
