import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { ReactElement } from 'react'
import { ProgressStore } from '../../sim/language/progress/store'
import type { RawStorage } from '../../sim/language/progress/storage'
import { open, progressRows } from './Part0'
import { sounds, SoundsStore } from './PartSounds'
import { stream, StreamStore } from './PartStream'
import { words, WordsStore } from './PartWords'
import { predictors, PredictorsStore } from './PartPredictors'
import { NOTICE_LINE as STREAM_NOTICE } from './stream/screens'
import { NOTICE_LINE as WORDS_NOTICE } from './words/screens'
import { makeRng } from '../../sim/random'
import { abxTrials, labelingTrials } from '../../sim/language/sounds/abx'

/** Saved results of the right shape, for the finished-step stages. */
export const labelsFixture = { order: ['bee', 'bah', 'boo', 'dee', 'dah', 'doo'], labels: { bee: 'b', bah: 'b', boo: 'd', dee: 'd', dah: 'd', doo: 'd' }, correct: 5, seconds: 40, restarts: 0 }
export const labelingFixture = (() => {
  const trials = labelingTrials(makeRng(1))
  return { trials, answers: trials.map((s) => (s <= 4 ? 'b' : 'd')), seconds: trials.map(() => 1), restarts: 0 }
})()
export const abxFixture = (() => {
  const trials = abxTrials(makeRng(2))
  return { trials, answers: trials.map((t) => (t.xIsFirst ? 'first' : 'second')), seconds: trials.map(() => 1), restarts: 0 }
})()

/**
 * Every part and step opens from a fresh seed with nothing else done, on an
 * instruction screen with its sections (spec §14); the one-line notices of
 * §4.2 and §11, item 3, appear where the spec puts them and nowhere else; a
 * finished step's stage names the button that comes next. Commit, then
 * reveal, on rendered markup, as Lab 6 tests it, is added part by part as
 * the parts' screens are built.
 */

export function memoryStorage(): RawStorage {
  let text: string | null = null
  return { read: () => text, write: (t) => ((text = t), true) }
}

type Mod = { Nav: unknown; Stage: unknown }
/** A part rendered as the shell renders it: the main panel's current-part tab and the navigation panel, on one store. `openStep` opens the step on the store directly, as the shell does when nothing is under way. */
export function fresh<S>(mod: Mod, make: (seed: number, progress: ProgressStore) => S, seed = 7, progress = new ProgressStore(memoryStorage(), seed)) {
  const store = make(seed, progress)
  const ctx = { seed, progress, store, anim: undefined as never, header: null, openTab: () => {}, openStep: (step: number) => (store as { open?: (s: number) => void }).open?.(step) } as never
  const Stage = mod.Stage as (p: { ctx: never }) => ReactElement
  const Nav = mod.Nav as (p: { ctx: never }) => ReactElement
  const all = () => renderToStaticMarkup(<Stage ctx={ctx} />) + renderToStaticMarkup(<Nav ctx={ctx} />)
  return { store, progress, ctx, all }
}
export const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, '’').replace(/&quot;/g, '"').replace(/\s+/g, ' ')

const sections = (html: string, label: string) => {
  for (const s of ['data-instruction', 'data-will-do', 'data-minutes', 'data-sitting', 'data-ready', 'data-keys', 'data-next']) expect(html, `${label}: ${s}`).toMatch(new RegExp(s))
}

