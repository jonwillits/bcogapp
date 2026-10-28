import { describe, it, expect } from 'vitest'
import { makeRng } from '../../random'
import { planFor } from '../logs/week'
import { featureVector } from '../logs/features'
import { mean } from '../../bilaterian/measure'
import { FORAGERS, HAS_BEETLES, foragerShares, runForagerWeek, trainedSlowLearner, type ForagerId } from './foragers'
import { SEPARATIONS, SeparationStage, FastStore, cosine, driftContext, freshContext, nightInput, CONTEXT_DIMS } from './store'
import { SlowLearner, SEASON_PASSES, differentiation, newPatterns, oldPatterns, trainInterleaved } from './slow'
import { THINGS, ALL_THINGS, PROPERTIES, RELATIONS, targetsFor, GROUPS } from './world'
import { TendencyUnit } from './tendency'

/**
 * The targets of spec §9.2 to §9.5, over twenty seeds on synthetic weeks
 * (each forager running the plan's six nights for the seed, in the week's
 * clearing). The bands are the measured values of `measure.probe.ts`
 * (2026-10-27, the week; last re-measured 2026-10-28 on the spread clearing at a scripted pace of 1.0 m/s), recorded in the as-built notes §4.2 and §4.3;
 * where a target came out different from the spec, the test holds what is
 * true and the notes say so.
 */
const SEEDS = Array.from({ length: 20 }, (_, i) => 1000 + i)

function sums() {
  const out: Record<ForagerId, { emptiedLast2: number[]; emptiedLater: number[]; beetles: number[]; smooth: number[]; alike: number[]; differ: number[] }> = {} as never
  for (const f of FORAGERS) out[f.id] = { emptiedLast2: [], emptiedLater: [], beetles: [], smooth: [], alike: [], differ: [] }
  for (const seed of SEEDS) {
    const { plan, clearing } = planFor(seed)
    for (const f of FORAGERS) {
      const w = runForagerWeek(f.id, seed, plan, clearing)
      out[f.id].emptiedLast2.push(w.tallies[1].digsAtEmptiedLastNight)
      out[f.id].emptiedLater.push(mean(w.tallies.slice(2).map((t) => t.digsAtEmptiedLastNight)))
      out[f.id].beetles.push(w.tallies.reduce((a, t) => a + t.beetles, 0))
      out[f.id].smooth.push(w.tallies.reduce((a, t) => a + t.digsAtSmooth, 0))
      const sh = foragerShares(w)
      if (sh['after a look-alike pair'].share !== null) out[f.id].alike.push(sh['after a look-alike pair'].share!)
      if (sh['after a different pair'].share !== null) out[f.id].differ.push(sh['after a different pair'].share!)
    }
  }
  return out
}

describe('the four foragers on synthetic weeks (§9.2), twenty seeds', () => {
  const r = sums()
  it('Tendency only digs at logs emptied last night more than Usual only does, on night 2 and on the later nights, because the logs that just paid off pull it back', () => {
    expect(mean(r.tendency.emptiedLast2)).toBeGreaterThan(mean(r.usual.emptiedLast2))
    expect(mean(r.tendency.emptiedLater)).toBeGreaterThan(mean(r.usual.emptiedLater))
  })
  it('Tonight too digs at them least, and takes the most beetles over the week', () => {
    for (const id of ['usual', 'tendency', 'blurred'] as ForagerId[]) {
      expect(mean(r.tonight.emptiedLast2) + mean(r.tonight.emptiedLater)).toBeLessThan(mean(r[id].emptiedLast2) + mean(r[id].emptiedLater))
      expect(mean(r.tonight.beetles)).toBeGreaterThanOrEqual(mean(r[id].beetles))
    }
    // Measured 2026-10-28, the spread clearing: Tonight too 18.2 beetles a week, blurred 16.1, Usual only 13.9, Tendency only 9.3.
    expect(mean(r.tonight.beetles)).toBeGreaterThan(17)
  })
  it('Tonight too, nights blurred has a larger share of when-errors after a look-alike pair than after a different pair, and a larger one than Tonight too', () => {
    // Measured 2026-10-28, the spread clearing: 0.41 against 0.27; Tonight too 0.15 against 0.04.
    expect(mean(r.blurred.alike)).toBeGreaterThan(mean(r.blurred.differ) + 0.04)
    expect(mean(r.blurred.alike)).toBeGreaterThan(mean(r.tonight.alike) + 0.1)
  })
  it('the foragers with no store sit near the no-memory share after both kinds of pair, and Tendency only, pulled back to what paid off, is worst of all', () => {
    // Measured 2026-10-28, the spread clearing: Usual only 0.46 / 0.47; Tendency only 0.92 / 0.91.
    expect(Math.abs(mean(r.usual.alike) - mean(r.usual.differ))).toBeLessThan(0.12)
    expect(mean(r.tendency.alike)).toBeGreaterThan(mean(r.usual.alike))
    expect(mean(r.tendency.differ)).toBeGreaterThan(mean(r.usual.differ))
  })
  it('Tendency only digs at smooth logs, since nothing tells it the kinds; the others, with the slow learner intact, never do', () => {
    expect(mean(r.tendency.smooth)).toBeGreaterThan(1)
    for (const id of ['usual', 'tonight', 'blurred'] as ForagerId[]) expect(mean(r[id].smooth)).toBe(0)
  })
  it('the same seed reproduces every forager’s week exactly', () => {
    const { plan, clearing } = planFor(1003)
    const once = JSON.stringify(runForagerWeek('blurred', 1003, plan, clearing).run.records)
    expect(JSON.stringify(runForagerWeek('blurred', 1003, plan, clearing).run.records)).toBe(once)
  })
})

