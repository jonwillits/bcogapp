import type { Rng } from '../../random'

/**
 * Part 1, Step 4 — Enough for the night (spec §5.5): the reading's small
 * bird on a winter evening (§12.1.1). It needs 10 units of food to survive
 * a night, starts each evening with reserves between 2 and 9, and may feed
 * at one patch: the sure patch gives 4 units, always; the variable patch
 * gives 8 on half the evenings and nothing on the other half. The two
 * patches have the same expected value, 4 units.
 */

export const NEEDS = 10
export const RESERVES_MIN = 2
export const RESERVES_MAX = 9
export const SURE_GIVES = 4
export const VARIABLE_GIVES = 8
export const VARIABLE_CHANCE = 0.5
export const EVENINGS = 12
export const MANY_EVENINGS = 1000

export type Patch = 'sure' | 'variable'

export type RuleId = 'alwaysSure' | 'alwaysVariable' | 'variableWhenNeeded'

export const RULE_IDS: readonly RuleId[] = ['alwaysSure', 'alwaysVariable', 'variableWhenNeeded']

export const RULE_LABEL: Record<RuleId, string> = {
  alwaysSure: 'Always sure',
  alwaysVariable: 'Always variable',
  variableWhenNeeded: 'Variable only when sure is not enough',
}

export const RULE_TEXT: Record<RuleId, string> = {
  alwaysSure: 'It feeds at the sure patch every evening.',
  alwaysVariable: 'It feeds at the variable patch every evening.',
  variableWhenNeeded: 'It feeds at the sure patch when 4 units would bring its reserves to 10, and at the variable patch when they would not.',
}

export function ruleChoice(rule: RuleId, reserves: number): Patch {
  switch (rule) {
    case 'alwaysSure':
      return 'sure'
    case 'alwaysVariable':
      return 'variable'
    case 'variableWhenNeeded':
      return reserves + SURE_GIVES >= NEEDS ? 'sure' : 'variable'
  }
}

/** The chance of surviving the night from a level of reserves at each patch, computed exactly. */
export function survivalChance(reserves: number, patch: Patch): number {
  if (patch === 'sure') return reserves + SURE_GIVES >= NEEDS ? 1 : 0
  return reserves + VARIABLE_GIVES >= NEEDS ? (reserves >= NEEDS ? 1 : VARIABLE_CHANCE) : 0
}

export interface Evening {
  reserves: number
  patch: Patch
  ate: number
  survived: boolean
}

export function drawReserves(rng: Rng): number {
  return RESERVES_MIN + rng.int(RESERVES_MAX - RESERVES_MIN + 1)
}

export function feed(reserves: number, patch: Patch, rng: Rng): Evening {
  const ate = patch === 'sure' ? SURE_GIVES : rng.next() < VARIABLE_CHANCE ? VARIABLE_GIVES : 0
  return { reserves, patch, ate, survived: reserves + ate >= NEEDS }
}

/** A rule's share of nights survived over many evenings from the same spread of reserves. */
export function runRule(rule: RuleId, evenings: number, rng: Rng): number {
  let survived = 0
  for (let i = 0; i < evenings; i++) {
    const r = drawReserves(rng)
    if (feed(r, ruleChoice(rule, r), rng).survived) survived++
  }
  return survived / evenings
}

/** The exact share of nights a rule survives over the uniform spread of reserves 2 to 9. */
export function exactSurvival(rule: RuleId): number {
  let total = 0
  for (let r = RESERVES_MIN; r <= RESERVES_MAX; r++) total += survivalChance(r, ruleChoice(rule, r))
  return total / (RESERVES_MAX - RESERVES_MIN + 1)
}
