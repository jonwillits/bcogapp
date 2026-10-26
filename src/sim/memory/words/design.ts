import { makeRng, type Rng } from '../../random'
import { ASSOCIATE_LISTS, LONG_LENGTH, SHORT_LENGTH, UNRELATED_LONG, UNRELATED_SHORT, type StudyList } from './lists'

/**
 * Part 1's design (spec §5.1, with Jon's answer 5 of 2026-10-25): eleven
 * study lists in an order the seed fixes. Eight unrelated lists, four
 * short and four long, and within each length two recalled at once and
 * two after the delay; three lists of associates, all recalled at once,
 * never first or last, and separated from one another by at least one
 * unrelated list. Of the six lists of associates the seed studies three
 * and holds three as controls for the recognition test.
 */

export type Recall = 'immediate' | 'delayed'

/** A word is shown for this long, then a blank, then the next (§5.1; Roediger and McDermott's 1.5-s rate). */
export const WORD_ON_S = 1.5
export const BLANK_S = 0.3
/** Counting backward by 3s, typed one number at a time, each checked. */
export const DELAY_S = 30
export const RECALL_S_SHORT = 45
export const RECALL_S_LONG = 60
export const RECALL_S_ASSOCIATES = 60

export const SLOTS = 11
export const ASSOCIATE_SLOTS = 3
export const RESERVES_PER_LENGTH = 2

export interface ListSlot {
  /** 0 to 10, the order of study. */
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
  /** The reserve unrelated lists of each length, in the order a restart takes them. */
  reserves: { short: StudyList[]; long: StudyList[] }
}

export function recallSecondsFor(list: StudyList): number {
  if (list.kind === 'associates') return RECALL_S_ASSOCIATES
  return list.words.length <= SHORT_LENGTH ? RECALL_S_SHORT : RECALL_S_LONG
}

function shuffled<T>(items: T[], rng: Rng): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng.int(i + 1)
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** Three positions of eleven, none first or last, no two adjacent: the slots the lists of associates take. */
export function associatePositions(rng: Rng): number[] {
  for (;;) {
    const picked = shuffled(Array.from({ length: SLOTS - 2 }, (_, i) => i + 1), rng).slice(0, ASSOCIATE_SLOTS).sort((a, b) => a - b)
    if (picked.every((p, i) => i === 0 || p - picked[i - 1] >= 2)) return picked
  }
}

export function planPart1(seed: number): Part1Plan {
  const rng = makeRng(seed ^ 0x1a7e)
  const shorts = shuffled(UNRELATED_SHORT, rng)
  const longs = shuffled(UNRELATED_LONG, rng)
  const associates = shuffled(ASSOCIATE_LISTS, rng)
  const studied = associates.slice(0, ASSOCIATE_SLOTS)
  const controls = associates.slice(ASSOCIATE_SLOTS)
  // Four of each length for the design; within each length two immediate and two delayed, in a seeded order.
  const unrelated: { list: StudyList; recall: Recall }[] = shuffled(
    [
      ...shorts.slice(0, 4).map((list, i) => ({ list, recall: (i < 2 ? 'immediate' : 'delayed') as Recall })),
      ...longs.slice(0, 4).map((list, i) => ({ list, recall: (i < 2 ? 'immediate' : 'delayed') as Recall })),
    ],
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
  return { seed, slots, studied, controls, reserves: { short: shorts.slice(4, 6), long: longs.slice(4, 6) } }
}

export interface SlotMaterials {
  list: StudyList
  recall: Recall
  countFrom: number | null
  /** A list of associates was interrupted and replaced by an unrelated reserve (§5.3). */
  lostAssociates: boolean
}

/**
 * The materials for a slot given how many reserves of that slot's length
 * have already been consumed by restarts, over the whole part (the
 * progress layer counts them): 0 is the slot's own list; 1 and 2 are the
 * reserve lists of its length. A slot holding a list of associates has no
 * reserve of its own kind and takes a short unrelated reserve instead,
 * flagged `lostAssociates`. Beyond the reserves there is nothing left, and
 * the result is null.
 */
export function materialsFor(plan: Part1Plan, slot: number, reservesUsed: number): SlotMaterials | null {
  const s = plan.slots[slot]
  if (!s) throw new Error(`no slot ${slot}`)
  if (reservesUsed === 0) return { list: s.list, recall: s.recall, countFrom: s.countFrom, lostAssociates: false }
  if (reservesUsed > RESERVES_PER_LENGTH) return null
  const long = s.list.kind === 'unrelated' && s.list.words.length === LONG_LENGTH
  const reserve = (long ? plan.reserves.long : plan.reserves.short)[reservesUsed - 1]
  if (!reserve) return null
  return { list: reserve, recall: s.recall, countFrom: s.countFrom, lostAssociates: s.list.kind === 'associates' }
}

/** Which reserve pool a slot draws from, for the progress layer's count. */
export function reservePoolOf(plan: Part1Plan, slot: number): 'short' | 'long' {
  const s = plan.slots[slot]
  return s.list.kind === 'unrelated' && s.list.words.length === LONG_LENGTH ? 'long' : 'short'
}

/** The next number in the counting task, or whether a typed one is right. */
export function nextCount(from: number, typedSoFar: number): number {
  return from - 3 * (typedSoFar + 1)
}

export function countIsRight(from: number, typedSoFar: number, typed: string): boolean {
  const n = Number.parseInt(typed.trim(), 10)
  return Number.isFinite(n) && n === nextCount(from, typedSoFar)
}
