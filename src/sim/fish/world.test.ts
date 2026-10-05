import { describe, it, expect } from 'vitest'
import { FishWorld, RING, criterionShift, CHEMISTRY } from './world'
import { FISH_SCENARIOS, scenarioByKey } from './scenarios'
import { KINDS, FAR_DILUTION, ISLAND_RADIUS } from './kinds'
import { wiringSignature } from '../bilaterian/circuit'
import { makeRng } from '../random'

/**
 * The world tests of the Module 7 spec's §12: determinism, the animation's
 * own substream, the balanced draws, the pool, distance, fixed-size state,
 * and Reset.
 */

const sources = import.meta.glob('./*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const production = Object.entries(sources).filter(([p]) => !p.includes('.test.') && !p.includes('.probe.'))
const stripComments = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const digest = (w: FishWorld) =>
  JSON.stringify([wiringSignature(w.brain.circuit), w.encounters, w.harm, w.meals, w.right, w.counts, w.last, w.curve])

describe('the seven scenarios', () => {
  it('ship in the spec’s order with the spec’s keys and parts', () => {
    expect(FISH_SCENARIOS.map((s) => [s.key, s.part])).toEqual([
      ['one-line', 1],
      ['diagnosis', 2],
      ['fruit', 3],
      ['island', 4],
      ['pool', 5],
      ['downstream', 5],
      ['new-predator', 'closer'],
    ])
  })

  it('each loads what the spec’s table says', () => {
    const load = (key: string) => new FishWorld(1, scenarioByKey(key))
    for (const s of FISH_SCENARIOS) expect(load(s.key).brain.settings.on, s.key).toBe(false)
    const one = load('one-line')
    expect(one.brain.circuit.interneurons.length).toBe(0)
    expect(one.brain.circuit.output!.weights).toEqual([0, 0])
    expect(one.settings.spread).toBe(0.06)
    expect(one.route).toBe('dart')
    const diag = load('diagnosis')
    expect(diag.settings.spread).toBe(0.15)
    expect(diag.brain.circuit.output!.weights).toEqual([2.9, -1.6])
    expect(diag.scenario.unlocked).toEqual(['criterion', 'chemistry', 'stakes', 'baseRate'])
    expect(load('fruit').route).toBe('eat')
    expect(load('island').route).toBe('eat')
    const pool = load('pool')
    expect(pool.pool.length).toBe(12)
    expect(pool.brain.circuit.interneurons.length).toBe(8)
    expect(pool.brain.settings.hidden).toBe('pass-back')
    const down = load('downstream')
    expect(down.tests.map((t) => t.key)).toEqual(['near', 'far'])
    expect(down.settings.distance).toBe('near')
    const closer = load('new-predator')
    expect(closer.brain.circuit.interneurons.length).toBe(6)
    expect(closer.tests.map((t) => t.key)).toEqual(['old', 'new'])
    expect(closer.mix.label).toBe('eels and suckers')
  })
})

describe('determinism', () => {
  it('same seed and same settings reproduce a run exactly, in every scenario', () => {
    for (const s of FISH_SCENARIOS) {
      const a = new FishWorld(2026, s, { learning: { on: true } })
      const b = new FishWorld(2026, s, { learning: { on: true } })
      a.run(400)
      b.run(400)
      expect(digest(a), s.key).toBe(digest(b))
    }
  })

  it('different seeds differ', () => {
    const a = new FishWorld(1, scenarioByKey('fruit'), { hidden: 4, hiddenMode: 'pass-back', learning: { on: true } })
    const b = new FishWorld(2, scenarioByKey('fruit'), { hidden: 4, hiddenMode: 'pass-back', learning: { on: true } })
    a.run(100)
    b.run(100)
    expect(digest(a)).not.toBe(digest(b))
  })

  it('no Math.random() anywhere in the fish’s simulation', () => {
    for (const [path, src] of production) expect(stripComments(src), path).not.toMatch(/Math\.random/)
  })

  it('the animation has its own stream: drawing from it, however much, leaves the run identical', () => {
    for (const key of ['fruit', 'pool', 'new-predator']) {
      const quiet = new FishWorld(77, scenarioByKey(key), { learning: { on: true } })
      const lively = new FishWorld(77, scenarioByKey(key), { learning: { on: true } })
      const anim = makeRng(lively.animSeed)
      for (let i = 0; i < 300; i++) {
        quiet.begin()
        quiet.finish()
        lively.begin()
        // A twitch, a flutter, a lateral position for the puff of smell…
        for (let k = 0; k < 1 + (i % 7); k++) anim.next()
        anim.normal()
        lively.finish()
      }
      expect(digest(lively), key).toBe(digest(quiet))
    }
    // And the world never reaches for that stream itself.
    const world = stripComments(sources['./world.ts'])
    expect([...world.matchAll(/seeds\.anim/g)].length).toBe(1)
    expect(world).toMatch(/get animSeed\(\): number \{\s*return this\.seeds\.anim/)
  })

  it('skipping ahead is the same run as watching it', () => {
    for (const s of FISH_SCENARIOS) {
      const watched = new FishWorld(5, s, { learning: { on: true } })
      const skipped = new FishWorld(5, s, { learning: { on: true } })
      for (let i = 0; i < 1000; i++) {
        watched.begin()
        watched.finish()
      }
      // Paid down in slices, with a smell already in front of the fish when the skip starts.
      skipped.begin()
      skipped.run(137)
      skipped.run(363)
      skipped.run(500)
      expect(digest(skipped), s.key).toBe(digest(watched))
    }
  })
})

describe('the draws are balanced', () => {
  it('every two-way problem is half one outcome and half the other at the default base rate', () => {
    for (const s of FISH_SCENARIOS) {
      const w = new FishWorld(3, s)
      w.run(4000)
      const happened = w.counts.hits + w.counts.misses
      expect(happened / 4000, s.key).toBeGreaterThan(0.46)
      expect(happened / 4000, s.key).toBeLessThan(0.54)
      for (const t of w.tests) {
        const share = t.happens.reduce((a, b) => a + b, 0) / t.happens.length
        expect(share, `${s.key} ${t.key}`).toBeGreaterThan(0.4)
        expect(share, `${s.key} ${t.key}`).toBeLessThan(0.6)
      }
    }
  })

  it('the island is the case to watch: half its fruit falls inside the disk, though the disk is a fifth of the square', () => {
    expect(Math.PI * ISLAND_RADIUS * ISLAND_RADIUS).toBeLessThan(0.2)
    const w = new FishWorld(3, scenarioByKey('island'))
    let inside = 0
    for (let i = 0; i < 2000; i++) {
      const e = w.runEncounter()
      const within = Math.hypot(e.x1 - 0.5, e.x2 - 0.5) < ISLAND_RADIUS
      expect(within).toBe(e.happens)
      if (within) inside++
    }
    expect(inside / 2000).toBeGreaterThan(0.46)
    expect(inside / 2000).toBeLessThan(0.54)
    // So a fish that never eats is right half the time, not four times in five.
    expect(w.right / 2000).toBeLessThan(0.54)
  })

  it('the base rate control moves how often the outcome happens, and nothing else', () => {
    const w = new FishWorld(3, scenarioByKey('diagnosis'), { settings: { baseRate: 0.8 } })
    const before = wiringSignature(w.brain.circuit)
    w.run(4000)
    const happened = w.counts.hits + w.counts.misses
    expect(happened / 4000).toBeGreaterThan(0.77)
    expect(happened / 4000).toBeLessThan(0.83)
    expect(wiringSignature(w.brain.circuit)).toBe(before)
  })
})

describe('where the encounters come from', () => {
  it('a pool holds a fixed number of individuals, each with its own smell, met again and again', () => {
    const w = new FishWorld(8, scenarioByKey('pool'))
    expect(w.pool.length).toBe(12)
    expect(w.pool.filter((p) => KINDS[p.kind].happens).length).toBe(6)
    const smells = JSON.stringify(w.pool.map((p) => p.smell))
    const seen = new Map<number, [number, number][]>()
    for (let i = 0; i < 1200; i++) {
      const e = w.runEncounter()
      expect(e.individual).toBeGreaterThanOrEqual(0)
      if (!seen.has(e.individual)) seen.set(e.individual, [])
      seen.get(e.individual)!.push([e.x1, e.x2])
    }
    expect(JSON.stringify(w.pool.map((p) => p.smell))).toBe(smells)
    expect(seen.size).toBe(12)
    expect(w.meetingsPerIndividual).toBeCloseTo(100, 6)
    // Each sniff of one individual is its own smell plus a small jitter, far less than the kind's spread.
    for (const [who, sniffs] of seen) {
      const typical = w.pool[who].smell
      for (const [x1, x2] of sniffs) {
        if (x1 > 0 && x1 < 1) expect(Math.abs(x1 - typical[0])).toBeLessThan(0.1)
        if (x2 > 0 && x2 < 1) expect(Math.abs(x2 - typical[1])).toBeLessThan(0.1)
      }
    }
  })

  it('a stream never repeats: every encounter is a fresh draw', () => {
    const w = new FishWorld(8, scenarioByKey('one-line'))
    const seen = new Set<string>()
    for (let i = 0; i < 500; i++) {
      const e = w.runEncounter()
      expect(e.individual).toBe(-1)
      seen.add(`${e.x1},${e.x2}`)
    }
    expect(seen.size).toBe(500)
  })

  it('far things are diluted: both receptors read about three tenths of what they read near', () => {
    const mean = (far: boolean) => {
      const w = new FishWorld(8, scenarioByKey('downstream'), { settings: { distance: far ? 'far' : 'near' } })
      let a = 0
      let b = 0
      let n = 0
      for (let i = 0; i < 2000; i++) {
        const e = w.runEncounter()
        expect(e.far).toBe(far)
        if (e.kind !== 'eel') continue
        a += e.x1
        b += e.x2
        n++
      }
      return [a / n, b / n]
    }
    const near = mean(false)
    const far = mean(true)
    expect(far[0] / near[0]).toBeCloseTo(FAR_DILUTION, 1)
    expect(far[1] / near[1]).toBeCloseTo(FAR_DILUTION, 1)
  })

  it('the test sets are the experimenter’s: the fish never meets them, and they are the same on every run of a seed', () => {
    const a = new FishWorld(21, scenarioByKey('fruit'), { hidden: 4, hiddenMode: 'pass-back', learning: { on: true } })
    const tests = JSON.stringify(a.tests.map((t) => [Array.from(t.x1), Array.from(t.x2)]))
    const members = new Set(Array.from(a.tests[0].x1).map((x, i) => `${x},${a.tests[0].x2[i]}`))
    for (let i = 0; i < 2000; i++) {
      const e = a.runEncounter()
      expect(members.has(`${Math.fround(e.x1)},${Math.fround(e.x2)}`)).toBe(false)
    }
    expect(JSON.stringify(a.tests.map((t) => [Array.from(t.x1), Array.from(t.x2)]))).toBe(tests)
    // Scoring a test set moves no weight.
    const before = wiringSignature(a.brain.circuit)
    a.testAccuracy(a.tests[0])
    a.testCounts(a.tests[0])
    a.testEvidence(a.tests[0])
    a.scoreFresh(500)
    expect(wiringSignature(a.brain.circuit)).toBe(before)
    expect(a.tests[0].x1.length).toBe(200)
  })
})

describe('nothing in the fish is a list of occasions', () => {
  it('the fish’s state is the same size after ten encounters and after five thousand', () => {
    for (const key of ['fruit', 'pool', 'new-predator']) {
      const w = new FishWorld(4, scenarioByKey(key), { hidden: 6, hiddenMode: 'pass-back', learning: { on: true } })
      const shape = () =>
        JSON.stringify(w.brain, (_k, v) => (typeof v === 'number' ? 0 : v))
      w.run(10)
      const early = shape()
      w.run(4990)
      expect(shape(), key).toBe(early)
    }
  })

  it('what the experimenter keeps is capped too: a ring of recent encounters and a curve that thins itself', () => {
    const w = new FishWorld(4, scenarioByKey('fruit'), { learning: { on: true } })
    w.run(30000)
    expect(w.ring.count).toBe(RING)
    expect(w.ring.x1.length).toBe(RING)
    expect(w.curve.length).toBeLessThanOrEqual(400)
    expect(w.curve[w.curve.length - 1].encounter).toBeGreaterThan(29000)
  })

  it('the brain’s source keeps no log: nothing is pushed, and nothing is named for an occasion', () => {
    const brain = stripComments(sources['./brain.ts'])
    const classBody = brain.slice(brain.indexOf('export class FishBrain'))
    expect(classBody).not.toMatch(/\.push\(|\.unshift\(|history|episode|log\b|replay|memory|recall/i)
  })
})

describe('reset', () => {
  it('restores the weights to where the run started, keeps every setting, and replays the same run', () => {
    const w = new FishWorld(12, scenarioByKey('fruit'), { hidden: 4, hiddenMode: 'pass-back', learning: { on: true } })
    w.set({ spread: 0.1 })
    w.wire({ layer: 'output', threshold: 0.25 })
    const start = wiringSignature(w.brain.circuit)
    w.run(600)
    const first = digest(w)
    expect(wiringSignature(w.brain.circuit)).not.toBe(start)
    w.reset()
    expect(wiringSignature(w.brain.circuit)).toBe(start)
    expect(w.encounters).toBe(0)
    expect(w.settings.spread).toBe(0.1)
    expect(w.brain.settings.on).toBe(true)
    expect(w.brain.circuit.output!.threshold).toBe(0.25)
    w.run(600)
    expect(digest(w)).toBe(first)
  })

  it('a weight set by hand is part of where the run started', () => {
    const w = new FishWorld(12, scenarioByKey('one-line'), { learning: { on: true } })
    w.run(100)
    w.wire({ layer: 'output', weight: { input: 1, value: -2 } })
    w.run(100)
    w.reset()
    expect(w.brain.circuit.output!.weights).toEqual([0, -2])
  })

  it('restoring the scenario’s wiring undoes a reshaped network', () => {
    const w = new FishWorld(12, scenarioByKey('fruit'))
    const start = wiringSignature(w.brain.circuit)
    w.reshape({ hidden: 4, mode: 'pass-back' })
    expect(w.brain.circuit.interneurons.length).toBe(4)
    w.reshape({ builtIns: ['both'] })
    expect(w.brain.circuit.interneurons[0].weights.length).toBe(3)
    w.restoreScenarioWiring()
    expect(wiringSignature(w.brain.circuit)).toBe(start)
    expect(w.brain.settings.hidden).toBe('hand')
  })

  it('a network built by hand can be handed to the rule as it is', () => {
    const w = new FishWorld(12, scenarioByKey('fruit'))
    w.reshape({ hidden: 2 })
    w.wire({ interneuron: 0, weight: { input: 0, value: 1 } })
    w.wire({ interneuron: 0, weight: { input: 1, value: 1 } })
    const built = wiringSignature(w.brain.circuit)
    w.reshape({ mode: 'pass-back' })
    expect(wiringSignature(w.brain.circuit)).toBe(built)
    // But a blank hidden layer is given unlike starting weights, or its units would stay alike for ever.
    const blank = new FishWorld(12, scenarioByKey('fruit'))
    blank.reshape({ hidden: 2 })
    blank.reshape({ mode: 'pass-back' })
    const [a, b] = blank.brain.circuit.interneurons
    expect(a.weights).not.toEqual(b.weights)
    expect(a.weights).not.toEqual([0, 0])
  })
})

describe('the chemistry', () => {
  it('keeps two of Lab 4’s modulators, named as Lab 4 names them', () => {
    expect(CHEMISTRY.map((c) => c.label)).toEqual(['arousal and vigilance', 'satiety and tone'])
  })

  it('arousal lowers the criterion to dart, hunger raises it, and for a verdict routed to eat the signs turn over', () => {
    expect(criterionShift({ arousal: 3, satiety: 1 }, 'dart').total).toBeLessThan(0)
    expect(criterionShift({ arousal: 1, satiety: 0.1 }, 'dart').total).toBeGreaterThan(0)
    expect(criterionShift({ arousal: 1, satiety: 1 }, 'dart').total).toBe(0)
    expect(criterionShift({ arousal: 1, satiety: 0.1 }, 'eat').total).toBeLessThan(0)
  })
})

describe('learning that can do nothing says so', () => {
  it('hidden units set by hand and still all zero, with learning on: the evidence is the same for every smell, and the world flags it', () => {
    const w = new FishWorld(5, scenarioByKey('island'), { hidden: 4, learning: { on: true } })
    expect(w.idleBlankHiddenLayer).toBe(true)
    w.run(1000)
    const ev = w.testEvidence(w.tests[0])
    expect(Math.max(...ev) - Math.min(...ev)).toBeLessThan(1e-6)
    expect(w.idleBlankHiddenLayer).toBe(true)
  })

  it('the flag clears when a hidden weight is set, when the rule is given the hidden layer, when learning is off, and with no hidden units', () => {
    const blank = () => new FishWorld(5, scenarioByKey('island'), { hidden: 4, learning: { on: true } })
    const set = blank()
    set.wire({ interneuron: 0, weight: { input: 0, value: 1 } })
    expect(set.idleBlankHiddenLayer).toBe(false)
    const passed = blank()
    passed.reshape({ mode: 'pass-back' })
    expect(passed.idleBlankHiddenLayer).toBe(false)
    expect(new FishWorld(5, scenarioByKey('island'), { hidden: 4 }).idleBlankHiddenLayer).toBe(false)
    expect(new FishWorld(5, scenarioByKey('island'), { learning: { on: true } }).idleBlankHiddenLayer).toBe(false)
  })
})
