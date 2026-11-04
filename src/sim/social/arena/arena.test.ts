import { describe, it, expect } from 'vitest'
import { makeRng } from '../../random'
import { DOORS, POSITIONS, barrierSegment, hidingSide, inLineOfSight, segmentsCross, type Barrier } from './geometry'
import { TESTS, stageTrial, subordinateSeesBoth, testById } from './trial'
import { ANIMAL_IDS, ANIMALS, lettersFor, preference, runTest } from './animals'
import { featuresOf, FEATURE_NAMES, N_FEATURES } from './features'
import { isNewLayout, variantOf } from './experience'
import { animalsByTests, separated } from './matrix'

/**
 * Part 4 (spec §8, §16): line of sight by fixtures for every barrier
 * position, door and kind; the dominant's rule and facing; the five rules;
 * the learner's features from the observable record; the animals × tests
 * matrix over twenty seeds with T1 identical across animals, T1–T7
 * separating the first four, and T8 the only test that separates the
 * learner from Line of sight before; and the learner on T8 under both
 * experiences.
 */

describe('line of sight (§8.1)', () => {
  it('an opaque barrier on the side facing a door hides the position from that door, for every position and door; a clear one never does; the other sides do not', () => {
    for (const door of Object.keys(DOORS) as (keyof typeof DOORS)[]) {
      for (let p = 0; p < 9; p++) {
        const side = hidingSide(p, door)
        expect(inLineOfSight(DOORS[door], POSITIONS[p], [{ position: p, side, kind: 'opaque' }]), `${door} ${p} ${side}`).toBe(false)
        expect(inLineOfSight(DOORS[door], POSITIONS[p], [{ position: p, side, kind: 'clear' }])).toBe(true)
        expect(inLineOfSight(DOORS[door], POSITIONS[p], [])).toBe(true)
      }
    }
    // The east door and the east side, for every position; the top door and the north side where the piece is under it, and a side toward the door elsewhere (a barrier is short, and hides only from doors within about 45° of its side).
    for (let p = 0; p < 9; p++) expect(hidingSide(p, 'east')).toBe('E')
    expect(hidingSide(1, 'top')).toBe('N')
    expect(hidingSide(4, 'top')).toBe('N')
    expect(hidingSide(7, 'top')).toBe('N')
    expect(hidingSide(1, 'bottom')).toBe('S')
  })
  it('a barrier that hides a piece from the east door leaves it in the subordinate’s sight, in every test', () => {
    for (const t of TESTS) {
      const { view } = stageTrial(t, makeRng(1))
      expect(subordinateSeesBoth(view), t.id).toBe(true)
    }
  })
  it('segments cross or do not', () => {
    expect(segmentsCross({ a: { x: 0, y: 0 }, b: { x: 2, y: 2 } }, { a: { x: 0, y: 2 }, b: { x: 2, y: 0 } })).toBe(true)
    expect(segmentsCross({ a: { x: 0, y: 0 }, b: { x: 1, y: 1 } }, { a: { x: 2, y: 2 }, b: { x: 3, y: 3 } })).toBe(false)
    const b: Barrier = { position: 4, side: 'E', kind: 'opaque' }
    expect(barrierSegment(b).a.x).toBeCloseTo(5.6)
  })
})

describe('the dominant (§8.2)', () => {
  it('goes to the open piece in T1, faces it, and takes it from a subordinate that goes there', () => {
    const { view, dominant } = stageTrial(testById('T1'), makeRng(2))
    expect(dominant).toBe(1)
    expect(view.facing).toBe(1)
    expect(view.record[0].placedDoor).toBe('shut')
  })
  it('with its door shut (T3) it cannot be seen facing, and at release it goes to the open piece', () => {
    const { view, dominant } = stageTrial(testById('T3'), makeRng(2))
    expect(view.facing).toBeNull()
    expect(dominant).toBe(1)
  })
  it('goes where it last saw a piece placed (T4), to a piece’s old place after a move it missed (T5), and the new dominant to the piece it watched (T6)', () => {
    expect(stageTrial(testById('T4'), makeRng(3)).dominant).toBe(0)
    const t5 = stageTrial(testById('T5'), makeRng(3))
    expect(t5.dominant).toBe(1) // the unmoved piece was placed last
    expect(t5.view.pieces[0].position).toBe(3)
    const t6 = stageTrial(testById('T6'), makeRng(3))
    expect(t6.dominant).toBe(1)
    expect(t6.view.record[0].presentAtPlacement).toBe(false)
    expect(t6.view.record[1].presentAtPlacement).toBe(true)
  })
  it('in T2 both pieces are in sight and equidistant, so it goes to either; in T8 it comes by the top door and takes the open piece', () => {
    const picks = new Set<number>()
    for (let s = 0; s < 20; s++) picks.add(stageTrial(testById('T2'), makeRng(10 + s)).dominant)
    expect(picks).toEqual(new Set([0, 1]))
    expect(stageTrial(testById('T8'), makeRng(4)).dominant).toBe(1)
    expect(testById('T8').door).toBe('top')
  })
})

