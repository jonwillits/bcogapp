import { describe, it, expect } from 'vitest'
import { ProgressStore } from './store'
import { UNIT_IDS, reservesFor, resumes, unitsOfPart } from '../parts'
import { LAB13_TRANSFER } from './transfer'
import type { RawStorage } from './storage'

/**
 * Spec §4 and §14: every part opens from a fresh state with nothing else
 * done; a saved state round-trips; an interrupted unit restarts as the
 * table says, including Part 3's reserve set; with storage blocked the lab
 * runs on in memory; a reload keeps what was complete.
 */
function memoryStorage(initial: string | null = null): RawStorage & { text: string | null } {
  const s = { text: initial, read: () => s.text, write: (t: string) => ((s.text = t), true) }
  return s
}

describe('Lab 13’s saved progress', () => {
  it('every part opens with nothing done: there are no locks', () => {
    const p = new ProgressStore(memoryStorage(), 5)
    for (const part of [0, 1, 2, 3, 4] as const) {
      expect(p.canOpen(part)).toBe(true)
      expect(p.lockReason(part)).toBeNull()
    }
  })

  it('a complete unit survives a reload; an interrupted one restarts; the board resumes with its partial', () => {
    const storage = memoryStorage()
    const p = new ProgressStore(storage, 5)
    p.begin('p1-labels')
    p.complete('p1-labels', { correct: 4 })
    p.begin('p1-labeling')
    p.begin('p2-board')
    p.savePartial('p2-board', { found: ['babupu'] })
    const q = new ProgressStore(storage)
    expect(q.seed).toBe(5)
    expect(q.isComplete('p1-labels')).toBe(true)
    expect(q.result('p1-labels')).toEqual({ correct: 4 })
    expect(q.status('p1-labeling')).toBe('not started')
    expect(q.restarts('p1-labeling')).toBe(1)
    expect(q.interrupted.map((u) => u.unit)).toEqual(['p1-labeling'])
    expect(q.status('p2-board')).toBe('in progress')
    expect(q.partial('p2-board')).toEqual({ found: ['babupu'] })
  })

  it('Part 3’s unit, interrupted, restarts on the reserve set; interrupted again, it reuses the reserve and says so', () => {
    const storage = memoryStorage()
    const p = new ProgressStore(storage, 5)
    expect(p.materialsSlot('p3-words')).toBe(0)
    p.begin('p3-words')
    const q = new ProgressStore(storage)
    expect(q.materialsSlot('p3-words')).toBe(1)
    expect(q.interrupted).toEqual([{ unit: 'p3-words', materials: 1, exhausted: false }])
    q.begin('p3-words')
    const r = new ProgressStore(storage)
    expect(r.materialsSlot('p3-words')).toBe(1)
    expect(r.interrupted).toEqual([{ unit: 'p3-words', materials: 1, exhausted: true }])
    expect(r.restarts('p3-words')).toBe(2)
  })

  it('with storage blocked, the lab runs in memory and says so', () => {
    const blocked: RawStorage = { read: () => null, write: () => false }
    const p = new ProgressStore(blocked, 9)
    p.begin('p2-minute')
    p.complete('p2-minute', { guess: 4 })
    expect(p.storageAvailable).toBe(false)
    expect(p.isComplete('p2-minute')).toBe(true)
  })

  it('a state exports and loads back through the transfer, and a stranger’s file is refused', () => {
    const p = new ProgressStore(memoryStorage(), 11)
    p.begin('p1-abx')
    p.complete('p1-abx', { correct: 30 })
    const text = LAB13_TRANSFER.exportText(p.state)
    const back = LAB13_TRANSFER.parseImport(text)
    expect(back.ok).toBe(true)
    if (back.ok) expect(back.state.units['p1-abx'].status).toBe('complete')
    expect(LAB13_TRANSFER.parseImport('{"kind":"bcogapp.m12 saved results"}').ok).toBe(false)
    expect(LAB13_TRANSFER.exportFileName(11)).toBe('lab13-results-11.json')
  })

  it('the parts’ units are the spec’s', () => {
    expect(UNIT_IDS.length).toBe(6)
    expect(unitsOfPart(1)).toEqual(['p1-labels', 'p1-labeling', 'p1-abx'])
    expect(unitsOfPart(2)).toEqual(['p2-minute', 'p2-board'])
    expect(unitsOfPart(3)).toEqual(['p3-words'])
    expect(unitsOfPart(4)).toEqual([])
    expect(reservesFor('p3-words')).toBe(2)
    expect(UNIT_IDS.filter((u) => u !== 'p3-words').every((u) => reservesFor(u) === 1)).toBe(true)
    expect(UNIT_IDS.filter(resumes)).toEqual(['p2-board'])
  })
})
