import { describe, it, expect } from 'vitest'
import { makeRng } from '../random'
import { StudentDay, obstacles, positionAt, groundAt, needFootprint, TIME_SCALE, EAT_SECONDS, AT_THE_PLACE_LINE } from './studentDay'
import { MORNING_SECONDS, PLACE_XZ, WINDOW_SECONDS } from './range/places'
import { execute, type Segment, type Standing } from './range/acts'
import { chainFor } from './range/chains'

/**
 * Part 3, Step 1 (spec §7.6, §14): the student's hominin walks, picks up,
 * makes and eats under the range's rules; a day driven straight through the
 * carcass chain eats at midday; the obstacles stop the body; the clock runs
 * at TIME_SCALE. Since Jon's walk (2026-11-11): two named hands (J and K),
 * a full hand offers no pick-up, an item put down lies on the ground and
 * can be picked up again, and a flake struck at the outcrop lands on the
 * ground.
 */
const DT = 0.02

/** Steer toward a point until within `within` meters of it (the outcrop's stone keeps the body about 2.7 m from its center). */
function driveTo(day: StudentDay, x: number, z: number, maxSeconds = 120, within = 2): number {
  let t = 0
  while (t < maxSeconds) {
    const dx = x - day.body.x
    const dz = z - day.body.y
    const d = Math.hypot(dx, dz)
    if (d < within) return t
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
    expect(acts.map((a) => a.id)).toEqual(['pickUp-cobble@0', 'pickUp-cobble@1'])
    expect(acts[0].label).toBe('Left hand (J): pick up a cobble')
    // Enter makes; it picks nothing up.
    day.tick(DT, { forward: 0, turn: 0, act: true })
    expect(s.act).toBeNull()
    waitFor(day, 0.6)
    day.tick(DT, { forward: 0, turn: 0, act: false, left: true })
    expect(s.act?.kind).toBe('pickUp')
    waitFor(day, 10 / TIME_SCALE + 0.1)
    expect(s.slots).toEqual(['cobble', null])
    expect(s.hands).toEqual(['cobble'])
    const toOutcrop = driveTo(day, PLACE_XZ.outcrop.x, PLACE_XZ.outcrop.z, 120, 4)
    expect(toOutcrop).toBeLessThan(60)
    expect(day.nearPlace()).toBe('outcrop')
    // The stone has a footprint: the body stands off the center.
    expect(Math.hypot(day.body.x - PLACE_XZ.outcrop.x, day.body.y - PLACE_XZ.outcrop.z)).toBeGreaterThan(2.6)
    expect(day.available().map((a) => a.id)).toContain('make-flake')
    expect(day.available().find((a) => a.id === 'make-flake')!.label).toMatch(/^Enter: make a flake/)
    day.tick(DT, { forward: 0, turn: 0, act: true })
    expect(s.act?.kind).toBe('make')
    waitFor(day, 40 / TIME_SCALE + 0.1)
    // The flake lies on the ground in front of the hominin; the right hand picks it up.
    expect(s.hands).toEqual(['cobble'])
    expect(s.ground.map((g) => g.item)).toEqual(['flake'])
    expect(day.nearGround()?.item).toBe('flake')
    const pick = day.available().find((a) => a.id === 'pickUp-flake@1')!
    expect(pick.label).toBe('Right hand (K): pick up the flake')
    pick.run()
    waitFor(day, 10 / TIME_SCALE + 0.1)
    expect(s.slots).toEqual(['cobble', 'flake'])
    expect(s.ground).toEqual([])
    const walked = driveTo(day, PLACE_XZ.grassland.x, PLACE_XZ.grassland.z)
    expect(walked).toBeLessThan(120)
    expect(s.clock).toBeLessThan(MORNING_SECONDS)
    // Before midday nothing at the grassland is offered on Enter.
    expect(day.available().find((a) => a.id === 'eat')).toBeUndefined()
    // Wait for midday and the window: arrival is not a meal (Jon, 2026-11-11); the act at the place is.
    waitFor(day, (MORNING_SECONDS + 5 - s.clock) / TIME_SCALE)
    expect(s.phase).toBe('midday')
    expect(s.ate).toBe(false)
    expect(s.message).toBe(AT_THE_PLACE_LINE)
    const eat = day.available().find((a) => a.id === 'eat')!
    expect(eat.label).toBe('Enter: cut meat from the carcass with the flake')
    expect(eat.key).toBe('Enter')
    day.tick(DT, { forward: 0, turn: 0, act: true })
    expect(s.act?.kind).toBe('eat')
    expect(s.message).toBe('Cutting meat from the carcass.')
    waitFor(day, EAT_SECONDS / TIME_SCALE + 0.1)
    expect(s.ate).toBe(true)
    expect(s.message).toBe('You ate. The day is a success.')
    expect(s.hands).toEqual(['cobble', 'flake'])
    expect(day.available().find((a) => a.id === 'eat')).toBeUndefined()
    waitFor(day, (WINDOW_SECONDS + 15) / TIME_SCALE)
    expect(s.phase).toBe('done')
    expect(s.log.some((l) => /: ate; cut meat from the carcass$/.test(l))).toBe(true)
  })

  it('standing at the place holding what the need requires is not a meal; the window closing cancels the act at the place and nothing is eaten', () => {
    const day = new StudentDay('hyenas', makeRng(3), obstacles(makeRng(2)))
    const s = day.state
    driveTo(day, PLACE_XZ.riverbank.x, PLACE_XZ.riverbank.z)
    day.available().find((a) => a.id === 'pickUp-cobble@0')!.run()
    waitFor(day, 10 / TIME_SCALE + 0.1)
    driveTo(day, PLACE_XZ.oldKill.x, PLACE_XZ.oldKill.z)
    waitFor(day, (MORNING_SECONDS + WINDOW_SECONDS - 10 - s.clock) / TIME_SCALE)
    expect(s.phase).toBe('midday')
    expect(s.ate).toBe(false)
    expect(day.available().find((a) => a.id === 'eat')!.label).toBe('Enter: break a bone with the cobble for its marrow')
    // Started with 10 range seconds left, the 15-second act is cut off by the window.
    day.make()
    expect(s.act?.kind).toBe('eat')
    waitFor(day, 12 / TIME_SCALE)
    expect(s.phase).toBe('afternoon')
    expect(s.act).toBeNull()
    expect(s.ate).toBe(false)
    expect(s.message).toBe('The window closed. Nothing was eaten today.')
  })

  it('hold() draws a still body: the pose before the step is the pose itself', () => {
    const day = new StudentDay('vultures', makeRng(1), obstacles(makeRng(2)))
    day.tick(DT, { forward: 1, turn: 0, act: false })
    expect(day.renderPose(0)).not.toEqual(day.renderPose(1))
    day.hold()
    expect(day.renderPose(0)).toEqual(day.renderPose(1))
  })

  it('a full hand offers no pick-up, only a put-down; an item put down lies where it was dropped and can be picked up again; no flake away from the outcrop', () => {
    const day = new StudentDay('dry', makeRng(3), obstacles(makeRng(2)))
    const s = day.state
    driveTo(day, PLACE_XZ.riverbank.x, PLACE_XZ.riverbank.z)
    expect(day.available().map((a) => a.id)).not.toContain('make-flake')
    day.available().find((a) => a.id === 'pickUp-cobble@0')!.run()
    waitFor(day, 5)
    driveTo(day, PLACE_XZ.woodland.x, PLACE_XZ.woodland.z)
    day.available().find((a) => a.id === 'pickUp-sapling@1')!.run()
    waitFor(day, 5)
    expect(s.slots).toEqual(['cobble', 'sapling'])
    const ids = day.available().map((a) => a.id)
    expect(ids).toContain('make-probe')
    expect(ids).not.toContain('make-diggingStick')
    expect(ids.filter((i) => i.startsWith('pickUp'))).toEqual([])
    expect(ids).toEqual(expect.arrayContaining(['putDown-cobble@0', 'putDown-sapling@1']))
    // Put the cobble down: it lies in front of the hominin, within reach, and the left hand can take it back.
    day.tick(DT, { forward: 0, turn: 0, act: false, left: true })
    expect(s.act?.kind).toBe('putDown')
    waitFor(day, 3 / TIME_SCALE + 0.1)
    expect(s.slots).toEqual([null, 'sapling'])
    expect(s.ground.map((g) => g.item)).toEqual(['cobble'])
    const g = s.ground[0]
    expect(Math.hypot(g.x - day.body.x, g.z - day.body.y)).toBeLessThan(1.5)
    expect(day.nearGround()?.id).toBe(g.id)
    const back = day.available().find((a) => a.id === 'pickUp-cobble@0')!
    expect(back.label).toBe('Left hand (J): pick up the cobble')
    back.run()
    waitFor(day, 10 / TIME_SCALE + 0.1)
    expect(s.slots).toEqual(['cobble', 'sapling'])
    expect(s.ground).toEqual([])
    expect(s.log.some((l) => /put down the cobble/.test(l))).toBe(true)
    // Enter strips the sapling into a probe, in the hand that held it.
    day.tick(DT, { forward: 0, turn: 0, act: true })
    expect(s.act?.kind).toBe('make')
    waitFor(day, 20 / TIME_SCALE + 0.1)
    expect(s.slots).toEqual(['cobble', 'probe'])
  })

  it('an item put down far from any place stays there: a cobble left near the grassland is found again', () => {
    const day = new StudentDay('vultures', makeRng(5), obstacles(makeRng(2)))
    const s = day.state
    driveTo(day, PLACE_XZ.riverbank.x, PLACE_XZ.riverbank.z)
    day.available().find((a) => a.id === 'pickUp-cobble@0')!.run()
    waitFor(day, 5)
    driveTo(day, PLACE_XZ.grassland.x + 12, PLACE_XZ.grassland.z)
    expect(day.nearPlace()).toBeNull()
    day.available().find((a) => a.id === 'putDown-cobble@0')!.run()
    waitFor(day, 2)
    expect(s.slots).toEqual([null, null])
    const g = s.ground[0]
    driveTo(day, PLACE_XZ.grassland.x, PLACE_XZ.grassland.z)
    expect(day.nearGround()).toBeNull()
    expect(day.available()).toEqual([])
    driveTo(day, g.x, g.z)
    expect(day.nearGround()?.id).toBe(g.id)
    expect(day.available().map((a) => a.id)).toEqual(['pickUp-cobble@0', 'pickUp-cobble@1'])
  })

  it('the outcrop’s stone, the mound and the carcass have footprints; a programmed hominin’s put-downs lie at the place', () => {
    const obs = obstacles(makeRng(2))
    expect(obs.filter((o) => o.kind === 'stone').length).toBe(3)
    expect(needFootprint('carcass')).toMatchObject({ ax: PLACE_XZ.grassland.x, ay: PLACE_XZ.grassland.z })
    expect(needFootprint('termites')).toBeNull()
    let st: Standing = { place: 'camp', hands: [], elapsed: 0 }
    const segments: Segment[] = []
    for (const e of chainFor('tubers')) {
      const r = execute(st, e)
      segments.push(...r.segments)
      st = r.standing
    }
    const put = segments.find((x) => x.kind === 'putDown')!
    expect(put).toBeTruthy()
    expect(groundAt(segments, put.t1 - 1, 0)).toEqual([])
    const after = groundAt(segments, put.t1, 0)
    expect(after.length).toBe(1)
    expect(Math.hypot(after[0].x - PLACE_XZ[put.place].x, after[0].z - PLACE_XZ[put.place].z)).toBeLessThan(3)
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
