/**
 * The repeated Prisoner's Dilemma and its memory-one rules (spec §5, §6).
 *
 * The payoff matrix is the chapter's (`t-prisoners-dilemma`, after Axelrod
 * and Hamilton, 1981): 3 each for mutual cooperation, 1 each for mutual
 * defection, 5 to a defector against a cooperator and 0 to that cooperator.
 *
 * A **rule** here is a memory-one rule: a first move, and a move after each
 * of the four outcomes of the previous round, seen from the rule's own side
 * (its move, then the partner's). Every entry is a short table of moves;
 * none of them knows, wants, trusts or forgives anything. On screen a rule
 * *plays*, *cooperates*, *defects* and *copies*. The literature's names for
 * the fourth rule (grudger, grim trigger) are figurative and are not used.
 *
 * A table holds probabilities of cooperating, so the student's rule with
 * generosity (§6.2) and a rule under noise are the same kind of thing; the
 * six partners are the deterministic cases.
 */

export type Move = 'C' | 'D'
/** The previous round from one player's view: that player's move, then the partner's. */
export type Outcome = 'CC' | 'CD' | 'DC' | 'DD'
export const OUTCOMES: readonly Outcome[] = ['CC', 'CD', 'DC', 'DD']

export const PAYOFF = { R: 3, P: 1, T: 5, S: 0 } as const

/** The points to the player who made `mine` against a partner who made `theirs`. */
export function points(mine: Move, theirs: Move): number {
  if (mine === 'C') return theirs === 'C' ? PAYOFF.R : PAYOFF.S
  return theirs === 'C' ? PAYOFF.T : PAYOFF.P
}

export const outcomeOf = (mine: Move, theirs: Move): Outcome => `${mine}${theirs}` as Outcome
/** The same round from the other side. */
export const flipOutcome = (o: Outcome): Outcome => `${o[1]}${o[0]}` as Outcome

export type RuleId = 'allc' | 'alld' | 'tft' | 'grim' | 'wsls' | 'stft'
export const RULE_IDS: readonly RuleId[] = ['allc', 'alld', 'tft', 'grim', 'wsls', 'stft']

export interface MemoryOneRule {
  id: string
  /** The name on screen, after the reveal. */
  label: string
  /** The probability of cooperating on round 1. */
  first: number
  /** The probability of cooperating after each outcome of the previous round, from this rule's own side. */
  after: Record<Outcome, number>
}

export interface PartnerRule extends MemoryOneRule {
  id: RuleId
  /** The rule's behavior in one sentence, for the diagnosis list (no name in it). */
  description: string
}

export const RULES: readonly PartnerRule[] = [
  { id: 'allc', label: 'Always cooperate', first: 1, after: { CC: 1, CD: 1, DC: 1, DD: 1 }, description: 'cooperates on every round' },
  { id: 'alld', label: 'Always defect', first: 0, after: { CC: 0, CD: 0, DC: 0, DD: 0 }, description: 'defects on every round' },
  { id: 'tft', label: 'Tit-for-tat', first: 1, after: { CC: 1, CD: 0, DC: 1, DD: 0 }, description: 'cooperates on round 1, then plays your move from the previous round' },
  {
    id: 'grim',
    label: 'Defect forever after one defection',
    first: 1,
    after: { CC: 1, CD: 0, DC: 0, DD: 0 },
    description: 'cooperates until the first round on which you defect, then defects on every later round',
  },
  {
    id: 'wsls',
    label: 'Win-stay, lose-shift',
    first: 1,
    after: { CC: 1, CD: 0, DC: 0, DD: 1 },
    description: 'cooperates on round 1; after a round that gave it 3 or 5 points, repeats its own last move; after a round that gave it 0 or 1 points, switches',
  },
  { id: 'stft', label: 'Suspicious tit-for-tat', first: 0, after: { CC: 1, CD: 0, DC: 1, DD: 0 }, description: 'defects on round 1, then plays your move from the previous round' },
]

export const ruleById = (id: RuleId): PartnerRule => RULES.find((r) => r.id === id)!

/** The probability that a rule cooperates next, given the previous round from its side, or null on round 1. */
export function cooperates(rule: MemoryOneRule, previous: Outcome | null): number {
  return previous === null ? rule.first : rule.after[previous]
}

/** A deterministic rule's next move. */
export function nextMove(rule: MemoryOneRule, previous: Outcome | null): Move {
  const p = cooperates(rule, previous)
  if (p !== 0 && p !== 1) throw new Error(`${rule.id} is not deterministic`)
  return p === 1 ? 'C' : 'D'
}

export const isDeterministic = (rule: MemoryOneRule): boolean => [rule.first, ...OUTCOMES.map((o) => rule.after[o])].every((p) => p === 0 || p === 1)

/** The probability of cooperating once an intended move is flipped with probability `noise`. */
export const withNoise = (p: number, noise: number): number => p * (1 - noise) + (1 - p) * noise

// ------------------------------------------------------------ the rule builder (§6.2)

export const GENEROSITY = [0, 0.1, 1 / 3] as const
export type Generosity = (typeof GENEROSITY)[number]
export const GENEROSITY_LABELS: Record<string, string> = { '0': 'never', '0.1': '1 time in 10', [String(1 / 3)]: '1 time in 3' }

export interface Chips {
  first: Move
  CC: Move
  CD: Move
  DC: Move
  DD: Move
  /** After the partner defects, cooperate anyway this often. */
  generosity: Generosity
}

export const DEFAULT_CHIPS: Chips = { first: 'C', CC: 'C', CD: 'D', DC: 'C', DD: 'D', generosity: 0 }

export const RULE_NAMES = ['My rule', 'My rule 2'] as const

/** The student's rule from its chips: the chips' moves, and after the partner defects, cooperation at least as often as the generosity says. */
export function buildRule(chips: Chips, name: (typeof RULE_NAMES)[number] = 'My rule'): MemoryOneRule {
  const p = (m: Move) => (m === 'C' ? 1 : 0)
  const g = chips.generosity
  return {
    id: 'mine',
    label: name,
    first: p(chips.first),
    after: { CC: p(chips.CC), CD: Math.max(p(chips.CD), g), DC: p(chips.DC), DD: Math.max(p(chips.DD), g) },
  }
}

/** Which of the six partners the student's rule matches exactly, if any. */
export function matchesPartner(rule: MemoryOneRule): PartnerRule | null {
  for (const r of RULES) {
    if (r.first !== rule.first) continue
    if (OUTCOMES.every((o) => r.after[o] === rule.after[o])) return r
  }
  return null
}

/** The chips that reproduce a partner's rule. */
export function chipsOf(rule: PartnerRule): Chips {
  const m = (p: number): Move => (p === 1 ? 'C' : 'D')
  return { first: m(rule.first), CC: m(rule.after.CC), CD: m(rule.after.CD), DC: m(rule.after.DC), DD: m(rule.after.DD), generosity: 0 }
}
