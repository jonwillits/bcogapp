import { describe, it, expect } from 'vitest'
import { makeRng } from '../../random'
import { BEACONS, CLEARING, CLEARING_NEST, LOOK, LOOK_MIN_DISTANCE, NEST_ARCH, branchFootprint, logFootprint, lookDistance, makeClearing, nestFootprints, type Clearing } from './clearings'
import { afterNight, freshWeek, fullOnNight, isFull, truthOf, KIND_RULE, REFILL_RULE } from './refill'
import { LETTERS, TEST_NIGHTS, WEEK_NIGHTS, WEEK_ORDERS, differingFeatures, featureVector, FEATURE_DIMS, GROUNDS, letterOf, nightsOfKind, pairKind, planWeek, sameFeatures } from './features'
import { NIGHT_S, DIG_S, EAT_S, NURSE_S, PASS_CLOSE_M, PRACTICE_S, RETURN_GRACE_S, tallies, type NightRecord } from './night'
import { nearest, runScripted, type Policy } from './scripted'
import { ANSWERS, ANSWER_LABEL, confusionTable, truths } from './question'
import { planFor, runWeekScripted, startNight, newWeekRun, finishNight, nightRng, weekDone } from './week'
import { resultLine, weekSummary, whenScore, type Part4WeekResult } from './results'
import { NightSim } from './night'
import { mean } from '../../bilaterian/measure'

const SEEDS20 = Array.from({ length: 20 }, (_, i) => 1000 + i)

describe('the refill rule (§8.1, §8.3), over every sequence of empties across six nights', () => {
  it('a log emptied on night n is empty on n + 1 and full on n + 2; never emptied, it is full; smooth logs never have beetles', () => {
    for (let pattern = 0; pattern < 64; pattern++) {
      let last = freshWeek(2)
      const kinds = ['loose', 'smooth'] as const
      for (let night = 1; night <= WEEK_NIGHTS; night++) {
        const full = fullOnNight(kinds, last, night)
        expect(full[1]).toBe(false)
        // The loose log is full unless emptied on the night before.
        expect(full[0]).toBe(last[0] !== night - 1)
        const wantsDig = (pattern >> (night - 1)) & 1
        const emptied = [wantsDig === 1 && full[0], false]
        last = afterNight(last, emptied, night)
      }
    }
    expect(isFull('loose', null, 6)).toBe(true)
    expect(isFull('loose', 4, 5)).toBe(false)
    expect(isFull('loose', 4, 6)).toBe(true)
    expect(isFull('smooth', null, 1)).toBe(false)
  })
  it('the truths for the end-of-week question follow the state, and the answers are the four the spec names', () => {
    expect(truthOf(null, 6)).toBe('never')
    expect(truthOf(6, 6)).toBe('tonight')
    expect(truthOf(5, 6)).toBe('last night')
    expect(truthOf(4, 6)).toBe('two nights ago')
    expect(truthOf(3, 6)).toBe('never')
    expect(ANSWERS).toEqual(['tonight', 'last night', 'two nights ago', 'never'])
    expect(ANSWER_LABEL.never).toBe('Not emptied in the last three nights')
  })
  it('the two rules are stated in the words the spec gives', () => {
    expect(KIND_RULE).toMatch(/loose bark have beetles/)
    expect(REFILL_RULE).toBe('After you empty a log, it is still empty the next night. The night after that, it has beetles again.')
  })
})

