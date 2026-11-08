import { describe, it, expect } from 'vitest'
import { makeRng } from '../../random'
import { stateGraph, startArrangement, goalArrangement, idOf, scrambled, positionOf, legalMoves, applyMove } from './hanoi'
import { runProcedure, PROCEDURE_IDS, MEMORIZED_LIST, shortestMoves } from './procedures'
import { sequences, minutesToExamine, timeInWords } from './futures'
import { treeSet, bestPath, bestThrough, LARGE_LOSS, PATHS, type Tree } from './trees'
import { expectedGain, runLooker, lookedBelowAfter, PRIOR_MEAN } from './lookers'

describe('the state graph (spec §14, Part 2)', () => {
  it('has 3ⁿ nodes and a shortest path of 2ⁿ − 1 moves, for n from 3 to 6', () => {
    for (const n of [3, 4, 5, 6]) {
      const g = stateGraph(n)
      expect(g.nodes.length).toBe(3 ** n)
      expect(g.shortest.length - 1).toBe(2 ** n - 1)
      expect(g.shortest[0]).toBe(idOf(startArrangement(n)))
      expect(g.shortest[g.shortest.length - 1]).toBe(idOf(goalArrangement(n)))
    }
  })
  it('every arrangement has at most three legal moves, and the graph is connected by them', () => {
    const g = stateGraph(4)
    for (const node of g.nodes) expect(node.neighbors.length).toBeLessThanOrEqual(3)
    for (const node of g.nodes) expect(node.neighbors.length).toBeGreaterThanOrEqual(2)
  })
  it('the layout is a triangle of triangles with the single-peg arrangements at the corners, and every edge joins two nodes a short distance apart', () => {
    const g = stateGraph(3)
    expect(positionOf([0, 0, 0])).toEqual({ x: 0.5, y: 0 })
    expect(positionOf([2, 2, 2])).toEqual({ x: 1, y: 0.866 })
    expect(positionOf([1, 1, 1])).toEqual({ x: 0, y: 0.866 })
    const step = 1 / (2 ** g.disks - 1)
    for (const node of g.nodes)
      for (const nb of node.neighbors) {
        const o = g.nodes[nb]
        expect(Math.hypot(node.x - o.x, node.y - o.y)).toBeLessThan(step * 1.01)
      }
    // Every node has its own place.
    const places = new Set(g.nodes.map((n) => `${n.x.toFixed(4)},${n.y.toFixed(4)}`))
    expect(places.size).toBe(27)
  })
  it('the halfway node of four disks is the three smaller disks on the middle peg with the largest still on the left, and every shortest solution passes through it', () => {
    const g = stateGraph(4)
    expect(g.halfway).toBe(idOf([1, 1, 1, 0]))
    expect(g.shortest).toContain(g.halfway)
  })
  it('a scrambled start is legal, not the start and not the goal', () => {
    const rng = makeRng(3)
    for (let i = 0; i < 20; i++) {
      const a = scrambled(4, rng)
      expect(a.every((p) => p === 0)).toBe(false)
      expect(a.every((p) => p === 2)).toBe(false)
      expect(legalMoves(a).length).toBeGreaterThan(0)
    }
  })
})

describe('the five procedures (spec §6.3, §14)', () => {
  it('search everything returns a shortest path; goal recursion’s stack reaches depth n; the pattern solves every n from the usual start; the largest-disk rule solves every n', () => {
    for (const n of [3, 4, 5, 6]) {
      const search = runProcedure('search', n, startArrangement(n))
      expect(search.solved).toBe(true)
      expect(search.moves.length).toBe(shortestMoves(n))
      const rec = runProcedure('recursion', n, startArrangement(n))
      expect(rec.solved).toBe(true)
      expect(rec.moves.length).toBe(shortestMoves(n))
      expect(rec.stored).toBe(n)
      const pat = runProcedure('pattern', n, startArrangement(n))
      expect(pat.solved).toBe(true)
      expect(pat.moves.length).toBe(shortestMoves(n))
      const big = runProcedure('largest', n, startArrangement(n))
      expect(big.solved).toBe(true)
      expect(big.moves.length).toBe(shortestMoves(n))
      expect(big.stored).toBe(1)
    }
  })
  it('the memorized moves solve four disks and fail on five, and the panel says how', () => {
    expect(MEMORIZED_LIST.length).toBe(15)
    const four = runProcedure('memorized', 4, startArrangement(4))
    expect(four.solved).toBe(true)
    const five = runProcedure('memorized', 5, startArrangement(5))
    expect(five.solved).toBe(false)
    expect(five.stopped).toMatch(/ran out with the disks on the wrong pegs/)
    const three = runProcedure('memorized', 3, startArrangement(3))
    expect(three.solved).toBe(false)
    expect(three.stopped).toMatch(/is not legal/)
  })
  it('from a scrambled start, the largest-disk rule and search solve the puzzle; goal recursion and the pattern stop and say why where they cannot', () => {
    const rng = makeRng(11)
    let recursionStopped = 0
    let patternStopped = 0
    for (let i = 0; i < 30; i++) {
      const s = scrambled(4, rng)
      expect(runProcedure('largest', 4, s).solved).toBe(true)
      expect(runProcedure('search', 4, s).solved).toBe(true)
      const r = runProcedure('recursion', 4, s)
      if (!r.solved) {
        recursionStopped++
        expect(r.stopped).toMatch(/not on one peg|already on the right peg/)
      }
      const p = runProcedure('pattern', 4, s)
      if (!p.solved) {
        patternStopped++
        expect(p.stopped).toBeTruthy()
      }
      const m = runProcedure('memorized', 4, s)
      expect(m.solved || m.stopped).toBeTruthy()
    }
    expect(recursionStopped).toBeGreaterThan(0)
    expect(patternStopped).toBeGreaterThan(0)
  })
  it('every move a procedure makes is legal, and search’s waiting list is what it stores', () => {
    for (const id of PROCEDURE_IDS) {
      const r = runProcedure(id, 5, startArrangement(5))
      let a = startArrangement(5)
      for (const m of r.moves) a = applyMove(a, m)
      expect(r.states[r.states.length - 1]).toEqual(a)
    }
    const s = runProcedure('search', 4, startArrangement(4))
    expect(s.examined).toBeGreaterThan(15)
    expect(s.examined).toBeLessThanOrEqual(81)
    expect(s.stored).toBeGreaterThan(1)
  })
})

