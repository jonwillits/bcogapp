import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ProgressStore } from '../../../sim/social/progress/store'
import type { RawStorage } from '../../../sim/social/progress/storage'
import { ANIMALS, ANIMAL_IDS } from '../../../sim/social/arena/animals'
import { arena, ArenaStore } from '../PartArena'
import { STEPS, type Step } from './steps'

/**
 * Part 4 (spec §13 item 1, §16): no animal's rule before the diagnosis is
 * committed; T8 is not reachable before Step 3; every step opens on an
 * instruction screen and asks its prediction first; the table shows only
 * tests run; the letters are dealt by the seed.
 */

function memoryStorage(): RawStorage {
  let text: string | null = null
  return { read: () => text, write: (t) => ((text = t), true) }
}

function fresh(seed = 5) {
  const progress = new ProgressStore(memoryStorage(), seed)
  const store = new ArenaStore(seed, progress)
  const ctx = { seed, progress, store, anim: undefined as never, clock: () => 0, header: null, openTab: () => {} } as never
  return { store, progress, ctx }
}
const Stage = arena.Stage as unknown as (p: { ctx: never }) => React.ReactElement
const Left = arena.Left as unknown as (p: { ctx: never }) => React.ReactElement
const Right = arena.Right as unknown as (p: { ctx: never }) => React.ReactElement
const all = (ctx: never) => renderToStaticMarkup(<Stage ctx={ctx} />) + renderToStaticMarkup(<Left ctx={ctx} />) + renderToStaticMarkup(<Right ctx={ctx} />)
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;|&quot;/g, "'").replace(/\s+/g, ' ')

function commitAll(store: ArenaStore, step: Step) {
  for (const p of STEPS[step - 1].predictions) store.choose(p.key, p.choices[0])
  store.commitPredictions()
}

const LABELS = /Barriers|Gaze|Line of sight now|Line of sight before|Learner/

describe('commit, then reveal', () => {
  it('before the diagnosis no animal is tied to a rule: the rules are listed without letters, and the labels appear nowhere', () => {
    const { store, ctx } = fresh()
    store.open(2)
    store.begin()
    commitAll(store, 2)
    store.run('T3', 'gaze')
    store.skipToResult()
    const m = all(ctx)
    expect(m).not.toMatch(/data-reveal/)
    expect(text(m)).not.toMatch(LABELS)
    for (const r of ANIMALS) expect(text(m)).toContain(r.rule.slice(0, 30))
    expect(m).toMatch(/data-lines="my-table"/)
    expect(text(m)).toMatch(/T3/)
    expect(text(m)).not.toMatch(/\bT8\b/)
    for (const a of ANIMAL_IDS) store.diagnose(a, 'gaze')
    store.commitDiagnosis()
    expect(store.diagnosed).toBe(true)
    store.open(3)
    store.begin()
    commitAll(store, 3)
    const after = all(ctx)
    expect(after).toMatch(/data-reveal/)
    expect(text(after)).toMatch(LABELS)
    expect(text(after)).toContain('Diagnoses right')
  })
  it('T8 is in the menu only in Step 3, and a run of it before then is refused', () => {
    const { store } = fresh()
    store.open(2)
    store.begin()
    commitAll(store, 2)
    expect(store.tests.map((t) => t.id)).not.toContain('T8')
    expect(store.run('T8', 'learner')).toBeNull()
    store.open(3)
    expect(store.tests.map((t) => t.id)).toContain('T8')
  })
  it('every step opens on an instruction screen and asks its prediction before anything runs', () => {
    const { store, ctx } = fresh()
    for (const st of STEPS) {
      store.open(st.step)
      const m = renderToStaticMarkup(<Stage ctx={ctx} />)
      expect(m).toMatch(/data-instruction/)
      expect(m).toContain(st.title)
      store.begin()
      expect(store.state).toBe('predict')
      expect(renderToStaticMarkup(<Stage ctx={ctx} />)).toMatch(/data-stage="predict"/)
      commitAll(store, st.step)
      expect(store.state).toBe('running')
    }
  })
})

describe('runs and the table', () => {
  it('a run is 10 trials, counted, and the table shows only tests run with the mean over runs of a pair', () => {
    const { store } = fresh(7)
    store.open(2)
    store.begin()
    commitAll(store, 2)
    const r = store.run('T1', 'barriers')!
    expect(r.trials.length).toBe(10)
    expect(store.runsUsed).toBe(1)
    store.run('T1', 'barriers')
    const t = store.table()
    expect(t.barriers.T1.runs).toBe(2)
    expect(store.testsRun()).toEqual(['T1'])
    expect(t.gaze.T1).toBeUndefined()
  })
  it('the letters A to E are dealt by the seed, and the same seed deals the same', () => {
    expect(Object.values(new ArenaStore(1, new ProgressStore(memoryStorage(), 1)).letters).sort()).toEqual(['A', 'B', 'C', 'D', 'E'])
    expect(new ArenaStore(3, new ProgressStore(memoryStorage(), 3)).letters).toEqual(new ArenaStore(3, new ProgressStore(memoryStorage(), 3)).letters)
  })
  it('the trials play out on a timer and Skip ahead ends them', async () => {
    const { store } = fresh(8)
    store.open(1)
    store.begin()
    commitAll(store, 1)
    store.runAll('T1')
    expect(store.playing).not.toBeNull()
    expect(store.runs.length).toBe(5)
    await new Promise((r) => setTimeout(r, 120))
    expect(store.playing!.clock).toBeGreaterThan(0)
    store.skipToResult()
    expect(store.playing).toBeNull()
    expect(store.trialOnView!.run.trials.length).toBe(10)
  })
})
