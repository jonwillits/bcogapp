import type { Rng } from '../../random'
import { answer, finished, indifference, startBisection, type Bisection } from './bisection'

/**
 * Part 1, Step 2 — Delays (spec §5.3): five titrations, “$X today, or $100
 * after D”, six choices each by bisection on X; and two pairs for a
 * reversal, one early and one late, separated by at least two titrations.
 * The reveal fits two curves to the five indifference points by least
 * squares: discounting by a constant factor for each day of delay,
 * V = 100 · γ^D, as Module 5 defined discounting, and hyperbolic discounting,
 * V = 100 / (1 + kD).
 */

export const LATER_AMOUNT = 100

export interface Delay {
  id: 'week' | 'month' | 'sixMonths' | 'year' | 'fiveYears'
  label: string
  days: number
}

export const DELAYS: Delay[] = [
  { id: 'week', label: '1 week', days: 7 },
  { id: 'month', label: '1 month', days: 30 },
  { id: 'sixMonths', label: '6 months', days: 182 },
  { id: 'year', label: '1 year', days: 365 },
  { id: 'fiveYears', label: '5 years', days: 1826 },
]

export interface ReversalPair {
  id: 'soon' | 'late'
  /** The smaller-sooner option: amount and delay in days. */
  sooner: { amount: number; days: number; label: string }
  later: { amount: number; days: number; label: string }
}

export const REVERSAL_PAIRS: ReversalPair[] = [
  { id: 'soon', sooner: { amount: 50, days: 0, label: '$50 today' }, later: { amount: 55, days: 7, label: '$55 in 1 week' } },
  { id: 'late', sooner: { amount: 50, days: 364, label: '$50 in 52 weeks' }, later: { amount: 55, days: 371, label: '$55 in 53 weeks' } },
]

export type DelayItem = { kind: 'titration'; delay: Delay['id']; index: number } | { kind: 'twoAmounts'; pair: ReversalPair['id'] }

export interface DelayPlan {
  items: DelayItem[]
  swap: boolean[]
}

