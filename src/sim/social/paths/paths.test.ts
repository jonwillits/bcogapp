import { describe, it, expect } from 'vitest'
import { ACTIONS, GOALS, Maze, type Layout } from './maze'
import { HEURISTIC, INVERSE_PLANNING, SUBSTANTIAL, at, correlation, disagreement, posteriors } from './models'
import { LAYOUTS, PATH_SPECS, disagreementSummary, mazeOf, reservePaths, shownPaths, thePool } from './pool'

/**
 * Part 3, Step 2 (spec §7.2, §16): the planner's costs and corner rule;
 * the two models on hand-computed fixtures on three small mazes (the
 * paper gives no worked example with numbers); the heuristic depends only
 * on the last step; the pool's shape; and the models disagree
 * substantially on at least a quarter of the shown judgment points.
 */

const corridor: Layout = { id: 'c', width: 5, height: 3, walls: [], goals: { A: { x: 4, y: 0 }, B: { x: 4, y: 2 }, C: { x: 0, y: 0 } } }

describe('the maze and the planner', () => {
  it('a straight step costs 1, a diagonal √2, Stay 1; the shortest cost counts diagonals; a diagonal may not cut a wall’s corner', () => {
    const m = new Maze(corridor)
    expect(m.distance({ x: 0, y: 1 }, 'A')).toBeCloseTo(3 + Math.SQRT2)
    expect(m.distance({ x: 4, y: 0 }, 'A')).toBe(0)
    const walled: Layout = { ...corridor, walls: [{ x: 1, y: 0 }] }
    const w = new Maze(walled)
    const diag = ACTIONS.find((a) => a.dx === 1 && a.dy === -1)!
    expect(w.allowed({ x: 0, y: 1 }, diag)).toBe(false) // (1,0) is a wall: the corner is cut
    expect(w.allowed({ x: 2, y: 1 }, diag)).toBe(true) // (2,0) and (3,1) are free, so the diagonal to (3,0) cuts no corner
  })
  it('the policy is a softmax of the value with β: the best action is likeliest, and more so with a larger β', () => {
    // A 3 × 3 square with B at the far corner: from the near corner the diagonal (√2) is strictly better than a straight step (1 + √2 + ... = 1 + 1.41).
    const square: Layout = { id: 'q', width: 3, height: 3, walls: [], goals: { A: { x: 2, y: 0 }, B: { x: 2, y: 2 }, C: { x: 0, y: 2 } } }
    const m = new Maze(square)
    const right = ACTIONS.find((a) => a.dx === 1 && a.dy === 0)!
    const downRight = ACTIONS.find((a) => a.dx === 1 && a.dy === 1)!
    const p1 = m.policy({ x: 0, y: 0 }, 'B', 1).get(right)!
    const p5 = m.policy({ x: 0, y: 0 }, 'B', 5).get(right)!
    expect(m.policy({ x: 0, y: 0 }, 'B', 2).get(downRight)!).toBeGreaterThan(m.policy({ x: 0, y: 0 }, 'B', 2).get(right)!)
    expect(p5).toBeLessThan(p1)
    const probs = [...m.policy({ x: 0, y: 1 }, 'A', 2).values()]
    expect(probs.reduce((a, b) => a + b, 0)).toBeCloseTo(1)
  })
})

