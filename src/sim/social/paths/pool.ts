import { Maze, type Cell, type Goal, type Layout } from './maze'
import { HEURISTIC, INVERSE_PLANNING, SUBSTANTIAL, at, disagreement, type Distribution } from './models'

/**
 * The path pool (spec §7.2): 24 paths authored for this lab in the manner
 * of Baker, Saxe and Tenenbaum (2009), 16 shown and 8 in reserve, in four
 * kinds in equal number: straight toward one goal; around a wall toward
 * one goal; toward one goal for most of the path and then turning toward
 * another; and paths whose last steps are ambiguous, where the two models
 * disagree most (the dot goes around a wall with a gap it could have taken,
 * and its last steps are consistent with two goals). Each path pauses at
 * two or three judgment points. A path is a fixed start, goal and optional
 * waypoint on a fixed layout, routed by the planner's shortest path, so
 * that every path is efficient except where its author made it turn.
 *
 * `pool.test.ts` holds the pool to the spec: the models disagree
 * substantially on at least a quarter of the shown judgment points, and
 * records which.
 */

export type PathKind = 'straight' | 'around' | 'turning' | 'ambiguous'
export const KIND_LABEL: Record<PathKind, string> = { straight: 'straight toward one goal', around: 'around a wall toward one goal', turning: 'toward one goal, then turning to another', ambiguous: 'ambiguous last steps' }

const W = 11
const H = 7

/**
 * Five layouts: open; a solid wall rising from the bottom edge; the same
 * wall with a gap in it; two staggered walls; and a lower wall with a gap
 * that leaves the middle row open, where a straight step along the middle
 * row is as efficient for A as for B. Goals A and B are at the right
 * corners in every layout, and C varies.
 */
export const LAYOUTS: Layout[] = [
  { id: 'open', width: W, height: H, walls: [], goals: { A: { x: 10, y: 0 }, B: { x: 10, y: 6 }, C: { x: 5, y: 0 } } },
  {
    id: 'solid',
    width: W,
    height: H,
    walls: [3, 4, 5, 6].map((y) => ({ x: 5, y })),
    goals: { A: { x: 10, y: 0 }, B: { x: 10, y: 6 }, C: { x: 8, y: 3 } },
  },
  {
    id: 'gap',
    width: W,
    height: H,
    walls: [3, 5, 6].map((y) => ({ x: 5, y })),
    goals: { A: { x: 10, y: 0 }, B: { x: 10, y: 6 }, C: { x: 8, y: 3 } },
  },
  {
    id: 'two',
    width: W,
    height: H,
    walls: [...[0, 1, 2].map((y) => ({ x: 3, y })), ...[4, 5, 6].map((y) => ({ x: 7, y }))],
    goals: { A: { x: 10, y: 0 }, B: { x: 10, y: 6 }, C: { x: 5, y: 3 } },
  },
  {
    id: 'low',
    width: W,
    height: H,
    walls: [4, 6].map((y) => ({ x: 5, y })),
    goals: { A: { x: 10, y: 0 }, B: { x: 10, y: 6 }, C: { x: 2, y: 0 } },
  },
]

export const layoutById = (id: string): Layout => LAYOUTS.find((l) => l.id === id)!

export interface PathSpec {
  id: string
  kind: PathKind
  layout: string
  start: Cell
  goal: Goal
  /** A square the path goes through first, where the author made it turn or go around. */
  via?: Cell
  /** Judgment points as step counts along the path. */
  points: number[]
  reserve: boolean
}

