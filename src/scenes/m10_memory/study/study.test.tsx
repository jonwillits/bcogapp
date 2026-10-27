import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { makeRng } from '../../../sim/random'
import { ProgressStore } from '../../../sim/memory/progress/store'
import type { RawStorage } from '../../../sim/memory/progress/storage'
import { planPart2, wordsOf, SET_SIZE } from '../../../sim/memory/words/sets'
import { study, STUDY_INTRO } from '../PartStudy'
import { StudyStore } from './studyStore'
import { arcLines, ARC_LINE_WIDTH, scoreUnit } from './Reveal'
import type { PartContext } from '../contract'

/**
 * Part 2 on rendered markup: the order of the conditions, what each study
 * screen shows, nothing scored or named before the reveal, the browser
 * given no way to help with recall, an interrupted unit restarted with the
 * reserve set, and the reveal with its clustering pieces.
 */

function memory(): RawStorage & { text: string | null } {
  const m = { text: null as string | null, read: () => m.text, write: (t: string) => ((m.text = t), true) }
  return m
}

function ctxFor(seed: number, storage: RawStorage): PartContext<StudyStore> & { store: StudyStore } {
  const progress = new ProgressStore(storage, seed)
  const store = study.createStore(seed, progress)
  return { seed, progress, store, view: 'eye', fov: 75, lowDetail: false, anim: makeRng(1), clock: () => 0, header: null, openTab: () => {} }
}

const Left = study.Left
const Stage = study.Stage
const Right = study.Right
const Results = study.Results!
const screens = (ctx: PartContext<StudyStore>) => [renderToStaticMarkup(<Left ctx={ctx} />), renderToStaticMarkup(<Stage ctx={ctx} />), renderToStaticMarkup(<Right ctx={ctx} />)].join('\n')
const FORBIDDEN = /organiz|cluster|categor|\bgroup|schema|typical/i

function runUnit(s: StudyStore, typed: string[]) {
  s.begin()
  s.studyDone()
  s.countDone(9, 1)
  s.recallDone(typed)
}

describe('Part 2: the order, the screens, and what is hidden before the reveal', () => {
  it('the scrambled list is always first: its screen shows the 24 words and no label; the second set shows the eight labels', () => {
    const ctx = ctxFor(11, memory())
    const s = ctx.store
    expect(s.unit).toBe('first')
    s.begin()
    const first = renderToStaticMarkup(<Stage ctx={ctx} />)
    expect(first).toMatch(/data-grid/)
    expect(first).not.toMatch(/data-label/)
    for (const w of wordsOf(s.plan.scrambled.set)) expect(first).toContain(`>${w}<`)
    expect(s.plan.scrambled.grid.flat().length).toBe(SET_SIZE)
    s.studyDone()
    s.countDone(5, 0)
    s.recallDone(['horse', 'tiger'])
    expect(s.unit).toBe('second')
    s.begin()
    const second = renderToStaticMarkup(<Stage ctx={ctx} />)
    expect(second).toMatch(/data-tree/)
    expect((second.match(/data-label/g) ?? []).length).toBe(8)
    for (const w of wordsOf(s.plan.organized.set)) expect(second).toContain(`>${w}<`)
  })

  it('before the reveal, no screen names organization, clustering or categories, and nothing typed is shown back or scored', () => {
    const ctx = ctxFor(12, memory())
    const s = ctx.store
    expect(screens(ctx)).not.toMatch(FORBIDDEN)
    s.begin()
    expect(screens(ctx)).not.toMatch(FORBIDDEN)
    s.studyDone()
    expect(screens(ctx)).not.toMatch(FORBIDDEN)
    expect(screens(ctx)).toMatch(/data-counting/)
    s.countDone(3, 0)
    expect(screens(ctx)).toMatch(/data-recall/)
    expect(screens(ctx)).not.toMatch(FORBIDDEN)
    s.recallDone(['eagle', 'zebra'])
    const between = screens(ctx)
    expect(between).not.toMatch(FORBIDDEN)
    expect(between).not.toMatch(/zebra|eagle/)
    expect(between).not.toMatch(/data-reveal/)
    for (const screen of Object.values(STUDY_INTRO)) expect(screen.willDo.join(' ')).not.toMatch(FORBIDDEN)
  })

  it('the recall box and the counting task give the browser no way to help', () => {
    const ctx = ctxFor(13, memory())
    const s = ctx.store
    s.begin()
    s.studyDone()
    const count = renderToStaticMarkup(<Stage ctx={ctx} />)
    expect(count).not.toMatch(/<input/)
    expect((count.match(/data-count-options/g) ?? []).length).toBe(1)
    expect((count.match(/<button/g) ?? []).length).toBe(2)
    expect(count).toContain(`>${s.countFrom}<`)
    expect(count).toContain(`>${s.countFrom - 3}<`)
    expect(count).toMatch(/data-countdown="big"/)
    s.countDone(1, 0)
    const recall = renderToStaticMarkup(<Stage ctx={ctx} />)
    expect(recall).toMatch(/autocomplete="off"/i)
    expect(recall).toMatch(/autocorrect="off"/i)
    expect(recall).toMatch(/autocapitalize="off"/i)
    expect(recall).toMatch(/spellcheck="false"/i)
    // No study word is in the recall screen's markup.
    for (const w of wordsOf(s.plan.scrambled.set)) expect(recall).not.toContain(`>${w}<`)
  })
})

