import { describe, it, expect } from 'vitest'
import { DEFAULT_TEST, type TestSettings } from './lab'
import { RATS, outcomeOf, runTest, type RatId } from './rats'

/**
 * The table of the Module 9 spec's §8.3, written before the rats and run
 * over 20 seeds: every cell is the majority outcome. The rows are the
 * spec's expectations for idealized strategies, not the reading's data,
 * and the two cells that are the point of the part are marked: with the
 * lamp in place the beacon rat looks exactly like the map rat, and
 * removing the cues just before the choice separates the snapshot rat
 * from the map rat.
 */

const SEEDS = Array.from({ length: 20 }, (_, i) => 1000 + i)
type Row = { name: string; settings: Partial<TestSettings>; expect: Record<RatId, string> }

const ROWS: Row[] = [
  {
    name: 'Plus maze, rich room, 4 training trials, probe from north',
    settings: { apparatus: 'plus', room: 'rich', training: 4 },
    expect: { H: 'east', R1: 'east', R2: 'west', R3: 'east', R4: 'east', R5: 'west', R6: 'east' },
  },
  {
    name: 'Plus maze, rich room, 64 training trials',
    settings: { apparatus: 'plus', room: 'rich', training: 64 },
    expect: { H: 'west', R1: 'east', R2: 'west', R3: 'east', R4: 'east', R5: 'west', R6: 'east' },
  },
  {
    name: 'Plus maze, plain enclosure',
    settings: { apparatus: 'plus', room: 'plain', training: 4 },
    expect: { H: 'west', R1: 'no consistent arm', R2: 'west', R3: 'no consistent arm', R4: 'no consistent arm', R5: 'west', R6: 'no consistent arm' },
  },
  {
    name: 'Water maze, visible platform',
    settings: { apparatus: 'water', platform: 'visible' },
    expect: { H: 'finds it', R1: 'finds it', R2: 'fails from new starts', R3: 'finds it', R4: 'finds it', R5: 'finds it', R6: 'finds it' },
  },
  {
    name: 'Water maze, hidden platform, varied starts',
    settings: { apparatus: 'water', platform: 'hidden' },
    expect: { H: 'learns it', R1: 'fails', R2: 'fails', R3: 'learns it', R4: 'learns it', R5: 'fails', R6: 'learns it' },
  },
  {
    name: 'Water maze, hidden, cues removed just before release',
    settings: { apparatus: 'water', platform: 'hidden', removeCues: true },
    expect: { H: 'finds it most times', R1: 'fails', R2: 'fails', R3: 'fails', R4: 'finds it most times', R5: 'fails', R6: 'finds it most times' },
  },
  {
    name: 'Water maze, hidden, cues rotated 90°',
    settings: { apparatus: 'water', platform: 'hidden', rotateCues: true },
    expect: { H: 'searches the rotated quarter', R1: 'fails', R2: 'fails', R3: 'searches the rotated quarter', R4: 'searches the rotated quarter', R5: 'fails', R6: 'searches the rotated quarter' },
  },
  {
    name: 'Water maze, hidden, dark only after setting off',
    settings: { apparatus: 'water', platform: 'hidden', darkness: 'afterStart' },
    expect: { H: 'finds it most times', R1: 'fails', R2: 'fails', R3: 'fails', R4: 'finds it most times', R5: 'fails', R6: 'finds it most times' },
  },
  {
    name: 'Radiating paths, lamp in place',
    settings: { apparatus: 'paths', lamp: 'on' },
    expect: { H: 'path nearest the old food box', R1: 'path nearest the old food box', R2: 'paths beside the blocked route', R3: 'path nearest the old food box', R4: 'path nearest the old food box', R5: 'path nearest the old food box', R6: 'path nearest the old food box' },
  },
  {
    name: 'Radiating paths, lamp off',
    settings: { apparatus: 'paths', lamp: 'off' },
    expect: { H: 'path nearest the old food box', R1: 'no preferred path', R2: 'paths beside the blocked route', R3: 'no preferred path', R4: 'path nearest the old food box', R5: 'paths beside the blocked route', R6: 'path nearest the old food box' },
  },
]

/** The majority outcome over the seeds, with its count. */
export function majority(rat: RatId, settings: TestSettings): { outcome: string; count: number; of: number; all: Record<string, number> } {
  const all: Record<string, number> = {}
  for (const seed of SEEDS) {
    const o = outcomeOf(runTest(RATS.find((r) => r.id === rat)!, settings, seed))
    all[o] = (all[o] ?? 0) + 1
  }
  let best = ''
  for (const k of Object.keys(all)) if (!best || all[k] > all[best]) best = k
  return { outcome: best, count: all[best], of: SEEDS.length, all }
}

describe('the table of §8.3: every cell is the majority outcome over 20 seeds', () => {
  for (const row of ROWS) {
    it(row.name, () => {
      const settings = { ...DEFAULT_TEST, ...row.settings }
      const bad: string[] = []
      for (const rat of RATS) {
        const m = majority(rat.id, settings)
        if (m.outcome !== row.expect[rat.id] || m.count * 2 <= m.of) bad.push(`${rat.id}: got ${m.outcome} ${m.count}/${m.of} (${JSON.stringify(m.all)}), expected ${row.expect[rat.id]}`)
      }
      expect(bad, bad.join('\n')).toEqual([])
    })
  }

  it('the two cells that are the point: with the lamp in place R1 looks exactly like R4, and removing the cues just before the choice separates R3 from R4', () => {
    const lampOn = { ...DEFAULT_TEST, apparatus: 'paths' as const, lamp: 'on' as const }
    expect(majority('R1', lampOn).outcome).toBe(majority('R4', lampOn).outcome)
    const lampMoved = { ...lampOn, lamp: 'moved' as const }
    expect(majority('R1', lampMoved).outcome).not.toBe(majority('R4', lampMoved).outcome)
    const removed = { ...DEFAULT_TEST, apparatus: 'water' as const, platform: 'hidden' as const, removeCues: true }
    expect(majority('R3', removed).outcome).toBe('fails')
    expect(majority('R4', removed).outcome).toBe('finds it most times')
  })

  it('R6, if built: as H except that it stays with place after 64 trials and fails the plain enclosure', () => {
    const long = { ...DEFAULT_TEST, apparatus: 'plus' as const, training: 64 as const }
    expect(majority('R6', long).outcome).toBe('east')
    expect(majority('H', long).outcome).toBe('west')
    const plain = { ...DEFAULT_TEST, apparatus: 'plus' as const, room: 'plain' as const }
    expect(majority('R6', plain).outcome).toBe('no consistent arm')
  })

  it('the same seed reproduces a run exactly', () => {
    const a = runTest(RATS[0], { ...DEFAULT_TEST, apparatus: 'water' }, 42)
    const b = runTest(RATS[0], { ...DEFAULT_TEST, apparatus: 'water' }, 42)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })
})
