import { describe, it, expect } from 'vitest'
import { makeRng } from '../../random'
import { MATERIALS, MEMBERS, STEP, barStart, heights, measures, planSets, scoreSet, type Judgment } from './sets'

/**
 * Part 5 (spec §9, §16): in both sets the series are evenly spaced at 5%
 * steps and the two sets use different series; in the labeled set the four
 * shortest are always in one group; the bar's starting position is random
 * and never at the creature's height; the reserve pair differs; the
 * scoring follows §9.3.
 */

describe('the two sets', () => {
  it('each set’s heights are an evenly spaced series at 5% steps, the two sets use different series, and the reserve pair differs again', () => {
    for (const m of MATERIALS) {
      for (const s of m.sets) {
        const h = heights(s)
        for (let k = 1; k < h.length; k++) expect(h[k] / h[k - 1]).toBeCloseTo(STEP, 9)
      }
      expect(m.sets[0].base).not.toBe(m.sets[1].base)
      expect(m.sets[0].creature.kind).not.toBe(m.sets[1].creature.kind)
    }
    expect(MATERIALS[1].names).not.toEqual(MATERIALS[0].names)
    const bases = MATERIALS.flatMap((m) => m.sets.map((s) => s.base))
    expect(new Set(bases).size).toBe(4)
  })
  it('in the labeled set the four shortest are always one group and the four tallest the other; the unlabeled set has no names; the seed picks which kind is labeled and which set comes first', () => {
    const labeledKinds = new Set<string>()
    const firsts = new Set<string>()
    for (let seed = 1; seed <= 40; seed++) {
      const plan = planSets(seed, 0)
      const labeled = plan.sets.find((s) => s.which === 'labeled')!
      const unlabeled = plan.sets.find((s) => s.which === 'unlabeled')!
      for (let k = 0; k < MEMBERS; k++) expect(labeled.members[k].label).toBe(k < 4 ? plan.names[0] : plan.names[1])
      expect(unlabeled.members.every((mem) => mem.label === null)).toBe(true)
      labeledKinds.add(labeled.spec.creature.kind)
      firsts.add(plan.sets[0].which)
      expect(labeled.presentation.length).toBe(32)
      expect(labeled.judgments.length).toBe(16)
      for (let k = 0; k < MEMBERS; k++) {
        expect(labeled.presentation.filter((x) => x === k).length).toBe(4)
        expect(labeled.judgments.filter((x) => x === k).length).toBe(2)
      }
    }
    expect(labeledKinds.size).toBe(2)
    expect(firsts.size).toBe(2)
  })
  it('the bar starts at a random height that is never the creature’s, offset from its baseline', () => {
    const rng = makeRng(3)
    let below = 0
    for (let i = 0; i < 400; i++) {
      const b = barStart(rng)
      expect(b.share < 0.86 || b.share > 1.14).toBe(true)
      expect(Math.abs(b.share - 1)).toBeGreaterThan(0.1)
      if (b.share < 1) below++
      expect(Math.abs(b.offset)).toBeLessThanOrEqual(30)
    }
    expect(below).toBeGreaterThan(150)
    expect(below).toBeLessThan(250)
    const plan = planSets(5, 0)
    expect(plan.sets[0].barStarts.length).toBe(16)
  })
  it('a restarted unit gets the reserve pair, with different creatures and names', () => {
    const a = planSets(9, 0)
    const b = planSets(9, 1)
    expect(a.names).not.toEqual(b.names)
    expect(a.sets[0].spec.base).not.toBe(b.sets[0].spec.base)
  })
})

describe('scoring (§9.3)', () => {
  it('the boundary difference, the other neighboring differences and the spread within each group, judged against true', () => {
    const plan = planSets(11, 0)
    const set = plan.sets[0]
    // Judgments that widen the boundary by 6 px (less than one step, so the order holds) and shrink the spread within groups: every member judged at its true height, except the boundary pair pushed apart.
    const judgments: Judgment[] = []
    for (let k = 0; k < MEMBERS; k++) {
      const truth = set.members[k].height
      let judged = truth
      if (k === 3) judged = truth - 3
      if (k === 4) judged = truth + 3
      judgments.push({ which: set.which, member: k, judged }, { which: set.which, member: k, judged })
    }
    const s = scoreSet(set, judgments)
    expect(s.boundary.judged).toBeCloseTo(s.boundary.truth + 6, 6)
    // The two differences next to the boundary each shrank by 3, so the mean of the other six fell by 6/6.
    expect(s.others.judged).toBeCloseTo(s.others.truth - 1, 6)
    expect(s.spread.shorter.judged).toBeCloseTo(s.spread.shorter.truth - 3, 6)
    expect(s.spread.taller.judged).toBeCloseTo(s.spread.taller.truth - 3, 6)
    const other = plan.sets[1]
    const exact: Judgment[] = other.members.flatMap((mem, k) => [{ which: other.which, member: k, judged: mem.height }])
    const t = scoreSet(other, exact)
    expect(t.boundary.judged).toBeCloseTo(t.boundary.truth, 6)
    const m = set.which === 'labeled' ? measures(s, t) : measures(t, s)
    expect(m.boundary.unlabeled === 1 || m.boundary.labeled === 1).toBe(true)
  })
})
