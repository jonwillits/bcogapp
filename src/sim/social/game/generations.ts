import { type Entry, type RoundRobin } from './tournament'
import { OUTCOMES, type MemoryOneRule } from './rules'

/**
 * Axelrod's ecological simulation (spec §6.6; §11.2.1, "a simulation in
 * which more successful programs became more common"): every entry starts
 * at an equal share; each generation an entry's share is multiplied by its
 * average points per round against the current population, and the shares
 * are renormalized.
 *
 * **The memory cost** (Jon, 2026-11-02, replacing the spec's cost on
 * Predictor alone): each entry is charged for what it stores from one
 * round to the next, at a cost per stored number per round, subtracted
 * from its average points before the update. The units are counts, not
 * tuned: a rule whose table makes the same move whatever happened stores
 * nothing (0); a rule that reads the previous round stores it (1);
 * Predictor stores its ten counts and the previous round (11). The cost
 * stands in for what memory costs an animal; it is not a measured cost of
 * any brain.
 */

export const GENERATIONS = 300
/** The cost per stored number per round, the five settings on the stage. */
export const MEMORY_COSTS = [0, 0.01, 0.02, 0.05, 0.1] as const
/** Predictor's units: the ten counts (two for the first move, two after each of the four outcomes) and the previous round. */
export const PREDICTOR_UNITS = 11

/** How many numbers an entry stores from one round to the next. */
export function memoryUnits(e: Entry): number {
  if (e.kind === 'predictor') return PREDICTOR_UNITS
  return ruleUnits(e.rule)
}

export function ruleUnits(rule: MemoryOneRule): number {
  const same = OUTCOMES.every((o) => rule.after[o] === rule.first)
  return same ? 0 : 1
}

/** The cost vector for a round-robin at a cost per unit. */
export function costsFor(rr: RoundRobin, perUnit: number): number[] {
  return rr.entries.map((e) => memoryUnits(e) * perUnit)
}

export interface GenerationsRun {
  /** shares[g][i]: entry i's share at generation g, from 0 to GENERATIONS. */
  shares: number[][]
  /** The entry most common at the end. */
  mostCommon: number
  /** Entries whose final share is under 1%. */
  vanished: number[]
}

export function runGenerations(rr: RoundRobin, costs: number[] = [], generations = GENERATIONS): GenerationsRun {
  const n = rr.entries.length
  let share = new Array<number>(n).fill(1 / n)
  const shares: number[][] = [share.slice()]
  for (let g = 0; g < generations; g++) {
    const next = new Array<number>(n).fill(0)
    for (let i = 0; i < n; i++) {
      let avg = 0
      for (let j = 0; j < n; j++) avg += share[j] * rr.table[i][j].mean
      avg -= costs[i] ?? 0
      next[i] = share[i] * Math.max(0, avg)
    }
    const total = next.reduce((a, b) => a + b, 0)
    share = total > 0 ? next.map((v) => v / total) : share
    shares.push(share.slice())
  }
  const last = shares[shares.length - 1]
  let mostCommon = 0
  for (let i = 1; i < n; i++) if (last[i] > last[mostCommon]) mostCommon = i
  return { shares, mostCommon, vanished: last.map((v, i) => (v < 0.01 ? i : -1)).filter((i) => i >= 0) }
}

/** The lowest cost per unit at which an entry's share by the end is below its starting share, or null if none in the list does it; and its final share at each. */
export function costAtWhichEntryStops(rr: RoundRobin, index: number, costList: readonly number[] = MEMORY_COSTS, generations = GENERATIONS): { cost: number | null; finalShares: Record<number, number> } {
  const start = 1 / rr.entries.length
  const finalShares: Record<number, number> = {}
  let stop: number | null = null
  for (const c of costList) {
    const run = runGenerations(rr, costsFor(rr, c), generations)
    const final = run.shares[run.shares.length - 1][index]
    finalShares[c] = final
    if (stop === null && final < start) stop = c
  }
  return { cost: stop, finalShares }
}
