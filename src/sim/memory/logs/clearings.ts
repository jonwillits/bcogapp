import { makeRng, type Rng } from '../../random'
import { NEAR_LANDMARKS, footprint, type Footprint } from '../../rodent/range'

/**
 * The clearings of Part 4 (spec §8.2): four compact areas of Lab 9's range,
 * each around its own nest and out of sight of the others, each with ten
 * logs, seven with loose bark and three smooth, and three or four landmarks
 * of its own so that the clearings do not look alike. Clearings A, B and
 * the reserve share one geometry, turned and mirrored, so that blocks are
 * matched in difficulty; the practice clearing is Lab 9's nest with Lab
 * 9's landmarks and logs of its own. Geometry only; the scene draws it.
 */

export type LogKind = 'loose' | 'smooth'

export interface Log {
  /** 0 to 9 within its clearing. */
  id: number
  x: number
  y: number
  kind: LogKind
  /** The direction the log lies in, radians, for the drawing and the footprint. */
  angle: number
}

export type ClearingLandmarkKind = 'rock' | 'stump' | 'tree' | 'fern bank'

export interface ClearingLandmark {
  id: string
  kind: ClearingLandmarkKind
  x: number
  y: number
  size: number
}

export type ClearingId = 'practice' | 'A' | 'B' | 'reserve'

export interface Clearing {
  id: ClearingId
  /** The nest, in the range's coordinates. */
  nest: { x: number; y: number }
  logs: Log[]
  landmarks: ClearingLandmark[]
}

export const CLEARING = {
  /** Logs lie between these distances from the nest, meters. */
  minRadius: 4,
  maxRadius: 11,
  /** No two logs closer than this, meters. */
  logSpacing: 3,
  /** The forager is kept within this distance of the clearing's nest. */
  bound: 15,
  /** A log is dug from within this distance of its center. */
  reach: 1.1,
  /** The nest is reached within this distance: the rim of the hole, which is 0.35 m across (Jon, 2026-10-27: at 0.8 m the nursing began with the animal still outside it). */
  nestReach: 0.5,
  /** A log's length and the radius of its footprint, meters. */
  logLength: 1.3,
  logRadius: 0.22,
  loose: 7,
  smooth: 3,
} as const

/**
 * The root arched over the nest, as the view draws it: a half torus of
 * this radius and thickness, turned this far about the vertical, its feet
 * either side of the hole. It is solid (Jon, 2026-10-27: the animal walked
 * through it): its footprint is the segment between its feet.
 */
export const NEST_ARCH = { radius: 0.45, thickness: 0.1, turn: 0.4 } as const

export function nestFootprint(nest: { x: number; y: number }): Footprint {
  const hx = NEST_ARCH.radius * Math.cos(NEST_ARCH.turn)
  const hy = NEST_ARCH.radius * Math.sin(NEST_ARCH.turn)
  return { ax: nest.x - hx, ay: nest.y - hy, bx: nest.x + hx, by: nest.y + hy, r: NEST_ARCH.thickness }
}

/** Where the four clearings sit in the range: the practice clearing at Lab 9's nest; the others 24 m out, more than two moonlit view distances apart. */
export const CLEARING_NESTS: Record<ClearingId, { x: number; y: number }> = {
  practice: { x: 0, y: 0 },
  A: { x: 24, y: 10 },
  B: { x: -24, y: 10 },
  reserve: { x: 0, y: -26 },
}

/** The three matched clearings: the one geometry turned by a third of a turn each, with B mirrored. */
const PLACEMENT: Record<Exclude<ClearingId, 'practice'>, { turn: number; mirror: boolean }> = {
  A: { turn: 0, mirror: false },
  B: { turn: (2 * Math.PI) / 3, mirror: true },
  reserve: { turn: (4 * Math.PI) / 3, mirror: false },
}

interface LocalGeometry {
  logs: { x: number; y: number; kind: LogKind; angle: number }[]
  landmarks: { kind: ClearingLandmarkKind; x: number; y: number; size: number }[]
}

