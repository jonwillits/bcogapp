import { DishWorld } from '../dishWorld'
import { SCENARIOS, DIAGNOSIS } from '../scenarios'
import { ANIMALS } from '../animals'

/**
 * What "Lab 4 reproduces bit-for-bit" is measured on: for every Lab 4
 * scenario and every Lab 4 animal, a run's whole trajectory folded into a
 * handful of numbers printed at full precision. The head's position is
 * summed at every step, so a last-bit difference anywhere in a run changes
 * the digest; nothing here rounds.
 *
 * The digests in `lab4Regression.fixture.json` were recorded from the engine
 * at commit 9ebfc77 — the Lab 4 that shipped — before the learning layer
 * touched a line of it. See `lab4Regression.test.ts`.
 */

export const REGRESSION_SEEDS = [11, 2026] as const
export const REGRESSION_SECONDS = 90

export interface RunDigest {
  id: string
  pathX: string
  pathZ: string
  course: string
  energy: string
  harm: string
  cuesReached: number
  reversals: number
  crossings: number
  wiring: string
}

function digest(id: string, w: DishWorld, seconds: number): RunDigest {
  const dt = 1 / 30
  const n = Math.round(seconds / dt)
  let px = 0
  let pz = 0
  for (let i = 0; i < n; i++) {
    w.step(dt)
    px += w.worm.head.x
    pz += w.worm.head.z
  }
  return {
    id,
    pathX: String(px),
    pathZ: String(pz),
    course: String(w.worm.course),
    energy: String(w.worm.energy),
    harm: String(w.harm),
    cuesReached: w.cuesReached,
    reversals: w.worm.reversals,
    crossings: w.crossings,
    wiring: JSON.stringify(w.worm.circuit),
  }
}

/** Every Lab 4 scenario and animal, run with `build` deciding how the world is made. */
export function lab4Digests(
  build: (seed: number, scenarioKey: string, animalId?: string) => DishWorld = defaultBuild,
): RunDigest[] {
  const out: RunDigest[] = []
  for (const seed of REGRESSION_SEEDS) {
    for (const s of SCENARIOS) out.push(digest(`${s.key}|${seed}`, build(seed, s.key), REGRESSION_SECONDS))
  }
  for (const a of ANIMALS) out.push(digest(`animal ${a.id}`, build(REGRESSION_SEEDS[0], DIAGNOSIS.key, a.id), REGRESSION_SECONDS))
  return out
}

function defaultBuild(seed: number, scenarioKey: string, animalId?: string): DishWorld {
  const scenario = SCENARIOS.find((s) => s.key === scenarioKey)!
  const animal = animalId ? ANIMALS.find((a) => a.id === animalId)! : undefined
  return new DishWorld(seed, scenario, animal ? { circuit: animal.circuit, modulators: animal.modulators } : {})
}
