import type { Observation } from '../range/acts'
import type { Item, Made, Place } from '../range/places'
import type { Cue } from '../range/needs'

/**
 * The model a planner learns from everything it has seen, its own errands
 * and the elder's (spec §7.4.3): what each place yields, what each act makes
 * from what and where, how long walks and acts take, and what each cue is
 * followed by, as the chance of eating at a place holding an item. It is
 * built from `Observation`s alone. It never reads the scene's table of what
 * each need takes, its cue schedule, or the day's need (spec §11, item 4):
 * `structure.test.ts` checks that this file and the planners import nothing
 * from `range/needs` but the type of a cue.
 */

export const MODEL = {
  /** How far one outcome moves the estimated chance of food at a place with an item: est ← est + α (outcome − est). */
  foodRate: 0.5,
  /** Below this, a chance of food counts as none, and a plan that reaches nothing better stays at camp. */
  worthGoing: 0.1,
} as const

export interface LearnedRecipe {
  output: Made
  from: Item[]
  /** Which input was used up (not among the kept), or null. */
  consumes: Item | null
  /** Where the make was seen. */
  places: Set<Place>
}

export class WorldModel {
  /** Which places have yielded which items. */
  readonly sources = new Map<Item, Set<Place>>()
  readonly recipes = new Map<Made, LearnedRecipe>()
  /** Mean walking seconds for each pair of places walked. */
  readonly walks = new Map<string, { mean: number; n: number }>()
  /** Mean seconds of each act seen. */
  readonly acts = new Map<string, { mean: number; n: number }>()
  /** The estimated chance of eating, by cue, place, and item in hand. */
  readonly food = new Map<string, number>()
  /** How many outcomes have been seen, by cue, place, and item. */
  readonly foodSeen = new Map<string, number>()

  observe(o: Observation): void {
    switch (o.kind) {
      case 'pickUp': {
        if (!this.sources.has(o.item)) this.sources.set(o.item, new Set())
        this.sources.get(o.item)!.add(o.place)
        this.tally(this.acts, `pickUp`, o.seconds)
        break
      }
      case 'make': {
        const r = this.recipes.get(o.what) ?? { output: o.what, from: [...o.from], consumes: null, places: new Set<Place>() }
        r.consumes = o.from.find((i) => !o.kept.includes(i)) ?? null
        r.places.add(o.place)
        this.recipes.set(o.what, r)
        this.tally(this.acts, `make:${o.what}`, o.seconds)
        break
      }
      case 'walk':
        this.tally(this.walks, walkKey(o.from, o.to), o.seconds)
        break
      case 'outcome': {
        if (o.ate && o.used) {
          this.nudge(o.cue, o.place, o.used, 1)
        } else {
          for (const it of o.hands.length ? o.hands : [null]) this.nudge(o.cue, o.place, it, 0)
        }
        break
      }
    }
  }

  private nudge(cue: Cue, place: Place, item: Item | null, outcome: 0 | 1): void {
    const k = foodKey(cue, place, item)
    const est = this.food.get(k) ?? 0
    this.food.set(k, est + MODEL.foodRate * (outcome - est))
    this.foodSeen.set(k, (this.foodSeen.get(k) ?? 0) + 1)
  }

  private tally(map: Map<string, { mean: number; n: number }>, key: string, seconds: number): void {
    const t = map.get(key) ?? { mean: 0, n: 0 }
    t.n++
    t.mean += (seconds - t.mean) / t.n
    map.set(key, t)
  }

  chanceOfFood(cue: Cue, place: Place, item: Item | null): number {
    return this.food.get(foodKey(cue, place, item)) ?? 0
  }

  /** The walking time the model expects; a pair never walked is taken to be as long as the longest walk seen. */
  walkSeconds(a: Place, b: Place): number {
    if (a === b) return 0
    const w = this.walks.get(walkKey(a, b))
    if (w) return w.mean
    let longest = 0
    for (const t of this.walks.values()) longest = Math.max(longest, t.mean)
    return longest
  }

  actSeconds(key: string): number {
    return this.acts.get(key)?.mean ?? 0
  }

  clone(): WorldModel {
    const m = new WorldModel()
    for (const [k, v] of this.sources) m.sources.set(k, new Set(v))
    for (const [k, v] of this.recipes) m.recipes.set(k, { ...v, from: [...v.from], places: new Set(v.places) })
    for (const [k, v] of this.walks) m.walks.set(k, { ...v })
    for (const [k, v] of this.acts) m.acts.set(k, { ...v })
    for (const [k, v] of this.food) m.food.set(k, v)
    for (const [k, v] of this.foodSeen) m.foodSeen.set(k, v)
    return m
  }
}

export function walkKey(a: Place, b: Place): string {
  return a < b ? `${a}>${b}` : `${b}>${a}`
}

export function foodKey(cue: Cue, place: Place, item: Item | null): string {
  return `${cue}|${place}|${item ?? 'nothing'}`
}
