import { describe, it, expect } from 'vitest'
import { ProgressStore } from './store'
import { UNIT_IDS, unitsOfPart } from '../parts'
import { LAB12_TRANSFER } from './transfer'
import type { RawStorage } from './storage'

/**
 * Spec §4 and §14: every part opens from a fresh state with nothing else
 * done; a saved state round-trips; an interrupted unit restarts as the
 * table says; with storage blocked the lab runs on in memory; a reload
 * keeps what was complete.
 */
function memoryStorage(initial: string | null = null): RawStorage & { text: string | null } {
  const s = { text: initial, read: () => s.text, write: (t: string) => ((s.text = t), true) }
  return s
}

describe('Lab 12’s saved progress', () => {
  it('every part opens with nothing done: there are no locks', () => {
    const p = new ProgressStore(memoryStorage(), 5)
    for (const part of [0, 1, 2, 3, 4] as const) {
      expect(p.canOpen(part)).toBe(true)
      expect(p.lockReason(part)).toBeNull()
    }
  })

  it('a complete unit survives a reload; an interrupted one restarts; a resuming one keeps its partial', () => {
    const storage = memoryStorage()
    const p = new ProgressStore(storage, 5)
    p.begin('p1-dispenser-0')
    p.complete('p1-dispenser-0', { points: 12 })
    p.begin('p1-dispenser-1')
    p.begin('p1-gambles')
    p.savePartial('p1-gambles', { answered: 3 })
    const q = new ProgressStore(storage)
    expect(q.seed).toBe(5)
    expect(q.isComplete('p1-dispenser-0')).toBe(true)
    expect(q.result('p1-dispenser-0')).toEqual({ points: 12 })
    expect(q.status('p1-dispenser-1')).toBe('not started')
    expect(q.restarts('p1-dispenser-1')).toBe(1)
    expect(q.interrupted.map((u) => u.unit)).toEqual(['p1-dispenser-1'])
    expect(q.status('p1-gambles')).toBe('in progress')
    expect(q.partial('p1-gambles')).toEqual({ answered: 3 })
  })

  it('with storage blocked, the lab runs in memory and says so', () => {
    const blocked: RawStorage = { read: () => null, write: () => false }
    const p = new ProgressStore(blocked, 9)
    p.begin('p2-tower-3')
    p.complete('p2-tower-3', { moves: 7 })
    expect(p.storageAvailable).toBe(false)
    expect(p.isComplete('p2-tower-3')).toBe(true)
  })

  it('a state exports and loads back through the transfer, and a stranger’s file is refused', () => {
    const p = new ProgressStore(memoryStorage(), 11)
    p.begin('p2-tower-4')
    p.complete('p2-tower-4', { moves: 15 })
    const text = LAB12_TRANSFER.exportText(p.state)
    const back = LAB12_TRANSFER.parseImport(text)
    expect(back.ok).toBe(true)
    if (back.ok) expect(back.state.units['p2-tower-4'].status).toBe('complete')
    expect(LAB12_TRANSFER.parseImport('{"kind":"bcogapp.m11 saved results"}').ok).toBe(false)
    expect(LAB12_TRANSFER.exportFileName(11)).toBe('lab12-results-11.json')
  })

  it('the parts’ units are the spec’s', () => {
    expect(UNIT_IDS.length).toBe(9)
    expect(unitsOfPart(1)).toEqual(['p1-gambles', 'p1-delays', 'p1-dispenser-0', 'p1-dispenser-1'])
    expect(unitsOfPart(2)).toEqual(['p2-tower-3', 'p2-tower-4', 'p2-trees'])
    expect(unitsOfPart(3)).toEqual(['p3-day-1', 'p3-day-2'])
    expect(unitsOfPart(4)).toEqual([])
  })
})
