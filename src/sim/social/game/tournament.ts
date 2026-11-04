import { makeRng } from '../../random'
import { expectedPayoff } from './exact'
import { playMatch, rulePlayer, type MatchRecord, type Player } from './match'
import { predictorPlayer, type PredictorOptions } from './predictor'
import { bestTotal } from './best'
import { isDeterministic, type MemoryOneRule } from './rules'

/**
 * The round-robin (spec §6.3): every entry plays every entry, itself
 * included, for 200 rounds a match, at a noise level. An entry that is a
 * memory-one rule meets another by the exact expected payoff; a pair with
 * *Predictor* in it is played, once per seed, and reported as the mean over
 * the seeds with its spread. The table is average points per round for
 * every pair; an entry's total is its mean over every opponent, itself
 * included.
 */

export const ROUND_ROBIN_ROUNDS = 200
export const PREDICTOR_SEEDS = 50

export type Entry = { kind: 'rule'; rule: MemoryOneRule } | { kind: 'predictor'; options?: PredictorOptions }

export const entryId = (e: Entry): string => (e.kind === 'rule' ? e.rule.id : 'predictor')
export const entryLabel = (e: Entry): string => (e.kind === 'rule' ? e.rule.label : 'Predictor')

export interface Cell {
  /** Average points per round to the row entry against the column entry. */
  mean: number
  /** The standard deviation over seeds, for played pairs; 0 for exact ones. */
  sd: number
  played: boolean
}

export interface RoundRobin {
  entries: Entry[]
  rounds: number
  noise: number
  /** table[i][j]: the row's points per round against the column. */
  table: Cell[][]
  totals: number[]
  /** Entry indices from highest total to lowest. */
  ranking: number[]
}

function playerOf(e: Entry): Player<unknown> {
  return (e.kind === 'rule' ? rulePlayer(e.rule) : predictorPlayer(e.options)) as Player<unknown>
}

function stats(v: number[]): { mean: number; sd: number } {
  const mean = v.reduce((a, b) => a + b, 0) / v.length
  const sd = Math.sqrt(v.reduce((a, b) => a + (b - mean) * (b - mean), 0) / Math.max(1, v.length - 1))
  return { mean, sd }
}

export function roundRobin(entries: Entry[], noise: number, rounds = ROUND_ROBIN_ROUNDS, seeds = PREDICTOR_SEEDS, seedBase = 5000): RoundRobin {
  const n = entries.length
  const table: Cell[][] = Array.from({ length: n }, () => Array.from({ length: n }, () => ({ mean: 0, sd: 0, played: false })))
  for (let i = 0; i < n; i++) {
    for (let j = i; j < n; j++) {
      const a = entries[i]
      const b = entries[j]
      if (a.kind === 'rule' && b.kind === 'rule') {
        const e = expectedPayoff(a.rule, b.rule, rounds, noise)
        table[i][j] = { mean: e.aPerRound, sd: 0, played: false }
        table[j][i] = { mean: e.bPerRound, sd: 0, played: false }
      } else {
        const toA: number[] = []
        const toB: number[] = []
        for (let s = 0; s < seeds; s++) {
          const m = playMatch(playerOf(a), playerOf(b), rounds, noise, makeRng(seedBase + s * 7919 + i * 131 + j))
          toA.push(m.totalA / rounds)
          toB.push(m.totalB / rounds)
        }
        const sa = stats(toA)
        const sb = stats(toB)
        table[i][j] = { mean: sa.mean, sd: sa.sd, played: true }
        table[j][i] = { mean: sb.mean, sd: sb.sd, played: true }
      }
    }
  }
  const totals = table.map((row) => row.reduce((a, c) => a + c.mean, 0) / n)
  const ranking = totals.map((_, i) => i).sort((x, y) => totals[y] - totals[x])
  return { entries, rounds, noise, table, totals, ranking }
}

/** *Predictor* against one partner over matches of given lengths: its points, predictions correct, share of the best total, and the points lost to probing (§6.4). */
export interface PredictorVersus {
  partner: string
  rounds: number
  /** Means over the seeds, with the spread. */
  points: { mean: number; sd: number }
  partnerPoints: { mean: number; sd: number }
  predictionsCorrect: { mean: number; sd: number }
  predictionsShare: number
  best: number
  shareOfBest: number
  /** Mean total without probes minus mean total with probes, on the same seeds. */
  lostToProbing: number
  probes: { mean: number; sd: number }
  /** One played match, the first seed's, with its probes marked, for the replay. */
  sample: MatchRecord
}

export function predictorVersus(partner: MemoryOneRule, rounds: number, noise = 0, seeds = PREDICTOR_SEEDS, options: PredictorOptions = {}, seedBase = 9000): PredictorVersus {
  const pts: number[] = []
  const ppts: number[] = []
  const correct: number[] = []
  const probes: number[] = []
  const noProbe: number[] = []
  let sample: MatchRecord | null = null
  for (let s = 0; s < seeds; s++) {
    const m = playMatch(predictorPlayer(options), rulePlayer(partner), rounds, noise, makeRng(seedBase + s))
    pts.push(m.totalA)
    ppts.push(m.totalB)
    correct.push(m.rounds.filter((r) => r.predictedA === r.b).length)
    probes.push(m.rounds.filter((r) => r.probeA).length)
    const q = playMatch(predictorPlayer({ ...options, probeRate: 0 }), rulePlayer(partner), rounds, noise, makeRng(seedBase + s))
    noProbe.push(q.totalA)
    if (!sample) sample = m
  }
  const best = isDeterministic(partner) && noise === 0 ? bestTotal(partner, rounds).total : NaN
  const p = stats(pts)
  return {
    partner: partner.id,
    rounds,
    points: p,
    partnerPoints: stats(ppts),
    predictionsCorrect: stats(correct),
    predictionsShare: stats(correct).mean / rounds,
    best,
    shareOfBest: p.mean / best,
    lostToProbing: stats(noProbe).mean - p.mean,
    probes: stats(probes),
    sample: sample!,
  }
}
