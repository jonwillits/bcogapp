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

/**
 * A landmark's footprint on the ground, for the body to be stopped by and
 * for beetles to be kept clear of: a disk for a rock, a stump or the
 * tree's trunk, and a segment with a radius for the log, which lies along
 * the direction the scene draws it (0.5 rad). The sizes are the drawn ones.
 */
export interface Footprint {
  ax: number
  ay: number
  bx: number
  by: number
  r: number
}

const LOG_ANGLE = 0.5

export function footprint(l: RangeLandmark, at: { x: number; y: number } = l): Footprint {
  if (l.kind === 'log') {
    const hx = (l.size / 2) * Math.cos(LOG_ANGLE)
    const hy = (l.size / 2) * Math.sin(LOG_ANGLE)
    return { ax: at.x - hx, ay: at.y - hy, bx: at.x + hx, by: at.y + hy, r: 0.26 }
  }
  const r = l.kind === 'rock' ? l.size * 0.6 : l.kind === 'stump' ? 0.35 : 0.6
  return { ax: at.x, ay: at.y, bx: at.x, by: at.y, r }
}

/** The nearest point on a footprint's axis to (x, y), and the distance to it. */
function nearestOnAxis(f: Footprint, x: number, y: number): { px: number; py: number; d: number } {
  const vx = f.bx - f.ax
  const vy = f.by - f.ay
  const L2 = vx * vx + vy * vy
  const t = L2 > 0 ? Math.max(0, Math.min(1, ((x - f.ax) * vx + (y - f.ay) * vy) / L2)) : 0
  const px = f.ax + t * vx
  const py = f.ay + t * vy
  return { px, py, d: Math.hypot(x - px, y - py) }
}

/**
 * Push a body of the given radius out of every landmark's footprint (the
 * near landmarks where the moved map puts them, and the tree). Returns the
 * position to stand at: the same one when nothing is in the way.
 */
export function pushOut(x: number, y: number, bodyRadius: number, moved?: Map<string, { x: number; y: number }> | null): { x: number; y: number } {
  for (const l of LANDMARKS) {
    const f = footprint(l, moved?.get(l.id) ?? l)
    const { px, py, d } = nearestOnAxis(f, x, y)
    const keep = f.r + bodyRadius
    if (d >= keep) continue
    if (d < 1e-6) {
      // Standing on the axis: step off it sideways.
      const vx = f.bx - f.ax
      const vy = f.by - f.ay
      const L = Math.hypot(vx, vy)
      const nx = L > 0 ? -vy / L : 1
      const ny = L > 0 ? vx / L : 0
      x = px + nx * keep
      y = py + ny * keep
    } else {
      x = px + ((x - px) / d) * keep
      y = py + ((y - py) / d) * keep
    }
  }
  return { x, y }
}

/** Whether the straight walk from a to b, and the point b itself, keep this clearance beyond every near landmark's footprint. */
export function walkIsClear(ax: number, ay: number, bx: number, by: number, clearance: number): boolean {
  const steps = Math.max(2, Math.ceil(Math.hypot(bx - ax, by - ay) / 0.25))
  for (const l of NEAR_LANDMARKS) {
    const f = footprint(l)
    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      if (nearestOnAxis(f, ax + t * (bx - ax), ay + t * (by - ay)).d < f.r + clearance) return false
    }
  }
  return true
}
