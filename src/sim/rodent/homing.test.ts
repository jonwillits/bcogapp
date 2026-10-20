import { describe, it, expect } from 'vitest'
import { HomingTrial, planBlock, replanTrip, runNavigators, NAVIGATOR_NOISE, DT, type TrialPlan, type View } from './homing'
import { RANGE, SMALL_MOVE, LARGE_MOVE } from './range'
import { angleDiff } from './spatial/angles'

/**
 * Part 1's tests (spec §14): the navigators reproduce their endpoints from
 * the record and the seed; the running sum's error grows with path length;
 * following one averages below the conflict threshold and follows the
 * landmarks above it; every trial records its time in each view; and the
 * camera view changes nothing in the trial.
 */

/** A scripted forager: steers to each beetle, then straight back to the nest by the true positions, and says "here". In the given view. */
function scripted(plan: TrialPlan, seed: number, view: View = 'eye', returnError = 0): HomingTrial {
  const trial = new HomingTrial(plan, seed)
  trial.setView(view)
  let guard = 0
  while (!trial.done && guard++ < 20000) {
    const target = trial.currentBeetle ?? { x: RANGE.nest.x + returnError, y: RANGE.nest.y }
    const want = Math.atan2(target.y - trial.body.y, target.x - trial.body.x)
    const d = angleDiff(trial.body.heading, want)
    trial.step(DT, { forward: Math.abs(d) < 0.5 ? 1 : 0, turn: d > 0.05 ? 1 : d < -0.05 ? -1 : 0 })
    if (trial.phase === 'return' && trial.blackout <= 0 && Math.hypot(trial.body.x - target.x, trial.body.y - target.y) < 0.5) trial.here()
  }
  return trial
}

describe('the trip record and the navigators', () => {
  it('the four navigators reproduce their endpoints from the trial record and the seed', () => {
    const plan = planBlock('dark', 11)[2]
    const t = scripted(plan, 11)
    const a = runNavigators(t.record, 11)
    const b = runNavigators(t.record, 11)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
    const c = runNavigators(t.record, 12)
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(c))
  })

  it('every trial records the time spent in each view, and the trip record is complete: every step’s pose and command, every beetle, the light', () => {
    const plan = planBlock('moved', 5)[0]
    const t = scripted(plan, 5, 'follow')
    expect(t.record.viewSeconds.follow).toBeGreaterThan(5)
    expect(t.record.viewSeconds.eye).toBe(0)
    expect(t.record.beetlesAt.length).toBe(plan.legs.length)
    expect(t.record.steps.length).toBeGreaterThan(100)
    expect(t.record.steps.some((s) => s.phase === 'out')).toBe(true)
    expect(t.record.steps.some((s) => s.phase === 'return')).toBe(true)
    expect(t.record.steps.every((s) => s.light === 'moonlight')).toBe(true)
    expect(t.record.endpoint).not.toBeNull()
  })

  it('switching views changes no number in the sim: the same seed and inputs give the same trial record in either view', () => {
    const plan = planBlock('moonlight', 8)[1]
    const eye = scripted(plan, 8, 'eye')
    const follow = scripted(plan, 8, 'follow')
    const strip = (r: typeof eye.record) => ({ ...r, viewSeconds: null })
    expect(JSON.stringify(strip(eye.record))).toBe(JSON.stringify(strip(follow.record)))
    expect(JSON.stringify(runNavigators(eye.record, 8))).toBe(JSON.stringify(runNavigators(follow.record, 8)))
  })
})

describe('Running sum only: error grows with path length over 100 seeded trips', () => {
  it('the mean error over long trips exceeds the mean over short ones', () => {
    const byLegs = new Map<number, number[]>()
    for (let seed = 0; seed < 17; seed++) {
      for (const plan of planBlock('dark', 2000 + seed)) {
        const t = scripted(plan, 2000 + seed)
        const nav = runNavigators(t.record, 2000 + seed).find((n) => n.id === 'runningSum')!
        const arr = byLegs.get(plan.legs.length) ?? []
        arr.push(nav.error)
        byLegs.set(plan.legs.length, arr)
      }
    }
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
    const m2 = mean(byLegs.get(2)!)
    const m3 = mean(byLegs.get(3)!)
    const m4 = mean(byLegs.get(4)!)
    expect(byLegs.get(2)!.length + byLegs.get(3)!.length + byLegs.get(4)!.length).toBeGreaterThanOrEqual(100)
    expect(m4).toBeGreaterThan(m2)
    expect(m3).toBeGreaterThan(m2 * 0.9)
  })
})

