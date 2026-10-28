import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ProgressStore } from '../../../sim/memory/progress/store'
import type { RawStorage } from '../../../sim/memory/progress/storage'
import { FORAGERS } from '../../../sim/memory/foragers/foragers'
import { learners, UseSampleButton, LearnersStore } from '../PartLearners'
import { sampleNights, SAMPLE_SEED } from './nights'
import { STEPS, TABLE_COLUMNS, TABLE_ROWS, type Step } from './steps'
import { DAMAGE_LINE, PASS_BACK_LINE, PROGRAMS_LINE, SAMPLE_NIGHTS_LINE, SEPARATION_LINE, STRENGTH_LINE, RATS_LINE } from '../lines'
import { YOUTH_PASSES } from '../../../sim/memory/foragers/slow'

/**
 * Part 5 (spec §9, §12 item 1, §14): every step opens on an instruction
 * screen; no result before each prediction's commit; any step can be
 * opened and a finished one reopens to its result; the four foragers
 * reproduce their results from the nights and the seed; the sample nights
 * are deterministic and flagged; the content lines are on their panels;
 * and no agentic verb about a forager, the store or a network.
 */

function memoryStorage(): RawStorage {
  let text: string | null = null
  return { read: () => text, write: (t) => ((text = t), true) }
}

function fresh(): { store: LearnersStore; progress: ProgressStore; ctx: Parameters<typeof learners.Left>[0]['ctx'] } {
  const progress = new ProgressStore(memoryStorage(), SAMPLE_SEED)
  progress.useSampleNights()
  const store = new LearnersStore(SAMPLE_SEED, progress)
  const ctx = { seed: SAMPLE_SEED, progress, store, view: 'eye', fov: 75, lowDetail: false, anim: undefined as never, clock: () => 0, header: null } as unknown as Parameters<typeof learners.Left>[0]['ctx']
  return { store, progress, ctx }
}

const stage = (ctx: Parameters<typeof learners.Stage>[0]['ctx']) => renderToStaticMarkup(<>{learners.Stage({ ctx })}</>)
const left = (ctx: Parameters<typeof learners.Left>[0]['ctx']) => renderToStaticMarkup(<>{learners.Left({ ctx })}</>)
const right = (ctx: Parameters<typeof learners.Right>[0]['ctx']) => renderToStaticMarkup(<>{learners.Right({ ctx })}</>)

function commitAll(store: LearnersStore, step: Step) {
  for (const p of STEPS[step - 1].predictions) store.choose(p.key, p.choices[0])
  store.commitPredictions()
}

describe('the sample nights', () => {
  it('are deterministic, flagged as someone else’s, and one week of six nights with the end-of-week answers', () => {
    const a = sampleNights()
    const b = sampleNights()
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
    expect(a.sample).toBe(true)
    expect(a.week.records.length).toBe(6)
    expect(a.week.states.length).toBe(7)
    expect(Object.keys(a.week.answers).length).toBe(7)
    expect(a.week.restarted).toBe(false)
    expect(['AABCCD', 'ABBBCD']).toContain(a.week.plan.order)
  })
  it('the lock screen’s button offers the sample only while Part 4 is unfinished and no sample is in use', () => {
    const progress = new ProgressStore(memoryStorage(), 1)
    expect(renderToStaticMarkup(<UseSampleButton progress={progress} />)).toContain('Use a sample set of nights')
    expect(progress.canOpen(5)).toBe(false)
    progress.useSampleNights()
    expect(progress.canOpen(5)).toBe(true)
    expect(renderToStaticMarkup(<UseSampleButton progress={progress} />)).toBe('')
  })
})

describe('every step opens on an instruction screen, and asks its predictions before anything runs', () => {
  it('each of the four steps renders an instruction screen with the reread line, and the sample line on the panels', () => {
    const { store, ctx } = fresh()
    for (const st of STEPS) {
      store.open(st.step)
      const m = stage(ctx)
      expect(m).toMatch(/data-instruction/)
      expect(m).toContain(st.title)
      expect(m).toContain('Reread §')
      expect(m).toContain('You can leave and come back at any time.')
    }
    expect(left(ctx)).toContain(SAMPLE_NIGHTS_LINE)
    expect(left(ctx)).toContain(RATS_LINE)
    expect(right(ctx)).toContain(SAMPLE_NIGHTS_LINE)
  })
  it('after Begin the step asks its predictions on the left, the stage shows no result, and the commit opens the step', () => {
    const { store, ctx } = fresh()
    store.begin()
    expect(store.state).toBe('predict')
    const l = left(ctx)
    expect(l).toMatch(/data-predict/)
    expect(l).toContain('Commit my prediction')
    expect(stage(ctx)).toMatch(/data-stage="predict"/)
    expect(stage(ctx)).not.toMatch(/data-step1-reveal/)
    store.commitPredictions()
    expect(store.state).toBe('predict')
    commitAll(store, 1)
    expect(store.state).toBe('running')
    expect(store.prediction('p5-step1-closest')).toBe(FORAGERS[0].label)
  })
  it('a committed prediction is never overwritten, and a step whose predictions are committed begins straight into running', () => {
    const { store, progress } = fresh()
    store.begin()
    commitAll(store, 1)
    store.choose('p5-step1-closest', FORAGERS[2].label)
    store.commitPredictions()
    expect(progress.prediction('p5-step1-closest')).toBe(FORAGERS[0].label)
    store.redo()
    store.begin()
    expect(store.state).toBe('running')
  })
})

