import { describe, it, expect } from 'vitest'
import { ProgressStore } from './store'
import { isSavedState, newState, MAX_STATE_BYTES } from './state'
import { describeReplacement, exportText, IMPORT_REASONS, parseImport } from './transfer'
import { UNIT_IDS, reservesFor, unitsOfPart } from '../parts'
import type { RawStorage } from './storage'

/**
 * Saved progress (spec §4.2–§4.4, §14): a saved state round-trips; an
 * interrupted unit is discarded on reload and restarted with reserve
 * materials, never with materials already shown; the recognition test
 * resumes; the part locks; blocked storage falls back to memory; a
 * committed prediction is never overwritten; Export and Load check what
 * they read.
 */

/** A storage in memory: what a browser's would hold, or nothing when blocked. */
function memoryStorage(initial: string | null = null, blocked = false): RawStorage & { text: string | null } {
  const box = {
    text: initial,
    read: () => box.text,
    write: (t: string) => {
      if (blocked) return false
      box.text = t
      return true
    },
  }
  return box
}

describe('a saved state round-trips', () => {
  it('complete a unit, reload from the same raw text, and it is complete with an identical result', () => {
    const box = memoryStorage()
    const a = new ProgressStore(box, 1234)
    expect(a.seed).toBe(1234)
    a.begin('p1-list-0')
    a.complete('p1-list-0', { typed: ['apple', 'desk'], seconds: 41.2 })
    const b = new ProgressStore(box)
    expect(b.seed).toBe(1234)
    expect(b.isComplete('p1-list-0')).toBe(true)
    expect(b.result('p1-list-0')).toEqual({ typed: ['apple', 'desk'], seconds: 41.2 })
    expect(b.interrupted).toEqual([])
    expect(b.storageAvailable).toBe(true)
  })

  it('a completed unit is never redone: begin and complete are ignored on it', () => {
    const box = memoryStorage()
    const s = new ProgressStore(box, 1)
    s.begin('p2-first')
    s.complete('p2-first', { n: 1 })
    s.begin('p2-first')
    s.complete('p2-first', { n: 2 })
    expect(s.result('p2-first')).toEqual({ n: 1 })
    expect(s.status('p2-first')).toBe('complete')
  })
})

describe('an interrupted unit restarts with reserve materials', () => {
  it('every unit with a reserve moves to the next slot on reload, and never shows slot 0 again', () => {
    for (const unit of UNIT_IDS) {
      if (unit === 'p1-recognition') continue
      const box = memoryStorage()
      const a = new ProgressStore(box, 7)
      expect(a.materialsSlot(unit)).toBe(0)
      a.begin(unit)
      const b = new ProgressStore(box)
      const reserves = reservesFor(unit)
      expect(b.status(unit), unit).toBe('not started')
      expect(b.restarts(unit), unit).toBe(1)
      expect(b.interrupted.map((i) => i.unit)).toEqual([unit])
      if (reserves > 1) {
        expect(b.materialsSlot(unit), unit).toBe(1)
        expect(b.interrupted[0].exhausted).toBe(false)
      } else {
        expect(b.materialsSlot(unit), unit).toBe(0)
        expect(b.interrupted[0].exhausted).toBe(true)
      }
      // Interrupted again: the next reserve, or the last one reused and reported exhausted.
      b.begin(unit)
      const c = new ProgressStore(box)
      expect(c.materialsSlot(unit), unit).toBe(Math.min(reserves - 1, 2))
      expect(c.restarts(unit)).toBe(2)
      expect(c.interrupted[0].exhausted).toBe(reserves <= 2)
      // Through every load, slot 0 is never used again.
      expect(c.materialsSlot(unit)).not.toBe(reserves > 1 ? 0 : -1)
    }
  })

  it('the recognition test resumes with the items already answered', () => {
    const box = memoryStorage()
    const a = new ProgressStore(box, 9)
    a.begin('p1-recognition')
    a.savePartial('p1-recognition', { answered: [{ word: 'hill', old: true, remember: true }] })
    const b = new ProgressStore(box)
    expect(b.status('p1-recognition')).toBe('in progress')
    expect(b.partial('p1-recognition')).toEqual({ answered: [{ word: 'hill', old: true, remember: true }] })
    expect(b.materialsSlot('p1-recognition')).toBe(0)
    expect(b.interrupted).toEqual([])
  })

  it('a completed unit is untouched by a reload, and the restart count is kept', () => {
    const box = memoryStorage()
    const a = new ProgressStore(box, 3)
    a.begin('p4-block-1')
    const b = new ProgressStore(box)
    b.begin('p4-block-1')
    b.complete('p4-block-1', { nights: 3 })
    const c = new ProgressStore(box)
    expect(c.isComplete('p4-block-1')).toBe(true)
    expect(c.restarts('p4-block-1')).toBe(1)
    expect(c.materialsSlot('p4-block-1')).toBe(1)
  })
})

