import { makeRng, type Rng } from '../../random'
import type { ClearingId } from './clearings'

/**
 * A night's features (spec §8.4): four things that are visible and, with
 * audio on, audible. The look-alike block's three nights are identical in
 * all four; the distinct block's three nights differ from one another on
 * every feature, and each shares at most one feature value with the
 * look-alike nights, never the thing on the ground (there are only three
 * moons, three weathers and three sounds, so three distinct nights cannot
 * all avoid the look-alike night's value on those; recorded in the notes).
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

export type BlockKind = 'look-alike' | 'distinct'

export const BLOCK_LABEL: Record<BlockKind, string> = { 'look-alike': 'look-alike nights', distinct: 'distinct nights' }

export interface BlockPlan {
  kind: BlockKind
  /** The clearing this block runs in, and the one a restart runs in. */
  clearing: ClearingId
  reserve: ClearingId
  nights: [NightFeatures, NightFeatures, NightFeatures]
}

export interface Part4Plan {
  practice: NightFeatures
  /** The two blocks in the order they are run. */
  blocks: [BlockPlan, BlockPlan]
}

function shuffled<T>(xs: readonly T[], rng: Rng): T[] {
  const out = [...xs]
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng.int(i + 1)
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** The look-alike night's features, and three distinct nights built against them. */
export function planFeatures(rng: Rng): { alike: NightFeatures; distinct: [NightFeatures, NightFeatures, NightFeatures] } {
  const alike: NightFeatures = { moon: MOONS[rng.int(3)], weather: WEATHERS[rng.int(3)], ground: GROUNDS[rng.int(4)], sound: SOUNDS[rng.int(3)] }
  // Each three-valued feature: a permutation of all three values over the three nights; the night that gets the
  // look-alike's value is a different night for each feature, so no distinct night shares more than one value.
  const which = shuffled([0, 1, 2], rng) // which night takes the shared moon, weather, sound
  const assign = <T,>(values: readonly T[], shared: T, nightOfShared: number): T[] => {
    const others = shuffled(values.filter((v) => v !== shared), rng)
    const out: T[] = []
    let k = 0
    for (let n = 0; n < 3; n++) out.push(n === nightOfShared ? shared : others[k++])
    return out
  }
  const moons = assign(MOONS, alike.moon, which[0])
  const weathers = assign(WEATHERS, alike.weather, which[1])
  const sounds = assign(SOUNDS, alike.sound, which[2])
  const grounds = shuffled(GROUNDS.filter((g) => g !== alike.ground), rng)
  const distinct = [0, 1, 2].map((n) => ({ moon: moons[n], weather: weathers[n], ground: grounds[n], sound: sounds[n] })) as [NightFeatures, NightFeatures, NightFeatures]
  return { alike, distinct }
}

/** Part 4's plan from the seed: which block comes first, which clearing each runs in, and every night's features. */
export function planPart4(seed: number): Part4Plan {
  const rng = makeRng(seed ^ 0x4f0a)
  const { alike, distinct } = planFeatures(rng)
  const practice: NightFeatures = { moon: MOONS[rng.int(3)], weather: WEATHERS[rng.int(3)], ground: GROUNDS[rng.int(4)], sound: SOUNDS[rng.int(3)] }
  const alikeFirst = rng.next() < 0.5
  const aFirst = rng.next() < 0.5
  const first: ClearingId = aFirst ? 'A' : 'B'
  const second: ClearingId = aFirst ? 'B' : 'A'
  const look: BlockPlan = { kind: 'look-alike', clearing: alikeFirst ? first : second, reserve: 'reserve', nights: [alike, { ...alike }, { ...alike }] }
  const dist: BlockPlan = { kind: 'distinct', clearing: alikeFirst ? second : first, reserve: 'reserve', nights: distinct }
  return { practice, blocks: alikeFirst ? [look, dist] : [dist, look] }
}

export function sameFeatures(a: NightFeatures, b: NightFeatures): boolean {
  return a.moon === b.moon && a.weather === b.weather && a.ground === b.ground && a.sound === b.sound
}

export function sharedFeatures(a: NightFeatures, b: NightFeatures): number {
  return (a.moon === b.moon ? 1 : 0) + (a.weather === b.weather ? 1 : 0) + (a.ground === b.ground ? 1 : 0) + (a.sound === b.sound ? 1 : 0)
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

/** The features in one line, as the fixed line beside the view prints them. */
export function describeFeatures(f: NightFeatures): string {
  return `${f.moon}, ${f.weather}, ${f.ground}, ${f.sound}`
}
