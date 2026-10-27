import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ProgressStore } from '../../../sim/memory/progress/store'
import type { RawStorage } from '../../../sim/memory/progress/storage'
import { ALL_STUDY_LISTS, listById, UNRELATED_LENGTH } from '../../../sim/memory/words/lists'
import { BLANK_S, WORD_ON_S } from '../../../sim/memory/words/design'
import { ListsStore, SLOT_COUNT, THEN_S, unitOfSlot, type ListResult, type Timers } from './listsStore'
import { ListsLeft, ListsStage, LISTS_WILL_DO, RECOGNITION_WILL_DO } from './screens'
import { ListsReveal, ListsRight, resultRows } from './Reveal'
import { lists } from '../PartLists'

/**
 * Part 1's acceptance tests (spec §12 items 1 and 2, §14): nothing gives
 * away the part before its reveal; typed recall cannot be helped by the
 * browser; completed units are never redone and an interrupted one
 * restarts with reserve materials; the same seed reproduces the plan.
 */

const FORBIDDEN = /false|lure|critical|associate|schema|typical|organiz|intrusion|drm/i

function memoryStorage(initial: string | null = null): { raw: () => string | null; storage: RawStorage } {
  let raw = initial
  return { raw: () => raw, storage: { read: () => raw, write: (t) => ((raw = t), true) } }
}

/** Timers on a fake clock: nothing fires until the clock is advanced. */
function fakeTimers(): Timers & { advance(ms: number): void; pending(): number } {
  let now = 0
  let queue: { at: number; fn: () => void; id: number }[] = []
  let nextId = 1
  return {
    set: (fn, ms) => {
      const id = nextId++
      queue.push({ at: now + ms, fn, id })
      return id
    },
    clear: (id) => {
      queue = queue.filter((q) => q.id !== id)
    },
    now: () => now,
    advance(ms) {
      const until = now + ms
      for (;;) {
        const due = queue.filter((q) => q.at <= until).sort((a, b) => a.at - b.at)[0]
        if (!due) break
        now = due.at
        queue = queue.filter((q) => q.id !== due.id)
        due.fn()
      }
      now = until
    },
    pending: () => queue.length,
  }
}

function make(seed: number, mem = memoryStorage()) {
  const progress = new ProgressStore(mem.storage, seed)
  const timers = fakeTimers()
  const store = new ListsStore(seed, progress, timers)
  return { progress, store, timers, mem }
}

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;|&quot;/g, "'").replace(/\s+/g, ' ')
const ctxOf = (store: ListsStore) => ({ store, progress: store.progress, header: null, seed: store.seed }) as never
const render = (store: ListsStore) => ({ stage: renderToStaticMarkup(<ListsStage ctx={ctxOf(store)} />), left: renderToStaticMarkup(<ListsLeft ctx={ctxOf(store)} />), right: renderToStaticMarkup(<ListsRight progress={store.progress} />) })

