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
  /** Energy left in this light — `depleting` mode only. */
  store: number
  capacity: number
  /** Sim time at which this light moves on — `ephemeral` mode only. */
  expiresAt: number
  /** Velocity across the floor — `drifting` mode only. */
  vx: number
  vz: number
  /**
   * While a light is exhausted it is out: removed from the world, sensed by
   * nobody, and due back at this sim time somewhere else on the floor. `null`
   * means the light is currently alight.
   */
  respawnAt: number | null
}

/**
 * How a light gives up its energy.
 *
 * **depleting** — the original model. Each light holds a finite store; a vehicle
 * draws it down, the light dims, and when it is empty it goes out and a new one
 * appears elsewhere. Faithful, but it has three tuned parameters, it is invisible
 * to a student who is never told food is finite, and its influx depends on
 * consumption which depends on population — a feedback loop that makes the
 * population dynamics cliff-edged rather than gradual.
 *
 * **ephemeral** — a light delivers energy at a steady rate and moves on a timer
 * whether or not anything ate it. Total influx is then `count x flowRate`,
 * independent of how many creatures there are, which is a far better regulator.
 * But food that teleports is a large step away from the realism the continuous
 * life cycle buys, and it looks it.
 *
 * **regrowing** — patches, grazed down and recovering in place. Nothing ever
 * moves. A patch a creature has been feeding on is dim and slowly refills while
 * it is left alone; one nobody has touched is full and bright. This keeps the
 * property that made `ephemeral` worth having — sustained influx is
 * `count x regrowthRate`, independent of how many creatures there are — while
 * being *visible*, since a patch's brightness simply is how much food is in it.
 * It still forces movement, because grazing a patch flat means going to another
 * one, and it makes a patch a student plants stay planted. Measured, though, it
 * barely selects for anything: food that regrows steadily under you means
 * camping one patch pays as well as foraging does.
 *
 * **drifting** — patches that wander. Each delivers a steady flow like
 * `ephemeral`, so influx is still `count x flowRate` and independent of
 * population, but instead of vanishing and reappearing they move slowly and
 * continuously across the floor. Nothing teleports, and following food that is
 * going somewhere is a genuine steering problem rather than a search that
 * restarts from nothing.
 */
export type FoodMode = 'depleting' | 'ephemeral' | 'regrowing' | 'drifting'

export interface FoodParams {
  mode: FoodMode
  /** ephemeral: energy per second one light can deliver, shared among feeders. */
  flowRate: number
  /** ephemeral: seconds a light stays before moving elsewhere. */
  lifetime: number
  /**
   * regrowing: energy a patch recovers per second, up to its capacity.
   *
   * The one number that sets how much food the world contains, since sustained
   * influx cannot exceed `count x regrowthRate` however many mouths there are.
   */
  regrowthRate: number
  /** drifting: units per second a patch wanders across the floor. */
  driftSpeed: number
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
  mode: 'depleting',
  flowRate: 1.6,
  lifetime: 8,
  regrowthRate: 0.8,
  driftSpeed: 0.5,
  count: 4,
  capacity: 9,
  strength: 4,
  respawnDelay: 0.3,
  intakeRate: 2.4,
  deplete: true,
  dimFloor: 0.45,
}

/** How much energy a light carries when the world is set up. */
export function freshLight(
  source: Source,
  capacity: number,
  expiresAt = Infinity,
  vx = 0,
  vz = 0,
): FoodLight {
  return { source, store: capacity, capacity, respawnAt: null, expiresAt, vx, vz }
}

/**
 * Move the drifting patches one step, turning them back at the walls.
 *
 * Reflection rather than wrapping: a patch that vanished at one edge and
 * reappeared at the other would be the teleport this mode exists to avoid.
 */
export function driftLights(
  lights: readonly FoodLight[],
  bounds: number,
  dt: number,
): void {
  const margin = 1.2
  for (const l of lights) {
    const s = l.source
    s.x += l.vx * dt
    s.z += l.vz * dt
    if (s.x < -bounds + margin || s.x > bounds - margin) {
      l.vx = -l.vx
      s.x = Math.max(-bounds + margin, Math.min(bounds - margin, s.x))
    }
    if (s.z < -bounds + margin || s.z > bounds - margin) {
      l.vz = -l.vz
      s.z = Math.max(-bounds + margin, Math.min(bounds - margin, s.z))
    }
  }
}

/**
 * What every creature earns from every light over `dt`, and what each light
 * loses by it.
 *
 * One function for both modes, because the callers should not care which is
 * running. Under `depleting` a creature's intake is limited only by how close it
 * is, and the light pays for all of it. Under `ephemeral` the light has a
 * maximum rate it can deliver: if the creatures around it want more than that
 * between them, they share it in proportion to how close each one is, and the
 * light's store is not touched at all.
 */
export function harvest(
  positions: readonly { x: number; y: number; z: number }[],
  lights: readonly FoodLight[],
  p: FoodParams,
  dt: number,
): { intake: number[]; drawn: number[] } {
  const intake = new Array<number>(positions.length).fill(0)
  const drawn = new Array<number>(lights.length).fill(0)

  lights.forEach((l, li) => {
    if (l.respawnAt !== null) return
    const grazed = p.mode === 'depleting' || p.mode === 'regrowing'
    const dim =
      grazed && p.deplete
        ? p.dimFloor +
          (1 - p.dimFloor) * Math.max(0, Math.min(1, l.store / l.capacity))
        : 1

    // What each creature would take from this light if it were alone.
    const raw = positions.map((pos) => {
      const dx = pos.x - l.source.x
      const dy = pos.y - l.source.y
      const dz = pos.z - l.source.z
      return (p.intakeRate * dim) / (1 + dx * dx + dy * dy + dz * dz)
    })

    let scale = 1
    if (p.mode === 'ephemeral' || p.mode === 'drifting') {
      const wanted = raw.reduce((a, b) => a + b, 0)
      if (wanted > p.flowRate) scale = p.flowRate / wanted
    }

    for (let i = 0; i < raw.length; i++) {
      const got = raw[i] * scale * dt
      intake[i] += got
      if (grazed) drawn[li] += got
    }
  })

  return { intake, drawn }
}

/**
 * The sensed strength of a light given how much of its store is left. Dimming
 * is what makes depletion visible without a UI element for it: a student
 * watching a vehicle park sees the light it is sitting in fade.
 */
export function lightStrength(l: FoodLight, p: FoodParams): number {
  if (p.mode === 'ephemeral' || !p.deplete) return p.strength
  const frac = Math.max(0, Math.min(1, l.store / l.capacity))
  return p.strength * (p.dimFloor + (1 - p.dimFloor) * frac)
}

/**
 * A point on the arena floor at least `minGap` from every live light and from the
 * centre-out margin, drawn from the run's seeded stream.
 *
 * Gives up after a fixed number of tries rather than looping until it succeeds:
 * with a small arena and many lights there may be no such point, and a simulation
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
