import { describe, it, expect } from 'vitest'
import { SCENARIOS, scenarioByKey } from './scenarios'
import { singleInterneuron } from './circuit'
import { runSeeds } from './measure'
import { truthTableOf } from './unit'

/**
 * What each shipped scenario does, and what the wiring a student is meant
 * to find does in it. These are the claims the handout will make about what
 * a student sees, each paired with the measurement that would go red.
 */

const SEEDS = 4
const SECONDS = 240

describe('the seven scenarios', () => {
  it('ship in the spec’s order with the spec’s keys', () => {
    expect(SCENARIOS.map((s) => s.key)).toEqual([
      'labeled-line',
      'trade-off',
      'target-and',
      'target-or',
      'target-and-not',
      'diagnosis',
      'reversal',
    ])
  })

  it('the three target functions are the chapter’s, verbatim in their rows', () => {
    expect(scenarioByKey('target-and').target!.act).toEqual([false, false, false, true])
    expect(scenarioByKey('target-or').target!.act).toEqual([false, true, true, true])
    expect(scenarioByKey('target-and-not').target!.act).toEqual([false, false, true, false])
  })

  it('target-or is the only scenario that keeps its wiring from another, and keeps it from target-and', () => {
    const keepers = SCENARIOS.filter((s) => s.keepWiringFrom)
    expect(keepers.map((s) => [s.key, s.keepWiringFrom])).toEqual([['target-or', 'target-and']])
  })

  it('no scenario ships already satisfying its target', () => {
    for (const s of SCENARIOS) {
      if (!s.target) continue
      const rows = truthTableOf(s.circuit.interneurons[0], s.circuit.activation)
      expect(rows, s.key).not.toEqual(s.target.act)
    }
  })
})

describe('Part 1', () => {
  it('the labeled line: routed forward the animal reaches food; routed to reverse it reaches none', () => {
    const ll = scenarioByKey('labeled-line')
    const approach = runSeeds(ll, SEEDS, SECONDS)
    const avoid = runSeeds(ll, SEEDS, SECONDS, {
      circuit: singleInterneuron([1], 0, ll.circuit.interneurons[0].threshold, 'reverse'),
    })
    expect(approach.cuesPerMinute).toBeGreaterThan(1)
    expect(avoid.cuesPerMinute).toBe(0)
  })

  it('the trade-off: as shipped the animal will not cross; strengthen food and weaken copper and it does', () => {
    const t = scenarioByKey('trade-off')
    const shipped = runSeeds(t, SEEDS, SECONDS)
    const bold = runSeeds(t, SEEDS, SECONDS, { circuit: singleInterneuron([3, -0.2], 0, 0.45, 'forward') })
    expect(shipped.cuesPerMinute).toBeLessThan(0.2)
    expect(bold.cuesPerMinute).toBeGreaterThan(0.8)
    // Crossing burns: the bold animal pays for its food.
    expect(bold.harm).toBeGreaterThan(shipped.harm)
  })
})

describe('Part 2', () => {
  it('AND: as shipped the animal feeds in warm water and is harmed; with the chapter’s AND it feeds only in cool water', () => {
    const s = scenarioByKey('target-and')
    const shipped = runSeeds(s, SEEDS, SECONDS)
    const solved = runSeeds(s, SEEDS, SECONDS, { circuit: singleInterneuron([1, 1], 0, 2, 'forward') })
    expect(shipped.harm).toBeGreaterThan(1)
    expect(solved.harm).toBe(0)
    expect(solved.cuesPerMinute).toBeGreaterThan(0)
  })

  it('OR: one number turns AND into OR, and the animal spends less time in danger', () => {
    const s = scenarioByKey('target-or')
    const and = runSeeds(s, SEEDS, SECONDS, { circuit: singleInterneuron([1, 1], 0, 2, 'reverse') })
    const or = runSeeds(s, SEEDS, SECONDS, { circuit: singleInterneuron([1, 1], 0, 1, 'reverse') })
    expect(or.harm).toBeLessThan(0.7 * and.harm)
  })

  it('AND NOT: needs a negative weight; with it the animal feeds and is never eaten', () => {
    const s = scenarioByKey('target-and-not')
    const solved = runSeeds(s, SEEDS, SECONDS, { circuit: singleInterneuron([1, -1], 0, 0.5, 'forward') })
    expect(solved.cuesPerMinute).toBeGreaterThan(0.3)
    expect(solved.harm).toBe(0)
  })
})
