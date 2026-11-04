/**
 * The arena (spec §8.1): the layout of the chapter's figure
 * `f-food-competition` (after Hare et al., 2000, Fig. 5). Three rooms in a
 * row: the subordinate's room on the left, the central room, the
 * dominant's room on the right, each side room with a door onto the
 * central room. Every piece of food sits at one of nine fixed positions in
 * the central room, and a barrier is a short wall on one side of a
 * position. Line of sight is geometric: a straight line from a door to a
 * piece, blocked by an opaque barrier it crosses and not by a clear one.
 *
 * **This module is the one place line of sight is computed.** The dominant
 * and the three sighted subordinates read it; the learner may not
 * (`structure.test.ts`).
 */

export const ROOM = { width: 10, height: 6 } as const

export interface Point {
  x: number
  y: number
}

import { DOOR_IDS, SIDES, type DoorId, type Side } from './doors'

export type { DoorId, Side }
export { DOOR_IDS, SIDES }

/** The subordinate's door, on the left wall, in every layout. */
export const SUBORDINATE_DOOR: Point = { x: 0, y: 3 }

/** The dominant's doors: `east` is the usual one; `top` is T8's; the rest are for the learner's many rooms. */
export const DOORS: Record<DoorId, Point> = {
  east: { x: 10, y: 3 },
  'east-low': { x: 10, y: 1 },
  'east-high': { x: 10, y: 5 },
  top: { x: 5, y: 6 },
  'top-left': { x: 2, y: 6 },
  'top-right': { x: 8, y: 6 },
  bottom: { x: 5, y: 0 },
  'bottom-left': { x: 2, y: 0 },
  'bottom-right': { x: 8, y: 0 },
}
export const USUAL_DOOR: DoorId = 'east'
export const NEW_DOOR: DoorId = 'top'

/** The nine fixed positions: three columns at x 3, 5, 7 and three rows at y 1.5, 3, 4.5; index = row × 3 + column. */
export const POSITIONS: readonly Point[] = Array.from({ length: 9 }, (_, i) => ({ x: 3 + 2 * (i % 3), y: 1.5 + 1.5 * Math.floor(i / 3) }))

export type BarrierKind = 'opaque' | 'clear'

export interface Barrier {
  position: number
  side: Side
  kind: BarrierKind
}

/** How far a barrier stands from its position, and its half-length. */
export const BARRIER_OFFSET = 0.6
export const BARRIER_HALF = 0.6

export interface Segment {
  a: Point
  b: Point
}

/** The wall segment a barrier occupies. */
export function barrierSegment(b: Pick<Barrier, 'position' | 'side'>): Segment {
  const p = POSITIONS[b.position]
  switch (b.side) {
    case 'E':
      return { a: { x: p.x + BARRIER_OFFSET, y: p.y - BARRIER_HALF }, b: { x: p.x + BARRIER_OFFSET, y: p.y + BARRIER_HALF } }
    case 'W':
      return { a: { x: p.x - BARRIER_OFFSET, y: p.y - BARRIER_HALF }, b: { x: p.x - BARRIER_OFFSET, y: p.y + BARRIER_HALF } }
    case 'N':
      return { a: { x: p.x - BARRIER_HALF, y: p.y + BARRIER_OFFSET }, b: { x: p.x + BARRIER_HALF, y: p.y + BARRIER_OFFSET } }
    case 'S':
      return { a: { x: p.x - BARRIER_HALF, y: p.y - BARRIER_OFFSET }, b: { x: p.x + BARRIER_HALF, y: p.y - BARRIER_OFFSET } }
  }
}

const cross = (o: Point, a: Point, b: Point) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)

/** Whether two segments cross (touching at an endpoint counts). */
export function segmentsCross(s: Segment, t: Segment): boolean {
  const d1 = cross(t.a, t.b, s.a)
  const d2 = cross(t.a, t.b, s.b)
  const d3 = cross(s.a, s.b, t.a)
  const d4 = cross(s.a, s.b, t.b)
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return true
  const on = (p: Point, q: Point, r: Point) => Math.min(p.x, r.x) <= q.x && q.x <= Math.max(p.x, r.x) && Math.min(p.y, r.y) <= q.y && q.y <= Math.max(p.y, r.y)
  if (d1 === 0 && on(t.a, s.a, t.b)) return true
  if (d2 === 0 && on(t.a, s.b, t.b)) return true
  if (d3 === 0 && on(s.a, t.a, s.b)) return true
  if (d4 === 0 && on(s.a, t.b, s.b)) return true
  return false
}

/** Whether a point is in line of sight from an eye point: no opaque barrier crosses the line between them. Clear barriers do not block. */
export function inLineOfSight(eye: Point, target: Point, barriers: readonly Barrier[]): boolean {
  const line = { a: eye, b: target }
  for (const b of barriers) {
    if (b.kind !== 'opaque') continue
    if (segmentsCross(line, barrierSegment(b))) return false
  }
  return true
}

export const distance = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y)

/** The side of a position that faces a door most directly: the barrier side that hides a piece there from that door. */
export function hidingSide(position: number, door: DoorId): Side {
  const p = POSITIONS[position]
  const d = DOORS[door]
  for (const side of SIDES) {
    if (!inLineOfSight(d, p, [{ position, side, kind: 'opaque' }])) return side
  }
  // Fall back to the side toward the door.
  const dx = d.x - p.x
  const dy = d.y - p.y
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'E' : 'W'
  return dy > 0 ? 'N' : 'S'
}

/** The points of the floor the dominant can see from its door, sampled on a grid, for drawing its line of sight (§8.1). */
export function visibleFloor(door: DoorId, barriers: readonly Barrier[], step = 0.25): Point[] {
  const out: Point[] = []
  const eye = DOORS[door]
  for (let y = step / 2; y < ROOM.height; y += step) for (let x = step / 2; x < ROOM.width; x += step) if (inLineOfSight(eye, { x, y }, barriers)) out.push({ x, y })
  return out
}
