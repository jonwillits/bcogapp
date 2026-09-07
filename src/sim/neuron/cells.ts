import { HEALTHY_CELL, type CellParams } from './cell'
import { DEFAULT_BODY_SIZE_M, type SignalType } from './signals'

/**
 * The five diagnostic cells of the spec's §6, and the healthy default they
 * are each one step away from.
 *
 * Per §9, every cell is the healthy scenario with **one named parameter
 * changed** and nothing else touched, and was tuned only against the tests in
 * `neuronWorld.test.ts`. The full scenario is written out for each so that
 * "every other parameter is normal" can be checked by reading this file: a
 * cell's `cell`, `unit` and `world` are spread from the healthy ones and the
 * single change is the one line that follows.
 */

/**
 * One cell's wiring: y = b₀ + b₁x₁ + b₂x₂, with x₁ always the **left** sensor
 * and x₂ always the **right** sensor, in both cells. The first build numbered
 * the inputs relative to the cell (x₁ its own side, x₂ the other), which made
 * b₁ the same-side connection in both cells; Jon's call (2026-09-07) was that
 * absolute sides read straight off the picture, which draws sensor L and
 * sensor R, and relative ones do not. So the crossed connection is b₂ in the
 * left cell and b₁ in the right. The chapter writes a third term; the vehicle
 * has two sensors and nothing else to wire, so a third input was built and
 * then taken out.
 */
export interface CellWiring {
  /** Baseline b₀, spikes per second. */
  b0: number
  /** Strength from the left sensor, b₁. */
  b1: number
  /** Strength from the right sensor, b₂. */
  b2: number
}

/**
 * The vehicle's two cells, each with its own wiring: six numbers, as Lab 1's
 * four strengths and Lab 2's genome were each connection's own. The first
 * build locked the two cells to one set of numbers, for the sake of "one
 * cell, three tabs"; Jon's judgement (2026-09-06) was that identical weights
 * locked together is an artificial-network habit and unintuitive for a
 * biological organism, so each cell now carries its own, and the Unit tab
 * offers a copy button for the experiments that want them alike.
 */
export interface UnitSettings {
  left: CellWiring
  right: CellWiring
}

export interface WorldSettings {
  signal: SignalType
  /** Signal path length, metres — the World tab's body-size control. */
  bodySizeM: number
  /** How fast the lights drift, arena units per second. */
  lightSpeed: number
  /** How many lights are in the arena at once. */
  lightCount: number
  /** Half-width of the square arena, in arena units. */
  arena: number
}

export interface Scenario {
  cell: CellParams
  unit: UnitSettings
  world: WorldSettings
}

export interface DiagnosticCell {
  id: 'N0' | 'N1' | 'N2' | 'N3' | 'N4'
  scenario: Scenario
  /** The fault, shown after Reveal faults (N0's is shown from the start). */
  fault: string
  /** Marr's level the fault lives at, or none. */
  level: 'computational' | 'algorithmic' | 'implementational' | 'none'
  /** What is normal about it, and must be. */
  normal: string
}

/**
 * The healthy scenario. A contralateral excitatory wiring — Lab 1's 2b, the
 * one that charges into lights — with the reading's baseline of 5 spikes per
 * second. The world is the "fast" world of Part 1: lights that drift at two
 * units a second, below the vehicle's own top speed of 3.2.
 *
 * Measured over four seeds of three minutes (see `world.probe.ts`): the
 * healthy vehicle collects about 3 lights a minute; N0, N1 and N2 about none;
 * N3 about 1.7; N4 about 2.2. The last two are the spec's §10 falling short,
 * and the reason is the world rather than the cells: a vehicle that sits
 * still and lunges at whatever drifts within reach does nearly as well as one
 * that roams, because in a walled arena with three moving lights something
 * drifts within reach every twenty seconds or so — and a bigger arena, more
 * lights or a busier healthy baseline did not change that (a sit-and-wait N4
 * *beat* a cruising healthy vehicle in a 12-unit arena). N3's fault needs a
 * sustained load, and an intermittently chasing vehicle recovers between
 * chases. Both are recorded in `docs/M03_SPEC_DEVIATIONS.md`.
 */
/** The left cell's wiring; the right cell is its mirror image. */
export const HEALTHY_WIRING: CellWiring = {
  b0: 5,
  b1: 0,
  b2: 2,
}

/** The other cell's version of a wiring: the same function on the other side. */
export function mirror(w: CellWiring): CellWiring {
  return { b0: w.b0, b1: w.b2, b2: w.b1 }
}

