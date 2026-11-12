/**
 * The range of Part 3 (spec §7.1), as the hominins can perceive it: the
 * places, where each one lies, how long a walk between two of them takes,
 * what can be picked up where, and what can be made from what. Nothing here
 * says which need a cue is followed by, or what a need takes: that table is
 * `needs.ts`, which only the world itself reads (spec §11, item 4).
 *
 * Distances are the spec's starting points, tuned so that a wrong errand
 * costs a walk and a morning cannot cover every errand. The camp is at the
 * origin; x runs east and z runs north, in meters, and the same coordinates
 * place the 3D range.
 */

export type Place = 'camp' | 'riverbank' | 'outcrop' | 'woodland' | 'grassland' | 'oldKill' | 'mounds' | 'flats'

export const PLACES: readonly Place[] = ['camp', 'riverbank', 'outcrop', 'woodland', 'grassland', 'oldKill', 'mounds', 'flats']

export const PLACE_LABEL: Record<Place, string> = {
  camp: 'the camp',
  riverbank: 'the riverbank',
  outcrop: 'the outcrop',
  woodland: 'the woodland edge',
  grassland: 'the grassland',
  oldKill: 'the old kill',
  mounds: 'the termite mounds',
  flats: 'the tuber flats',
}

/** Where each place lies, in meters from the camp. */
export const PLACE_XZ: Record<Place, { x: number; z: number }> = {
  camp: { x: 0, z: 0 },
  riverbank: { x: 15, z: 0 },
  outcrop: { x: 100, z: 10 },
  woodland: { x: 0, z: 40 },
  grassland: { x: -100, z: 0 },
  oldKill: { x: -42, z: -42 },
  mounds: { x: 0, z: -50 },
  flats: { x: 50, z: 50 },
}

export function distance(a: Place, b: Place): number {
  const p = PLACE_XZ[a]
  const q = PLACE_XZ[b]
  return Math.hypot(p.x - q.x, p.z - q.z)
}

/** A hominin's walking speed, meters per second of range time. */
export const WALK_SPEED = 1.3

export function walkTime(a: Place, b: Place): number {
  return distance(a, b) / WALK_SPEED
}

export type Item = 'cobble' | 'flake' | 'sapling' | 'probe' | 'diggingStick'

export const ITEMS: readonly Item[] = ['cobble', 'flake', 'sapling', 'probe', 'diggingStick']

export const ITEM_LABEL: Record<Item, string> = {
  cobble: 'a cobble',
  flake: 'a flake',
  sapling: 'a sapling',
  probe: 'a probe',
  diggingStick: 'a digging stick',
}

/** A hominin's hands: at most two items (spec §7.3). */
export const HANDS = 2

/** What can be picked up where. */
export const YIELDS: Partial<Record<Place, Item>> = {
  riverbank: 'cobble',
  woodland: 'sapling',
}

export type Made = 'flake' | 'probe' | 'diggingStick'

export interface Recipe {
  output: Made
  /** What must be in hand. */
  inputs: readonly Item[]
  /** Which input is used up, replaced by the output; the rest are kept. Null: the output takes a free hand. */
  consumes: Item | null
  /** Where it can be made; null is anywhere. */
  at: Place | null
  /** Seconds. */
  seconds: number
}

/**
 * What each act makes from what (spec §7.3): a flake at the outcrop from a
 * cobble used as a hammerstone, the cobble kept; a probe anywhere from a
 * sapling, by stripping it; a digging stick anywhere from a sapling and a
 * flake, by sharpening the sapling, the flake kept.
 */
export const RECIPES: Record<Made, Recipe> = {
  flake: { output: 'flake', inputs: ['cobble'], consumes: null, at: 'outcrop', seconds: 40 },
  probe: { output: 'probe', inputs: ['sapling'], consumes: 'sapling', at: null, seconds: 20 },
  diggingStick: { output: 'diggingStick', inputs: ['sapling', 'flake'], consumes: 'sapling', at: null, seconds: 40 },
}

export const PICK_UP_SECONDS = 10

/** The morning, in seconds of range time, from dawn to midday. */
export const MORNING_SECONDS = 360
/** How long a need stays at its place after midday. */
export const WINDOW_SECONDS = 60

export function hasAll(hands: readonly Item[], inputs: readonly Item[]): boolean {
  return inputs.every((i) => hands.includes(i))
}
