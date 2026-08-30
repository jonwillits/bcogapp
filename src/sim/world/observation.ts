import { makeRng } from '../random'
import { genomeToWeights, type Genome } from '../creature/genome'
import { VehicleWorld } from './world'
import { hueToCss } from '../creature/genome'

/**
 * Watching a saved population behave, with no evolution running.
 *
 * This is what Part 3 actually is. A student puts a light somewhere, watches
 * four populations, and tries to sort them. The separability and divergence
 * acceptance tests are that activity, measured — so the measurement has to be
 * made under the same conditions a student sees, which is why food does not
 * deplete here. In the Lineages tab a light is an instrument rather than a
 * resource, and one that quietly emptied and moved partway through would make
 * the comparison unrepeatable for the student and meaningless for the test.
 */

export interface Perturbation {
  label: string
  /** Lights as [x, y, z]; y is the orb height (0.7 on the floor, 2.7 on the rim). */
  lights: [number, number, number][]
  sensorNoise?: number
  /** Seconds after which this light index is removed, if any. */
  removeAt?: { index: number; time: number }
}

/** The default world of §10's separability test: one light, dead centre. */
export const CENTRE_LIGHT: Perturbation = {
  label: 'one light at the centre',
  lights: [[0, 0.7, 0]],
}

export interface ObservationResult {
  /**
   * Mean seconds until a vehicle first comes within `arrivalRadius` of any
   * light. Vehicles that never arrive contribute the full run length, so a
   * population that mostly fails to arrive scores near the maximum rather than
   * being silently dropped from the average.
   */
  meanTimeToArrival: number
  /** Fraction of the population that ever arrived. */
  arrivedFraction: number
  /** Mean distance from the nearest light, averaged over vehicles and time. */
  meanDistance: number
  /** Mean over vehicles of the closest each ever got. */
  meanClosest: number
  /** Mean distance over the last quarter of the run — where it settled. */
  meanFinalDistance: number
  /** Mean speed, averaged over vehicles and time. */
  meanSpeed: number
  /** Fraction of vehicle-time spent within `arrivalRadius` of a light. */
  timeNearFraction: number
  /**
   * Mean within-vehicle standard deviation of distance.
   *
   * The statistic that actually distinguishes settling from orbiting, which
   * mean distance does not: a vehicle parked at 2.5 units and one swinging
   * between 0.5 and 4.5 have the same mean and completely different behaviour.
   * Part 3 asks a student to find a world where two populations come apart, and
   * "one holds still and one keeps circling" is the difference they will see.
   */
  meanDistanceSpread: number
}

export interface ObserveOptions {
  duration?: number
  dt?: number
  arrivalRadius?: number
  bounds?: number
  /**
   * Sensed strength of an observation light.
   *
   * Cannot simply be turned up until approach is obvious, and the reason is
   * worth stating: an inhibitory approacher's characteristic behaviour is to
   * slow as it nears and settle, and it does that because `bias − |w| × I`
   * passes through zero at the light. Make the light bright enough and that
   * expression goes sharply negative instead, so the vehicle slams into
   * reverse at its speed cap. A 3a stops looking like a 3a. The light has to
   * stay in the range where settling is what happens.
   */
  lightStrength?: number
  /** Where the ring of vehicles starts, as a fraction of the pit half-width. */
  startRadius?: number
  seed?: number
}

/**
 * Run a population in a fixed world and measure how it behaves.
 *
 * Deterministic given the genomes and options: placement is the same ring the
 * evolution world uses, and the only stochastic element is sensor noise, which
 * draws from a stream seeded by `seed`. That matters for the acceptance tests —
 * comparing two populations is only meaningful if the world was identical.
 */
