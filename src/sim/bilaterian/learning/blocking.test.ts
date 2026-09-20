import { describe, it, expect } from 'vitest'
import { LearningDish } from './learningDish'
import { learningScenarioByKey } from './scenarios'
import type { ThirdFactor } from './rule'

/**
 * The blocking test of the spec's §9 — the one that matters, and a blocker
 * rather than a polish item. Coincidence and prediction behave alike on a
 * single cue; this is the experiment that tells them apart (§5.2.4, §5.2.5).
 *
 * Run as a student runs it: the scenario as shipped, its default rate, four
 * minutes a phase, the phases stepped by hand.
 */

const BLOCKING = learningScenarioByKey('blocking')
const PHASE_S = 240
const SEEDS = [1000, 1001, 1002, 1003]

function runThrough(seed: number, factor: ThirdFactor) {
  const w = new LearningDish(seed, BLOCKING, { learning: { factor } })
  const weights = () => w.worm.circuit.interneurons[0].weights
  w.run(PHASE_S)
  const afterOne = { salt: weights()[1], almond: weights()[2] }
  w.setPhase(1)
  w.run(PHASE_S)
  const afterTwo = { salt: weights()[1], almond: weights()[2] }
  w.setPhase(2)
  w.run(PHASE_S)
  return { afterOne, afterTwo, afterTest: { salt: weights()[1], almond: weights()[2] }, world: w }
}

describe('blocking', () => {
  it('phase 1 trains salt to where it stops climbing, under either rule, and leaves almond odor alone', () => {
    for (const seed of SEEDS) {
      const hebb = runThrough(seed, 'coincidence').afterOne
      const delta = runThrough(seed, 'prediction').afterOne
      expect(hebb.salt, `seed ${seed}`).toBe(3)
      expect(delta.salt, `seed ${seed}`).toBeGreaterThan(0.85)
      expect(delta.salt, `seed ${seed}`).toBeLessThanOrEqual(1.001)
      expect(hebb.almond).toBe(0)
      expect(delta.almond).toBe(0)
    }
  })

  it('under prediction, the added cue ends below 20% of the first — the food was already predicted', () => {
    for (const seed of SEEDS) {
      const { afterTwo, afterTest } = runThrough(seed, 'prediction')
      expect(afterTwo.almond / afterTwo.salt, `seed ${seed}`).toBeLessThan(0.2)
      expect(afterTest.almond / afterTest.salt, `seed ${seed}`).toBeLessThan(0.2)
    }
  })

  it('under coincidence, the added cue ends within 30% of the first — they were active together, and that is all the rule asks', () => {
    for (const seed of SEEDS) {
      const { afterTwo, afterTest } = runThrough(seed, 'coincidence')
      expect(Math.abs(afterTwo.almond - afterTwo.salt) / afterTwo.salt, `seed ${seed}`).toBeLessThan(0.3)
      expect(Math.abs(afterTest.almond - afterTest.salt) / afterTest.salt, `seed ${seed}`).toBeLessThan(0.3)
    }
  })

  it('and the animal shows it: tested alone, almond odor is sought out under coincidence and not under prediction', () => {
    const visits = (factor: ThirdFactor) => SEEDS.reduce((sum, seed) => {
      const { world } = runThrough(seed, factor)
      const before = world.trials
      world.run(PHASE_S)
      return sum + (world.trials - before)
    }, 0)
    expect(visits('coincidence')).toBeGreaterThan(1.2 * visits('prediction'))
  })

  it('the three phases are stepped by hand, and the weights carry across them', () => {
    expect(BLOCKING.learning.phases?.length).toBe(3)
    const w = new LearningDish(1, BLOCKING)
    w.run(120)
    const before = [...w.worm.circuit.interneurons[0].weights]
    w.setPhase(1)
    expect(w.worm.circuit.interneurons[0].weights).toEqual(before)
    expect(w.sites.every((s) => s.spec.cues.length === 2)).toBe(true)
  })
})
