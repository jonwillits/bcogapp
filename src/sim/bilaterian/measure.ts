import { DishWorld, DISH_BOUNDS, REACH, type DishOptions } from './dishWorld'
import type { Scenario } from './scenarios'
import { makeRng } from '../random'
import { Worm } from './worm'
import { cloneCircuit } from './circuit'
import type { CueSource } from './fields'

/**
 * Measurements the acceptance tests and the crib share. Headless, against
 * the sim layer: the in-app browser throttles `requestAnimationFrame` and
 * nothing animates during a scripted check, so these are what a test can
 * see, and Jon eyeballs the rest at localhost:5173.
 */

export interface RunSummary {
  cuesPerMinute: number
  reversalsPerMinute: number
  fractionInReverse: number
  energyPerCue: number
  harm: number
}

export function runOne(seed: number, scenario: Scenario, seconds: number, opts: DishOptions = {}): RunSummary {
  const w = new DishWorld(seed, scenario, opts)
  w.run(seconds)
  return {
    cuesPerMinute: w.cuesPerMinute,
    reversalsPerMinute: w.reversalsPerMinute,
    fractionInReverse: w.fractionInReverse,
    energyPerCue: w.energyPerCue,
    harm: w.harm,
  }
}

export function mean(xs: readonly number[]): number {
  return xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length)
}

/** Mean summary over `seeds` runs of `seconds` each. */
export function runSeeds(scenario: Scenario, seeds: number, seconds: number, opts: DishOptions = {}): RunSummary {
  const runs = Array.from({ length: seeds }, (_, i) => runOne(1000 + i, scenario, seconds, opts))
  return {
    cuesPerMinute: mean(runs.map((r) => r.cuesPerMinute)),
    reversalsPerMinute: mean(runs.map((r) => r.reversalsPerMinute)),
    fractionInReverse: mean(runs.map((r) => r.fractionInReverse)),
    energyPerCue: mean(runs.map((r) => r.energyPerCue).filter(Number.isFinite)),
    harm: mean(runs.map((r) => r.harm)),
  }
}

/**
 * Seconds until the head first comes within reach of a single fixed source,
 * starting `distance` away at `headingOffset` radians from the direction of
 * the source — 0 facing it, π facing away. Bare integrator, one source, no
 * respawn: the steering test and nothing else.
 */
export function timeToSource(
  seed: number,
  scenario: Scenario,
  distance: number,
  headingOffset: number,
  timeout = 120,
): number {
  const rng = makeRng(seed)
  const source: CueSource = {
    id: 1,
    channel: 0,
    x: 0,
    z: 0,
    strength: 4,
    scale: 1.8,
    lifetime: null,
    born: 0,
  }
  const toSource = rng.range(-Math.PI, Math.PI)
  const x = -Math.cos(toSource) * distance
  const z = -Math.sin(toSource) * distance
  const worm = new Worm(cloneCircuit(scenario.circuit), scenario.channels, {}, {
    x,
    z,
    heading: toSource + headingOffset,
  })
  const dt = 1 / 30
  for (let t = 0; t < timeout; t += dt) {
    worm.step(dt, [source], rng, DISH_BOUNDS)
    if (Math.hypot(worm.head.x, worm.head.z) <= REACH) return t
  }
  return timeout
}
