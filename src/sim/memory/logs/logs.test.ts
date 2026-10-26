import { describe, it, expect } from 'vitest'
import { makeRng } from '../../random'
import { CLEARING, CLEARING_NESTS, makeClearings, type Clearing } from './clearings'
import { afterNight, freshBlock, fullOnNight, isFull, truthOf, KIND_RULE, REFILL_RULE } from './refill'
import { planPart4, sameFeatures, sharedFeatures, featureVector, FEATURE_DIMS, GROUNDS } from './features'
import { NightSim, NIGHT_S, DIG_S, EAT_S, NURSE_S, tallies } from './night'
import { nearest, runScripted, type Policy } from './scripted'
import { answersForNight, confusionTable, truths } from './mapQuestion'
import { planFor, runBlockScripted, startNight, newBlockRun, finishNight } from './block'
import { NEAR_LANDMARKS, footprint } from '../../rodent/range'
import { mean } from '../../bilaterian/measure'

const SEEDS20 = Array.from({ length: 20 }, (_, i) => 1000 + i)

describe('the refill rule (§8.1, §8.3), over every sequence of empties across three nights', () => {
  it('a log emptied on night n is empty on n + 1 and full on n + 2; never emptied, it is full; smooth logs never have beetles', () => {
    for (let pattern = 0; pattern < 8; pattern++) {
      let last = freshBlock(2)
      const kinds = ['loose', 'smooth'] as const
      for (let night = 1; night <= 3; night++) {
        const full = fullOnNight(kinds, last, night)
        expect(full[1]).toBe(false)
        // The loose log is full unless emptied on the night before.
        expect(full[0]).toBe(last[0] !== night - 1)
        const wantsDig = (pattern >> (night - 1)) & 1
        const emptied = [wantsDig === 1 && full[0], false]
        last = afterNight(last, emptied, night)
      }
    }
    expect(isFull('loose', null, 3)).toBe(true)
    expect(isFull('loose', 1, 2)).toBe(false)
    expect(isFull('loose', 1, 3)).toBe(true)
    expect(isFull('smooth', null, 1)).toBe(false)
  })
  it('the truths for the map question follow the state', () => {
    expect(truthOf(null, 2)).toBe('never')
    expect(truthOf(2, 2)).toBe('tonight')
    expect(truthOf(1, 2)).toBe('last night')
    expect(truthOf(1, 3)).toBe('two nights ago')
    expect(answersForNight(1)).toEqual(['tonight', 'never'])
    expect(answersForNight(2)).toEqual(['tonight', 'last night', 'never'])
    expect(answersForNight(3)).toEqual(['tonight', 'last night', 'two nights ago', 'never'])
  })
  it('the two rules are stated in the words the spec gives', () => {
    expect(KIND_RULE).toMatch(/loose bark have beetles/)
    expect(REFILL_RULE).toBe('After you empty a log, it is still empty the next night. The night after that, it has beetles again.')
  })
})

describe('the clearings (§8.2)', () => {
  const pairwise = (c: Clearing) => {
    const out: number[] = []
    for (let i = 0; i < c.logs.length; i++) for (let j = i + 1; j < c.logs.length; j++) out.push(Math.hypot(c.logs[i].x - c.logs[j].x, c.logs[i].y - c.logs[j].y))
    return out
  }
  it('each has ten logs, seven loose and three smooth, a few meters from its nest and at least 3 m apart, with three or four landmarks', () => {
    for (const seed of SEEDS20) {
      const cs = makeClearings(seed)
      for (const c of Object.values(cs)) {
        expect(c.logs.length).toBe(10)
        expect(c.logs.filter((l) => l.kind === 'loose').length).toBe(7)
        for (const l of c.logs) {
          const r = Math.hypot(l.x - c.nest.x, l.y - c.nest.y)
          expect(r).toBeGreaterThanOrEqual(CLEARING.minRadius - 1e-9)
          expect(r).toBeLessThanOrEqual(CLEARING.maxRadius + 1e-9)
        }
        for (const d of pairwise(c)) expect(d).toBeGreaterThanOrEqual(CLEARING.logSpacing - 1e-9)
        if (c.id !== 'practice') expect(c.landmarks.length).toBeGreaterThanOrEqual(3)
      }
    }
  })
  it('A, B and the reserve share one geometry, turned or mirrored: the same distances between logs and the same kinds', () => {
    const cs = makeClearings(7)
    const a = pairwise(cs.A)
    for (const other of [cs.B, cs.reserve]) {
      const o = pairwise(other)
      for (let i = 0; i < a.length; i++) expect(o[i]).toBeCloseTo(a[i], 6)
      expect(other.logs.map((l) => l.kind)).toEqual(cs.A.logs.map((l) => l.kind))
    }
  })
  it('the clearings are out of sight of one another: nests more than 20 m apart', () => {
    const ids = Object.keys(CLEARING_NESTS) as (keyof typeof CLEARING_NESTS)[]
    for (const a of ids) for (const b of ids) if (a !== b) expect(Math.hypot(CLEARING_NESTS[a].x - CLEARING_NESTS[b].x, CLEARING_NESTS[a].y - CLEARING_NESTS[b].y)).toBeGreaterThan(20)
  })
  it('the practice clearing’s logs keep clear of Lab 9’s landmarks', () => {
    for (const seed of SEEDS20.slice(0, 5)) {
      const p = makeClearings(seed).practice
      for (const l of p.logs) for (const lm of NEAR_LANDMARKS) {
        const f = footprint(lm)
        expect(Math.hypot(l.x - f.ax, l.y - f.ay)).toBeGreaterThan(f.r + 0.9)
      }
    }
  })
  it('the same seed gives the same clearings', () => {
    expect(JSON.stringify(makeClearings(42))).toBe(JSON.stringify(makeClearings(42)))
    expect(JSON.stringify(makeClearings(42))).not.toBe(JSON.stringify(makeClearings(43)))
  })
})

