import type { Rng } from '../../random'
import { bestPath, childrenOf, LOOK_COST, N_NODES, PATHS, REGULAR_VALUES, type Tree } from './trees'

/**
 * Three programmed lookers (spec §6.4), run on the student's own trees:
 * **Look at nothing** chooses a path at random; **Look at everything**
 * uncovers all 14 nodes and takes the best path; **One more look when it is
 * worth it** uncovers the node whose uncovering is expected to raise the
 * value of the best path by more than the 1-point cost, and stops when no
 * node is, as Callaway et al. (2022, p. 1114) describe a myopic
 * approximation to their optimal model. Nothing here is called optimal: the
 * myopic rule is an approximation, and the two others are simple rules.
 */

export type LookerId = 'nothing' | 'everything' | 'oneMore'

export const LOOKER_IDS: readonly LookerId[] = ['nothing', 'everything', 'oneMore']

export const LOOKER_LABEL: Record<LookerId, string> = {
  nothing: 'Look at nothing',
  everything: 'Look at everything',
  oneMore: 'One more look when it is worth it',
}

export const LOOKER_RULE: Record<LookerId, string> = {
  nothing: 'It uncovers no number and takes one of the eight paths at random.',
  everything: 'It uncovers all 14 numbers, at a cost of 14 points, and takes the path with the highest sum.',
  oneMore: 'For every number still hidden, it computes how much uncovering that one number is expected to raise the value of the best path, taking each hidden number to be −10, −5, +5 or +10 with equal chance. If the largest such gain is more than the 1-point cost of a look, it uncovers that number and computes again. Otherwise it stops and takes the path whose expected sum is highest.',
}

export interface LookerRun {
  looker: LookerId
  /** The nodes uncovered, in order. */
  looks: number[]
  path: [number, number, number]
  /** Points earned: the path's sum minus the looks. */
  net: number
}

/** The expected value of a hidden node under the lookers' prior: the mean of −10, −5, +5 and +10. */
export const PRIOR_MEAN = REGULAR_VALUES.reduce((a, b) => a + b, 0) / REGULAR_VALUES.length

/** The expected sum of a path, given which nodes are known. */
function expectedPathValue(known: (number | null)[], path: readonly number[]): number {
  return path.reduce((s, n) => s + (known[n] ?? PRIOR_MEAN), 0)
}

function bestExpected(known: (number | null)[]): { path: [number, number, number]; value: number } {
  let best = PATHS[0]
  let value = -Infinity
  for (const p of PATHS) {
    const v = expectedPathValue(known, p)
    if (v > value) {
      value = v
      best = p
    }
  }
  return { path: best, value }
}

/**
 * The expected gain from uncovering `node`: the mean, over the four values
 * it could take with equal chance, of the best expected path value once it
 * is known, minus the best expected path value now (Callaway et al. 2022,
 * p. 1114: the one-step lookahead that picks the operation most helpful if
 * a plan had to be chosen right after it).
 */
export function expectedGain(known: (number | null)[], node: number): number {
  const now = bestExpected(known).value
  let after = 0
  for (const v of REGULAR_VALUES) {
    const k = [...known]
    k[node] = v
    after += bestExpected(k).value
  }
  return after / REGULAR_VALUES.length - now
}

export function runLooker(id: LookerId, tree: Tree, rng: Rng): LookerRun {
  switch (id) {
    case 'nothing': {
      const path = PATHS[rng.int(PATHS.length)]
      return { looker: id, looks: [], path, net: path.reduce((s, n) => s + tree.values[n], 0) }
    }
    case 'everything': {
      const looks = Array.from({ length: N_NODES }, (_, i) => i)
      const b = bestPath(tree)
      return { looker: id, looks, path: b.path, net: b.value - looks.length * LOOK_COST }
    }
    case 'oneMore': {
      const known: (number | null)[] = new Array(N_NODES).fill(null)
      const looks: number[] = []
      for (;;) {
        let bestNode = -1
        let bestGain = -Infinity
        for (let n = 0; n < N_NODES; n++) {
          if (known[n] !== null) continue
          const g = expectedGain(known, n)
          if (g > bestGain + 1e-9) {
            bestGain = g
            bestNode = n
          }
        }
        if (bestNode < 0 || bestGain <= LOOK_COST) break
        known[bestNode] = tree.values[bestNode]
        looks.push(bestNode)
      }
      // The path with the highest expected sum; among equals, the seed decides.
      const top = bestExpected(known).value
      const ties = PATHS.filter((p) => Math.abs(expectedPathValue(known, p) - top) < 1e-9)
      const path = ties[rng.int(ties.length)]
      return { looker: id, looks, path, net: path.reduce((s, n) => s + tree.values[n], 0) - looks.length * LOOK_COST }
    }
  }
}

/** Whether a look sequence uncovered any node below a given step-1 node after uncovering that node. */
export function lookedBelowAfter(looks: readonly number[], node1: number): boolean | null {
  const at = looks.indexOf(node1)
  if (at < 0) return null
  const below = new Set<number>()
  for (const c of childrenOf(node1)) {
    below.add(c)
    for (const g of childrenOf(c)) below.add(g)
  }
  return looks.slice(at + 1).some((n) => below.has(n))
}
