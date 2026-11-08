import type { Rng } from '../../random'
import type { RateUnit } from '../../bilaterian/unit'
import { learnWeights, thirdFactor, weightChange, WEIGHT_CEILING, WEIGHT_FLOOR, type ConnectionLimits } from '../../bilaterian/learning/rule'
import type { Errand, Standing } from '../range/acts'
import { ITEMS, PLACES, type Item, type Place } from '../range/places'
import { CUES, type Cue } from '../range/needs'

/**
 * Lab 5's Verdict setting, over the states of a morning: an actor whose
 * weights decide the next errand, and a critic whose output estimates how
 * well things will go from a state. Both learn from one broadcast number, δ,
 * the difference between what happened and what the critic estimated, with
 * discounting, through `thirdFactor('verdict')` and written only by
 * `learnWeights`. Learned value uses the actor and the critic; the Copier's
 * fallback uses both; the Shallow planner's second variant uses the critic
 * alone to score the state at the end of its search (spec §7.5).
 *
 * Nothing here represents a state of the world an errand brings about: the
 * weights are values, not a model (§12.2.1, model-free).
 */

/**
 * One input per state a hominin can stand in: the morning's cue, the set of
 * items in hand (a hand holds at most two of five, coded as a bit for each
 * item), and the place. A value is attached to an errand in a situation, and
 * nothing is shared between situations: what was learned under vultures says
 * nothing under rain, and what was learned holding a flake says nothing
 * empty-handed. (A first build summed one weight per cue, per item and per
 * place instead, and the sum credited going to the grassland empty-handed
 * with the value of going there holding a flake; the as-built notes record it.)
 */
export const N_HAND_CODES = 1 << ITEMS.length
export const N_FEATURES = CUES.length * N_HAND_CODES * PLACES.length

export function stateIndex(cue: Cue, hands: readonly Item[], place: Place): number {
  let code = 0
  for (const it of hands) code |= 1 << ITEMS.indexOf(it)
  return (CUES.indexOf(cue) * N_HAND_CODES + code) * PLACES.length + PLACES.indexOf(place)
}

/** The errands the actor chooses among: the five preparatory acts, going to any of the eight places, and staying. */
export const ACTIONS: readonly Errand[] = [
  { kind: 'fetch', item: 'cobble' },
  { kind: 'fetch', item: 'sapling' },
  { kind: 'make', what: 'flake' },
  { kind: 'make', what: 'probe' },
  { kind: 'make', what: 'diggingStick' },
  ...PLACES.map((place): Errand => ({ kind: 'go', place })),
  { kind: 'stay' },
]

const ACTION_KEYS = ACTIONS.map((a) => JSON.stringify(a))

export function actionIndex(e: Errand): number {
  return ACTION_KEYS.indexOf(JSON.stringify(e))
}

export const VALUE_LEARNER = {
  /** η */
  rate: 0.3,
  /** γ, per errand. */
  discount: 0.9,
  /** How much of a connection's mark survives one errand later, so that δ at the end of the morning reaches the morning's first errand. */
  trace: 0.8,
  /**
   * The actor chooses by a softmax over its preferences at this temperature:
   * a preference 1.5 above the rest is chosen about nine times in ten, and
   * one 3 above (the ceiling) nearly always. As a preference falls under
   * unrewarded mornings, the errand is chosen less often, over several days,
   * rather than dropped all at once.
   */
  temperature: 0.3,
  /** A weight stays within Lab 5's own limits. */
  weightRange: { min: WEIGHT_FLOOR, max: WEIGHT_CEILING },
} as const

const LIMITS: ConnectionLimits[] = Array.from({ length: N_FEATURES }, () => ({ plastic: true, min: VALUE_LEARNER.weightRange.min, max: VALUE_LEARNER.weightRange.max }))

function unit(): RateUnit {
  return { baseline: 0, threshold: 0, weights: new Array<number>(N_FEATURES).fill(0) }
}

/** A fading mark on a connection: which input, and how strong. */
type Marks = Map<number, number>

export class ValueLearner {
  actors: RateUnit[]
  critic: RateUnit
  private readonly actorMarks: Marks[]
  private criticMarks: Marks = new Map()
  /** δ on the last update, for the printed arithmetic. */
  delta = 0
  private readonly rng: Rng

  constructor(rng: Rng) {
    this.rng = rng
    this.actors = ACTIONS.map(unit)
    this.critic = unit()
    this.actorMarks = ACTIONS.map(() => new Map())
  }