describe('every part and step opens from a fresh seed with nothing else done, on an instruction screen', () => {
  it('Part 0 renders from a fresh state with its rows and the test sound', () => {
    const p0 = fresh(open as Mod, (s, p) => open.createStore(s, p))
    const m = p0.all()
    expect(m).toMatch(/data-orienting/)
    expect(text(m)).toMatch(/Part 1\s+0 of 3 experiments done/)
    expect(text(m)).toMatch(/Part 2\s+0 of 2 experiments done/)
    expect(text(m)).toMatch(/Part 3\s+0 of 1 experiment done/)
    expect(text(m)).toMatch(/Part 4\s+an exploration/)
    expect(text(m)).toMatch(/Play a test sound/)
    expect(text(m)).toMatch(/headphones or earbuds/)
    expect(progressRows(p0.progress).length).toBe(4)
  })
  it('Part 1: every step opens on an instruction screen with every section', () => {
    const c = fresh(sounds as Mod, (s, p) => new SoundsStore(s, p))
    for (const step of [1, 2, 3, 4] as const) {
      c.store.open(step)
      sections(c.all(), `Part 1 step ${step}`)
      expect(c.all()).not.toMatch(/data-notice-line/)
    }
  })
  it('Part 2: Step 1 opens on its instruction screen; Steps 2 to 4 open behind the one-line notice while Step 1 is not committed, and on Open anyway they open', () => {
    const z = fresh(stream as Mod, (s, p) => new StreamStore(s, p))
    z.store.open(1)
    sections(z.all(), 'Part 2 step 1')
    for (const step of [2, 3, 4] as const) {
      z.store.open(step)
      let m = z.all()
      expect(m, `Part 2 step ${step}`).toMatch(/data-stage="notice"/)
      expect(text(m)).toContain(STREAM_NOTICE)
      expect(text(m)).toMatch(/Open anyway/)
      expect(text(m)).toMatch(/Go to Step 1 first/)
      expect(m).not.toMatch(/data-instruction/)
      z.store.acceptNotice()
      m = z.all()
      sections(m, `Part 2 step ${step} after Open anyway`)
      z.store.begin()
      expect(z.all()).toMatch(new RegExp(`data-stage="stream-${step}"`))
    }
  })
  it('Part 2: once Step 1 is committed, Steps 2 to 4 open with no notice', () => {
    const z = fresh(stream as Mod, (s, p) => new StreamStore(s, p))
    z.progress.begin('p2-minute')
    z.progress.complete('p2-minute', { guess: 3 })
    for (const step of [2, 3, 4] as const) {
      z.store.open(step)
      expect(z.all(), `Part 2 step ${step}`).not.toMatch(/data-stage="notice"/)
      sections(z.all(), `Part 2 step ${step}`)
    }
  })
  it('Part 3: Steps 1 and 2 open on their instruction screens; Step 3 opens behind the notice until the unit is done', () => {
    const w = fresh(words as Mod, (s, p) => new WordsStore(s, p))
    for (const step of [1, 2] as const) {
      w.store.open(step)
      sections(w.all(), `Part 3 step ${step}`)
    }
    w.store.open(3)
    expect(text(w.all())).toContain(WORDS_NOTICE)
    w.store.acceptNotice()
    sections(w.all(), 'Part 3 step 3')
    const done = fresh(words as Mod, (s, p) => new WordsStore(s, p))
    done.progress.begin('p3-words')
    done.progress.complete('p3-words', {})
    done.store.open(3)
    expect(done.all()).not.toMatch(/data-stage="notice"/)
    sections(done.all(), 'Part 3 step 3, unit done')
  })
  it('Part 4: every step opens on an instruction screen', () => {
    const k = fresh(predictors as Mod, (s, p) => new PredictorsStore(s, p))
    for (const step of [1, 2, 3, 4, 5] as const) {
      k.store.open(step)
      sections(k.all(), `Part 4 step ${step}`)
      expect(k.all()).not.toMatch(/data-notice-line/)
    }
  })
  it('a step opened out of order runs: Part 1 Step 4, Part 2 Step 3, Part 4 Step 3 begin with nothing else done', () => {
    const c = fresh(sounds as Mod, (s, p) => new SoundsStore(s, p))
    c.store.open(4)
    c.store.begin()
    expect(c.all()).toMatch(/data-stage="sounds-4"/)
    const z = fresh(stream as Mod, (s, p) => new StreamStore(s, p))
    z.store.open(3)
    z.store.acceptNotice()
    z.store.begin()
    expect(z.all()).toMatch(/data-stage="stream-3"/)
    const k = fresh(predictors as Mod, (s, p) => new PredictorsStore(s, p))
    k.store.open(3)
    k.store.begin()
    expect(k.all()).toMatch(/data-stage="predictors-3/)
  })
})

describe('a finished step’s stage names the button that comes next', () => {
  it('Part 1, Step 2 done points at Step 3; Part 1, Step 3 done points at Step 4; Part 3’s unit done points at Step 3', () => {
    const c = fresh(sounds as Mod, (s, p) => new SoundsStore(s, p))
    c.progress.begin('p1-labels')
    c.progress.complete('p1-labels', labelsFixture)
    c.store.open(2)
    let m = text(c.all())
    expect(m).toMatch(/press “Go on to Step 3”/)
    expect(m).toMatch(/This step is done and saved/)
    c.progress.complete('p1-labeling', labelingFixture)
    c.progress.complete('p1-abx', abxFixture)
    c.store.open(3)
    m = text(c.all())
    expect(m).toMatch(/press “Go on to Step 4”/)
    const w = fresh(words as Mod, (s, p) => new WordsStore(s, p))
    w.progress.complete('p3-words', {})
    w.store.open(2)
    expect(text(w.all())).toMatch(/press “Go on to Step 3”/)
    expect(w.store.stateOf(1)).toBe('done')
  })
  it('the instructions come back over a running step and go away again', () => {
    const k = fresh(predictors as Mod, (s, p) => new PredictorsStore(s, p))
    k.store.open(2)
    k.store.begin()
    expect(k.all()).toMatch(/data-stage="predictors-2"/)
    k.store.showInstructions()
    expect(k.all()).toMatch(/data-instruction/)
    expect(text(k.all())).toMatch(/Back to the step/)
    k.store.hideInstructions()
    expect(k.all()).toMatch(/data-stage="predictors-2"/)
  })
  it('Part 1, Step 3 between its blocks is running, not on its instruction screen, on a fresh store', () => {
    const progress = new ProgressStore(memoryStorage(), 7)
    progress.complete('p1-labeling', labelingFixture)
    const c = fresh(sounds as Mod, (s, p) => new SoundsStore(s, p), 7, progress)
    c.store.open(3)
    expect(c.store.state).toBe('running')
    expect(c.store.betweenBlocks).toBe(true)
  })
})
