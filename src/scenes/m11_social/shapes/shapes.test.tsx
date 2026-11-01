import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ProgressStore } from '../../../sim/social/progress/store'
import type { RawStorage } from '../../../sim/social/progress/storage'
import { FILMS } from '../../../sim/social/shapes/films'
import { pathById } from '../../../sim/social/paths/pool'
import { ShapesStore, planOrder, FILMS_UNIT, PATHS_UNIT } from './shapesStore'
import { ShapesLeft, ShapesStage, FILMS_WILL_DO, PATHS_WILL_DO } from './screens'
import { ShapesReveal, revealData, MODELS_INTRO } from './Reveal'

/**
 * Part 3 (spec §13 items 1 and 2, §16): no rating, check or 1944 result
 * before all three descriptions are written; no model output before the
 * prediction; the strings test; an interrupted films unit restarts with
 * the same three films; the paths resume with the path in progress
 * replaced by a reserve of its kind; the sliders sum to 100.
 */

function memoryStorage(): RawStorage & { text: string | null } {
  const box = { text: null as string | null, read: () => box.text, write: (t: string) => ((box.text = t), true) }
  return box
}
function make(seed: number, box = memoryStorage()) {
  const progress = new ProgressStore(box, seed)
  return { store: new ShapesStore(seed, progress), progress, box }
}
const ctxOf = (store: ShapesStore) => ({ store, progress: store.progress, header: null, seed: store.seed }) as never
const render = (store: ShapesStore) => renderToStaticMarkup(<ShapesStage ctx={ctxOf(store)} />) + renderToStaticMarkup(<ShapesLeft ctx={ctxOf(store)} />)
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;|&quot;/g, "'").replace(/\s+/g, ' ')
const FORBIDDEN = /\bgoal|intention|\bagent|animate|\balive\b|purpose|motive|\bchase|\bhid(e|ing)\b|bully|Heider|Simmel/i

function describeAll(store: ShapesStore) {
  store.beginFilms()
  for (let k = 0; k < 3; k++) {
    expect(store.state).toBe('film')
    store.setFilmClock(FILMS[k].duration)
    expect(store.state).toBe('describe')
    store.setDescription('The big one went out of the box and bumped the small one, which moved away quickly.')
    store.finishDescription()
  }
  expect(store.state).toBe('rate')
}

describe('Step 1: nothing names what the films test before all three are described', () => {
  it('the instruction screen, the films and the description boxes hold no forbidden word, no rating and no checklist', () => {
    const { store } = make(3)
    expect(text(render(store))).not.toMatch(FORBIDDEN)
    for (const l of [...FILMS_WILL_DO, ...PATHS_WILL_DO]) expect(l).not.toMatch(FORBIDDEN)
    store.beginFilms()
    for (let k = 0; k < 3; k++) {
      const during = render(store)
      expect(during).toMatch(/data-stage="film"/)
      expect(text(during)).not.toMatch(FORBIDDEN)
      expect(during).not.toMatch(/data-rate-film|data-checklist|act on purpose/)
      store.setFilmClock(FILMS[k].duration)
      const desc = render(store)
      expect(desc).toMatch(/data-stage="describe"/)
      expect(text(desc)).not.toMatch(FORBIDDEN)
      expect(desc).not.toMatch(/data-rate-film|1944|97%/)
      expect(store.canFinishDescription).toBe(false)
      store.setDescription('short')
      expect(store.canFinishDescription).toBe(false)
      store.setDescription('The big one went out of the box and bumped the small one, which moved away quickly.')
      store.finishDescription()
    }
    expect(store.state).toBe('rate')
    const rate = render(store)
    expect(rate).toMatch(/act on purpose/)
    expect(rate).toMatch(/data-checklist="1"/)
    expect(rate).not.toMatch(/1944|97%|data-reveal/)
  })
  it('the ratings and checks are committed together and saved as the films unit; the reveal waits for Step 2', () => {
    const { store } = make(4)
    describeAll(store)
    expect(store.canCommitRatings).toBe(false)
    for (let k = 0; k < 3; k++) {
      store.rate(k, 5 - k)
      store.toggleCheck(k, 'c1')
    }
    store.toggleCheck(2, 'c4')
    expect(store.checks[2]).toEqual(['c4'])
    expect(store.canCommitRatings).toBe(true)
    store.commitRatings()
    expect(store.state).toBe('step1-done')
    expect(store.progress.isComplete(FILMS_UNIT)).toBe(true)
    expect(revealData(store.progress)).toBeNull()
    expect(render(store)).not.toMatch(/1944|data-reveal/)
  })
  it('an interrupted films unit restarts with the same three films, counted', () => {
    const box = memoryStorage()
    const a = make(5, box)
    a.store.beginFilms()
    a.store.setFilmClock(FILMS[0].duration)
    const b = make(5, box)
    expect(b.store.state).toBe('intro')
    expect(b.progress.restarts(FILMS_UNIT)).toBe(1)
    b.store.beginFilms()
    expect(b.store.film).toBe(1)
  })
})