describe('Step 1: no result before the commit; the four foragers reproduce their results', () => {
  it('before the run the stage holds no table; after Run the foragers (paid in slices) it holds the totals over the week, the shares after each kind of pair, and the replay', () => {
    const { store, ctx } = fresh()
    store.begin()
    commitAll(store, 1)
    const before = stage(ctx)
    expect(before).not.toMatch(/data-lines="week-totals"/)
    store.runForagers()
    expect(store.running).toBe(true)
    store.payAll()
    expect(store.foragerRuns).not.toBeNull()
    const after = stage(ctx)
    expect(after).toMatch(/data-lines="week-totals"/)
    expect(after).toMatch(/data-lines="week-shares"/)
    expect(after).toContain('after look-alike pair')
    expect(after).toMatch(/data-clearing-overhead/)
    expect(after).toContain(PROGRAMS_LINE)
    expect(after).toContain('Digs at logs emptied last night')
    expect(after).toContain('Beetles per minute')
  })
  it('run twice from the same nights and seed, every forager gives the same records', () => {
    const a = fresh()
    a.store.begin()
    commitAll(a.store, 1)
    a.store.runForagers()
    a.store.payAll()
    const b = fresh()
    b.store.begin()
    commitAll(b.store, 1)
    b.store.runForagers()
    b.store.payAll()
    for (const f of FORAGERS) expect(JSON.stringify(a.store.foragerRuns![f.id].run.records)).toBe(JSON.stringify(b.store.foragerRuns![f.id].run.records))
  })
})

describe('Step 2: the store’s panels and shares only after the commit and the run', () => {
  it('the stage shows no share before the run, and all three settings beside the student after', () => {
    const { store, ctx } = fresh()
    store.open(2)
    store.begin()
    expect(stage(ctx)).not.toMatch(/data-lines="store-shares"/)
    commitAll(store, 2)
    expect(stage(ctx)).not.toMatch(/data-lines="store-shares"/)
    store.runStore()
    store.payAll()
    const m = stage(ctx)
    expect(m).toMatch(/data-lines="store-shares"/)
    expect(m).toContain('the store, weak')
    expect(m).toContain('the store, strong')
    expect(m).toMatch(/data-stored-nights="6"/)
    expect(m).toMatch(/data-similarity/)
    expect(m).toMatch(/data-retrieval/)
    expect(m).toContain(SEPARATION_LINE)
    expect(m).toContain(STRENGTH_LINE)
    store.setSeparation('strong')
    expect(stage(ctx)).toContain('separation strong')
  })
})

describe('Step 3: the youth, the snapshots and the new season', () => {
  it('skipping through the youth takes the four snapshots and reaches the youth’s length; the season plot appears only after a run', () => {
    const { store, ctx } = fresh()
    store.open(3)
    store.begin()
    commitAll(store, 3)
    expect(stage(ctx)).toMatch(/data-property-table="world"/)
    expect(stage(ctx)).not.toMatch(/data-snapshots/)
    expect(stage(ctx)).not.toMatch(/data-season-plot/)
    store.skipYouth()
    store.payAll()
    expect(store.youthPass).toBe(YOUTH_PASSES)
    expect(store.snapshots.map((s) => s.pass)).toEqual([5, 20, 80, YOUTH_PASSES])
    const m = stage(ctx)
    expect(m).toMatch(/data-snapshots="4"/)
    expect(m).toMatch(/data-lines="differentiation"/)
    expect(m).toContain(PASS_BACK_LINE)
    store.trainSeason('off')
    store.payAll()
    store.trainSeason('on')
    store.payAll()
    expect(store.season.off.length).toBeGreaterThan(5)
    expect(store.season.on.length).toBeGreaterThan(5)
    const last = (pts: { specific: number }[]) => pts[pts.length - 1].specific
    expect(last(store.season.off)).toBeLessThan(last(store.season.on))
    expect(stage(ctx)).toMatch(/data-season-plot="specific"/)
  }, 120_000)
})