const LANDMARK_KINDS: ClearingLandmarkKind[] = ['rock', 'stump', 'tree', 'fern bank']
const LANDMARK_SIZE: Record<ClearingLandmarkKind, number> = { rock: 1.1, stump: 0.8, tree: 9, 'fern bank': 2.2 }

/** The footprint of a clearing landmark, for keeping logs and the body clear of it. */
export function landmarkFootprint(l: { kind: ClearingLandmarkKind; x: number; y: number; size: number }): Footprint {
  const r = l.kind === 'rock' ? l.size * 0.6 : l.kind === 'stump' ? 0.35 : l.kind === 'tree' ? 0.5 : l.size * 0.5
  return { ax: l.x, ay: l.y, bx: l.x, by: l.y, r }
}

export function logFootprint(l: { x: number; y: number; angle: number }): Footprint {
  const hx = (CLEARING.logLength / 2) * Math.cos(l.angle)
  const hy = (CLEARING.logLength / 2) * Math.sin(l.angle)
  return { ax: l.x - hx, ay: l.y - hy, bx: l.x + hx, by: l.y + hy, r: CLEARING.logRadius }
}

function distToFootprint(f: Footprint, x: number, y: number): number {
  const vx = f.bx - f.ax
  const vy = f.by - f.ay
  const L2 = vx * vx + vy * vy
  const t = L2 > 0 ? Math.max(0, Math.min(1, ((x - f.ax) * vx + (y - f.ay) * vy) / L2)) : 0
  const px = f.ax + t * vx
  const py = f.ay + t * vy
  return Math.sqrt((x - px) ** 2 + (y - py) ** 2) - f.r
}

/**
 * Draw one clearing's geometry about a nest at the origin: the landmarks
 * first (three or four, 3 to 8 m out, at least 4 m apart), then the logs,
 * each a few meters from the nest, at least `logSpacing` apart, and clear of
 * the landmarks and of any footprints handed in (the practice clearing
 * keeps clear of Lab 9's landmarks).
 */
function drawGeometry(rng: Rng, fixedLandmarks: ClearingLandmark[] = [], obstacles: Footprint[] = []): LocalGeometry {
  const landmarks: LocalGeometry['landmarks'] = []
  if (fixedLandmarks.length === 0) {
    const n = 3 + rng.int(2)
    const kinds = [...LANDMARK_KINDS]
    for (let i = kinds.length - 1; i > 0; i--) {
      const j = rng.int(i + 1)
      ;[kinds[i], kinds[j]] = [kinds[j], kinds[i]]
    }
    for (let k = 0; k < n; k++) {
      for (let tries = 0; tries < 60; tries++) {
        const r = rng.range(3, 8)
        const a = rng.range(0, 2 * Math.PI)
        const x = r * Math.cos(a)
        const y = r * Math.sin(a)
        if (landmarks.every((l) => Math.hypot(l.x - x, l.y - y) >= 4)) {
          landmarks.push({ kind: kinds[k], x, y, size: LANDMARK_SIZE[kinds[k]] })
          break
        }
      }
    }
  }
  const blockers: Footprint[] = [...obstacles, ...landmarks.map(landmarkFootprint), ...fixedLandmarks.map(landmarkFootprint)]
  const logs: LocalGeometry['logs'] = []
  const kinds: LogKind[] = [...Array<LogKind>(CLEARING.loose).fill('loose'), ...Array<LogKind>(CLEARING.smooth).fill('smooth')]
  for (let i = kinds.length - 1; i > 0; i--) {
    const j = rng.int(i + 1)
    ;[kinds[i], kinds[j]] = [kinds[j], kinds[i]]
  }
  for (let k = 0; k < kinds.length; k++) {
    let placed = false
    for (let tries = 0; tries < 400 && !placed; tries++) {
      const r = Math.sqrt(rng.range(CLEARING.minRadius ** 2, CLEARING.maxRadius ** 2))
      const a = rng.range(0, 2 * Math.PI)
      const x = r * Math.cos(a)
      const y = r * Math.sin(a)
      const angle = rng.range(0, Math.PI)
      if (logs.some((l) => Math.hypot(l.x - x, l.y - y) < CLEARING.logSpacing)) continue
      const f = logFootprint({ x, y, angle })
      if (blockers.some((b) => distToFootprint(b, x, y) < 1.2 || distToFootprint(b, f.ax, f.ay) < 0.8 || distToFootprint(b, f.bx, f.by) < 0.8)) continue
      logs.push({ x, y, kind: kinds[k], angle })
      placed = true
    }
    if (!placed) throw new Error('could not place a log')
  }
  return { logs, landmarks }
}

