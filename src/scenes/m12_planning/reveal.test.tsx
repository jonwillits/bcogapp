import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { ReactElement } from 'react'
import { ProgressStore } from '../../sim/planning/progress/store'
import type { RawStorage } from '../../sim/planning/progress/storage'
import { choices, ChoicesStore } from './PartChoices'
import { puzzles, PuzzlesStore } from './PartPuzzles'
import { band, BandStore } from './PartBand'
import { corn, CornStore } from './PartCorn'
import { open } from './Part0'
import { LETTERS } from './band/store'
import { HOMININ_KINDS } from '../../sim/planning/hominins/types'
import { PROCEDURE_IDS } from '../../sim/planning/puzzles/procedures'
import { PROCEDURE_PREDICTIONS } from './puzzles/screens'
import { GAMBLES_UNIT } from './choices/store'
import { PREDICTIONS } from './corn/store'

/**
 * Commit, then reveal, on every tested surface, on rendered markup (spec
 * §11 item 1, §14), as Lab 6 tests it; and every part and step opens from a
 * fresh seed with nothing else done, on an instruction screen.
 */

function memoryStorage(): RawStorage {
  let text: string | null = null
  return { read: () => text, write: (t) => ((text = t), true) }
}

type Mod = { Left: unknown; Stage: unknown; Right: unknown }
function fresh<S>(mod: Mod, make: (seed: number, progress: ProgressStore) => S, seed = 7) {
  const progress = new ProgressStore(memoryStorage(), seed)
  const store = make(seed, progress)
  const ctx = { seed, progress, store, view: 'follow', fov: 55, lowDetail: false, anim: undefined as never, clock: () => 0, header: null, openTab: () => {} } as never
  const Stage = mod.Stage as (p: { ctx: never }) => ReactElement
  const Left = mod.Left as (p: { ctx: never }) => ReactElement
  const Right = mod.Right as (p: { ctx: never }) => ReactElement
  const all = () => renderToStaticMarkup(<Stage ctx={ctx} />) + renderToStaticMarkup(<Left ctx={ctx} />) + renderToStaticMarkup(<Right ctx={ctx} />)
  return { store, progress, ctx, all }
}
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, '’').replace(/&quot;/g, '"').replace(/\s+/g, ' ')

describe('every part and step opens from a fresh seed with nothing else done, on an instruction screen', () => {
  it('Part 0 and the four parts render from a fresh state', () => {
    const p0 = fresh(open as Mod, (s, p) => open.createStore(s, p))
    expect(p0.all()).toMatch(/data-orienting/)
    expect(text(p0.all())).toMatch(/0 of 4 experiments done/)
    const c = fresh(choices as Mod, (s, p) => new ChoicesStore(s, p))
    for (const step of [1, 2, 3, 4] as const) {
      c.store.open(step)
      expect(c.all(), `Part 1 step ${step}`).toMatch(/data-instruction/)
      expect(c.all()).toMatch(/data-will-do/)
      expect(c.all()).toMatch(/data-minutes/)
      expect(c.all()).toMatch(/data-sitting/)
      expect(c.all()).toMatch(/data-keys/)
    }
    const z = fresh(puzzles as Mod, (s, p) => new PuzzlesStore(s, p))
    for (const step of [1, 2, 3] as const) {
      z.store.open(step)
      expect(z.all(), `Part 2 step ${step}`).toMatch(/data-instruction/)
    }
    const b = fresh(band as Mod, (s, p) => new BandStore(s, p))
    for (const step of [1, 2, 3, 4] as const) {
      b.store.open(step)
      expect(b.all(), `Part 3 step ${step}`).toMatch(/data-instruction/)
    }
    const k = fresh(corn as Mod, (s, p) => new CornStore(s, p))
    for (const step of [1, 2, 3, 4] as const) {
      k.store.open(step)
      expect(k.all(), `Part 4 step ${step}`).toMatch(/data-instruction/)
    }
  })
  it('a step opened out of order runs: Part 1 Step 2 begins with nothing else done, and so does Part 2 Step 3 and Part 4 Step 3', () => {
    const c = fresh(choices as Mod, (s, p) => new ChoicesStore(s, p))
    c.store.open(2)
    c.store.begin()
    expect(c.all()).toMatch(/data-stage="delay-cards"/)
    const z = fresh(puzzles as Mod, (s, p) => new PuzzlesStore(s, p))
    z.store.open(3)
    z.store.begin()
    expect(z.all()).toMatch(/data-stage="trees"/)
    const k = fresh(corn as Mod, (s, p) => new CornStore(s, p))
    k.store.open(3)
    k.store.begin()
    expect(k.all()).toMatch(/data-stage="corn-3"/)
  })
})

