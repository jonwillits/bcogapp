import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ProgressStore } from '../../../sim/social/progress/store'
import type { RawStorage } from '../../../sim/social/progress/storage'
import { TRAINING_TRIALS } from '../../../sim/social/creatures/materials'
import { creatures, CreaturesStore } from '../PartCreatures'
import { PREDICTION_KEYS, type Phase, type Timers } from './store'

const phaseOf = (s: CreaturesStore): Phase => s.phase

/**
 * Part 5's screen tests (PART5_REDESIGN_2026-11-04.md §11): no name in
 * Round 1 or at either memory test and no score before the predictions,
 * on rendered markup; the training's timer; an interrupted round restarts
 * with its reserve version and the note.
 */

function memoryStorage(): RawStorage & { text: string | null } {
  const box = { text: null as string | null, read: () => box.text, write: (t: string) => ((box.text = t), true) }
  return box
}

/** Timers driven by hand: `fire` runs the next pending timer. */
function handTimers(): Timers & { fire(): boolean; pending(): number } {
  const queue: { id: number; fn: () => void }[] = []
  let n = 0
  return {
    set: (fn) => {
      const id = ++n
      queue.push({ id, fn })
      return id
    },
    clear: (id) => {
      const i = queue.findIndex((q) => q.id === id)
      if (i >= 0) queue.splice(i, 1)
    },
    fire: () => {
      const q = queue.shift()
      if (!q) return false
      q.fn()
      return true
    },
    pending: () => queue.length,
  }
}

function make(seed = 5, box = memoryStorage()) {
  const progress = new ProgressStore(box, seed)
  const timers = handTimers()
  const store = new CreaturesStore(seed, progress, timers)
  const ctx = { seed, progress, store, anim: undefined as never, clock: () => 0, header: null, openTab: () => {} } as never
  return { store, progress, timers, ctx, box }
}

const Stage = creatures.Stage as unknown as (p: { ctx: never }) => React.ReactElement
const Right = creatures.Right as unknown as (p: { ctx: never }) => React.ReactElement
const stage = (ctx: never) => renderToStaticMarkup(<Stage ctx={ctx} />)
const right = (ctx: never) => renderToStaticMarkup(<Right ctx={ctx} />)
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
const NAMES = /Ostra|Velin|Marl|Tesk/

/** Play a round's training with the right answers, then the memory test, then (Round 1) the surprise, then the sort. */
function playRound(store: CreaturesStore, timers: ReturnType<typeof handTimers>, memory: (kind: string) => 'seen' | 'new' = (k) => (k === 'old' ? 'seen' : 'new')) {
  while (phaseOf(store) === 'train') {
    store.answerTraining(store.rightAnswer())
    timers.fire() // the feedback timer
  }
  while (phaseOf(store) === 'memory') store.answerMemory(memory(store.currentMemoryItem!.kind))
  if (phaseOf(store) === 'surprise') store.answerNoticed('no')
  while (phaseOf(store) === 'second') store.answerSecond(store.currentSecondItem!.group === 0 ? 0 : 1)
}

