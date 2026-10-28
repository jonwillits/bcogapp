import { makeRng, type Rng } from '../../random'

/**
 * A night's features (spec §8.4): four things that are visible and, with
 * audio on, audible. **The week** (§8.5, revised 2026-10-27): six nights in
 * one clearing, each night's features written as a letter. Two nights with
 * the same letter are identical in every feature; two neighboring nights
 * with different letters differ in every feature; any two letters differ
 * on at least two features (the build's rule, so that no later night looks
 * like an earlier one it is not next to). The seed picks one of two orders,
 * `AABCCD` or `ABBBCD`. On night n, from night 3 on, foraging well depends
 * on telling night n − 1 from night n − 2; night n *follows a look-alike
 * pair* when those two nights had the same features. In both orders two
 * nights follow a look-alike pair and two follow a different pair, at the
 * same average position in the week (4.5), so practice helps both kinds
 * equally within one student.
 */

export const MOONS = ['new moon', 'half moon', 'full moon'] as const
export const WEATHERS = ['clear', 'light rain', 'fog'] as const
export const GROUNDS = ['nothing on the ground', 'a fallen branch across the path', 'a ring of mushrooms', 'scattered fresh leaves'] as const
export const SOUNDS = ['crickets', 'frogs', 'wind, with an owl’s hoot'] as const

export type Moon = (typeof MOONS)[number]
export type Weather = (typeof WEATHERS)[number]
export type Ground = (typeof GROUNDS)[number]
export type Sound = (typeof SOUNDS)[number]

export interface NightFeatures {
  moon: Moon
  weather: Weather
  ground: Ground
  sound: Sound
}

export type Letter = 'A' | 'B' | 'C' | 'D'
export const LETTERS: Letter[] = ['A', 'B', 'C', 'D']

export type WeekOrder = 'AABCCD' | 'ABBBCD'
export const WEEK_ORDERS: WeekOrder[] = ['AABCCD', 'ABBBCD']
export const WEEK_NIGHTS = 6
/** The nights on which telling last night from the night before matters: 3 to 6. */
export const TEST_NIGHTS = [3, 4, 5, 6] as const

export type PairKind = 'after a look-alike pair' | 'after a different pair'
export const PAIR_KINDS: PairKind[] = ['after a look-alike pair', 'after a different pair']

/** The letter of night n (1 to 6) in an order. */
export function letterOf(order: WeekOrder, night: number): Letter {
  return order[night - 1] as Letter
}

/** Night n (3 to 6) follows a look-alike pair when nights n − 2 and n − 1 share a letter; null for nights 1 and 2. */
export function pairKind(order: WeekOrder, night: number): PairKind | null {
  if (night < 3 || night > WEEK_NIGHTS) return null
  return letterOf(order, night - 1) === letterOf(order, night - 2) ? 'after a look-alike pair' : 'after a different pair'
}

export function nightsOfKind(order: WeekOrder, kind: PairKind): number[] {
  return TEST_NIGHTS.filter((n) => pairKind(order, n) === kind)
}

export interface WeekPlan {
  order: WeekOrder
  letters: Record<Letter, NightFeatures>
  /** The six nights' features, night 1 first. */
  nights: NightFeatures[]
  practice: NightFeatures
}

export function sameFeatures(a: NightFeatures, b: NightFeatures): boolean {
  return a.moon === b.moon && a.weather === b.weather && a.ground === b.ground && a.sound === b.sound
}

export function sharedFeatures(a: NightFeatures, b: NightFeatures): number {
  return (a.moon === b.moon ? 1 : 0) + (a.weather === b.weather ? 1 : 0) + (a.ground === b.ground ? 1 : 0) + (a.sound === b.sound ? 1 : 0)
}

export const differingFeatures = (a: NightFeatures, b: NightFeatures): number => 4 - sharedFeatures(a, b)

export function anyFeatures(rng: Rng): NightFeatures {
  return { moon: MOONS[rng.int(3)], weather: WEATHERS[rng.int(3)], ground: GROUNDS[rng.int(4)], sound: SOUNDS[rng.int(3)] }
}

/** The neighbors in both orders: A–B, B–C and C–D. */
const NEIGHBORS: [Letter, Letter][] = [
  ['A', 'B'],
  ['B', 'C'],
  ['C', 'D'],
]

/** The four letters' features: neighbors differ on every feature, any two letters on at least two. Drawn until the rule holds (about one draw in a hundred does). */
export function letterFeatures(rng: Rng): Record<Letter, NightFeatures> {
  for (;;) {
    const f: Record<Letter, NightFeatures> = { A: anyFeatures(rng), B: anyFeatures(rng), C: anyFeatures(rng), D: anyFeatures(rng) }
    if (!NEIGHBORS.every(([a, b]) => differingFeatures(f[a], f[b]) === 4)) continue
    let ok = true
    for (let i = 0; i < LETTERS.length && ok; i++) for (let j = i + 1; j < LETTERS.length; j++) if (differingFeatures(f[LETTERS[i]], f[LETTERS[j]]) < 2) ok = false
    if (ok) return f
  }
}

/** Part 4's plan from the seed: the order, the letters' features, the six nights and the practice night. */
export function planWeek(seed: number): WeekPlan {
  const rng = makeRng(seed ^ 0x4f0a)
  const order: WeekOrder = rng.next() < 0.5 ? 'AABCCD' : 'ABBBCD'
  const letters = letterFeatures(rng)
  const practice = anyFeatures(rng)
  const nights = Array.from({ length: WEEK_NIGHTS }, (_, i) => ({ ...letters[letterOf(order, i + 1)] }))
  return { order, letters, nights, practice }
}

/** The features as a one-hot vector, for the fast store: 3 + 3 + 4 + 3 = 13 dimensions. */
export function featureVector(f: NightFeatures): number[] {
  const v = new Array<number>(13).fill(0)
  v[MOONS.indexOf(f.moon)] = 1
  v[3 + WEATHERS.indexOf(f.weather)] = 1
  v[6 + GROUNDS.indexOf(f.ground)] = 1
  v[10 + SOUNDS.indexOf(f.sound)] = 1
  return v
}

export const FEATURE_DIMS = 13

/** The features in one line, as the features line prints them (§8.4). */
export function describeFeatures(f: NightFeatures): string {
  return `${f.moon}, ${f.weather}, ${f.ground}, ${f.sound}`
}
