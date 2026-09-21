import { describe, it, expect } from 'vitest'
import { LearningDish } from './learningDish'
import { learningScenarioByKey } from './scenarios'
import { mean } from '../measure'

/**
 * Part 3, the corridor: value seeping backward along a chain, the broadcast
 * signal leaving the food, and what the trace window does at both ends
 * (§5.2.8, `f-td-chain`). Thirty trials, about five simulated minutes.
 */

const CORRIDOR = learningScenarioByKey('corridor')
const SEEDS = [1000, 1001, 1002, 1003]
const TRIALS = 30
const CARRIES = 0.3

function runChain(seed: number, traceWindow?: number) {
  const w = new LearningDish(seed, CORRIDOR, traceWindow === undefined ? {} : { learning: { traceWindow } })
  const firstOver = CORRIDOR.learning.lane!.chain.map(() => Infinity)
  const late: { values: number[]; atFood: number }[] = []
  let seen = 0
  while (w.laneTrials < TRIALS && w.time < 1200) {
    w.step(1 / 30)
    if (w.laneTrials === seen) continue
    seen = w.laneTrials
    const c = w.chainByTrial[w.chainByTrial.length - 1]
    c.values.forEach((v, i) => {
      if (firstOver[i] === Infinity && v > CARRIES) firstOver[i] = seen
    })
    if (seen > 20) late.push(c)
  }
  const weights = w.worm.circuit.interneurons[0].weights
  return {
    world: w,
    firstOver,
    lateValues: CORRIDOR.learning.lane!.chain.map((_, i) => mean(late.map((c) => c.values[i]))),
    lateSurprise: mean(late.map((c) => c.atFood)),
    actor: { marker: weights[1], turn: weights[2], approach: weights[3], vibration: weights[4] },
  }
}

describe('the corridor', () => {
  it('value seeps backward: the point nearest the food carries it first, then the turn, then the marker', () => {
    for (const seed of SEEDS) {
      const [marker, turn, approach] = runChain(seed).firstOver
      expect(approach, `seed ${seed}`).toBeLessThanOrEqual(3)
      expect(turn, `seed ${seed}`).toBeGreaterThanOrEqual(approach)
      expect(marker, `seed ${seed}`).toBeGreaterThanOrEqual(turn)
      expect(marker, `seed ${seed}`).toBeLessThanOrEqual(12)
    }
  })

  it('by the last trials the first point in the chain carries more than the food does: the surprise has left the food', () => {
    for (const seed of SEEDS) {
      const r = runChain(seed)
      expect(r.lateValues[0], `seed ${seed}`).toBeGreaterThan(1)
      expect(r.lateSurprise, `seed ${seed}`).toBeLessThan(0.6)
      expect(r.lateValues[0], `seed ${seed}`).toBeGreaterThan(2 * r.lateSurprise)
    }
  })

  it('on the first trial the food is a complete surprise', () => {
    const w = new LearningDish(1000, CORRIDOR)
    while (w.laneTrials < 1) w.step(1 / 30)
    expect(w.chainByTrial[0].atFood).toBeGreaterThan(0.9)
    expect(Math.max(...w.chainByTrial[0].values)).toBeLessThan(CARRIES)
  })

  it('with the trace window at zero, the first action in the chain never gains weight', () => {
    for (const seed of SEEDS) {
      const r = runChain(seed, 0)
      expect(Math.abs(r.actor.marker), `seed ${seed}`).toBeLessThan(0.1)
      expect(r.firstOver[0]).toBe(Infinity)
    }
  })

  it('a wider window carries the news further back sooner', () => {
    const firstMarker = (traceWindow: number) => mean(SEEDS.map((seed) => runChain(seed, traceWindow).firstOver[0]))
    expect(firstMarker(10)).toBeLessThan(firstMarker(3))
  })

  it('what passes through and leads nowhere gains almost nothing, at any window — it never changed the estimate', () => {
    // The spec expected the widest window to credit the bystander as much as
    // the action that mattered. A rule built on changes in the value estimate
    // does not: the vibration raises the estimate, nothing follows, and the
    // error that comes next takes the credit back. §5.2.8 says as much of grooming.
    for (const traceWindow of [3, 10]) {
      for (const seed of SEEDS) {
        const r = runChain(seed, traceWindow)
        expect(r.actor.vibration, `window ${traceWindow} seed ${seed}`).toBeLessThan(0.5 * r.actor.marker)
      }
    }
  })

  it('thirty trials fit in about five simulated minutes', () => {
    expect(mean(SEEDS.map((seed) => runChain(seed).world.time))).toBeLessThan(420)
  })

  it('is a lane, holds the rule at Verdict, and says on its face that this animal does not have the rule', () => {
    expect(CORRIDOR.learning.lane).toBeDefined()
    expect(CORRIDOR.learning.factors).toEqual(['verdict'])
    expect(CORRIDOR.learning.tierFour).toBe(true)
    expect(CORRIDOR.learning.show.credit).toBe(true)
  })
})
