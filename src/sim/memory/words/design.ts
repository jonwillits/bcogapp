import { makeRng, type Rng } from '../../random'
import { ASSOCIATE_LISTS, UNRELATED, type StudyList } from './lists'

/**
 * Part 1's design (spec §5.1, with Jon's answer 5 of 2026-10-25 and his
 * cut of 2026-10-26): seven study lists in an order the seed fixes. Four
 * unrelated lists of fifteen words, two recalled at once and two after
 * the delay; three lists of associates, all recalled at once, never first
 * or last, and separated from one another by at least one unrelated list
 * (with seven slots that puts them at the second, fourth and sixth). Of
 * the six lists of associates the seed studies three and holds three as
 * controls for the recognition test. The list-length condition of the
 * spec (four short and four long lists) was cut on the walk: eleven lists
 * were too fatiguing, and list length served the least of the objectives.
 */

export type Recall = 'immediate' | 'delayed'

/** A word is shown for this long, then a blank, then the next (§5.1; Roediger and McDermott's 1.5-s rate). */
export const WORD_ON_S = 1.5
export const BLANK_S = 0.3
/** Counting backward by 3s, typed one number at a time, each checked. */
export const DELAY_S = 30
/** Every list, unrelated or of associates, gets the same time to type. */
export const RECALL_S = 60

export const SLOTS = 7
export const ASSOCIATE_SLOTS = 3
export const UNRELATED_SLOTS = SLOTS - ASSOCIATE_SLOTS
export const RESERVES = 2

export interface ListSlot {
  /** 0 to 6, the order of study. */
  slot: number
  list: StudyList
  recall: Recall
  /** For a delayed list: the three-digit number to count backward from, by 3s. */
  countFrom: number | null
}

export interface Part1Plan {
  seed: number
  slots: ListSlot[]
  /** The three lists of associates studied, and the three held back as controls. */
  studied: StudyList[]
  controls: StudyList[]
  /** The reserve unrelated lists, in the order a restart takes them; one pool for the whole part. */
  reserves: StudyList[]
}

export function recallSecondsFor(_list: StudyList): number {
  return RECALL_S
}

function shuffled<T>(items: T[], rng: Rng): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng.int(i + 1)
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** Three positions of seven, none first or last, no two adjacent: the slots the lists of associates take. */
export function associatePositions(rng: Rng): number[] {
  for (;;) {
    const picked = shuffled(Array.from({ length: SLOTS - 2 }, (_, i) => i + 1), rng).slice(0, ASSOCIATE_SLOTS).sort((a, b) => a - b)
    if (picked.every((p, i) => i === 0 || p - picked[i - 1] >= 2)) return picked
  }
}

export function planPart1(seed: number): Part1Plan {
  const rng = makeRng(seed ^ 0x1a7e)
  const pool = shuffled(UNRELATED, rng)
  const associates = shuffled(ASSOCIATE_LISTS, rng)
  const studied = associates.slice(0, ASSOCIATE_SLOTS)
  const controls = associates.slice(ASSOCIATE_SLOTS)
  // Four unrelated lists for the design, two immediate and two delayed, in a seeded order.
  const unrelated: { list: StudyList; recall: Recall }[] = shuffled(
    pool.slice(0, UNRELATED_SLOTS).map((list, i) => ({ list, recall: (i < UNRELATED_SLOTS / 2 ? 'immediate' : 'delayed') as Recall })),
    rng,
  )
  const positions = associatePositions(rng)
  const slots: ListSlot[] = []
  let u = 0
  let a = 0
  for (let s = 0; s < SLOTS; s++) {
    if (positions.includes(s)) {
      slots.push({ slot: s, list: studied[a++], recall: 'immediate', countFrom: null })
    } else {
      const { list, recall } = unrelated[u++]
      slots.push({ slot: s, list, recall, countFrom: recall === 'delayed' ? 200 + rng.int(800) : null })
    }
  }
  return { seed, slots, studied, controls, reserves: pool.slice(UNRELATED_SLOTS, UNRELATED_SLOTS + RESERVES) }
}

export interface SlotMaterials {
  list: StudyList
  recall: Recall
  countFrom: number | null
  /** A list of associates was interrupted and replaced by an unrelated reserve (§5.3). */
  lostAssociates: boolean
}

/**
 * The materials for a slot given how many reserves have already been
 * consumed by restarts, over the whole part (the progress layer counts
 * them): 0 is the slot's own list; 1 and 2 are the reserve lists. A slot
 * holding a list of associates has no reserve of its own kind and takes an
 * unrelated reserve instead, flagged `lostAssociates`. Beyond the reserves
 * there is nothing left, and the result is null.
 */
export function materialsFor(plan: Part1Plan, slot: number, reservesUsed: number): SlotMaterials | null {
  const s = plan.slots[slot]
  if (!s) throw new Error(`no slot ${slot}`)
  if (reservesUsed === 0) return { list: s.list, recall: s.recall, countFrom: s.countFrom, lostAssociates: false }
  if (reservesUsed > RESERVES) return null
  const reserve = plan.reserves[reservesUsed - 1]
  if (!reserve) return null
  return { list: reserve, recall: s.recall, countFrom: s.countFrom, lostAssociates: s.list.kind === 'associates' }
}

/** The next number in the counting task: `from` minus three for each right answer so far. */
export function nextCount(from: number, rightSoFar: number): number {
  return from - 3 * (rightSoFar + 1)
}

/** How far the wrong option stands from the right one: a slip of one or two, or of the tens digit. */
export const WRONG_OFFSETS = [-2, -1, 1, 2, -10, 10] as const

/**
 * One step of the counting task (Jon, 2026-10-27: two buttons instead of a
 * typed number, since typos made typing harder than the task should be):
 * the right next number and a wrong one near it, in a seeded left-right
 * order. `attempt` redraws the wrong option after a wrong click, so the
 * other button is not simply the right one.
 */
export function countChoice(from: number, rightSoFar: number, attempt: number): { right: number; options: [number, number] } {
  const right = nextCount(from, rightSoFar)
  const rng = makeRng((from * 1_000_003 + rightSoFar * 7919 + attempt * 104_729) >>> 0)
  const wrong = right + WRONG_OFFSETS[rng.int(WRONG_OFFSETS.length)]
  return { right, options: rng.int(2) === 0 ? [right, wrong] : [wrong, right] }
}
