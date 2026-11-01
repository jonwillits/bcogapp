/**
 * The maze world of Part 3, Step 2 (spec §7.2), in the manner of Baker,
 * Saxe and Tenenbaum (2009): a grid with walls, three marked goal squares
 * A, B and C, and a dot that moves one square per step. As in the paper
 * (p. 332), the dot can take nine actions, Stay and the eight directions,
 * except where a wall blocks them; a straight step costs 1, a diagonal
 * step √2, and Stay 1 "to capture the desire for continual progress toward
 * the goal"; the costs cease at the goal. A diagonal step may not cut the
 * corner of a wall.
 *
 * Planning (p. 333): the optimal value of a square for a goal is the
 * negative of the shortest-path cost to it, by dynamic programming, and an
 * agent chooses actions "in proportion to the softmax function of the
 * expected value (negative expected cost) of each available action", with
 * β setting how deterministic it is.
 */

export interface Cell {
  x: number
  y: number
}

export type Goal = 'A' | 'B' | 'C'
export const GOALS: readonly Goal[] = ['A', 'B', 'C']

export interface Layout {
  id: string
  width: number
  height: number
  /** Wall squares. */
  walls: Cell[]
  goals: Record<Goal, Cell>
}

export interface Action {
  dx: -1 | 0 | 1
  dy: -1 | 0 | 1
  cost: number
}

/** Stay, the four straight steps, the four diagonal steps. */
export const ACTIONS: readonly Action[] = [
  { dx: 0, dy: 0, cost: 1 },
  { dx: 1, dy: 0, cost: 1 },
  { dx: -1, dy: 0, cost: 1 },
  { dx: 0, dy: 1, cost: 1 },
  { dx: 0, dy: -1, cost: 1 },
  { dx: 1, dy: 1, cost: Math.SQRT2 },
  { dx: 1, dy: -1, cost: Math.SQRT2 },
  { dx: -1, dy: 1, cost: Math.SQRT2 },
  { dx: -1, dy: -1, cost: Math.SQRT2 },
]

export const key = (c: Cell): string => `${c.x},${c.y}`

export class Maze {
  readonly layout: Layout
  private readonly wall: Set<string>
  /** dist[goal][key]: the shortest-path cost from a square to the goal. */
  private readonly dist: Record<Goal, Map<string, number>>

  constructor(layout: Layout) {
    this.layout = layout
    this.wall = new Set(layout.walls.map(key))
    this.dist = { A: this.distances(layout.goals.A), B: this.distances(layout.goals.B), C: this.distances(layout.goals.C) }
  }

  inside(c: Cell): boolean {
    return c.x >= 0 && c.y >= 0 && c.x < this.layout.width && c.y < this.layout.height
  }

  isWall(c: Cell): boolean {
    return this.wall.has(key(c))
  }

  /** Whether an action can be taken from a square: the target is inside and not a wall, and a diagonal does not cut a wall's corner. */
  allowed(from: Cell, a: Action): boolean {
    const to = { x: from.x + a.dx, y: from.y + a.dy }
    if (!this.inside(to) || this.isWall(to)) return false
    if (a.dx !== 0 && a.dy !== 0) {
      if (this.isWall({ x: from.x + a.dx, y: from.y }) || this.isWall({ x: from.x, y: from.y + a.dy })) return false
    }
    return true
  }

  /** The shortest-path cost from every square to a goal, by relaxation (the costs are 1 and √2). */
  private distances(goal: Cell): Map<string, number> {
    const d = new Map<string, number>()
    const { width, height } = this.layout
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (!this.isWall({ x, y })) d.set(key({ x, y }), Infinity)
    d.set(key(goal), 0)
    // Dijkstra over a small grid, with a plain scan for the minimum.
    const done = new Set<string>()
    for (;;) {
      let best: string | null = null
      let bestD = Infinity
      for (const [k, v] of d) if (!done.has(k) && v < bestD) {
        best = k
        bestD = v
      }
      if (best === null) break
      done.add(best)
      const [x, y] = best.split(',').map(Number)
      for (const a of ACTIONS) {
        if (a.dx === 0 && a.dy === 0) continue
        const from = { x: x - a.dx, y: y - a.dy }
        if (!this.inside(from) || this.isWall(from) || !this.allowed(from, a)) continue
        const k = key(from)
        if (bestD + a.cost < (d.get(k) ?? Infinity)) d.set(k, bestD + a.cost)
      }
    }
    return d
  }

  distance(c: Cell, g: Goal): number {
    return this.dist[g].get(key(c)) ?? Infinity
  }

  /** The value of taking an action from a square for a goal: minus its cost, minus the shortest cost from where it leads; zero at the goal, where the costs cease. */
  value(c: Cell, a: Action, g: Goal): number {
    if (key(c) === key(this.layout.goals[g])) return 0
    const to = { x: c.x + a.dx, y: c.y + a.dy }
    return -a.cost - this.distance(to, g)
  }

  /** The probability of each allowed action from a square under a goal: the softmax of its value with β. */
  policy(c: Cell, g: Goal, beta: number): Map<Action, number> {
    const out = new Map<Action, number>()
    let total = 0
    const vals: [Action, number][] = []
    for (const a of ACTIONS) {
      if (!this.allowed(c, a)) continue
      vals.push([a, this.value(c, a, g)])
    }
    const max = Math.max(...vals.map(([, v]) => v))
    for (const [a, v] of vals) {
      const e = Math.exp(beta * (v - max))
      out.set(a, e)
      total += e
    }
    for (const [a, e] of out) out.set(a, e / total)
    return out
  }

  /** The probability under a goal of the step actually taken from one square to the next. */
  likelihood(from: Cell, to: Cell, g: Goal, beta: number): number {
    const a = ACTIONS.find((x) => x.dx === to.x - from.x && x.dy === to.y - from.y)
    if (!a || !this.allowed(from, a)) return 0
    return this.policy(from, g, beta).get(a) ?? 0
  }

  /** A shortest path from a square to a goal, taking the best action at each step (ties by action order), through an optional waypoint. */
  shortestPath(from: Cell, g: Goal, via?: Cell): Cell[] {
    const toward = (start: Cell, target: Cell, d: (c: Cell) => number): Cell[] => {
      const path = [start]
      let c = start
      for (let guard = 0; guard < 200 && key(c) !== key(target); guard++) {
        let best: Action | null = null
        let bestV = -Infinity
        for (const a of ACTIONS) {
          if (a.dx === 0 && a.dy === 0 || !this.allowed(c, a)) continue
          const v = -a.cost - d({ x: c.x + a.dx, y: c.y + a.dy })
          if (v > bestV + 1e-9) {
            bestV = v
            best = a
          }
        }
        if (!best) break
        c = { x: c.x + best.dx, y: c.y + best.dy }
        path.push(c)
      }
      return path
    }
    if (via) {
      const viaMaze = new Maze({ ...this.layout, goals: { ...this.layout.goals, A: via } })
      const first = toward(from, via, (c) => viaMaze.distance(c, 'A'))
      const second = toward(via, this.layout.goals[g], (c) => this.distance(c, g))
      return [...first, ...second.slice(1)]
    }
    return toward(from, this.layout.goals[g], (c) => this.distance(c, g))
  }
}
