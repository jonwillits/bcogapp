import { makeRng, type Rng } from '../../random'

/**
 * Part 5, Two Groups (spec §9): an adaptation of Tajfel and Wilkes (1963),
 * with the members of two invented groups of an invented animal in place
 * of lines. Two sets of eight members, one of each kind of creature. In
 * the labeled set every member appears with its group's name, and the four
 * shortest are always in one group and the four tallest in the other. In
 * the unlabeled set, members appear with no name. The heights of each set
 * form an evenly spaced series at 5% steps, and the two sets use different
 * series. The seed decides which kind of creature is labeled and which set
 * comes first. A reserve pair of sets, with different series and colors,
 * serves an interrupted unit (§9.2).
 *
 * The creature is invented and resembles no real species, and in
 * particular no ape or other primate (decision 15): a stilt-legged thing
 * with a crest, or a bulb on a stalk, drawn from a few shapes with no
 * face (`creature.tsx` in the scene draws them from these parameters).
 *
 * Nothing in this file names what the part tests (`naming.test.ts`).
 */

export type CreatureKind = 'stilt' | 'bulb'
export const KINDS: readonly CreatureKind[] = ['stilt', 'bulb']

export interface Creature {
  kind: CreatureKind
  /** A hue for the body; the two kinds differ in body shape and in color. */
  hue: number
}

export interface SetSpec {
  /** The base height in pixels; member k is base × 1.05^k. */
  base: number
  creature: Creature
}

export interface MaterialsPair {
  /** The two sets, before the seed orders them. */
  sets: [SetSpec, SetSpec]
  /** The two group names for the labeled set, shortest four then tallest four. */
  names: [string, string]
}

/** The step between neighboring heights: 5%, the size Tajfel and Wilkes used. */
export const STEP = 1.05
export const MEMBERS = 8
export const PRESENTATIONS_PER_MEMBER = 4
export const PRESENTATION_SECONDS = 2
export const JUDGMENTS_PER_MEMBER = 2

/** The materials: the pair meant for the unit, then the reserve pair. Heights in pixels of the drawn creature. */
export const MATERIALS: MaterialsPair[] = [
  { sets: [{ base: 96, creature: { kind: 'stilt', hue: 150 } }, { base: 112, creature: { kind: 'bulb', hue: 275 } }], names: ['Ostra', 'Velin'] },
  { sets: [{ base: 104, creature: { kind: 'bulb', hue: 25 } }, { base: 88, creature: { kind: 'stilt', hue: 200 } }], names: ['Marl', 'Tesk'] },
]

export const heights = (set: SetSpec): number[] => Array.from({ length: MEMBERS }, (_, k) => set.base * Math.pow(STEP, k))

export interface Member {
  /** Index within its series, 0 the shortest. */
  k: number
  height: number
  /** The group name shown with it, or null in the unlabeled set. */
  label: string | null
}

export interface PlannedSet {
  which: 'labeled' | 'unlabeled'
  spec: SetSpec
  members: Member[]
  /** The order of the 32 presentations, as member indices. */
  presentation: number[]
  /** The order of the 16 judgments, as member indices. */
  judgments: number[]
  /** Per judgment: where the bar starts, as a share of the member's true height, and the bar's vertical offset from the creature's baseline in pixels. */
  barStarts: { share: number; offset: number }[]
}

export interface Plan {
  materials: number
  names: [string, string]
  /** The two sets in the order they are run. */
  sets: [PlannedSet, PlannedSet]
}

