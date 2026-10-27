import type { Rng } from '../../random'
import { makeRng } from '../../random'

/**
 * Part 2's word sets (spec §6.2): three sets of 24 words, each two top
 * categories with three subcategories of four words, from familiar
 * categories. The seed gives one set to the scrambled condition, one to
 * the organized condition, and holds the third in reserve. No word is
 * shared with Part 1's lists, the lists of associates or Part 3's items
 * (`words.test.ts`). Chosen by hand against the norms in `training/m10/`;
 * Jon reviews the sets on the walk. On it (2026-10-27) set-c's places and
 * people by their work went: their subcategories were less distinct than
 * the other sets' and sat near Part 1's words (the mountain list, cop on
 * the thief list, Part 1's tower, bridge, village, cabin, cowboy, army),
 * so clothing and musical instruments took their place. The instruments
 * are the lab's lowest-frequency words (1 to 16 per million) but are known
 * to every student and are as distinct from one another and from the rest
 * of the lab as any category left. set-a's *sea animals* (shark, whale,
 * salmon, lobster) became *fish* (shark, salmon, trout, tuna) the same
 * day: a whale is a mammal, and mammals is the subcategory beside it.
 */

export interface Subcategory {
  label: string
  words: string[]
}

export interface TopCategory {
  label: string
  subcategories: Subcategory[]
}

export interface WordSet {
  id: string
  categories: TopCategory[]
}

const sub = (label: string, words: string[]): Subcategory => ({ label, words })

export const WORD_SETS: WordSet[] = [
  {
    id: 'set-a',
    categories: [
      { label: 'animals', subcategories: [sub('mammals', ['horse', 'tiger', 'rabbit', 'wolf']), sub('birds', ['eagle', 'duck', 'goose', 'owl']), sub('fish', ['shark', 'salmon', 'trout', 'tuna'])] },
      { label: 'vehicles', subcategories: [sub('on land', ['truck', 'bus', 'taxi', 'wagon']), sub('on water', ['ship', 'boat', 'yacht', 'ferry']), sub('in the air', ['plane', 'jet', 'rocket', 'helicopter'])] },
    ],
  },
  {
    id: 'set-b',
    categories: [
      { label: 'foods', subcategories: [sub('fruits', ['apple', 'lemon', 'peach', 'cherry']), sub('vegetables', ['corn', 'bean', 'garlic', 'pepper']), sub('meats', ['beef', 'pork', 'bacon', 'steak'])] },
      { label: 'parts of the body', subcategories: [sub('on the face', ['nose', 'ear', 'chin', 'cheek']), sub('on the arm', ['elbow', 'wrist', 'thumb', 'finger']), sub('on the leg', ['knee', 'ankle', 'heel', 'toe'])] },
    ],
  },
  {
    id: 'set-c',
    categories: [
      { label: 'clothing', subcategories: [sub('on the feet', ['shoe', 'boot', 'sock', 'slipper']), sub('on the head', ['hat', 'cap', 'helmet', 'crown']), sub('on the body', ['shirt', 'jacket', 'coat', 'sweater'])] },
      { label: 'musical instruments', subcategories: [sub('strings', ['guitar', 'violin', 'banjo', 'harp']), sub('wind', ['flute', 'trumpet', 'clarinet', 'saxophone']), sub('percussion', ['drum', 'cymbal', 'tambourine', 'bongo'])] },
    ],
  },
]

export const SET_SIZE = 24
export const GRID_COLUMNS = 4
export const GRID_ROWS = 6

export function wordsOf(set: WordSet): string[] {
  return set.categories.flatMap((c) => c.subcategories.flatMap((s) => s.words))
}

/** The subcategory a word belongs to in a set, or null for a word not in it. */
export function subcategoryOf(set: WordSet, word: string): string | null {
  for (const c of set.categories) for (const s of c.subcategories) if (s.words.includes(word)) return s.label
  return null
}

export function topCategoryOf(set: WordSet, word: string): string | null {
  for (const c of set.categories) for (const s of c.subcategories) if (s.words.includes(word)) return c.label
  return null
}

export interface Part2Plan {
  seed: number
  /** The set studied first, as a 6 × 4 grid in a seeded order with no labels. */
  scrambled: { set: WordSet; grid: string[][] }
  /** The set studied second, laid out as a tree with its labels. */
  organized: { set: WordSet }
  reserve: WordSet
}

/** Study, delay and recall, seconds (§6.1). */
export const STUDY_S = 60
export const PART2_DELAY_S = 30
export const PART2_RECALL_S = 90

function shuffled<T>(items: T[], rng: Rng): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng.int(i + 1)
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** A scrambled grid in which no two adjacent cells in a row share a subcategory, drawn until it is so. */
export function scrambledGrid(set: WordSet, rng: Rng): string[][] {
  for (let tries = 0; tries < 200; tries++) {
    const order = shuffled(wordsOf(set), rng)
    const grid: string[][] = []
    for (let r = 0; r < GRID_ROWS; r++) grid.push(order.slice(r * GRID_COLUMNS, (r + 1) * GRID_COLUMNS))
    const clash = grid.some((row) => row.some((w, i) => i > 0 && subcategoryOf(set, w) === subcategoryOf(set, row[i - 1])))
    if (!clash) return grid
  }
  const order = shuffled(wordsOf(set), rng)
  return Array.from({ length: GRID_ROWS }, (_, r) => order.slice(r * GRID_COLUMNS, (r + 1) * GRID_COLUMNS))
}

/** The seed assigns one set to each condition (§6.1); the scrambled list always comes first. */
export function planPart2(seed: number): Part2Plan {
  const rng = makeRng(seed ^ 0x2a7d)
  const order = shuffled(WORD_SETS, rng)
  return {
    seed,
    scrambled: { set: order[0], grid: scrambledGrid(order[0], rng) },
    organized: { set: order[1] },
    reserve: order[2],
  }
}

/**
 * The materials for a Part 2 unit after a restart: the reserve set takes
 * the place of whichever set was interrupted, in that condition. A second
 * restart has nothing left and returns null.
 */
/** The two units by their order, which is all the screens name before the reveal: the first set is the scrambled one, the second the organized one. */
export type Part2Unit = 'first' | 'second'

export function part2MaterialsFor(plan: Part2Plan, unit: Part2Unit | 'scrambled' | 'organized', restarts: number): { set: WordSet; grid?: string[][] } | null {
  const scrambled = unit === 'first' || unit === 'scrambled'
  if (restarts === 0) return scrambled ? plan.scrambled : plan.organized
  if (restarts > 1) return null
  const rng = makeRng(plan.seed ^ 0x2a7d ^ 0x51)
  return scrambled ? { set: plan.reserve, grid: scrambledGrid(plan.reserve, rng) } : { set: plan.reserve }
}
