import { describe, it, expect } from 'vitest'
import { ANIMALS, animalById } from './animals'
import { DIAGNOSIS, scenarioByKey } from './scenarios'
import { runSeeds } from './measure'
import { DishWorld } from './dishWorld'

/**
 * The behavioural tests of the spec's §9 for Part 3: the symptom-identity
 * test, the ambiguity test, and the reversal-scenario test. Measured over
 * ten seeds of eight simulated minutes each, in the dish the Worms tab
 * ships, at the concentration it ships with and at the top of the control.
 *
 * The bands are on the healthy animal's own scale — a gap of a fifth of
 * what the healthy animal reaches — rather than ratios between the animals,
 * which explode near zero and say nothing a person watching could see.
 */

const SEEDS = 10
const SECONDS = 480
const MAX = 2.5

function rate(id: Parameters<typeof animalById>[0], concentration = 1) {
  const a = animalById(id)
  return runSeeds(DIAGNOSIS, SEEDS, SECONDS, { circuit: a.circuit, modulators: a.modulators, concentration })
}

describe('the five animals', () => {
  const healthy = rate('healthy')
  const w = { W1: rate('W1'), W2: rate('W2'), W3: rate('W3'), W4: rate('W4') }

  it('the healthy animal reaches food at a rate a student can count', () => {
    expect(healthy.cuesPerMinute).toBeGreaterThan(1)
  })

  it('symptom identity: W1 to W4 all reach cues well below the healthy animal', () => {
    for (const [id, r] of Object.entries(w)) {
      expect(r.cuesPerMinute, id).toBeLessThanOrEqual(0.6 * healthy.cuesPerMinute)
    }
  })

  it('symptom identity: W1 to W4 reach cues within a fifth of the healthy rate of one another', () => {
    const rates = Object.values(w).map((r) => r.cuesPerMinute)
    const spread = Math.max(...rates) - Math.min(...rates)
    expect(spread).toBeLessThanOrEqual(0.2 * healthy.cuesPerMinute)
  })

  it('ambiguity: W1 and W3 are the same animal at the shipped concentration', () => {
    expect(Math.abs(w.W1.cuesPerMinute - w.W3.cuesPerMinute)).toBeLessThanOrEqual(0.1 * healthy.cuesPerMinute)
  })

  it('ambiguity: with one plume, W1 and W3 are the same animal to the last bit', () => {
    // A halved weight and a halved gain are the same arithmetic below the
    // sensory cell's ceiling, and with one plume whose centre reads exactly
    // the ceiling, nothing in the dish is ever above it. Same seed, same
    // trajectory, same meals.
    const ll = scenarioByKey('labeled-line')
    const w1 = animalById('W1')
    const w3 = animalById('W3')
    const a = new DishWorld(77, ll, { circuit: { ...ll.circuit, interneurons: [{ ...ll.circuit.interneurons[0], weights: [0.5] }] } })
    const b = new DishWorld(77, ll, { modulators: w3.modulators })
    expect(w1.circuit.interneurons[0].weights[0]).toBe(0.5)
    a.run(300)
    b.run(300)
    expect(a.worm.head).toEqual(b.worm.head)
    expect(a.cuesReached).toBe(b.cuesReached)
    expect(a.worm.reversals).toBe(b.worm.reversals)
  })

  it('ambiguity: at maximum concentration W3 recovers and W1 does not', () => {
    const w1 = rate('W1', MAX).cuesPerMinute
    const w3 = rate('W3', MAX).cuesPerMinute
    const healthyMax = rate('healthy', MAX).cuesPerMinute
    expect(w3).toBeGreaterThanOrEqual(2 * w1)
    expect(w3).toBeGreaterThanOrEqual(0.7 * healthyMax)
    expect(w1).toBeLessThanOrEqual(0.3 * healthyMax)
  })

  it('W2 spends far more of its time reversing than any other animal', () => {
    expect(w.W2.fractionInReverse).toBeGreaterThan(1.5 * healthy.fractionInReverse)
    for (const id of ['W1', 'W3', 'W4'] as const) expect(w.W2.fractionInReverse).toBeGreaterThan(w[id].fractionInReverse)
  })

  it('W0 flees its food and reaches none', () => {
    expect(rate('W0').cuesPerMinute).toBe(0)
  })

  it('W4 goes where the others will not', () => {
    // Time spent inside decaying matter, where a fed animal does not go.
    const inside = (id: 'healthy' | 'W1' | 'W3' | 'W4') => {
      const a = animalById(id)
      let n = 0
      let steps = 0
      for (let seed = 0; seed < 4; seed++) {
        const d = new DishWorld(1000 + seed, DIAGNOSIS, { circuit: a.circuit, modulators: a.modulators })
        for (let i = 0; i < 30 * 240; i++) {
          d.step(1 / 30)
          steps++
          if (d.worm.cells[1].concentration > 1.2) n++
        }
      }
      return n / steps
    }
    // A fed animal keeps out; a hungry one spends most of its life in there.
    // W1 is checked too because a weakened food connection leaves an animal
    // hanging around the edges of what it avoids — but not inside it.
    const w4 = inside('W4')
    expect(w4).toBeGreaterThan(0.5)
    expect(w4).toBeGreaterThan(2.5 * inside('healthy'))
    expect(w4).toBeGreaterThan(1.5 * inside('W1'))
    expect(w4).toBeGreaterThan(1.5 * inside('W3'))
  })
})

describe('the closer', () => {
  it('with healthy weights, the harm counter rises and the animal does not recover within five minutes', () => {
    const reversal = scenarioByKey('reversal')
    for (const seed of [1, 2, 3]) {
      const d = new DishWorld(seed, reversal)
      const harmAt: number[] = []
      for (let minute = 1; minute <= 5; minute++) {
        d.run(60)
        harmAt.push(d.harm)
      }
      for (let i = 1; i < harmAt.length; i++) expect(harmAt[i]).toBeGreaterThanOrEqual(harmAt[i - 1])
      expect(harmAt[4]).toBeGreaterThanOrEqual(4)
      // No recovery: the last two minutes hurt at least as much as the first two.
      expect(harmAt[4] - harmAt[2]).toBeGreaterThanOrEqual(0.5 * harmAt[1])
    }
  })

  it('flipping the switch fixes it in one move', () => {
    const reversal = scenarioByKey('reversal')
    const fixed = new DishWorld(1, reversal)
    fixed.worm.circuit.routes[0] = 'reverse'
    fixed.run(300)
    expect(fixed.harm).toBe(0)
  })
})

describe('every animal is built from the healthy one', () => {
  it('has the five ids', () => {
    expect(ANIMALS.map((a) => a.id)).toEqual(['healthy', 'W0', 'W1', 'W2', 'W3', 'W4'])
  })
})
