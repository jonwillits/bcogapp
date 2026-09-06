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
 * The reading's arithmetic, as the vehicle's two mirror-image cells use it:
 * y = b₀ + b₁x₁ + b₂x₂, with x₁ the same-side sensor and x₂ the opposite one.
 * The chapter writes a third term; the vehicle has two sensors and nothing
 * else to wire, so a third input was built and then taken out — an unused
 * connection kept only because the equation had room for it explained
 * nothing and asked nothing.
 */
export interface UnitSettings {
  /** Baseline b₀, spikes per second. */
  b0: number
  /** Strength from the same-side sensor, b₁. */
  bIpsi: number
  /** Strength from the opposite-side sensor, b₂. */
  bContra: number
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
export const HEALTHY_UNIT: UnitSettings = {
  b0: 5,
  bIpsi: 0,
  bContra: 2,
}

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
      unit: { ...HEALTHY_UNIT, bContra: -2 },
      world: { ...HEALTHY_WORLD },
    },
    fault:
      'The connection from the opposite-side sensor is a strong negative where the task needs a positive. The cell computes a perfectly good function that happens to be the wrong one: light slows the far wheel instead of speeding it, so the vehicle turns away.',
    level: 'algorithmic',
    normal:
      'The membrane is entirely healthy: resting voltage, gate order, spike height and cost per spike are all ordinary.',
  },
  {
    id: 'N1',
    scenario: {
      cell: { ...HEALTHY_CELL },
      unit: { ...HEALTHY_UNIT },
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
      unit: { ...HEALTHY_UNIT, bContra: 0.25 },
      world: { ...HEALTHY_WORLD },
    },
    fault:
      'The connection strengths are near zero. The cell steers the right way, but so weakly that the lights are gone before it gets there.',
    level: 'algorithmic',
    normal: 'The membrane is healthy. Unlike N0, the sign is right; the size is not.',
  },
  {
    id: 'N3',
    scenario: {
      cell: { ...HEALTHY_CELL, pumpPower: 0.2 },
      unit: { ...HEALTHY_UNIT },
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
      unit: { ...HEALTHY_UNIT, b0: -10 },
      world: { ...HEALTHY_WORLD },
    },
    fault:
      'Not broken. Its baseline is low, so it fires rarely and sits still until a light comes close, then lunges. It collects somewhat fewer lights, spends a little less ATP, and gets each light cheaper than the other three.',
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
