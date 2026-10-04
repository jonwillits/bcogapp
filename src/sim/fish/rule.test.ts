import { describe, it, expect } from 'vitest'
import { FishBrain, FISH_SIGMOID_WIDTH, buildNetwork, evidenceFor, makeScratch, predictionOf, chapterXorNetwork } from './brain'
import { FishWorld } from './world'
import { scenarioByKey } from './scenarios'
import { cloneCircuit, setWiring, wiringSignature, type Circuit } from '../bilaterian/circuit'
import { makeRng } from '../random'

/**
 * The rule tests of the Module 7 spec's §12: one shape, the numerical
 * gradient check, the threshold function blocking the pass back, fixed at
 * random being fixed, and the prediction being held.
 */

const brainSrc = (import.meta.glob('./brain.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>)['./brain.ts']
const code = brainSrc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const hiddenOf = (c: Circuit) => JSON.stringify(c.interneurons)
const outputOf = (c: Circuit) => JSON.stringify(c.output)

describe('passing the error back is Lab 5’s one rule, not a second rule', () => {
  it('structurally: every change is weightChange(η, x, Φ), every Φ comes from thirdFactor, and nothing else touches a weight', () => {
    // Four changes are computed, all by the one line of Lab 5's rule.
    expect([...code.matchAll(/weightChange\(s\.rate, /g)].length).toBe(4)
    // Φ is asked for twice: the output's, and a hidden unit's.
    expect([...code.matchAll(/thirdFactor\(/g)].length).toBe(2)
    expect(code).toMatch(/thirdFactor\('prediction'/)
    expect(code).toMatch(/thirdFactor\('passed-back'/)
    // No arithmetic on the rate anywhere else, and no second update rule.
    expect(code).not.toMatch(/s\.rate\s*[*/]/)
    expect(code).not.toMatch(/[*/]\s*s\.rate/)
    expect(code).not.toMatch(/momentum|secondRule|adam\b/i)
    // The only things handed to the writer are those computed changes.
    expect([...code.matchAll(/learnWeights\(/g)].length).toBe(2)
    expect(code).toMatch(/learnWeights\(out, last\.output, /)
    expect(code).toMatch(/learnWeights\(hidden\[j\], last\.hidden\[j\], /)
  })

  it('numerically: every weight moves by exactly η · x · Φ, with a hidden unit’s Φ = f′(net) · w · Φ_out', () => {
    const c = buildNetwork({ raw: true, builtIns: [] }, 3, 'pass-back', false, 'sigmoid', makeRng(5))
    // Give the output some weights, so there is something to pass back through.
    ;[0.8, -0.6, 0.4].forEach((value, input) => setWiring(c, { layer: 'output', weight: { input, value } }))
    const brain = new FishBrain(c, { raw: true, builtIns: [] }, { on: true, rate: 0.3, hidden: 'pass-back' })
    const before = cloneCircuit(c)
    brain.sense(0.7, 0.2, 0)
    const x = [...brain.x]
    const h = [...brain.h]
    const p = brain.held.value
    brain.resolve(1)
    const phiOut = 1 - p
    expect(brain.last.phiOut).toBeCloseTo(phiOut, 12)
    for (let j = 0; j < 3; j++) {
      const slope = (h[j] * (1 - h[j])) / FISH_SIGMOID_WIDTH
      const phiJ = slope * before.output!.weights[j] * phiOut
      expect(brain.last.phiHidden[j]).toBeCloseTo(phiJ, 12)
      expect(c.output!.weights[j] - before.output!.weights[j]).toBeCloseTo(0.3 * h[j] * phiOut, 12)
      for (let i = 0; i < 2; i++) {
        expect(c.interneurons[j].weights[i] - before.interneurons[j].weights[i]).toBeCloseTo(0.3 * x[i] * phiJ, 12)
      }
      expect(c.interneurons[j].baseline - before.interneurons[j].baseline).toBeCloseTo(0.3 * 1 * phiJ, 12)
    }
    expect(c.output!.baseline - before.output!.baseline).toBeCloseTo(0.3 * 1 * phiOut, 12)
  })

  it('the numerical gradient check: the change matches a finite-difference estimate of the error’s gradient to within 1%', () => {
    // The error the rule descends: −width · [a·ln p + (1 − a)·ln(1 − p)]. Its
    // slope with respect to the evidence is exactly −(a − p), which is what
    // makes the output's third factor Lab 5's a − p with no slope term.
    const receptors = { raw: true, builtIns: ['both' as const] }
    const scratch = makeScratch()
    const error = (c: Circuit, x1: number, x2: number, a: number) => {
      const p = predictionOf(evidenceFor(c, receptors, x1, x2, scratch))
      return -FISH_SIGMOID_WIDTH * (a * Math.log(p) + (1 - a) * Math.log(1 - p))
    }
    const eta = 1e-3
    const eps = 1e-6
    let checked = 0
    for (const seed of [1, 2, 3]) {
      for (const [x1, x2, a] of [
        [0.8, 0.2, 1],
        [0.3, 0.7, 0],
        [0.55, 0.5, 1],
      ]) {
        const c = buildNetwork(receptors, 3, 'pass-back', false, 'sigmoid', makeRng(seed))
        ;[0.9, -0.7, 0.5].forEach((value, input) => setWiring(c, { layer: 'output', weight: { input, value } }))
        const start = cloneCircuit(c)
        const brain = new FishBrain(c, receptors, { on: true, rate: eta, hidden: 'pass-back' })
        brain.sense(x1, x2, 0)
        brain.resolve(a)
        // Every parameter: each hidden weight and baseline, each output weight and the output's baseline.
        const params: { read: (k: Circuit) => number; nudge: (k: Circuit, d: number) => void }[] = []
        for (let j = 0; j < 3; j++) {
          for (let i = 0; i < 3; i++) {
            params.push({
              read: (k) => k.interneurons[j].weights[i],
              nudge: (k, d) => setWiring(k, { interneuron: j, weight: { input: i, value: start.interneurons[j].weights[i] + d } }),
            })
          }
          params.push({
            read: (k) => k.interneurons[j].baseline,
            nudge: (k, d) => setWiring(k, { interneuron: j, baseline: start.interneurons[j].baseline + d }),
          })
          params.push({
            read: (k) => k.output!.weights[j],
            nudge: (k, d) => setWiring(k, { layer: 'output', weight: { input: j, value: start.output!.weights[j] + d } }),
          })
        }
        params.push({
          read: (k) => k.output!.baseline,
          nudge: (k, d) => setWiring(k, { layer: 'output', baseline: start.output!.baseline + d }),
        })
        for (const prm of params) {
          const up = cloneCircuit(start)
          const down = cloneCircuit(start)
          prm.nudge(up, eps)
          prm.nudge(down, -eps)
          const slope = (error(up, x1, x2, a) - error(down, x1, x2, a)) / (2 * eps)
          const change = prm.read(c) - prm.read(start)
          const expected = -eta * slope
          if (Math.abs(expected) < 1e-9) continue
          expect(Math.abs(change - expected) / Math.abs(expected)).toBeLessThan(0.01)
          checked++
        }
      }
    }
    expect(checked).toBeGreaterThan(100)
  })
})

describe('what the hidden layer’s setting does', () => {
  it('the threshold function blocks it: no hidden weight changes over 1,000 encounters, and the output’s still do', () => {
    const w = new FishWorld(11, scenarioByKey('fruit'), { hidden: 4, hiddenMode: 'pass-back', activation: 'threshold', learning: { on: true } })
    const hidden = hiddenOf(w.brain.circuit)
    const output = outputOf(w.brain.circuit)
    w.run(1000)
    expect(hiddenOf(w.brain.circuit)).toBe(hidden)
    expect(outputOf(w.brain.circuit)).not.toBe(output)
    // The slope is zero, so every hidden unit's share is zero — not merely small.
    expect(w.brain.last.slope.every((s) => s === 0)).toBe(true)
    expect(w.brain.last.phiHidden.every((p) => p === 0)).toBe(true)
  })

  it('with the sigmoid, the same run does move the hidden weights', () => {
    const w = new FishWorld(11, scenarioByKey('fruit'), { hidden: 4, hiddenMode: 'pass-back', learning: { on: true } })
    const hidden = hiddenOf(w.brain.circuit)
    w.run(1000)
    expect(hiddenOf(w.brain.circuit)).not.toBe(hidden)
  })

  it('fixed at random is fixed: hidden weights are bit-identical after 1,000 encounters, sparse or not', () => {
    for (const sparse of [false, true]) {
      const w = new FishWorld(11, scenarioByKey('island'), { hidden: 50, hiddenMode: 'random', sparse, learning: { on: true } })
      const hidden = hiddenOf(w.brain.circuit)
      const output = outputOf(w.brain.circuit)
      w.run(1000)
      expect(hiddenOf(w.brain.circuit)).toBe(hidden)
      expect(outputOf(w.brain.circuit)).not.toBe(output)
    }
  })

  it('by hand: the rule leaves the hidden layer where the student put it', () => {
    const w = new FishWorld(11, scenarioByKey('fruit'), { circuit: chapterXorNetwork(), hidden: 2, hiddenMode: 'hand', activation: 'threshold', learning: { on: true } })
    const hidden = hiddenOf(w.brain.circuit)
    w.run(500)
    expect(hiddenOf(w.brain.circuit)).toBe(hidden)
  })

  it('sparse: about one random unit in ten is active for a typical smell; otherwise about half', () => {
    const share = (sparse: boolean) => {
      const w = new FishWorld(3, scenarioByKey('island'), { hidden: 200, hiddenMode: 'random', sparse })
      let active = 0
      for (let i = 0; i < 200; i++) {
        w.runEncounter()
        active += w.brain.activeHidden
      }
      return active / (200 * 200)
    }
    expect(share(true)).toBeGreaterThan(0.03)
    expect(share(true)).toBeLessThan(0.14)
    expect(share(false)).toBeGreaterThan(0.35)
    expect(share(false)).toBeLessThan(0.65)
  })

  it('there is one hidden layer and no place for a second', () => {
    const w = new FishWorld(1, scenarioByKey('fruit'), { hidden: 4, hiddenMode: 'pass-back' })
    expect(Object.keys(w.brain.circuit).sort()).toEqual(['activation', 'interneurons', 'output', 'routes'])
    // The output reads the hidden units, and each hidden unit reads the receptors.
    expect(w.brain.circuit.output!.weights.length).toBe(4)
    for (const u of w.brain.circuit.interneurons) expect(u.weights.length).toBe(2)
    expect(code).not.toMatch(/layers\b|secondLayer|hidden2/)
  })
})

describe('the prediction is held', () => {
  it('p is generated when the smell arrives and is not recomputed when the outcome does', () => {
    const w = new FishWorld(7, scenarioByKey('one-line'), { learning: { on: true } })
    w.run(50)
    const e = w.begin()
    const held = w.brain.held.value
    expect(w.brain.held.madeAt).toBe(e.index)
    expect(e.p).toBe(held)
    // Between the smell and the outcome, move a weight. A prediction computed
    // afterwards would follow it; a held one does not.
    setWiring(w.brain.circuit, { layer: 'output', weight: { input: 0, value: w.brain.circuit.output!.weights[0] + 2 } })
    w.finish()
    expect(w.brain.held.value).toBe(held)
    expect(w.brain.last.phiOut).toBe((e.happens ? 1 : 0) - held)
  })

  it('the target is the outcome: Φ at the output is a − p and has no slope term', () => {
    const w = new FishWorld(7, scenarioByKey('one-line'), { learning: { on: true } })
    for (let i = 0; i < 200; i++) {
      const e = w.runEncounter()
      expect(w.brain.last.phiOut).toBe((e.happens ? 1 : 0) - e.p)
    }
  })
})

describe('the outcome arrives whatever the verdict', () => {
  it('the fish learns from an encounter it fled, and from one it stayed for', () => {
    const w = new FishWorld(9, scenarioByKey('one-line'), { learning: { on: true } })
    let fled = 0
    let stayed = 0
    for (let i = 0; i < 400; i++) {
      const before = wiringSignature(w.brain.circuit)
      const e = w.runEncounter()
      expect(wiringSignature(w.brain.circuit)).not.toBe(before)
      if (e.verdict) fled++
      else stayed++
    }
    expect(fled).toBeGreaterThan(50)
    expect(stayed).toBeGreaterThan(50)
    // So a hit can be scored: the fish fled, and the eel was there.
    expect(w.counts.hits).toBeGreaterThan(20)
  })
})
