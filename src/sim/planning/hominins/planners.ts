import type { Rng } from '../../random'
import { HANDS, MORNING_SECONDS, PLACES, WINDOW_SECONDS, type Item, type Made, type Place } from '../range/places'
import type { Errand, Observation, Standing } from '../range/acts'
import type { Cue } from '../range/needs'
import { MODEL, WorldModel } from './model'
import { ValueLearner } from './valueLearner'
import type { Dawn, Hominin, HomininKind } from './types'

/**
 * The two planners of spec §7.4.3 and §7.5. Each learns a `WorldModel` from
 * what it has seen and, each morning, searches that model for the sequence
 * of preparatory errands, followed by going to a place, with the highest
 * expected chance of food. The Planner searches to any depth that fits in
 * the morning (§12.2.1, model-based, planning). The Shallow planner searches
 * up to two preparatory errands, in two variants: A, a pure depth limit, in
 * which a sequence that reaches no food within the limit counts for nothing;
 * B, a depth limit with learned estimates at the end of the search, in which
 * such a sequence is valued by a critic over states (Lab 5's Verdict
 * setting), learned from the hominin's own mornings, as AlphaZero scores the
 * position at the end of each continuation with its critic (§12.2.3).
 *
 * Neither reads what each need takes, the cue schedule, or the day's need.
 * Both see the cue, which anyone at camp sees.
 */

export type ShallowVariant = 'A' | 'B'

export const SHALLOW_DEPTH = 2
/** The Planner's depth has no limit of its own; the morning's length bounds it. This cap only bounds the search. */
const PLANNER_DEPTH_CAP = 6

interface Plan {
  errands: Errand[]
  value: number
  /** Where the plan ends and with what in hand, for the critic. */
  end: { place: Place; hands: Item[] }
  seconds: number
}

interface SearchState {
  place: Place
  hands: Item[]
  seconds: number
  errands: Errand[]
}

/** Every plan of up to `depth` preparatory errands followed by going to a place or staying, with its modeled value. */
export function searchPlans(model: WorldModel, cue: Cue, start: Standing, depth: number, critic: ValueLearner | null): Plan[] {
  const plans: Plan[] = []
  const budget = MORNING_SECONDS + WINDOW_SECONDS - start.elapsed
  const pickUpSeconds = model.actSeconds('pickUp')

  const finish = (s: SearchState) => {
    // Go to each place, or stay here, and value the end.
    for (const place of PLACES) {
      const walk = model.walkSeconds(s.place, place)
      const seconds = s.seconds + walk
      if (seconds > budget) continue
      let chance = 0
      for (const it of s.hands.length ? s.hands : [null]) chance = Math.max(chance, model.chanceOfFood(cue, place, it))
      let value = chance >= MODEL.worthGoing ? chance : 0
      if (value === 0 && critic) value = critic.valueAt(cue, s.hands, place)
      const errand: Errand = place === s.place ? { kind: 'stay' } : { kind: 'go', place }
      plans.push({ errands: [...s.errands, errand], value, end: { place, hands: [...s.hands] }, seconds })
    }
  }

  const expand = (s: SearchState, left: number) => {
    finish(s)
    if (left === 0) return
    // Fetch an item from a place known to yield it.
    for (const [item, places] of model.sources) {
      for (const from of places) {
        const walk = model.walkSeconds(s.place, from)
        const seconds = s.seconds + walk + pickUpSeconds
        if (seconds > budget) continue
        const hands = [...s.hands]
        if (hands.length >= HANDS) hands.shift()
        if (s.hands.includes(item)) continue
        hands.push(item)
        expand({ place: from, hands, seconds, errands: [...s.errands, { kind: 'fetch', item: item as 'cobble' | 'sapling' }] }, left - 1)
      }
    }
    // Make something the model has seen made, from what is in hand, where it was seen made.
    for (const [what, r] of model.recipes) {
      if (!r.from.every((i) => s.hands.includes(i))) continue
      if (s.hands.includes(what)) continue
      for (const at of r.places) {
        const walk = model.walkSeconds(s.place, at)
        const seconds = s.seconds + walk + model.actSeconds(`make:${what}`)
        if (seconds > budget) continue
        let hands = [...s.hands]
        if (r.consumes) hands = hands.map((i) => (i === r.consumes ? what : i))
        else {
          if (hands.length >= HANDS) hands.splice(hands.findIndex((i) => !r.from.includes(i)), 1)
          hands.push(what)
        }
        expand({ place: at, hands, seconds, errands: [...s.errands, { kind: 'make', what: what as Made }] }, left - 1)
      }
    }
  }

  expand({ place: start.place, hands: [...start.hands], seconds: 0, errands: [] }, depth)
  return plans
}