/** The shown paths first, then the reserves, two of each kind. */
export const PATH_SPECS: PathSpec[] = [
  // straight toward one goal
  { id: 's1', kind: 'straight', layout: 'open', start: { x: 0, y: 3 }, goal: 'A', points: [3, 6, 8], reserve: false },
  { id: 's2', kind: 'straight', layout: 'open', start: { x: 0, y: 3 }, goal: 'B', points: [3, 6, 8], reserve: false },
  { id: 's3', kind: 'straight', layout: 'open', start: { x: 2, y: 6 }, goal: 'C', points: [2, 4], reserve: false },
  { id: 's4', kind: 'straight', layout: 'solid', start: { x: 7, y: 6 }, goal: 'A', points: [2, 4], reserve: false },
  { id: 's5', kind: 'straight', layout: 'open', start: { x: 0, y: 0 }, goal: 'B', points: [3, 6, 8], reserve: true },
  { id: 's6', kind: 'straight', layout: 'two', start: { x: 0, y: 6 }, goal: 'C', points: [2, 4], reserve: true },
  // around a wall toward one goal
  { id: 'w1', kind: 'around', layout: 'solid', start: { x: 0, y: 6 }, goal: 'B', points: [3, 6, 9], reserve: false },
  { id: 'w2', kind: 'around', layout: 'solid', start: { x: 1, y: 5 }, goal: 'C', points: [3, 5], reserve: false },
  { id: 'w3', kind: 'around', layout: 'two', start: { x: 0, y: 1 }, goal: 'B', points: [3, 6, 9], reserve: false },
  { id: 'w4', kind: 'around', layout: 'low', start: { x: 0, y: 6 }, goal: 'B', points: [2, 4, 6], reserve: false },
  { id: 'w5', kind: 'around', layout: 'solid', start: { x: 2, y: 6 }, goal: 'C', points: [3, 5], reserve: true },
  { id: 'w6', kind: 'around', layout: 'two', start: { x: 0, y: 0 }, goal: 'B', points: [4, 7, 10], reserve: true },
  // toward one goal for most of the path, then turning toward another: a judgment just before the turn, and one or two just after
  { id: 't1', kind: 'turning', layout: 'open', start: { x: 0, y: 3 }, goal: 'B', via: { x: 6, y: 1 }, points: [5, 7, 8], reserve: false },
  { id: 't2', kind: 'turning', layout: 'open', start: { x: 0, y: 3 }, goal: 'A', via: { x: 6, y: 5 }, points: [5, 7, 8], reserve: false },
  { id: 't3', kind: 'turning', layout: 'open', start: { x: 0, y: 6 }, goal: 'C', via: { x: 8, y: 2 }, points: [6, 8, 9], reserve: false },
  { id: 't4', kind: 'turning', layout: 'low', start: { x: 0, y: 3 }, goal: 'B', via: { x: 7, y: 1 }, points: [6, 8, 9], reserve: false },
  { id: 't5', kind: 'turning', layout: 'open', start: { x: 0, y: 0 }, goal: 'B', via: { x: 7, y: 1 }, points: [6, 8, 9], reserve: true },
  { id: 't6', kind: 'turning', layout: 'low', start: { x: 0, y: 3 }, goal: 'A', via: { x: 7, y: 5 }, points: [6, 8, 9], reserve: true },
  // ambiguous last steps: up past the gap, then along the middle row, where a step right is as efficient for A as for B
  { id: 'g1', kind: 'ambiguous', layout: 'low', start: { x: 0, y: 6 }, goal: 'A', via: { x: 4, y: 3 }, points: [5, 6, 7], reserve: false },
  { id: 'g2', kind: 'ambiguous', layout: 'low', start: { x: 0, y: 6 }, goal: 'B', via: { x: 4, y: 3 }, points: [5, 6, 7], reserve: false },
  { id: 'g3', kind: 'ambiguous', layout: 'low', start: { x: 1, y: 6 }, goal: 'B', via: { x: 4, y: 3 }, points: [4, 5, 6], reserve: false },
  { id: 'g4', kind: 'ambiguous', layout: 'low', start: { x: 0, y: 5 }, goal: 'A', via: { x: 4, y: 3 }, points: [4, 5, 6], reserve: false },
  { id: 'g5', kind: 'ambiguous', layout: 'low', start: { x: 1, y: 6 }, goal: 'A', via: { x: 4, y: 3 }, points: [4, 5, 6], reserve: true },
  { id: 'g6', kind: 'ambiguous', layout: 'low', start: { x: 0, y: 5 }, goal: 'B', via: { x: 4, y: 3 }, points: [4, 5, 6], reserve: true },
]

export interface JudgmentPoint {
  path: string
  steps: number
  inverse: Distribution
  heuristic: Distribution
  disagreement: number
  substantial: boolean
}

export interface AuthoredPath extends PathSpec {
  cells: Cell[]
  judgments: JudgmentPoint[]
}

const mazes = new Map<string, Maze>()
export function mazeOf(layoutId: string): Maze {
  let m = mazes.get(layoutId)
  if (!m) {
    m = new Maze(layoutById(layoutId))
    mazes.set(layoutId, m)
  }
  return m
}

export function authorPath(spec: PathSpec): AuthoredPath {
  const maze = mazeOf(spec.layout)
  const cells = maze.shortestPath(spec.start, spec.goal, spec.via)
  const judgments: JudgmentPoint[] = spec.points.map((steps) => {
    const inverse = at(maze, cells, INVERSE_PLANNING, steps)
    const heuristic = at(maze, cells, HEURISTIC, steps)
    const d = disagreement(inverse, heuristic)
    return { path: spec.id, steps, inverse, heuristic, disagreement: d, substantial: d >= SUBSTANTIAL }
  })
  return { ...spec, cells, judgments }
}

let pool: AuthoredPath[] | null = null
export function thePool(): AuthoredPath[] {
  if (!pool) pool = PATH_SPECS.map(authorPath)
  return pool
}

export const shownPaths = (): AuthoredPath[] => thePool().filter((p) => !p.reserve)
export const reservePaths = (): AuthoredPath[] => thePool().filter((p) => p.reserve)
export const pathById = (id: string): AuthoredPath => thePool().find((p) => p.id === id)!

/** The share of the shown judgment points on which the models disagree substantially, and which they are. */
export function disagreementSummary(paths: AuthoredPath[] = shownPaths()): { total: number; substantial: number; share: number; points: JudgmentPoint[] } {
  const points = paths.flatMap((p) => p.judgments)
  const sub = points.filter((j) => j.substantial)
  return { total: points.length, substantial: sub.length, share: sub.length / points.length, points: sub }
}
