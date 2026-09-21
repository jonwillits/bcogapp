import { describe, it, expect } from 'vitest'
import { LearningDish } from './learningDish'
import { learningScenarioByKey } from './scenarios'

/**
 * The four extinction tests of the spec's §9 (§5.2.11). Extinction is not a
 * decaying weight: after it the cue's weight sits well above where it began,
 * and each of the three returns brings the response back — because what
 * extinction added was new learning about context, laid over an association
 * that survived.
 *
 * "Response" is the verdict to the cue alone, where and when the animal now
 * is. It is what a student reads on the World tab, and what the verdict trace
 * shows when the animal next touches a salt site.
 */

const EXTINCTION = learningScenarioByKey('extinction')
const SEEDS = [1000, 1001, 1002, 1003]
const SALT = 1

function extinguished(seed: number) {
  const w = new LearningDish(seed, EXTINCTION)
  const before = w.worm.circuit.interneurons[0].weights[SALT]
  w.run(240)
  const acquired = { salt: w.worm.circuit.interneurons[0].weights[SALT], response: w.responseToCue() }
  w.setPhase(1)
  w.run(180)
  return { w, before, acquired }
}

describe('extinction is not unlearning', () => {
  it('acquisition builds the response, and extinction takes it away', () => {
    for (const seed of SEEDS) {
      const { w, acquired } = extinguished(seed)
      expect(acquired.salt, `seed ${seed}`).toBeGreaterThan(0.85)
      expect(acquired.response, `seed ${seed}`).toBeGreaterThan(0.9)
      expect(w.responseToCue(), `seed ${seed}`).toBeLessThan(0.2)
    }
  })

  it('the stored weight ends far above where it started — no account that put it back could produce this', () => {
    for (const seed of SEEDS) {
      const { w, before, acquired } = extinguished(seed)
      const salt = w.worm.circuit.interneurons[0].weights[SALT]
      expect(before).toBe(0)
      expect(salt, `seed ${seed}`).toBeGreaterThan(0.5)
      expect(salt / acquired.salt, `seed ${seed}`).toBeGreaterThan(0.55)
      // What took the response away is on the context connections, and it is inhibitory.
      const [, , dish, , session] = w.worm.circuit.interneurons[0].weights
      expect(dish, `seed ${seed}`).toBeLessThan(-0.2)
      expect(session, `seed ${seed}`).toBeLessThan(-0.2)
    }
  })

  it('spontaneous recovery: wait, with no training of any kind, and the response returns', () => {
    for (const seed of SEEDS) {
      const { w } = extinguished(seed)
      const weights = JSON.stringify(w.worm.circuit.interneurons[0].weights)
      const low = w.responseToCue()
      w.wait()
      expect(JSON.stringify(w.worm.circuit.interneurons[0].weights)).toBe(weights)
      expect(w.responseToCue() - low, `seed ${seed}`).toBeGreaterThan(0.25)
    }
  })

  it('renewal: move to the second dish and the response returns; move back and it is gone again', () => {
    for (const seed of SEEDS) {
      const { w } = extinguished(seed)
      const weights = JSON.stringify(w.worm.circuit.interneurons[0].weights)
      const low = w.responseToCue()
      w.moveDish()
      expect(JSON.stringify(w.worm.circuit.interneurons[0].weights)).toBe(weights)
      expect(w.responseToCue() - low, `seed ${seed}`).toBeGreaterThan(0.25)
      w.moveDish()
      expect(w.responseToCue(), `seed ${seed}`).toBeCloseTo(low, 10)
    }
  })

  it('reinstatement: one unpaired delivery and the response returns', () => {
    for (const seed of SEEDS) {
      const { w } = extinguished(seed)
      const low = w.responseToCue()
      const salt = w.worm.circuit.interneurons[0].weights[SALT]
      const meals = w.cuesReached
      w.deliverOutcome()
      for (let k = 0; k < 1800 && w.cuesReached === meals; k++) w.step(1 / 30)
      expect(w.cuesReached).toBe(meals + 1)
      expect(w.responseToCue() - low, `seed ${seed}`).toBeGreaterThan(0.25)
      // The cue was not there beyond a trace of salt from across the dish; its weight did not do this.
      expect(w.worm.circuit.interneurons[0].weights[SALT]).toBeLessThanOrEqual(salt + 0.1)
    }
  })

  it('none of the returns reaches the level before extinction — they are partial, as in the reading’s figure — and two together return more than one', () => {
    const { w, acquired } = extinguished(1000)
    w.wait()
    const one = w.responseToCue()
    expect(one).toBeLessThan(acquired.response)
    w.moveDish()
    expect(w.responseToCue()).toBeGreaterThan(one)
  })

  it('context connections can only become inhibitory, and with nothing arriving no weight moves: nothing decays', () => {
    const limits = EXTINCTION.learning.config.limits
    for (const cell of [2, 3, 4, 5]) expect(limits[cell].max).toBe(0)
    const { w } = extinguished(1000)
    w.learner.settings.on = false
    const before = JSON.stringify(w.worm.circuit.interneurons[0].weights)
    w.run(120)
    expect(JSON.stringify(w.worm.circuit.interneurons[0].weights)).toBe(before)
  })
})
