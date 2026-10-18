import { circle, morph, rect } from './shape'
import type { Room } from './body'

/**
 * The recording boxes of Part 3 (spec §9), and the laboratory rooms Part 2
 * draws its apparatus in (§5.2). Landmark positions are relative to the
 * room's center; a card sits flush against its wall.
 */

/** Step 1's box: 1 m square, gray walls, a white card on the north (+y) wall. */
export const BOX_A: Room = {
  id: 'box-a',
  shape: rect(1, 1),
  wallColor: 'gray',
  floorColor: 'dark',
  landmarks: [{ id: 'white card', x: 0, y: 0.5, color: '#f2f2f2' }],
}

/** Step 4's second room: round, 1.1 m across, blue walls, a black card on the east (+x) wall. */
export const BOX_B: Room = {
  id: 'box-b',
  shape: circle(1.1),
  wallColor: 'blue',
  floorColor: 'pale',
  landmarks: [{ id: 'black card', x: 0.55, y: 0, color: '#111111' }],
}

/** The first box lengthened by half along x (§9.4, stretch the box). */
export const BOX_A_STRETCHED: Room = {
  ...BOX_A,
  id: 'box-a-stretched',
  shape: rect(1.5, 1),
  landmarks: [{ id: 'white card', x: 0, y: 0.5, color: '#f2f2f2' }],
}

/** The first box shortened by a quarter along x, for the grid test of §9.3.3. */
export const BOX_A_SHORT: Room = {
  ...BOX_A,
  id: 'box-a-short',
  shape: rect(0.75, 1),
  landmarks: [{ id: 'white card', x: 0, y: 0.5, color: '#f2f2f2' }],
}

/** Six boxes from a square to a circle (§9.3.5), the square first, with the square's colors and card. */
export const MORPH_BOXES: Room[] = [0, 0.2, 0.4, 0.6, 0.8, 1].map((r, i) => ({
  id: `morph-${i + 1}`,
  shape: morph(1, r),
  wallColor: 'gray',
  floorColor: 'dark',
  landmarks: [{ id: 'white card', x: 0, y: 0.5 * (1 - r) + 0.5 * r, color: '#f2f2f2' }],
}))

/** A round box with the square's card, the circle end of the morph when learned as its own room. */
export const BOX_CIRCLE: Room = MORPH_BOXES[5]

/** Every landmark id a Part 3 session's rings may need view units for. */
export const RECORDING_LANDMARKS = ['white card', 'black card']
