import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ProgressStore } from '../../../sim/social/progress/store'
import type { RawStorage } from '../../../sim/social/progress/storage'
import { PRESENTATION_SECONDS } from '../../../sim/social/groups/sets'
import { GroupsStore, SETS_UNIT, type Timers } from './groupsStore'
import { GroupsLeft, GroupsStage, GROUPS_WILL_DO } from './screens'
import { GroupsReveal, revealData } from './Reveal'

/**
 * Part 5 (spec §13 items 1 and 3, §16): no score before the last judgment;
 * the labels appear only in the labeled set; the bar starts away from the
 * creature's height and offset; an interrupted unit restarts with the
 * reserve sets; the strings test; the reveal's rows.
 */

function memoryStorage(): RawStorage & { text: string | null } {
  const box = { text: null as string | null, read: () => box.text, write: (t: string) => ((box.text = t), true) }
  return box
}
function fakeTimers(): Timers & { fire(): void; pending(): number } {
  let queue: { fn: () => void; id: number }[] = []
  let next = 1
  return {
    set: (fn) => {
      const id = next++
      queue.push({ fn, id })
      return id
    },
    clear: (id) => {
      queue = queue.filter((q) => q.id !== id)
    },
    fire: () => {
      const q = queue.shift()
      q?.fn()
    },
    pending: () => queue.length,
  }
}
function make(seed: number, box = memoryStorage()) {
  const progress = new ProgressStore(box, seed)
  const timers = fakeTimers()
  return { store: new GroupsStore(seed, progress, timers), progress, timers, box }
}
const ctxOf = (store: GroupsStore) => ({ store, progress: store.progress, header: null, seed: store.seed }) as never
const render = (store: GroupsStore) => renderToStaticMarkup(<GroupsStage ctx={ctxOf(store)} />) + renderToStaticMarkup(<GroupsLeft ctx={ctxOf(store)} />)
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;|&quot;/g, "'").replace(/\s+/g, ' ')
const FORBIDDEN = /stereotype|exaggerat|accentuat|\bbias|boundary|categor|Tajfel/i

function runSet(s: ReturnType<typeof make>) {
  const { store, timers } = s
  while (store.state === 'present') timers.fire()
  expect(store.state).toBe('judge')
  while (store.state === 'judge') {
    store.setBar(store.bar + 5)
    store.commitJudgment()
  }
}

describe('commit, then reveal', () => {
  it('the instruction screen and every screen before the reveal name nothing the part tests; the labels appear with the labeled set’s members only; no score before the last judgment', () => {
    const { store, timers } = make(3)
    for (const l of GROUPS_WILL_DO) expect(l).not.toMatch(FORBIDDEN)
    expect(text(render(store))).not.toMatch(FORBIDDEN)
    store.begin()
    expect(store.state).toBe('present')
    const labeledFirst = store.current.which === 'labeled'
    const m0 = render(store)
    expect(m0).toMatch(/data-stage="present"/)
    expect(m0).toMatch(/data-creature=/)
    if (labeledFirst) expect(m0).toMatch(/data-label="(Ostra|Velin)"/)
    else expect(m0).not.toMatch(/data-label=/)
    expect(text(m0)).not.toMatch(FORBIDDEN)
    expect(timers.pending()).toBe(1)
    for (let i = 0; i < 31; i++) timers.fire()
    expect(store.state).toBe('present')
    timers.fire()
    expect(store.state).toBe('judge')
    const j = render(store)
    expect(j).toMatch(/data-stage="judge"/)
    expect(j).toMatch(/data-bar=/)
    expect(text(j)).not.toMatch(FORBIDDEN)
    expect(j).not.toMatch(/data-reveal|data-lines="groups-rows"/)
    runSet({ store, timers } as never)
    expect(store.state).toBe('between')
    expect(revealData(store.progress, 3)).toBeNull()
    store.beginSecondSet()
    runSet({ store, timers } as never)
    expect(store.state).toBe('revealed')
    expect(store.progress.isComplete(SETS_UNIT)).toBe(true)
    const reveal = renderToStaticMarkup(<GroupsReveal progress={store.progress} seed={3} />)
    expect(reveal).toMatch(/data-stage="reveal"/)
    expect(reveal).toMatch(/data-lines="groups-rows"/)
    expect(reveal).toMatch(/Simulated class pending/)
    expect(reveal).toMatch(/stereotype/i)
  })
  it('the bar starts at a random height that is not the creature’s, with an offset baseline, and each member is judged twice', () => {
    const { store, timers } = make(5)
    store.begin()
    while (store.state === 'present') timers.fire()
    const set = store.current
    let starts = 0
    while (store.state === 'judge') {
      const m = set.members[store.judgedMember!]
      expect(Math.abs(store.bar / m.height - 1)).toBeGreaterThan(0.1)
      if (store.barOffset !== 0) starts++
      store.commitJudgment()
    }
    expect(starts).toBeGreaterThan(8)
    expect(store.judgments.length).toBe(16)
    for (let k = 0; k < 8; k++) expect(store.judgments.filter((j) => j.member === k).length).toBe(2)
  })
  it('an interrupted unit restarts with the reserve sets, with different creatures and names', () => {
    const box = memoryStorage()
    const a = make(7, box)
    a.store.begin()
    const firstBase = a.store.current.spec.base
    const b = make(7, box)
    expect(b.store.state).toBe('intro')
    expect(b.progress.materialsSlot(SETS_UNIT)).toBe(1)
    b.store.begin()
    expect(b.store.plan.names).toEqual(['Marl', 'Tesk'])
    expect(b.store.current.spec.base).not.toBe(firstBase)
    expect(PRESENTATION_SECONDS).toBe(2)
  })
})