/** The best plan: the highest value, ties broken at random; staying at camp when nothing is worth going for. */
export function bestPlan(plans: Plan[], rng: Rng, start: Standing): Plan {
  let best = -Infinity
  let picks: Plan[] = []
  for (const p of plans) {
    if (p.value > best + 1e-9) {
      best = p.value
      picks = [p]
    } else if (Math.abs(p.value - best) <= 1e-9) picks.push(p)
  }
  if (!picks.length || best <= 0) return { errands: [{ kind: 'stay' }], value: 0, end: { place: start.place, hands: [...start.hands] }, seconds: 0 }
  // Among equal values, prefer the shortest; then the seed decides.
  const shortest = Math.min(...picks.map((p) => p.errands.length))
  picks = picks.filter((p) => p.errands.length === shortest)
  return picks[rng.int(picks.length)]
}

abstract class PlannerBase implements Hominin {
  abstract readonly kind: HomininKind
  protected cue: Cue = 'vultures'
  protected plan: Errand[] = []
  protected before: Standing | null = null

  protected readonly rng: Rng
  readonly model: WorldModel

  constructor(rng: Rng, model?: WorldModel) {
    this.rng = rng
    this.model = model ?? new WorldModel()
  }

  protected abstract depth(): number
  protected critic(): ValueLearner | null {
    return null
  }

  dawn(d: Dawn): void {
    this.cue = d.cue
    this.plan = []
    this.before = null
    this.critic()?.cut()
  }

  next(s: Standing, cue: Cue): Errand {
    if (!this.plan.length) {
      const plans = searchPlans(this.model, cue, s, this.depth(), this.critic())
      this.plan = [...bestPlan(plans, this.rng, s).errands]
    }
    return this.plan.shift() ?? { kind: 'stay' }
  }

  observe(o: Observation): void {
    this.model.observe(o)
  }

  errandDone(before: Standing, errand: Errand, after: Standing): void {
    this.critic()?.transition(this.cue, before, errand, after)
    this.before = after
  }

  endDay(ate: boolean, final?: Standing): void {
    this.critic()?.endDay(this.cue, final ?? this.before ?? { place: 'camp', hands: [], elapsed: 0 }, ate)
  }

  abstract clone(rng: Rng): Hominin
}

export class Planner extends PlannerBase {
  readonly kind = 'planner' as const
  protected depth(): number {
    return PLANNER_DEPTH_CAP
  }
  clone(rng: Rng): Hominin {
    return new Planner(rng, this.model.clone())
  }
}

export class ShallowPlanner extends PlannerBase {
  readonly kind = 'shallow' as const
  readonly valueLearner: ValueLearner
  readonly variant: ShallowVariant

  constructor(rng: Rng, variant: ShallowVariant, model?: WorldModel, valueLearner?: ValueLearner) {
    super(rng, model)
    this.variant = variant
    this.valueLearner = valueLearner ?? new ValueLearner(rng)
  }

  protected depth(): number {
    return SHALLOW_DEPTH
  }

  /** Variant B scores the end of a search with its critic; variant A values it at nothing. The critic learns in both, so the two variants can be switched with the same history. */
  protected critic(): ValueLearner | null {
    return this.variant === 'B' ? this.valueLearner : null
  }

  errandDone(before: Standing, errand: Errand, after: Standing): void {
    this.valueLearner.transition(this.cue, before, errand, after)
    this.before = after
  }

  endDay(ate: boolean, final?: Standing): void {
    this.valueLearner.endDay(this.cue, final ?? this.before ?? { place: 'camp', hands: [], elapsed: 0 }, ate)
  }

  dawn(d: Dawn): void {
    super.dawn(d)
    this.valueLearner.cut()
  }

  withVariant(variant: ShallowVariant, rng: Rng): ShallowPlanner {
    return new ShallowPlanner(rng, variant, this.model.clone(), this.valueLearner.clone(rng))
  }

  clone(rng: Rng): Hominin {
    return this.withVariant(this.variant, rng)
  }
}
