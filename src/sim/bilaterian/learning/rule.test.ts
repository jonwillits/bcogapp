import { describe, it, expect } from 'vitest'
import { makeRng } from '../../random'
import { unitOutput, FIRING, type RateUnit } from '../unit'
import { Learner, plasticEverywhere, type LearningSettings } from './learner'
import { thirdFactor, weightChange, WEIGHT_CEILING, THIRD_FACTORS, type PhiSources } from './rule'

/**
 * The learning layer against a bare integrator: no dish, no animal, a unit
 * and a schedule of inputs. The spec's §9 asks for these four before any UI —
 * the learning-rate arithmetic, the ratchet, the runaway, and the
 * prediction-is-held test — plus the one-rule structure they all rest on.
 */

const DT = 1 / 30
const SINGLE_CUE_THRESHOLD = 0.35

const quiet: PhiSources = { output: 0, weakening: false, usualOutput: 0, arriving: null, heldPrediction: 0, target: null, broadcast: 0 }

/** A unit driven by a schedule of inputs, with the unit's own output fed back as y. */
function drive(
  unit: RateUnit,
  settings: Partial<LearningSettings>,
  seconds: number,
  inputAt: (t: number) => number[],
  each?: (learner: Learner, y: number) => void,
): Learner {
  const learner = new Learner(unit, plasticEverywhere(unit.weights.length), settings)
  for (let t = 0; t < seconds; t += DT) {
    const x = inputAt(t)
    const y = unitOutput(unit, x, 'threshold')
    learner.step(DT, { x, y, arriving: null, target: null, news: 0 })
    each?.(learner, y)
  }
  return learner
}

/** Repeated pairing: a neutral cue and the food odor rise and fall together, one graded level a second. */
function pairing(seed: number): (t: number) => number[] {
  const rng = makeRng(seed)
  const levels = Array.from({ length: 600 }, () => rng.next())
  return (t) => {
    const u = levels[Math.floor(t) % levels.length]
    return [u, u]
  }
}

describe('the learning rate', () => {
  it('reproduces the chapter’s arithmetic: 1600 at η = 1, 16 at η = 0.01', () => {
    expect(weightChange(1, 40, 40)).toBe(1600)
    expect(weightChange(0.01, 40, 40)).toBeCloseTo(16, 10)
    expect(weightChange(1, 40, 2)).toBe(80)
    expect(weightChange(1, 2, 2)).toBe(4)
  })

  it('one occasion at the high rate moves a weight as far as a hundred at the low rate', () => {
    const occasion = () => [1]
    const high: RateUnit = { baseline: 1, threshold: 0, weights: [0] }
    const low: RateUnit = { baseline: 1, threshold: 0, weights: [0] }
    drive(high, { rate: 1 }, 1, occasion)
    drive(low, { rate: 0.01 }, 100, occasion)
    expect(high.weights[0]).toBeGreaterThan(0.9)
    expect(low.weights[0] / high.weights[0]).toBeCloseTo(1, 1)
  })
})

describe('one rule, four third factors', () => {
  it('the selector changes Φ and nothing else: the same Φ gives the same Δb under every setting', () => {
    // Arrange for each setting to supply Φ = 0.4 from its own source, and
    // check that the weight moves identically.
    const sources: Record<string, Partial<LearningSettings> & { input: object }> = {
      coincidence: { input: { y: 0.4 } },
      prediction: { input: { y: 0, arriving: 0.4 } },
      teacher: { input: { y: 0.6, target: 1 } },
    }
    const moved: number[] = []
    for (const [factor, { input }] of Object.entries(sources)) {
      const unit: RateUnit = { baseline: 0, threshold: 0, weights: [0] }
      const learner = new Learner(unit, plasticEverywhere(1), { factor: factor as LearningSettings['factor'], rate: 0.5 })
      learner.step(DT, { x: [0.8], y: 0, arriving: null, target: null, news: 0, ...input })
      expect(learner.phi, factor).toBeCloseTo(0.4, 12)
      moved.push(unit.weights[0])
    }
    expect(moved[1]).toBeCloseTo(moved[0], 12)
    expect(moved[2]).toBeCloseTo(moved[0], 12)
    expect(moved[0]).toBeCloseTo(0.5 * 0.8 * 0.4 * DT, 12)
  })

  it('each setting reads only its own source', () => {
    expect(thirdFactor('coincidence', { ...quiet, output: 0.7, target: 1, arriving: 1, broadcast: 9 })).toBe(0.7)
    expect(thirdFactor('prediction', { ...quiet, output: 0.7, arriving: 1, heldPrediction: 0.25, broadcast: 9 })).toBe(0.75)
    expect(thirdFactor('teacher', { ...quiet, output: 0.7, target: 1, arriving: 1, broadcast: 9 })).toBeCloseTo(0.3, 12)
    expect(thirdFactor('verdict', { ...quiet, output: 0.7, target: 1, arriving: 1, broadcast: -0.5 })).toBe(-0.5)
  })

  it('names the four as the chapter does', () => {
    expect(THIRD_FACTORS.map((f) => f.label)).toEqual(['Coincidence', 'Prediction', 'Teacher', 'Verdict'])
  })
})

