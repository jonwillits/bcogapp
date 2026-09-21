import { describe, it, expect } from 'vitest'
import { LearningDish } from './learningDish'
import { LEARNING_SCENARIOS } from './scenarios'
import { Learner, plasticEverywhere } from './learner'
import { MODULATORS } from '../modulators'
import { wiringSignature } from '../circuit'
import { TRUTH_ROWS, unitOutput, FIRING } from '../unit'
import { WEIGHT_CEILING, WEIGHT_FLOOR } from './rule'

/**
 * The structural tests of the Module 5 spec's §9 and §7: the six scenarios,
 * modulator independence with its one written-in exception, no hidden layer,
 * no record of an occasion, and determinism.
 */

const sources = import.meta.glob('./*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const production = Object.entries(sources).filter(([p]) => !p.includes('.test.') && !p.includes('.probe.'))
const stripComments = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

describe('the six scenarios', () => {
  it('ship in the spec’s order with the spec’s keys and parts', () => {
    expect(LEARNING_SCENARIOS.map((s) => [s.key, s.part])).toEqual([
      ['hand-over', 1],
      ['pairing', 1],
      ['blocking', 2],
      ['four-signals', 2],
      ['corridor', 3],
      ['extinction', 'closer'],
    ])
  })

  it('every one loads with both bounds off, and only four-signals and blocking unlock the selector', () => {
    for (const s of LEARNING_SCENARIOS) {
      const w = new LearningDish(1, s)
      expect(w.learner.settings.weakening, s.key).toBe(false)
      expect(w.learner.settings.competition, s.key).toBe(false)
      expect(s.learning.factors.length > 1, s.key).toBe(s.key === 'four-signals' || s.key === 'blocking')
    }
  })

  it('the sliders stay live: no scenario locks a plastic weight', () => {
    for (const s of LEARNING_SCENARIOS) {
      s.learning.config.limits.forEach((lim, i) => {
        if (lim.plastic) expect(s.locks.weights[i], `${s.key} b${i + 1}`).toBe(false)
      })
    }
  })
})

describe('the modulators are still not the wiring', () => {
  it('with learning off, moving any of the four functional modulators leaves every stored weight bit-identical', () => {
    for (const s of LEARNING_SCENARIOS) {
      for (const spec of MODULATORS) {
        for (const level of [spec.min, spec.max]) {
          const w = new LearningDish(3, s, { modulators: { [spec.id]: level }, learning: { on: false } })
          const before = wiringSignature(w.worm.circuit)
          w.run(20)
          expect(wiringSignature(w.worm.circuit), `${s.key} ${spec.id}`).toBe(before)
        }
      }
    }
  })

  it('no modulator level appears anywhere in the rule', () => {
    for (const [path, src] of production) {
      if (!/rule\.ts$|learner\.ts$/.test(path)) continue
      expect(stripComments(src), path).not.toMatch(/\.mod\b|modulators|setPoint|pursuit|satiety|arousal|relief/)
    }
  })

  it('the broadcast signal is the exception, and it is written in: changing weights is its job', () => {
    const w = new LearningDish(3, LEARNING_SCENARIOS.find((s) => s.key === 'corridor')!)
    const before = wiringSignature(w.worm.circuit)
    w.run(120)
    expect(wiringSignature(w.worm.circuit)).not.toBe(before)
    expect(MODULATORS.map((m) => m.id)).toEqual(['pursuit', 'satiety', 'arousal', 'relief'])
  })
})

describe('no hidden layer', () => {
  it('every scenario has exactly one interneuron, before and after a run', () => {
    for (const s of LEARNING_SCENARIOS) {
      const w = new LearningDish(2, s)
      w.run(30)
      expect(w.worm.circuit.interneurons.length, s.key).toBe(1)
      expect(w.worm.circuit.routes.length, s.key).toBe(1)
    }
  })

  it('the critic feeds no unit: its output reaches the broadcast signal and nothing else', () => {
    const learner = stripComments(production.find(([p]) => p.endsWith('/learner.ts'))![1])
    const dish = stripComments(production.find(([p]) => p.endsWith('/learningDish.ts'))![1])
    // Nothing takes the critic's value as an input to a unit's net input.
    expect(learner).not.toMatch(/netInput|unitOutput|layerOutput/)
    // The dish reads the critic once, for the Credit section's grid, and hands it to no cell.
    expect([...dish.matchAll(/critic/g)].length).toBe(1)
    expect(dish).toMatch(/chainByTrial\.push\(\{ values: [^\n]*critic/)
    expect(dish).not.toMatch(/internalDrive\[[^\]]*\]\s*=\s*[^;]*\b(value|broadcast)\b/)
  })

  it('no weights the rule can reach satisfy XOR on any two inputs', () => {
    const xor = [false, true, true, false]
    const step = 0.5
    for (let b1 = WEIGHT_FLOOR; b1 <= WEIGHT_CEILING; b1 += step) {
      for (let b2 = WEIGHT_FLOOR; b2 <= WEIGHT_CEILING; b2 += step) {
        for (let theta = -3; theta <= 3; theta += step) {
          const unit = { baseline: 0, threshold: theta, weights: [b1, b2] }
          const rows = TRUTH_ROWS.map(([a, b]) => unitOutput(unit, [a, b], 'threshold') >= FIRING)
          expect(rows).not.toEqual(xor)
        }
      }
    }
  })
})

describe('nothing keeps a record of a particular occasion', () => {
  it('the learner’s state is a fixed number of numbers, however long it runs', () => {
    const size = (l: Learner) => JSON.stringify(l).length
    const unit = { baseline: 0, threshold: 0.35, weights: [0.5, 0.25] }
    const l = new Learner(unit, plasticEverywhere(2), { factor: 'verdict', traceWindow: 3 })
    const keys = Object.keys(l).sort()
    for (let k = 0; k < 300; k++) l.step(1 / 30, { x: [1, 0.5], y: 1, arriving: 1, target: 1, news: 1 })
    const early = size(l)
    for (let k = 0; k < 30000; k++) l.step(1 / 30, { x: [1, 0.5], y: 1, arriving: k % 90 < 30 ? 1 : null, target: 1, news: k % 90 === 0 ? 1 : 0 })
    expect(Object.keys(l).sort()).toEqual(keys)
    // Same fields, same shapes; only the digits in them differ.
    expect(Math.abs(size(l) - early)).toBeLessThan(200)
  })

  it('the learner holds no list that grows: it never pushes, and keeps no timestamps but the one on its held prediction', () => {
    const learner = stripComments(production.find(([p]) => p.endsWith('/learner.ts'))![1])
    const rule = stripComments(production.find(([p]) => p.endsWith('/rule.ts'))![1])
    for (const src of [learner, rule]) {
      expect(src).not.toMatch(/\.push\(|\.unshift\(|new Map|new Set|\bhistory\b|\blog\b/)
    }
  })

  it('the dish’s instruments are capped rings, and a session-long run does not grow them', () => {
    const w = new LearningDish(5, LEARNING_SCENARIOS.find((s) => s.key === 'corridor')!)
    w.run(900)
    const sizes = () => [w.weightTrace[0].length, w.signalTrace.phi.length, w.chainByTrial.length, w.sources.length, w.sites.length]
    const before = sizes()
    w.run(600)
    expect(sizes()).toEqual(before)
  })

  it('no identifier in the layer names one', () => {
    for (const [path, src] of production) expect(stripComments(src), path).not.toMatch(/episod|replay|retriev/i)
  })
})

describe('determinism', () => {
  it('same seed and same settings reproduce a run exactly, in every scenario', () => {
    for (const s of LEARNING_SCENARIOS) {
      const run = () => {
        const w = new LearningDish(77, s)
        w.run(90)
        return JSON.stringify([w.worm.head, w.worm.circuit, w.learner.critic.weights, w.trials, w.harm, w.cuesReached])
      }
      expect(run(), s.key).toBe(run())
    }
  })

  it('one changed setting is the only difference: until the rule first moves a weight, two runs are the same run', () => {
    const s = LEARNING_SCENARIOS[0]
    const a = new LearningDish(9, s, { learning: { rate: 0.01 } })
    const b = new LearningDish(9, s, { learning: { on: false } })
    a.step(1 / 30)
    b.step(1 / 30)
    expect(a.worm.head).toEqual(b.worm.head)
  })

  it('a skip paid down a slice per frame is the same run as one paid at once, and the traces record through it', () => {
    for (const s of LEARNING_SCENARIOS) {
      const sliced = new LearningDish(31, s)
      sliced.skipAhead(180)
      let frames = 0
      while (sliced.paySkip(30) > 0) frames++
      const atOnce = new LearningDish(31, s)
      atOnce.run(180)
      const sig = (w: LearningDish) => JSON.stringify([w.time, w.worm.head, w.worm.circuit, w.trials, w.harm, w.cuesReached, w.weightTrace])
      expect(sig(sliced), s.key).toBe(sig(atOnce))
      expect(frames).toBe(5)
      expect(sliced.weightTrace[0].length).toBeGreaterThan(300)
    }
  })

  it('nothing in the layer reaches for a second source of randomness', () => {
    for (const [path, src] of production) expect(stripComments(src), path).not.toMatch(/Math\.random|makeRng\(|Date\.now|performance\.now/)
  })
})