  /** The critic's estimate for a state. */
  valueAt(cue: Cue, hands: readonly Item[], place: Place): number {
    return this.critic.baseline + this.critic.weights[stateIndex(cue, hands, place)]
  }

  preferenceAt(a: number, cue: Cue, hands: readonly Item[], place: Place): number {
    return this.actors[a].baseline + this.actors[a].weights[stateIndex(cue, hands, place)]
  }

  /** An errand drawn by a softmax over the learned preferences of the errands available. */
  choose(s: Standing, cue: Cue, available: (e: Errand) => boolean): Errand {
    const prefs: { a: number; h: number }[] = []
    ACTIONS.forEach((e, a) => {
      if (available(e)) prefs.push({ a, h: this.preferenceAt(a, cue, s.hands, s.place) })
    })
    const top = Math.max(...prefs.map((p) => p.h))
    const weights = prefs.map((p) => Math.exp((p.h - top) / VALUE_LEARNER.temperature))
    const total = weights.reduce((x, y) => x + y, 0)
    let u = this.rng.next() * total
    for (let i = 0; i < prefs.length; i++) {
      u -= weights[i]
      if (u <= 0) return ACTIONS[prefs[i].a]
    }
    return ACTIONS[prefs[prefs.length - 1].a]
  }

  /** A new morning: nothing carries across from the last one. */
  cut(): void {
    for (const m of this.actorMarks) m.clear()
    this.criticMarks.clear()
  }

  /**
   * One errand happened, from the state `before` (whoever chose it: the
   * learner itself, a copied elder, or the 15% deviation). The transition
   * into `after` is credited at once: δ = 0 + γ·V(after) − V(before),
   * released to every eligible connection, including those marked by the
   * morning's earlier errands.
   */
  transition(cue: Cue, before: Standing, action: Errand, after: Standing): void {
    const ib = stateIndex(cue, before.hands, before.place)
    const a = actionIndex(action)
    if (a < 0) throw new Error(`unknown errand ${JSON.stringify(action)}`)
    this.mark(ib, a)
    const delta = 0 + VALUE_LEARNER.discount * this.valueAt(cue, after.hands, after.place) - this.valueAt(cue, before.hands, before.place)
    this.release(delta)
  }

  /** Midday: the news arrives, +1 for food and 0 for nothing, and the morning ends. */
  endDay(cue: Cue, final: Standing, ate: boolean): void {
    const i = stateIndex(cue, final.hands, final.place)
    // The critic's estimate of the final state is what the news is compared with.
    this.decay(this.criticMarks)
    this.criticMarks.set(i, 1)
    const delta = (ate ? 1 : 0) + 0 - this.valueAt(cue, final.hands, final.place)
    this.release(delta)
    this.cut()
  }

  private decay(m: Marks): void {
    for (const [k, v] of m) {
      const next = v * VALUE_LEARNER.trace
      if (next < 1e-3) m.delete(k)
      else m.set(k, next)
    }
  }

  private mark(i: number, a: number): void {
    for (const m of this.actorMarks) this.decay(m)
    this.decay(this.criticMarks)
    this.actorMarks[a].set(i, 1)
    this.criticMarks.set(i, 1)
  }

  /** δ, the one broadcast number, reaches every marked connection: Δbᵢ = η · eᵢ · Φ, Φ = δ. */
  private release(delta: number): void {
    this.delta = delta
    const phi = thirdFactor('verdict', { output: 0, weakening: false, usualOutput: 0, arriving: null, heldPrediction: 0, target: null, broadcast: delta })
    const changesOf = (m: Marks) => {
      const changes = new Array<number>(N_FEATURES).fill(0)
      for (const [k, e] of m) changes[k] = weightChange(VALUE_LEARNER.rate, e, phi)
      return changes
    }
    ACTIONS.forEach((_, a) => {
      if (this.actorMarks[a].size) learnWeights(this.actors[a], changesOf(this.actorMarks[a]), LIMITS, false)
    })
    if (this.criticMarks.size) learnWeights(this.critic, changesOf(this.criticMarks), LIMITS, false)
  }

  clone(rng: Rng): ValueLearner {
    const c = new ValueLearner(rng)
    // A copy of each unit, weights included, as a fresh literal: no write to a stored weight.
    this.actors.forEach((u, a) => (c.actors[a] = { baseline: u.baseline, threshold: u.threshold, weights: [...u.weights] }))
    c.critic = { baseline: this.critic.baseline, threshold: this.critic.threshold, weights: [...this.critic.weights] }
    return c
  }
}