/** The order from the seed: the five titrations shuffled, each six consecutive choices, with the two reversal pairs one early and one late, at least two titrations apart. */
export function planDelays(rng: Rng): DelayPlan {
  const order = [...DELAYS]
  for (let i = order.length - 1; i > 0; i--) {
    const j = rng.int(i + 1)
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  // The early pair after the first titration or the second; the late pair after the fourth or the fifth; so at least two titrations lie between them.
  const early = 1 + rng.int(2)
  const late = 4 + rng.int(2)
  const items: DelayItem[] = []
  order.forEach((d, i) => {
    for (let k = 0; k < 6; k++) items.push({ kind: 'titration', delay: d.id, index: k })
    if (i + 1 === early) items.push({ kind: 'twoAmounts', pair: 'soon' })
    if (i + 1 === late) items.push({ kind: 'twoAmounts', pair: 'late' })
  })
  return { items, swap: items.map(() => rng.next() < 0.5) }
}

/** The bisection for a delay: taking the sooner amount X means X was high enough, so X falls. */
export function startTitration(): Bisection {
  return startBisection(0, LATER_AMOUNT, true)
}

export interface DelayResponses {
  titrations: Record<Delay['id'], Bisection>
  /** For each reversal pair: true when the later, larger amount was chosen. */
  reversals: Partial<Record<ReversalPair['id'], boolean>>
}

export function emptyDelayResponses(): DelayResponses {
  return { titrations: { week: startTitration(), month: startTitration(), sixMonths: startTitration(), year: startTitration(), fiveYears: startTitration() }, reversals: {} }
}

export function answerTitration(r: DelayResponses, delay: Delay['id'], tookSooner: boolean): DelayResponses {
  return { ...r, titrations: { ...r.titrations, [delay]: answer(r.titrations[delay], tookSooner) } }
}

export const titrationDone = (r: DelayResponses, delay: Delay['id']): boolean => finished(r.titrations[delay])

export interface Fit {
  /** γ for the exponential, k for the hyperbolic. */
  parameter: number
  /** The summed squared error over the five points. */
  sse: number
}

export const exponential = (gamma: number, days: number): number => LATER_AMOUNT * gamma ** days
export const hyperbolic = (k: number, days: number): number => LATER_AMOUNT / (1 + k * days)

/** The parameter in [lo, hi] that minimizes the summed squared error, by a grid of 400 then a golden-section refinement. */
function fit1(f: (p: number, days: number) => number, points: { days: number; value: number }[], lo: number, hi: number): Fit {
  const sse = (p: number) => points.reduce((s, pt) => s + (pt.value - f(p, pt.days)) ** 2, 0)
  let bestP = lo
  let best = Infinity
  for (let i = 0; i <= 400; i++) {
    const p = lo + ((hi - lo) * i) / 400
    const e = sse(p)
    if (e < best) {
      best = e
      bestP = p
    }
  }
  let a = Math.max(lo, bestP - (hi - lo) / 400)
  let b = Math.min(hi, bestP + (hi - lo) / 400)
  const phi = (Math.sqrt(5) - 1) / 2
  for (let i = 0; i < 60; i++) {
    const c = b - phi * (b - a)
    const d = a + phi * (b - a)
    if (sse(c) < sse(d)) b = d
    else a = c
  }
  const p = (a + b) / 2
  return { parameter: p, sse: sse(p) }
}

export interface DelayResults {
  /** The indifference point for each delay, in dollars today. */
  points: { delay: Delay; value: number }[]
  exponential: Fit
  hyperbolic: Fit
  /** For each reversal pair: the student's choice (later chosen?), and what each fitted curve says the student would choose. */
  reversals: { pair: ReversalPair; choseLater: boolean | null; exponentialSaysLater: boolean; hyperbolicSaysLater: boolean }[]
}

export function delayResults(r: DelayResponses): DelayResults {
  const points = DELAYS.map((delay) => ({ delay, value: indifference(r.titrations[delay.id]) }))
  const pts = points.map((p) => ({ days: p.delay.days, value: p.value }))
  const exp = fit1(exponential, pts, 0.9, 1)
  const hyp = fit1(hyperbolic, pts, 0, 1)
  const reversals = REVERSAL_PAIRS.map((pair) => ({
    pair,
    choseLater: r.reversals[pair.id] ?? null,
    exponentialSaysLater: pair.later.amount * exp.parameter ** pair.later.days > pair.sooner.amount * exp.parameter ** pair.sooner.days,
    hyperbolicSaysLater: pair.later.amount / (1 + hyp.parameter * pair.later.days) > pair.sooner.amount / (1 + hyp.parameter * pair.sooner.days),
  }))
  return { points, exponential: exp, hyperbolic: hyp, reversals }
}

/** A scripted chooser for the tests: discounts by the given curve and takes the option worth more today. */
export function scriptedDelayChooser(value: (amount: number, days: number) => number): (soonerAmount: number, soonerDays: number, laterAmount: number, laterDays: number) => boolean {
  return (sa, sd, la, ld) => value(sa, sd) >= value(la, ld)
}

/** Run a scripted chooser through the whole step, for the tests. */
export function runScriptedDelays(value: (amount: number, days: number) => number): DelayResponses {
  const chooser = scriptedDelayChooser(value)
  let r = emptyDelayResponses()
  for (const d of DELAYS) while (!titrationDone(r, d.id)) r = answerTitration(r, d.id, chooser(r.titrations[d.id].x, 0, LATER_AMOUNT, d.days))
  for (const pair of REVERSAL_PAIRS) r = { ...r, reversals: { ...r.reversals, [pair.id]: !chooser(pair.sooner.amount, pair.sooner.days, pair.later.amount, pair.later.days) } }
  return r
}
