import { describe, it, expect } from 'vitest'
import { makeRng } from '../random'
import { StudentDay, obstacles, positionAt, TIME_SCALE } from './studentDay'
import { MORNING_SECONDS, PLACE_XZ, WINDOW_SECONDS } from './range/places'
import { execute, type Segment, type Standing } from './range/acts'
import { chainFor } from './range/chains'

/**
 * Part 3, Step 1 (spec §7.6, §14): the student's hominin walks, picks up,
 * makes and eats under the same rules as the programmed hominins; a day
 * driven straight through the carcass chain eats at midday; the obstacles
 * stop the body; the clock runs at TIME_SCALE.
 */
const DT = 0.02

function driveTo(day: StudentDay, x: number, z: number, maxSeconds = 120): number {
  let t = 0
  while (t < maxSeconds) {
    const dx = x - day.body.x
    const dz = z - day.body.y
    const d = Math.hypot(dx, dz)
    if (d < 2) return t
    const want = Math.atan2(dz, dx)
    let diff = want - day.body.heading
    while (diff > Math.PI) diff -= 2 * Math.PI
    while (diff < -Math.PI) diff += 2 * Math.PI
    const turn = diff > 0.15 ? 1 : diff < -0.15 ? -1 : 0
    day.tick(DT, { forward: Math.abs(diff) < 0.6 ? 1 : 0, turn, act: false })
    t += DT
  }
  return t
}

function waitFor(day: StudentDay, seconds: number): void {
  for (let t = 0; t < seconds; t += DT) day.tick(DT, { forward: 0, turn: 0, act: false })
}

describe('the student’s day', () => {
  it('the carcass chain, driven, ends in a meal at midday; the clock runs at the time scale', () => {
    const day = new StudentDay('vultures', makeRng(1), obstacles(makeRng(2)))
    const s = day.state
    expect(s.phase).toBe('dawn')
    driveTo(day, PLACE_XZ.riverbank.x, PLACE_XZ.riverbank.z)
    expect(day.nearPlace()).toBe('riverbank')
    const acts = day.available()
    expect(acts.map((a) => a.id)).toContain('pickUp-cobble')
    day.tick(DT, { forward: 0, turn: 0, act: true })
    expect(s.act?.kind).toBe('pickUp')
    waitFor(day, 10 / TIME_SCALE + 0.1)
    expect(s.hands).toEqual(['cobble'])
    driveTo(day, PLACE_XZ.outcrop.x, PLACE_XZ.outcrop.z)
    expect(day.nearPlace()).toBe('outcrop')
    expect(day.available().map((a) => a.id)).toContain('make-flake')
    day.tick(DT, { forward: 0, turn: 0, act: true })
    expect(s.act?.kind).toBe('make')
    waitFor(day, 40 / TIME_SCALE + 0.1)
    expect(s.hands).toEqual(['cobble', 'flake'])
    const walked = driveTo(day, PLACE_XZ.grassland.x, PLACE_XZ.grassland.z)
    expect(walked).toBeLessThan(120)
    expect(s.clock).toBeLessThan(MORNING_SECONDS)
    // Wait for midday and the window.
    waitFor(day, (MORNING_SECONDS + 5 - s.clock) / TIME_SCALE)
    expect(s.phase === 'midday' || s.ate).toBe(true)
    waitFor(day, 1)
    expect(s.ate).toBe(true)
    waitFor(day, (WINDOW_SECONDS + 15) / TIME_SCALE)
    expect(s.phase).toBe('done')
    expect(s.log.some((l) => /ate$/.test(l))).toBe(true)
  })

  it('the body cannot hold a third item without putting one down, and cannot make a flake away from the outcrop', () => {
    const day = new StudentDay('dry', makeRng(3), obstacles(makeRng(2)))
    driveTo(day, PLACE_XZ.riverbank.x, PLACE_XZ.riverbank.z)
    expect(day.available().map((a) => a.id)).not.toContain('make-flake')
    day.available().find((a) => a.id === 'pickUp-cobble')!.run()
    waitFor(day, 5)
    driveTo(day, PLACE_XZ.woodland.x, PLACE_XZ.woodland.z)
    day.available().find((a) => a.id === 'pickUp-sapling')!.run()
    waitFor(day, 5)
    expect(day.state.hands).toEqual(['cobble', 'sapling'])
    expect(day.available().map((a) => a.id)).toContain('make-probe')
    expect(day.available().map((a) => a.id)).not.toContain('make-diggingStick')
    const pick = day.available().find((a) => a.id === 'pickUp-sapling')!
    expect(pick.label).toMatch(/putting down the cobble/)
  })

  it('obstacles stop the body: walking into the camp’s trees leaves the body outside their footprints', () => {
    const obs = obstacles(makeRng(2))
    const day = new StudentDay('vultures', makeRng(4), obs)
    const tree = obs[0]
    driveTo(day, tree.x, tree.z, 20)
    expect(Math.hypot(day.body.x - tree.x, day.body.y - tree.z)).toBeGreaterThanOrEqual(tree.r + day.body.loco.radius - 1e-6)
  })

  it('a programmed hominin’s position replays from its segments', () => {
    let s: Standing = { place: 'camp', hands: [], elapsed: 0 }
    const segments: Segment[] = []
    for (const e of chainFor('marrow')) {
      const r = execute(s, e)
      segments.push(...r.segments)
      s = r.standing
    }
    expect(positionAt(segments, 0)).toMatchObject({ x: 0, z: 0, moving: true })
    const end = positionAt(segments, 1000)
    expect(end).toMatchObject({ x: PLACE_XZ.oldKill.x, z: PLACE_XZ.oldKill.z, moving: false })
  })
})