describe('the five rules (§8.4)', () => {
  const view = (id: string, seed = 5) => stageTrial(testById(id), makeRng(seed)).view
  it('Barriers prefers the barrier piece in T1 and T2, and has no preference when both have one', () => {
    expect(preference('barriers', view('T1'), null)).toBe(0)
    expect(preference('barriers', view('T2'), null)).toBe(0)
    expect(preference('barriers', view('T4'), null)).toBeNull()
  })
  it('Gaze goes away from where the dominant faces, and has no preference with the door shut', () => {
    expect(preference('gaze', view('T1'), null)).toBe(0)
    expect(preference('gaze', view('T3'), null)).toBeNull()
    expect(preference('gaze', view('T4'), null)).toBe(1)
  })
  it('Line of sight now takes the hidden piece even with the door shut, and has no preference with both hidden', () => {
    expect(preference('losNow', view('T3'), null)).toBe(0)
    expect(preference('losNow', view('T4'), null)).toBeNull()
    expect(preference('losNow', view('T2'), null)).toBeNull()
  })
  it('Line of sight before takes the piece the present dominant did not watch, else the one out of sight', () => {
    expect(preference('losBefore', view('T4'), null)).toBe(1)
    expect(preference('losBefore', view('T5'), null)).toBe(0)
    expect(preference('losBefore', view('T6'), null)).toBe(0)
    expect(preference('losBefore', view('T3'), null)).toBe(0)
  })
  it('an animal follows its rule on about 85% of trials and the letters are dealt by the seed', () => {
    const r = runTest('losNow', testById('T1'), null, 7, 2000)
    expect(r.share).toBeGreaterThan(0.82)
    expect(r.share).toBeLessThan(0.88)
    const a = lettersFor(1)
    const b = lettersFor(2)
    expect(new Set(Object.values(a))).toEqual(new Set(['A', 'B', 'C', 'D', 'E']))
    expect(Object.values(a).join('') !== Object.values(b).join('') || Object.values(lettersFor(3)).join('') !== Object.values(a).join('')).toBe(true)
    expect(ANIMALS.map((x) => x.rule).every((s) => !/knows|wants|thinks|believes|decides/.test(s))).toBe(true)
  })
})

describe('the learner (§8.5)', () => {
  it('its features are the observable record: one-hot position, barrier sides and kinds, the door, door states at placement and move, the swap, the head start', () => {
    expect(FEATURE_NAMES.length).toBe(N_FEATURES)
    const { view } = stageTrial(testById('T4'), makeRng(1))
    const x1 = featuresOf(view, 1)
    expect(x1[FEATURE_NAMES.indexOf('placed with the dominant’s door shut')]).toBe(1)
    expect(x1[FEATURE_NAMES.indexOf('opaque barrier on its E side')]).toBe(1)
    expect(x1[FEATURE_NAMES.indexOf('the dominant’s door is east')]).toBe(1)
    expect(x1.every((v) => v === 0 || v === 1)).toBe(true)
    expect(FEATURE_NAMES.some((n) => /sight|see|facing/i.test(n))).toBe(false)
  })
  it('the usual-room history uses the usual door and the familiar tests; many rooms use every door and never T8’s exact layout', () => {
    const rng = makeRng(1)
    for (let i = 0; i < 200; i++) {
      const v = variantOf(TESTS[i % 7], 'top', rng)
      expect(v.door).toBe('top')
      expect(v.pieces[0].position).not.toBe(v.pieces[1].position)
    }
    expect(isNewLayout(testById('T8'))).toBe(true)
    expect(isNewLayout(testById('T1'))).toBe(false)
  })
  it('with the usual room it matches Line of sight before on T1–T7 and sits at chance on T8; with many rooms, one layer, it passes T8 too (twenty seeds; the bands follow the measured matrix in the as-built notes)', () => {
    const usual = animalsByTests(20, 'usual', 0)
    for (const t of TESTS.filter((x) => !x.heldOut)) expect(Math.abs(usual.mean.learner[t.id] - usual.mean.losBefore[t.id]), `usual ${t.id}`).toBeLessThan(0.25)
    expect(usual.mean.learner.T8).toBeLessThan(0.62)
    expect(usual.mean.learner.T8).toBeGreaterThan(0.38)
    expect(usual.mean.losBefore.T8).toBeGreaterThan(0.75)
    const many = animalsByTests(20, 'many', 0)
    expect(many.mean.learner.T8).toBeGreaterThan(0.7)
    for (const t of ['T1', 'T3', 'T5', 'T6', 'T7']) expect(many.mean.learner[t]).toBeGreaterThan(0.7)
  }, 600000)
})

describe('the animals × tests matrix (§8.4, §16)', () => {
  it('over twenty seeds: T1 cannot tell any two animals apart, T1–T7 separate the first four, and only T8 separates the learner from Line of sight before', () => {
    const m = animalsByTests(20, 'usual', 0)
    for (const a of ANIMAL_IDS) for (const b of ANIMAL_IDS) expect(Math.abs(m.mean[a].T1 - m.mean[b].T1), `${a} ${b} on T1`).toBeLessThan(0.12)
    const first = ['barriers', 'gaze', 'losNow', 'losBefore'] as const
    const familiar = TESTS.filter((t) => !t.heldOut).map((t) => t.id)
    for (let i = 0; i < first.length; i++) for (let j = i + 1; j < first.length; j++) expect(separated(m, first[i], first[j], familiar, 0.28), `${first[i]} vs ${first[j]}`).not.toBeNull()
    expect(separated(m, 'learner', 'losBefore', familiar, 0.25)).toBeNull()
    expect(separated(m, 'learner', 'losBefore', ['T8'], 0.25)).toBe('T8')
    // Each animal's separating test is where it comes apart from the rest.
    expect(Math.abs(m.mean.barriers.T2 - m.mean.losNow.T2)).toBeGreaterThan(0.25)
    expect(Math.abs(m.mean.gaze.T3 - m.mean.losBefore.T3)).toBeGreaterThan(0.25)
    expect(Math.abs(m.mean.losNow.T4 - m.mean.losBefore.T4)).toBeGreaterThan(0.25)
  }, 600000)
})