describe('the clearing and the logs (§8.2; one clearing since 2026-10-28)', () => {
  const pairwise = (c: Clearing) => {
    const out: number[] = []
    for (let i = 0; i < c.logs.length; i++) for (let j = i + 1; j < c.logs.length; j++) out.push(Math.hypot(c.logs[i].x - c.logs[j].x, c.logs[i].y - c.logs[j].y))
    return out
  }
  it('one clearing with ten logs, seven loose and three smooth, 6 to 16 m from its nest and at least 4 m apart, with three or four landmarks', () => {
    for (const seed of SEEDS20) {
      const c = makeClearing(seed)
      expect(c.logs.length).toBe(10)
      expect(c.logs.filter((l) => l.kind === 'loose').length).toBe(7)
      for (const l of c.logs) {
        const r = Math.hypot(l.x - c.nest.x, l.y - c.nest.y)
        expect(r).toBeGreaterThanOrEqual(CLEARING.minRadius - 1e-9)
        expect(r).toBeLessThanOrEqual(CLEARING.maxRadius + 1e-9)
      }
      for (const d of pairwise(c)) expect(d).toBeGreaterThanOrEqual(CLEARING.logSpacing - 1e-9)
      expect(c.landmarks.length).toBeGreaterThanOrEqual(3)
      expect(c.landmarks.length).toBeLessThanOrEqual(4)
      expect(c.nest).toEqual(CLEARING_NEST)
    }
  })
  it('every log’s look differs from every other log’s by at least the minimum distance, within the ranges, and nothing sits on a log; the footprint is the look’s length', () => {
    for (const seed of SEEDS20) {
      const c = makeClearing(seed)
      for (let i = 0; i < c.logs.length; i++) {
        const k = c.logs[i].look
        expect(k.length).toBeGreaterThanOrEqual(LOOK.length[0])
        expect(k.length).toBeLessThanOrEqual(LOOK.length[1])
        expect(k.radius).toBeGreaterThanOrEqual(LOOK.radius[0])
        expect(k.radius).toBeLessThanOrEqual(LOOK.radius[1])
        expect(k.stubs.length).toBeLessThanOrEqual(LOOK.maxStubs)
        expect(k.moss).toBeGreaterThanOrEqual(0)
        expect(k.moss).toBeLessThanOrEqual(1)
        expect(Object.keys(k).sort()).toEqual(['length', 'moss', 'radius', 'stubs'])
        for (let j = i + 1; j < c.logs.length; j++) expect(lookDistance(k, c.logs[j].look), `seed ${seed} logs ${i} ${j}`).toBeGreaterThanOrEqual(LOOK_MIN_DISTANCE - 1e-9)
        const f = logFootprint(c.logs[i])
        expect(Math.hypot(f.bx - f.ax, f.by - f.ay)).toBeCloseTo(k.length, 9)
      }
    }
  })
  it('the clearing sits at the middle of the range’s ground, and the forager’s bound is beyond the farthest log', () => {
    expect(CLEARING_NEST).toEqual({ x: 0, y: 0 })
    expect(CLEARING.bound).toBeGreaterThan(CLEARING.maxRadius + LOOK.length[1])
  })
  it('the beacons stand beyond the bound, the same for every seed: three tall to the north and two shorter to the east', () => {
    expect(BEACONS).toHaveLength(5)
    const north = BEACONS.filter((b) => b.y > CLEARING.bound)
    const east = BEACONS.filter((b) => b.x > CLEARING.bound)
    expect(north).toHaveLength(3)
    expect(east).toHaveLength(2)
    for (const b of BEACONS) expect(Math.hypot(b.x, b.y)).toBeGreaterThan(CLEARING.bound + 1)
    expect(Math.min(...north.map((b) => b.height))).toBeGreaterThan(Math.max(...east.map((b) => b.height)))
    for (const b of north) expect(Math.abs(b.x)).toBeLessThan(5)
    for (const b of east) expect(Math.abs(b.y)).toBeLessThan(5)
  })
  it('the landmarks lie 4 to 12 m from the nest and at least 5 m apart', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const c = makeClearing(seed)
      for (const l of c.landmarks) {
        const r = Math.hypot(l.x - c.nest.x, l.y - c.nest.y)
        expect(r).toBeGreaterThanOrEqual(4 - 1e-9)
        expect(r).toBeLessThanOrEqual(12 + 1e-9)
      }
      for (let i = 0; i < c.landmarks.length; i++) for (let j = i + 1; j < c.landmarks.length; j++) expect(Math.hypot(c.landmarks[i].x - c.landmarks[j].x, c.landmarks[i].y - c.landmarks[j].y)).toBeGreaterThanOrEqual(5 - 1e-9)
    }
  })
  it('the same seed gives the same clearing', () => {
    expect(JSON.stringify(makeClearing(42))).toBe(JSON.stringify(makeClearing(42)))
    expect(JSON.stringify(makeClearing(42))).not.toBe(JSON.stringify(makeClearing(43)))
  })
})