describe('the store at three settings over the week (§9.3), twenty seeds', () => {
  const share: Record<string, { alike: number[]; differ: number[]; emptiedLast: number[] }> = {}
  for (const sep of SEPARATIONS) {
    share[sep] = { alike: [], differ: [], emptiedLast: [] }
    for (const seed of SEEDS) {
      const { plan, clearing } = planFor(seed)
      const w = runForagerWeek('tonight', seed, plan, clearing, {}, sep)
      const sh = foragerShares(w)
      if (sh['after a look-alike pair'].share !== null) share[sep].alike.push(sh['after a look-alike pair'].share!)
      if (sh['after a different pair'].share !== null) share[sep].differ.push(sh['after a different pair'].share!)
      share[sep].emptiedLast.push(w.tallies.slice(1).reduce((a, t) => a + t.digsAtEmptiedLastNight, 0))
    }
  }
  it('the share of when-errors falls as separation rises, after both kinds of pair (measured 0.31 / 0.28 / 0.15 after look-alike pairs, 0.26 / 0.09 / 0.04 after different pairs, on the spread clearing)', () => {
    expect(mean(share.weak.alike)).toBeGreaterThan(mean(share.medium.alike))
    expect(mean(share.medium.alike)).toBeGreaterThan(mean(share.strong.alike))
    expect(mean(share.weak.differ)).toBeGreaterThan(mean(share.medium.differ))
    expect(mean(share.medium.differ)).toBeGreaterThanOrEqual(mean(share.strong.differ) - 0.02)
  })
  it('and is lower after different pairs at every setting; by the medium setting the nights after different pairs are nearly clean while those after look-alike pairs are not', () => {
    for (const sep of SEPARATIONS) expect(mean(share[sep].alike), sep).toBeGreaterThan(mean(share[sep].differ))
    expect(mean(share.medium.differ)).toBeLessThan(0.12)
    expect(mean(share.medium.alike)).toBeGreaterThan(0.15)
  })
  it('digs at logs emptied last night fall with separation too', () => {
    expect(mean(share.weak.emptiedLast)).toBeGreaterThan(mean(share.medium.emptiedLast))
    expect(mean(share.medium.emptiedLast)).toBeGreaterThan(mean(share.strong.emptiedLast))
  })
  it('the codes: the stronger the separation, the less a night’s code resembles the night before it, and two nights with different letters resemble each other less than two with the same letter at every setting', () => {
    const sims: Record<string, { alike: number[]; distinct: number[] }> = {}
    for (const sep of SEPARATIONS) {
      sims[sep] = { alike: [], distinct: [] }
      for (const seed of SEEDS) {
        const rng = makeRng(seed)
        const stage = new SeparationStage(sep, rng.fork())
        const { plan } = planFor(seed)
        const c = freshContext(rng)
        const c2 = driftContext(c, rng)
        sims[sep].alike.push(cosine(stage.encode(nightInput(featureVector(plan.letters.A), c)), stage.encode(nightInput(featureVector(plan.letters.A), c2))))
        sims[sep].distinct.push(cosine(stage.encode(nightInput(featureVector(plan.letters.A), c)), stage.encode(nightInput(featureVector(plan.letters.B), c2))))
      }
      expect(mean(sims[sep].alike)).toBeGreaterThan(mean(sims[sep].distinct))
    }
    expect(mean(sims.weak.alike)).toBeGreaterThan(mean(sims.medium.alike))
    expect(mean(sims.medium.alike)).toBeGreaterThan(mean(sims.strong.alike))
  })
  it('retrieval by content: a stored night contributes in proportion to its code’s similarity to the cue, and the contributions sum to one; the context drifts and keeps its length', () => {
    const rng = makeRng(5)
    const store = new FastStore(new SeparationStage('medium', rng.fork()))
    const c1 = freshContext(rng)
    const c2 = driftContext(c1, rng)
    expect(Math.hypot(...c2)).toBeCloseTo(1, 9)
    expect(c2.length).toBe(CONTEXT_DIMS)
    const { plan } = planFor(5)
    const x1 = nightInput(featureVector(plan.nights[0]), c1)
    const x2 = nightInput(featureVector(plan.nights[1]), c2)
    store.store(x1, [1, 0, 0], 'night 1')
    store.store(x2, [0, 1, 0], 'night 2')
    const r = store.retrieve(x2)
    expect(r.contributions[0] + r.contributions[1]).toBeCloseTo(1, 9)
    expect(r.contributions[1]).toBeGreaterThan(r.contributions[0])
    expect(r.blended[1]).toBe(r.contributions[1])
    expect(r.blended[2]).toBe(0)
    expect(store.similarity()[0][1]).toBeCloseTo(store.similarity()[1][0], 12)
    expect(store.similarity()[0][0]).toBeCloseTo(1, 9)
  })
})

