import { describe, it, expect } from 'vitest'
import { LearningDish } from './learningDish'
import { learningScenarioByKey } from './scenarios'
import { mean } from '../measure'
import type { ThirdFactor } from './rule'

/**
 * `four-signals`: one problem, the selector unlocked, everything else held.
 * What each rule learns and what it fails at is `t-teaching-signals` filled
 * in by running it (§5.2.7). Five minutes with salt marking the food, then
 * the flip, then five more; means over four seeds.
 */

const SCENARIO = learningScenarioByKey('four-signals')
const SEEDS = [1000, 1001, 1002, 1003]
const HALF_S = 300

function run(factor: ThirdFactor) {
  const runs = SEEDS.map((seed) => {
    const w = new LearningDish(seed, SCENARIO, { learning: { factor } })
    const b = () => w.worm.circuit.interneurons[0].weights
    w.run(HALF_S)
    const before = { salt: b()[1], almond: b()[2] }
    w.flags.almondMarksFood = true
    w.layOutSites()
    w.run(HALF_S)
    return { before, after: { salt: b()[1], almond: b()[2] } }
  })
  const avg = (pick: (r: (typeof runs)[number]) => number) => mean(runs.map(pick))
  return {
    before: { salt: avg((r) => r.before.salt), almond: avg((r) => r.before.almond) },
    after: { salt: avg((r) => r.after.salt), almond: avg((r) => r.after.almond) },
  }
}

describe('four signals, one problem', () => {
  it('everything but the rule is held: the selector is unlocked and nothing else differs between runs', () => {
    expect(SCENARIO.learning.factors).toEqual(['coincidence', 'prediction', 'teacher', 'verdict'])
    const a = new LearningDish(7, SCENARIO, { learning: { factor: 'coincidence' } })
    const b = new LearningDish(7, SCENARIO, { learning: { factor: 'teacher' } })
    expect(a.sites.map((s) => [s.x, s.z])).toEqual(b.sites.map((s) => [s.x, s.z]))
    expect({ ...a.learner.settings, factor: 0 }).toEqual({ ...b.learner.settings, factor: 0 })
  })

  it('coincidence cannot tell the cue that marks food from the one that marks nothing, and unlearns neither', () => {
    const r = run('coincidence')
    expect(Math.abs(r.before.salt - r.before.almond)).toBeLessThan(0.5)
    expect(r.after.salt).toBeGreaterThan(2.5)
    expect(r.after.almond).toBeGreaterThan(2.5)
  })

  it('prediction learns which cue food follows, and follows the flip', () => {
    const r = run('prediction')
    expect(r.before.salt).toBeGreaterThan(0.9)
    expect(Math.abs(r.before.almond)).toBeLessThan(0.15)
    expect(r.after.almond).toBeGreaterThan(r.after.salt + 0.4)
  })

  it('a teacher gets there precisely — it stops as soon as the verdict is right — and follows the flip', () => {
    const r = run('teacher')
    expect(r.before.salt).toBeGreaterThan(0.55)
    expect(r.before.salt).toBeLessThan(0.85)
    expect(Math.abs(r.before.almond)).toBeLessThan(0.2)
    expect(r.after.almond).toBeGreaterThan(r.after.salt + 0.2)
    // Salt is taken down only as far as it has to go: to just under firing.
    expect(r.after.salt).toBeGreaterThan(0.1)
    expect(r.after.salt).toBeLessThan(0.36)
  })

  it('one broadcast number learns which cue leads somewhere good, and is slow to give it up', () => {
    const r = run('verdict')
    expect(r.before.salt).toBeGreaterThan(r.before.almond + 1)
    // It was told only that things went worse than expected, never what to
    // do instead: five minutes after the flip salt still outweighs almond odor.
    expect(r.after.salt).toBeLessThan(r.before.salt)
    expect(r.after.salt).toBeGreaterThan(1)
  })
})