describe('Step 4: the two kinds of damage, and the two-by-two table after its commit', () => {
  it('runs both damages, reads the property table at a noise, and shows the measured table only after the commit', () => {
    const { store, ctx } = fresh()
    store.open(4)
    store.begin()
    commitAll(store, 4)
    expect(stage(ctx)).not.toMatch(/data-lines="no-store-table"/)
    store.removeStore()
    store.payAll()
    expect(stage(ctx)).toMatch(/data-lines="no-store-table"/)
    store.setNoise(1)
    expect(stage(ctx)).toMatch(/data-property-table="answers"/)
    expect(stage(ctx)).toMatch(/data-lines="kept-lines"/)
    store.runDamaged()
    store.payAll()
    expect(stage(ctx)).toMatch(/data-lines="damaged-table"/)
    expect(stage(ctx)).not.toMatch(/data-lines="measured-table"/)
    for (const r of TABLE_ROWS) for (const c of TABLE_COLUMNS) store.chooseCell(r, c, 'rises')
    expect(store.tableComplete).toBe(true)
    store.commitTable()
    expect(store.tableCommitted).toBe('rises|rises||rises|rises')
    const m = stage(ctx)
    expect(m).toMatch(/data-lines="measured-table"/)
    expect(m).toContain('double dissociation')
    expect(m).toContain(DAMAGE_LINE)
    expect(m.toLowerCase()).toContain('semantic dementia')
    expect(m).toContain('H.M.')
  }, 120_000)
})

describe('steps can be opened, reopened and redone', () => {
  it('any step can be opened; a finished one reopens to its result; Redo reopens it on its instruction screen', () => {
    const { store } = fresh()
    expect(store.canOpen(4)).toBe(true)
    store.open(2)
    expect(store.state).toBe('intro')
    store.begin()
    commitAll(store, 2)
    store.finish()
    expect(store.state).toBe('done')
    store.open(3)
    store.open(2)
    expect(store.state).toBe('done')
    store.redo()
    expect(store.state).toBe('intro')
    store.begin()
    expect(store.state).toBe('running')
  })
})

describe('words (§12, item 6)', () => {
  const files = import.meta.glob(['./*.{ts,tsx}', '../PartLearners.tsx'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>
  const visible = (src: string) => {
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    const literals = [...code.matchAll(/(['"`])((?:\\.|(?!\1)[\s\S])*?)\1/g)].map((m) => m[2])
    const jsx = [...code.matchAll(/>([^<>{}]+)</g)].map((m) => m[1])
    return [...literals, ...jsx].join('\n')
  }
  it('no agentic verb about a forager, the store, the network or a learner; keep and hold not used for memory; no British spellings', () => {
    const subjects = '(foragers?|store|network|learner|program|programs|it|they)'
    const verbs = '(knows?|notices?|decides?|remembers?|recalls?|wants?|believes?|thinks?|realizes?|understands?|figures? out)'
    for (const [path, src] of Object.entries(files)) {
      if (path.includes('.test.')) continue
      const t = visible(src)
      expect(t, path).not.toMatch(new RegExp(`\\b(the|a|each|every|this|that|its) ${subjects} ${verbs}\\b`, 'i'))
      expect(t, path).not.toMatch(/\b(keeps?|holds?) (a record|information|a memory|memories|the night|in memory)\b/i)
      expect(t, path).not.toMatch(/\bcolour|\bbehaviour|\bfavour|\bcentre\b|\banalyse|\bgrey\b|\bmetres?\b|\bneighbour/i)
    }
  })
  it('the chapter’s words are on the panels: disposition, accessible content, pattern separation, complementary learning systems, replay, catastrophic interference, double dissociation, semantic dementia', () => {
    const all = Object.entries(files)
      .filter(([p]) => !p.includes('.test.'))
      .map(([, s]) => visible(s))
      .join('\n')
      .toLowerCase()
    for (const w of ['disposition', 'accessible content', 'pattern separation', 'pattern completion', 'content-addressable memory', 'complementary learning systems', 'consolidation', 'replay', 'catastrophic interference', 'double dissociation', 'semantic dementia', 'the fast store', 'the slow learner', 'the list for tonight']) expect(all, w).toContain(w)
  })
})
