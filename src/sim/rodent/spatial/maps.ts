import type { Rng } from '../../random'
import { halfSizes, inside, type Shape } from '../shape'
import { TAU } from './angles'

/**
 * Maps for rooms (spec §6.5). Every room has a stored map: a place-field
 * assignment for every place cell, an offset and rotation for each grid
 * group, and where each landmark seen in it lies. A new room gets a new
 * map; a known room gets its map back; and **which map applies is chosen
 * by a rule that compares rooms**, not by a model of the dentate gyrus or
 * CA3 (§11, line 9). The handout connects the rule to pattern separation
 * and completion (§9.3.5).
 */

/** What the rat can sense of a room when it is lit: its shape, its colors, and the card on its wall. */
export interface RoomDescription {
  shape: Shape
  /** Named colors, compared for equality. */
  wallColor: string
  floorColor: string
  /** The landmark ids a room shows; the first is its card. */
  landmarks: readonly string[]
  /**
   * The egocentric bearing of the room's own x axis, as the walls and the
   * card together show it; null for a round room, which has none. It
   * places a new map's frame and is not compared between rooms.
   */
  axisBearing: number | null
}

export const PLACE_CELLS = 30
/** The share of place cells with a field in any one room; the rest are silent there (§9.3.5). */
export const PLACE_ACTIVE = 0.65
/** Field width (sd), meters. */
export const PLACE_WIDTH = 0.1

/** Three grid groups, each spacing 1.4 times the one before (§9.3.3), and cells per group. */
export const GRID_SPACINGS = [0.3, 0.42, 0.588] as const
export const GRID_CELLS_PER_GROUP = 6
/**
 * How strongly each group's coordinate is anchored to the walls (0: all
 * running sum; 1: all walls). The larger groups are anchored more strongly,
 * so shortening the box compresses them and barely changes the smallest
 * (§9.3.3).
 */
export const GRID_ANCHORING = [0.15, 0.5, 0.85] as const
/** Place fields blend the two coordinates with equal weight: stretching the box stretches fields by about half (§9.3.2). */
export const PLACE_ANCHORING = 0.5

export interface PlaceField {
  x: number
  y: number
}

export interface GridGroup {
  spacing: number
  orientation: number
  /** One offset per cell, in meters within one period. */
  offsets: [number, number][]
}

export interface RoomMap {
  id: number
  description: RoomDescription
  /** The room's shape as the map stores it; the anchored coordinate maps the current shape onto this one. */
  shape: Shape
  /** A field per place cell, or null for a cell silent in this room. */
  fields: (PlaceField | null)[]
  grids: GridGroup[]
  /** Where each landmark lies in this map's frame, set the first time it is seen here. */
  landmarks: Map<string, { x: number; y: number }>
  /** The heading the ring stood at when this map was made: the room's ring offset, for the panel. */
  ringOffset: number
  /**
   * The map's frame: the direction, in the ring's coordinates, of the
   * room's x axis as seen when the map was made. Fields, grids, border
   * cells and wall resets are all computed in this frame, so a ring that
   * stands at any offset from the world still gets a map that fits the
   * walls.
   */
  axis: number
}

/** A fresh map for a room, every number from the map store's own stream. */
export function makeMap(id: number, description: RoomDescription, rng: Rng, ringOffset: number, axis: number): RoomMap {
  const [hx, hy] = halfSizes(description.shape)
  const fields: (PlaceField | null)[] = []
  for (let i = 0; i < PLACE_CELLS; i++) {
    if (rng.next() > PLACE_ACTIVE) {
      fields.push(null)
      continue
    }
    let x = 0
    let y = 0
    for (let tries = 0; tries < 50; tries++) {
      x = rng.range(-hx, hx)
      y = rng.range(-hy, hy)
      if (inside(description.shape, x, y, 0.03)) break
    }
    fields.push({ x, y })
  }
  const grids: GridGroup[] = GRID_SPACINGS.map((spacing) => ({
    spacing,
    orientation: rng.range(0, Math.PI / 3),
    offsets: Array.from({ length: GRID_CELLS_PER_GROUP }, () => [rng.range(0, spacing), rng.range(0, spacing)] as [number, number]),
  }))
  return { id, description, shape: { ...description.shape }, fields, grids, landmarks: new Map(), ringOffset, axis }
}

