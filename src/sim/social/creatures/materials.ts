import { makeRng, type Rng } from '../../random'

/**
 * Part 5, Two Rounds (PART5_REDESIGN_2026-11-04.md §2, §3): the members of
 * an invented animal, in two families, with a category dimension (height,
 * in two bands with a clear gap) and two features that make each member
 * unique and carry no information about the group (a marking and a patch
 * color). Twelve training members a family, six per group, two at each of
 * three height levels; twenty-four test items: the twelve old members, six
 * with one feature changed, six new members at a group's heights.
 *
 * Nothing here depends on the student. The seed decides which family
 * comes first, the training order (each member four times, none twice in
 * a row), and the two test orders. The reserve pair (materials slot 1)
 * serves an interrupted round: the same two families in other colors with
 * other feature pairings.
 *
 * No string in this file names a group before the reveal does: the group
 * names live here as data and are shown only in Round 2 and at the reveal
 * (`naming.test.ts`).
 */

export type Family = 'stilt' | 'bulb'
export type Marking = 'spots' | 'stripes' | 'ring' | 'chevron' | 'band' | 'dots'
export const MARKINGS: readonly Marking[] = ['spots', 'stripes', 'ring', 'chevron', 'band', 'dots']
/** The six patch colors as hues, each away from every family's body hue, with a name for the walk-through. */
export const PATCH_HUES: readonly number[] = [0, 35, 60, 190, 220, 325]
export const PATCH_NAMES: readonly string[] = ['red', 'orange', 'yellow', 'cyan', 'blue', 'pink']

export interface FamilySpec {
  family: Family
  /** The body's hue. */
  hue: number
  /** The base height in pixels: the shortest member. */
  base: number
}

export interface MaterialsPair {
  /** The two families; the seed decides which comes first. */
  families: [FamilySpec, FamilySpec]
  /** The two group names, the short group's then the tall group's, used in Round 2 only. */
  names: [string, string]
  /** The pairing of markings with patch colors in the tall group, as an offset from the short group's pairing (1 to 5), so that no two members share a combination. */
  shift: number
}

export const MATERIALS: MaterialsPair[] = [
  { families: [{ family: 'stilt', hue: 150, base: 96 }, { family: 'bulb', hue: 275, base: 104 }], names: ['Ostra', 'Velin'], shift: 3 },
  { families: [{ family: 'stilt', hue: 110, base: 92 }, { family: 'bulb', hue: 290, base: 100 }], names: ['Marl', 'Tesk'], shift: 2 },
]

export const MEMBERS_PER_GROUP = 6
export const LEVELS = 3
/** The step between height levels within a group. */
export const STEP = 1.05
/** The gap between the groups' nearest levels. */
export const GAP = 1.25
export const SHOWINGS_PER_MEMBER = 4
export const TRAINING_TRIALS = MEMBERS_PER_GROUP * 2 * SHOWINGS_PER_MEMBER
export const ANSWER_SECONDS = 4
export const FEEDBACK_SECONDS = 1
export const CHANGED_ITEMS_PER_GROUP = 3
export const NEW_ITEMS_PER_GROUP = 3

/** The six height levels of a family: the short group's three, then the tall group's three. */
export function heightLevels(base: number): number[] {
  const short = [0, 1, 2].map((k) => base * Math.pow(STEP, k))
  const tall = [0, 1, 2].map((k) => short[2] * GAP * Math.pow(STEP, k))
  return [...short, ...tall]
}

export interface Member {
  /** 0 to 11: the short group's six, then the tall group's six. */
  id: number
  group: 0 | 1
  /** 0 to 2 within the group. */
  level: number
  height: number
  marking: Marking
  /** An index into PATCH_HUES. */
  patch: number
}

export type ItemKind = 'old' | 'changed' | 'new'

export interface Item {
  /** 0 to 23. */
  id: number
  kind: ItemKind
  group: 0 | 1
  height: number
  marking: Marking
  patch: number
  /** For an old or changed item, the training member it is or came from. */
  member: number | null
  /** For a changed item, which feature was changed. */
  changed: 'marking' | 'patch' | null
}

export interface RoundMaterials {
  slot: number
  familyIndex: 0 | 1
  family: FamilySpec
  names: [string, string]
  members: Member[]
  items: Item[]
  /** 48 member ids, each four times, none twice in a row. */
  training: number[]
  /** Item ids in the order of the memory test, and of the second test (the sorting). */
  memoryOrder: number[]
  secondOrder: number[]
}

const key = (m: Marking, p: number) => `${m}|${p}`

