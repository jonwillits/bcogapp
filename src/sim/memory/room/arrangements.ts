import { makeRng } from '../../random'
import { FITTING, ITEMS, UNFITTING, itemById, type ItemKind, type RoomItem } from './items'

/**
 * The two arrangements (spec §7.2): they share the room and the furniture
 * and swap which fitting and unfitting items are present, so that each
 * item named on the checklist is present in one arrangement and absent in
 * the other. The seed assigns one; the other is the reserve for an
 * interrupted unit, and the swap balances item effects across students.
 */

export type Arrangement = 'A' | 'B'

const HALF = 6

/** The items present in an arrangement: A has the first six of each kind, B the second six. */
export function presentIn(arr: Arrangement): RoomItem[] {
  const pick = (xs: RoomItem[]) => (arr === 'A' ? xs.slice(0, HALF) : xs.slice(HALF))
  return [...pick(FITTING), ...pick(UNFITTING)]
}

export function isPresent(arr: Arrangement, id: string): boolean {
  return presentIn(arr).some((i) => i.id === id)
}

export function otherArrangement(arr: Arrangement): Arrangement {
  return arr === 'A' ? 'B' : 'A'
}

/** The arrangement the seed assigns, and the one a restart falls back to (materials slot 1). */
export function arrangementFor(seed: number, slot: number): Arrangement {
  const first: Arrangement = makeRng(seed ^ 0x300d).next() < 0.5 ? 'A' : 'B'
  return slot === 0 ? first : otherArrangement(first)
}

/** What a checklist item is, for one arrangement. */
export type ItemType = 'present-fitting' | 'present-unfitting' | 'absent-fitting' | 'absent-unfitting'

export function typeOf(arr: Arrangement, id: string): ItemType {
  const it = itemById(id)
  return `${isPresent(arr, id) ? 'present' : 'absent'}-${it.kind}` as ItemType
}

export const ITEM_TYPE_LABEL: Record<ItemType, string> = {
  'present-fitting': 'in the room, fits a dorm room',
  'present-unfitting': 'in the room, does not fit',
  'absent-fitting': 'not in the room, fits a dorm room',
  'absent-unfitting': 'not in the room, does not fit',
}

/** The checklist's order for a seed and an arrangement: all twenty-four items, shuffled by the seed, with no hint of type. */
export function checklistOrder(seed: number, arr: Arrangement): string[] {
  const rng = makeRng((seed ^ 0xc11) + (arr === 'A' ? 1 : 2))
  const ids = ITEMS.map((i) => i.id)
  for (let i = ids.length - 1; i > 0; i--) {
    const j = rng.int(i + 1)
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
  }
  return ids
}

export const CHECKLIST_LENGTH = ITEMS.length

export type { ItemKind }