describe('the night features (§8.4, §8.5)', () => {
  it('the look-alike block’s three nights are identical; the distinct block’s differ from one another on every feature, and each shares at most one value with the look-alike nights, never the thing on the ground; over 100 seeds', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const plan = planPart4(seed)
      const look = plan.blocks.find((b) => b.kind === 'look-alike')!
      const dist = plan.blocks.find((b) => b.kind === 'distinct')!
      expect(sameFeatures(look.nights[0], look.nights[1])).toBe(true)
      expect(sameFeatures(look.nights[1], look.nights[2])).toBe(true)
      for (let i = 0; i < 3; i++) {
        for (let j = i + 1; j < 3; j++) expect(sharedFeatures(dist.nights[i], dist.nights[j])).toBe(0)
        expect(sharedFeatures(dist.nights[i], look.nights[0])).toBeLessThanOrEqual(1)
        expect(dist.nights[i].ground).not.toBe(look.nights[0].ground)
      }
      expect(look.clearing).not.toBe(dist.clearing)
      expect(['A', 'B']).toContain(look.clearing)
      expect(['A', 'B']).toContain(dist.clearing)
    }
  })
  it('which block comes first is the seed’s: both orders occur', () => {
    const firsts = new Set(Array.from({ length: 40 }, (_, i) => planPart4(i).blocks[0].kind))
    expect(firsts.size).toBe(2)
  })
  it('the feature vector is one-hot in four groups', () => {
    const v = featureVector({ moon: 'half moon', weather: 'fog', ground: GROUNDS[3], sound: 'frogs' })
    expect(v.length).toBe(FEATURE_DIMS)
    expect(v.reduce((a, b) => a + b, 0)).toBe(4)
  })
})

