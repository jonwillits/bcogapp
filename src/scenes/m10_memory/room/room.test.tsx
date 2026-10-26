import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ProgressStore } from '../../../sim/memory/progress/store'
import { arrangementFor, isPresent, otherArrangement } from '../../../sim/memory/room/arrangements'
import { ITEMS } from '../../../sim/memory/room/items'
import { PATH_SECONDS } from '../../../sim/memory/room/path'
import { room, ROOM_INTRO, CHECKLIST_INTRO, countFrom } from '../PartRoom'
import { RoomStore, UNIT } from './roomStore'
import type { Confidence } from '../../../sim/memory/room/checklist'

/**
 * Part 3 on rendered markup: the instruction screen says only what will
 * happen in order; before the checklist's own screen no reachable string
 * contains the six words Jon's answer 6 bans; nothing of the room's
 * contents, no item type and no mark of present or absent before the
 * commit; the scorecards after it; the restart takes the other
 * arrangement; the same seed gives the same order.
 */

const memory = () => {
  let text: string | null = null
  return { read: () => text, write: (t: string) => ((text = t), true) }
}

function ctxFor(store: RoomStore) {
  return { store, header: null, progress: store.progress, seed: store.seed } as never
}

const Left = room.Left as (p: { ctx: never }) => React.ReactElement
const Stage = room.Stage as (p: { ctx: never }) => React.ReactElement
const Right = room.Right as (p: { ctx: never }) => React.ReactElement
const markup = (store: RoomStore) =>
  renderToStaticMarkup(
    <>
      <Left ctx={ctxFor(store)} />
      <Stage ctx={ctxFor(store)} />
      <Right ctx={ctxFor(store)} />
    </>,
  )

const BANNED_BEFORE_CHECKLIST = /\b(remember|memoriz|study|studi|test|recall|recogni)\w*/i
const REVEAL_WORDS = /schema|typical|fitting|consistent|expected|\bfits?\b/i

function fresh(seed = 11) {
  const progress = new ProgressStore(memory(), seed)
  return new RoomStore(seed, progress)
}

function runToChecklist(s: RoomStore) {
  s.setLoaded()
  s.begin()
  for (let k = 0; k < Math.ceil(PATH_SECONDS / 0.02) + 2; k++) s.tick(0.02)
  expect(s.phase).toBe('count')
  s.countDone()
  s.beginChecklist()
}

describe('Part 3 before the checklist: nothing names what it tests', () => {
  it('the instruction screen says what will happen in order, and no reachable string before the checklist’s screen contains the banned words', () => {
    const s = fresh()
    const intro = markup(s)
    expect(intro).toContain('a room for 30 seconds')
    expect(intro).toContain('counting task')
    expect(intro).toContain('some questions')
    expect(intro).not.toMatch(/contents|things in the room|about the room/i)
    for (const l of [...ROOM_INTRO.willDo, ...ROOM_INTRO.keys]) expect(l).not.toMatch(BANNED_BEFORE_CHECKLIST)
    expect(intro).not.toMatch(BANNED_BEFORE_CHECKLIST)
    expect(intro).not.toMatch(REVEAL_WORDS)
    s.setLoaded()
    s.begin()
    expect(s.phase).toBe('room')
    s.tick(5)
    const during = markup(s)
    expect(during).not.toMatch(BANNED_BEFORE_CHECKLIST)
    expect(during).not.toMatch(REVEAL_WORDS)
    for (const it of ITEMS) expect(during).not.toContain(it.name)
    for (let k = 0; k < Math.ceil(PATH_SECONDS / 0.02) + 2; k++) s.tick(0.02)
    expect(s.phase).toBe('count')
    const count = markup(s)
    expect(count).not.toMatch(BANNED_BEFORE_CHECKLIST)
    expect(count).toContain(String(countFrom(s.seed)))
    s.countDone()
    const ci = markup(s)
    for (const l of CHECKLIST_INTRO.willDo) expect(ci).toContain(l.slice(0, 30))
    expect(ci).not.toMatch(REVEAL_WORDS)
  })
  it('Begin waits for the models to load', () => {
    const s = fresh()
    expect(markup(s)).toMatch(/disabled=""[^>]*>Begin|The room is loading/)
    s.begin()
    expect(s.phase).toBe('intro')
    s.setLoaded()
    s.begin()
    expect(s.phase).toBe('room')
    expect(s.progress.status(UNIT)).toBe('in progress')
  })
})

