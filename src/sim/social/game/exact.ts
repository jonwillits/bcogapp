import { OUTCOMES, cooperates, flipOutcome, points, withNoise, type MemoryOneRule, type Move, type Outcome } from './rules'

/**
 * Exact expected payoffs for two memory-one rules over R rounds at a noise
 * level (spec §6, §16): a four-state Markov chain over the rounds, the
 * state being the previous round's two moves, with the noise applied to
 * each intended move. Nothing is sampled. `game.test.ts` holds it to the
 * mean of 10,000 simulated matches within 1% for every pair at 0% and 5%.
 *
 * The round-robin's table (§6.3), the generations (§6.6) and the grid's
 * 3 × 3 table (§6.7) are read from here; only *Predictor*'s matches are
 * played, since it is not a memory-one rule.
 */

export interface ExpectedPayoff {
  /** Expected total points over the match, to each side. */
  a: number
  b: number
  /** Per round. */
  aPerRound: number
  bPerRound: number
}

const MOVES: readonly Move[] = ['C', 'D']

export function expectedPayoff(ruleA: MemoryOneRule, ruleB: MemoryOneRule, rounds: number, noise: number): ExpectedPayoff {
  // The distribution over the previous round's outcome, from A's side.
  let dist: Record<Outcome, number> = { CC: 0, CD: 0, DC: 0, DD: 0 }
  let a = 0
  let b = 0
  const pa0 = withNoise(cooperates(ruleA, null), noise)
  const pb0 = withNoise(cooperates(ruleB, null), noise)
  for (const ma of MOVES) {
    for (const mb of MOVES) {
      const p = (ma === 'C' ? pa0 : 1 - pa0) * (mb === 'C' ? pb0 : 1 - pb0)
      dist[`${ma}${mb}` as Outcome] += p
      a += p * points(ma, mb)
      b += p * points(mb, ma)
    }
  }
  for (let t = 1; t < rounds; t++) {
    const next: Record<Outcome, number> = { CC: 0, CD: 0, DC: 0, DD: 0 }
    for (const o of OUTCOMES) {
      const p = dist[o]
      if (p === 0) continue
      const pa = withNoise(cooperates(ruleA, o), noise)
      const pb = withNoise(cooperates(ruleB, flipOutcome(o)), noise)
      for (const ma of MOVES) {
        for (const mb of MOVES) {
          const q = p * (ma === 'C' ? pa : 1 - pa) * (mb === 'C' ? pb : 1 - pb)
          if (q === 0) continue
          next[`${ma}${mb}` as Outcome] += q
          a += q * points(ma, mb)
          b += q * points(mb, ma)
        }
      }
    }
    dist = next
  }
  return { a, b, aPerRound: a / rounds, bPerRound: b / rounds }
}