describe('the slow learner (§9.4): its youth', () => {
  it('after the youth every property of the old world is right, in every seed', () => {
    for (const seed of SEEDS.slice(0, 6)) expect(trainedSlowLearner(seed).proportionRight(THINGS), `seed ${seed}`).toBeGreaterThan(0.99)
  })
  it('progressive differentiation: things that stay put separate from things that move first, then wood from plants and air from ground, then the individuals, at every snapshot of the youth, in most seeds', () => {
    let held = 0
    const snaps = [5, 10, 20, 40]
    for (const seed of SEEDS) {
      const rng = makeRng(seed ^ 0x510)
      const net = new SlowLearner(rng.fork())
      let ok = true
      trainInterleaved(net, oldPatterns(), 40, rng.fork(), (pass) => {
        if (!snaps.includes(pass)) return
        const d = differentiation(net)
        if (!(d.top > d.middle && d.middle > d.pairs)) ok = false
      })
      if (ok) held++
    }
    expect(held).toBeGreaterThanOrEqual(15)
  })
  it('the world: eight things in two groups of two pairs, two new things, three relations, and properties at three levels', () => {
    expect(THINGS.length).toBe(8)
    expect(ALL_THINGS.length).toBe(10)
    expect(RELATIONS).toEqual(['is', 'has', 'does'])
    for (const level of ['general', 'middle', 'specific'] as const) expect(PROPERTIES.some((p) => p.level === level)).toBe(true)
    expect(GROUPS.stays.length + GROUPS.moves.length).toBe(8)
    expect(targetsFor('loose-bark log', 'has')[HAS_BEETLES]).toBe(1)
    expect(targetsFor('smooth log', 'has')[HAS_BEETLES]).toBe(0)
    // Every general property is shared by at least four things, every specific one by at most two.
    for (const p of PROPERTIES) {
      if (p.level === 'general') expect(p.things.length, p.name).toBeGreaterThanOrEqual(4)
      if (p.level === 'specific') expect(p.things.length, p.name).toBeLessThanOrEqual(2)
    }
  })
})

describe('the slow learner: the new season, replay off and on (§9.4), six seeds', () => {
  const offSpecific: number[] = []
  const offOld: number[] = []
  const onOld: number[] = []
  const onNew: number[] = []
  const offNew: number[] = []
  for (const seed of SEEDS.slice(0, 6)) {
    const rng = makeRng(seed ^ 0x510)
    const base = trainedSlowLearner(seed)
    const season = newPatterns()
    const off = new SlowLearner(makeRng(1))
    off.copyFrom(base)
    trainInterleaved(off, season, SEASON_PASSES, rng.fork())
    offSpecific.push(off.kept(THINGS, 'specific'))
    offOld.push(off.kept(THINGS, 'general'))
    offNew.push(off.proportionRight(ALL_THINGS.slice(8)))
    const on = new SlowLearner(makeRng(1))
    on.copyFrom(base)
    const all = [...oldPatterns(), ...season]
    trainInterleaved(on, all, Math.round((SEASON_PASSES * season.length) / all.length), rng.fork())
    onOld.push(on.proportionRight(THINGS))
    onNew.push(on.proportionRight(ALL_THINGS.slice(8)))
  }
  it('with replay off, the old things’ specific properties fall well below their starting level while the new things are learned', () => {
    expect(mean(offSpecific)).toBeLessThan(0.7)
    expect(mean(offNew)).toBeGreaterThan(0.95)
  })
  it('with replay on, old and new are both right', () => {
    expect(mean(onOld)).toBeGreaterThan(0.97)
    expect(mean(onNew)).toBeGreaterThan(0.95)
  })
  it('the general properties survive even with replay off: the loss is from the specific end', () => {
    expect(mean(offOld)).toBeGreaterThan(mean(offSpecific))
  })
})