describe('commit, then reveal', () => {
  it('no name in Round 1 or at either memory test, and no score before the predictions are committed, on rendered markup', () => {
    const { store, timers, ctx } = make()
    expect(stage(ctx)).toMatch(/data-instruction/)
    expect(text(stage(ctx))).not.toMatch(NAMES)
    store.begin()
    expect(store.phase).toBe('train')
    for (let i = 0; i < 6; i++) {
      const m = stage(ctx)
      expect(m).toMatch(/data-stage="train"/)
      expect(text(m)).not.toMatch(NAMES)
      expect(m).not.toMatch(/data-name=/)
      store.answerTraining(store.rightAnswer())
      expect(text(stage(ctx))).not.toMatch(NAMES)
      timers.fire()
    }
    while (phaseOf(store) === 'train') {
      store.answerTraining(store.rightAnswer())
      timers.fire()
    }
    expect(store.phase).toBe('memory')
    expect(text(stage(ctx))).not.toMatch(NAMES)
    expect(stage(ctx)).toMatch(/data-stage="memory"/)
    while (phaseOf(store) === 'memory') store.answerMemory('new')
    expect(store.phase).toBe('surprise')
    expect(text(stage(ctx))).not.toMatch(NAMES)
    store.answerNoticed('yes')
    expect(stage(ctx)).toMatch(/data-stage="sort"/)
    expect(text(stage(ctx))).toContain('Kind 1')
    expect(text(stage(ctx))).not.toMatch(NAMES)
    while (phaseOf(store) === 'second') store.answerSecond(0)
    expect(store.phase).toBe('between')
    expect(store.progress.isComplete('p5-round1')).toBe(true)
    // Round 2's instruction names the groups; its memory test does not.
    expect(text(stage(ctx))).toMatch(NAMES)
    store.begin()
    expect(store.round).toBe(1)
    const m2 = stage(ctx)
    expect(m2).toMatch(/data-stage="train"/)
    expect(text(m2)).toMatch(NAMES) // the two buttons
    store.answerTraining('0')
    expect(stage(ctx)).toMatch(/data-name=/) // the correct name under the member during feedback
    timers.fire()
    while (phaseOf(store) === 'train') {
      store.answerTraining(store.rightAnswer())
      timers.fire()
    }
    expect(store.phase).toBe('memory')
    expect(text(stage(ctx))).not.toMatch(NAMES)
    while (phaseOf(store) === 'memory') store.answerMemory('seen')
    expect(store.phase).toBe('second')
    expect(text(stage(ctx))).toMatch(NAMES)
    while (phaseOf(store) === 'second') store.answerSecond(1)
    expect(store.phase).toBe('predict')
    const p = stage(ctx)
    expect(p).toMatch(/data-stage="predict"/)
    expect(p).not.toMatch(/data-lines="scores"|data-stage="reveal"|d′/)
    expect(right(ctx)).not.toMatch(/data-lines="results-rows"/)
    expect(store.scores()).toBeNull()
    for (const k of Object.values(PREDICTION_KEYS)) store.choose(k, 'Round 1')
    store.commitPredictions()
    expect(store.phase).toBe('revealed')
    const r = stage(ctx)
    expect(r).toMatch(/data-stage="reveal"/)
    expect(r).toMatch(/data-lines="scores"/)
    expect(text(r)).toContain('stereotype')
    expect(right(ctx)).toMatch(/data-lines="results-rows"/)
    const sc = store.scores()!
    expect(sc.round1.hitRate).toBe(0)
    expect(sc.round2.hitRate).toBe(1)
    expect(sc.round2.falseAlarmRateNew).toBe(1)
  })
  it('the training runs 48 trials on its timers: an unanswered trial counts as wrong after the limit, and the feedback timer brings the next', () => {
    const { store, timers } = make(8)
    store.begin()
    expect(store.trial).toBe(0)
    expect(timers.pending()).toBe(1)
    timers.fire() // the 4-second limit passes with no answer
    expect(store.trialStage).toBe('feedback')
    expect(store.answers.training[0].answer).toBeNull()
    expect(store.answers.training[0].right).toBe(false)
    timers.fire() // the feedback second
    expect(store.trial).toBe(1)
    store.answerTraining(store.rightAnswer())
    expect(store.answers.training[1].right).toBe(true)
    timers.fire()
    let n = 2
    while (phaseOf(store) === 'train') {
      store.answerTraining('first')
      timers.fire()
      n++
    }
    expect(n).toBe(TRAINING_TRIALS)
    expect(store.answers.training.length).toBe(TRAINING_TRIALS)
    // The first showing of each member is 'first'; later showings are 'seen'.
    const firsts = store.answers.training.filter((t) => t.right).length
    expect(firsts).toBe(12 - 1) // trial 0 timed out
  })
  it('an interrupted round restarts with its reserve version and the note; a restart after the surprise is noted as such', () => {
    const box = memoryStorage()
    const a = make(13, box)
    a.store.begin()
    const members = a.store.materials.members.map((m) => `${m.marking}|${m.patch}`).join()
    a.store.answerTraining(a.store.rightAnswer())
    const b = make(13, box)
    expect(b.store.phase).toBe('intro')
    expect(b.progress.materialsSlot('p5-round1')).toBe(1)
    expect(b.progress.restarts('p5-round1')).toBe(1)
    b.store.begin()
    expect(b.store.materials.slot).toBe(1)
    expect(b.store.materials.family.family).toBe(a.store.materials.family.family)
    expect(b.store.materials.members.map((m) => `${m.marking}|${m.patch}`).join()).not.toBe(members)
    playRound(b.store, b.timers)
    expect(b.store.phase).toBe('between')
    expect(b.store.restartedAfterSurprise).toBe(false)
    // Round 2 interrupted during its sorting test, after Round 1 was done.
    b.store.begin()
    while (phaseOf(b.store) === 'train') {
      b.store.answerTraining(b.store.rightAnswer())
      b.timers.fire()
    }
    const c = make(13, box)
    expect(c.store.round).toBe(1)
    expect(c.store.phase).toBe('between')
    expect(c.progress.materialsSlot('p5-round2')).toBe(1)
    c.store.begin()
    playRound(c.store, c.timers)
    expect(c.store.phase).toBe('predict')
    for (const k of Object.values(PREDICTION_KEYS)) c.store.choose(k, 'Round 2')
    c.store.commitPredictions()
    const r = text(stage(c.ctx))
    expect(r).toMatch(/Round 1 and Round 2 was interrupted and run again with other members/)
    expect(r).not.toMatch(/already knew about the kinds/)
    // A Round 1 interrupted after its surprise screen.
    const box2 = memoryStorage()
    const d = make(21, box2)
    d.store.begin()
    while (phaseOf(d.store) === 'train') {
      d.store.answerTraining(d.store.rightAnswer())
      d.timers.fire()
    }
    while (phaseOf(d.store) === 'memory') d.store.answerMemory('new')
    expect(d.store.phase).toBe('surprise')
    const e = make(21, box2)
    expect(e.store.restartedAfterSurprise).toBe(false)
    e.store.begin()
    playRound(e.store, e.timers)
    expect(e.store.restartedAfterSurprise).toBe(true)
  })
  it('the same seed gives the same materials and orders, and reloading after the reveal returns to it', () => {
    const box = memoryStorage()
    const a = make(2, box)
    a.store.begin()
    const order = a.store.materials.training.join()
    playRound(a.store, a.timers)
    a.store.begin()
    playRound(a.store, a.timers)
    for (const k of Object.values(PREDICTION_KEYS)) a.store.choose(k, 'about the same')
    a.store.commitPredictions()
    const b = make(2, box)
    expect(b.store.phase).toBe('revealed')
    expect(b.store.scores()!.round1.sortingAccuracy).toBe(1)
    const c = new CreaturesStore(2, new ProgressStore(memoryStorage(), 2))
    c.begin()
    expect(c.materials.training.join()).toBe(order)
  })
})
