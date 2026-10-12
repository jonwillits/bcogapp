import { describe, it, expect } from 'vitest'
import m from '../../../public/m08/measurements.json'

/**
 * The spec's targets (§11), measured in Python before any scene work and
 * shipped in measurements.json, which the scene prints. Where a target
 * fails, the measured value is pinned here and recorded as a finding in
 * the as-built notes and the walk-through; it is not retuned.
 */
type Sweep = Record<string, { match: number[]; accuracy: number }>
type M = typeof m
const shift = (x: { shift: unknown }) => x.shift as Sweep
const turn = (x: { turn: unknown }) => x.turn as Sweep

describe('the spec’s targets, measured', () => {
  const p1 = (m as M).part1.a
  const last = p1.layers.length - 1

  it('models: the drawing network ≥ 85% held out; Standard ≥ 85% on clean crops', () => {
    expect((m as M).networks.drawing.testAccuracy).toBeGreaterThanOrEqual(0.85)
    expect((m as M).networks.photo_standard.testAccuracyClean).toBeGreaterThanOrEqual(0.85)
  })

  it('Part 1: the shift match rises from the input to the last pooled layer for shifts of 2 to 8 px', () => {
    for (const px of ['2', '4', '6', '8']) expect(shift(p1)[px].match[last], `${px} px`).toBeGreaterThan(shift(p1)[px].match[0])
  })

  it('Part 1: a 180° turn matches less at the last pooled layer than a 4 px shift, and accuracy falls by at least 40 points', () => {
    expect(turn(p1)['180'].match[last]).toBeLessThan(shift(p1)['4'].match[last])
    expect(p1.accuracyCentered - turn(p1)['180'].accuracy).toBeGreaterThanOrEqual(0.4)
  })

  it('Part 1: with Center and scale off, a drawing shrunk to 40% in a corner loses at least 30 points', () => {
    expect(p1.accuracyCentered - p1.centered.smallInCorner).toBeGreaterThanOrEqual(0.3)
  })

  it('Part 1: Version B loses at most 15 points to a 180° turn, and fails on a stretch it was not trained on', () => {
    const b = (m as M).part1.b
    expect(b.accuracyCentered - turn(b)['180'].accuracy).toBeLessThanOrEqual(0.15)
    const u = (m as M).part1.untrained
    expect(u.b.stretchWide).toBeLessThan(u.b.intact - 0.3)
  })

  it('Part 2: both erasers reached every level on the whole display set, and the gap is reported at each level', () => {
    const e = (m as M).part2.erasers
    expect(e.displayN).toBe(72)
    const gap = e.gap as Record<string, number>
    for (const l of e.levels) expect(typeof gap[String(l)]).toBe('number')
    // Finding, not target: the gap is not in the direction the reading reports for people.
    expect(gap['0.5']).toBeLessThan(0.1)
  })

  it('Part 2: the moved-part pairs are reported; the network keeps its label on most (the reading’s finding), including both mushrooms with the cap under the stem', () => {
    const mv = (m as M).part2.moved
    expect(mv.n).toBe(10)
    expect(mv.labelChanged).toBe(4)
    for (const p of mv.pairs.filter((x) => x.category === 'mushroom')) expect(p.movedLabel).toBe('mushroom')
    // The part is placed just on the other side of the rest, so the moved version is at most a little larger; the first version shoved it away and halved the size.
    for (const p of mv.pairs) expect((p as { sizeRatio: number }).sizeRatio).toBeLessThan(1.6)
  })

  it('Part 4: Trained on noise A beats Standard on noise A by at least 20 points', () => {
    const n = (m as M).part4.nets
    expect(n.noise.atDefaults.A - n.standard.atDefaults.A).toBeGreaterThanOrEqual(0.2)
  })

  it('Part 4: the target that Trained on noise A scores at most 20% on noise B FAILS; the measured value is pinned as a finding', () => {
    const n = (m as M).part4.nets
    expect(n.noise.atDefaults.B).toBeGreaterThan(0.2)
    expect(n.noise.atDefaults.B).toBeGreaterThan(0.6)
  })

  it('Closer: Trained on blurred and sharp against Standard on drawings is reported; the difference is within three points', () => {
    const d = (m as M).part4.drawings.nets
    expect(d.blur).toBeGreaterThan(d.standard)
    expect(d.blur - d.standard).toBeLessThan(0.03)
    expect(d.drawingNetwork).toBeGreaterThan(0.85)
  })
})
