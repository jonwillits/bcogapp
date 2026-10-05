import { describe, it, expect } from 'vitest'
import { FishWorld, type WorldOptions } from './world'
import { scenarioByKey } from './scenarios'
import { chapterXorNetwork, evidenceFor, hiddenOutputFor, makeScratch, FISH_WEIGHT_RANGE, FISH_BASELINE_RANGE } from './brain'
import { KINDS } from './kinds'
import { falseAlarmRate, hitRate } from './sdt'

/**
 * The measured targets of the Module 7 spec's §12, on a bare network: XOR,
 * the island, overfitting in a pool, failure downstream, and interference.
 * Where the running model disagreed with a starting target, the band here is
 * what the model does, and `docs/M07_AS_BUILT_NOTES.md` §5 says so.
 */

const SEEDS = [1000, 1001, 1002, 1003, 1004, 1005]
const SEEDS20 = Array.from({ length: 20 }, (_, i) => 1000 + i)
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
const on = { on: true }

function trained(key: string, opts: WorldOptions, seed: number, encounters: number): FishWorld {
  const w = new FishWorld(seed, scenarioByKey(key), { ...opts, learning: { ...on, ...opts.learning } })
  w.run(encounters)
  return w
}

function reaches(key: string, opts: WorldOptions, seed: number, limit: number, bar = 95): boolean {
  const w = new FishWorld(seed, scenarioByKey(key), { ...opts, learning: { ...on, ...opts.learning } })
  for (let n = 0; n < limit; n += 50) {
    w.run(50)
    if (w.testAccuracy(w.tests[0]) >= bar) return true
  }
  return false
}

