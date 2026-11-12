import type { Rng } from '../../random'

/**
 * The trees of Part 2, Step 3 (spec §6.4), adapted from Callaway et al.
 * (2022) with a design of trees adapted from Huys et al. (2012): a start
 * node and two choices at each of three steps, so 2 + 4 + 8 = 14 hidden
 * nodes and 8 paths. Clicking a node uncovers its number for a cost of 1
 * point. On a regular tree every node is worth −10, −5, +5 or +10, drawn by
 * the seed (callaway_2022 p. 1115). On a tree with a large loss early, one
 * step-1 node is worth −40; on half of those, a step-3 node below it is
 * worth +60, so that the best path runs through the large loss; on the
 * others nothing below the −40 makes its branch the best.
 */

export const REGULAR_VALUES = [-10, -5, 5, 10] as const
export const LARGE_LOSS = -40
export const LARGE_GAIN = 60
export const LOOK_COST = 1
export const N_NODES = 14
export const N_PATHS = 8

export type TreeKind = 'regular' | 'lossBest' | 'lossNotBest'

export interface Tree {
  kind: TreeKind
  /** Node values, indexed 0–1 for step 1, 2–5 for step 2, 6–13 for step 3. */
  values: number[]
  /** The step-1 node holding the large loss, or null. */
  lossNode: number | null
}

/** The two children of a node at step 1 or 2. */
export function childrenOf(node: number): [number, number] {
  return node < 2 ? [2 + 2 * node, 3 + 2 * node] : [6 + 2 * (node - 2), 7 + 2 * (node - 2)]
}

export function parentOf(node: number): number | null {
  if (node < 2) return null
  if (node < 6) return Math.floor((node - 2) / 2)
  return 2 + Math.floor((node - 6) / 2)
}

export function stepOf(node: number): 1 | 2 | 3 {
  return node < 2 ? 1 : node < 6 ? 2 : 3
}

/** The eight paths, each three node indices, step 1 to step 3. */
export const PATHS: [number, number, number][] = (() => {
  const out: [number, number, number][] = []
  for (const a of [0, 1]) for (const b of childrenOf(a)) for (const c of childrenOf(b)) out.push([a, b, c])
  return out
})()

export function pathValue(tree: Tree, path: readonly number[]): number {
  return path.reduce((s, n) => s + tree.values[n], 0)
}

export function bestPath(tree: Tree): { path: [number, number, number]; value: number } {
  let best = PATHS[0]
  let value = -Infinity
  for (const p of PATHS) {
    const v = pathValue(tree, p)
    if (v > value) {
      value = v
      best = p
    }
  }
  return { path: best, value }
}

/** The best value among paths through a given step-1 node. */
export function bestThrough(tree: Tree, node1: number): number {
  return Math.max(...PATHS.filter((p) => p[0] === node1).map((p) => pathValue(tree, p)))
}

export function regularTree(rng: Rng): Tree {
  return { kind: 'regular', values: Array.from({ length: N_NODES }, () => REGULAR_VALUES[rng.int(4)]), lossNode: null }
}

/** A tree with a large loss at one step-1 node; `best` says whether the best path must run through it. Values are redrawn until the design holds. */
export function largeLossTree(rng: Rng, best: boolean): Tree {
  for (let attempt = 0; attempt < 1000; attempt++) {
    const t = regularTree(rng)
    const loss = rng.int(2)
    t.values[loss] = LARGE_LOSS
    const other = 1 - loss
    if (best) {
      const [c1, c2] = childrenOf(loss)
      const gc = [...childrenOf(c1), ...childrenOf(c2)]
      t.values[gc[rng.int(4)]] = LARGE_GAIN
      if (bestThrough(t, loss) > bestThrough(t, other)) return { ...t, kind: 'lossBest', lossNode: loss }
    } else if (bestThrough(t, loss) < bestThrough(t, other)) return { ...t, kind: 'lossNotBest', lossNode: loss }
  }
  throw new Error('no tree of the asked design in 1000 draws')
}

export const PRACTICE_TREES = 3
export const SCORED_TREES = 16
export const REGULAR_SCORED = 10
export const LOSS_SCORED = 6
export const RESERVE_TREES = 6

export interface TreeSet {
  practice: Tree[]
  /** 16 scored trees in the seed's order, with no two large-loss trees in a row. */
  scored: Tree[]
  /** 6 reserve trees of the same kinds, including 2 with a large loss early (one of each design), for a resumed sitting. */
  reserve: Tree[]
}

/** The trees for one student, from the seed (spec §6.4, §4.1). */
export function treeSet(rng: Rng): TreeSet {
  const practice = [regularTree(rng), regularTree(rng), regularTree(rng)]
  const regular = Array.from({ length: REGULAR_SCORED }, () => regularTree(rng))
  const losses = [largeLossTree(rng, true), largeLossTree(rng, true), largeLossTree(rng, true), largeLossTree(rng, false), largeLossTree(rng, false), largeLossTree(rng, false)]
  const scored = interleave(regular, shuffle(losses, rng), rng)
  const reserve = [regularTree(rng), regularTree(rng), regularTree(rng), regularTree(rng), largeLossTree(rng, true), largeLossTree(rng, false)]
  return { practice, scored, reserve }
}

function shuffle<T>(xs: T[], rng: Rng): T[] {
  const a = [...xs]
  for (let i = a.length - 1; i > 0; i--) {
    const j = rng.int(i + 1)
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** An order of the regular and the large-loss trees with no two large-loss trees in a row: the loss trees fall into distinct gaps between regular trees. */
function interleave(regular: Tree[], losses: Tree[], rng: Rng): Tree[] {
  // 11 gaps around 10 regular trees; choose 6 distinct gaps.
  const gaps = shuffle(Array.from({ length: regular.length + 1 }, (_, i) => i), rng)
    .slice(0, losses.length)
    .sort((a, b) => a - b)
  const out: Tree[] = []
  let li = 0
  for (let g = 0; g <= regular.length; g++) {
    if (gaps.includes(g)) out.push(losses[li++])
    if (g < regular.length) out.push(regular[g])
  }
  return out
}
