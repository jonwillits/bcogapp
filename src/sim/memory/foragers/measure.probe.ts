import { it } from 'vitest'
import { makeRng } from '../../random'
import { planFor } from '../logs/week'
import { PAIR_KINDS } from '../logs/features'
import { featureVector } from '../logs/features'
import { mean } from '../../bilaterian/measure'
import { FORAGERS, foragerShares, runForagerWeek, type ForagerId } from './foragers'
import { SEPARATIONS, SeparationStage, cosine, driftContext, freshContext, nightInput } from './store'
import { SlowLearner, YOUTH_PASSES, differentiation, newPatterns, oldPatterns, trainInterleaved } from './slow'
import { THINGS, ALL_THINGS, PROPERTIES } from './world'

/**
 * Every target of spec §9, measured over twenty seeds on synthetic weeks
 * before any panel was drawn (re-measured 2026-10-27 for the week of six
 * nights). These are the measurements that can come back different from
 * the spec and change the design rather than the code.
 *
 *   PROBE=1 PROBE_DIR=src/sim/memory/foragers npx vitest run --disable-console-intercept -t "measure:"
 */
const SEEDS = Array.from({ length: 20 }, (_, i) => 1000 + i)
const say = (s: string) => console.log(`m10 measure · ${s}`)
const f1 = (v: number) => v.toFixed(1)
const f2 = (v: number) => v.toFixed(2)

it.skip('measure: the separation stage, a sweep of the context’s weight and drift', () => {
  const settings: [string, { units: number; share: number }][] = [['weak 8/0.5', { units: 8, share: 0.5 }], ['medium 40/0.25', { units: 40, share: 0.25 }], ['strong 240/0.05', { units: 240, share: 0.05 }], ['strong 480/0.03', { units: 480, share: 0.03 }]]
  for (const scale of [0.5, 1, 2]) {
    for (const drift of [0.9, 1.3]) {
      const line: string[] = []
      for (const [label, cfg] of settings) {
        const alike2: number[] = []
        const distinct2: number[] = []
        const ctx: number[] = []
        for (const seed of SEEDS) {
          const rng = makeRng(seed)
          const stage = new SeparationStage('weak', rng.fork(), cfg)
          const { plan } = planFor(seed)
          const c = freshContext(rng)
          const c2 = driftContext(c, rng, drift)
          const a1 = stage.encode(nightInput(featureVector(plan.letters.A), c, scale))
          const a2 = stage.encode(nightInput(featureVector(plan.letters.A), c2, scale))
          const d1 = stage.encode(nightInput(featureVector(plan.letters.A), c, scale))
          const d2 = stage.encode(nightInput(featureVector(plan.letters.B), c2, scale))
          alike2.push(cosine(a2, a1))
          distinct2.push(cosine(d2, d1))
          ctx.push(cosine(c, c2))
        }
        // The share the other night gets when the cue is night 2's own input: s⁴ / (1 + s⁴).
        const share = (sim: number) => Math.max(0, sim) ** 4 / (1 + Math.max(0, sim) ** 4)
        line.push(`${label}: alike ${f2(mean(alike2))} (other night’s share ${f2(share(mean(alike2)))}), distinct ${f2(mean(distinct2))} (${f2(share(mean(distinct2)))})`)
      }
      say(`context scale ${scale}, drift ${drift}: ${line.join(' · ')}`)
    }
  }
}, 600_000)