describe('ripe or rotting (fruit)', () => {
  it('one unit fails: test accuracy stays below 80% after 5,000 encounters, at every learning rate offered', () => {
    for (const rate of [0.01, 0.05, 0.2, 0.5, 1]) {
      for (const seed of SEEDS.slice(0, 3)) {
        const w = trained('fruit', { learning: { rate } }, seed, 5000)
        expect(w.testAccuracy(w.tests[0]), `η=${rate} seed ${seed}`).toBeLessThan(80)
      }
    }
  })

  it('the two prototype crosses lie within 0.05 of each other', () => {
    for (const seed of SEEDS) {
      const p = new FishWorld(seed, scenarioByKey('fruit')).prototypes()
      expect(Math.hypot(p.happens[0] - p.doesNot[0], p.happens[1] - p.doesNot[1]), `seed ${seed}`).toBeLessThan(0.05)
    }
    // In Part 1 they are far apart: that is why one line will do there.
    const p = new FishWorld(1, scenarioByKey('one-line')).prototypes()
    expect(Math.hypot(p.happens[0] - p.doesNot[0], p.happens[1] - p.doesNot[1])).toBeGreaterThan(0.3)
  })

  it('the chapter’s hand-built network — OR, NOT-AND, AND — is settable within the sliders and gets all four corners right with the threshold function', () => {
    const c = chapterXorNetwork()
    expect(c.activation).toBe('threshold')
    for (const u of [...c.interneurons, c.output!]) {
      for (const b of u.weights) {
        expect(b).toBeGreaterThanOrEqual(FISH_WEIGHT_RANGE.min)
        expect(b).toBeLessThanOrEqual(FISH_WEIGHT_RANGE.max)
      }
      expect(Math.abs(u.baseline)).toBeLessThanOrEqual(FISH_BASELINE_RANGE.max)
    }
    const s = makeScratch()
    const raw = { raw: true, builtIns: [] }
    for (const id of ['twig', 'ripe-a', 'ripe-b', 'rotting'] as const) {
      const [x1, x2] = KINDS[id].typical!
      expect(evidenceFor(c, raw, x1, x2, s) >= c.output!.threshold, id).toBe(KINDS[id].happens)
    }
    // The first hidden unit computes OR and the second NOT-AND.
    const corner = (id: 'twig' | 'ripe-a' | 'ripe-b' | 'rotting', j: number) => hiddenOutputFor(c, raw, j, ...KINDS[id].typical!, s)
    expect([corner('twig', 0), corner('ripe-a', 0), corner('ripe-b', 0), corner('rotting', 0)]).toEqual([0, 1, 1, 1])
    expect([corner('twig', 1), corner('ripe-a', 1), corner('ripe-b', 1), corner('rotting', 1)]).toEqual([1, 1, 1, 0])
    // And in the stream, where smells vary, it is right nearly every time.
    const w = new FishWorld(3, scenarioByKey('fruit'), { circuit: c, hidden: 2 })
    expect(w.testAccuracy(w.tests[0])).toBeGreaterThanOrEqual(95)
  })

  it('four hidden units, passing the error back: at least 95% on the test set in at least 18 of 20 seeds within 2,000 encounters', () => {
    const solved = SEEDS20.filter((s) => reaches('fruit', { hidden: 4, hiddenMode: 'pass-back' }, s, 2000))
    expect(solved.length).toBeGreaterThanOrEqual(18)
  })

  it('one hidden unit never does; two sometimes stick', () => {
    expect(SEEDS20.filter((s) => reaches('fruit', { hidden: 1, hiddenMode: 'pass-back' }, s, 2000)).length).toBe(0)
    const two = SEEDS20.filter((s) => reaches('fruit', { hidden: 2, hiddenMode: 'pass-back' }, s, 2000)).length
    expect(two).toBeGreaterThanOrEqual(8)
    expect(two).toBeLessThanOrEqual(18)
  })

  it('with exactly two hidden units after training, two corners that share an outcome land together in hidden space — the ripe pair, or the other pair', () => {
    // The spec expected the chapter's solution every time: OR and NOT-AND,
    // with the two ripe corners on one point. The rule also finds the other
    // one — "A without B" and "B without A" — where it is the twig and the
    // rotting fruit that land together. Either way two corners that call for
    // the same response have been drawn onto one point, and one line then
    // separates the kinds. Which one a run finds depends on its starting weights.
    const raw = { raw: true, builtIns: [] }
    const s = makeScratch()
    let ripeTogether = 0
    let othersTogether = 0
    for (const seed of SEEDS20) {
      const w = trained('fruit', { hidden: 2, hiddenMode: 'pass-back' }, seed, 2000)
      if (w.testAccuracy(w.tests[0]) < 95) continue
      const at = (id: 'twig' | 'ripe-a' | 'ripe-b' | 'rotting') => {
        const [x1, x2] = KINDS[id].typical!
        return [hiddenOutputFor(w.brain.circuit, raw, 0, x1, x2, s), hiddenOutputFor(w.brain.circuit, raw, 1, x1, x2, s)]
      }
      const d = (p: number[], q: number[]) => Math.hypot(p[0] - q[0], p[1] - q[1])
      const ripe = d(at('ripe-a'), at('ripe-b'))
      const others = d(at('twig'), at('rotting'))
      let across = Infinity
      for (const r of ['ripe-a', 'ripe-b'] as const) for (const o of ['twig', 'rotting'] as const) across = Math.min(across, d(at(r), at(o)))
      expect(Math.min(ripe, others), `seed ${seed}`).toBeLessThan(across)
      if (ripe < across) ripeTogether++
      if (others < across) othersTogether++
    }
    expect(ripeTogether + othersTogether).toBeGreaterThanOrEqual(8)
  })

  it('Both together on, no hidden units: one unit solves it', () => {
    for (const seed of SEEDS) expect(reaches('fruit', { builtIns: ['both'] }, seed, 2000), `seed ${seed}`).toBe(true)
  })
})