describe('the two models (Baker, Saxe and Tenenbaum, 2009)', () => {
  it('inverse planning has the paper’s best-fit parameters, and the heuristic is inverse planning with γ = 1 and its own β', () => {
    expect(INVERSE_PLANNING).toMatchObject({ beta: 2.0, gamma: 0.25 })
    expect(HEURISTIC).toMatchObject({ beta: 2.5, gamma: 1 })
  })
  it('on a corridor, a step toward A raises A for both; the heuristic depends only on the last step', () => {
    const m = new Maze(corridor)
    const path = [
      { x: 0, y: 1 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ]
    const inv = posteriors(m, path, INVERSE_PLANNING)
    const heu = posteriors(m, path, HEURISTIC)
    expect(inv[1].A).toBeGreaterThan(inv[1].B)
    expect(heu[1].A).toBeGreaterThan(heu[1].B)
    // The heuristic's distribution after the last step equals the distribution from that step alone.
    const alone = posteriors(m, path.slice(1), HEURISTIC)
    for (const g of GOALS) expect(heu[1][g]).toBeCloseTo(alone[0][g], 9)
    // Inverse planning carries the first step: after the same last step, it differs from the step alone.
    const invAlone = posteriors(m, path.slice(1), INVERSE_PLANNING)
    expect(Math.abs(inv[1].A - invAlone[0].A)).toBeGreaterThan(0.001)
  })
  it('hand-computed: a single step straight right from (0,1) toward the corridor’s end, where A and B are symmetric, gives A = B for both models', () => {
    const m = new Maze(corridor)
    const p = at(m, [{ x: 0, y: 1 }, { x: 1, y: 1 }], INVERSE_PLANNING, 1)
    expect(p.A).toBeCloseTo(p.B, 9)
    expect(p.A).toBeGreaterThan(p.C)
    const h = at(m, [{ x: 0, y: 1 }, { x: 1, y: 1 }], HEURISTIC, 1)
    expect(h.A).toBeCloseTo(h.B, 9)
  })
  it('hand-computed on a two-goal line: with β = 2 the posterior after one optimal step toward A is the softmax ratio', () => {
    // A at the right end, B at the left end, C far above out of play: one step right from the middle.
    const line: Layout = { id: 'l', width: 5, height: 1, walls: [], goals: { A: { x: 4, y: 0 }, B: { x: 0, y: 0 }, C: { x: 2, y: 0 } } }
    const m = new Maze(line)
    const path = [
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ]
    // From (1,0): actions Stay, right, left. Under A (at 4): right −1−2 = −3, stay −1−3 = −4, left −1−4 = −5. Under B (at 0): right −3, stay −2, left −1. Under C (at 2): right −1, stay −2, left −3.
    const pA = Math.exp(2 * -3) / (Math.exp(2 * -3) + Math.exp(2 * -4) + Math.exp(2 * -5))
    const pB = Math.exp(2 * -3) / (Math.exp(2 * -3) + Math.exp(2 * -2) + Math.exp(2 * -1))
    const pC = Math.exp(2 * -1) / (Math.exp(2 * -1) + Math.exp(2 * -2) + Math.exp(2 * -3))
    const post = posteriors(m, path, INVERSE_PLANNING)[0]
    const total = pA + pB + pC
    expect(post.A).toBeCloseTo(pA / total, 9)
    expect(post.B).toBeCloseTo(pB / total, 9)
    expect(post.C).toBeCloseTo(pC / total, 9)
  })
  it('disagreement is half the total variation, and correlation is Pearson’s', () => {
    expect(disagreement({ A: 1, B: 0, C: 0 }, { A: 0, B: 1, C: 0 })).toBe(1)
    expect(disagreement({ A: 0.5, B: 0.5, C: 0 }, { A: 0.5, B: 0.5, C: 0 })).toBe(0)
    expect(correlation([1, 2, 3], [2, 4, 6])).toBeCloseTo(1)
    expect(correlation([1, 2, 3], [3, 2, 1])).toBeCloseTo(-1)
  })
})

describe('the path pool (§7.2, §16)', () => {
  it('24 paths, 16 shown and 8 reserve, six of each kind, two of each kind in reserve; every path is a chain of allowed steps ending at its goal and distinct from the others', () => {
    const pool = thePool()
    expect(pool.length).toBe(24)
    expect(shownPaths().length).toBe(16)
    expect(reservePaths().length).toBe(8)
    for (const kind of ['straight', 'around', 'turning', 'ambiguous'] as const) {
      expect(pool.filter((p) => p.kind === kind).length).toBe(6)
      expect(reservePaths().filter((p) => p.kind === kind).length).toBe(2)
    }
    const seen = new Set<string>()
    for (const p of pool) {
      const m = mazeOf(p.layout)
      const goal = m.layout.goals[p.goal]
      const last = p.cells[p.cells.length - 1]
      expect(last).toEqual(goal)
      for (let i = 0; i + 1 < p.cells.length; i++) {
        const a = ACTIONS.find((x) => x.dx === p.cells[i + 1].x - p.cells[i].x && x.dy === p.cells[i + 1].y - p.cells[i].y)
        expect(a, `${p.id} step ${i}`).toBeDefined()
        expect(m.allowed(p.cells[i], a!), `${p.id} step ${i}`).toBe(true)
      }
      const k = `${p.layout}:${p.cells.map((c) => `${c.x},${c.y}`).join(' ')}`
      expect(seen.has(k), p.id).toBe(false)
      seen.add(k)
      for (const j of p.judgments) expect(j.steps, `${p.id} judgment before the goal`).toBeLessThan(p.cells.length - 1)
      expect(p.judgments.length).toBeGreaterThanOrEqual(2)
      expect(p.judgments.length).toBeLessThanOrEqual(3)
    }
    expect(PATH_SPECS.every((s) => LAYOUTS.some((l) => l.id === s.layout))).toBe(true)
  })
  it('the models disagree substantially (by at least 0.2) on at least a quarter of the shown judgment points, and the record says which', () => {
    const s = disagreementSummary()
    expect(s.share).toBeGreaterThanOrEqual(0.25)
    expect(s.points.every((j) => j.disagreement >= SUBSTANTIAL)).toBe(true)
    expect(s.points.map((j) => j.path)).toContain('g1')
    expect(s.points.map((j) => j.path)).toContain('t1')
  })
  it('the ambiguous paths share their prefix up to the judgment points, so the judgment cannot read the destination off the path so far', () => {
    const g1 = thePool().find((p) => p.id === 'g1')!
    const g2 = thePool().find((p) => p.id === 'g2')!
    const n = Math.max(...g1.judgments.map((j) => j.steps)) + 1
    expect(g1.cells.slice(0, n)).toEqual(g2.cells.slice(0, n))
  })
})
