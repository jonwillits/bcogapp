import { it } from 'vitest'
import { makeRng } from '../../random'
import { planFor } from '../logs/block'
import { featureVector } from '../logs/features'
import { mean } from '../../bilaterian/measure'
import { FORAGERS, foragerTable, runForagerBlock, type ForagerId } from './foragers'
import { SEPARATIONS, SeparationStage, cosine, driftContext, freshContext, nightInput } from './store'
import { SlowLearner, YOUTH_PASSES, differentiation, newPatterns, oldPatterns, trainInterleaved } from './slow'
import { THINGS, ALL_THINGS, PROPERTIES } from './world'

/**
 * Every target of spec §9, measured over twenty seeds on synthetic nights
 * before any panel was drawn. These are the measurements that can come
 * back different from the spec and change the design rather than the code.
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
          const look = plan.blocks.find((b) => b.kind === 'look-alike')!
          const dist = plan.blocks.find((b) => b.kind === 'distinct')!
          const c = freshContext(rng)
          const c2 = driftContext(c, rng, drift)
          const a1 = stage.encode(nightInput(featureVector(look.nights[0]), c, scale))
          const a2 = stage.encode(nightInput(featureVector(look.nights[1]), c2, scale))
          const d1 = stage.encode(nightInput(featureVector(dist.nights[0]), c, scale))
          const d2 = stage.encode(nightInput(featureVector(dist.nights[1]), c2, scale))
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

it('measure: the four foragers on synthetic nights (§9.2)', () => {
  const rows: Record<ForagerId, { emptiedLast: number[][]; beetles: number[][]; smooth: number[][]; passed: number[]; confusionsAlike: number[]; confusionsDistinct: number[] }> = {} as never
  for (const f of FORAGERS) rows[f.id] = { emptiedLast: [[], [], []], beetles: [[], [], []], smooth: [[], [], []], passed: [], confusionsAlike: [], confusionsDistinct: [] }
  for (const seed of SEEDS) {
    const { plan, clearings } = planFor(seed)
    for (const f of FORAGERS) {
      for (const block of plan.blocks) {
        const b = runForagerBlock(f.id, seed, block, clearings[block.clearing])
        b.tallies.forEach((t, i) => {
          rows[f.id].emptiedLast[i].push(t.digsAtEmptiedLastNight)
          rows[f.id].beetles[i].push(t.beetles)
          rows[f.id].smooth[i].push(t.digsAtSmooth)
          if (t.passedOverRefilled !== null) rows[f.id].passed.push(t.passedOverRefilled)
        })
        const table = foragerTable(b)
        const share = table.couldBeConfused ? table.confusions / table.couldBeConfused : 0
        if (block.kind === 'look-alike') rows[f.id].confusionsAlike.push(share)
        else rows[f.id].confusionsDistinct.push(share)
      }
    }
  }
  for (const f of FORAGERS) {
    const r = rows[f.id]
    say(`${f.label}: digs at logs emptied last night ${r.emptiedLast.map((v) => f1(mean(v))).join(' / ')} (nights 1 / 2 / 3); beetles ${r.beetles.map((v) => f1(mean(v))).join(' / ')}; digs at smooth logs ${r.smooth.map((v) => f1(mean(v))).join(' / ')}; full logs passed over on night 3 ${f1(mean(r.passed))}; confusions share look-alike ${f2(mean(r.confusionsAlike))} distinct ${f2(mean(r.confusionsDistinct))}`)
  }
}, 600_000)

it('measure: the store at three settings on both blocks (§9.3)', () => {
  for (const sep of SEPARATIONS) {
    const alike: number[] = []
    const distinct: number[] = []
    const emptiedLast: number[] = []
    const passed: number[] = []
    for (const seed of SEEDS) {
      const { plan, clearings } = planFor(seed)
      for (const block of plan.blocks) {
        const b = runForagerBlock('tonight', seed, block, clearings[block.clearing], {}, sep)
        const t = foragerTable(b)
        const share = t.couldBeConfused ? t.confusions / t.couldBeConfused : 0
        ;(block.kind === 'look-alike' ? alike : distinct).push(share)
        emptiedLast.push(b.tallies[1].digsAtEmptiedLastNight + b.tallies[2].digsAtEmptiedLastNight)
        passed.push(b.tallies[2].passedOverRefilled ?? 0)
      }
    }
    say(`store, ${sep}: confusions share look-alike ${f2(mean(alike))}, distinct ${f2(mean(distinct))}; digs at logs emptied last night over nights 2 and 3 ${f2(mean(emptiedLast))}; full logs passed over on night 3 ${f2(mean(passed))}`)
  }
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
    for (const block of plan.blocks) {
      for (const [label, damage] of settings) {
        const b = runForagerBlock('tonight', seed, block, clearings[block.clearing], damage)
        rows[label].emptiedLast.push(b.tallies[1].digsAtEmptiedLastNight + b.tallies[2].digsAtEmptiedLastNight)
        rows[label].smooth.push(b.tallies.reduce((a, t) => a + t.digsAtSmooth, 0))
        rows[label].beetles.push(b.tallies.reduce((a, t) => a + t.beetles, 0))
      }
      const u = runForagerBlock('usual', seed, block, clearings[block.clearing])
      usual.emptiedLast.push(u.tallies[1].digsAtEmptiedLastNight + u.tallies[2].digsAtEmptiedLastNight)
    }
  }
  for (const [label] of settings) say(`Tonight too, ${label}: digs at logs emptied last night over nights 2 and 3 ${f2(mean(rows[label].emptiedLast))}; digs at smooth logs over the block ${f2(mean(rows[label].smooth))}; beetles over the block ${f1(mean(rows[label].beetles))}`)
  say(`Usual only: digs at logs emptied last night over nights 2 and 3 ${f2(mean(usual.emptiedLast))}`)
}, 600_000)