describe('the ratchet (§5.2.1)', () => {
  it('with weakening off, under coincidence, no weight ever decreases — twenty seeds', () => {
    for (let seed = 0; seed < 20; seed++) {
      const rng = makeRng(seed)
      const unit: RateUnit = { baseline: 0, threshold: SINGLE_CUE_THRESHOLD, weights: [1, 0, 0.2] }
      let last = [...unit.weights]
      drive(unit, { rate: 0.3 }, 60, () => [rng.next(), rng.next(), rng.next()], () => {
        unit.weights.forEach((b, i) => expect(b).toBeGreaterThanOrEqual(last[i]))
        last = [...unit.weights]
      })
    }
  })

  it('and no amount of it arrives at an inhibitory connection', () => {
    const unit: RateUnit = { baseline: 0, threshold: SINGLE_CUE_THRESHOLD, weights: [1, 0] }
    drive(unit, { rate: 1 }, 120, pairing(3))
    expect(Math.min(...unit.weights)).toBeGreaterThanOrEqual(0)
  })
})

describe('the runaway (§5.3.5)', () => {
  /** Fraction of graded input levels on which the verdict fires. */
  const firesOn = (unit: RateUnit) => {
    let fires = 0
    for (let k = 1; k <= 20; k++) if (unitOutput(unit, [k / 20, k / 20], 'threshold') >= FIRING) fires++
    return fires / 20
  }
  const start = (): RateUnit => ({ baseline: 0, threshold: SINGLE_CUE_THRESHOLD, weights: [1, 0] })

  it('both switches off, a high rate and repeated pairing: the weights reach the ceiling and the verdict fires on essentially everything', () => {
    const unit = start()
    drive(unit, { rate: 1 }, 60, pairing(1))
    expect(unit.weights).toEqual([WEIGHT_CEILING, WEIGHT_CEILING])
    expect(firesOn(unit)).toBeGreaterThanOrEqual(0.9)
  })

  it('reaches it in under a minute', () => {
    const unit = start()
    let reachedAt = Infinity
    drive(unit, { rate: 1 }, 60, pairing(1), (l) => {
      if (reachedAt === Infinity && unit.weights.every((b) => b === WEIGHT_CEILING)) reachedAt = l.time
    })
    expect(reachedAt).toBeLessThan(60)
  })

  it('with weakening on, they do not', () => {
    const unit = start()
    drive(unit, { rate: 1, weakening: true }, 600, pairing(1))
    expect(Math.max(...unit.weights)).toBeLessThan(WEIGHT_CEILING)
    expect(firesOn(unit)).toBeLessThan(0.9)
  })

  it('with competition on, they do not', () => {
    const unit = start()
    drive(unit, { rate: 1, competition: true }, 600, pairing(1))
    expect(Math.max(...unit.weights)).toBeLessThan(WEIGHT_CEILING)
    expect(firesOn(unit)).toBeLessThan(0.9)
  })

  it('competition takes ground an input already held', () => {
    // The food connection starts at 1. Pair a second input with it until they
    // share the budget, and the first has less than it began with... once the
    // budget binds.
    const unit: RateUnit = { baseline: 0, threshold: SINGLE_CUE_THRESHOLD, weights: [1.8, 0] }
    drive(unit, { rate: 1, competition: true }, 120, pairing(2))
    expect(unit.weights[0]).toBeLessThan(1.8)
    expect(unit.weights[1]).toBeGreaterThan(0)
  })
})

