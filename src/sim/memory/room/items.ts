/**
 * Part 3's room (spec §7, Jon's answer 3 of 2026-10-25): a student's dorm
 * room, with things that fit it and things that do not. Twenty-four
 * checklist items, twelve fitting and twelve not, each present in exactly
 * one of two arrangements (`arrangements.ts`); and the furniture, always
 * present and never on the checklist. Every model is a CC0 kit piece
 * credited in `public/m10/room/NOTICE`. No person, face or photograph of a
 * person anywhere in the room (no poster).
 *
 * Jon reviewed the item list on the walk (2026-10-27): *a stack of
 * textbooks* became *textbooks*, since the model's books stand on their
 * sides and a stack says a pile; and the fire extinguisher, which some
 * dorm rooms do have, became a hay bale.
 */

export type ItemKind = 'fitting' | 'unfitting'

export interface RoomItem {
  /** The model's id in the manifest, and the item's key everywhere. */
  id: string
  /** The name on the checklist, with no hint of its kind. */
  name: string
  kind: ItemKind
}

/** The fitting items, in the order that splits them between the arrangements: 1 to 6 in A, 7 to 12 in B. */
export const FITTING: RoomItem[] = [
  { id: 'desk-lamp', name: 'a desk lamp', kind: 'fitting' },
  { id: 'mini-fridge', name: 'a mini fridge', kind: 'fitting' },
  { id: 'coffee-mug', name: 'a coffee mug', kind: 'fitting' },
  { id: 'water-bottle', name: 'a water bottle', kind: 'fitting' },
  { id: 'textbooks', name: 'textbooks', kind: 'fitting' },
  { id: 'trash-can', name: 'a trash can', kind: 'fitting' },
  { id: 'potted-plant', name: 'a potted plant', kind: 'fitting' },
  { id: 'speaker', name: 'a speaker', kind: 'fitting' },
  { id: 'pizza-box', name: 'a pizza box', kind: 'fitting' },
  { id: 'microwave', name: 'a microwave', kind: 'fitting' },
  { id: 'monitor', name: 'a computer monitor', kind: 'fitting' },
  { id: 'toaster', name: 'a toaster', kind: 'fitting' },
]

/** The unfitting items, split the same way. */
export const UNFITTING: RoomItem[] = [
  { id: 'hay-bale', name: 'a hay bale', kind: 'unfitting' },
  { id: 'garden-trowel', name: 'a garden trowel', kind: 'unfitting' },
  { id: 'axe', name: 'an axe', kind: 'unfitting' },
  { id: 'candelabra', name: 'a candelabra', kind: 'unfitting' },
  { id: 'lantern', name: 'a lantern', kind: 'unfitting' },
  { id: 'anvil', name: 'an anvil', kind: 'unfitting' },
  { id: 'pickaxe', name: 'a pickaxe', kind: 'unfitting' },
  { id: 'sled', name: 'a sled', kind: 'unfitting' },
  { id: 'urn', name: 'an urn', kind: 'unfitting' },
  { id: 'hoe', name: 'a hoe', kind: 'unfitting' },
  { id: 'frying-pan', name: 'a frying pan', kind: 'unfitting' },
  { id: 'bucket', name: 'a bucket', kind: 'unfitting' },
]

export const ITEMS: RoomItem[] = [...FITTING, ...UNFITTING]

export const itemById = (id: string): RoomItem => {
  const it = ITEMS.find((i) => i.id === id)
  if (!it) throw new Error(`no room item ${id}`)
  return it
}

/** The furniture, always present and never asked about. */
export const FURNITURE = ['bed', 'bed-pillow', 'desk', 'desk-chair', 'bookshelf', 'wardrobe', 'window-wall', 'door', 'rug', 'nightstand', 'ceiling-fan'] as const
export type Furniture = (typeof FURNITURE)[number]

/** The words the room puts on screen before the reveal, for the exclusion test against Parts 1 and 2: the item names and the furniture. */
export const ROOM_NAMES: string[] = [...ITEMS.map((i) => i.name.replace(/^an? /, '')), 'bed', 'pillow', 'desk', 'chair', 'bookshelf', 'wardrobe', 'window', 'door', 'rug', 'nightstand', 'ceiling fan']
