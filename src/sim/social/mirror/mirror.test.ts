import { describe, it, expect } from 'vitest'
import { makeRng } from '../../random'
import { CELLS, MirrorCells, VISUAL_INPUTS } from './cells'
import { inputsAt, play, runOf, runSteps, runTest, restingFiring, testTimeline } from './schedule'

/**
 * Part 6 (spec §10, §16): before learning neither cell responds to
 * watching; the four steps' results over twenty seeds, each in the
 * direction stated; the visual inputs are viewpoint-specific; the weights
 * start at zero and are written only by learnWeights (oneWriter.test.ts).
 */

const rest = restingFiring()

describe('the cells (§10.2)', () => {
  it('start with every visual weight at zero, fire for doing through the fixed motor input, and not for watching', () => {
    const c = new MirrorCells()
    expect(c.table().flat().every((w) => w === 0)).toBe(true)
    expect(c.precision.output([0, 0, 0, 0], 1)).toBeGreaterThan(0.85)
    expect(c.precision.output([0, 0, 1, 0], 0)).toBeCloseTo(rest, 6)
    expect(VISUAL_INPUTS.length).toBe(4)
  })
  it('the inputs are viewpoint-specific: the student’s grasp drives the own-view input when the hand is seen, the other macaque’s the across input', () => {
    const tl = runOf(1, 'copy', makeRng(1))
    const you = tl.events.find((e) => e.who === 'you')!
    const at = inputsAt(tl, you.start + 0.1)
    expect(at.performing).toBe(you.grasp)
    expect(at.x[2] + at.x[3]).toBe(0)
    const later = inputsAt(tl, you.start + CELLS.copyLatency + 0.1)
    expect(later.x[2] + later.x[3]).toBe(1)
    const test = testTimeline(makeRng(2))
    expect(test.events.every((e) => e.who === 'other')).toBe(true)
    expect(test.events.filter((e) => e.grasp === 'precision').length).toBe(10)
  })
  it('before learning, after a few own grasps, neither cell responds to watching: the across weights are exactly zero', () => {
    for (let seed = 1; seed <= 5; seed++) {
      const c = new MirrorCells()
      play(c, runOf(6, 'none', makeRng(seed)))
      expect(c.precision.unit.weights[2]).toBe(0)
      expect(c.precision.unit.weights[3]).toBe(0)
      expect(c.wholeHand.unit.weights[2]).toBe(0)
      expect(c.wholeHand.unit.weights[3]).toBe(0)
      const r = runTest(c, seed)
      expect(r.precisionCell.toPrecision).toBeCloseTo(rest, 3)
      expect(r.wholeHandCell.toWholeHand).toBeCloseTo(rest, 3)
    }
  })
})

describe('the four steps over twenty seeds (§10.3)', () => {
  const runs = Array.from({ length: 20 }, (_, i) => runSteps(1000 + i))
  const mean = (f: (r: (typeof runs)[number]) => number) => runs.reduce((a, r) => a + f(r), 0) / runs.length
  it('Step 2: after the other macaque copies 40 grasps, each cell fires for its own grasp seen from across, and more than for the other kind', () => {
    for (const r of runs) {
      expect(r[2].precisionCell.toPrecision).toBeGreaterThan(rest + 0.3)
      expect(r[2].wholeHandCell.toWholeHand).toBeGreaterThan(rest + 0.3)
      expect(r[2].precisionCell.toPrecision).toBeGreaterThan(r[2].precisionCell.toWholeHand + 0.3)
      expect(r[2].wholeHandCell.toWholeHand).toBeGreaterThan(r[2].wholeHandCell.toPrecision + 0.3)
    }
  })
  it('Step 3: with the other macaque grasping at random, the mirror response stays weak: contingency, not contiguity', () => {
    const copy = mean((r) => (r[2].precisionCell.toPrecision + r[2].wholeHandCell.toWholeHand) / 2)
    const random = mean((r) => (r[3].precisionCell.toPrecision + r[3].wholeHandCell.toWholeHand) / 2)
    expect(random).toBeLessThan(copy - 0.4)
    for (const r of runs) expect((r[3].precisionCell.toPrecision + r[3].wholeHandCell.toWholeHand) / 2).toBeLessThan((r[2].precisionCell.toPrecision + r[2].wholeHandCell.toWholeHand) / 2)
  })
  it('Step 4: with the other macaque doing the opposite, the precision cell comes to fire for the whole-hand grasp seen and the whole-hand cell for the precision grip', () => {
    for (const r of runs) {
      expect(r[4].precisionCell.toWholeHand).toBeGreaterThan(r[4].precisionCell.toPrecision + 0.3)
      expect(r[4].wholeHandCell.toPrecision).toBeGreaterThan(r[4].wholeHandCell.toWholeHand + 0.3)
    }
  })
  it('the same seed reproduces every number', () => {
    const a = runSteps(7)
    const b = runSteps(7)
    expect(JSON.stringify({ ...a, afterStep2: a.afterStep2.table() })).toBe(JSON.stringify({ ...b, afterStep2: b.afterStep2.table() }))
  })
})
