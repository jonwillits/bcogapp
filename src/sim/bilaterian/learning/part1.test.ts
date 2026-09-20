import { describe, it, expect } from 'vitest'
import { LearningDish, CUE_LINGER_S, type LearningDishOptions } from './learningDish'
import { LEARNING_SCENARIOS, learningScenarioByKey } from './scenarios'
import { WEIGHT_CEILING, RATE_RANGE } from './rule'
import { mean } from '../measure'

/**
 * Part 1 in the dish: the opening argument, what coincidence genuinely does,
 * and the three things it cannot do (§5.2.1, §5.2.3, §5.3.5).
 */

const HAND_OVER = learningScenarioByKey('hand-over')
const PAIRING = learningScenarioByKey('pairing')
const DT = 1 / 30
const weightsOf = (w: LearningDish) => w.worm.circuit.interneurons[0].weights

function minutes(w: LearningDish, n: number, each?: () => void): number[] {
  const harmByMinute: number[] = []
  let last = w.harm
  for (let m = 0; m < n; m++) {
    for (let k = 0; k < 1800; k++) {
      w.step(DT)
      each?.()
    }
    harmByMinute.push(w.harm - last)
    last = w.harm
  }
  return harmByMinute
}

describe('hand-over — the opening argument', () => {
  it.each([RATE_RANGE.min, 0.1, 0.3, RATE_RANGE.max])(
    'at η = %s the weight moves by more than 20%% and the animal is harmed anyway, every minute of five',
    (rate) => {
      for (const seed of [1000, 1001, 1002, 1003]) {
        const w = new LearningDish(seed, HAND_OVER, { learning: { rate } })
        let harm = 0
        const byMinute = minutes(w, 5, () => {
          expect(w.harm).toBeGreaterThanOrEqual(harm)
          harm = w.harm
        })
        expect(Math.abs(weightsOf(w)[0] - 1), `seed ${seed}`).toBeGreaterThan(0.2)
        // No recovery: the last two minutes do as much harm as the first two,
        // give or take what one seed's luck allows, and no minute is free.
        expect(byMinute[3] + byMinute[4], `seed ${seed}`).toBeGreaterThanOrEqual(0.5 * (byMinute[0] + byMinute[1]))
        expect(w.harm, `seed ${seed}`).toBeGreaterThan(10)
      }
    },
  )

  it('is harmed as much as the animal whose weights nobody can change', () => {
    const run = (on: boolean) => mean([1000, 1001, 1002, 1003, 1004, 1005].map((seed) => {
      const w = new LearningDish(seed, HAND_OVER, { learning: { on } })
      w.run(300)
      return w.harm
    }))
    expect(run(true)).toBeGreaterThan(0.75 * run(false))
  })

  it('holds the two bounds off, and offers coincidence only', () => {
    expect(HAND_OVER.learning.boundsLocked).toBe(true)
    expect(HAND_OVER.learning.factors).toEqual(['coincidence'])
    const w = new LearningDish(1, HAND_OVER)
    expect(w.learner.settings.weakening).toBe(false)
    expect(w.learner.settings.competition).toBe(false)
  })
})

describe('pairing — what coincidence does', () => {
  it('salt starts ignored and ends driving the verdict by itself', () => {
    for (const seed of [1000, 1001, 1002]) {
      const w = new LearningDish(seed, PAIRING)
      expect(weightsOf(w)[1]).toBe(0)
      w.run(180)
      expect(weightsOf(w)[1], `seed ${seed}`).toBeGreaterThan(HAND_OVER.circuit.interneurons[0].threshold)
      expect(weightsOf(w)[0]).toBe(1)
    }
  })

  it('both bounds start off', () => {
    for (const s of LEARNING_SCENARIOS) {
      expect(s.learning.settings.weakening ?? false, s.key).toBe(false)
      expect(s.learning.settings.competition ?? false, s.key).toBe(false)
    }
  })

  it('indifferent to outcome: a second cue that co-occurs as reliably gains exactly as much', () => {
    const w = new LearningDish(1000, PAIRING, { learning: { rate: 0.05 }, flags: { secondCue: true } })
    w.run(120)
    const [, salt, almond] = weightsOf(w)
    expect(salt).toBeGreaterThan(0.05)
    expect(almond).toBeCloseTo(salt, 10)
  })

  it('cannot bridge a delay: past the coincidence window, a pairing moves the weight by less than a tenth as far', () => {
    const perTrial = (interval: number) =>
      mean([1000, 1001, 1002, 1003, 1004, 1005].map((seed) => {
        const w = new LearningDish(seed, PAIRING, { learning: { rate: 0.02 }, interval })
        w.run(240)
        return weightsOf(w)[1] / Math.max(1, w.trials)
      }))
    const together = perTrial(0)
    expect(together).toBeGreaterThan(0)
    expect(CUE_LINGER_S).toBeLessThan(3)
    expect(perTrial(3) / together).toBeLessThan(0.1)
    expect(perTrial(10) / together).toBeLessThan(0.1)
  })
})

describe('the ratchet, in the dish', () => {
  it('with weakening off, under coincidence, no stored weight ever decreases — every scenario, twenty seeds', () => {
    for (const s of LEARNING_SCENARIOS) {
      for (let seed = 0; seed < 20; seed++) {
        const w = new LearningDish(seed, s, { learning: { factor: 'coincidence', weakening: false, competition: false } })
        let last = [...weightsOf(w)]
        for (let k = 0; k < 30 * 40; k++) {
          w.step(DT)
          const now = weightsOf(w)
          for (let i = 0; i < now.length; i++) expect(now[i], `${s.key} seed ${seed}`).toBeGreaterThanOrEqual(last[i])
          last = [...now]
        }
      }
    }
  })
})

describe('the runaway, in the dish', () => {
  const measure = (opts: LearningDishOptions) => {
    let atCeiling = 0
    let fires = 0
    let n = 0
    for (const seed of [1000, 1001, 1002]) {
      const w = new LearningDish(seed, PAIRING, { ...opts, flags: { secondCue: true } })
      w.run(60)
      for (let k = 0; k < 30 * 180; k++) {
        w.step(DT)
        n++
        if (weightsOf(w)[1] >= WEIGHT_CEILING) atCeiling++
        if ((w.worm.output[0] ?? 0) >= 0.5) fires++
      }
    }
    return { atCeiling: atCeiling / n, fires: fires / n }
  }

  it('both bounds off: inside a minute the weights sit at the ceiling and the verdict fires over most of the dish', () => {
    const r = measure({ learning: { rate: 1 } })
    // Measured over six seeds: 0.98 of the time at the ceiling and the verdict
    // on 0.75 of the time, against 0.06 and 0.35 at most with either bound on.
    expect(r.atCeiling).toBeGreaterThan(0.9)
    expect(r.fires).toBeGreaterThan(0.65)
  })

  it('with weakening on, they do not', () => {
    const r = measure({ learning: { rate: 1, weakening: true } })
    expect(r.atCeiling).toBeLessThan(0.2)
    expect(r.fires).toBeLessThan(0.45)
  })

  it('with competition on, they do not', () => {
    const r = measure({ learning: { rate: 1, competition: true } })
    expect(r.atCeiling).toBe(0)
    expect(r.fires).toBeLessThan(0.45)
  })
})
