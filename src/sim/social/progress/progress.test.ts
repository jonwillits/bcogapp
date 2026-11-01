import { describe, it, expect } from 'vitest'
import { ProgressStore, PART1_SKIPPED_LINE, PART2_LOCK_LINE } from './store'
import { isSavedState, newState } from './state'
import { exportText, IMPORT_REASONS, parseImport, describeReplacement } from './transfer'
import { UNIT_IDS, reservesFor, resumes, unitsOfPart, unitOfMatch, PART1_PARTNERS } from '../parts'
import type { RawStorage } from './storage'

/**
 * Lab 11's saved progress (spec §4, §16): a saved state round-trips; every
 * unit in §4.1 is interrupted, reloaded, and restarted as the table says;
 * Part 2 is locked until Part 1's commit, except through Skip Part 1, after
 * which Part 1 stays locked for that seed; blocked storage falls back to
 * memory; Export and Load check what they read.
 */

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

describe('the units of Lab 11', () => {
  it('six matches, the diagnosis, the films, the paths and the two sets; Parts 2, 4 and 6 have none', () => {
    expect(UNIT_IDS.length).toBe(PART1_PARTNERS + 4)
    expect(unitsOfPart(1)).toEqual([...Array.from({ length: 6 }, (_, i) => unitOfMatch(i)), 'p1-diagnosis'])
    expect(unitsOfPart(3)).toEqual(['p3-films', 'p3-paths'])
    expect(unitsOfPart(5)).toEqual(['p5-sets'])
    for (const p of [0, 2, 4, 6] as const) expect(unitsOfPart(p)).toEqual([])
  })
  it('the restart table of §4.1: a match, the diagnosis and the films run again as they were; the paths resume; the sets have a reserve pair', () => {
    for (let i = 0; i < PART1_PARTNERS; i++) expect(reservesFor(unitOfMatch(i))).toBe(1)
    expect(reservesFor('p1-diagnosis')).toBe(1)
    expect(reservesFor('p3-films')).toBe(1)
    expect(reservesFor('p5-sets')).toBe(2)
    expect(resumes('p3-paths')).toBe(true)
    for (const u of UNIT_IDS) if (u !== 'p3-paths') expect(resumes(u), u).toBe(false)
  })
})

describe('a saved state round-trips', () => {
  it('complete a unit, reload from the same raw text, and it is complete with an identical result', () => {
    const box = memoryStorage()
    const a = new ProgressStore(box, 1234)
    a.begin('p1-match-0')
    a.complete('p1-match-0', { rounds: 17, points: 40 })
    const b = new ProgressStore(box)
    expect(b.seed).toBe(1234)
    expect(b.isComplete('p1-match-0')).toBe(true)
    expect(b.result('p1-match-0')).toEqual({ rounds: 17, points: 40 })
    expect(b.interrupted).toEqual([])
    expect(b.storageAvailable).toBe(true)
  })
})

describe('every unit in §4.1 is interrupted, reloaded, and restarted as the table says', () => {
  it('a match, the diagnosis and the films restart on their own materials with the restart counted', () => {
    for (const unit of ['p1-match-2', 'p1-diagnosis', 'p3-films'] as const) {
      const box = memoryStorage()
      const a = new ProgressStore(box, 7)
      a.begin(unit)
      const b = new ProgressStore(box)
      expect(b.status(unit)).toBe('not started')
      expect(b.restarts(unit)).toBe(1)
      expect(b.materialsSlot(unit)).toBe(0)
      expect(b.interrupted.map((i) => i.unit)).toEqual([unit])
    }
  })
  it('the two sets restart with the reserve pair, and a second interruption reuses it and says so', () => {
    const box = memoryStorage()
    const a = new ProgressStore(box, 7)
    a.begin('p5-sets')
    const b = new ProgressStore(box)
    expect(b.materialsSlot('p5-sets')).toBe(1)
    expect(b.interrupted[0].exhausted).toBe(false)
    b.begin('p5-sets')
    const c = new ProgressStore(box)
    expect(c.materialsSlot('p5-sets')).toBe(1)
    expect(c.restarts('p5-sets')).toBe(2)
    expect(c.interrupted[0].exhausted).toBe(true)
  })
  it('the paths resume with the judgments already made', () => {
    const box = memoryStorage()
    const a = new ProgressStore(box, 9)
    a.begin('p3-paths')
    a.savePartial('p3-paths', { judged: [{ path: 'r1', point: 0, split: [50, 30, 20] }] })
    const b = new ProgressStore(box)
    expect(b.status('p3-paths')).toBe('in progress')
    expect(b.partial('p3-paths')).toEqual({ judged: [{ path: 'r1', point: 0, split: [50, 30, 20] }] })
    expect(b.interrupted).toEqual([])
  })
})

