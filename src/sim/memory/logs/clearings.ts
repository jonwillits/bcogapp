import { makeRng, type Rng } from '../../random'
import { NEAR_LANDMARKS, footprint, type Footprint } from '../../rodent/range'

/**
 * The clearings of Part 4 (spec §8.2, revised 2026-10-27): three compact
 * areas of Lab 9's range, each around its own nest and out of sight of the
 * others, each with ten logs, seven with loose bark and three smooth, and
 * three or four landmarks of its own. The **week's clearing** and the
 * **reserve** (where an interrupted week restarts) share one geometry,
 * turned and mirrored; the **practice clearing** is Lab 9's nest with Lab
 * 9's landmarks and logs of its own. **Each log looks different from every
 * other** in its clearing, in ways easy to see and hard to name: its
 * length, thickness, the number and angle of its branch stubs, how much
 * moss covers it, and the shade of its bark within its kind (`LogLook`).
 * No object sits on a log. A look is fixed for the week and carries nothing
 * about beetles beyond the kind of bark. Geometry only; the scene draws it.
 */

export type LogKind = 'loose' | 'smooth'

/**
 * How a log looks, apart from its kind and its place: five things a student
 * can see from a few meters and would be slow to put into words. Each is
 * drawn by the seed; `lookDistance` keeps every pair in a clearing at least
 * `LOOK_MIN_DISTANCE` apart. The length also sets the footprint.
 */
export interface LogLook {
  /** Meters, within LOOK.length. */
  length: number
  /** Meters, within LOOK.radius. */
  radius: number
  /** Branch stubs: where along the log (−0.5 to 0.5 of its length), which way round (radians), how long (meters). */
  stubs: { along: number; around: number; length: number }[]
  /** Moss cover, 0 (none) to 1 (most of the upper side). */
  moss: number
  /** The bark's shade within its kind, −1 (darkest) to 1 (palest). */
  tint: number
}

export const LOOK = {
  length: [1.0, 1.7] as const,
  radius: [0.16, 0.28] as const,
  maxStubs: 3,
  stubLength: [0.18, 0.4] as const,
} as const

/** The smallest distance between two looks' descriptors in one clearing (each descriptor a unit square's edge; see `lookDescriptor`). */
export const LOOK_MIN_DISTANCE = 0.75

/** A look as five numbers in 0 to 1: length, thickness, stubs, moss, shade. */
export function lookDescriptor(k: LogLook): number[] {
  const u = (v: number, [a, b]: readonly [number, number]) => (v - a) / (b - a)
  return [u(k.length, LOOK.length), u(k.radius, LOOK.radius), k.stubs.length / LOOK.maxStubs, k.moss, (k.tint + 1) / 2]
}

export function lookDistance(a: LogLook, b: LogLook): number {
  const da = lookDescriptor(a)
  const db = lookDescriptor(b)
  return Math.sqrt(da.reduce((acc, v, i) => acc + (v - db[i]) ** 2, 0))
}

function drawLook(rng: Rng): LogLook {
  const n = rng.int(LOOK.maxStubs + 1)
  const stubs = Array.from({ length: n }, () => ({ along: rng.range(-0.42, 0.42), around: rng.range(0.4, Math.PI - 0.4), length: rng.range(LOOK.stubLength[0], LOOK.stubLength[1]) }))
  return { length: rng.range(LOOK.length[0], LOOK.length[1]), radius: rng.range(LOOK.radius[0], LOOK.radius[1]), stubs, moss: rng.next() < 0.3 ? 0 : rng.range(0.15, 1), tint: rng.range(-1, 1) }
}