describe('the navigators on the moved landmarks (§7.5, §7.6)', () => {
  it('Following one averages below the conflict threshold and follows the landmarks above it; the threshold sits between the small and the large move', () => {
    // Step 5's trips end 6 to 9 m from the nest; the two moves put the two nests about 2 and 7 m apart.
    const apart = (move: number, d: number) => 2 * d * Math.sin(move / 2)
    expect(NAVIGATOR_NOISE.conflictDistance).toBeGreaterThan(apart(SMALL_MOVE, 9))
    expect(NAVIGATOR_NOISE.conflictDistance).toBeLessThan(apart(LARGE_MOVE, 6))
    const scores: Record<string, { small: number[]; large: number[] }> = {}
    for (let seed = 0; seed < 12; seed++) {
      for (const plan of planBlock('moved', 3000 + seed)) {
        const t = scripted(plan, 3000 + seed)
        for (const n of runNavigators(t.record, 3000 + seed)) {
          const s = (scores[n.id] ??= { small: [], large: [] })
          ;(Math.abs(plan.move) < 0.5 ? s.small : s.large).push(n.conflictScore!)
        }
      }
    }
    const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]
    // Landmarks only ends where the landmarks point; running sum only near the true nest.
    expect(median(scores.landmarks.large)).toBeGreaterThan(0.85)
    expect(Math.abs(median(scores.runningSum.large))).toBeLessThan(0.35)
    // Averaging lands between on both; following one lands between on the small move and on the landmarks on the large one.
    expect(median(scores.averaging.large)).toBeGreaterThan(0.15)
    expect(median(scores.averaging.large)).toBeLessThan(0.85)
    expect(median(scores.followingOne.large)).toBeGreaterThan(0.85)
    expect(median(scores.followingOne.small)).toBeLessThan(0.9)
  })

  it('on the bare range, Landmarks only stops where it is, and in moonlight it ends at the nest when a near landmark is in view', () => {
    const dark = planBlock('dark', 21)[0]
    const t = scripted(dark, 21)
    const nav = runNavigators(t.record, 21).find((n) => n.id === 'landmarks')!
    const last = t.record.steps.filter((s) => s.phase === 'out').at(-1)!
    expect(Math.hypot(nav.endpoint.x - last.x, nav.endpoint.y - last.y)).toBeLessThan(0.01)
    const moved = planBlock('moved', 21)[0]
    const m = scripted(moved, 21)
    const lm = runNavigators(m.record, 21).find((n) => n.id === 'landmarks')!
    expect(lm.conflictScore!).toBeGreaterThan(0.8)
  })
})

describe('the trips of Step 2 (Jon, 2026-10-20)', () => {
  it('eight trials, three of two beetles, three of three and two of four, in an order the seed sets; every beetle at least half the path so far from the nest; every return in moonlight', () => {
    const orders = new Set<string>()
    for (let seed = 1000; seed < 1020; seed++) {
      const plans = planBlock('dark', seed)
      expect(plans.length).toBe(8)
      const counts = plans.map((p) => p.legs.length)
      expect(counts.filter((c) => c === 2).length).toBe(3)
      expect(counts.filter((c) => c === 3).length).toBe(3)
      expect(counts.filter((c) => c === 4).length).toBe(2)
      orders.add(counts.join(''))
      for (const p of plans) {
        expect(p.bare).toBe(true)
        expect(p.lightBack).toBe('moonlight')
        let walked = 0
        let x = 0
        let y = 0
        for (const l of p.legs) {
          walked += Math.hypot(l.x - x, l.y - y)
          x = l.x
          y = l.y
          expect(Math.hypot(x, y)).toBeGreaterThanOrEqual(0.5 * walked - 1e-9)
        }
      }
    }
    expect(orders.size).toBeGreaterThan(3)
  })
})

describe('Restart trial (Jon, 2026-10-20)', () => {
  it('a restart draws a fresh trip of the same beetle count, never the picture block, and the record counts it', () => {
    const plan = planBlock('dark', 9)[2]
    const again = replanTrip(plan, 9, 1)
    expect(again.legs.length).toBe(plan.legs.length)
    expect(again.legs[0].x === plan.legs[0].x && again.legs[0].y === plan.legs[0].y).toBe(false)
    expect(replanTrip(again, 9, 2).legs[0].x).not.toBe(again.legs[0].x)
    expect(replanTrip(plan, 9, 1).legs[0].x).toBe(again.legs[0].x)
    const pic = planBlock('picture', 9)[0]
    expect(replanTrip(pic, 9, 1)).toBe(pic)
    const t = new HomingTrial(again, 9, 1)
    expect(t.record.restarts).toBe(1)
    expect(scripted(plan, 9).record.restarts).toBe(0)
  })
})