export function observe(
  genomes: readonly Genome[],
  perturbation: Perturbation = CENTRE_LIGHT,
  opts: ObserveOptions = {},
): ObservationResult {
  const {
    duration = 30,
    dt = 1 / 30,
    arrivalRadius = 1.5,
    bounds = 9,
    lightStrength = 4,
    startRadius = 0.55,
    seed = 1,
  } = opts

  const world = new VehicleWorld(
    { bounds, sensorNoise: perturbation.sensorNoise ?? 0 },
    makeRng(seed),
  )
  const sources = perturbation.lights.map(([x, y, z]) =>
    world.addSource(x, y, z, lightStrength),
  )

  const n = genomes.length
  genomes.forEach((g, i) => {
    const angle = (i / n) * Math.PI * 2
    const r = bounds * startRadius
    world.addWeightedVehicle(genomeToWeights(g), hueToCss(g.hue), {
      x: Math.cos(angle) * r,
      z: Math.sin(angle) * r,
      heading: angle + Math.PI / 2,
    })
  })

  const arrival = new Array<number>(n).fill(Infinity)
  const distanceSum = new Array<number>(n).fill(0)
  const closest = new Array<number>(n).fill(Infinity)
  const tailSum = new Array<number>(n).fill(0)
  const sqSum = new Array<number>(n).fill(0)
  const nearCount = new Array<number>(n).fill(0)
  let speedSum = 0
  let tailSamples = 0
  let samples = 0
  let t = 0

  while (t < duration) {
    if (
      perturbation.removeAt &&
      t >= perturbation.removeAt.time &&
      sources[perturbation.removeAt.index]
    ) {
      world.removeSource(sources[perturbation.removeAt.index].id)
      sources.splice(perturbation.removeAt.index, 1)
    }

    world.step(dt)
    t += dt
    samples++

    world.vehicles.forEach((v, i) => {
      let nearest = Infinity
      for (const s of world.sources) {
        nearest = Math.min(nearest, Math.hypot(v.state.x - s.x, v.state.z - s.z))
      }
      if (!Number.isFinite(nearest)) nearest = bounds
      distanceSum[i] += nearest
      sqSum[i] += nearest * nearest
      if (nearest <= arrivalRadius) nearCount[i]++
      speedSum += Math.abs(v.actuators.left + v.actuators.right) / 2
      if (nearest < closest[i]) closest[i] = nearest
      if (t > duration * 0.75) tailSum[i] += nearest
      if (nearest <= arrivalRadius && arrival[i] === Infinity) arrival[i] = t
    })
    if (t > duration * 0.75) tailSamples++
  }

  const arrived = arrival.filter((a) => Number.isFinite(a))
  return {
    meanTimeToArrival:
      arrival.reduce((a, v) => a + (Number.isFinite(v) ? v : duration), 0) / n,
    arrivedFraction: arrived.length / n,
    meanDistance: distanceSum.reduce((a, b) => a + b, 0) / (n * samples),
    meanClosest: closest.reduce((a, b) => a + b, 0) / n,
    meanFinalDistance:
      tailSamples > 0 ? tailSum.reduce((a, b) => a + b, 0) / (n * tailSamples) : 0,
    meanSpeed: speedSum / (n * samples),
    timeNearFraction: nearCount.reduce((a, b) => a + b, 0) / (n * samples),
    meanDistanceSpread:
      Array.from({ length: n }, (_, i) => {
        const m = distanceSum[i] / samples
        return Math.sqrt(Math.max(0, sqSum[i] / samples - m * m))
      }).reduce((a, b) => a + b, 0) / n,
  }
}

/**
 * The four perturbations §10 offers Part 3, as worlds a test can run.
 *
 * The parameters are tuned, and the tuning is what makes Q14 possible. Measured
 * against the chosen fixtures:
 *
 * - **A light on the rim** separates Y from W and X by 3.0x on distance spread
 *   and 3.0x on speed. The strongest of the four, at any rim height.
 * - **Two lights** separates them only when they are *far* apart — 2.6x at ±7.5
 *   units, but 1.0x at ±4.5, where both populations simply commit to one light
 *   and behave as they would with a single one.
 * - **The light removed** separates them only when it goes *early* — 2.2x at 5
 *   seconds, 1.0x by 15. Late removal leaves both populations already settled
 *   into the same end state, with nothing left to tell apart.
 * - **Sensor noise** does not separate them at any level from 0.05 to 0.5, and
 *   is kept anyway. The handout asks a student what they tried that failed, so a
 *   perturbation that plausibly should work and does not is worth having.
 *
 * At least two must separate them by a factor of two, or Q14 becomes a guessing
 * game. Three do.
 */
export const PERTURBATIONS: Perturbation[] = [
  { label: 'a light up on the rim', lights: [[0, 1.7, 7.5]] },
  {
    label: 'two lights, far apart',
    lights: [
      [-7.5, 0.7, 0],
      [7.5, 0.7, 0],
    ],
  },
  {
    label: 'the light removed early',
    lights: [[0, 0.7, 0]],
    removeAt: { index: 0, time: 5 },
  },
  { label: 'sensor noise at 0.3', lights: [[0, 0.7, 0]], sensorNoise: 0.3 },
]