it('measure: the four foragers on synthetic weeks (§9.2)', () => {
  const rows: Record<ForagerId, { emptiedLast: number[][]; beetles: number[][]; smooth: number[]; passed: number[][]; alike: number[]; differ: number[]; alikeDig: number[]; differDig: number[] }> = {} as never
  for (const f of FORAGERS) rows[f.id] = { emptiedLast: Array.from({ length: 6 }, () => []), beetles: Array.from({ length: 6 }, () => []), smooth: [], passed: Array.from({ length: 6 }, () => []), alike: [], differ: [], alikeDig: [], differDig: [] }
  for (const seed of SEEDS) {
    const { plan, clearings } = planFor(seed)
    for (const f of FORAGERS) {
      const w = runForagerWeek(f.id, seed, plan, clearings.week)
      w.tallies.forEach((t, i) => {
        rows[f.id].emptiedLast[i].push(t.digsAtEmptiedLastNight)
        rows[f.id].beetles[i].push(t.beetles)
        if (t.passedOverRefilled !== null) rows[f.id].passed[i].push(t.passedOverRefilled)
      })
      rows[f.id].smooth.push(w.tallies.reduce((a, t) => a + t.digsAtSmooth, 0))
      const sh = foragerShares(w)
      const a = sh['after a look-alike pair']
      const d = sh['after a different pair']
      if (a.share !== null) rows[f.id].alike.push(a.share)
      if (d.share !== null) rows[f.id].differ.push(d.share)
      if (a.digShare !== null) rows[f.id].alikeDig.push(a.digShare)
      if (d.digShare !== null) rows[f.id].differDig.push(d.digShare)
    }
  }
  for (const f of FORAGERS) {
    const r = rows[f.id]
    say(`${f.label}: digs at logs emptied last night ${r.emptiedLast.map((v) => f1(mean(v))).join(' / ')} (nights 1 to 6); beetles ${r.beetles.map((v) => f1(mean(v))).join(' / ')} (week ${f1(mean(r.beetles.map((v) => mean(v))) * 6)}); digs at smooth logs over the week ${f1(mean(r.smooth))}; full logs passed close by, emptied two nights ago, nights 3 to 6 ${r.passed.slice(2).map((v) => f1(mean(v))).join(' / ')}; share of when-errors after look-alike pairs ${f2(mean(r.alike))} after different pairs ${f2(mean(r.differ))} (over digs alone ${f2(mean(r.alikeDig))} / ${f2(mean(r.differDig))})`)
  }
}, 600_000)

it('measure: the store at three settings over the week (§9.3)', () => {
  for (const sep of SEPARATIONS) {
    const by: Record<string, number[]> = { alike: [], differ: [], alikeDig: [], differDig: [], emptiedLast: [], passed: [], beetles: [] }
    const byNight: number[][] = Array.from({ length: 6 }, () => [])
    for (const seed of SEEDS) {
      const { plan, clearings } = planFor(seed)
      const w = runForagerWeek('tonight', seed, plan, clearings.week, {}, sep)
      const sh = foragerShares(w)
      const a = sh['after a look-alike pair']
      const d = sh['after a different pair']
      if (a.share !== null) by.alike.push(a.share)
      if (d.share !== null) by.differ.push(d.share)
      if (a.digShare !== null) by.alikeDig.push(a.digShare)
      if (d.digShare !== null) by.differDig.push(d.digShare)
      by.emptiedLast.push(w.tallies.slice(1).reduce((x, t) => x + t.digsAtEmptiedLastNight, 0))
      by.passed.push(w.tallies.slice(2).reduce((x, t) => x + (t.passedOverRefilled ?? 0), 0))
      by.beetles.push(w.tallies.reduce((x, t) => x + t.beetles, 0))
      w.when.forEach((s, i) => {
        if (s.decisions) byNight[i].push(s.errors / s.decisions)
      })
    }
    say(`store, ${sep}: share of when-errors after look-alike pairs ${f2(mean(by.alike))}, after different pairs ${f2(mean(by.differ))} (over digs alone ${f2(mean(by.alikeDig))} / ${f2(mean(by.differDig))}); by night 3 to 6 ${byNight.slice(2).map((v) => f2(mean(v))).join(' / ')}; digs at logs emptied last night over nights 2 to 6 ${f2(mean(by.emptiedLast))}; full logs passed close by, emptied two nights ago, over nights 3 to 6 ${f2(mean(by.passed))}; beetles over the week ${f1(mean(by.beetles))}`)
  }
  void PAIR_KINDS
}, 600_000)