describe('damage to the slow learner (§9.5), six seeds', () => {
  it('as noise on the hidden units grows, specific properties are lost before general ones', () => {
    const kept = { general: [] as number[], middle: [] as number[], specific: [] as number[] }
    for (const seed of SEEDS.slice(0, 6)) {
      const net = trainedSlowLearner(seed)
      net.damage = { noise: 0.5 }
      for (const level of ['general', 'middle', 'specific'] as const) kept[level].push(net.kept(THINGS, level, 20))
      net.damage = { noise: 0 }
    }
    expect(mean(kept.specific)).toBeLessThan(mean(kept.middle))
    expect(mean(kept.middle)).toBeLessThan(mean(kept.general))
  })
  it('damage is applied only when the network is read, never when it learns, and reading twice with no damage gives the same answer', () => {
    const net = trainedSlowLearner(1000)
    const a = net.table(THINGS)
    net.damage = { noise: 1 }
    const b = net.table(THINGS)
    net.damage = { noise: 0 }
    const c = net.table(THINGS)
    expect(JSON.stringify(a)).toBe(JSON.stringify(c))
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b))
  })
})

describe('the two kinds of damage on Tonight too (§9.5), twenty seeds', () => {
  const rows: Record<string, { emptiedLast: number[]; smooth: number[] }> = { intact: { emptiedLast: [], smooth: [] }, noStore: { emptiedLast: [], smooth: [] }, noisy: { emptiedLast: [], smooth: [] }, usual: { emptiedLast: [], smooth: [] } }
  for (const seed of SEEDS) {
    const { plan, clearing } = planFor(seed)
    const c = clearing
    const add = (k: string, w: ReturnType<typeof runForagerWeek>) => {
      rows[k].emptiedLast.push(w.tallies.slice(1).reduce((a, t) => a + t.digsAtEmptiedLastNight, 0))
      rows[k].smooth.push(w.tallies.reduce((a, t) => a + t.digsAtSmooth, 0))
    }
    add('intact', runForagerWeek('tonight', seed, plan, c))
    add('noStore', runForagerWeek('tonight', seed, plan, c, { noStore: true }))
    add('noisy', runForagerWeek('tonight', seed, plan, c, { slowNoise: 1 }))
    add('usual', runForagerWeek('usual', seed, plan, c))
  }
  it('remove the fast store: digs at logs emptied last night over the week rise to Usual only’s level (measured 5.2 against 5.5 on the spread clearing), and digs at smooth logs stay at zero', () => {
    expect(mean(rows.noStore.emptiedLast)).toBeGreaterThan(4)
    expect(Math.abs(mean(rows.noStore.emptiedLast) - mean(rows.usual.emptiedLast))).toBeLessThan(1.5)
    expect(mean(rows.noStore.smooth)).toBe(0)
  })
  it('damage the slow learner: the forager starts digging at smooth logs (measured 5.0 a week at noise 1 on the spread clearing), and its digs at logs emptied last night stay low (0.2)', () => {
    expect(mean(rows.noisy.smooth)).toBeGreaterThan(3)
    expect(mean(rows.noisy.emptiedLast)).toBeLessThan(0.8)
    expect(mean(rows.intact.smooth)).toBe(0)
  })
  it('each lesion raises one error and not the other: a double dissociation', () => {
    expect(mean(rows.noStore.emptiedLast)).toBeGreaterThan(mean(rows.noisy.emptiedLast) + 3)
    expect(mean(rows.noisy.smooth)).toBeGreaterThan(mean(rows.noStore.smooth) + 3)
  })
})

describe('the tendency unit (§12, item 3)', () => {
  it('learns by Δbᵢ = η · xᵢ · Φ on the Prediction setting: a find raises the dug log’s weight and nothing else; a miss lowers it', () => {
    const t = new TendencyUnit(10)
    t.begin(3)
    const p = t.held
    expect(p).toBeCloseTo(0.5, 9)
    t.outcome(1)
    expect(t.unit.weights[3]).toBeCloseTo(0.5 * (1 - p), 9)
    expect(t.unit.weights.filter((w) => w !== 0).length).toBe(1)
    t.begin(3)
    t.outcome(0)
    expect(t.unit.weights[3]).toBeLessThan(0.5 * (1 - p))
    expect(t.phi).toBeLessThan(0)
  })
  it('its state is a fixed number of numbers, however many nights it runs', () => {
    const t = new TendencyUnit(10)
    const keys = Object.keys(t).sort()
    const shape = () => JSON.stringify([Object.keys(t).sort(), t.x.length, t.unit.weights.length, typeof t.held, typeof t.phi])
    const before = shape()
    for (let k = 0; k < 5000; k++) {
      t.begin(k % 10)
      t.outcome(k % 3 === 0 ? 1 : 0)
    }
    expect(Object.keys(t).sort()).toEqual(keys)
    expect(shape()).toBe(before)
  })
})


