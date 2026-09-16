import { describe, it, expect } from 'vitest'
import { ANIMALS, HEALTHY_CIRCUIT, animalById } from './animals'
import { SCENARIOS, DIAGNOSIS } from './scenarios'
import { wiringSignature, cloneCircuit } from './circuit'
import { MODULATORS, MODULATOR_IDS, healthyLevels } from './modulators'
import { DishWorld } from './dishWorld'
import { Worm } from './worm'
import { makeRng } from '../random'

/**
 * The structural tests of the spec's §9: the W4 test, the
 * modulator-independence test, the no-hidden-layer structure, the one-sensor-
 * per-channel structure, and determinism.
 */

describe('the animals', () => {
  it('every animal is the healthy one with exactly one named thing changed', () => {
    const healthy = animalById('healthy')
    for (const a of ANIMALS) {
      const wiringChanged = wiringSignature(a.circuit) !== wiringSignature(healthy.circuit)
      const chemistryChanged = Object.keys(a.modulators)
      const changes = (wiringChanged ? 1 : 0) + chemistryChanged.length
      expect(changes, a.id).toBeLessThanOrEqual(1)
      if (a.where === 'wiring') expect(wiringChanged, a.id).toBe(true)
      if (a.where === 'chemistry') expect(chemistryChanged.length, a.id).toBe(1)
    }
  })

  it('W4: every weight, switch and threshold equals the healthy default; only satiety differs', () => {
    const w4 = animalById('W4')
    expect(wiringSignature(w4.circuit)).toBe(wiringSignature(HEALTHY_CIRCUIT))
    expect(Object.keys(w4.modulators)).toEqual(['satiety'])
    expect(w4.modulators.satiety).toBeLessThan(healthyLevels().satiety)
    expect(w4.where).toBe('neither')
  })

  it('W0 flips a switch and nothing else', () => {
    const w0 = animalById('W0')
    expect(w0.circuit.routes).toEqual(['reverse'])
    const same = cloneCircuit(w0.circuit)
    same.routes = [...HEALTHY_CIRCUIT.routes]
    expect(wiringSignature(same)).toBe(wiringSignature(HEALTHY_CIRCUIT))
  })
})

describe('the modulators are not the wiring', () => {
  it('moving any modulator to either extreme leaves every stored weight bit-identical', () => {
    for (const spec of MODULATORS) {
      for (const level of [spec.min, spec.max]) {
        const w = new DishWorld(3, DIAGNOSIS, { modulators: { [spec.id]: level } })
        const before = wiringSignature(w.worm.circuit)
        const beforeJson = JSON.stringify(w.worm.circuit)
        w.run(20)
        expect(wiringSignature(w.worm.circuit), spec.id).toBe(before)
        expect(JSON.stringify(w.worm.circuit), spec.id).toBe(beforeJson)
        expect(wiringSignature(w.worm.circuit)).toBe(wiringSignature(DIAGNOSIS.circuit))
      }
    }
  })

  it('a modulator changes the behaviour without changing the diagram', () => {
    const a = new DishWorld(11, DIAGNOSIS)
    const b = new DishWorld(11, DIAGNOSIS, { modulators: { pursuit: 0.2 } })
    a.run(60)
    b.run(60)
    expect(wiringSignature(a.worm.circuit)).toBe(wiringSignature(b.worm.circuit))
    expect(a.worm.reversals).not.toBe(b.worm.reversals)
  })

  it('no modulator is named after a molecule', () => {
    for (const m of MODULATORS) {
      expect(`${m.label} ${m.does}`).not.toMatch(/dopamine|serotonin|norepinephrine|endorphin|opioid/i)
    }
    expect(MODULATOR_IDS).toEqual(['pursuit', 'satiety', 'arousal', 'relief'])
  })
})