it('measure: the slow learner’s youth, the new season, and damage (§9.4, §9.5)', () => {
  const firstTop: number[] = []
  const firstMiddle: number[] = []
  const firstPairs: number[] = []
  const orderHeld: boolean[] = []
  const youthRight: number[] = []
  const NOISES = [0, 0.25, 0.5, 0.75, 1, 1.5]
  const CRIT = 0.25
  const SNAPS = [5, 10, 20, 40, 80, 160, 320, 600]
  const snapTop: number[][] = SNAPS.map(() => [])
  const snapMiddle: number[][] = SNAPS.map(() => [])
  const snapPairs: number[][] = SNAPS.map(() => [])
  const kept: Record<string, number[][]> = { general: NOISES.map(() => []), middle: NOISES.map(() => []), specific: NOISES.map(() => []) }
  const smoothBeetles: number[][] = NOISES.map(() => [])
  const hawkNight: number[][] = NOISES.map(() => [])
  const hawkWings: number[][] = NOISES.map(() => [])
  const hawkMoves: number[][] = NOISES.map(() => [])
  const hasBeetles = PROPERTIES.findIndex((p) => p.name === 'beetles under it')
  const huntsNight = PROPERTIES.findIndex((p) => p.name === 'hunt at night')
  const wings = PROPERTIES.findIndex((p) => p.name === 'wings')
  const moves = PROPERTIES.findIndex((p) => p.name === 'something that moves')
  for (const seed of SEEDS) {
    const rng = makeRng(seed ^ 0x510)
    const net = new SlowLearner(rng.fork())
    const order = rng.fork()
    const old = oldPatterns()
    const trace: { pass: number; d: ReturnType<typeof differentiation> }[] = []
    trainInterleaved(net, old, YOUTH_PASSES, order, (pass) => {
      if (pass % 5 === 0) trace.push({ pass, d: differentiation(net) })
    })
    const first = (pick: (d: ReturnType<typeof differentiation>) => number, crit: number) => trace.find((t) => pick(t.d) >= crit)?.pass ?? Infinity
    const ft = first((d) => d.top, CRIT)
    const fm = first((d) => d.middle, CRIT)
    const fp = first((d) => d.pairs, CRIT)
    firstTop.push(ft)
    firstMiddle.push(fm)
    firstPairs.push(fp)
    orderHeld.push(ft <= fm && fm <= fp)
    for (const [i, at] of SNAPS.entries()) {
      const t = trace.find((x) => x.pass === at)!
      snapTop[i].push(t.d.top)
      snapMiddle[i].push(t.d.middle)
      snapPairs[i].push(t.d.pairs)
    }
    youthRight.push(net.proportionRight(THINGS))
    NOISES.forEach((noise, ni) => {
      net.damage = { noise }
      for (const level of ['general', 'middle', 'specific'] as const) kept[level][ni].push(net.kept(THINGS, level, 20))
      smoothBeetles[ni].push(net.says('smooth log', 'has', hasBeetles, 20))
      hawkNight[ni].push(net.says('hawk', 'does', huntsNight, 20))
      hawkWings[ni].push(net.says('hawk', 'has', wings, 20))
      hawkMoves[ni].push(net.says('hawk', 'is', moves, 20))
    })
    net.damage = { noise: 0 }
  }
  say(`youth: proportion of properties right after ${YOUTH_PASSES} passes ${f2(mean(youthRight))}; first pass at which each split exceeds ${CRIT}: stays-put against moves ${f1(mean(firstTop))}, wood against plants and air against ground ${f1(mean(firstMiddle))}, within pairs ${f1(mean(firstPairs))}; the order top ≤ middle ≤ pairs held in ${orderHeld.filter(Boolean).length} of ${SEEDS.length} seeds`)
  say(`youth: hidden-space distance across the top split / the middle splits / within pairs at passes ${SNAPS.join('/')}: ${SNAPS.map((_, i) => `${f2(mean(snapTop[i]))} ${f2(mean(snapMiddle[i]))} ${f2(mean(snapPairs[i]))}`).join(' | ')}`)
  for (const level of ['general', 'middle', 'specific'] as const) say(`damage, ${level} properties the things have, still said yes at noise ${NOISES.join('/')}: ${kept[level].map((v) => f2(mean(v))).join(' / ')}`)
  say(`damage: the smooth log’s "has beetles under it" at noise ${NOISES.join('/')}: ${smoothBeetles.map((v) => f2(mean(v))).join(' / ')}`)
  say(`damage: the hawk "hunts at night" (the owl’s) ${hawkNight.map((v) => f2(mean(v))).join(' / ')}; the hawk "has wings" ${hawkWings.map((v) => f2(mean(v))).join(' / ')}; the hawk "is something that moves" ${hawkMoves.map((v) => f2(mean(v))).join(' / ')}`)
}, 1_200_000)