describe('the checklist and the commit', () => {
  it('names come one at a time with no hint of type; nothing of the room before the last answer; the scorecards after', () => {
    const s = fresh(12)
    runToChecklist(s)
    expect(s.phase).toBe('checklist')
    for (let i = 0; i < 24; i++) {
      const m = markup(s)
      const item = s.currentItem!
      expect(m).toContain(item.name)
      expect(m).not.toMatch(REVEAL_WORDS)
      expect(m).not.toMatch(/data-scorecard|data-reveal|Hit|False alarm|was in the room|present|absent/)
      // No other item's name is on the screen.
      for (const it of ITEMS) if (it.id !== item.id) expect(m).not.toContain(it.name)
      s.answerInRoom(i % 2 === 0)
      expect(markup(s)).toContain('How sure are you?')
      s.answerConfidence(((i % 4) + 1) as Confidence)
    }
    expect(s.phase).toBe('revealed')
    expect(s.progress.isComplete(UNIT)).toBe(true)
    const after = markup(s)
    expect(after).toMatch(/data-scorecard="fitting"/)
    expect(after).toMatch(/data-scorecard="unfitting"/)
    expect(after).toContain('schema')
    expect(after).toMatch(/data-reference="brewer1981"/)
    expect(after).toMatch(/data-pending/)
    expect(after).toContain('d′')
    expect((after.match(/Hit/g) ?? []).length).toBeGreaterThanOrEqual(2)
    const counts = s.score!.fitting.counts
    expect(counts.hits + counts.misses + counts.falseAlarms + counts.correctRejections).toBe(12)
  })
  it('a saved result reopens on the reveal with identical scores', () => {
    const progress = new ProgressStore(memory(), 13)
    const s = new RoomStore(13, progress)
    runToChecklist(s)
    for (let i = 0; i < 24; i++) {
      s.answerInRoom(isPresent(s.arrangement, s.currentItem!.id))
      s.answerConfidence(4)
    }
    const again = new RoomStore(13, progress)
    expect(again.phase).toBe('revealed')
    expect(JSON.stringify(again.score)).toBe(JSON.stringify(s.score))
    expect(again.score!.fitting.counts).toEqual({ hits: 6, misses: 0, falseAlarms: 0, correctRejections: 6 })
  })
  it('an interrupted run restarts with the other arrangement, and says so on the reveal', () => {
    const storage = memory()
    const p1 = new ProgressStore(storage, 14)
    const s1 = new RoomStore(14, p1)
    s1.setLoaded()
    s1.begin()
    s1.tick(3)
    // Reload: the unit was in progress, so it is discarded and the reserve arrangement is used.
    const p2 = new ProgressStore(storage, 14)
    const s2 = new RoomStore(14, p2)
    expect(s2.phase).toBe('intro')
    expect(s2.arrangement).toBe(otherArrangement(s1.arrangement))
    expect(s2.arrangement).toBe(arrangementFor(14, 1))
    expect(s2.restarted).toBe(true)
    runToChecklist(s2)
    for (let i = 0; i < 24; i++) {
      s2.answerInRoom(true)
      s2.answerConfidence(2)
    }
    expect(markup(s2)).toContain('interrupted and run again')
  })
  it('the same seed gives the same arrangement and order', () => {
    expect(fresh(21).order).toEqual(fresh(21).order)
    expect(fresh(21).arrangement).toBe(fresh(21).arrangement)
    expect(fresh(21).order).not.toEqual(fresh(22).order)
  })
})

describe('the words that name the hypothesis live only in the reveal', () => {
  it('no scene file of Part 3 but Reveal.tsx contains them in a visible string', () => {
    const files = import.meta.glob(['./*.{ts,tsx}', '../PartRoom.tsx'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>
    for (const [path, src] of Object.entries(files)) {
      if (path.includes('.test.') || path.endsWith('Reveal.tsx')) continue
      const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
      const literals = [...code.matchAll(/(['"`])((?:\\.|(?!\1)[\s\S])*?)\1/g)].map((m) => m[2])
      const jsx = [...code.matchAll(/>([^<>{}]+)</g)].map((m) => m[1])
      for (const t of [...literals, ...jsx]) expect(t, `${path}: ${t}`).not.toMatch(/schema|typical|consistent|expected|\bfits?\b/i)
    }
  })
})