/** Every word that could be shown back: every word of every study list. */
const EVERY_WORD = new Set(ALL_STUDY_LISTS.flatMap((l) => [...l.words, ...(l.critical ? [l.critical] : [])]))
// No shared heading uses a list word (the instruction screen says *What you need*, since *ready* is on the rough list).
const SHARED_HEADING = new Set<string>()
const listWordsIn = (html: string, except: string | null = null): string[] => {
  const words = text(html).toLowerCase().match(/[a-z']+/g) ?? []
  return words.filter((w) => EVERY_WORD.has(w) && w !== except && !SHARED_HEADING.has(w))
}

/** Run one list from its start screen through recall, on the fake clock; returns the words that were on screen. */
function runList(s: ReturnType<typeof make>, typed: string[]): string[] {
  const { store, timers } = s
  store.beginList()
  expect(store.state).toBe('present')
  const seen: string[] = []
  const n = store.materials!.list.words.length
  for (let i = 0; i < n; i++) {
    expect(store.showing).toBe(true)
    seen.push(store.word!)
    timers.advance(WORD_ON_S * 1000)
    expect(store.word).toBeNull()
    timers.advance(BLANK_S * 1000)
  }
  expect(store.state).toBe('then')
  timers.advance(THEN_S * 1000)
  if (store.state === 'count') store.countDone(7, 1)
  expect(store.state).toBe('recall')
  store.recallDone(typed)
  return seen
}

function runAllLists(s: ReturnType<typeof make>): string[][] {
  const shown: string[][] = []
  while (s.store.state === 'intro' || s.store.state === 'list-start') shown.push(runList(s, ['tent', 'piano', 'xyzzy']))
  return shown
}

function answerAll(s: ReturnType<typeof make>, oldEvery = 2): void {
  const { store } = s
  store.beginRecognition()
  let k = 0
  while (store.state === 'recognition') {
    if (k++ % oldEvery === 0) {
      store.answerOld(true)
      store.judge(k % 3 === 0 ? 'know' : 'remember')
    } else store.answerOld(false)
  }
}

describe('nothing gives away Part 1 before its reveal (§12, item 2)', () => {
  it('every screen before the reveal is free of the forbidden words, and shows no list word but the one being presented', () => {
    const s = make(11)
    const { store, timers } = s
    const check = (label: string, except: string | null = null) => {
      const r = render(store)
      for (const [k, html] of Object.entries(r)) {
        expect(text(html), `${label}: ${k}`).not.toMatch(FORBIDDEN)
        expect(listWordsIn(html, except), `${label}: ${k}`).toEqual([])
      }
    }
    check('intro')
    for (let slot = 0; slot < SLOT_COUNT; slot++) {
      check(`list ${slot} start`)
      store.beginList()
      const n = store.materials!.list.words.length
      for (let i = 0; i < n; i++) {
        check(`list ${slot} word ${i}`, store.word)
        timers.advance(WORD_ON_S * 1000)
        check(`list ${slot} blank ${i}`)
        timers.advance(BLANK_S * 1000)
      }
      check(`list ${slot} then`)
      timers.advance(THEN_S * 1000)
      if (store.state === 'count') {
        check(`list ${slot} count`)
        store.countDone(5, 0)
      }
      check(`list ${slot} recall`)
      store.recallDone(['tent', 'piano', 'harbor'])
    }
    check('recognition intro')
    store.beginRecognition()
    while (store.state === 'recognition') {
      const w = store.currentItem!.word
      check(`recognition item ${store.item}`, w)
      store.answerOld(true)
      check(`recognition item ${store.item} judgment`, w)
      store.judge('remember')
    }
    expect(store.state).toBe('revealed')
  })

  it('the instruction screens name no effect and say how long and that it is one sitting', () => {
    const s = make(3)
    const intro = text(render(s.store).stage)
    expect(intro).not.toMatch(FORBIDDEN)
    expect(intro).toContain('About 15 minutes.')
    expect(intro).toContain('one sitting')
    expect(intro).toContain(`${SLOT_COUNT} lists of words, one word at a time`)
    expect(LISTS_WILL_DO.join(' ')).not.toMatch(/differ|some lists|kind of list|effect|primacy|recency|serial|position/i)
    expect(RECOGNITION_WILL_DO.join(' ')).not.toMatch(FORBIDDEN)
    expect(RECOGNITION_WILL_DO.join(' ')).toContain('Remember')
  })

  it('no source file in lists/ but Reveal.tsx carries a forbidden word in a string or in JSX text', () => {
    const files = import.meta.glob('./*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
    for (const [path, src] of Object.entries(files)) {
      if (path.includes('Reveal') || path.includes('.test.')) continue
      const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
      const literals = [...code.matchAll(/(['"`])((?:\\.|(?!\1)[\s\S])*?)\1/g)].map((m) => m[2])
      const jsx = [...code.matchAll(/>([^<>{}]+)</g)].map((m) => m[1])
      for (const t of [...literals, ...jsx]) expect(t, path).not.toMatch(FORBIDDEN)
    }
  })

  it('before the reveal the right panel and the results rows hold nothing from a record', () => {
    const s = make(5)
    runList(s, ['tent', 'badge'])
    const r = render(s.store)
    expect(r.right).not.toMatch(/tent|badge|data-lines="lists-results"/)
    expect(renderToStaticMarkup(<ListsReveal progress={s.progress} />)).toBe('')
    expect(renderToStaticMarkup(lists.Results!({ ctx: ctxOf(s.store) }) as never)).not.toMatch(/data-lines="lists-results"/)
  })
})

describe('typed recall cannot be helped by the browser', () => {
  it('the recall box has autocomplete, autocorrect, autocapitalize and spellcheck off', () => {
    const s = make(2)
    const { store, timers } = s
    store.beginList()
    const n = store.materials!.list.words.length
    timers.advance(n * (WORD_ON_S + BLANK_S) * 1000 + THEN_S * 1000)
    if (store.state === 'count') store.countDone(0, 0)
    const html = renderToStaticMarkup(<ListsStage ctx={ctxOf(store)} />)
    expect(html).toMatch(/data-recall/)
    expect(html).toMatch(/autocomplete="off"/i)
    expect(html).toMatch(/autocorrect="off"/i)
    expect(html).toMatch(/autocapitalize="off"/i)
    expect(html).toMatch(/spellcheck="false"/i)
  })
})

describe('units: completed lists are never redone, an interrupted one restarts with reserve materials (§4.3)', () => {
  it('each list unit, interrupted and reloaded, restarts with a reserve list and never a list already shown', () => {
    for (let k = 0; k < SLOT_COUNT; k++) {
      const s = make(100 + k)
      const shown = new Set<string>()
      for (let j = 0; j < k; j++) runList(s, ['tent']).forEach((w) => shown.add(w))
      const beforeId = s.store.materialsForSlot(k).materials.list.id
      s.store.beginList()
      const shownNow = [...s.store.materials!.list.words]
      s.timers.advance(2000)
      shownNow.forEach((w) => shown.add(w))
      // The page is closed and opened again: a new store from the same saved text.
      const again = make(100 + k, s.mem)
      expect(again.store.slot).toBe(k)
      expect(again.store.state).toBe(k === 0 ? 'list-start' : 'list-start')
      expect(again.progress.interrupted.map((u) => u.unit)).toContain(unitOfSlot(k))
      const m = again.store.materialsForSlot(k)
      expect(m.materials.list.id).not.toBe(beforeId)
      expect(m.materials.list.kind).toBe('unrelated')
      expect(m.materials.list.words.length).toBe(UNRELATED_LENGTH)
      for (const w of m.materials.list.words) expect(shown.has(w), `${w} already shown`).toBe(false)
      expect(m.materials.lostAssociates).toBe(listById(beforeId).kind === 'associates')
      for (let j = 0; j < k; j++) expect(again.progress.isComplete(unitOfSlot(j))).toBe(true)
      // And it runs, and the result records the restart.
      runList(again, ['tent'])
      const res = again.progress.result(unitOfSlot(k)) as ListResult
      expect(res.restarts).toBe(1)
      expect(res.listId).toBe(m.materials.list.id)
    }
  })

  it('reserves are shared by the whole part, in order; a third restart reuses the last reserve and says so', () => {
    let s = make(77)
    const used: string[] = []
    for (let slot = 0; slot < 3; slot++) {
      s.store.beginList()
      s = make(77, s.mem)
      const m = s.store.materialsForSlot(slot)
      used.push(m.materials.list.id)
      if (used.length === 3) {
        expect(m.exhausted).toBe(true)
        expect(m.materials.list.id).toBe(used[1])
      }
      runList(s, ['tent'])
    }
    expect(used[0]).toBe(s.store.plan.reserves[0].id)
    expect(used[1]).toBe(s.store.plan.reserves[1].id)
  })

  it('the recognition test resumes minus the items answered, and a reload with every unit complete lands on the reveal', () => {
    const s = make(9)
    runAllLists(s)
    expect(s.store.state).toBe('recognition-intro')
    s.store.beginRecognition()
    for (let i = 0; i < 5; i++) {
      s.store.answerOld(i % 2 === 0)
      if (i % 2 === 0) s.store.judge('know')
    }
    const again = make(9, s.mem)
    expect(again.store.state).toBe('recognition')
    expect(again.store.item).toBe(5)
    expect(again.store.answers.slice(0, 5).every((a) => a !== null)).toBe(true)
    expect(again.store.items.map((i) => i.word)).toEqual(s.store.items.map((i) => i.word))
    while (again.store.state === 'recognition') again.store.answerOld(false)
    expect(again.store.state).toBe('revealed')
    const third = make(9, s.mem)
    expect(third.store.state).toBe('revealed')
  })

  it('a finished list is never run again: after a reload the store moves on to the next slot', () => {
    const s = make(13)
    runList(s, ['a'])
    runList(s, ['b'])
    const again = make(13, s.mem)
    expect(again.store.slot).toBe(2)
    expect(again.store.state).toBe('list-start')
  })
})

describe('the reveal (§5.6)', () => {
  it('after the recognition test it shows the critical words, the recognition proportions, the curves and the reference panels', () => {
    const s = make(21)
    runAllLists(s)
    answerAll(s)
    expect(s.store.state).toBe('revealed')
    const html = renderToStaticMarkup(<ListsReveal progress={s.progress} />)
    for (const l of s.store.plan.studied) expect(html).toContain(l.critical!)
    expect(html).toMatch(/data-lines="recognition-scores"/)
    expect(html).toMatch(/data-lines="critical"/)
    expect((html.match(/data-curve=/g) ?? []).length).toBe(2)
    for (const id of ['murdock1962', 'glanzer1966', 'roediger1995-recall', 'roediger1995-table2', 'warning']) expect(html).toContain(`data-reference="${id}"`)
    expect(html).toMatch(/data-pending/)
    expect(html).toContain('The reading prints a list of this kind')
    const right = renderToStaticMarkup(<ListsRight progress={s.progress} />)
    expect(right).toMatch(/data-lines="lists-results"/)
    const rows = resultRows(s.store.results(), s.store.recognitionResult!)
    expect(rows.length).toBe(11)
    for (const r of rows) expect(r.length, r).toBeLessThanOrEqual(58)
    expect(rows.find((r) => /remember\s+know$/.test(r))).toBeTruthy()
    expect(rows.join('\n')).toMatch(/critical words typed after their list\s+\d of 3/)
  })

  it('the typed words are classified: a studied word, a word from an earlier list, and another', () => {
    const s = make(22)
    const first = runList(s, [])
    runList(s, [first[0], 'xyzzy'])
    runAllLists(s)
    answerAll(s)
    const html = renderToStaticMarkup(<ListsReveal progress={s.progress} />)
    expect(html).toMatch(/data-entry="earlier"/)
    expect(html).toMatch(/data-entry="other"/)
    expect(html).toContain('(list 1)')
  })

  it('the restarted line appears only when a unit was restarted', () => {
    const s = make(23)
    runAllLists(s)
    answerAll(s)
    expect(renderToStaticMarkup(<ListsReveal progress={s.progress} />)).not.toContain('interrupted and run again')
    let t = make(24)
    t.store.beginList()
    t = make(24, t.mem)
    runAllLists(t)
    answerAll(t)
    expect(renderToStaticMarkup(<ListsReveal progress={t.progress} />)).toContain('interrupted and run again')
  })
})

describe('determinism and timing', () => {
  it('the same seed gives the same plan and the same recognition order', () => {
    const a = make(31)
    const b = make(31)
    expect(a.store.plan.slots.map((x) => `${x.list.id}:${x.recall}:${x.countFrom}`)).toEqual(b.store.plan.slots.map((x) => `${x.list.id}:${x.recall}:${x.countFrom}`))
    runAllLists(a)
    runAllLists(b)
    expect(a.store.items.map((i) => i.word)).toEqual(b.store.items.map((i) => i.word))
    expect(a.store.items.length).toBe(31)
  })

  it('each word is on for WORD_ON_S and off for BLANK_S, and the shown durations are recorded', () => {
    const s = make(32)
    s.store.beginList()
    const n = s.store.materials!.list.words.length
    s.timers.advance(WORD_ON_S * 1000 - 1)
    expect(s.store.showing).toBe(true)
    s.timers.advance(1)
    expect(s.store.showing).toBe(false)
    s.timers.advance(BLANK_S * 1000)
    expect(s.store.wordIndex).toBe(1)
    s.timers.advance((n - 1) * (WORD_ON_S + BLANK_S) * 1000 + THEN_S * 1000)
    if (s.store.state === 'count') s.store.countDone(0, 0)
    s.store.recallDone([])
    const res = s.progress.result(unitOfSlot(0)) as ListResult
    expect(res.shown.length).toBe(n)
    for (const r of res.shown) expect(r.shownMs).toBe(WORD_ON_S * 1000)
  })

  it('a delayed list goes to the counting task and an immediate one straight to recall; the then-screen says which', () => {
    const s = make(33)
    const sawCount: boolean[] = []
    while (s.store.state === 'intro' || s.store.state === 'list-start') {
      s.store.beginList()
      const recall = s.store.materials!.recall
      const n = s.store.materials!.list.words.length
      s.timers.advance(n * (WORD_ON_S + BLANK_S) * 1000)
      expect(s.store.state).toBe('then')
      expect(renderToStaticMarkup(<ListsStage ctx={ctxOf(s.store)} />)).toContain(recall === 'delayed' ? 'Count backward' : 'Type the words')
      s.timers.advance(THEN_S * 1000)
      const now = s.store.state as string
      expect(now).toBe(recall === 'delayed' ? 'count' : 'recall')
      sawCount.push(now === 'count')
      if (now === 'count') s.store.countDone(0, 0)
      s.store.recallDone([])
    }
    expect(sawCount.filter(Boolean).length).toBe(2)
    expect(sawCount.length).toBe(SLOT_COUNT)
  })

  it('every list has fifteen words, so no list stands out by its length', () => {
    const s = make(34)
    const lengths = s.store.plan.slots.map((x) => x.list.words.length)
    expect(lengths.filter((l) => l === UNRELATED_LENGTH).length).toBe(SLOT_COUNT)
    expect(s.store.plan.slots.filter((x) => x.list.kind === 'associates').length).toBe(3)
  })
})