/** The twelve training members of a family: two at each level, each marking once a group, each patch color once a group, no combination twice. */
export function trainingMembers(spec: FamilySpec, shift: number): Member[] {
  const levels = heightLevels(spec.base)
  const out: Member[] = []
  for (const group of [0, 1] as const) {
    for (let j = 0; j < MEMBERS_PER_GROUP; j++) {
      const level = Math.floor(j / 2)
      out.push({ id: group * MEMBERS_PER_GROUP + j, group, level, height: levels[group * LEVELS + level], marking: MARKINGS[j], patch: (j + group * shift) % PATCH_HUES.length })
    }
  }
  return out
}

/** The twenty-four test items: the twelve old members, six with one feature changed, six new members at a group's heights. */
export function testItems(members: Member[], base: number): Item[] {
  const levels = heightLevels(base)
  const used = new Set(members.map((m) => key(m.marking, m.patch)))
  const items: Item[] = members.map((m) => ({ id: m.id, kind: 'old' as const, group: m.group, height: m.height, marking: m.marking, patch: m.patch, member: m.id, changed: null }))
  for (const group of [0, 1] as const) {
    // One changed member at each level: the first member of the level; alternate which feature changes.
    for (let level = 0; level < LEVELS; level++) {
      const m = members.find((x) => x.group === group && x.level === level)!
      const changeMarking = (level + group) % 2 === 0
      let placed = false
      for (let d = 1; d < 6 && !placed; d++) {
        const marking = changeMarking ? MARKINGS[(MARKINGS.indexOf(m.marking) + d) % 6] : m.marking
        const patch = changeMarking ? m.patch : (m.patch + d) % 6
        const k = key(marking, patch)
        if (used.has(k)) continue
        used.add(k)
        items.push({ id: items.length, kind: 'changed', group, height: m.height, marking, patch, member: m.id, changed: changeMarking ? 'marking' : 'patch' })
        placed = true
      }
      if (!placed) throw new Error('no free combination for a changed item')
    }
  }
  for (const group of [0, 1] as const) {
    for (let level = 0; level < LEVELS; level++) {
      let placed = false
      for (let n = 0; n < 36 && !placed; n++) {
        // Walk the combinations from a different corner for each group and level, so the new items spread over the features.
        const mi = (level * 2 + group + n) % 6
        const pi = (level * 4 + group * 3 + Math.floor(n / 6) + n) % 6
        const k = key(MARKINGS[mi], pi)
        if (used.has(k)) continue
        used.add(k)
        items.push({ id: items.length, kind: 'new', group, height: levels[group * LEVELS + level], marking: MARKINGS[mi], patch: pi, member: null, changed: null })
        placed = true
      }
      if (!placed) throw new Error('no free combination for a new item')
    }
  }
  return items
}

function shuffle<T>(arr: T[], rng: Rng): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = rng.int(i + 1)
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Each member four times, in a seeded order with no member twice in a row. */
export function trainingOrder(rng: Rng, members = MEMBERS_PER_GROUP * 2, times = SHOWINGS_PER_MEMBER): number[] {
  for (let attempt = 0; attempt < 200; attempt++) {
    const order = shuffle(Array.from({ length: members * times }, (_, i) => i % members), rng)
    // Repair adjacent repeats by swapping with a later position that breaks neither neighbor.
    let ok = true
    for (let i = 1; i < order.length; i++) {
      if (order[i] !== order[i - 1]) continue
      let fixed = false
      for (let j = i + 1; j < order.length; j++) {
        if (order[j] !== order[i] && order[j] !== order[i - 1] && (j + 1 >= order.length || order[j + 1] !== order[i]) && order[j - 1] !== order[i]) {
          ;[order[i], order[j]] = [order[j], order[i]]
          fixed = true
          break
        }
      }
      if (!fixed) {
        ok = false
        break
      }
    }
    if (ok && order.every((m, i) => i === 0 || m !== order[i - 1])) return order
  }
  throw new Error('no training order without a repeat')
}

/** Which family comes first: the seed's choice, balanced across students. */
export function firstFamily(seed: number): 0 | 1 {
  return makeRng(seed ^ 0x5e1f).int(2) as 0 | 1
}

/** The materials of a round: round 0 or 1, from the slot (0 the main pair, 1 the reserve pair). */
export function roundMaterials(seed: number, round: 0 | 1, slot: number): RoundMaterials {
  const pair = MATERIALS[Math.min(slot, MATERIALS.length - 1)]
  const familyIndex = ((firstFamily(seed) + round) % 2) as 0 | 1
  const family = pair.families[familyIndex]
  const members = trainingMembers(family, pair.shift)
  const items = testItems(members, family.base)
  const rng = makeRng(seed ^ (0x2b1 + round * 97 + slot * 1013))
  return { slot, familyIndex, family, names: pair.names, members, items, training: trainingOrder(rng), memoryOrder: shuffle(items.map((i) => i.id), rng), secondOrder: shuffle(items.map((i) => i.id), rng) }
}