/** A left-cell wiring and its mirror — how the healthy vehicle and the five cells are built. */
export function bothCells(w: CellWiring): UnitSettings {
  return { left: { ...w }, right: mirror(w) }
}

export const HEALTHY_UNIT: UnitSettings = bothCells(HEALTHY_WIRING)

/** The two detents of the world-speed control, arena units per second. */
export const WORLD_SPEEDS = { slow: 0.5, fast: 2 } as const

export const HEALTHY_WORLD: WorldSettings = {
  signal: 'spikes',
  bodySizeM: DEFAULT_BODY_SIZE_M,
  lightSpeed: WORLD_SPEEDS.fast,
  lightCount: 3,
  arena: 9,
}

export const HEALTHY_SCENARIO: Scenario = {
  cell: { ...HEALTHY_CELL },
  unit: { ...HEALTHY_UNIT },
  world: { ...HEALTHY_WORLD },
}

export const DIAGNOSTIC_CELLS: DiagnosticCell[] = [
  {
    id: 'N0',
    scenario: {
      cell: { ...HEALTHY_CELL },
      unit: bothCells({ ...HEALTHY_WIRING, b2: -2 }),
      world: { ...HEALTHY_WORLD },
    },
    fault:
      'In both cells, the crossed connection — from the sensor on the other side — is a strong negative where the task needs a positive. Each cell computes a perfectly good function that happens to be the wrong one: light slows the far wheel instead of speeding it, so the vehicle turns away.',
    level: 'algorithmic',
    normal:
      'The membrane is entirely healthy: resting voltage, gate order, spike height and cost per spike are all ordinary.',
  },
  {
    id: 'N1',
    scenario: {
      cell: { ...HEALTHY_CELL },
      unit: bothCells(HEALTHY_WIRING),
      world: { ...HEALTHY_WORLD, lightSpeed: 5 },
    },
    fault:
      'Nothing is wrong with the cell. Its lights move at five units a second, faster than the vehicle can drive, so no controller could catch them.',
    level: 'computational',
    normal: 'Every cell parameter and every connection is the healthy default.',
  },
  {
    id: 'N2',
    scenario: {
      cell: { ...HEALTHY_CELL },
      unit: bothCells({ ...HEALTHY_WIRING, b2: 0.25 }),
      world: { ...HEALTHY_WORLD },
    },
    fault:
      'In both cells, the connection strengths are near zero. The cells steer the right way, but so weakly that the lights are gone before the vehicle gets there.',
    level: 'algorithmic',
    normal: 'The membrane is healthy. Unlike N0, the sign is right; the size is not.',
  },
  {
    id: 'N3',
    scenario: {
      cell: { ...HEALTHY_CELL, pumpPower: 0.2 },
      unit: bothCells(HEALTHY_WIRING),
      world: { ...HEALTHY_WORLD },
    },
    fault:
      'The sodium–potassium pump runs at a fifth of normal. Fine at rest and at low rates; under sustained demand sodium builds up inside, E_Na collapses, and the spikes shrink and then fail.',
    level: 'implementational',
    normal:
      'The connection strengths are right. At rest the membrane looks very nearly normal — the fault only appears under load.',
  },
  {
    id: 'N4',
    scenario: {
      cell: { ...HEALTHY_CELL },
      unit: bothCells({ ...HEALTHY_WIRING, b0: -10 }),
      world: { ...HEALTHY_WORLD },
    },
    fault:
      'Not broken. Both cells have a low baseline, so they fire rarely and the vehicle sits still until a light comes close, then lunges. It collects somewhat fewer lights, spends a little less ATP, and gets each light cheaper than the other three.',
    level: 'none',
    normal: 'Everything.',
  },
]

/**
 * The band every cell parameter must sit inside to count as healthy, for the
 * test that asserts N1 finds nothing on inspection. ±10% of the healthy value
 * (exact for the switches).
 */
export function insideHealthyBand(cell: CellParams): boolean {
  for (const key of Object.keys(HEALTHY_CELL) as (keyof CellParams)[]) {
    const ref = HEALTHY_CELL[key]
    const got = cell[key]
    if (typeof ref === 'boolean' || typeof got === 'boolean') {
      if (ref !== got) return false
      continue
    }
    if (ref === 0) {
      if (Math.abs(got) > 1e-9) return false
    } else if (Math.abs(got - ref) > Math.abs(ref) * 0.1) return false
  }
  return true
}
