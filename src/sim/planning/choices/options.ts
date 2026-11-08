/**
 * How a choice is shown and valued (spec §5.1): two options, each a list of
 * outcomes with probabilities, in hypothetical dollars (or, in the framing
 * problem, people). **Expected value** is the average of an option's
 * outcomes, each weighted by its probability (§12.1.1). No card shows one
 * before the step's reveal.
 */

export interface Outcome {
  /** Dollars gained (positive) or lost (negative); in the framing problem, people saved or dying. */
  amount: number
  p: number
}

export interface Option {
  outcomes: Outcome[]
  /** The card's wording, in words: “a sure $3,000” or “an 80% chance of gaining $4,000, and otherwise nothing”. */
  text: string
}

export function expectedValue(o: Option): number {
  return o.outcomes.reduce((s, x) => s + x.amount * x.p, 0)
}

export function isSure(o: Option): boolean {
  return o.outcomes.length === 1 && o.outcomes[0].p === 1
}

/** A dollar amount in words, with a sign word for losses and commas. */
export function dollars(amount: number): string {
  const abs = Math.abs(amount)
  const s = Number.isInteger(abs) ? abs.toLocaleString('en-US') : abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return `$${s}`
}

export function percent(p: number): string {
  const v = p * 100
  return `${Number.isInteger(v) ? v : v.toFixed(1)}%`
}

export function sure(amount: number): Option {
  return { outcomes: [{ amount, p: 1 }], text: amount >= 0 ? `a sure gain of ${dollars(amount)}` : `a sure loss of ${dollars(amount)}` }
}

/** A gamble that pays `amount` with probability p and otherwise nothing. */
export function gamble(amount: number, p: number): Option {
  const verb = amount >= 0 ? 'gaining' : 'losing'
  return { outcomes: [{ amount, p }, { amount: 0, p: 1 - p }], text: `${article(p)} ${percent(p)} chance of ${verb} ${dollars(amount)}, and otherwise nothing` }
}

/** A mixed gamble: a 50% chance of gaining `gain` and a 50% chance of losing `loss`. */
export function mixed(gain: number, loss: number): Option {
  return { outcomes: [{ amount: gain, p: 0.5 }, { amount: -loss, p: 0.5 }], text: `a 50% chance of gaining ${dollars(gain)}, and a 50% chance of losing ${dollars(loss)}` }
}

export const reject: Option = { outcomes: [{ amount: 0, p: 1 }], text: 'nothing: neither a gain nor a loss' }

function article(p: number): string {
  const v = p * 100
  const first = String(Number.isInteger(v) ? v : v.toFixed(1))[0]
  return first === '8' || first === '1' && v >= 11 && v < 12 ? 'an' : 'a'
}
