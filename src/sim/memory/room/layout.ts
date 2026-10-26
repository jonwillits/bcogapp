import { FURNITURE, type Furniture } from './items'

/**
 * Where everything stands in the room (spec §7.1): a plain dorm room about
 * 4 m by 3.5 m with a 2.6 m ceiling, x across (west to east), z deep
 * (north to south), y up, the origin at the middle of the floor. The
 * furniture is fixed. Each checklist item has one place for when it is
 * present; two items of different arrangements may share a place. Every
 * model is scaled to a target real size from its own bounding box
 * (`training/m10/room/sizes.json`), so kit units are never trusted, and
 * the middle of its footprint stands at its place (Kenney's furniture has
 * its origin at a corner).
 */

export const ROOM = { width: 4, depth: 3.5, height: 2.6 } as const

export interface Place {
  x: number
  y: number
  z: number
  /** Rotation about y, radians. */
  turn: number
  /** The target real height, meters; the model is scaled uniformly to it. */
  height: number
}

/** The top of the bed's mattress, below the headboard's 0.55 m: where things on the bed stand. */
export const MATTRESS_TOP = 0.34

/** The furniture's places and sizes. */
export const FURNITURE_PLACES: Record<Furniture, Place> = {
  bed: { x: -1.5, y: 0, z: -0.55, turn: 0, height: 0.55 },
  'bed-pillow': { x: -1.5, y: MATTRESS_TOP, z: -1.2, turn: 0, height: 0.14 },
  desk: { x: 0.8, y: 0, z: -1.37, turn: 0, height: 0.75 },
  'desk-chair': { x: 0.8, y: 0, z: -0.85, turn: Math.PI, height: 0.95 },
  bookshelf: { x: 1.74, y: 0, z: -0.55, turn: -Math.PI / 2, height: 1.8 },
  wardrobe: { x: 1.71, y: 0, z: 0.7, turn: -Math.PI / 2, height: 1.95 },
  'window-wall': { x: 0.8, y: 0, z: -1.75, turn: 0, height: ROOM.height },
  door: { x: -0.7, y: 0, z: 1.72, turn: Math.PI, height: 2.05 },
  rug: { x: 0.1, y: 0.005, z: 0.45, turn: 0, height: 0.02 },
  nightstand: { x: -0.75, y: 0, z: -1.5, turn: 0, height: 0.5 },
  'ceiling-fan': { x: 0.1, y: ROOM.height - 0.02, z: 0.2, turn: 0, height: 0.3 },
}

/** The items' places when present: kept apart so that the camera sees each, and off the furniture only where nothing else stands. */
export const ITEM_PLACES: Record<string, Place> = {
  // fitting, arrangement A
  'desk-lamp': { x: 0.3, y: 0.75, z: -1.55, turn: 0.3, height: 0.42 },
  'mini-fridge': { x: 1.5, y: 0, z: 1.42, turn: -0.2, height: 0.85 },
  'coffee-mug': { x: 1.2, y: 0.75, z: -1.35, turn: 0, height: 0.1 },
  'water-bottle': { x: -0.85, y: 0.5, z: -1.5, turn: 0, height: 0.25 },
  textbooks: { x: 0.75, y: 0.75, z: -1.55, turn: 0.1, height: 0.22 },
  'trash-can': { x: 1.72, y: 0, z: -1.3, turn: 0, height: 0.35 },
  // fitting, arrangement B
  'potted-plant': { x: -0.15, y: 0, z: -1.45, turn: 0, height: 0.7 },
  speaker: { x: 1.45, y: 0, z: 0.1, turn: -0.5, height: 0.6 },
  'pizza-box': { x: -0.85, y: 0, z: 0.75, turn: 0.4, height: 0.3 },
  microwave: { x: -0.75, y: 0.5, z: -1.5, turn: 0, height: 0.28 },
  monitor: { x: 0.8, y: 0.75, z: -1.6, turn: 0, height: 0.45 },
  toaster: { x: 1.25, y: 0.75, z: -1.4, turn: 0.2, height: 0.2 },
  // unfitting, arrangement A
  'fire-extinguisher': { x: -1.5, y: MATTRESS_TOP, z: -0.3, turn: 0.6, height: 0.5 },
  'garden-trowel': { x: 0.5, y: 0.02, z: 0.5, turn: 0.8, height: 0.08 },
  axe: { x: -1.1, y: 0, z: 1.45, turn: 0.2, height: 0.7 },
  candelabra: { x: 1.5, y: 0.85, z: 1.42, turn: -0.2, height: 0.3 },
  lantern: { x: 1.3, y: 0, z: 0.45, turn: 0, height: 0.4 },
  anvil: { x: 0.1, y: 0.02, z: 0.6, turn: 0.3, height: 0.3 },
  // unfitting, arrangement B
  pickaxe: { x: -1.1, y: 0, z: 1.45, turn: 0.2, height: 0.7 },
  sled: { x: 0.1, y: 0.02, z: 0.55, turn: 0.3, height: 0.3 },
  urn: { x: 1.3, y: 0, z: -0.3, turn: 0, height: 0.4 },
  hoe: { x: 1.2, y: 0, z: 0.45, turn: 0, height: 1.0 },
  'frying-pan': { x: -1.5, y: MATTRESS_TOP, z: -0.3, turn: 0.6, height: 0.08 },
  bucket: { x: 1.72, y: 0, z: -1.3, turn: 0, height: 0.3 },
}

/** The room's middle, at the height the camera looks toward. */
export const LOOK_AT_HEIGHT = 0.9

/** A rough radius for an item's bounding sphere from its target height (items are about as wide as they are tall, at most). */
export function sphereRadius(height: number): number {
  return Math.max(0.1, height * 0.7)
}

/** The center of an item's bounding sphere: its place lifted by half its height. */
export function sphereCenter(p: Place): [number, number, number] {
  return [p.x, p.y + p.height / 2, p.z]
}

export const furnitureIds: Furniture[] = [...FURNITURE]