describe('Step 2: the paths', () => {
  function finishStep1(store: ShapesStore) {
    describeAll(store)
    for (let k = 0; k < 3; k++) {
      store.rate(k, 4)
      store.toggleCheck(k, 'c3')
    }
    store.commitRatings()
    store.openPaths()
  }
  it('the dot pauses at the judgment points, the sliders sum to 100, and no model output is rendered before the prediction', () => {
    const { store } = make(6)
    finishStep1(store)
    store.beginPaths()
    expect(store.state).toBe('path')
    let guard = 0
    while (store.state === 'path' && guard++ < 2000) {
      if (store.atJudgment) {
        const m = render(store)
        expect(m).toMatch(/data-sliders/)
        expect(text(m)).not.toMatch(/inverse planning|last moved toward|data-reveal/i)
        store.setSplit(0, 70)
        expect(store.split[0] + store.split[1] + store.split[2]).toBe(100)
        store.setSplit(2, 10)
        expect(store.split[0] + store.split[1] + store.split[2]).toBe(100)
        store.commitJudgment()
      } else store.advance()
    }
    expect(store.state).toBe('models-intro')
    expect(store.judged.length).toBe(store.judgmentsInAll())
    expect(store.progress.isComplete(PATHS_UNIT)).toBe(true)
    const intro = render(store)
    expect(intro).toMatch(/data-stage="models-intro"/)
    expect(intro).not.toMatch(/data-reveal|data-lines="correlations"/)
    for (const l of MODELS_INTRO) expect(l).not.toMatch(/0\.97|0\.96/)
    store.chooseOverall('inverse')
    store.chooseDisagree('heuristic')
    store.commitModels()
    expect(store.state).toBe('revealed')
    const reveal = renderToStaticMarkup(<ShapesReveal progress={store.progress} />)
    expect(reveal).toMatch(/data-stage="reveal"/)
    expect(reveal).toMatch(/data-lines="correlations"/)
    expect(reveal).toMatch(/data-lines="disagreements"/)
    expect(reveal).toMatch(/1944/)
    expect(reveal).toMatch(/Simulated class pending/)
    const d = revealData(store.progress)!
    expect(Number.isFinite(d.rInverse)).toBe(true)
  })
  it('an interrupted paths unit resumes with the judgments kept and the path in progress replaced by a reserve of its kind', () => {
    const box = memoryStorage()
    const a = make(7, box)
    finishStep1(a.store)
    a.store.beginPaths()
    // Judge the first path fully, start the second, then leave.
    const first = a.store.path!.id
    let guard = 0
    while (a.store.path!.id === first && guard++ < 200) {
      if (a.store.atJudgment) a.store.commitJudgment()
      else a.store.advance()
    }
    const second = a.store.path!.id
    while (!a.store.atJudgment && guard++ < 200) a.store.advance()
    a.store.commitJudgment()
    const kept = a.store.judged.length
    const b = make(7, box)
    expect(b.store.state).toBe('paths-intro')
    expect(b.progress.status(PATHS_UNIT)).toBe('in progress')
    expect(b.store.order).not.toContain(second)
    const replacement = b.store.order[a.store.order.indexOf(second)]
    expect(pathById(replacement).kind).toBe(pathById(second).kind)
    expect(pathById(replacement).reserve).toBe(true)
    expect(b.store.judged.length).toBe(kept - 1)
    expect(b.store.judged.every((j) => j.path !== second)).toBe(true)
    expect(new Set(b.store.order).size).toBe(16)
  })
  it('the same seed gives the same order of paths', () => {
    expect(planOrder(9)).toEqual(planOrder(9))
    expect(planOrder(9)).not.toEqual(planOrder(10))
    expect(planOrder(9).length).toBe(16)
  })
})
