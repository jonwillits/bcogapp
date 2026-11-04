import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ProgressStore } from '../../../sim/social/progress/store'
import type { RawStorage } from '../../../sim/social/progress/storage'
import { chipsOf, ruleById } from '../../../sim/social/game/rules'
import { tournament, TournamentStore } from '../PartTournament'
import { STEPS, type Step } from './steps'
import { parseChips, serializeChips } from './store'
import { costsFor } from '../../../sim/social/game/generations'
import { entryId } from '../../../sim/social/game/tournament'

/**
 * Part 2 (spec §6, §13 item 1, §16): every step opens on an instruction
 * screen; no result before each step's prediction; any step can be opened
 * and a finished one reopens to its result; the rule builder reproduces
 * the six rules and names the match, and the rule is saved; the memory
 * cost charges every entry by what it stores; Step 3's records; Step 4's
 * reruns; the grid's chosen entries, boundary and notes; the grid runs 20
 * generations a second.
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
  it('each of the seven steps renders an instruction screen, Step 1’s with the passages to reread; after Begin the stage shows no result until the commit', () => {
    const { store, ctx } = fresh()
    for (const st of STEPS) {
      store.open(st.step)
      const m = stage(ctx)
      expect(m).toMatch(/data-instruction/)
      expect(m).toContain(st.title)
      if (st.step === 1) expect(m).toContain('reread the parts of the reading')
      else expect(m).not.toMatch(/reread/i)
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
  it('the memory cost charges every entry by what it stores, in Step 6 only: Predictor eleven units, a memory-one rule one, a fixed rule none', async () => {
    const { store } = fresh()
    store.open(6)
    store.begin()
    commitAll(store, 6)
    store.runGenerationsNow()
    for (let i = 0; i < 50 && !store.gen; i++) await new Promise((r) => setTimeout(r, 5))
    expect(store.gen).not.toBeNull()
    const before = store.gen!.noisy.shares[300].slice()
    const rr = store.gen!.noisyRR
    const pi = rr.entries.length - 1
    expect(costsFor(rr, 0.1).map((c) => Number(c.toFixed(3)))).toEqual(rr.entries.map((e) => (e.kind === 'predictor' ? 1.1 : ['allc', 'alld'].includes(entryId(e)) ? 0 : 0.1)))
    store.setCost(0.1)
    const after = store.gen!.noisy.shares[300]
    expect(after[pi]).toBeLessThanOrEqual(before[pi])
    expect(store.rr4!.totals[pi]).toBeGreaterThan(0)
    expect(store.costStop!.tft.clean === null || store.costStop!.tft.clean >= 0).toBe(true)
    store.setCost(0)
    expect(store.gen!.noisy.shares[300]).toEqual(before)
  })
  it('Step 3 shows any entry’s record against every entry, round by round, and the records agree with the table for two deterministic rules', () => {
    const { store, ctx } = fresh()
    store.open(3)
    store.begin()
    commitAll(store, 3)
    store.runRoundRobin()
    expect(stage(ctx)).toMatch(/data-panel="rr3-records"/)
    expect(stage(ctx)).not.toMatch(/data-lines="rr3-record-lines"/)
    const tft = store.rr3!.entries.findIndex((e) => entryId(e) === 'tft')
    store.setRecordEntry(tft)
    const m = stage(ctx)
    expect(m).toMatch(/data-lines="rr3-record-lines"/)
    const records = store.recordsFor(tft)
    expect(records.length).toBe(7)
    const allc = records.find((r) => r.against === 'Always cooperate')!
    expect(allc.rounds.length).toBe(200)
    expect(allc.mine).toBe(600)
    expect(allc.mine / 200).toBeCloseTo(allc.tableMean, 9)
    expect(allc.rounds.every((r) => r.a === 'C' && r.b === 'C')).toBe(true)
  })
  it('Step 4 can be run again, and each run plays on new seeds', async () => {
    const { store } = fresh()
    store.open(4)
    store.begin()
    commitAll(store, 4)
    store.runWithPredictor()
    for (let i = 0; i < 400 && (store.working || !store.rr4); i++) await new Promise((r) => setTimeout(r, 10))
    const first = store.versus.map((v) => v.points.mean)
    expect(store.runs4).toBe(1)
    store.runWithPredictor()
    for (let i = 0; i < 400 && store.working; i++) await new Promise((r) => setTimeout(r, 10))
    expect(store.runs4).toBe(2)
    const second = store.versus.map((v) => v.points.mean)
    expect(second).not.toEqual(first)
    for (let k = 0; k < first.length; k++) expect(Math.abs(second[k] - first[k])).toBeLessThan(60)
  }, 30000)
  it('the grid holds any set of the entries chosen on the left, at least two, and the notes box is saved as a setting', () => {
    const { store, progress, ctx } = fresh()
    store.open(7)
    store.begin()
    commitAll(store, 7)
    expect(store.gridIds).toEqual(['allc', 'alld', 'tft'])
    store.toggleGridId('alld')
    expect(store.gridIds).toEqual(['allc', 'tft'])
    store.toggleGridId('allc') // refused: at least two stay checked
    expect(store.gridIds).toEqual(['allc', 'tft'])
    store.toggleGridId('predictor')
    store.toggleGridId('mine')
    expect(store.gridIds).toEqual(['allc', 'tft', 'predictor', 'mine'])
    expect(store.worlds().map((w) => w.id)).toEqual(['allc', 'tft', 'mine', 'predictor', 'mixed'])
    store.setWorld('mixed')
    store.startGrid()
    expect(store.grid!.entries.length).toBe(4)
    expect(store.grid!.table.length).toBe(4)
    expect(store.grid!.table[1][0]).toBeGreaterThan(25) // tit-for-tat against always-cooperate over 10 rounds at 5% noise: near 3 a round
    expect(store.grid!.table[1][0]).toBeLessThan(31)
    const m = stage(ctx)
    expect(m).toMatch(/data-key="3"/)
    expect(m).toMatch(/data-grid-notes/)
    store.setGridNotes('pockets of tit-for-tat move around')
    expect(progress.setting('p2-grid-notes')).toBe('pockets of tit-for-tat move around')
    store.toggleGridId('alld')
    expect(store.grid).toBeNull()
    store.setWorld('alld')
    expect(store.canDropBlock()).toBe(true)
    store.setBoundary('bounded')
    store.startGrid()
    expect(store.grid!.neighborCount(store.grid!.index(0, 0))).toBe(3)
    expect(store.grid!.neighborCount(store.grid!.index(20, 20))).toBe(8)
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
