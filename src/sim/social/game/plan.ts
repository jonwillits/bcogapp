import { makeRng } from '../../random'
import { RULE_IDS, type RuleId } from './rules'

/**
 * Part 1's plan (spec §5.2, §5.3): the seed assigns the six rules to the
 * six letters, and draws each match's length, 12 to 16 rounds, afresh for
 * each restart (Jon, 2026-11-02: 15 to 25 was too long; the gain in
 * information over boredom is spent by about 16). Shared by Part 1's store and Part 2's comparison of the
 * student with Predictor, so that neither part imports the other.
 */

export const MIN_ROUNDS = 12
export const MAX_ROUNDS = 16

export interface Part1Plan {
  /** The rule each partner, in letter order, plays. */
  rules: RuleId[]
}

export function planPart1(seed: number): Part1Plan {
  const rng = makeRng(seed ^ 0x9a27)
  const rules = [...RULE_IDS]
  for (let i = rules.length - 1; i > 0; i--) {
    const j = rng.int(i + 1)
    ;[rules[i], rules[j]] = [rules[j], rules[i]]
  }
  return { rules }
}

/** A match's length, drawn by the seed for the partner and its restart count (§4.1: a restart draws a new length). */
export function lengthFor(seed: number, partner: number, restarts: number): number {
  const rng = makeRng((seed ^ 0x1e46) + partner * 7919 + restarts * 104729)
  return MIN_ROUNDS + rng.int(MAX_ROUNDS - MIN_ROUNDS + 1)
}