describe('the week’s order of night features (§8.4, §8.5)', () => {
  it('over 100 seeds: nights with the same letter are identical in every feature, neighboring nights with different letters differ in every feature, and any two letters differ on at least two', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const plan = planWeek(seed)
      expect(WEEK_ORDERS).toContain(plan.order)
      expect(plan.nights.length).toBe(WEEK_NIGHTS)
      for (let n = 1; n <= WEEK_NIGHTS; n++) expect(sameFeatures(plan.nights[n - 1], plan.letters[letterOf(plan.order, n)])).toBe(true)
      for (let n = 2; n <= WEEK_NIGHTS; n++) {
        const same = letterOf(plan.order, n) === letterOf(plan.order, n - 1)
        if (same) expect(sameFeatures(plan.nights[n - 1], plan.nights[n - 2])).toBe(true)
        else expect(differingFeatures(plan.nights[n - 1], plan.nights[n - 2])).toBe(4)
      }
      for (let i = 0; i < LETTERS.length; i++) for (let j = i + 1; j < LETTERS.length; j++) expect(differingFeatures(plan.letters[LETTERS[i]], plan.letters[LETTERS[j]])).toBeGreaterThanOrEqual(2)
    }
  })
  it('the practice night is a clear full moon whatever the seed; the week’s nights are not all so', () => {
    for (let seed = 0; seed < 40; seed++) {
      const p = planWeek(seed).practice
      expect(p.moon).toBe('full moon')
      expect(p.weather).toBe('clear')
    }
    expect(Array.from({ length: 40 }, (_, i) => planWeek(i).nights.some((n) => n.weather === 'fog' || n.moon === 'new moon')).filter(Boolean).length).toBeGreaterThan(20)
  })

  it('the seed picks the order, and both occur', () => {
    const orders = new Set(Array.from({ length: 40 }, (_, i) => planWeek(i).order))
    expect(orders.size).toBe(2)
  })
  it('in both orders two nights follow a look-alike pair and two follow a different pair, at the same average position in the week', () => {
    expect(nightsOfKind('AABCCD', 'after a look-alike pair')).toEqual([3, 6])
    expect(nightsOfKind('AABCCD', 'after a different pair')).toEqual([4, 5])
    expect(nightsOfKind('ABBBCD', 'after a look-alike pair')).toEqual([4, 5])
    expect(nightsOfKind('ABBBCD', 'after a different pair')).toEqual([3, 6])
    for (const order of WEEK_ORDERS) {
      const a = nightsOfKind(order, 'after a look-alike pair')
      const d = nightsOfKind(order, 'after a different pair')
      expect(mean(a)).toBeCloseTo(mean(d), 9)
      expect([...a, ...d].sort()).toEqual([...TEST_NIGHTS])
    }
    expect(pairKind('AABCCD', 1)).toBeNull()
    expect(pairKind('AABCCD', 2)).toBeNull()
  })
  it('the feature vector is one-hot in four groups', () => {
    const v = featureVector({ moon: 'half moon', weather: 'fog', ground: GROUNDS[3], sound: 'frogs' })
    expect(v.length).toBe(FEATURE_DIMS)
    expect(v.reduce((a, b) => a + b, 0)).toBe(4)
  })
})

