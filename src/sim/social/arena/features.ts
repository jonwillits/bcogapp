import { DOOR_IDS, SIDES, type DoorId } from './doors'
import type { View } from './trial'

/**
 * The learner's inputs (spec §8.5): observable features of layout and
 * behavior for one piece, and nothing computed from line of sight. Which
 * position the piece is at, which positions have a barrier and of what
 * kind and on which side, which door the dominant uses, the dominant's door
 * state when the piece was placed and when it was moved, whether the
 * present dominant was there for those, whether a swap happened, and
 * whether the subordinate was released first.
 *
 * This file imports no geometry (`structure.test.ts`); the door and side
 * names come from a names-only module.
 */

export const FEATURE_NAMES: string[] = [
  ...Array.from({ length: 9 }, (_, i) => `at position ${i}`),
  ...SIDES.map((s) => `opaque barrier on its ${s} side`),
  ...SIDES.map((s) => `clear barrier on its ${s} side`),
  ...SIDES.map((s) => `the other piece has an opaque barrier on its ${s} side`),
  ...DOOR_IDS.map((d) => `the dominant’s door is ${d}`),
  'placed with the dominant’s door open',
  'placed with the dominant’s door at viewing',
  'placed with the dominant’s door shut',
  'the present dominant was there when it was placed',
  'placed first',
  'moved',
  'moved with the dominant’s door open',
  'moved with the dominant’s door at viewing',
  'moved with the dominant’s door shut',
  'the dominant was swapped',
  'the subordinate was released first',
]
export const N_FEATURES = FEATURE_NAMES.length

/** The feature vector for piece k of a view: ones and zeros, in `FEATURE_NAMES`' order. */
export function featuresOf(view: View, k: 0 | 1): number[] {
  const x: number[] = []
  const piece = view.pieces[k]
  const other = view.pieces[1 - k]
  for (let i = 0; i < 9; i++) x.push(piece.position === i ? 1 : 0)
  for (const s of SIDES) x.push(piece.barrier?.kind === 'opaque' && piece.barrier.side === s ? 1 : 0)
  for (const s of SIDES) x.push(piece.barrier?.kind === 'clear' && piece.barrier.side === s ? 1 : 0)
  for (const s of SIDES) x.push(other.barrier?.kind === 'opaque' && other.barrier.side === s ? 1 : 0)
  for (const d of DOOR_IDS) x.push(view.door === (d as DoorId) ? 1 : 0)
  const r = view.record[k]
  x.push(r.placedDoor === 'open' ? 1 : 0, r.placedDoor === 'viewing' ? 1 : 0, r.placedDoor === 'shut' ? 1 : 0)
  x.push(r.presentAtPlacement ? 1 : 0)
  x.push(r.placedOrder === 0 ? 1 : 0)
  x.push(r.moved ? 1 : 0)
  x.push(r.moved?.door === 'open' ? 1 : 0, r.moved?.door === 'viewing' ? 1 : 0, r.moved?.door === 'shut' ? 1 : 0)
  x.push(view.swapped ? 1 : 0)
  x.push(view.subordinateFirst ? 1 : 0)
  return x
}
