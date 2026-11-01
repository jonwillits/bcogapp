import { GOALS, type Cell, type Goal, type Maze } from './maze'

/**
 * The two models of Part 3, Step 2 (spec §7.2), from Baker, Saxe and
 * Tenenbaum (2009), pp. 333–334 and Table 1:
 *
 * **Inverse planning, M2**: the observer assumes the dot moves efficiently
 * toward its goal, by the softmax planner of `maze.ts`, and that the goal
 * can change along the way with probability γ after each action; the
 * posterior over goals given the actions so far is computed online by
 * Bayes' rule (Eq. 1). With the paper's best-fit parameters for its online
 * task: β = 2.0, γ = 0.25 (Fig. 5).
 *
 * **The "last moved toward" rule, H**: the paper formulates its heuristic
 * "as a special case of M2 in which agents' goals can change arbitrarily
 * after every action, i.e. γ is set to its extreme value of 1" (p. 334),
 * with β = 2.5 (Fig. 5). With γ = 1 the goal is drawn afresh from the prior
 * before every action, so only the most recent action bears on the
 * judgment: the goal is whichever the dot last moved toward.
 *
 * A goal change here is a draw from the prior, which may return the same
 * goal; the paper's Appendix is not in the library, and this is the reading
 * on which H depends only on the last action, as the text says. The
 * as-built notes record it.
 */

export interface ModelSpec {
  id: 'inverse' | 'heuristic'
  label: string
  beta: number
  gamma: number
}

export const INVERSE_PLANNING: ModelSpec = { id: 'inverse', label: 'Inverse planning', beta: 2.0, gamma: 0.25 }
export const HEURISTIC: ModelSpec = { id: 'heuristic', label: 'The “last moved toward” rule', beta: 2.5, gamma: 1 }
export const MODELS = [INVERSE_PLANNING, HEURISTIC] as const

export type Distribution = Record<Goal, number>

const uniform = (): Distribution => ({ A: 1 / 3, B: 1 / 3, C: 1 / 3 })

/** The posterior over goals after each step of a path, from the uniform prior; `after[t]` follows the step from path[t] to path[t + 1]. */
export function posteriors(maze: Maze, path: readonly Cell[], model: ModelSpec): Distribution[] {
  let belief = uniform()
  const out: Distribution[] = []
  for (let t = 0; t + 1 < path.length; t++) {
    const predicted: Distribution = { A: 0, B: 0, C: 0 }
    for (const g of GOALS) predicted[g] = (1 - model.gamma) * belief[g] + model.gamma / 3
    const next: Distribution = { A: 0, B: 0, C: 0 }
    let total = 0
    for (const g of GOALS) {
      next[g] = predicted[g] * maze.likelihood(path[t], path[t + 1], g, model.beta)
      total += next[g]
    }
    if (total > 0) for (const g of GOALS) next[g] /= total
    else for (const g of GOALS) next[g] = predicted[g]
    belief = next
    out.push({ ...belief })
  }
  return out
}

/** The model's distribution at a judgment point: after the dot's `steps` steps along the path. */
export function at(maze: Maze, path: readonly Cell[], model: ModelSpec, steps: number): Distribution {
  const p = posteriors(maze, path.slice(0, steps + 1), model)
  return p.length ? p[p.length - 1] : uniform()
}

/** Half the total variation distance: how far two distributions over the three goals differ, 0 to 1. */
export function disagreement(a: Distribution, b: Distribution): number {
  return 0.5 * GOALS.reduce((s, g) => s + Math.abs(a[g] - b[g]), 0)
}

/** The models disagree substantially at a point when they are this far apart (the build's definition, §7.2). */
export const SUBSTANTIAL = 0.2

/** Pearson's correlation between two sequences. */
export function correlation(x: readonly number[], y: readonly number[]): number {
  const n = x.length
  if (n < 2) return NaN
  const mx = x.reduce((a, b) => a + b, 0) / n
  const my = y.reduce((a, b) => a + b, 0) / n
  let sxy = 0
  let sxx = 0
  let syy = 0
  for (let i = 0; i < n; i++) {
    sxy += (x[i] - mx) * (y[i] - my)
    sxx += (x[i] - mx) ** 2
    syy += (y[i] - my) ** 2
  }
  return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : NaN
}
