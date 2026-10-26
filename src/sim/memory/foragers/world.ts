/**
 * The slow learner's world (spec §9.4): eight things in the range in a
 * hierarchy that mirrors the canary model's plants and animals (§10.2.10;
 * Rogers and McClelland). Places that stay put: wood (the loose-bark log,
 * the smooth log) and plants (seed grass, the berry bush). Animals that
 * move: from the air (the owl, the hawk) and on the ground (the fox, the
 * snake). A new season brings two more: an acorn tree, a plant with nuts,
 * and a weasel, on the ground, which enters burrows.
 *
 * The properties run from general (shared by a top-level group) through
 * the middle level (shared by a pair) to specific (one thing's own). The
 * build drafted the table; Jon approves it on the walk.
 */

export const THINGS = ['loose-bark log', 'smooth log', 'seed grass', 'berry bush', 'owl', 'hawk', 'fox', 'snake'] as const
export const NEW_THINGS = ['acorn tree', 'weasel'] as const
export const ALL_THINGS = [...THINGS, ...NEW_THINGS] as const
export type Thing = (typeof ALL_THINGS)[number]

export const RELATIONS = ['is', 'has', 'does'] as const
export type Relation = (typeof RELATIONS)[number]

export type Level = 'general' | 'middle' | 'specific'

export interface Property {
  relation: Relation
  name: string
  level: Level
  things: Thing[]
}

/** The groups, for the hidden-activity space's story: what separates first. */
export const GROUPS = {
  stays: ['loose-bark log', 'smooth log', 'seed grass', 'berry bush'] as Thing[],
  moves: ['owl', 'hawk', 'fox', 'snake'] as Thing[],
  wood: ['loose-bark log', 'smooth log'] as Thing[],
  plants: ['seed grass', 'berry bush'] as Thing[],
  air: ['owl', 'hawk'] as Thing[],
  ground: ['fox', 'snake'] as Thing[],
}

const T = (...xs: Thing[]) => xs

export const PROPERTIES: Property[] = [
  // is
  { relation: 'is', name: 'something that stays put', level: 'general', things: T('loose-bark log', 'smooth log', 'seed grass', 'berry bush', 'acorn tree') },
  { relation: 'is', name: 'something that moves', level: 'general', things: T('owl', 'hawk', 'fox', 'snake', 'weasel') },
  { relation: 'is', name: 'a danger', level: 'general', things: T('owl', 'hawk', 'fox', 'snake', 'weasel') },
  { relation: 'is', name: 'wood', level: 'middle', things: T('loose-bark log', 'smooth log') },
  { relation: 'is', name: 'a plant', level: 'middle', things: T('seed grass', 'berry bush', 'acorn tree') },
  { relation: 'is', name: 'a hunter from the air', level: 'middle', things: T('owl', 'hawk') },
  { relation: 'is', name: 'a hunter on the ground', level: 'middle', things: T('fox', 'snake', 'weasel') },
  { relation: 'is', name: 'rough to the touch', level: 'specific', things: T('loose-bark log') },
  { relation: 'is', name: 'smooth to the touch', level: 'specific', things: T('smooth log') },
  { relation: 'is', name: 'tall', level: 'specific', things: T('acorn tree') },
  // has
  { relation: 'has', name: 'eyes', level: 'general', things: T('owl', 'hawk', 'fox', 'snake', 'weasel') },
  { relation: 'has', name: 'a place it is always found', level: 'general', things: T('loose-bark log', 'smooth log', 'seed grass', 'berry bush', 'acorn tree') },
  { relation: 'has', name: 'bark', level: 'middle', things: T('loose-bark log', 'smooth log', 'acorn tree') },
  { relation: 'has', name: 'roots', level: 'middle', things: T('seed grass', 'berry bush', 'acorn tree') },
  { relation: 'has', name: 'wings', level: 'middle', things: T('owl', 'hawk') },
  { relation: 'has', name: 'feathers', level: 'middle', things: T('owl', 'hawk') },
  { relation: 'has', name: 'legs', level: 'middle', things: T('owl', 'hawk', 'fox', 'weasel') },
  { relation: 'has', name: 'fur', level: 'middle', things: T('fox', 'weasel') },
  { relation: 'has', name: 'beetles under it', level: 'specific', things: T('loose-bark log') },
  { relation: 'has', name: 'no beetles under it', level: 'specific', things: T('smooth log') },
  { relation: 'has', name: 'seeds', level: 'specific', things: T('seed grass') },
  { relation: 'has', name: 'berries', level: 'specific', things: T('berry bush') },
  { relation: 'has', name: 'acorns', level: 'specific', things: T('acorn tree') },
  { relation: 'has', name: 'scales', level: 'specific', things: T('snake') },
  { relation: 'has', name: 'a long thin body', level: 'specific', things: T('weasel') },
  // does
  { relation: 'does', name: 'grow', level: 'general', things: T('seed grass', 'berry bush', 'acorn tree', 'loose-bark log', 'smooth log') },
  { relation: 'does', name: 'hunt', level: 'general', things: T('owl', 'hawk', 'fox', 'snake', 'weasel') },
  { relation: 'does', name: 'rot', level: 'middle', things: T('loose-bark log', 'smooth log') },
  { relation: 'does', name: 'fly', level: 'middle', things: T('owl', 'hawk') },
  { relation: 'does', name: 'run', level: 'middle', things: T('fox', 'weasel') },
  { relation: 'does', name: 'hunt at night', level: 'specific', things: T('owl', 'fox') },
  { relation: 'does', name: 'hunt by day', level: 'specific', things: T('hawk', 'snake') },
  { relation: 'does', name: 'slither', level: 'specific', things: T('snake') },
  { relation: 'does', name: 'hoot', level: 'specific', things: T('owl') },
  { relation: 'does', name: 'enter burrows', level: 'specific', things: T('snake', 'weasel') },
  { relation: 'does', name: 'drop its seeds', level: 'specific', things: T('seed grass') },
]

export const N_PROPERTIES = PROPERTIES.length

/** The target vector over every property for one thing and one relation: 1 where the thing has that property under that relation, 0 elsewhere. */
export function targetsFor(thing: Thing, relation: Relation): number[] {
  return PROPERTIES.map((p) => (p.relation === relation && p.things.includes(thing) ? 1 : 0))
}

/** The input vector: one unit per thing (all ten, so the new season needs no new unit), one per relation. */
export const N_INPUTS = ALL_THINGS.length + RELATIONS.length

export function inputFor(thing: Thing, relation: Relation): number[] {
  const x = new Array<number>(N_INPUTS).fill(0)
  x[ALL_THINGS.indexOf(thing)] = 1
  x[ALL_THINGS.length + RELATIONS.indexOf(relation)] = 1
  return x
}

/** Every (thing, relation) pattern of the old world, and of the new season. */
export function patternsOf(things: readonly Thing[]): { thing: Thing; relation: Relation; x: number[]; t: number[] }[] {
  const out: { thing: Thing; relation: Relation; x: number[]; t: number[] }[] = []
  for (const thing of things) for (const relation of RELATIONS) out.push({ thing, relation, x: inputFor(thing, relation), t: targetsFor(thing, relation) })
  return out
}

/** The property table's rows, for the screen: one row per property with the things that have it. */
export function propertyTable(): { relation: Relation; name: string; level: Level; things: Thing[] }[] {
  return PROPERTIES.map((p) => ({ relation: p.relation, name: p.name, level: p.level, things: [...p.things] }))
}