it.skip('measure: the new season, replay off and on, over hidden sizes and lengths of training (§9.4)', () => {
  for (const hidden of [4, 6, 8]) {
    for (const passes of [300, 1000, 3000]) {
      const offOld: number[] = []
      const onOld: number[] = []
      const offNew: number[] = []
      const onNew: number[] = []
      const offSpecific: number[] = []
      const offGeneral: number[] = []
      for (const seed of SEEDS) {
        const rng = makeRng(seed ^ 0x510)
        const net = new SlowLearner(rng.fork(), hidden)
        trainInterleaved(net, oldPatterns(), YOUTH_PASSES, rng.fork())
        const season = newPatterns()
        const off = new SlowLearner(makeRng(1), hidden)
        off.copyFrom(net)
        trainInterleaved(off, season, passes, rng.fork())
        offOld.push(off.proportionRight(THINGS))
        offNew.push(off.proportionRight(ALL_THINGS.slice(8)))
        offSpecific.push(off.kept(THINGS, 'specific'))
        offGeneral.push(off.kept(THINGS, 'general'))
        const on = new SlowLearner(makeRng(1), hidden)
        on.copyFrom(net)
        const all = [...oldPatterns(), ...season]
        trainInterleaved(on, all, Math.max(1, Math.round((passes * season.length) / all.length)), rng.fork())
        onOld.push(on.proportionRight(THINGS))
        onNew.push(on.proportionRight(ALL_THINGS.slice(8)))
      }
      say(`new season, ${hidden} hidden, ${passes} passes of the new things: replay off → old right ${f2(mean(offOld))} (general kept ${f2(mean(offGeneral))}, specific kept ${f2(mean(offSpecific))}), new right ${f2(mean(offNew))}; replay on (the same number of presentations, interleaved) → old right ${f2(mean(onOld))}, new right ${f2(mean(onNew))}`)
    }
  }
}, 1_800_000)

it('measure: the two kinds of damage on Tonight too (§9.5)', () => {
  const rows: Record<string, { emptiedLast: number[]; smooth: number[]; beetles: number[] }> = {}
  const settings: [string, { noStore?: boolean; slowNoise?: number }][] = [['intact', {}], ['no store', { noStore: true }], ['slow learner noise 0.5', { slowNoise: 0.5 }], ['slow learner noise 1', { slowNoise: 1 }], ['slow learner noise 1.5', { slowNoise: 1.5 }]]
  for (const [label] of settings) rows[label] = { emptiedLast: [], smooth: [], beetles: [] }
  const usual = { emptiedLast: [] as number[] }
  for (const seed of SEEDS) {
    const { plan, clearings } = planFor(seed)
    for (const [label, damage] of settings) {
      const w = runForagerWeek('tonight', seed, plan, clearings.week, damage)
      rows[label].emptiedLast.push(w.tallies.slice(1).reduce((a, t) => a + t.digsAtEmptiedLastNight, 0))
      rows[label].smooth.push(w.tallies.reduce((a, t) => a + t.digsAtSmooth, 0))
      rows[label].beetles.push(w.tallies.reduce((a, t) => a + t.beetles, 0))
    }
    const u = runForagerWeek('usual', seed, plan, clearings.week)
    usual.emptiedLast.push(u.tallies.slice(1).reduce((a, t) => a + t.digsAtEmptiedLastNight, 0))
  }
  for (const [label] of settings) say(`Tonight too, ${label}: digs at logs emptied last night over nights 2 to 6 ${f2(mean(rows[label].emptiedLast))}; digs at smooth logs over the week ${f2(mean(rows[label].smooth))}; beetles over the week ${f1(mean(rows[label].beetles))}`)
  say(`Usual only: digs at logs emptied last night over nights 2 to 6 ${f2(mean(usual.emptiedLast))}`)
}, 600_000)
