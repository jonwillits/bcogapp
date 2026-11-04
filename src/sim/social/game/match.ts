import type { Rng } from '../../random'
import { cooperates, outcomeOf, points, withNoise, type MemoryOneRule, type Move, type Outcome } from './rules'

/**
 * Playing a match (spec §5.3, §6). A **player** is anything with a start, a
 * move given its own state, and an update from the realized round. A
 * memory-one rule is one; *Predictor* (`predictor.ts`) is another; the
 * student is a third, played by the screen.
 *
 * A move is computed from the history before the round and never from the
 * partner's choice in the same round: both players decide, then both moves
 * are revealed. With noise, each intended move is flipped with the stated
 * probability, for every player alike, and both players observe the moves
 * as they were played.
 */

export interface Decision {
  move: Move
  /** Predictor only: this move is a probe, the other of what its search chose. */
  probe?: boolean
  /** Predictor only: the partner's move it estimated more likely, before the round. */
  predicted?: Move
}

export interface Player<S = unknown> {
  id: string
  label: string
  start(): S
  decide(state: S, rng: Rng): Decision
  /** The round as it was played, from this player's side. */
  observe(state: S, mine: Move, theirs: Move): S
}

/** A memory-one rule as a player: its state is the previous round from its side, or null on round 1. */
export function rulePlayer(rule: MemoryOneRule): Player<Outcome | null> {
  return {
    id: rule.id,
    label: rule.label,
    start: () => null,
    decide: (previous, rng) => {
      const p = cooperates(rule, previous)
      const move: Move = p === 1 ? 'C' : p === 0 ? 'D' : rng.next() < p ? 'C' : 'D'
      return { move }
    },
    observe: (_s, mine, theirs) => outcomeOf(mine, theirs),
  }
}

export interface Round {
  /** The moves as played, A's then B's. */
  a: Move
  b: Move
  pointsA: number
  pointsB: number
  probeA?: boolean
  probeB?: boolean
  predictedA?: Move
  predictedB?: Move
}

export interface MatchRecord {
  rounds: Round[]
  totalA: number
  totalB: number
}

const flip = (m: Move): Move => (m === 'C' ? 'D' : 'C')

/** Play `rounds` rounds between two players at a noise level, every draw from the stream given. */
export function playMatch<SA, SB>(a: Player<SA>, b: Player<SB>, rounds: number, noise: number, rng: Rng): MatchRecord {
  let sa = a.start()
  let sb = b.start()
  const out: Round[] = []
  let totalA = 0
  let totalB = 0
  for (let t = 0; t < rounds; t++) {
    const da = a.decide(sa, rng)
    const db = b.decide(sb, rng)
    const ma = noise > 0 && rng.next() < noise ? flip(da.move) : da.move
    const mb = noise > 0 && rng.next() < noise ? flip(db.move) : db.move
    const pa = points(ma, mb)
    const pb = points(mb, ma)
    totalA += pa
    totalB += pb
    const round: Round = { a: ma, b: mb, pointsA: pa, pointsB: pb }
    if (da.probe) round.probeA = true
    if (db.probe) round.probeB = true
    if (da.predicted) round.predictedA = da.predicted
    if (db.predicted) round.predictedB = db.predicted
    out.push(round)
    sa = a.observe(sa, ma, mb)
    sb = b.observe(sb, mb, ma)
  }
  return { rounds: out, totalA, totalB }
}

/** The partner's next move in Part 1, from the history before the round: the student's moves and the partner's so far. */
export function partnerMove(rule: MemoryOneRule, history: { student: Move; partner: Move }[]): Move {
  const last = history[history.length - 1]
  const previous = last ? outcomeOf(last.partner, last.student) : null
  const p = cooperates(rule, previous)
  if (p !== 0 && p !== 1) throw new Error('a Part 1 partner is deterministic')
  return p === 1 ? 'C' : 'D'
}

/** The effective probability of cooperating under noise, for the exact computation. */
export { withNoise }