describe('the order of the parts', () => {
  it('Parts 2 and 3 are locked until Part 1 is finished; Part 5 until Part 4 is, or the sample is used; 0, 1 and 4 are open', () => {
    const s = new ProgressStore(memoryStorage(), 5)
    expect(s.canOpen(0)).toBe(true)
    expect(s.canOpen(1)).toBe(true)
    expect(s.canOpen(4)).toBe(true)
    expect(s.canOpen(2)).toBe(false)
    expect(s.canOpen(3)).toBe(false)
    expect(s.canOpen(5)).toBe(false)
    expect(s.lockReason(2)).toBe('Opens once Part 1 is finished.')
    expect(s.lockReason(5)).toMatch(/Part 4/)
    expect(s.lockReason(1)).toBeNull()
    for (const u of unitsOfPart(1)) {
      s.begin(u)
      s.complete(u, {})
    }
    expect(s.partComplete(1)).toBe(true)
    expect(s.canOpen(2)).toBe(true)
    expect(s.canOpen(3)).toBe(true)
    expect(s.canOpen(5)).toBe(false)
    s.useSampleNights()
    expect(s.canOpen(5)).toBe(true)
    const t = new ProgressStore(memoryStorage(), 6)
    for (const u of unitsOfPart(4)) t.complete(u, {})
    expect(t.canOpen(5)).toBe(true)
  })

  it('Part 1 is finished only when all eleven lists and the recognition test are complete', () => {
    const s = new ProgressStore(memoryStorage(), 8)
    for (const u of unitsOfPart(1)) if (u !== 'p1-recognition') s.complete(u, {})
    expect(s.partComplete(1)).toBe(false)
    s.complete('p1-recognition', {})
    expect(s.partComplete(1)).toBe(true)
  })
})

describe('with storage blocked', () => {
  it('the lab runs from memory and reports the storage unavailable', () => {
    const s = new ProgressStore(memoryStorage(null, true), 11)
    expect(s.storageAvailable).toBe(false)
    s.begin('p1-list-0')
    s.complete('p1-list-0', { ok: true })
    expect(s.isComplete('p1-list-0')).toBe(true)
    s.commitPrediction('p4-block-2', 'more often')
    expect(s.prediction('p4-block-2')).toBe('more often')
  })

  it('a write that starts failing partway turns the storage off and the state stays in memory', () => {
    let fail = false
    const box = { text: null as string | null, read: () => box.text, write: (t: string) => { if (fail) return false; box.text = t; return true } }
    const s = new ProgressStore(box, 12)
    expect(s.storageAvailable).toBe(true)
    fail = true
    s.complete('p3-room', { d: 1 })
    expect(s.storageAvailable).toBe(false)
    expect(s.isComplete('p3-room')).toBe(true)
  })

  it('garbage in the storage is ignored and a fresh state begins', () => {
    const s = new ProgressStore(memoryStorage('{not json'), 13)
    expect(s.seed).toBe(13)
    const t = new ProgressStore(memoryStorage(JSON.stringify({ version: 2, seed: 1 })), 14)
    expect(t.seed).toBe(14)
  })
})

describe('predictions', () => {
  it('a prediction committed once is never overwritten', () => {
    const box = memoryStorage()
    const s = new ProgressStore(box, 2)
    s.commitPrediction('p5-step1', 'Tonight too')
    s.commitPrediction('p5-step1', 'Usual only')
    expect(s.prediction('p5-step1')).toBe('Tonight too')
    const t = new ProgressStore(box)
    expect(t.prediction('p5-step1')).toBe('Tonight too')
  })

  it('Clear my saved results draws a new seed and empties the state', () => {
    const box = memoryStorage()
    const s = new ProgressStore(box, 2)
    s.complete('p1-list-0', {})
    s.commitPrediction('k', 'v')
    s.clear()
    expect(s.seed).not.toBe(2)
    expect(s.isComplete('p1-list-0')).toBe(false)
    expect(s.prediction('k')).toBeNull()
    expect(new ProgressStore(box).seed).toBe(s.seed)
  })
})

