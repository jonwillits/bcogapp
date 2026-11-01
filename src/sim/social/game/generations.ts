import type { RoundRobin } from './tournament'

/**
 * Axelrod's ecological simulation (spec §6.6; §11.2.1, "a simulation in
 * which more successful programs became more common"): every entry starts
 * at an equal share; each generation an entry's share is multiplied by its
 * average points per round against the current population, and the shares
 * are renormalized. *Predictor*'s cost (§6.6) is subtracted from its
 * average points before the update, and stands in for what computing a
 * prediction costs an animal; it is not a measured cost of any brain.
 */

export const GENERATIONS = 300
export const PREDICTOR_COSTS = [0, 0.05, 0.1, 0.2, 0.5] as const

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

/** The lowest cost at which Predictor's share by the end is below its starting share, or null if none in the list does it. */
export function costAtWhichPredictorStops(rr: RoundRobin, predictorIndex: number, costList: readonly number[] = PREDICTOR_COSTS, generations = GENERATIONS): { cost: number | null; finalShares: Record<number, number> } {
  const finalShares: Record<number, number> = {}
  let stop: number | null = null
  const start = 1 / rr.entries.length
  for (const c of costList) {
    const costs = rr.entries.map((_, i) => (i === predictorIndex ? c : 0))
    const run = runGenerations(rr, costs, generations)
    const final = run.shares[run.shares.length - 1][predictorIndex]
    finalShares[c] = final
    if (stop === null && final < start) stop = c
  }
  return { cost: stop, finalShares }
}
