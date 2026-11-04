import { nextMove, outcomeOf, points, type MemoryOneRule, type Move, type Outcome } from './rules'

/**
 * The best possible total against a deterministic memory-one rule over a
 * match of known length (spec §5.5), by dynamic programming over the rule's
 * state: the previous round seen from the rule's side (its move, then the
 * student's), or nothing on round 1. That state determines the rule's next
 * move for every one of the six partners, since each is a table over it;
 * it carries what the spec lists per rule (the student's last move for the
 * two tit-for-tats, whether the student has defected for the fourth rule,
 * the rule's own last move for win-stay, lose-shift).
 *
 * The best total knows when the match ends, which the student did not, so
 * against a rule that answers a defection it ends by defecting on the last
 * round; the reveal's fixed line says so (§12, line 3). `game.test.ts`
 * checks it against brute force over every sequence of moves for matches
 * of up to 12 rounds.
 */

export interface BestPlay {
  total: number
  /** One sequence of the student's moves that reaches it. */
  moves: Move[]
}

export function bestTotal(rule: MemoryOneRule, rounds: number): BestPlay {
  // value[t][state] for t from rounds down to 0; state null means round 1.
  const states: (Outcome | null)[] = [null, 'CC', 'CD', 'DC', 'DD']
  const key = (s: Outcome | null) => s ?? 'start'
  let value: Record<string, number> = {}
  for (const s of states) value[key(s)] = 0
  const choice: Record<string, Move>[] = []
  for (let t = rounds - 1; t >= 0; t--) {
    const next: Record<string, number> = {}
    const pick: Record<string, Move> = {}
    for (const s of states) {
      if (t === 0 && s !== null) continue
      if (t > 0 && s === null) continue
      const theirs = nextMove(rule, s)
      let best = -Infinity
      let bestMove: Move = 'C'
      for (const mine of ['C', 'D'] as Move[]) {
        const v = points(mine, theirs) + value[key(outcomeOf(theirs, mine))]
        if (v > best + 1e-12) {
          best = v
          bestMove = mine
        }
      }
      next[key(s)] = best
      pick[key(s)] = bestMove
    }
    for (const s of states) if (next[key(s)] === undefined) next[key(s)] = 0
    value = next
    choice[t] = pick
  }
  const moves: Move[] = []
  let s: Outcome | null = null
  for (let t = 0; t < rounds; t++) {
    const mine = choice[t][key(s)]
    const theirs = nextMove(rule, s)
    moves.push(mine)
    s = outcomeOf(theirs, mine)
  }
  return { total: value.start, moves }
}

/** The student's total for a sequence of moves against a deterministic rule. */
export function totalFor(rule: MemoryOneRule, moves: Move[]): number {
  let s: Outcome | null = null
  let total = 0
  for (const mine of moves) {
    const theirs = nextMove(rule, s)
    total += points(mine, theirs)
    s = outcomeOf(theirs, mine)
  }
  return total
}

/** Every sequence of moves, for the brute-force check of matches up to 12 rounds. */
export function bruteForceBest(rule: MemoryOneRule, rounds: number): number {
  let best = -Infinity
  const n = 1 << rounds
  for (let mask = 0; mask < n; mask++) {
    const moves: Move[] = []
    for (let t = 0; t < rounds; t++) moves.push(mask & (1 << t) ? 'D' : 'C')
    best = Math.max(best, totalFor(rule, moves))
  }
  return best
}

/**
 * The rounds on which the six rules could be told apart (§5.5): a round is
 * marked when, given the history before it, the six rules do not all make
 * the same move.
 */
export function informativeRounds(rules: readonly MemoryOneRule[], history: { student: Move; partner: Move }[]): boolean[] {
  const out: boolean[] = []
  for (let t = 0; t < history.length; t++) {
    const last = history[t - 1]
    const previous = last ? outcomeOf(last.partner, last.student) : null
    const moves = new Set(rules.map((r) => nextMove(r, previous)))
    out.push(moves.size > 1)
  }
  return out
}