function place(id: ClearingId, g: LocalGeometry, nest: { x: number; y: number }, turn: number, mirror: boolean): Clearing {
  const c = Math.cos(turn)
  const s = Math.sin(turn)
  const map = (x: number, y: number) => {
    const mx = mirror ? -x : x
    return { x: nest.x + c * mx - s * y, y: nest.y + s * mx + c * y }
  }
  return {
    id,
    nest,
    logs: g.logs.map((l, i) => ({ id: i, ...map(l.x, l.y), kind: l.kind, angle: (mirror ? Math.PI - l.angle : l.angle) + turn })),
    landmarks: g.landmarks.map((l, i) => ({ id: `${id}-${l.kind}-${i}`, kind: l.kind, ...map(l.x, l.y), size: l.size })),
  }
}

/** All four clearings from the seed. */
export function makeClearings(seed: number): Record<ClearingId, Clearing> {
  const rng = makeRng(seed ^ 0x10c5)
  // The practice clearing keeps Lab 9's near landmarks (as drawn by RangeView) and places its logs clear of their footprints.
  const nine = NEAR_LANDMARKS.map((l) => footprint(l))
  const practice = drawGeometry(rng.fork(), [], nine)
  const shared = drawGeometry(rng.fork())
  return {
    practice: place('practice', practice, CLEARING_NESTS.practice, 0, false),
    A: place('A', shared, CLEARING_NESTS.A, PLACEMENT.A.turn, PLACEMENT.A.mirror),
    B: place('B', shared, CLEARING_NESTS.B, PLACEMENT.B.turn, PLACEMENT.B.mirror),
    reserve: place('reserve', shared, CLEARING_NESTS.reserve, PLACEMENT.reserve.turn, PLACEMENT.reserve.mirror),
  }
}

/** The footprints that stop the body in a clearing: its logs, its landmarks and the root over its nest (the practice clearing adds Lab 9's landmarks). */
export function clearingFootprints(c: Clearing): Footprint[] {
  const out: Footprint[] = [...c.logs.map(logFootprint), ...c.landmarks.map(landmarkFootprint), nestFootprint(c.nest)]
  if (c.id === 'practice') for (const l of NEAR_LANDMARKS) out.push(footprint(l))
  return out
}

/** Push a point of the given radius out of every footprint. */
export function pushOutOf(x: number, y: number, bodyRadius: number, prints: Footprint[]): { x: number; y: number } {
  for (const f of prints) {
    const vx = f.bx - f.ax
    const vy = f.by - f.ay
    const L2 = vx * vx + vy * vy
    const t = L2 > 0 ? Math.max(0, Math.min(1, ((x - f.ax) * vx + (y - f.ay) * vy) / L2)) : 0
    const px = f.ax + t * vx
    const py = f.ay + t * vy
    const d = Math.sqrt((x - px) ** 2 + (y - py) ** 2)
    const keep = f.r + bodyRadius
    if (d >= keep) continue
    if (d < 1e-6) {
      const L = Math.sqrt(L2)
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

/** The nearest log to a point within reach, or null. */
export function logInReach(c: Clearing, x: number, y: number): Log | null {
  let best: Log | null = null
  let bestD: number = CLEARING.reach
  for (const l of c.logs) {
    const d = distToFootprint(logFootprint(l), x, y) + CLEARING.logRadius
    if (d < bestD) {
      bestD = d
      best = l
    }
  }
  return best
}
