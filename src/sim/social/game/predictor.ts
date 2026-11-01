import type { Rng } from '../../random'
import type { Player, Decision } from './match'
import { OUTCOMES, outcomeOf, points, type Move, type Outcome } from './rules'

/**
 * *Predictor* (spec §6.4, decision 18): the one entry that is not a fixed
 * table of moves. It estimates each partner's next move from the partner's
 * past moves and plays the best response to its estimate, with occasional
 * probes. It is the student of Part 1 as a program.
 *
 * **What it stores**, per partner: counts of the partner's first move, and
 * of the partner's move after each of the four outcomes of the previous
 * round (from its own side: its move, then the partner's), each count
 * starting at one cooperation and one defection. From the counts it
 * computes, for each outcome, the probability that the partner cooperates
 * next.
 *
 * **How it chooses**: on round 1 it cooperates. On every later round it
 * computes, under its current estimates, the expected points of every
 * sequence of its own moves over the next HORIZON rounds, by exhaustive
 * search (2^HORIZON sequences), and plays the first move of the best
 * sequence; among equal sequences the one that cooperates first. With
 * probability PROBE_RATE it plays the other move instead, a probe.
 *
 * **What it does not do**: it does not model the partner modeling it, it
 * carries nothing from one partner to the next (each match starts from
 * fresh counts), and it has no partner's rule, only counts. It estimates,
 * computes and probes; it does not know or want.
 *
 * The horizon and the probe rate were fixed before any result was measured
 * (§6.4) and are not tuned to make it win or lose.
 */

export const HORIZON = 3
export const PROBE_RATE = 0.05

export interface Counts {
  /** The partner's first moves seen: [cooperations, defections], starting at [1, 1]. */
  first: [number, number]
  after: Record<Outcome, [number, number]>
}

export interface PredictorState {
  counts: Counts
  /** The previous round from this side, or null on round 1. */
  previous: Outcome | null
  /** How the estimates stood before each round, for the panel that shows how they changed. */
  history: { round: number; estimates: Record<Outcome, number>; first: number }[]
}

export function freshCounts(): Counts {
  return { first: [1, 1], after: { CC: [1, 1], CD: [1, 1], DC: [1, 1], DD: [1, 1] } }
}

export function estimates(counts: Counts): Record<Outcome, number> {
  const out = {} as Record<Outcome, number>
  for (const o of OUTCOMES) out[o] = counts.after[o][0] / (counts.after[o][0] + counts.after[o][1])
  return out
}

export const firstEstimate = (counts: Counts): number => counts.first[0] / (counts.first[0] + counts.first[1])

/**
 * The expected points of a fixed sequence of my moves from a previous
 * outcome, under the estimates: the partner's next move is C with the
 * estimated probability for the outcome so far, and the outcome then
 * branches on it.
 */
export function expectedPointsOfSequence(seq: readonly Move[], previous: Outcome, est: Record<Outcome, number>): number {
  const go = (k: number, o: Outcome): number => {
    if (k === seq.length) return 0
    const mine = seq[k]
    const pc = est[o]
    const ifC = points(mine, 'C') + go(k + 1, outcomeOf(mine, 'C'))
    const ifD = points(mine, 'D') + go(k + 1, outcomeOf(mine, 'D'))
    return pc * ifC + (1 - pc) * ifD
  }
  return go(0, previous)
}

export function everySequence(horizon: number): Move[][] {
  const out: Move[][] = []
  for (let mask = 0; mask < 1 << horizon; mask++) out.push(Array.from({ length: horizon }, (_, k) => (mask & (1 << k) ? 'D' : 'C')))
  return out
}

/** The first move of the best sequence under the estimates, ties to cooperating first. */
export function bestFirstMove(previous: Outcome, est: Record<Outcome, number>, horizon = HORIZON): { move: Move; values: { seq: string; value: number }[] } {
  let best = -Infinity
  let move: Move = 'C'
  const values: { seq: string; value: number }[] = []
  for (const seq of everySequence(horizon)) {
    const v = expectedPointsOfSequence(seq, previous, est)
    values.push({ seq: seq.join(''), value: v })
    if (v > best + 1e-9 || (Math.abs(v - best) <= 1e-9 && seq[0] === 'C' && move === 'D')) {
      best = v
      move = seq[0]
    }
  }
  return { move, values }
}

export interface PredictorOptions {
  horizon?: number
  probeRate?: number
}

export function predictorPlayer(options: PredictorOptions = {}): Player<PredictorState> {
  const horizon = options.horizon ?? HORIZON
  const probeRate = options.probeRate ?? PROBE_RATE
  return {
    id: 'predictor',
    label: 'Predictor',
    start: () => ({ counts: freshCounts(), previous: null, history: [] }),
    decide: (s, rng: Rng): Decision => {
      const est = estimates(s.counts)
      s.history.push({ round: s.history.length + 1, estimates: est, first: firstEstimate(s.counts) })
      if (s.previous === null) {
        const predicted: Move = firstEstimate(s.counts) >= 0.5 ? 'C' : 'D'
        return { move: 'C', predicted }
      }
      const predicted: Move = est[s.previous] >= 0.5 ? 'C' : 'D'
      const chosen = bestFirstMove(s.previous, est, horizon).move
      if (probeRate > 0 && rng.next() < probeRate) return { move: chosen === 'C' ? 'D' : 'C', probe: true, predicted }
      return { move: chosen, predicted }
    },
    observe: (s, mine, theirs) => {
      if (s.previous === null) s.counts.first[theirs === 'C' ? 0 : 1]++
      else s.counts.after[s.previous][theirs === 'C' ? 0 : 1]++
      return { counts: s.counts, previous: outcomeOf(mine, theirs), history: s.history }
    },
  }
}