describe('the prediction is held (§5.2.6)', () => {
  const unit = (): RateUnit => ({ baseline: 0, threshold: SINGLE_CUE_THRESHOLD, weights: [0.4] })
  const cue = { x: [1], y: 0, target: null, news: 0 }

  it('is generated before the arrival, and not regenerated while the arrival is being resolved', () => {
    const u = unit()
    const learner = new Learner(u, plasticEverywhere(1), { factor: 'prediction', rate: 0.5 })
    for (let k = 0; k < 30; k++) learner.step(DT, { ...cue, arriving: null })
    const madeAt = learner.held.madeAt
    const heldValue = learner.held.value
    expect(heldValue).toBeCloseTo(0.4, 12)
    for (let k = 0; k < 30; k++) {
      learner.step(DT, { ...cue, arriving: 1 })
      expect(learner.held.madeAt).toBe(madeAt)
      expect(learner.held.value).toBe(heldValue)
      expect(learner.arrivalBeganAt).not.toBeNull()
      expect(learner.held.madeAt).toBeLessThan(learner.arrivalBeganAt!)
    }
  })

  it('Φ is what arrived minus the held value — not minus what the weights say by then', () => {
    const u = unit()
    const learner = new Learner(u, plasticEverywhere(1), { factor: 'prediction', rate: 1 })
    learner.step(DT, { ...cue, arriving: null })
    // The weight moves during the arrival; a rule computing the difference
    // after the fact would see its error shrink step by step. A held
    // prediction does not.
    for (let k = 0; k < 30; k++) {
      learner.step(DT, { ...cue, arriving: 1 })
      expect(learner.phi).toBeCloseTo(1 - 0.4, 12)
    }
    expect(u.weights[0]).toBeGreaterThan(0.9)
    expect(learner.prediction([1])).not.toBeCloseTo(learner.held.value, 2)
  })

  it('no other setting holds anything: their Φ does not depend on the register', () => {
    for (const factor of ['coincidence', 'teacher', 'verdict'] as const) {
      const a = thirdFactor(factor, { ...quiet, output: 0.3, target: 1, broadcast: 0.2, heldPrediction: 0 })
      const b = thirdFactor(factor, { ...quiet, output: 0.3, target: 1, broadcast: 0.2, heldPrediction: 5 })
      expect(a, factor).toBe(b)
    }
  })

  it('at η = 1 one full second of arrival carries the weight to what arrived, and no further', () => {
    const u: RateUnit = { baseline: 0, threshold: SINGLE_CUE_THRESHOLD, weights: [0] }
    const learner = new Learner(u, plasticEverywhere(1), { factor: 'prediction', rate: 1 })
    learner.step(DT, { ...cue, arriving: null })
    for (let k = 0; k < 30; k++) learner.step(DT, { ...cue, arriving: 1 })
    expect(u.weights[0]).toBeCloseTo(1, 6)
  })
})

describe('the value estimate and the broadcast signal (§5.2.8)', () => {
  it('the broadcast signal starts at the outcome and moves to the cue that predicts it', () => {
    // A cue for two seconds, then a meal as it ends, then eight seconds of nothing.
    const u: RateUnit = { baseline: 0, threshold: SINGLE_CUE_THRESHOLD, weights: [0] }
    const learner = new Learner(u, plasticEverywhere(1), { factor: 'verdict', rate: 0.5, traceWindow: 2 })
    const trial = () => {
      let atCue = 0
      let atMeal = 0
      for (let k = 0; k < 300; k++) {
        const t = k * DT
        const x = t >= 1 && t < 3 ? [1] : [0]
        const news = k === 90 ? 1 : 0
        learner.step(DT, { x, y: 0, arriving: null, target: null, news })
        if (t >= 1 && t < 3) atCue = Math.max(atCue, learner.broadcast)
        if (t >= 3 && t < 4.5) atMeal = Math.max(atMeal, learner.broadcast)
      }
      return { atCue, atMeal }
    }
    const first = trial()
    let last = first
    for (let n = 0; n < 30; n++) last = trial()
    expect(first.atMeal).toBeGreaterThan(0.9)
    expect(first.atCue).toBeLessThan(0.1)
    expect(last.atCue).toBeGreaterThan(last.atMeal)
    expect(last.atMeal).toBeLessThan(0.5)
    expect(u.weights[0]).toBeGreaterThan(0.3)
  })

  it('a connection whose input is over by the time the news arrives gains only through its trace', () => {
    const run = (traceWindow: number) => {
      const u: RateUnit = { baseline: 0, threshold: SINGLE_CUE_THRESHOLD, weights: [0] }
      const learner = new Learner(u, plasticEverywhere(1), { factor: 'verdict', rate: 0.5, traceWindow })
      for (let n = 0; n < 40; n++) {
        for (let k = 0; k < 300; k++) {
          const t = k * DT
          learner.step(DT, { x: t >= 1.1 && t < 1.7 ? [1] : [0], y: 0, arriving: null, target: null, news: k === 120 ? 1 : 0 })
        }
      }
      return u.weights[0]
    }
    expect(run(4)).toBeGreaterThan(0.2)
    expect(run(0)).toBe(0)
  })

  it('with the window at zero, news that arrives after the input has gone changes nothing', () => {
    const u: RateUnit = { baseline: 0, threshold: SINGLE_CUE_THRESHOLD, weights: [0] }
    const learner = new Learner(u, plasticEverywhere(1), { factor: 'verdict', rate: 0.5, traceWindow: 0 })
    for (let n = 0; n < 20; n++) {
      for (let k = 0; k < 300; k++) {
        const t = k * DT
        learner.step(DT, { x: t >= 1 && t < 3 ? [1] : [0], y: 0, arriving: null, target: null, news: k === 120 ? 1 : 0 })
      }
    }
    expect(u.weights[0]).toBe(0)
  })
})