/** Ten looks, every pair at least LOOK_MIN_DISTANCE apart: each new look is drawn until it clears the ones before it. */
export function drawLooks(rng: Rng, n: number): LogLook[] {
  const out: LogLook[] = []
  while (out.length < n) {
    let k = drawLook(rng)
    for (let tries = 0; tries < 400 && out.some((o) => lookDistance(o, k) < LOOK_MIN_DISTANCE); tries++) k = drawLook(rng)
    if (out.some((o) => lookDistance(o, k) < LOOK_MIN_DISTANCE)) throw new Error('could not draw a distinct look')
    out.push(k)
  }
  return out
}

export interface Log {
  /** 0 to 9 within its clearing. */
  id: number
  x: number
  y: number
  kind: LogKind
  /** The direction the log lies in, radians, for the drawing and the footprint. */
  angle: number
  look: LogLook
}

export type ClearingLandmarkKind = 'rock' | 'stump' | 'tree' | 'fern bank'

export interface ClearingLandmark {
  id: string
  kind: ClearingLandmarkKind
  x: number
  y: number
  size: number
}

export type ClearingId = 'practice' | 'week' | 'reserve'

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
  /** The radius a log's footprint is kept at whatever its drawn thickness, meters; its length is its look's. */
  logRadius: 0.22,
  loose: 7,
  smooth: 3,
} as const

/**
 * The root arched over the nest, as the view draws it: a half torus of
 * this radius and thickness, turned this far about the vertical, its feet
 * either side of the hole. Its feet are solid (Jon, 2026-10-27: the animal
 * walked through the root; a first fix made the whole span solid, which
 * stopped the animal under open air and made the nest hard to leave): the
 * footprints are the two feet, and the arch is open underneath, where it
 * stands well above the animal.
 */
export const NEST_ARCH = { radius: 0.45, thickness: 0.1, turn: 0.4 } as const

export function nestFootprints(nest: { x: number; y: number }): Footprint[] {
  const hx = NEST_ARCH.radius * Math.cos(NEST_ARCH.turn)
  const hy = NEST_ARCH.radius * Math.sin(NEST_ARCH.turn)
  return [
    { ax: nest.x - hx, ay: nest.y - hy, bx: nest.x - hx, by: nest.y - hy, r: NEST_ARCH.thickness },
    { ax: nest.x + hx, ay: nest.y + hy, bx: nest.x + hx, by: nest.y + hy, r: NEST_ARCH.thickness },
  ]
}

/**
 * The thing on the ground some nights (`features.ts`) lies this far from
 * the nest; the fallen branch is this long, lies turned this far from the
 * x axis, and is this thick. The view draws it from these; the branch is
 * the one thing on the ground with a footprint (Jon, 2026-10-27: he walked
 * through it, when it also stood on end by a drawing slip).
 */
export const GROUND_THING_OFFSET = { x: 2.2, y: -1.6 } as const
export const BRANCH = { length: 2.6, turn: 0.9, radius: 0.08 } as const

export function branchFootprint(nest: { x: number; y: number }): Footprint {
  const cx = nest.x + GROUND_THING_OFFSET.x
  const cy = nest.y + GROUND_THING_OFFSET.y
  const hx = (BRANCH.length / 2) * Math.cos(BRANCH.turn)
  const hy = (BRANCH.length / 2) * Math.sin(BRANCH.turn)
  return { ax: cx - hx, ay: cy - hy, bx: cx + hx, by: cy + hy, r: BRANCH.radius }
}

/** Where the three clearings sit in the range: the practice clearing at Lab 9's nest; the others 24 m or more out, more than two moonlit view distances apart. */
export const CLEARING_NESTS: Record<ClearingId, { x: number; y: number }> = {
  practice: { x: 0, y: 0 },
  week: { x: 24, y: 10 },
  reserve: { x: 0, y: -26 },
}

/** The two matched clearings: the one geometry, the reserve turned by a third of a turn and mirrored. */
const PLACEMENT: Record<Exclude<ClearingId, 'practice'>, { turn: number; mirror: boolean }> = {
  week: { turn: 0, mirror: false },
  reserve: { turn: (2 * Math.PI) / 3, mirror: true },
}

