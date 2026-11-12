/**
 * The Tower of Hanoi (spec §6.1, §6.2): three pegs, a stack of disks of
 * different sizes, one disk moved at a time, never a larger disk on a
 * smaller one. An arrangement is one peg per disk, disk 0 the smallest. The
 * problem space (§12.2.2) is the graph of every arrangement joined to the
 * arrangements one legal move away: 3ⁿ nodes, and 2ⁿ − 1 moves in the
 * shortest solution (`simon_1975` p. 269). The graph is laid out as the
 * chapter draws it for three disks (`f-hanoi-states`): a triangle of
 * triangles, with the three arrangements that have every disk on one peg at
 * the corners, recursively, never by force-directed placement.
 */

export type Peg = 0 | 1 | 2

export const PEG_LABEL: Record<Peg, string> = { 0: 'left', 1: 'middle', 2: 'right' }

/** One peg per disk, disk 0 the smallest. */
export type Arrangement = Peg[]

export interface Move {
  from: Peg
  to: Peg
}

export const START_PEG: Peg = 0
export const GOAL_PEG: Peg = 2

export function startArrangement(n: number): Arrangement {
  return new Array<Peg>(n).fill(START_PEG)
}

export function goalArrangement(n: number): Arrangement {
  return new Array<Peg>(n).fill(GOAL_PEG)
}

export function isGoal(a: Arrangement): boolean {
  return a.every((p) => p === GOAL_PEG)
}

/** The arrangement as a number in base 3, disk 0 the lowest digit: the node's id. */
export function idOf(a: Arrangement): number {
  let id = 0
  for (let d = a.length - 1; d >= 0; d--) id = id * 3 + a[d]
  return id
}

export function arrangementOf(id: number, n: number): Arrangement {
  const a: Arrangement = []
  for (let d = 0; d < n; d++) {
    a.push((id % 3) as Peg)
    id = Math.floor(id / 3)
  }
  return a
}

/** The smallest disk on a peg, or null when the peg is empty. */
export function topDisk(a: Arrangement, peg: Peg): number | null {
  for (let d = 0; d < a.length; d++) if (a[d] === peg) return d
  return null
}

/** Why a move is illegal, or null when it is legal. */
export function illegalBecause(a: Arrangement, m: Move): string | null {
  if (m.from === m.to) return 'The disk was put back on the same peg, which is not a move.'
  const d = topDisk(a, m.from)
  if (d === null) return `The ${PEG_LABEL[m.from]} peg has no disk to move.`
  const t = topDisk(a, m.to)
  if (t !== null && t < d) return 'A larger disk cannot be placed on a smaller one.'
  return null
}

export function applyMove(a: Arrangement, m: Move): Arrangement {
  const d = topDisk(a, m.from)
  if (d === null || illegalBecause(a, m)) throw new Error('illegal move')
  const next = [...a]
  next[d] = m.to
  return next
}

/** Every legal move from an arrangement: at most three. */
export function legalMoves(a: Arrangement): Move[] {
  const moves: Move[] = []
  for (const from of [0, 1, 2] as Peg[]) for (const to of [0, 1, 2] as Peg[]) if (from !== to && illegalBecause(a, { from, to }) === null) moves.push({ from, to })
  return moves
}

export function neighbors(a: Arrangement): Arrangement[] {
  return legalMoves(a).map((m) => applyMove(a, m))
}

export interface GraphNode {
  id: number
  arrangement: Arrangement
  /** Position in the unit triangle, x to the right and y down. */
  x: number
  y: number
  neighbors: number[]
}

export interface StateGraph {
  disks: number
  nodes: GraphNode[]
  /** The ids along the shortest solution, start first. */
  shortest: number[]
  /** For four disks and more: the arrangement with every disk but the largest on the middle peg and the largest still on the left (spec §6.2). */
  halfway: number | null
}

/** The corner of the unit triangle for each peg: left at the top, middle at the bottom left, right at the bottom right, as the chapter draws it. */
const CORNERS: Record<Peg, { x: number; y: number }> = { 0: { x: 0.5, y: 0 }, 1: { x: 0, y: 0.866 }, 2: { x: 1, y: 0.866 } }

/** The side of the n-disk triangle, in moves: 2ⁿ − 1 edges of one move each. */
const side = (n: number) => 2 ** n - 1

/**
 * Where an arrangement sits. The n-disk graph is three copies of the
 * (n − 1)-disk graph, one at each corner, each a triangle of side 2ⁿ⁻¹ − 1
 * moves inside a triangle of side 2ⁿ − 1, so that one edge of one move
 * separates two copies. The peg of the largest disk picks the copy at that
 * corner. Inside it, the corner for "every smaller disk on peg q" lies toward
 * the third peg r, because moving the largest disk from p to r needs every
 * smaller disk on q, and that arrangement sits where copy p faces copy r.
 * Then the smaller disks recurse into the copy.
 */
export function positionOf(a: Arrangement): { x: number; y: number } {
  let corners = { ...CORNERS }
  for (let d = a.length - 1; d >= 0; d--) {
    const p = a[d]
    if (d === 0) return corners[p]
    const k = d + 1 // disks remaining, including this one
    const f = side(k - 1) / side(k)
    const next = { ...corners }
    for (const q of [0, 1, 2] as Peg[]) {
      if (q === p) continue
      const r = (3 - p - q) as Peg
      next[q] = { x: corners[p].x + (corners[r].x - corners[p].x) * f, y: corners[p].y + (corners[r].y - corners[p].y) * f }
    }
    corners = next
  }
  return corners[0]
}

const graphs = new Map<number, StateGraph>()

/** The whole problem space for n disks, built once. */
export function stateGraph(n: number): StateGraph {
  const cached = graphs.get(n)
  if (cached) return cached
  const count = 3 ** n
  const nodes: GraphNode[] = []
  for (let id = 0; id < count; id++) {
    const arrangement = arrangementOf(id, n)
    const pos = positionOf(arrangement)
    nodes.push({ id, arrangement, x: pos.x, y: pos.y, neighbors: neighbors(arrangement).map(idOf) })
  }
  const shortest = shortestPath(n, startArrangement(n), goalArrangement(n)).map(idOf)
  let halfway: number | null = null
  if (n >= 4) {
    const h = new Array<Peg>(n).fill(1)
    h[n - 1] = START_PEG
    halfway = idOf(h)
  }
  const g = { disks: n, nodes, shortest, halfway }
  graphs.set(n, g)
  return g
}

/** Breadth-first search from one arrangement to another, returning the arrangements along a shortest path, start first. */
export function shortestPath(n: number, from: Arrangement, to: Arrangement): Arrangement[] {
  const goal = idOf(to)
  const start = idOf(from)
  const prev = new Map<number, number>()
  prev.set(start, -1)
  const queue = [start]
  while (queue.length) {
    const id = queue.shift()!
    if (id === goal) break
    for (const nb of neighbors(arrangementOf(id, n)).map(idOf)) {
      if (!prev.has(nb)) {
        prev.set(nb, id)
        queue.push(nb)
      }
    }
  }
  const path: Arrangement[] = []
  for (let id = goal; id !== -1; id = prev.get(id)!) path.unshift(arrangementOf(id, n))
  return path
}

/** A legal arrangement drawn by the seed, not the usual start and not the goal (spec §6.3, Scramble). */
export function scrambled(n: number, rng: { int(n: number): number }): Arrangement {
  for (;;) {
    const a = Array.from({ length: n }, () => rng.int(3) as Peg)
    if (!isGoal(a) && !a.every((p) => p === START_PEG)) return a
  }
}
