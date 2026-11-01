import { makeRng } from '../../random'
import { expectedPayoff } from './exact'
import { playMatch, rulePlayer } from './match'
import { ruleById } from './rules'

/**
 * Two Rules (spec §6.1), with only *Always defect* and *Tit-for-tat* and no
 * noise. Every number here is computed by the engine, never typed in; the
 * spec's formulas are the acceptance test (§16): head to head, always-defect
 * 5 + (R − 1) and tit-for-tat R − 1; in the round-robin of the two, each
 * also playing a copy of itself, tit-for-tat 4R − 1 and always-defect
 * 2R + 4; and in a population with a share x of tit-for-tat, tit-for-tat
 * does better once x > 1/(2R − 3).
 */

export const TWO_RULES_ROUNDS = [1, 2, 3, 10, 200] as const

const TFT = ruleById('tft')
const ALLD = ruleById('alld')

export interface HeadToHead {
  rounds: number
  alld: number
  tft: number
  /** The moves, for the record on screen. */
  moves: { alld: string; tft: string }
}

/** Run 2: a match of R rounds, head to head. Deterministic, so played once. */
export function headToHead(rounds: number): HeadToHead {
  const m = playMatch(rulePlayer(ALLD), rulePlayer(TFT), rounds, 0, makeRng(1))
  return { rounds, alld: m.totalA, tft: m.totalB, moves: { alld: m.rounds.map((r) => r.a).join(''), tft: m.rounds.map((r) => r.b).join('') } }
}

export interface TwoRuleRoundRobin {
  rounds: number
  /** Each entry's points in each of its two matches, and the total. */
  tft: { vsTft: number; vsAlld: number; total: number }
  alld: { vsAlld: number; vsTft: number; total: number }
}

/** Run 3: each rule plays the other and a copy of itself. */
export function twoRuleRoundRobin(rounds: number): TwoRuleRoundRobin {
  const tt = expectedPayoff(TFT, TFT, rounds, 0)
  const td = expectedPayoff(TFT, ALLD, rounds, 0)
  const dd = expectedPayoff(ALLD, ALLD, rounds, 0)
  return {
    rounds,
    tft: { vsTft: tt.a, vsAlld: td.a, total: tt.a + td.a },
    alld: { vsAlld: dd.a, vsTft: td.b, total: dd.a + td.b },
  }
}

export interface PopulationPoint {
  x: number
  tft: number
  alld: number
}

/** Run 4: average points per encounter for each rule when a share x of the population plays tit-for-tat and the rest always defect. */
export function populationPayoffs(rounds: number, x: number): PopulationPoint {
  const tt = expectedPayoff(TFT, TFT, rounds, 0).a
  const td = expectedPayoff(TFT, ALLD, rounds, 0)
  const dd = expectedPayoff(ALLD, ALLD, rounds, 0).a
  return { x, tft: x * tt + (1 - x) * td.a, alld: x * td.b + (1 - x) * dd }
}

/** The share of tit-for-tat above which it does better than always-defect, from the four payoffs; null when it never does. */
export function populationThreshold(rounds: number): number | null {
  const tt = expectedPayoff(TFT, TFT, rounds, 0).a
  const td = expectedPayoff(TFT, ALLD, rounds, 0)
  const dd = expectedPayoff(ALLD, ALLD, rounds, 0).a
  // x·tt + (1 − x)·td.a = x·td.b + (1 − x)·dd
  const denom = tt - td.a - td.b + dd
  if (denom <= 0) return null
  const x = (dd - td.a) / denom
  return x > 0 && x < 1 ? x : null
}

export function populationCurve(rounds: number, steps = 50): PopulationPoint[] {
  return Array.from({ length: steps + 1 }, (_, i) => populationPayoffs(rounds, i / steps))
}