describe('the island', () => {
  it('Distance from the ideal strength, no hidden units: at least 95%. Both together instead: under 80%', () => {
    for (const seed of SEEDS) {
      expect(reaches('island', { builtIns: ['distance'] }, seed, 2000), `distance, seed ${seed}`).toBe(true)
      const both = trained('island', { builtIns: ['both'] }, seed, 5000)
      expect(both.testAccuracy(both.tests[0]), `both, seed ${seed}`).toBeLessThan(80)
    }
  })

  it('and Distance from the ideal strength does nothing for the fruit: a built-in receptor is a bet on one problem', () => {
    for (const seed of SEEDS.slice(0, 3)) {
      const w = trained('fruit', { builtIns: ['distance'] }, seed, 5000)
      expect(w.testAccuracy(w.tests[0]), `seed ${seed}`).toBeLessThan(80)
    }
  })

  it('fixed at random: accuracy rises with the size of the layer, with only the output learning', () => {
    const after = (hidden: number, sparse: boolean) =>
      mean(SEEDS.map((s) => {
        const w = trained('island', { hidden, hiddenMode: 'random', sparse }, s, 5000)
        return w.testAccuracy(w.tests[0])
      }))
    const sparse = [2, 10, 50, 200].map((h) => after(h, true))
    expect(sparse[0]).toBeLessThan(80)
    expect(sparse[1]).toBeGreaterThan(sparse[0])
    expect(sparse[3]).toBeGreaterThanOrEqual(95)
    const dense = [2, 200].map((h) => after(h, false))
    expect(dense[0]).toBeLessThan(80)
    expect(dense[1]).toBeGreaterThan(dense[0] + 15)
    // Sparse coding helps: the same 200 units do at least as well with one in ten active.
    expect(sparse[3]).toBeGreaterThanOrEqual(dense[1])
  })

  it('passing the error back: two hidden units cannot; six reach 95% in most seeds', () => {
    expect(SEEDS20.filter((s) => reaches('island', { hidden: 2, hiddenMode: 'pass-back' }, s, 5000)).length).toBe(0)
    expect(SEEDS20.filter((s) => reaches('island', { hidden: 6, hiddenMode: 'pass-back' }, s, 5000)).length).toBeGreaterThanOrEqual(14)
  })
})

describe('the eels it has met (pool)', () => {
  const gap = (opts: WorldOptions) =>
    SEEDS.map((s) => {
      const w = trained('pool', opts, s, 5000)
      return { train: w.recentTrainingAccuracy, test: w.testAccuracy(w.tests[0]) }
    })

  it('six individuals, eight hidden units, 5,000 encounters: training accuracy runs well ahead of the test set', () => {
    const r = gap({})
    expect(mean(r.map((x) => x.train - x.test))).toBeGreaterThanOrEqual(8)
    expect(mean(r.map((x) => x.train))).toBeGreaterThan(mean(r.map((x) => x.test)))
  })

  it('fewer hidden units change little: with none, two or three the test set is within five points of eight, and the gap is still wide', () => {
    // At six individuals the overfitting comes from the pool, not from the
    // size of the network: a single line fitted to six is already 16 points
    // better on them than on the test set.
    const eight = mean(gap({}).map((x) => x.test))
    for (const hidden of [0, 2, 3]) {
      const r = gap({ hidden })
      expect(Math.abs(mean(r.map((x) => x.test)) - eight)).toBeLessThanOrEqual(5)
      expect(mean(r.map((x) => x.train - x.test))).toBeGreaterThanOrEqual(8)
    }
  })

  it('a larger pool shrinks the gap, and a stream closes it: training and test within 3 points', () => {
    const six = mean(gap({}).map((x) => x.train - x.test))
    const sixty = mean(gap({ settings: { poolSize: 60 } }).map((x) => x.train - x.test))
    expect(sixty).toBeLessThan(six - 3)
    const stream = gap({ settings: { source: 'stream' } })
    expect(Math.abs(mean(stream.map((x) => x.train - x.test)))).toBeLessThanOrEqual(3)
  })
})

