import type { Rng } from '../random'
import { sensedIntensity, type Source } from './source'

/**
 * Food: a light with a finite store that vehicles draw down.
 *
 * This exists because the obvious fitness rule breaks the lab. If energy simply
 * accumulated in proportion to the light where a vehicle sits, the optimal
 * strategy would be to arrive at the brightest light and stop — which is
 * exactly what an ipsilateral inhibitory vehicle does and exactly what a
 * contralateral excitatory one cannot do, since it charges through and
 * overshoots. Selection would then push every population toward the same
 * variety, the four saved lineages could not differ in the way Part 3 needs,
 * and the whole comparison would have nothing to compare.
 *
 * A depleting light makes two strategies viable at once. Parking extracts a
 * light efficiently but is slow to find the next one; charging through and
 * circling wastes time overshooting but covers ground and finds new lights
 * sooner. Which wins depends on how dense the lights are, and at the default
 * density **neither should dominate** — that is a tuning target, checked by the
 * strategy-parity acceptance test, not something to hope for.
 */
export interface FoodLight {
  source: Source
  /** Energy left in this light. */
  store: number
  capacity: number
  /**
   * While a light is exhausted it is out: removed from the world, sensed by
   * nobody, and due back at this sim time somewhere else on the floor. `null`
   * means the light is currently alight.
   */
  respawnAt: number | null
}

export interface FoodParams {
  /** How many lights the respawn pool keeps alight on the floor. */
  count: number
  /** Energy in a fresh light. */
  capacity: number
  /** Base sensed strength of a light at full store. */
  strength: number
  /** Seconds a light stays out before a replacement appears elsewhere. */
  respawnDelay: number
  /**
   * How fast a vehicle draws energy out of the light it is sitting in, per unit
   * of sensed intensity per second.
   */
  intakeRate: number
  /**
   * Whether lights deplete at all.
   *
   * On for an evolution run, where depletion is what keeps two strategies
   * viable. **Off when a saved population is merely being watched** — the
   * Lineages tab, and Part 3's "put a single light in the middle of the floor"
   * — because there the light is an instrument, not a resource, and a light
   * that quietly moved partway through would make the comparison
   * unrepeatable.
   */
  deplete: boolean
  /**
   * What fraction of its strength a fully-drained light still shows. A light
   * that dimmed all the way to nothing would take forever to finish, since
   * intake falls with the intensity that produces it; keeping a floor means a
   * light visibly fades and then goes out.
   */
  dimFloor: number
}

/**
 * Settled by the sweep in §10's acceptance tests rather than chosen. The two
 * numbers that moved furthest from the spec's starting points are `strength`
 * (1 → 4, so the gradient is steep enough far from a light that steering pays
 * at all) and `respawnDelay` (1 → 0.3, which is what keeps roaming competitive
 * with parking).
 */
export const DEFAULT_FOOD_PARAMS: FoodParams = {
  count: 4,
  capacity: 9,
  strength: 4,
  respawnDelay: 0.3,
  intakeRate: 2.4,
  deplete: true,
  dimFloor: 0.45,
}

/** How much energy a light carries when the world is set up. */
export function freshLight(source: Source, capacity: number): FoodLight {
  return { source, store: capacity, capacity, respawnAt: null }
}

/**
 * The sensed strength of a light given how much of its store is left. Dimming
 * is what makes depletion visible without a UI element for it: a student
 * watching a vehicle park sees the light it is sitting in fade.
 */
export function lightStrength(l: FoodLight, p: FoodParams): number {
  if (!p.deplete) return p.strength
  const frac = Math.max(0, Math.min(1, l.store / l.capacity))
  return p.strength * (p.dimFloor + (1 - p.dimFloor) * frac)
}

/**
 * A point on the pit floor at least `minGap` from every live light and from the
 * centre-out margin, drawn from the run's seeded stream.
 *
 * Gives up after a fixed number of tries rather than looping until it succeeds:
 * with a small pit and many lights there may be no such point, and a simulation
 * that can hang because the student raised a slider is worse than one that
 * occasionally places two lights close together.
 */
export function respawnPoint(
  lights: readonly FoodLight[],
  bounds: number,
  rng: Rng,
  minGap = 3,
): { x: number; z: number } {
  const margin = 1.2
  const lo = -bounds + margin
  const hi = bounds - margin
  let best = { x: rng.range(lo, hi), z: rng.range(lo, hi) }
  let bestGap = -1
  for (let attempt = 0; attempt < 24; attempt++) {
    const p = { x: rng.range(lo, hi), z: rng.range(lo, hi) }
    let gap = Infinity
    for (const l of lights) {
      if (l.respawnAt !== null) continue
      gap = Math.min(gap, Math.hypot(p.x - l.source.x, p.z - l.source.z))
    }
    if (gap >= minGap) return p
    if (gap > bestGap) {
      bestGap = gap
      best = p
    }
  }
  return best
}

/**
 * How fast a vehicle at this point draws energy out of each live light, in
 * units of `intakeRate`.
 *
 * Returned per light rather than summed, because a vehicle sitting between two
 * lights has to draw from each in proportion to what it is actually getting
 * from it. Summing first and then dividing the draw evenly would let a vehicle
 * deplete a distant light it can barely sense.
 *
 * **Deliberately independent of the light's sensed strength.** The two are
 * separate tuning knobs and have to be, because they trade off against
 * different acceptance tests. Sensed strength sets how far away a gradient is
 * steep enough to steer by — turn it up and skill starts to pay. Intake sets
 * how much food the world contains — turn it up and the population's ceiling
 * rises. Left coupled, as the spec's "energy accumulates in proportion to the
 * light intensity" implies, raising the strength to make steering legible also
 * multiplies the food supply, and the adaptation test and the strategy-parity
 * test pull the single knob in opposite directions. Splitting them is what
 * makes both satisfiable at once.
 *
 * A drained light still feeds more slowly than a full one, via the same dim
 * factor that makes depletion visible.
 */
export function intakeContributions(
  x: number,
  y: number,
  z: number,
  lights: readonly FoodLight[],
  p: FoodParams,
): number[] {
  return lights.map((l) => {
    if (l.respawnAt !== null) return 0
    const dim = p.deplete
      ? p.dimFloor +
        (1 - p.dimFloor) * Math.max(0, Math.min(1, l.store / l.capacity))
      : 1
    return sensedIntensity(x, y, z, [{ ...l.source, strength: dim }])
  })
}