describe('a night (§8.3)', () => {
  const sim = (seed = 1) => {
    const { plan, clearing } = planFor(seed)
    const run = newWeekRun(plan, clearing)
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
    expect(s.nursed).toBe(true)
    expect(s.record.digs.length).toBe(0)
    expect(s.record.pauses).toEqual({ count: 0, seconds: 0 })
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
    // Both logs were passed close by.
    expect(s.record.passedClose[loose.id]).toBe(true)
    expect(s.record.passedClose[smooth.id]).toBe(true)
  })
  it('after the call, digging is disabled until the forager has returned and nursed, which takes NURSE_S; arriving at the rim, it is set in the middle of the young', () => {
    const { sim: s } = sim(5)
    const loose = s.clearing.logs.find((l) => l.kind === 'loose')!
    s.place(loose.x + 0.6, loose.y, 0)
    while (!s.called) s.step(0.05, { forward: 0, turn: 0 })
    expect(s.phase).toBe('called')
    expect(s.canDigAt).toBeNull()
    s.step(0.05, { forward: 0, turn: 0, dig: true })
    expect(s.record.digs.length).toBe(0)
    s.place(s.clearing.nest.x + CLEARING.nestReach - 0.05, s.clearing.nest.y, 0)
    s.step(0.05, { forward: 0, turn: 0 })
    expect(s.phase).toBe('nursing')
    expect(Math.hypot(s.body.x - s.clearing.nest.x, s.body.y - s.clearing.nest.y)).toBeLessThan(0.01)
    const t0 = s.time
    while (s.phase === 'nursing') s.step(0.05, { forward: 0, turn: 0 })
    expect(s.time - t0).toBeCloseTo(NURSE_S, 1)
    expect(s.nursed).toBe(true)
    expect(s.phase).toBe('foraging')
  })
  it('the root’s feet are solid and the arch is open underneath: walked at from its broad side the body passes under it to the hole, and walked at from its end it is held off the foot; the nest is reached at the rim of its hole', () => {
    const { sim: s } = sim(7)
    const nest = s.clearing.nest
    const [a, b] = nestFootprints(nest)
    const along = Math.atan2(b.ay - a.ay, b.ax - a.ax)
    const across = along + Math.PI / 2
    s.place(nest.x + Math.cos(across), nest.y + Math.sin(across), across + Math.PI)
    for (let k = 0; k < 13; k++) s.step(0.05, { forward: 1, turn: 0 })
    expect(Math.hypot(s.body.x - nest.x, s.body.y - nest.y)).toBeLessThan(0.1)
    expect(s.atNest).toBe(true)
    s.place(nest.x + 1.2 * Math.cos(along), nest.y + 1.2 * Math.sin(along), along + Math.PI)
    for (let k = 0; k < 40; k++) s.step(0.05, { forward: 1, turn: 0 })
    const dEnd = Math.hypot(s.body.x - nest.x, s.body.y - nest.y)
    expect(dEnd).toBeGreaterThan(NEST_ARCH.radius + NEST_ARCH.thickness + s.body.loco.radius - 0.02)
    expect(s.atNest).toBe(false)
    expect(CLEARING.nestReach).toBe(0.5)
  })
  it('the fallen branch, on a night that has one, stops the body where it lies; on other nights nothing does there', () => {
    const { plan, clearing } = planFor(11)
    const c = clearing
    const run = (ground: typeof plan.practice.ground) => new NightSim(c, c.logs.map(() => null), 1, { ...plan.practice, ground }, nightRng(11, 0))
    const f = branchFootprint(c.nest)
    const mid = { x: (f.ax + f.bx) / 2, y: (f.ay + f.by) / 2 }
    const across = Math.atan2(f.by - f.ay, f.bx - f.ax) + Math.PI / 2
    const walkAt = (s: NightSim) => {
      s.place(mid.x + Math.cos(across), mid.y + Math.sin(across), across + Math.PI)
      for (let k = 0; k < 30; k++) s.step(0.05, { forward: 1, turn: 0 })
      return Math.hypot(s.body.x - mid.x, s.body.y - mid.y)
    }
    expect(walkAt(run('a fallen branch across the path'))).toBeGreaterThan(f.r + 0.1 - 0.01)
    expect(walkAt(run('nothing on the ground'))).toBeGreaterThan(1.1)
  })
  it('a log is passed close by when the body comes within PASS_CLOSE_M of it, and not otherwise', () => {
    const { sim: s } = sim(13)
    const l = s.clearing.logs[0]
    expect(s.record.passedClose[l.id]).toBe(false)
    s.place(l.x + PASS_CLOSE_M + 0.3, l.y, 0)
    expect(s.record.passedClose[l.id]).toBe(false)
    s.place(l.x + PASS_CLOSE_M - 0.1, l.y, 0)
    expect(s.record.passedClose[l.id]).toBe(true)
    expect(PASS_CLOSE_M).toBe(2)
    s.recordPause(3.5, true)
    s.recordPause(1.5, false)
    expect(s.record.pauses).toEqual({ count: 1, seconds: 5 })
  })
  it('when the night’s time is up the forager walks home by itself with no key held, the walk is in the path, and the night ends at the nest; a forager that cannot get home in time is set down there', () => {
    const { sim: s } = sim(9)
    const far = s.clearing.logs.reduce((a, l) => (Math.hypot(l.x - s.clearing.nest.x, l.y - s.clearing.nest.y) > Math.hypot(a.x - s.clearing.nest.x, a.y - s.clearing.nest.y) ? l : a))
    while (s.time < s.seconds - 0.5) s.step(0.05, { forward: 0, turn: 0 })
    s.place(far.x + 1, far.y, 0)
    const d0 = Math.hypot(s.body.x - s.clearing.nest.x, s.body.y - s.clearing.nest.y)
    expect(d0).toBeGreaterThan(5)
    while (s.time < s.seconds + 0.5) s.step(0.05, { forward: 0, turn: 0 })
    expect(s.phase).toBe('returning')
    expect(s.dawning).toBe(true)
    expect(s.canDigAt).toBeNull()
    const samples = s.record.path.length
    while (s.phase === 'returning' && s.time < s.seconds + 60) s.step(0.05, { forward: 0, turn: 0 })
    expect(s.done).toBe(true)
    expect(s.atNest).toBe(true)
    expect(s.time - s.seconds).toBeGreaterThan(d0 / s.body.loco.speed - 0.5)
    expect(s.time - s.seconds).toBeLessThan(d0 / s.body.loco.speed + RETURN_GRACE_S)
    expect(s.record.path.length).toBeGreaterThan(samples + 10)
    expect(s.record.seconds).toBe(s.seconds)
    const { plan, clearing } = planFor(9)
    const run = newWeekRun(plan, clearing)
    const p = startNight(run, 9, 0, { seconds: PRACTICE_S })
    expect(p.seconds).toBe(PRACTICE_S)
    expect(p.callAt).toBe(PRACTICE_S / 2)
  })
  it('a forager behind a log when the walk home begins goes round it and reaches the nest on foot, in all but a rare case with several things in the way', () => {
    let cases = 0
    let setDown = 0
    for (const seed of [9, 10, 11, 12]) {
      const { sim: s } = sim(seed)
      // Stand just behind each log in turn, the log between the body and the nest, facing away, as the night ends.
      for (const l of s.clearing.logs) {
        const { sim: t } = sim(seed)
        while (t.time < t.seconds - 0.2) t.step(0.05, { forward: 0, turn: 0 })
        const dx = l.x - t.clearing.nest.x
        const dy = l.y - t.clearing.nest.y
        const d = Math.hypot(dx, dy)
        const across = Math.atan2(dy, dx) + Math.PI / 2
        t.place(l.x + (dx / d) * 0.45 + Math.cos(across) * 0.15, l.y + (dy / d) * 0.45 + Math.sin(across) * 0.15, Math.atan2(dy, dx))
        while (!t.done && t.time < t.seconds + 60) t.step(0.05, { forward: 0, turn: 0 })
        expect(t.done, `seed ${seed} log ${l.id}`).toBe(true)
        cases++
        // Set down at the nest only when the walk ran out of grace (a 180° turn, then two or three things to go round).
        if (t.time - t.seconds >= d / t.body.loco.speed + RETURN_GRACE_S - 0.1) setDown++
      }
    }
    expect(cases).toBe(40)
    expect(setDown).toBeLessThanOrEqual(2)
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

describe('the scripted foragers and the night’s length (§14, targets), over the week', () => {
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
  // Measured 2026-10-28 over the week at 90 s on the spread clearing (6 to 16 m) at the scripted pace of two thirds of the key
  // pace (tune.probe.ts; notes §4.1): the perfect rememberer empties 4.2 / 2.6 / 4.3 / 2.6 / 4.2 / 2.8 on nights 1 to 6, a
  // see-saw, since what it empties on one night is what is missing the next; Usual only digs at 1.8 logs emptied last night
  // on night 2 and 0.8 to 1.2 on later nights. The bands are those set 2026-10-27 at half the key pace on the 4 to 11 m clearing.
  const PERFECT_ODD = [3.6, 5.6]
  const PERFECT_EVEN = [1.4, 3.2]
  const USUAL_NIGHT2 = [1.1, 2.3]
  it('a scripted perfect rememberer empties about four or five of seven loose-bark logs on night 1, when all are full, and on the other odd nights, and what is left on the even nights, over 20 seeds', () => {
    const per: number[][] = Array.from({ length: WEEK_NIGHTS }, () => [])
    for (const seed of SEEDS20) {
      const { plan, clearing } = planFor(seed)
      runWeekScripted(plan, clearing, seed, perfect()).records.forEach((r, i) => per[i].push(tallies(r).digsAtFull))
    }
    for (const n of [1, 3, 5]) {
      expect(mean(per[n - 1]), `night ${n}`).toBeGreaterThan(PERFECT_ODD[0])
      expect(mean(per[n - 1]), `night ${n}`).toBeLessThan(PERFECT_ODD[1])
    }
    for (const n of [2, 4, 6]) {
      expect(mean(per[n - 1]), `night ${n}`).toBeGreaterThan(PERFECT_EVEN[0])
      expect(mean(per[n - 1]), `night ${n}`).toBeLessThan(PERFECT_EVEN[1])
    }
  })
  it('a scripted forager that knows only the usual fact digs at about two logs emptied the night before on night 2, over 20 seeds, and at some on every later night', () => {
    const per: number[][] = Array.from({ length: WEEK_NIGHTS }, () => [])
    for (const seed of SEEDS20) {
      const { plan, clearing } = planFor(seed)
      runWeekScripted(plan, clearing, seed, usualOnly(seed)).records.forEach((r, i) => per[i].push(tallies(r).digsAtEmptiedLastNight))
    }
    expect(mean(per[0])).toBe(0)
    expect(mean(per[1])).toBeGreaterThan(USUAL_NIGHT2[0])
    expect(mean(per[1])).toBeLessThan(USUAL_NIGHT2[1])
    for (let n = 3; n <= WEEK_NIGHTS; n++) expect(mean(per[n - 1]), `night ${n}`).toBeGreaterThan(0.5)
  })
  it('a scripted forager that is called returns, nurses and goes on; its path is recorded; the week runs six nights and carries the state through', () => {
    const { plan, clearing } = planFor(2)
    const run = runWeekScripted(plan, clearing, 2, perfect())
    expect(run.records.length).toBe(WEEK_NIGHTS)
    expect(weekDone(run)).toBe(true)
    for (const r of run.records) {
      expect(r.nursedAt).not.toBeNull()
      expect(r.path.length).toBeGreaterThan(100)
    }
    expect(run.records.filter((r) => r.digs.some((d) => d.afterCall)).length).toBeGreaterThanOrEqual(3)
    expect(run.states.length).toBe(WEEK_NIGHTS + 1)
    // Every log full on night 1; on a later night a log emptied the night before is empty.
    expect(run.records[0].fullAtStart.filter(Boolean).length).toBe(7)
    for (let n = 2; n <= WEEK_NIGHTS; n++) for (const l of clearing.logs) if (run.states[n - 1][l.id] === n - 1) expect(run.records[n - 1].fullAtStart[l.id]).toBe(false)
    expect(() => startNight(run, 2)).toThrow()
  })
})

describe('the scoring of when-decisions and when-errors (§8.7)', () => {
  const record = (night: number, digs: number[], passed: number[], logs: number): NightRecord => ({
    night,
    features: planWeek(1).nights[0],
    digs: digs.map((log, i) => ({ t: i, log, outcome: 'empty', afterCall: false, repeat: false, emptiedLastNight: false })),
    path: [],
    beetles: 0,
    fullAtStart: new Array(logs).fill(true),
    emptiedTonight: new Array(logs).fill(false),
    passedClose: Array.from({ length: logs }, (_, i) => passed.includes(i) || digs.includes(i)),
    passedOverRefilled: 0,
    calledAt: 45,
    nursedAt: null,
    seconds: 90,
    pauses: { count: 0, seconds: 0 },
  })
  const clearing = makeClearing(1)
  const loose = clearing.logs.filter((l) => l.kind === 'loose').map((l) => l.id)
  it('fixtures: a dig at a log emptied last night is an error; a log emptied two nights ago passed close by and never dug is an error; one passed and dug later is not; a log both passed and dug counts once; a log neither passed nor dug is no decision', () => {
    const [a, b, c, d, e] = loose
    const last = freshWeek(clearing.logs.length)
    last[a] = 2 // emptied last night (night 3 is tonight)
    last[b] = 1 // two nights ago, passed and dug: a correct decision, once
    last[c] = 1 // two nights ago, passed and never dug: an error
    last[d] = 1 // two nights ago, neither passed nor dug: no decision
    last[e] = 2 // last night, passed and not dug: a correct decision
    const w = whenScore(record(3, [a, b], [b, c, e], clearing.logs.length), last, clearing)
    expect(w.atStake).toBe(5)
    expect(w.emptiedLastNight).toBe(2)
    expect(w.emptiedTwoAgo).toBe(3)
    expect(w.decisions).toBe(4)
    expect(w.errors).toBe(2)
    expect(w.digDecisions).toBe(2)
    expect(w.digErrors).toBe(1)
    expect(w.logs.find((l) => l.log === b)).toMatchObject({ dug: true, passed: true, decision: true, error: false })
    expect(w.logs.find((l) => l.log === d)).toMatchObject({ decision: false, error: false })
    // Nights 1 and 2 score nothing.
    expect(whenScore(record(2, [a], [a], clearing.logs.length), last, clearing).decisions).toBe(0)
  })
  it('the week’s summary pools each kind’s nights, gives the share over digs alone too, and the no-memory baseline; the result line names the order and the shares', () => {
    const plan = planWeek(1)
    const states = [freshWeek(clearing.logs.length)]
    const records: NightRecord[] = []
    const [a, b, c, d, e, f, g] = loose
    // Night 1 empties a, b, c; night 2 empties d, e; night 3 digs a (refilled, right) and d (emptied last night, error), passes b; ...
    const plan6: { digs: number[]; passed: number[]; emptied: number[] }[] = [
      { digs: [a, b, c], passed: [], emptied: [a, b, c] },
      { digs: [d, e], passed: [], emptied: [d, e] },
      { digs: [a, d], passed: [b], emptied: [a] },
      { digs: [f, g], passed: [d], emptied: [f, g] },
      { digs: [b, c], passed: [], emptied: [b, c] },
      { digs: [a, f], passed: [c], emptied: [a] },
    ]
    plan6.forEach((p, i) => {
      const r = record(i + 1, p.digs, p.passed, clearing.logs.length)
      for (const l of p.emptied) r.emptiedTonight[l] = true
      r.beetles = p.emptied.length
      records.push(r)
      states.push(afterNight(states[i], r.emptiedTonight, i + 1))
    })
    const result: Part4WeekResult = { plan, records, states, answers: {}, restarted: false }
    const s = weekSummary(result, clearing)
    expect(s.nights.length).toBe(6)
    // Night 3: at stake a, b, c (night 1) and d, e (night 2); decisions a, b, d; errors d (dug, emptied last night) and b (passed, two nights ago, not dug).
    expect(s.nights[2]).toMatchObject({ atStake: 5, decisions: 3, errors: 2, digDecisions: 2, digErrors: 1 })
    const kinds = Object.values(s.byKind)
    expect(kinds.map((k) => k.nights).flat().sort()).toEqual([3, 4, 5, 6])
    for (const k of kinds) {
      const nights = k.nights.map((n) => s.nights[n - 1])
      expect(k.decisions).toBe(nights.reduce((x, y) => x + y.decisions, 0))
      expect(k.errors).toBe(nights.reduce((x, y) => x + y.errors, 0))
      expect(k.share).toBe(k.decisions ? k.errors / k.decisions : null)
      expect(k.digShare).toBe(k.digDecisions ? k.digErrors / k.digDecisions : null)
      expect(k.baseline).toBe(nights.reduce((x, y) => x + y.emptiedLastNight, 0) / nights.reduce((x, y) => x + y.atStake, 0))
    }
    expect(s.beetles).toEqual([3, 2, 1, 2, 2, 1])
    const line = resultLine(s)
    expect(line.startsWith(plan.order)).toBe(true)
    expect(line).toMatch(/after look-alike pairs \d+% · after different pairs \d+% · nights 3 to 6: /)
  })
})

describe('the end-of-week question (§8.6, §8.7)', () => {
  it('the confusion table counts marks against truths after night 6, and confusions between nights are the off-diagonal night cells', () => {
    const { plan, clearing } = planFor(4)
    const c = clearing
    const run = runWeekScripted(plan, c, 4, { next: (s) => nearest(s, s.clearing.logs.filter((l) => l.kind === 'loose' && s.dugTonight[l.id] === 0)) })
    const t = truths(c, run.states[WEEK_NIGHTS])
    const loose = c.logs.filter((l) => l.kind === 'loose')
    expect(Object.keys(t).length).toBe(loose.length)
    const answers: Record<number, 'last night'> = {}
    for (const l of loose) answers[l.id] = 'last night'
    const table = confusionTable(t, answers)
    const tonight = loose.filter((l) => t[l.id] === 'tonight').length
    const last = loose.filter((l) => t[l.id] === 'last night').length
    const two = loose.filter((l) => t[l.id] === 'two nights ago').length
    expect(table.cells['tonight']['last night']).toBe(tonight)
    expect(table.cells['last night']['last night']).toBe(last)
    expect(table.confusions).toBe(tonight + two)
    expect(table.couldBeConfused).toBe(tonight + last + two)
    expect(table.right).toBe(last)
  })
})

describe('the tallies (§8.7)', () => {
  it('count beetles, digs at full logs, digs at logs emptied last night, repeats before and after the call, digs at smooth logs, and full logs passed close by that were emptied two nights ago', () => {
    const { plan, clearing: c } = planFor(6)
    const run = newWeekRun(plan, c)
    const nearestLoose: Policy = { next: (s) => nearest(s, s.clearing.logs.filter((l) => l.kind === 'loose' && s.dugTonight[l.id] === 0)) }
    const s1 = startNight(run, 6)
    runScripted(s1, nearestLoose)
    finishNight(run, s1)
    const t1 = tallies(s1.record)
    expect(t1.beetles).toBe(t1.digsAtFull)
    expect(t1.digsAtEmptiedLastNight).toBe(0)
    expect(t1.passedOverRefilled).toBeNull()
    const s2 = startNight(run, 6)
    runScripted(s2, nearestLoose)
    finishNight(run, s2)
    const t2 = tallies(s2.record)
    expect(t2.digsAtEmptiedLastNight).toBe(s2.record.digs.filter((d) => d.outcome === 'empty').length)
    expect(t2.digsAtEmptiedLastNight + t2.digsAtFull).toBe(t2.digs)
    // Night 3: a forager that digs nothing and stands still passes nothing, so passes over no refilled log; one placed by every log passes them all.
    const s3 = startNight(run, 6)
    s3.runStill()
    expect(tallies(s3.record).passedOverRefilled).toBe(0)
    const s3b = new NightSim(c, run.states[2], 3, plan.nights[2], nightRng(6, 3, 1))
    for (const l of c.logs) s3b.place(l.x + 0.5, l.y, 0)
    s3b.runStill()
    const refilled = c.logs.filter((l) => l.kind === 'loose' && run.states[2][l.id] === 1).length
    expect(tallies(s3b.record).passedOverRefilled).toBe(refilled)
  })
})