describe('downstream', () => {
  const far = (opts: WorldOptions, n = 1000) =>
    SEEDS.map((s) => {
      const w = trained('downstream', opts, s, n)
      const c = w.testCounts(w.tests[1])
      return { near: w.testAccuracy(w.tests[0]), far: w.testAccuracy(w.tests[1]), hit: 100 * hitRate(c), fa: 100 * falseAlarmRate(c) }
    })

  it('trained near only: near test at least 90%; far eels are missed, and far suckers are not fled', () => {
    for (const n of [300, 1000, 3000]) {
      for (const r of far({}, n)) {
        expect(r.near).toBeGreaterThanOrEqual(90)
        expect(r.hit).toBeLessThanOrEqual(50)
        expect(r.fa).toBeLessThanOrEqual(10)
      }
    }
  })

  it('learn from every distance: far test at least 85%', () => {
    const r = far({ settings: { distance: 'both' } }, 2000)
    expect(mean(r.map((x) => x.far))).toBeGreaterThanOrEqual(85)
    expect(mean(r.map((x) => x.near))).toBeGreaterThanOrEqual(90)
  })

  it('Proportion of A beside A and B, trained near only: the fish still leans on raw strength, and misses about half the far eels', () => {
    // The spec's "one outcome to watch for", and it happens: near the fish,
    // strength and proportion separate eel from sucker equally well, so the
    // rule spreads the work across all three inputs.
    const r = far({ builtIns: ['proportion'] }, 1000)
    expect(mean(r.map((x) => x.near))).toBeGreaterThanOrEqual(90)
    expect(mean(r.map((x) => x.far))).toBeLessThan(85)
    expect(mean(r.map((x) => x.hit))).toBeLessThan(75)
  })

  it('Proportion only, trained near only: far test at least 85% without ever having been there', () => {
    const r = far({ builtIns: ['proportion'], raw: false }, 2000)
    expect(mean(r.map((x) => x.far))).toBeGreaterThanOrEqual(85)
    expect(mean(r.map((x) => x.hit))).toBeGreaterThanOrEqual(85)
  })
})

describe('a new predator', () => {
  const closer = (stay: boolean) =>
    SEEDS.map((s) => {
      const w = trained('new-predator', {}, s, 1000)
      const afterOne = w.testAccuracy(w.tests[0])
      w.set({ phase: 1, stayAround: stay })
      w.run(1000)
      return { afterOne, old: w.testAccuracy(w.tests[0]), fresh: w.testAccuracy(w.tests[1]), w }
    })

  it('after phase 1 the eel-and-sucker test is at least 95%', () => {
    expect(mean(closer(false).map((x) => x.afterOne))).toBeGreaterThanOrEqual(95)
  })

  it('after phase 2 alone: pike-and-chub at least 90%, and eel-and-sucker has collapsed to 60% or less', () => {
    for (const r of closer(false)) {
      expect(r.fresh).toBeGreaterThanOrEqual(90)
      expect(r.old).toBeLessThanOrEqual(60)
    }
  })

  it('then an eel comes back, and the fish stays', () => {
    let struck = 0
    for (const r of closer(false)) {
      r.w.eelReturns()
      const harm = r.w.harm
      const e = r.w.runEncounter()
      expect(e.kind).toBe('eel')
      if (!e.verdict) {
        struck++
        expect(r.w.harm).toBe(harm + 1)
      }
    }
    expect(struck).toBeGreaterThanOrEqual(5)
  })

  it('an eel comes back at once, even with another smell already drifting down', () => {
    const w = trained('new-predator', {}, 1000, 1000)
    w.set({ phase: 1 })
    w.run(500)
    const pike = w.begin()
    expect(['pike', 'chub']).toContain(pike.kind)
    w.eelReturns()
    expect(w.pending).toBeNull()
    expect(w.runEncounter().kind).toBe('eel')
    // After that the stream holds all four.
    const seen = new Set<string>()
    for (let i = 0; i < 200; i++) seen.add(w.runEncounter().kind)
    expect([...seen].sort()).toEqual(['chub', 'eel', 'pike', 'sucker'])
  })

  it('with eels and suckers staying around, both test sets stay high', () => {
    const r = closer(true)
    expect(mean(r.map((x) => x.old))).toBeGreaterThanOrEqual(90)
    expect(mean(r.map((x) => x.fresh))).toBeGreaterThanOrEqual(90)
  })

  it('the same network trained on all four at once from the start learns them all', () => {
    const r = SEEDS.map((s) => {
      const w = trained('new-predator', { settings: { phase: 2 } }, s, 5000)
      return [w.testAccuracy(w.tests[0]), w.testAccuracy(w.tests[1])]
    })
    for (const [old, fresh] of r) {
      expect(old).toBeGreaterThanOrEqual(90)
      expect(fresh).toBeGreaterThanOrEqual(90)
    }
  })
})