describe('Export and Load', () => {
  it('exportText round-trips through parseImport', () => {
    const s = new ProgressStore(memoryStorage(), 21)
    s.complete('p1-list-3', { typed: ['lamp'] })
    s.commitPrediction('p4-block-2', 'less often')
    const r = parseImport(exportText(s.state))
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.state).toEqual(s.state)
    expect(exportText(s.state)).not.toMatch(/function|=>/)
  })

  it('rejects what it should, each with its own plain sentence', () => {
    const good = newState(1)
    const wrap = (state: unknown, kind: unknown = 'bcogapp.m10 saved results') => JSON.stringify({ kind, exported: 'x', state })
    expect(parseImport('x'.repeat(MAX_STATE_BYTES + 1))).toEqual({ ok: false, reason: IMPORT_REASONS.tooLarge })
    expect(parseImport('{"kind": ')).toEqual({ ok: false, reason: IMPORT_REASONS.notJson })
    expect(parseImport(wrap(good, 'something else'))).toEqual({ ok: false, reason: IMPORT_REASONS.wrongKind })
    expect(parseImport('[1,2,3]')).toEqual({ ok: false, reason: IMPORT_REASONS.wrongKind })
    expect(parseImport(wrap({ ...good, version: 2 }))).toEqual({ ok: false, reason: IMPORT_REASONS.wrongVersion })
    expect(parseImport(wrap({ ...good, seed: 'seven' }))).toEqual({ ok: false, reason: IMPORT_REASONS.wrongShape })
    expect(parseImport(wrap({ ...good, units: { ...good.units, 'p9-nothing': { status: 'complete', materials: 0, restarts: 0 } } }))).toEqual({ ok: false, reason: IMPORT_REASONS.wrongShape })
    expect(parseImport(wrap({ ...good, predictions: { a: 1 } }))).toEqual({ ok: false, reason: IMPORT_REASONS.wrongShape })
    // A prototype-shaped key, and a string that looks like code: both refused as the wrong shape.
    const proto = wrap(good).replace('"predictions":{}', '"predictions":{"__proto__":"x"}')
    expect(proto).toContain('__proto__')
    expect(parseImport(proto)).toEqual({ ok: false, reason: IMPORT_REASONS.wrongShape })
    const withCode = { ...good, units: { ...good.units, 'p1-list-0': { status: 'complete', materials: 0, restarts: 0, result: { f: 'x'.repeat(3000) } } } }
    expect(parseImport(wrap(withCode))).toEqual({ ok: false, reason: IMPORT_REASONS.wrongShape })
    for (const reason of Object.values(IMPORT_REASONS)) expect(reason).toMatch(/^[A-Z].*\.$/)
  })

  it('a string that reads as a function is data to the checker, and an overlong one is refused', () => {
    const good = newState(1)
    const s = { ...good, predictions: { p: 'function () { return 1 }' } }
    // Short strings are data: nothing executes them. The shape check only refuses what could not be a response.
    expect(isSavedState(s)).toBe(true)
    expect(isSavedState({ ...good, predictions: { p: 'a'.repeat(2001) } })).toBe(false)
  })

  it('isSavedState checks every field', () => {
    const good = newState(1)
    expect(isSavedState(good)).toBe(true)
    expect(isSavedState({ ...good, extra: 1 })).toBe(false)
    expect(isSavedState({ ...good, sampleNights: 'yes' })).toBe(false)
    expect(isSavedState({ ...good, seed: 1.5 })).toBe(false)
    const missing = { ...good, units: { ...good.units } }
    delete (missing.units as Record<string, unknown>)['p3-room']
    expect(isSavedState(missing)).toBe(false)
    expect(isSavedState({ ...good, units: { ...good.units, 'p3-room': { status: 'done', materials: 0, restarts: 0 } } })).toBe(false)
  })

  it('describeReplacement says what is saved here and what is in the file, and that loading replaces it', () => {
    const here = new ProgressStore(memoryStorage(), 31)
    for (const u of unitsOfPart(4)) here.complete(u, {})
    const there = newState(32)
    for (const u of unitsOfPart(1)) there.units[u] = { status: 'complete', materials: 0, restarts: 0, result: {} }
    there.units['p2-first'] = { status: 'complete', materials: 0, restarts: 0 }
    const lines = describeReplacement(here.state, there)
    expect(lines[0]).toBe('Saved here now: Part 4 finished, with seed 31.')
    expect(lines[1]).toBe('In the file: Part 1, Part 2 (partly) finished, with seed 32.')
    expect(lines[2]).toMatch(/replaces everything saved here/)
  })

  it('replaceWith applies an import, discarding any unit the file left in progress', () => {
    const box = memoryStorage()
    const s = new ProgressStore(box, 41)
    const incoming = newState(42)
    incoming.units['p1-list-0'] = { status: 'complete', materials: 0, restarts: 0, result: { a: 1 } }
    incoming.units['p1-list-1'] = { status: 'in progress', materials: 0, restarts: 0 }
    s.replaceWith(incoming)
    expect(s.seed).toBe(42)
    expect(s.isComplete('p1-list-0')).toBe(true)
    expect(s.status('p1-list-1')).toBe('not started')
    expect(s.materialsSlot('p1-list-1')).toBe(1)
    expect(new ProgressStore(box).seed).toBe(42)
  })
})
