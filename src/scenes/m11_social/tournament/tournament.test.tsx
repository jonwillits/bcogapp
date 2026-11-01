import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ProgressStore } from '../../../sim/social/progress/store'
import type { RawStorage } from '../../../sim/social/progress/storage'
import { chipsOf, ruleById } from '../../../sim/social/game/rules'
import { tournament, TournamentStore } from '../PartTournament'
import { STEPS, type Step } from './steps'
import { parseChips, serializeChips } from './store'

/**
 * Part 2 (spec §6, §13 item 1, §16): every step opens on an instruction
 * screen; no result before each step's prediction; any step can be opened
 * and a finished one reopens to its result; the rule builder reproduces
 * the six rules and names the match, and the rule is saved; the cost
 * changes only Predictor's points; the grid runs 20 generations a second.
 */

function memoryStorage(): RawStorage {
  let text: string | null = null
  return { read: () => text, write: (t) => ((text = t), true) }
}

function fresh(seed = 5) {
  const progress = new ProgressStore(memoryStorage(), seed)
  progress.skipPart1()
  const store = new TournamentStore(seed, progress)
  const ctx = { seed, progress, store, anim: undefined as never, clock: () => 0, header: null, openTab: () => {} } as never
  return { store, progress, ctx }
}

const Stage = tournament.Stage as unknown as (p: { ctx: never }) => React.ReactElement
const Left = tournament.Left as unknown as (p: { ctx: never }) => React.ReactElement
const stage = (ctx: never) => renderToStaticMarkup(<Stage ctx={ctx} />)
const left = (ctx: never) => renderToStaticMarkup(<Left ctx={ctx} />)

function commitAll(store: TournamentStore, step: Step) {
  for (const p of STEPS[step - 1].predictions) store.choose(p.key, p.choices[0])
  store.commitPredictions()
}

describe('every step opens on an instruction screen and asks its predictions before anything runs', () => {
  it('each of the seven steps renders an instruction screen with the reread line; after Begin the stage shows no result until the commit', () => {
    const { store, ctx } = fresh()
    for (const st of STEPS) {
      store.open(st.step)
      const m = stage(ctx)
      expect(m).toMatch(/data-instruction/)
      expect(m).toContain(st.title)
      expect(m).toContain('Reread §')
      store.begin()
      expect(store.state).toBe('predict')
      const p = stage(ctx)
      expect(p).toMatch(/data-stage="predict"/)
      expect(p).not.toMatch(/data-panel/)
      expect(left(ctx)).toContain('Commit my prediction')
      commitAll(store, st.step)
      expect(store.state).toBe('running')
      expect(stage(ctx)).toMatch(new RegExp(`data-stage="step-${st.step}"`))
    }
  })
  it('a finished step reopens to its result, Redo returns it to its instruction screen, and committed predictions stay committed', () => {
    const { store, ctx } = fresh()
    store.open(1)
    store.begin()
    commitAll(store, 1)
    store.finish()
    expect(store.state).toBe('done')
    store.open(2)
    store.open(1)
    expect(store.state).toBe('done')
    expect(stage(ctx)).toMatch(/data-panel="two-rules"/)
    store.redo()
    expect(store.state).toBe('intro')
    store.begin()
    expect(store.state).toBe('running')
    expect(store.prediction('p2-s1-one')).toBe('Always defect')
  })
})

describe('the panels', () => {
  it('Two Rules shows the four runs with the engine’s numbers at the chosen R', () => {
    const { store, ctx } = fresh()
    store.open(1)
    store.begin()
    commitAll(store, 1)
    store.setRounds(10)
    const m = stage(ctx)
    expect(m).toMatch(/data-lines="run1"/)
    expect(m).toContain('14 points')
    expect(m).toContain('39.00')
    expect(m).toContain('0.0588')
  })
  it('the rule builder reproduces each of the six rules, names the match, and saves the chips', () => {
    const { store, progress } = fresh()
    for (const r of ruleById('tft') ? [ruleById('allc'), ruleById('alld'), ruleById('tft'), ruleById('grim'), ruleById('wsls'), ruleById('stft')] : []) {
      const c = chipsOf(r)
      store.setChip('first', c.first)
      store.setChip('CC', c.CC)
      store.setChip('CD', c.CD)
      store.setChip('DC', c.DC)
      store.setChip('DD', c.DD)
      store.setChip('generosity', 0)
      expect(store.matches()).toBe(r.label)
    }
    expect(progress.setting('p2-rule')).toBe(serializeChips(store.chips))
    const again = new TournamentStore(5, progress)
    expect(again.chips).toEqual(store.chips)
    expect(parseChips('garbage')).toEqual(parseChips(null))
  })
  it('the round-robin table has seven entries with no noise, and tit-for-tat tops this field with a tit-for-tat rule of the student’s', () => {
    const { store, ctx } = fresh()
    store.open(3)
    store.begin()
    commitAll(store, 3)
    store.runRoundRobin()
    expect(store.rr3!.entries.length).toBe(7)
    const m = stage(ctx)
    expect(m).toMatch(/data-panel="rr3"/)
    expect(m).toMatch(/data-lines="rr3-ranking"/)
  })
  it('the cost changes only Predictor’s points, and only in Step 6', async () => {
    const { store } = fresh()
    store.open(6)
    store.begin()
    commitAll(store, 6)
    store.runGenerationsNow()
    for (let i = 0; i < 50 && !store.gen; i++) await new Promise((r) => setTimeout(r, 5))
    expect(store.gen).not.toBeNull()
    const before = store.gen!.noisy.shares[300].slice()
    const pi = store.gen!.noisyRR.entries.length - 1
    store.setCost(0.5)
    const after = store.gen!.noisy.shares[300]
    expect(after[pi]).toBeLessThanOrEqual(before[pi])
    expect(store.rr4!.totals[pi]).toBeGreaterThan(0)
    store.setCost(0)
    expect(store.gen!.noisy.shares[300]).toEqual(before)
  })
  it('the grid starts in the chosen world, steps on its timer, and Skip ahead pays 1,000 generations in slices', async () => {
    const { store } = fresh()
    store.open(7)
    store.begin()
    commitAll(store, 7)
    store.setWorld('alld')
    store.startGrid()
    expect(store.grid!.shares()[1]).toBe(1)
    store.dropBlock(2)
    expect(store.grid!.shares()[2]).toBeCloseTo(4 / 1600)
    const t0 = performance.now()
    store.skipAhead()
    for (let i = 0; i < 400 && store.skipping > 0; i++) await new Promise((r) => setTimeout(r, 25))
    expect(store.skipping).toBe(0)
    expect(store.grid!.generation).toBe(1000)
    expect(performance.now() - t0).toBeLessThan(60000)
  }, 90000)
})