describe('Part 2: units and reserve materials (§4.3)', () => {
  it('an interrupted unit restarts with the reserve set, never with the set already shown, and the reveal says it was restarted', () => {
    const m = memory()
    const ctx = ctxFor(14, m)
    const shown = ctx.store.plan.scrambled.set.id
    ctx.store.begin()
    // The page is closed partway: a fresh load from the same storage.
    const again = ctxFor(14, m)
    expect(again.progress.status('p2-first')).toBe('not started')
    again.store.begin()
    expect(again.store.materials!.set.id).toBe(again.store.plan.reserve.id)
    expect(again.store.materials!.set.id).not.toBe(shown)
    expect(again.store.materials!.grid).toBeDefined()
    again.store.studyDone()
    again.store.countDone(2, 0)
    again.store.recallDone(['church'])
    expect(again.store.result('first')!.restarted).toBe(true)
    // The second unit uses its own set, and the reveal carries the restarted line.
    again.store.begin()
    expect(again.store.materials!.set.id).toBe(again.store.plan.organized.set.id)
    again.store.studyDone()
    again.store.countDone(2, 0)
    again.store.recallDone(['nose'])
    const right = renderToStaticMarkup(<Right ctx={again} />)
    expect(right).toMatch(/interrupted and run again/)
  })

  it('a completed unit is read back on load and never redone', () => {
    const m = memory()
    const ctx = ctxFor(15, m)
    runUnit(ctx.store, ['horse'])
    const again = ctxFor(15, m)
    expect(again.store.unit).toBe('second')
    expect(again.store.result('first')!.typed).toEqual(['horse'])
    again.store.begin()
    expect(again.progress.status('p2-first')).toBe('complete')
  })

  it('the same seed gives the same plan and grid; different seeds differ', () => {
    expect(JSON.stringify(planPart2(7))).toBe(JSON.stringify(planPart2(7)))
    expect(JSON.stringify(planPart2(7))).not.toBe(JSON.stringify(planPart2(8)))
  })
})

describe('Part 2: the reveal (§6.3)', () => {
  it('after both units, the reveal shows words recalled, two ARC values with their pieces, the colored output and the two reference panels', () => {
    const ctx = ctxFor(16, memory())
    const s = ctx.store
    const a = wordsOf(s.plan.scrambled.set)
    const b = wordsOf(s.plan.organized.set)
    runUnit(s, [a[0], a[1], a[4], a[5], 'zzz'])
    runUnit(s, [b[0], b[1], b[2], b[3], b[4]])
    expect(s.phase).toBe('done')
    const right = renderToStaticMarkup(<Right ctx={ctx} />)
    expect(right).toMatch(/data-reveal="study"/)
    expect(right).toMatch(/data-lines="arc"/)
    expect(right).toMatch(/ARC = \(R − E\(R\)\) \/ \(maxR − E\(R\)\)/)
    expect(right).toMatch(/data-reference="bower1969"/)
    expect(right).toMatch(/data-reference="roenker1971"/)
    expect(right).toMatch(/Reference pending/)
    expect(right).toMatch(/line-through/)
    expect((right.match(/data-colored-output/g) ?? []).length).toBe(2)
    const o = scoreUnit(s.result('second')!)
    expect(o.recalled).toBe(5)
    expect(o.pieces.arc).toBe(1)
    expect(arcLines(o.pieces)[6]).toMatch(/=\s+1\.00$/)
    const sc = scoreUnit(s.result('first')!)
    expect(sc.recalled).toBe(4)
    expect(sc.matched[4]).toBeNull()
    for (const l of [...arcLines(o.pieces), ...arcLines(sc.pieces)]) expect(l.length).toBeLessThanOrEqual(ARC_LINE_WIDTH)
    expect((right.match(/data-missed/g) ?? []).length).toBe(2)
    const center = renderToStaticMarkup(<Stage ctx={ctx} />)
    expect(center).toMatch(/data-finished-explanation/)
    expect(center).toMatch(/data-lines="arc-terms"/)
    expect(center).toContain('you typed 5 of its words (N)')
  })

  it('My results, all parts, gets four rows', () => {
    const ctx = ctxFor(17, memory())
    const s = ctx.store
    runUnit(s, wordsOf(s.plan.scrambled.set).slice(0, 6))
    runUnit(s, wordsOf(s.plan.organized.set).slice(0, 8))
    const r = renderToStaticMarkup(<Results ctx={ctx} />)
    expect(r).toMatch(/Scrambled list, words recalled/)
    expect(r).toMatch(/Organized list, ARC/)
  })
})

describe('Part 2: the sources', () => {
  it('only Reveal.tsx names the conditions and clustering; the store and the screens do not', () => {
    const files = import.meta.glob(['../PartStudy.tsx', './studyStore.ts'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>
    for (const [path, src] of Object.entries(files)) {
      // Identifiers the code needs (the unit names and ids) are not on screen; the test holds the visible text: string literals on one line, and JSX text.
      const code = src
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '')
        .replace(/'(p2-)?(scrambled|organized)'/g, "''")
      const literals = [...code.matchAll(/(['"])([^'"\n]*?)\1/g)].map((m) => m[2])
      const jsx = [...code.matchAll(/>([^<>{}]+)</g)].map((m) => m[1])
      for (const t of [...literals, ...jsx]) expect(t, `${path}: ${t}`).not.toMatch(FORBIDDEN)
    }
  })
  it('no British spellings, and no agentic verb about the program', () => {
    const files = import.meta.glob(['../PartStudy.tsx', './studyStore.ts', './Reveal.tsx'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>
    for (const [path, src] of Object.entries(files)) {
      expect(src, path).not.toMatch(/\bcolour|\bbehaviour|\bcentre\b|\banalyse|\bgrey\b|\bmetres?\b/i)
      expect(src, path).not.toMatch(/the (program|store|scene) (knows|notices|decides|remembers|wants)/i)
    }
  })
})