describe('the order of the parts (§4.2)', () => {
  it('Part 2 is locked until Part 1’s diagnosis is committed; every other part is open', () => {
    const s = new ProgressStore(memoryStorage(), 5)
    for (const p of [0, 1, 3, 4, 5, 6] as const) expect(s.canOpen(p), `part ${p}`).toBe(true)
    expect(s.canOpen(2)).toBe(false)
    expect(s.lockReason(2)).toBe(PART2_LOCK_LINE)
    expect(s.lockReason(2)).toMatch(/Part 1/)
    for (let i = 0; i < PART1_PARTNERS; i++) s.complete(unitOfMatch(i), {})
    expect(s.canOpen(2)).toBe(false)
    s.complete('p1-diagnosis', {})
    expect(s.partComplete(1)).toBe(true)
    expect(s.canOpen(2)).toBe(true)
  })
  it('Skip Part 1 opens Part 2 and locks Part 1 for that seed; Clear draws a new seed and unlocks it', () => {
    const box = memoryStorage()
    const s = new ProgressStore(box, 6)
    s.skipPart1()
    expect(s.canOpen(2)).toBe(true)
    expect(s.canOpen(1)).toBe(false)
    expect(s.lockReason(1)).toBe(PART1_SKIPPED_LINE)
    const t = new ProgressStore(box)
    expect(t.part1Skipped).toBe(true)
    expect(t.canOpen(1)).toBe(false)
    t.clear()
    expect(t.seed).not.toBe(6)
    expect(t.canOpen(1)).toBe(true)
    expect(t.canOpen(2)).toBe(false)
  })
  it('explorations never count as finished', () => {
    const s = new ProgressStore(memoryStorage(), 8)
    for (const p of [0, 2, 4, 6] as const) expect(s.partComplete(p)).toBe(false)
  })
})

describe('with storage blocked', () => {
  it('the lab runs from memory and reports the storage unavailable', () => {
    const s = new ProgressStore(memoryStorage(null, true), 11)
    expect(s.storageAvailable).toBe(false)
    s.begin('p1-match-0')
    s.complete('p1-match-0', { ok: true })
    expect(s.isComplete('p1-match-0')).toBe(true)
    s.commitPrediction('p2-step1', 'always defect')
    expect(s.prediction('p2-step1')).toBe('always defect')
  })
  it('garbage, or another lab’s state, is ignored and a fresh state begins', () => {
    expect(new ProgressStore(memoryStorage('{not json'), 13).seed).toBe(13)
    const lab10 = JSON.stringify({ version: 1, seed: 1, units: {}, predictions: {}, sampleNights: false })
    expect(new ProgressStore(memoryStorage(lab10), 14).seed).toBe(14)
  })
})

describe('predictions and free text', () => {
  it('a prediction committed once is never overwritten', () => {
    const box = memoryStorage()
    const s = new ProgressStore(box, 2)
    s.commitPrediction('p2-step3-top', 'tit-for-tat')
    s.commitPrediction('p2-step3-top', 'always defect')
    expect(s.prediction('p2-step3-top')).toBe('tit-for-tat')
    expect(new ProgressStore(box).prediction('p2-step3-top')).toBe('tit-for-tat')
  })
  it('a notes box is saved inside a unit’s result like any other response, and stays within the string cap', () => {
    const box = memoryStorage()
    const s = new ProgressStore(box, 3)
    s.complete('p1-match-1', { notes: 'cooperates after I do', rounds: 15 })
    expect((new ProgressStore(box).result('p1-match-1') as { notes: string }).notes).toBe('cooperates after I do')
    const good = newState(1)
    expect(isSavedState({ ...good, units: { ...good.units, 'p1-match-1': { status: 'complete', materials: 0, restarts: 0, result: { notes: 'x'.repeat(2001) } } } })).toBe(false)
  })
})

describe('Export and Load', () => {
  it('exportText round-trips through parseImport, and a Lab 10 file is refused by kind', () => {
    const s = new ProgressStore(memoryStorage(), 21)
    s.complete('p3-films', { ratings: [3, 6, 4] })
    const r = parseImport(exportText(s.state))
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.state).toEqual(s.state)
    expect(exportText(s.state)).toContain('bcogapp.m11 saved results')
    const lab10 = JSON.stringify({ kind: 'bcogapp.m10 saved results', exported: 'x', state: newState(1) })
    expect(parseImport(lab10)).toEqual({ ok: false, reason: IMPORT_REASONS.wrongKind })
    expect(IMPORT_REASONS.wrongKind).toBe('This is not a Lab 11 saved-results file.')
  })
  it('isSavedState checks the flag and refuses an extra field', () => {
    const good = newState(1)
    expect(isSavedState(good)).toBe(true)
    expect(isSavedState({ ...good, skippedPart1: 'yes' })).toBe(false)
    expect(isSavedState({ ...good, sampleNights: false })).toBe(false)
  })
  it('describeReplacement names the parts with units', () => {
    const here = new ProgressStore(memoryStorage(), 31)
    here.complete('p5-sets', {})
    const there = newState(32)
    for (const u of unitsOfPart(1)) there.units[u] = { status: 'complete', materials: 0, restarts: 0 }
    there.units['p3-films'] = { status: 'complete', materials: 0, restarts: 0 }
    const lines = describeReplacement(here.state, there)
    expect(lines[0]).toBe('Saved here now: Part 5 finished, with seed 31.')
    expect(lines[1]).toBe('In the file: Part 1, Part 3 (partly) finished, with seed 32.')
  })
})
