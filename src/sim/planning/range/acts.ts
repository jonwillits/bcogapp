import { HANDS, PICK_UP_SECONDS, RECIPES, YIELDS, hasAll, walkTime, type Item, type Made, type Place } from './places'
import type { Cue } from './needs'

/**
 * An errand: one preparatory act as spec §7.3 counts them (fetch a cobble;
 * make a flake at the outcrop; fetch a sapling; sharpen it), or going to a
 * place and waiting there for midday, or staying put. A hominin's morning is
 * a sequence of errands ending in `go` or `stay`.
 */
export type Errand =
  | { kind: 'fetch'; item: 'cobble' | 'sapling' }
  | { kind: 'make'; what: Made }
  | { kind: 'go'; place: Place }
  | { kind: 'stay' }

export const ERRAND_LABEL = (e: Errand): string => {
  switch (e.kind) {
    case 'fetch':
      return e.item === 'cobble' ? 'fetch a cobble' : 'fetch a sapling'
    case 'make':
      return e.what === 'flake' ? 'make a flake at the outcrop' : e.what === 'probe' ? 'strip the sapling into a probe' : 'sharpen the sapling into a digging stick'
    case 'go':
      return `go to ${e.place}`
    case 'stay':
      return 'stay where it is'
  }
}

export function sameErrand(a: Errand, b: Errand): boolean {
  return ERRAND_LABEL(a) === ERRAND_LABEL(b)
}

/** Where a hominin stands, what it holds, and how far into the morning it is. */
export interface Standing {
  place: Place
  hands: Item[]
  /** Seconds since dawn. */
  elapsed: number
}

/** One thing a hominin did, with its timing, for the record and the view. */
export type Segment =
  | { kind: 'walk'; from: Place; to: Place; t0: number; t1: number }
  | { kind: 'pickUp'; item: Item; place: Place; t0: number; t1: number }
  | { kind: 'putDown'; item: Item; place: Place; t0: number; t1: number }
  | { kind: 'make'; what: Made; from: Item[]; place: Place; t0: number; t1: number }
  | { kind: 'wait'; place: Place; t0: number }

export const PUT_DOWN_SECONDS = 3

/**
 * What a hominin sees: its own acts, the elder's acts, and at midday who ate
 * what with what. Everything a programmed hominin may learn from comes
 * through these, so a hominin that reads nothing else can be checked for it.
 */
export type Observation =
  | { kind: 'walk'; who: Who; from: Place; to: Place; seconds: number }
  | { kind: 'pickUp'; who: Who; item: Item; place: Place; seconds: number }
  | { kind: 'make'; who: Who; what: Made; from: Item[]; kept: Item[]; place: Place; seconds: number }
  | { kind: 'outcome'; who: Who; cue: Cue; place: Place; hands: Item[]; ate: boolean; used: Item | null }

export type Who = 'self' | 'elder'

/** The hands after picking up `item`: at most two, the oldest put down first. */
export function pickUp(hands: readonly Item[], item: Item): { hands: Item[]; dropped: Item | null } {
  const next = [...hands]
  let dropped: Item | null = null
  if (next.length >= HANDS) dropped = next.shift()!
  next.push(item)
  return { hands: next, dropped }
}

/** Whether a make can happen with these hands (the place is checked by the executor). */
export function canMake(hands: readonly Item[], what: Made): boolean {
  return hasAll(hands, RECIPES[what].inputs)
}

/** The hands after a make: the consumed input replaced, or a free hand taken (the oldest non-input put down). */
export function makeWith(hands: readonly Item[], what: Made): { hands: Item[]; dropped: Item | null; kept: Item[] } {
  const r = RECIPES[what]
  let next = [...hands]
  let dropped: Item | null = null
  if (r.consumes) {
    const i = next.indexOf(r.consumes)
    next[i] = r.output
  } else {
    if (next.length >= HANDS) {
      const k = next.findIndex((it) => !r.inputs.includes(it))
      dropped = next.splice(k, 1)[0]
    }
    next.push(r.output)
  }
  const kept = r.inputs.filter((i) => next.includes(i))
  return { hands: next, dropped, kept }
}

/** The source of an item that can be picked up. */
export function sourceOf(item: 'cobble' | 'sapling'): Place {
  return (Object.keys(YIELDS) as Place[]).find((p) => YIELDS[p] === item)!
}

/**
 * Run one errand from a standing, in the range as it is. Returns the new
 * standing, the segments it produced, and what the hominin itself saw of it.
 */
export function execute(s: Standing, e: Errand): { standing: Standing; segments: Segment[]; seen: Observation[] } {
  const segments: Segment[] = []
  const seen: Observation[] = []
  let { place, elapsed } = s
  let hands = [...s.hands]
  const walkTo = (to: Place) => {
    if (to === place) return
    const t = walkTime(place, to)
    segments.push({ kind: 'walk', from: place, to, t0: elapsed, t1: elapsed + t })
    seen.push({ kind: 'walk', who: 'self', from: place, to, seconds: t })
    elapsed += t
    place = to
  }
  switch (e.kind) {
    case 'fetch': {
      walkTo(sourceOf(e.item))
      const r = pickUp(hands, e.item)
      if (r.dropped) {
        segments.push({ kind: 'putDown', item: r.dropped, place, t0: elapsed, t1: elapsed + PUT_DOWN_SECONDS })
        elapsed += PUT_DOWN_SECONDS
      }
      segments.push({ kind: 'pickUp', item: e.item, place, t0: elapsed, t1: elapsed + PICK_UP_SECONDS })
      seen.push({ kind: 'pickUp', who: 'self', item: e.item, place, seconds: PICK_UP_SECONDS })
      elapsed += PICK_UP_SECONDS
      hands = r.hands
      break
    }
    case 'make': {
      const recipe = RECIPES[e.what]
      if (!canMake(hands, e.what)) break
      if (recipe.at) walkTo(recipe.at)
      const r = makeWith(hands, e.what)
      if (r.dropped) {
        segments.push({ kind: 'putDown', item: r.dropped, place, t0: elapsed, t1: elapsed + PUT_DOWN_SECONDS })
        elapsed += PUT_DOWN_SECONDS
      }
      segments.push({ kind: 'make', what: e.what, from: [...recipe.inputs], place, t0: elapsed, t1: elapsed + recipe.seconds })
      seen.push({ kind: 'make', who: 'self', what: e.what, from: [...recipe.inputs], kept: r.kept, place, seconds: recipe.seconds })
      elapsed += recipe.seconds
      hands = r.hands
      break
    }
    case 'go':
      walkTo(e.place)
      segments.push({ kind: 'wait', place, t0: elapsed })
      break
    case 'stay':
      segments.push({ kind: 'wait', place, t0: elapsed })
      break
  }
  return { standing: { place, hands, elapsed }, segments, seen }
}

/** Whether an errand ends the morning. */
export function endsMorning(e: Errand): boolean {
  return e.kind === 'go' || e.kind === 'stay'
}