describe('Part 1: commit, then reveal', () => {
  it('no expected value, published share, reference or other version of a problem before the step’s last choice; the reveal shows them after', () => {
    const c = fresh(choices as Mod, (s, p) => new ChoicesStore(s, p))
    c.store.open(1)
    c.store.begin()
    // Answer the wheel, then every card.
    c.store.spin()
    c.store.wheel = 'stopped'
    c.store.answerHigher(true)
    c.store.answerEstimate(40)
    let m = c.all()
    expect(m).not.toMatch(/data-reveal/)
    expect(text(m)).not.toMatch(/Expected value:|published|72%|Kahneman|Tversky|value function/)
    while (c.store.currentItem) {
      m = c.all()
      expect(m).not.toMatch(/data-reveal/)
      expect(text(m)).not.toMatch(/Expected value:|published share|anchor|framing/i)
      c.store.chooseCard(0)
    }
    expect(c.progress.isComplete(GAMBLES_UNIT)).toBe(true)
    m = c.all()
    expect(m).toMatch(/data-reveal="gambles"/)
    expect(text(m)).toMatch(/expected value/i)
    expect(text(m)).toMatch(/72%/)
    expect(text(m)).toMatch(/Here is the other version/)
    expect(m).toMatch(/data-class="pair1"/)
    expect(m).toMatch(/data-reference="anchor-1974"/)
  })
  it('no dispenser’s rule before both blocks are done; the delays reveal does not name the gambles’ words', () => {
    const c = fresh(choices as Mod, (s, p) => new ChoicesStore(s, p))
    c.store.open(3)
    expect(text(c.all())).not.toMatch(/8 seconds after|half of its trials|Always wait/)
    c.store.open(2)
    c.store.begin()
    while (c.store.currentDelayItem) c.store.chooseDelayCard(0)
    const m = c.all()
    expect(m).toMatch(/data-reveal="delays"/)
    expect(text(m)).toMatch(/hyperbolic/)
    expect(text(m)).not.toMatch(/Kahneman|Tversky|framing|anchor/)
  })
})

describe('Part 2: commit, then reveal', () => {
  it('no state graph before both puzzles are solved; no procedure’s result before its prediction; no tree’s best path before the student’s path, and no looker’s result before the last tree', () => {
    const z = fresh(puzzles as Mod, (s, p) => new PuzzlesStore(s, p))
    z.store.open(1)
    z.store.begin()
    expect(z.all()).not.toMatch(/data-state-graph/)
    z.store.open(2)
    z.store.begin()
    let m = z.all()
    expect(m).not.toMatch(/data-procedure-status[^>]*>.*move \d/)
    z.store.requestRun('search')
    expect(z.store.pendingPrediction).toBe('search')
    expect(text(z.all())).not.toMatch(/examined\s+\d/)
    z.store.chooseDraft('search', PROCEDURE_PREDICTIONS.search.choices[0])
    z.store.commitPrediction()
    z.store.skipToEnd()
    m = z.all()
    expect(text(m)).toMatch(/Search everything\s+\d+/)
    z.store.open(3)
    z.store.begin()
    m = z.all()
    expect(m).toMatch(/data-stage="trees"/)
    expect(text(m)).not.toMatch(/best path|Look at everything|Look at nothing/)
    for (const id of PROCEDURE_IDS) expect(id).toBeTruthy()
  })
})

describe('Part 3: commit, then reveal', () => {
  it('no hominin’s procedure name before the diagnosis; Step 4 and the Shallow planner’s setting are not shown before the commit; they are after', () => {
    const b = fresh(band as Mod, (s, p) => new BandStore(s, p))
    b.store.open(3)
    b.store.begin()
    b.store.choose('p3-s3', 'all five')
    b.store.commitPredictions()
    let m = b.all()
    expect(m).not.toMatch(/data-reveal/)
    expect(m).not.toMatch(/data-variant/)
    const names = /\b(Adapted|Learned value|Copier|Shallow planner|Planner)\b/
    // The descriptions are listed without names and without letters.
    expect(text(m).replace(/What the Shallow planner counts[^.]*\./g, '')).not.toMatch(names)
    b.store.open(4)
    expect(b.all()).not.toMatch(/data-reveal/)
    expect(text(b.all())).toMatch(/opens once the diagnosis/)
    b.store.open(3)
    for (const l of LETTERS) b.store.diagnose(l, HOMININ_KINDS[0])
    b.store.commitDiagnosis()
    b.store.open(4)
    b.store.begin()
    m = b.all()
    expect(m).toMatch(/data-reveal="band"/)
    expect(m).toMatch(/data-variant/)
    expect(text(m)).toMatch(names)
    expect(text(m)).toMatch(/Diagnoses right \d of 5/)
  })
  it('the letters are dealt by the seed and differ between seeds', () => {
    const a = new BandStore(1, new ProgressStore(memoryStorage(), 1)).letters
    const b = new BandStore(2, new ProgressStore(memoryStorage(), 2)).letters
    const c = new BandStore(3, new ProgressStore(memoryStorage(), 3)).letters
    expect(JSON.stringify(a) !== JSON.stringify(b) || JSON.stringify(a) !== JSON.stringify(c)).toBe(true)
    expect(new Set(Object.values(a)).size).toBe(5)
  })
})

describe('Part 4: commit, then reveal', () => {
  it('no result before each prediction; the tray’s heritability appears after Grow', () => {
    const k = fresh(corn as Mod, (s, p) => new CornStore(s, p))
    k.store.open(1)
    k.store.begin()
    k.store.grow()
    expect(k.store.tray).toBeNull()
    expect(k.all()).not.toMatch(/data-lines="tray-stats"/)
    k.store.draft('s1', PREDICTIONS.s1.choices[2])
    k.store.commit('s1')
    k.store.grow()
    k.store.growing = null
    expect(k.all()).toMatch(/data-lines="tray-stats"/)
    expect(text(k.all())).toMatch(/heritability/)
  })
})
