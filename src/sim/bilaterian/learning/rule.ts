import type { RateUnit } from '../unit'

/**
 * The learning rule of Module 5, and the second — and last — writer of a
 * stored weight.
 *
 *   Δbᵢ = η · xᵢ · Φ
 *
 * Every family of learning in the chapter changes a weight by this one
 * shape: the input, times something else, scaled by a rate. **Φ is the third
 * factor, and it is the only thing the selector changes.** That is §5.3.7's
 * claim — one coincidence detector, given the right third factor, implements
 * all of it — and it is why `thirdFactor` below is the single place the four
 * settings differ. Four rules on four code paths would behave the same and
 * lose the point.
 */

export type ThirdFactor = 'coincidence' | 'prediction' | 'teacher' | 'verdict'

export interface ThirdFactorSpec {
  id: ThirdFactor
  /** The name on the selector, as the chapter names it. */
  label: string
  /** Φ, written out. */
  phi: string
  /** What it needs, in a line — the line under each setting on the panel. */
  needs: string
  /** Where that comes from. */
  from: string
  section: string
}

export const THIRD_FACTORS: readonly ThirdFactorSpec[] = [
  {
    id: 'coincidence',
    label: 'Coincidence',
    phi: 'y',
    needs: 'The receiving unit’s own output, and nothing else.',
    from: 'Nowhere else: both quantities are already at the connection.',
    section: '§5.2.1',
  },
  {
    id: 'prediction',
    label: 'Prediction',
    phi: 'a − p',
    needs: 'A prediction made before the input arrives, held until it does, and then compared with what arrived.',
    from: 'The world, a moment later.',
    section: '§5.2.6',
  },
  {
    id: 'teacher',
    label: 'Teacher',
    phi: 't − o',
    needs: 'A target: what the output should have been, for this input, on this occasion.',
    from: 'The scenario, which holds the correct verdict for each input combination. Nothing inside the animal holds it.',
    section: '§5.2.6, §5.2.7',
  },
  {
    id: 'verdict',
    label: 'Verdict',
    phi: 'δ',
    needs: 'One broadcast number about how things went, and a connection still eligible when it arrives.',
    from: 'The outcome itself; the eligibility trace decides which connections it reaches.',
    section: '§5.2.7, §5.2.8, §5.3.8',
  },
]

/** η spans two orders of magnitude, so §5.2.1's comparison can be run: 1 against 0.01. */
export const RATE_RANGE = { min: 0.01, max: 1 } as const
/** The eligibility trace window, seconds. Zero means a connection is a candidate only while its input is live. */
export const TRACE_RANGE = { min: 0, max: 10, step: 0.5 } as const
/** γ, applied once per step of delay; a step is one second. */
export const DISCOUNT_RANGE = { min: 0.5, max: 0.99, step: 0.01 } as const
export const STEP_OF_DELAY_S = 1

/**
 * A connection saturates. The ceiling and floor are the ends of the Circuit
 * tab's weight slider, so a learned weight is always one a student could have
 * set by hand.
 */
export const WEIGHT_CEILING = 3
export const WEIGHT_FLOOR = -3

/**
 * With weakening on, the coincidence setting measures the receiving unit's
 * output against how active that unit has been lately, instead of against
 * zero. Busier than usual and the connection strengthens; quieter than usual
 * — the sending cell active while the receiving cell is quiet — and it
 * weakens. §5.3.2.
 *
 * The level has to move with the unit, and that was measured rather than
 * chosen: against a fixed level, a unit that has run away is never quiet, so
 * the condition for weakening is never met again and nothing is bounded. A
 * level a little above the unit's own recent average (`WEAKENING_GAIN` > 1)
 * means a unit that fires all the time weakens its own connections until it
 * does not.
 */
export const WEAKENING_GAIN = 1.25
/** How far back "lately" reaches, seconds. */
export const USUAL_OUTPUT_TAU_S = 20

/**
 * With competition on, what the connections onto one unit can hold between
 * them is limited and shared: when their excitatory weights sum past this,
 * all of them are scaled back to it, so strengthening some weakens others.
 * §5.3.5.
 */
export const COMPETITION_BUDGET = 2

/** The rule. One line, and the only arithmetic the four settings share — which is all of it. */
export function weightChange(eta: number, x: number, phi: number): number {
  return eta * x * phi
}

/** What each setting needs in order to supply Φ. Anything a setting does not use is ignored. */
export interface PhiSources {
  /** The receiving unit's own output, y. */
  output: number
  /** Whether weakening is on — it moves the level y is measured against. */
  weakening: boolean
  /** The receiving unit's recent average output. */
  usualOutput: number
  /** What is arriving now (a), or null when nothing is being resolved. */
  arriving: number | null
  /** The prediction made before the arrival began, and held (p). */
  heldPrediction: number
  /** The scenario's target for the present input (t), or null when it holds none. */
  target: number | null
  /** The broadcast signal (δ). */
  broadcast: number
}

/**
 * Φ. **The single place the four settings differ.**
 */
export function thirdFactor(which: ThirdFactor, s: PhiSources): number {
  switch (which) {
    case 'coincidence':
      return s.output - (s.weakening ? WEAKENING_GAIN * s.usualOutput : 0)
    case 'prediction':
      return s.arriving === null ? 0 : s.arriving - s.heldPrediction
    case 'teacher':
      return s.target === null ? 0 : s.target - s.output
    case 'verdict':
      return s.broadcast
  }
}

export interface ConnectionLimits {
  /** Whether the rule may move this connection at all. An innate connection is not plastic. */
  plastic: boolean
  min: number
  max: number
}

/**
 * **The learning rule's write — the only code path besides `setWiring` that
 * assigns a stored weight.** `oneWriter.test.ts` walks the sim directory and
 * fails if a third appears. It writes weights and nothing else: never a
 * baseline, a threshold or a routing switch.
 */
export function learnWeights(
  unit: RateUnit,
  changes: readonly number[],
  limits: readonly ConnectionLimits[],
  competition: boolean,
): void {
  const next = unit.weights.map((b, i) => {
    const lim = limits[i]
    if (!lim?.plastic) return b
    return clamp(b + (changes[i] ?? 0), lim.min, lim.max)
  })
  if (competition) {
    let excitatory = 0
    next.forEach((b, i) => {
      if (limits[i]?.plastic && b > 0) excitatory += b
    })
    if (excitatory > COMPETITION_BUDGET) {
      const k = COMPETITION_BUDGET / excitatory
      next.forEach((b, i) => {
        if (limits[i]?.plastic && b > 0) next[i] = b * k
      })
    }
  }
  for (let i = 0; i < next.length; i++) unit.weights[i] = next[i]
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}