function shuffled<T>(items: T[], rng: Rng): T[] {
  const out = items.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng.int(i + 1)
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** The bar starts well away from the true height, and never at it: 60 to 85% or 115 to 140% of it. */
export function barStart(rng: Rng): { share: number; offset: number } {
  const below = rng.next() < 0.5
  const share = below ? rng.range(0.6, 0.85) : rng.range(1.15, 1.4)
  const offset = rng.range(-30, 30)
  return { share, offset }
}

/** The plan for a materials slot and seed: which kind is labeled, which set comes first, every order and every bar start. */
export function planSets(seed: number, materials: number): Plan {
  const m = MATERIALS[Math.min(materials, MATERIALS.length - 1)]
  const rng = makeRng(seed ^ 0x7e57 ^ (materials * 0x9e37))
  const labeledIndex = rng.int(2)
  const planned = m.sets.map((spec, i): PlannedSet => {
    const which = i === labeledIndex ? 'labeled' : 'unlabeled'
    const hs = heights(spec)
    const members: Member[] = hs.map((height, k) => ({ k, height, label: which === 'labeled' ? (k < MEMBERS / 2 ? m.names[0] : m.names[1]) : null }))
    const presentation = shuffled(Array.from({ length: MEMBERS * PRESENTATIONS_PER_MEMBER }, (_, i) => i % MEMBERS), rng)
    const judgments = shuffled(Array.from({ length: MEMBERS * JUDGMENTS_PER_MEMBER }, (_, i) => i % MEMBERS), rng)
    const barStarts = judgments.map(() => barStart(rng))
    return { which, spec, members, presentation, judgments, barStarts }
  })
  const first = rng.int(2)
  return { materials, names: m.names, sets: [planned[first], planned[1 - first]] as [PlannedSet, PlannedSet] }
}

// ----------------------------------------------------------------- scoring (§9.3)

export interface Judgment {
  which: 'labeled' | 'unlabeled'
  member: number
  judged: number
}

export interface SetScore {
  which: 'labeled' | 'unlabeled'
  /** Mean judged height per member. */
  judged: number[]
  truth: number[]
  /** The judged difference between the shortest of the taller four and the tallest of the shorter four, and the true one. */
  boundary: { judged: number; truth: number }
  /** The other six neighboring differences averaged, judged and true. */
  others: { judged: number; truth: number }
  /** The judged range within each group of four against the true range. */
  spread: { shorter: { judged: number; truth: number }; taller: { judged: number; truth: number } }
}

export function scoreSet(set: PlannedSet, judgments: Judgment[]): SetScore {
  const judged = set.members.map((_, k) => {
    const v = judgments.filter((j) => j.which === set.which && j.member === k).map((j) => j.judged)
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN
  })
  const truth = set.members.map((mem) => mem.height)
  const half = MEMBERS / 2
  const diffs = (h: number[]) => Array.from({ length: MEMBERS - 1 }, (_, k) => h[k + 1] - h[k])
  const dj = diffs(judged)
  const dt = diffs(truth)
  const othersJ = dj.filter((_, k) => k !== half - 1)
  const othersT = dt.filter((_, k) => k !== half - 1)
  const range = (h: number[], from: number, to: number) => Math.max(...h.slice(from, to)) - Math.min(...h.slice(from, to))
  return {
    which: set.which,
    judged,
    truth,
    boundary: { judged: dj[half - 1], truth: dt[half - 1] },
    others: { judged: othersJ.reduce((a, b) => a + b, 0) / othersJ.length, truth: othersT.reduce((a, b) => a + b, 0) / othersT.length },
    spread: { shorter: { judged: range(judged, 0, half), truth: range(truth, 0, half) }, taller: { judged: range(judged, half, MEMBERS), truth: range(truth, half, MEMBERS) } },
  }
}

/** The two measures the simulated class plots: the boundary difference as a share of the true one, and the mean within-group spread as a share of the true one, for each set. */
export function measures(labeled: SetScore, unlabeled: SetScore): { boundary: { labeled: number; unlabeled: number }; spread: { labeled: number; unlabeled: number } } {
  const sp = (s: SetScore) => (s.spread.shorter.judged / s.spread.shorter.truth + s.spread.taller.judged / s.spread.taller.truth) / 2
  return { boundary: { labeled: labeled.boundary.judged / labeled.boundary.truth, unlabeled: unlabeled.boundary.judged / unlabeled.boundary.truth }, spread: { labeled: sp(labeled), unlabeled: sp(unlabeled) } }
}
