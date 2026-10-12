import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { makeRng } from '../random'
import { CONDITIONS, LEARNED_VIEWS, TEST_VIEWS, TEST_VIEWS_BY_COUNT, WOBBLE_FRAMES, allViews, bothSetTrials, distanceFromLearned, viewTrials } from './views'
import { VIEWS_PER_CONDITION } from './config'

/**
 * The matched-distance design is the point of Part 3 (spec §6.3, §11): the
 * three conditions have the same distribution of distances from the
 * nearest learned view. And every view the scene can ask for was rendered
 * and shipped.
 */
const manifest = JSON.parse(readFileSync(join(__dirname, '..', '..', '..', 'public', 'm08', 'scanned', 'manifest.json'), 'utf-8')) as { views: { id: string }[]; objects: { id: string; set: string }[] }
const rendered = new Set(manifest.views.map((v) => v.id))

describe('the three conditions are matched for distance from the nearest learned view', () => {
  it('each condition has the same number of views, and the sorted distances are identical across conditions, at both counts', () => {
    for (const n of [3, 4] as const) {
      const dist = CONDITIONS.map((c) => TEST_VIEWS_BY_COUNT[n][c].map(distanceFromLearned).sort((a, b) => a - b))
      for (const d of dist) expect(d.length).toBe(n)
      expect(dist[1]).toEqual(dist[0])
      expect(dist[2]).toEqual(dist[0])
      expect(dist[0]).toEqual(n === 4 ? [15, 15, 30, 30] : [15, 30, 30])
    }
    expect(TEST_VIEWS).toBe(TEST_VIEWS_BY_COUNT[VIEWS_PER_CONDITION])
  })

  it('no test view is a learned view, and between-views lie between the learned headings', () => {
    for (const c of CONDITIONS) for (const v of TEST_VIEWS[c]) expect(LEARNED_VIEWS).not.toContain(v.id)
    for (const v of TEST_VIEWS.between) { expect(v.heading).toBeGreaterThan(0); expect(v.heading).toBeLessThan(75) }
    for (const v of TEST_VIEWS.beyond) expect(v.heading > 75 || v.heading < 0 || v.heading > 180).toBe(true)
    for (const v of TEST_VIEWS['right-angles']) { expect(v.heading).toBe(0); expect(v.pitch).not.toBe(0) }
  })
})

describe('every view the scene asks for was shipped', () => {
  it('learned views, wobble frames, test views and the full curve', () => {
    for (const v of LEARNED_VIEWS) expect(rendered.has(v), v).toBe(true)
    for (const frames of Object.values(WOBBLE_FRAMES)) for (const f of frames) expect(rendered.has(f), f).toBe(true)
    for (const c of CONDITIONS) for (const v of TEST_VIEWS[c]) expect(rendered.has(v.id), v.id).toBe(true)
    const all = allViews()
    expect(all.vertical.length).toBe(24)
    expect(all.horizontal.length).toBe(24)
    for (const v of [...all.vertical, ...all.horizontal]) expect(rendered.has(v.id), v.id).toBe(true)
  })

  it('eight shoes and eight other things', () => {
    expect(manifest.objects.filter((o) => o.set === 'shoe').length).toBe(8)
    expect(manifest.objects.filter((o) => o.set === 'other').length).toBe(8)
  })
})

describe('the trial list', () => {
  const shoes = manifest.objects.filter((o) => o.set === 'shoe').map((o) => o.id)
  it('is 6 × views-per-condition trials, half target and half not in every condition, each test view used once for the target', () => {
    const t = viewTrials(shoes[0], shoes.slice(1), makeRng(5))
    expect(t.length).toBe(6 * VIEWS_PER_CONDITION)
    for (const c of CONDITIONS) {
      const here = t.filter((x) => x.condition === c)
      expect(here.length).toBe(2 * VIEWS_PER_CONDITION)
      expect(here.filter((x) => x.target).length).toBe(VIEWS_PER_CONDITION)
      expect(new Set(here.filter((x) => x.target).map((x) => x.view.id)).size).toBe(VIEWS_PER_CONDITION)
      for (const x of here.filter((y) => !y.target)) expect(x.object).not.toBe(shoes[0])
    }
  })
  it('is fixed by the seed', () => {
    expect(viewTrials(shoes[0], shoes.slice(1), makeRng(5))).toEqual(viewTrials(shoes[0], shoes.slice(1), makeRng(5)))
    expect(viewTrials(shoes[0], shoes.slice(1), makeRng(6))).not.toEqual(viewTrials(shoes[0], shoes.slice(1), makeRng(5)))
  })
})

describe('both sets in one run', () => {
  const shoes = manifest.objects.filter((o) => o.set === 'shoe').map((o) => o.id)
  const things = manifest.objects.filter((o) => o.set === 'other').map((o) => o.id)
  it('is 48 trials, 24 per set, each set half target and half not in every condition, and the non-targets of each set come from that set', () => {
    const t = bothSetTrials(shoes[0], shoes.slice(1), things, makeRng(9))
    expect(t.length).toBe(12 * VIEWS_PER_CONDITION)
    for (const set of ['shoes', 'things'] as const) {
      const here = t.filter((x) => x.set === set)
      expect(here.length).toBe(6 * VIEWS_PER_CONDITION)
      for (const c of CONDITIONS) expect(here.filter((x) => x.condition === c && x.target).length).toBe(VIEWS_PER_CONDITION)
      for (const x of here.filter((y) => !y.target)) expect(set === 'shoes' ? shoes : things).toContain(x.object)
    }
    expect(bothSetTrials(shoes[0], shoes.slice(1), things, makeRng(9))).toEqual(t)
  })
})
