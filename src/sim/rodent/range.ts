import { rad } from './spatial/angles'

/**
 * The range (spec §5.1): the chapter's night forage, a stretch of forest
 * floor about 60 m across with the nest under a root at its center. Near
 * landmarks of the kinds §9.1.4 distinguishes stand within a few meters of
 * the nest; one tall tree gives a direction from anywhere; a stream bank
 * runs along the west edge. Geometry only; the scene draws it.
 */

export type Light = 'moonlight' | 'dark'

export interface RangeLandmark {
  id: string
  x: number
  y: number
  /** Drawn size, meters. */
  size: number
  kind: 'log' | 'rock' | 'stump' | 'tree'
  /** The tall tree: a direction from anywhere in moonlight, little about position. */
  distant?: boolean
}

export const RANGE = {
  /** The forager is kept within this radius of the nest. */
  radius: 30,
  /** Near landmarks are seen within this distance in moonlight. */
  nearView: 10,
  /** In the dark nothing but the ground texture within this distance. */
  darkView: 2,
  nest: { x: 0, y: 0 },
  streamBankX: -27,
  /** A beetle is taken within this distance. */
  beetleReach: 0.6,
  /** The nest is reached within this distance. */
  nestReach: 0.8,
}

/** The near landmarks around the nest, each recognizably different, and the tall tree. */
export const LANDMARKS: RangeLandmark[] = [
  { id: 'fallen log', x: 4.5, y: 2.5, size: 3.0, kind: 'log' },
  { id: 'large rock', x: -3.5, y: 4.0, size: 1.2, kind: 'rock' },
  { id: 'split rock', x: 3.0, y: -4.5, size: 1.0, kind: 'rock' },
  { id: 'stump', x: -4.0, y: -3.0, size: 0.8, kind: 'stump' },
  { id: 'tall tree', x: 0, y: 45, size: 14, kind: 'tree', distant: true },
]

export const NEAR_LANDMARKS = LANDMARKS.filter((l) => !l.distant)
export const TALL_TREE = LANDMARKS.find((l) => l.distant)!

/** Which landmarks can be seen from a point, in a light level, with the tall tree possibly hidden by cloud. */
export function visibleLandmarks(x: number, y: number, light: Light, treeHidden = false, moved?: Map<string, { x: number; y: number }>): RangeLandmark[] {
  if (light === 'dark') return []
  return LANDMARKS.filter((l) => {
    if (l.distant) return !treeHidden
    const p = moved?.get(l.id) ?? l
    return Math.hypot(p.x - x, p.y - y) <= RANGE.nearView
  }).map((l) => (moved?.has(l.id) ? { ...l, ...moved.get(l.id)! } : l))
}

/** Rotate the near landmarks together about a point by an angle (Step 5's move). */
export function rotateNearLandmarks(about: { x: number; y: number }, angle: number): Map<string, { x: number; y: number }> {
  const out = new Map<string, { x: number; y: number }>()
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  for (const l of NEAR_LANDMARKS) {
    const dx = l.x - about.x
    const dy = l.y - about.y
    out.set(l.id, { x: about.x + c * dx - s * dy, y: about.y + s * dx + c * dy })
  }
  return out
}

/** Where the nest would be if the landmarks had not moved: the nest rotated the same way about the same point. */
export function impliedNest(about: { x: number; y: number }, angle: number): { x: number; y: number } {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  const dx = RANGE.nest.x - about.x
  const dy = RANGE.nest.y - about.y
  return { x: about.x + c * dx - s * dy, y: about.y + s * dx + c * dy }
}

export const SMALL_MOVE = rad(15)
export const LARGE_MOVE = rad(60)