interface LocalGeometry {
  logs: { x: number; y: number; kind: LogKind; angle: number; look: LogLook }[]
  landmarks: { kind: ClearingLandmarkKind; x: number; y: number; size: number }[]
}

const LANDMARK_KINDS: ClearingLandmarkKind[] = ['rock', 'stump', 'tree', 'fern bank']
const LANDMARK_SIZE: Record<ClearingLandmarkKind, number> = { rock: 1.1, stump: 0.8, tree: 9, 'fern bank': 2.2 }

/** The footprint of a clearing landmark, for keeping logs and the body clear of it. */
export function landmarkFootprint(l: { kind: ClearingLandmarkKind; x: number; y: number; size: number }): Footprint {
  const r = l.kind === 'rock' ? l.size * 0.6 : l.kind === 'stump' ? 0.35 : l.kind === 'tree' ? 0.5 : l.size * 0.5
  return { ax: l.x, ay: l.y, bx: l.x, by: l.y, r }
}

export function logFootprint(l: { x: number; y: number; angle: number; look: LogLook }): Footprint {
  const hx = (l.look.length / 2) * Math.cos(l.angle)
  const hy = (l.look.length / 2) * Math.sin(l.angle)
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
  const looks = drawLooks(rng, kinds.length)
  for (let k = 0; k < kinds.length; k++) {
    let placed = false
    for (let tries = 0; tries < 400 && !placed; tries++) {
      const r = Math.sqrt(rng.range(CLEARING.minRadius ** 2, CLEARING.maxRadius ** 2))
      const a = rng.range(0, 2 * Math.PI)
      const x = r * Math.cos(a)
      const y = r * Math.sin(a)
      const angle = rng.range(0, Math.PI)
      if (logs.some((l) => Math.hypot(l.x - x, l.y - y) < CLEARING.logSpacing)) continue
      const f = logFootprint({ x, y, angle, look: looks[k] })
      if (blockers.some((b) => distToFootprint(b, x, y) < 1.2 || distToFootprint(b, f.ax, f.ay) < 0.8 || distToFootprint(b, f.bx, f.by) < 0.8)) continue
      logs.push({ x, y, kind: kinds[k], angle, look: looks[k] })
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
    logs: g.logs.map((l, i) => ({ id: i, ...map(l.x, l.y), kind: l.kind, angle: (mirror ? Math.PI - l.angle : l.angle) + turn, look: l.look })),
    landmarks: g.landmarks.map((l, i) => ({ id: `${id}-${l.kind}-${i}`, kind: l.kind, ...map(l.x, l.y), size: l.size })),
  }
}

/** All three clearings from the seed. */
export function makeClearings(seed: number): Record<ClearingId, Clearing> {
  const rng = makeRng(seed ^ 0x10c5)
  // The practice clearing keeps Lab 9's near landmarks (as drawn by RangeView) and places its logs clear of their footprints.
  const nine = NEAR_LANDMARKS.map((l) => footprint(l))
  const practice = drawGeometry(rng.fork(), [], nine)
  const shared = drawGeometry(rng.fork())
  return {
    practice: place('practice', practice, CLEARING_NESTS.practice, 0, false),
    week: place('week', shared, CLEARING_NESTS.week, PLACEMENT.week.turn, PLACEMENT.week.mirror),
    reserve: place('reserve', shared, CLEARING_NESTS.reserve, PLACEMENT.reserve.turn, PLACEMENT.reserve.mirror),
  }
}

/** The footprints that stop the body in a clearing: its logs, its landmarks and the feet of the root over its nest (the practice clearing adds Lab 9's landmarks). The night adds the fallen branch when it has one. */
export function clearingFootprints(c: Clearing): Footprint[] {
  const out: Footprint[] = [...c.logs.map(logFootprint), ...c.landmarks.map(landmarkFootprint), ...nestFootprints(c.nest)]
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