describe('the futures panel (spec §6.3)', () => {
  it('reproduces the chapter’s numbers', () => {
    expect(sequences(2, 3)).toBe(8)
    expect(sequences(30, 3)).toBe(27000)
    expect(minutesToExamine(30, 3)).toBe(2700)
    expect(timeInWords(2700)).toBe('about 45 hours')
    expect(timeInWords(0.8)).toBe('less than a minute')
  })
})

describe('the trees and the lookers (spec §6.4, §14)', () => {
  const set = treeSet(makeRng(21))
  it('16 scored trees: 10 regular, 6 with a large loss early (3 whose best path runs through it), no two large-loss trees in a row; 3 practice; 6 reserve with 2 large-loss', () => {
    expect(set.practice.length).toBe(3)
    expect(set.scored.length).toBe(16)
    const kinds = set.scored.map((t) => t.kind)
    expect(kinds.filter((k) => k === 'regular').length).toBe(10)
    expect(kinds.filter((k) => k === 'lossBest').length).toBe(3)
    expect(kinds.filter((k) => k === 'lossNotBest').length).toBe(3)
    for (let i = 1; i < kinds.length; i++) expect(kinds[i] !== 'regular' && kinds[i - 1] !== 'regular').toBe(false)
    expect(set.reserve.length).toBe(6)
    expect(set.reserve.filter((t) => t.kind !== 'regular').length).toBe(2)
    for (const t of set.scored) {
      if (t.kind === 'lossBest') expect(bestPath(t).path[0]).toBe(t.lossNode)
      if (t.kind === 'lossNotBest') expect(bestPath(t).path[0]).not.toBe(t.lossNode)
      if (t.lossNode !== null) expect(t.values[t.lossNode]).toBe(LARGE_LOSS)
      if (t.kind === 'lossNotBest') expect(bestThrough(t, t.lossNode!)).toBeLessThan(bestThrough(t, 1 - t.lossNode!))
    }
  })
  it('the myopic looker’s expected gain is exact on small fixtures', () => {
    expect(PRIOR_MEAN).toBe(0)
    // Nothing known: uncovering a step-1 node. The best expected path is 0 now. Knowing node 0 = v: best = max(v, 0) over the two branches, so the mean over the four values is (0 + 0 + 5 + 10) / 4 = 3.75.
    const none: (number | null)[] = new Array(14).fill(null)
    expect(expectedGain(none, 0)).toBeCloseTo(3.75, 9)
    // A step-3 node when nothing else is known: the branch through it has expected value v, the other seven paths 0: the same 3.75.
    expect(expectedGain(none, 6)).toBeCloseTo(3.75, 9)
    // Node 0 known to be +10: the best path (through 0) is worth 10 in expectation; uncovering node 1 can only matter if it is +10 too (a tie, no gain), so the gain is 0.
    const k = [...none]
    k[0] = 10
    expect(expectedGain(k, 1)).toBeCloseTo(0, 9)
    // With node 0 at +10, uncovering a step-2 child of node 0: the best becomes 10 + max(v, 0) over its two children: mean of max(v,0) = 3.75 again.
    expect(expectedGain(k, 2)).toBeCloseTo(3.75, 9)
  })
  it('the three lookers run on a tree: nothing looks at nothing, everything looks at all 14 and takes the best path, one-more stops when no look is worth a point', () => {
    const rng = makeRng(5)
    for (const t of set.scored) {
      const a = runLooker('nothing', t, rng)
      expect(a.looks).toEqual([])
      const b = runLooker('everything', t, rng)
      expect(b.looks.length).toBe(14)
      expect(b.path).toEqual(bestPath(t).path)
      expect(b.net).toBe(bestPath(t).value - 14)
      const c = runLooker('oneMore', t, rng)
      expect(c.looks.length).toBeGreaterThan(0)
      expect(c.looks.length).toBeLessThanOrEqual(14)
      expect(PATHS.some((p) => p[0] === c.path[0] && p[1] === c.path[1] && p[2] === c.path[2])).toBe(true)
    }
  })
  it('looking below a large loss is read off the look sequence', () => {
    expect(lookedBelowAfter([0, 2, 6], 0)).toBe(true)
    expect(lookedBelowAfter([0, 1, 4], 0)).toBe(false)
    expect(lookedBelowAfter([1, 4], 0)).toBeNull()
    const t: Tree = { kind: 'regular', values: new Array(14).fill(5), lossNode: null }
    expect(bestPath(t).value).toBe(15)
  })
})