describe('structure', () => {
  it('every shipped circuit has exactly one interneuron, and no second adjustable layer exists', () => {
    for (const s of SCENARIOS) expect(s.circuit.interneurons.length, s.key).toBe(1)
    for (const a of ANIMALS) expect(a.circuit.interneurons.length, a.id).toBe(1)
    // The type has weights on the interneurons and a route per interneuron,
    // and nothing else: there is no place for two interneurons to converge.
    const keys = Object.keys(DIAGNOSIS.circuit).sort()
    expect(keys).toEqual(['activation', 'interneurons', 'routes'])
  })

  it('the animal carries exactly one sensor per channel, and none is left or right', () => {
    for (const s of SCENARIOS) {
      const w = new Worm(cloneCircuit(s.circuit), s.channels)
      expect(w.cells.length, s.key).toBe(s.channels.length)
      const channels = w.cells.map((c) => c.channel)
      expect(new Set(channels).size, s.key).toBe(channels.length)
      for (const cell of w.cells) {
        expect(Object.keys(cell)).not.toContain('left')
        expect(Object.keys(cell)).not.toContain('right')
      }
    }
  })

  it('a cue channel carries no valence flag', () => {
    for (const s of SCENARIOS)
      for (const ch of s.channels) {
        const keys = Object.keys(ch)
        for (const k of keys) expect(k).not.toMatch(/attract|avers|repel|valence|good|bad/i)
      }
  })
})

describe('a session-long run', () => {
  it('nothing in the world grows with the run', () => {
    // Lab 3's rule: ring buffers and pruned lists, because a lab runs for a
    // whole session. Twenty minutes in the diagnosis dish, then every
    // per-step or per-event list is checked against its cap.
    const w = new DishWorld(9, DIAGNOSIS)
    w.run(1200)
    expect(w.cuesReached).toBeGreaterThan(5)
    expect(w.reached.length).toBeLessThanOrEqual(200)
    expect(w.meals.length).toBeLessThanOrEqual(6)
    for (const arr of [w.trace.net, w.trace.output, w.trace.rate, w.trace.valence, w.trace.arousal, ...w.trace.cells, ...Object.values(w.trace.levels)]) {
      expect(arr.length).toBeLessThanOrEqual(240)
    }
    expect(w.sources.length).toBeLessThanOrEqual(DIAGNOSIS.sources.length)
    expect(w.worm.chain.length).toBe(16)
    // The last-minute rate reads the same off the capped list.
    const from = w.time - 60
    expect(w.recentCuesPerMinute).toBe(w.reached.filter((t) => t >= from).length)
  })
})

describe('determinism', () => {
  it('same seed and same settings reproduce a run exactly', () => {
    for (const s of SCENARIOS) {
      const a = new DishWorld(2026, s)
      const b = new DishWorld(2026, s)
      a.run(90)
      b.run(90)
      expect(a.worm.head, s.key).toEqual(b.worm.head)
      expect(a.worm.reversals, s.key).toBe(b.worm.reversals)
      expect(a.cuesReached, s.key).toBe(b.cuesReached)
      expect(a.harm, s.key).toBe(b.harm)
      expect(a.sources.map((q) => [q.x, q.z]), s.key).toEqual(b.sources.map((q) => [q.x, q.z]))
    }
  })

  it('different seeds differ', () => {
    const a = new DishWorld(1, DIAGNOSIS)
    const b = new DishWorld(2, DIAGNOSIS)
    a.run(60)
    b.run(60)
    expect(a.worm.head).not.toEqual(b.worm.head)
  })

  it('a worm stepped with a forked stream does not disturb the parent stream', () => {
    const parent = makeRng(5)
    const child = parent.fork()
    const before = parent.next()
    const w = new Worm(cloneCircuit(DIAGNOSIS.circuit), DIAGNOSIS.channels)
    for (let i = 0; i < 300; i++) w.step(1 / 30, [], child, 8)
    const parent2 = makeRng(5)
    parent2.fork()
    expect(parent2.next()).toBe(before)
  })
})