/**
 * How unlike two rooms are, in the features the rat can sense: shape
 * (size and roundness), colors, and the card. 0 is the same room.
 */
export function roomDistance(a: RoomDescription, b: RoomDescription): number {
  let d = 0
  d += Math.abs(a.shape.roundness - b.shape.roundness)
  d += Math.abs(a.shape.width - b.shape.width) + Math.abs(a.shape.length - b.shape.length)
  if (a.wallColor !== b.wallColor) d += 1
  if (a.floorColor !== b.floorColor) d += 0.5
  if ((a.landmarks[0] ?? null) !== (b.landmarks[0] ?? null)) d += 1
  return d
}

/**
 * The map-choice rule. The current map is kept until another stored room
 * fits better by at least `HYSTERESIS`; a room unlike every stored one by
 * more than `NEW_ROOM` gets a map of its own. With the six boxes from a
 * square to a circle (roundness 0, 0.2, …, 1) the switch falls between the
 * third and fourth (`maps.test.ts`).
 */
export const HYSTERESIS = 0.1
export const NEW_ROOM = 0.55

export class MapStore {
  readonly maps: RoomMap[] = []
  current: RoomMap | null = null
  private readonly rng: Rng

  constructor(rng: Rng) {
    this.rng = rng
  }

  /**
   * Choose the map for the room now sensed. Returns the map and whether it
   * changed. `ringOffset` is recorded on a new map only.
   */
  choose(room: RoomDescription, ringOffset: number, axis: number): { map: RoomMap; changed: boolean; created: boolean } {
    let best: RoomMap | null = null
    let bestD = Infinity
    for (const m of this.maps) {
      const d = roomDistance(room, m.description)
      if (d < bestD) {
        bestD = d
        best = m
      }
    }
    const cur = this.current
    const curD = cur ? roomDistance(room, cur.description) : Infinity
    if (best && bestD <= NEW_ROOM) {
      if (cur && best !== cur && !(bestD < curD - HYSTERESIS)) return { map: cur, changed: false, created: false }
      const changed = best !== cur
      this.current = best
      return { map: best, changed, created: false }
    }
    if (cur && curD <= NEW_ROOM) return { map: cur, changed: false, created: false }
    const made = makeMap(this.maps.length + 1, room, this.rng.fork(), ringOffset, axis)
    this.maps.push(made)
    this.current = made
    return { map: made, changed: true, created: true }
  }
}

/** A grid cell's firing rate at a coordinate: three cosines 60° apart, rectified and sharpened. */
export function gridRate(g: GridGroup, cell: number, ux: number, uy: number): number {
  const [ox, oy] = g.offsets[cell]
  const k = (4 * Math.PI) / (Math.sqrt(3) * g.spacing)
  let s = 0
  for (let m = 0; m < 3; m++) {
    const a = g.orientation + (m * Math.PI) / 3
    s += Math.cos(k * ((ux - ox) * Math.cos(a) + (uy - oy) * Math.sin(a)))
  }
  const v = (s + 1.5) / 4.5
  return v <= 0 ? 0 : v * v
}

/** A place cell's firing rate at a coordinate. */
export function placeRate(f: PlaceField, ux: number, uy: number): number {
  const dx = ux - f.x
  const dy = uy - f.y
  return Math.exp(-(dx * dx + dy * dy) / (2 * PLACE_WIDTH * PLACE_WIDTH))
}

/** Grid spacing from a firing map, for the test that measures it: the first peak of the map's autocorrelation along its orientation. */
export const GRID_RATIO = GRID_SPACINGS[1] / GRID_SPACINGS[0]

export const FULL_TURN = TAU