describe('a night (§8.3)', () => {
  const sim = (seed = 1) => {
    const { plan, clearings } = planFor(seed)
    const run = newBlockRun(plan.blocks[0], clearings[plan.blocks[0].clearing])
    return { run, sim: startNight(run, seed) }
  }
  it('starts in the nest with every loose-bark log full, lasts NIGHT_S, calls the young halfway, and returns the forager to the nest at dawn', () => {
    const { sim: s } = sim()
    expect(s.atNest).toBe(true)
    expect(s.record.fullAtStart.filter(Boolean).length).toBe(7)
    s.runStill()
    expect(s.done).toBe(true)
    expect(s.time).toBeGreaterThanOrEqual(NIGHT_S)
    expect(s.called).toBe(true)
    expect(s.record.calledAt).toBeCloseTo(NIGHT_S / 2, 6)
    expect(s.atNest).toBe(true)
    // Standing in the nest when the call comes, it nursed.
    expect(s.nursed).toBe(true)
    expect(s.record.digs.length).toBe(0)
  })
  it('a dig takes DIG_S, a meal EAT_S more, and the outcome is beetles at a full loose-bark log, nothing at an empty or smooth one', () => {
    const { sim: s } = sim(3)
    const loose = s.clearing.logs.find((l) => l.kind === 'loose')!
    const smooth = s.clearing.logs.find((l) => l.kind === 'smooth')!
    s.place(loose.x + 0.6, loose.y, 0)
    expect(s.canDigAt?.id).toBe(loose.id)
    s.step(0.05, { forward: 0, turn: 0, dig: true })
    expect(s.phase).toBe('digging')
    for (let k = 0; k < Math.round(DIG_S / 0.05) + 1; k++) s.step(0.05, { forward: 0, turn: 0 })
    expect(s.phase).toBe('eating')
    expect(s.record.digs[0].outcome).toBe('beetles')
    for (let k = 0; k < Math.round(EAT_S / 0.05) + 1; k++) s.step(0.05, { forward: 0, turn: 0 })
    expect(s.phase).toBe('foraging')
    s.step(0.05, { forward: 0, turn: 0, dig: true })
    for (let k = 0; k < Math.round(DIG_S / 0.05) + 1; k++) s.step(0.05, { forward: 0, turn: 0 })
    expect(s.record.digs[1].outcome).toBe('empty')
    expect(s.record.digs[1].repeat).toBe(true)
    s.place(smooth.x + 0.6, smooth.y, 0)
    s.step(0.05, { forward: 0, turn: 0, dig: true })
    for (let k = 0; k < Math.round(DIG_S / 0.05) + 1; k++) s.step(0.05, { forward: 0, turn: 0 })
    expect(s.record.digs[2].outcome).toBe('smooth')
    expect(s.record.beetles).toBe(1)
    const t = tallies(s.record)
    expect(t.digsAtFull).toBe(1)
    expect(t.repeatsBeforeCall).toBe(1)
    expect(t.digsAtSmooth).toBe(1)
  })
  it('after the call, digging is disabled until the forager has returned and nursed, which takes NURSE_S', () => {
    const { sim: s } = sim(5)
    const loose = s.clearing.logs.find((l) => l.kind === 'loose')!
    s.place(loose.x + 0.6, loose.y, 0)
    while (!s.called) s.step(0.05, { forward: 0, turn: 0 })
    expect(s.phase).toBe('called')
    expect(s.canDigAt).toBeNull()
    s.step(0.05, { forward: 0, turn: 0, dig: true })
    expect(s.record.digs.length).toBe(0)
    s.place(s.clearing.nest.x, s.clearing.nest.y, 0)
    s.step(0.05, { forward: 0, turn: 0 })
    expect(s.phase).toBe('nursing')
    const t0 = s.time
    while (s.phase === 'nursing') s.step(0.05, { forward: 0, turn: 0 })
    expect(s.time - t0).toBeCloseTo(NURSE_S, 1)
    expect(s.nursed).toBe(true)
    expect(s.phase).toBe('foraging')
  })
  it('the same seed and the same commands reproduce a night exactly, and nothing in the directory reaches for Math.random', async () => {
    const run = () => {
      const { sim: s } = sim(9)
      for (let k = 0; k < 400; k++) s.step(0.05, { forward: 1, turn: k % 50 < 10 ? 1 : 0, dig: k % 37 === 0 })
      return JSON.stringify([s.body.pose, s.record.digs, s.time])
    }
    expect(run()).toBe(run())
    const files = import.meta.glob('./*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
    for (const [p, src] of Object.entries(files)) expect(src, p).not.toMatch(/Math\.random|Date\.now/)
  })
})

describe('the scripted foragers and the night’s length (§14, targets)', () => {
  function perfect(): Policy {
    const known = new Map<number, number | null>()
    return {
      next(s) {
        return nearest(s, s.clearing.logs.filter((l) => l.kind === 'loose' && (known.get(l.id) ?? null) !== s.night - 1 && s.dugTonight[l.id] === 0))
      },
      outcome(log, outcome, s) {
        if (outcome === 'beetles') known.set(log.id, s.night)
      },
    }
  }
  function usualOnly(seed: number): Policy {
    const rng = makeRng(seed ^ 0x77)
    return {
      next(s) {
        const c = s.clearing.logs.filter((l) => l.kind === 'loose' && s.dugTonight[l.id] === 0)
        return c.length ? c[rng.int(c.length)] : null
      },
    }
  }
  it('a scripted perfect rememberer empties about four of the seven loose-bark logs on nights 1 and 3 (and what is left on night 2), over 20 seeds', () => {
    const per: number[][] = [[], [], []]
    for (const seed of SEEDS20) {
      const { plan, clearings } = planFor(seed)
      for (const b of plan.blocks) runBlockScripted(b, clearings[b.clearing], seed, perfect()).records.forEach((r, i) => per[i].push(tallies(r).digsAtFull))
    }
    expect(mean(per[0])).toBeGreaterThan(3.5)
    expect(mean(per[0])).toBeLessThan(4.5)
    expect(mean(per[2])).toBeGreaterThan(3.5)
    expect(mean(per[2])).toBeLessThan(4.5)
    // Night 2 has only what night 1 left: 7 minus about four.
    expect(mean(per[1])).toBeGreaterThan(2.3)
    expect(mean(per[1])).toBeLessThan(3.5)
  })
  it('a scripted forager that knows only the usual fact digs at about two logs emptied the night before on night 2, and about one on night 3, over 20 seeds', () => {
    const per: number[][] = [[], [], []]
    for (const seed of SEEDS20) {
      const { plan, clearings } = planFor(seed)
      for (const b of plan.blocks) runBlockScripted(b, clearings[b.clearing], seed, usualOnly(seed)).records.forEach((r, i) => per[i].push(tallies(r).digsAtEmptiedLastNight))
    }
    expect(mean(per[0])).toBe(0)
    expect(mean(per[1])).toBeGreaterThan(1.5)
    expect(mean(per[1])).toBeLessThan(2.5)
    // Measured, not the spec's target (about two): the night-3 count is about one, because this forager empties fewer logs on night 2.
    expect(mean(per[2])).toBeGreaterThan(0.6)
    expect(mean(per[2])).toBeLessThan(1.6)
  })
  it('a scripted forager that is called returns, nurses and goes on; its path is recorded', () => {
    const { plan, clearings } = planFor(2)
    const run = runBlockScripted(plan.blocks[0], clearings[plan.blocks[0].clearing], 2, perfect())
    for (const r of run.records) {
      expect(r.nursedAt).not.toBeNull()
      expect(r.path.length).toBeGreaterThan(100)
      expect(r.digs.some((d) => d.afterCall)).toBe(true)
    }
    expect(run.states.length).toBe(4)
  })
})

describe('the map question (§8.6, §8.7)', () => {
  it('the confusion table counts marks against truths, and confusions between nights are the off-diagonal night cells', () => {
    const { plan, clearings } = planFor(4)
    const c = clearings[plan.blocks[0].clearing]
    const run = newBlockRun(plan.blocks[0], c)
    const s1 = startNight(run, 4)
    runScripted(s1, { next: (s) => nearest(s, s.clearing.logs.filter((l) => l.kind === 'loose' && s.dugTonight[l.id] === 0)) })
    finishNight(run, s1)
    const s2 = startNight(run, 4)
    runScripted(s2, { next: (s) => nearest(s, s.clearing.logs.filter((l) => l.kind === 'loose' && s.dugTonight[l.id] === 0 && !s.record.fullAtStart[l.id] === false)) })
    finishNight(run, s2)
    const t = truths(c, run.states[2], 2)
    const loose = c.logs.filter((l) => l.kind === 'loose')
    expect(Object.keys(t).length).toBe(loose.length)
    // Mark every log "last night": right for those emptied last night, a confusion for those emptied tonight, and wrong but not a confusion for the never-emptied.
    const answers: Record<number, 'last night'> = {}
    for (const l of loose) answers[l.id] = 'last night'
    const table = confusionTable(t, answers)
    const tonight = loose.filter((l) => t[l.id] === 'tonight').length
    const last = loose.filter((l) => t[l.id] === 'last night').length
    expect(table.cells['tonight']['last night']).toBe(tonight)
    expect(table.cells['last night']['last night']).toBe(last)
    expect(table.confusions).toBe(tonight)
    expect(table.couldBeConfused).toBe(tonight + last)
    expect(table.right).toBe(last)
  })
})

describe('the tallies (§8.7)', () => {
  it('count beetles, digs at full logs, digs at logs emptied last night, repeats before and after the call, and digs at smooth logs', () => {
    const { plan, clearings } = planFor(6)
    const c = clearings[plan.blocks[0].clearing]
    const run = newBlockRun(plan.blocks[0], c)
    const s1 = startNight(run, 6)
    runScripted(s1, { next: (s) => nearest(s, s.clearing.logs.filter((l) => l.kind === 'loose' && s.dugTonight[l.id] === 0)) })
    finishNight(run, s1)
    const t1 = tallies(s1.record)
    expect(t1.beetles).toBe(t1.digsAtFull)
    expect(t1.digsAtEmptiedLastNight).toBe(0)
    expect(t1.passedOverRefilled).toBeNull()
    // Night 2: dig every loose-bark log once, nearest first: the ones emptied last night are counted.
    const s2 = startNight(run, 6)
    runScripted(s2, { next: (s) => nearest(s, s.clearing.logs.filter((l) => l.kind === 'loose' && s.dugTonight[l.id] === 0)) })
    finishNight(run, s2)
    const t2 = tallies(s2.record)
    expect(t2.digsAtEmptiedLastNight).toBe(s2.record.digs.filter((d) => d.outcome === 'empty').length)
    expect(t2.digsAtEmptiedLastNight + t2.digsAtFull).toBe(t2.digs)
  })
})
