import { makeRng } from '../random'
import { genomeToWeights, type Genome } from '../creature/genome'
import { VehicleWorld } from './world'
import {
  DEFAULT_VEHICLE_CONFIG,
  wheelSpeeds,
  type VehicleConfig,
} from '../creature/vehicle'
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
  /**
   * Mean speed, averaged over vehicles and time — **signed**, so reversing
   * counts as negative rather than as fast.
   *
   * It used to be an absolute value, and that hid the single most visible
   * difference between these populations: an inhibitory approacher spends most
   * of its life *driving backwards*, and at |1.05| that was indistinguishable
   * from a contralateral one cruising forwards at 1.05. The separability test
   * passed on a statistic that could not see the thing a student sees first.
   */
  meanSpeed: number
  /** Fraction of vehicle-time spent moving backwards. */
  reverseFraction: number
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

  // ---------------------------------------------------------------------
  // The viewer-grounded measures.
  //
  // Everything above this line is a summary a statistician would reach for.
  // Everything below it exists because a summary was twice unable to see what
  // Jon saw in the first three seconds of watching. Each one names a *kind* of
  // behaviour rather than a magnitude, because a student in the Lineages tab
  // views one population at a time and compares from memory, and memory keeps
  // kinds: "it drove backwards", "it parked", "it span on the spot".
  // ---------------------------------------------------------------------

  /**
   * Fraction of vehicle-time spent barely moving at all.
   *
   * The measure that decides whether clamping reverse merely swaps one giveaway
   * for another: a clamped inhibitory approacher *parks* at the light where a
   * contralateral one keeps orbiting, and nothing above this line can see the
   * difference between parked and slowly circling.
   */
  stoppedFraction: number

  /** Mean absolute yaw rate, rad/s — spinning versus driving straight. */
  meanTurnRate: number

  /**
   * Mean yaw rate signed by whether it turns the body *towards* the nearest
   * light, rad/s.
   *
   * `meanTurnRate` takes an absolute value, which is precisely the mistake this
   * whole exercise is about: it cannot see which way a creature swings. Two
   * populations that both yaw at 1.6 rad/s look identical to it whether they
   * are hunting the light or fleeing it.
   */
  meanTurnTowardsRate: number

  /**
   * Mean absolute bearing from the creature's own heading to the nearest light,
   * over the last quarter of the run, in radians.
   *
   * Where a population ends up *facing*. A creature at rest pointing at the
   * light and one at rest pointing away sit at identical distances and identical
   * speeds, and look nothing alike.
   */
  meanFinalHeadingError: number

  /** Fraction of vehicle-time spent pressed against the arena boundary. */
  wallFraction: number

  /**
   * Mean signed speed over the first five seconds.
   *
   * A viewer's judgement is made in the opening moments and a thirty-second
   * mean dilutes it. Y's reversal is obvious immediately; a candidate that
   * settles into a matched average after a visibly different start would pass
   * every whole-run statistic here.
   */
  openingSpeed: number

  /**
   * Standard deviation *across members* of each member's own mean signed speed.
   *
   * Every other measure averages the population into one number, so eight
   * creatures all doing one thing and eight doing three different things score
   * the same. A population that visibly disagrees with itself looks unlike one
   * that moves as a body, whatever their means.
   */
  speedHeterogeneity: number
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
  /** Where the ring of vehicles starts, as a fraction of the arena half-width. */
  startRadius?: number
  seed?: number
  /**
   * Forbid reversing, so a negatively-driven wheel stalls at zero.
   *
   * Option B of the §6 separability problem, as something measurable rather than
   * argued about. See `VehicleConfig.clampReverse`.
   */
  clampReverse?: boolean
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
    clampReverse = false,
  } = opts
  const config: VehicleConfig = { ...DEFAULT_VEHICLE_CONFIG, clampReverse }

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
    world.addWeightedVehicle(
      genomeToWeights(g),
      hueToCss(g.hue),
      {
        x: Math.cos(angle) * r,
        z: Math.sin(angle) * r,
        heading: angle + Math.PI / 2,
      },
      config,
    )
  })

  const arrival = new Array<number>(n).fill(Infinity)
  const distanceSum = new Array<number>(n).fill(0)
  const closest = new Array<number>(n).fill(Infinity)
  const tailSum = new Array<number>(n).fill(0)
  const sqSum = new Array<number>(n).fill(0)
  const nearCount = new Array<number>(n).fill(0)
  let speedSum = 0
  let reverseCount = 0
  let tailSamples = 0
  let samples = 0
  let t = 0

  // Per-vehicle so the population's *internal* disagreement is measurable;
  // every other statistic here averages that away.
  const speedSumPer = new Array<number>(n).fill(0)
  let stoppedCount = 0
  let turnSum = 0
  let turnTowardsSum = 0
  let headingErrorTailSum = 0
  let wallCount = 0
  let openingSpeedSum = 0
  let openingSamples = 0
  const prevHeading = world.vehicles.map((v) => v.state.heading)
  const wallBand = bounds - 0.8
  const OPENING = 5

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
      // Through `wheelSpeeds`, because that is the speed the body actually
      // travels at and therefore the speed a viewer sees: raw actuator output
      // runs past the wheel cap, so two populations both pinned at the cap would
      // score as different while moving identically on screen. Sharing the
      // function with `stepVehicle` rather than repeating the arithmetic is
      // deliberate — a second copy would be free to drift, and a measure that
      // has drifted from what is drawn is the whole bug this suite exists for.
      const wheels = wheelSpeeds(v.actuators, v.config)
      const signed = (wheels.left + wheels.right) / 2
      speedSum += signed
      speedSumPer[i] += signed
      if (signed < -0.05) reverseCount++
      if (Math.abs(signed) < 0.08) stoppedCount++
      if (t <= OPENING) openingSpeedSum += signed

      // Yaw, from the pose rather than the actuators, so wheel clamping and the
      // boundary reflection are both accounted for.
      let dH = v.state.heading - prevHeading[i]
      while (dH > Math.PI) dH -= 2 * Math.PI
      while (dH < -Math.PI) dH += 2 * Math.PI
      prevHeading[i] = v.state.heading
      turnSum += Math.abs(dH) / dt

      // Which way it swings *relative to the light*: positive means the body is
      // turning to face the nearest source.
      let bearing = nearestBearing(v.state, world.sources) - v.state.heading
      while (bearing > Math.PI) bearing -= 2 * Math.PI
      while (bearing < -Math.PI) bearing += 2 * Math.PI
      turnTowardsSum += (Math.sign(bearing) * dH) / dt

      if (Math.max(Math.abs(v.state.x), Math.abs(v.state.z)) > wallBand) wallCount++

      if (nearest < closest[i]) closest[i] = nearest
      if (t > duration * 0.75) {
        tailSum[i] += nearest
        headingErrorTailSum += Math.abs(bearing)
      }
      if (nearest <= arrivalRadius && arrival[i] === Infinity) arrival[i] = t
    })
    if (t <= OPENING) openingSamples++
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
    reverseFraction: reverseCount / (n * samples),
    timeNearFraction: nearCount.reduce((a, b) => a + b, 0) / (n * samples),
    meanDistanceSpread:
      Array.from({ length: n }, (_, i) => {
        const m = distanceSum[i] / samples
        return Math.sqrt(Math.max(0, sqSum[i] / samples - m * m))
      }).reduce((a, b) => a + b, 0) / n,
    stoppedFraction: stoppedCount / (n * samples),
    meanTurnRate: turnSum / (n * samples),
    meanTurnTowardsRate: turnTowardsSum / (n * samples),
    meanFinalHeadingError:
      tailSamples > 0 ? headingErrorTailSum / (n * tailSamples) : 0,
    wallFraction: wallCount / (n * samples),
    openingSpeed: openingSamples > 0 ? openingSpeedSum / (n * openingSamples) : 0,
    speedHeterogeneity: (() => {
      const per = speedSumPer.map((v) => v / samples)
      const m = per.reduce((a, b) => a + b, 0) / n
      return Math.sqrt(per.reduce((a, b) => a + (b - m) * (b - m), 0) / n)
    })(),
  }
}

/** Bearing from a vehicle to the nearest source, in world angle. */
function nearestBearing(
  s: { x: number; z: number },
  sources: readonly { x: number; z: number }[],
): number {
  let best: { x: number; z: number } | null = null
  let bestD = Infinity
  for (const src of sources) {
    const d = Math.hypot(s.x - src.x, s.z - src.z)
    if (d < bestD) {
      bestD = d
      best = src
    }
  }
  return best ? Math.atan2(best.z - s.z, best.x - s.x) : 0
}

/**
 * The perturbations §10 offers Part 3, as worlds a test can run.
 *
 * **Every light here is somewhere a student can actually click.** That is a
 * constraint, not a nicety, and it caught a real bug: the previous rim light was
 * `[0, 1.7, 7.5]`, and there is nowhere in the scene with that geometry. The
 * arena floor sits at ground height 0 and the plateau outside it at
 * `RIM_HEIGHT` = 2, with nothing between — the cliff walls are deliberately not
 * pointer targets — and a placed light sits `ORB_HOVER` = 0.7 above whichever
 * surface was clicked. So the only two heights obtainable are **0.7 inside the
 * bounds** and **2.7 outside them**. Height 1.7 implies a ground height of 1,
 * and z = 7.5 is inside the arena where the ground is flat. The strongest of the
 * four perturbations described a world nobody could build.
 *
 * Divergence is measured on **within-vehicle spread of distance alone** — how
 * much each creature's distance to the light varies, which is the difference
 * between holding station and swinging past. Speed used to be included and is
 * not any more, for two reasons. It is signed now, so a ratio across a sign flip
 * is meaningless (0.67 against −1.05 scores 33 and would pass anything). And the
 * speed difference is visible in the *default* world, so counting it would let
 * the divergence test pass without any perturbation doing any work — the thing
 * Q14 asks a student to achieve.
 *
 * Measured against the current fixtures, continuous / discrete engine:
 *
 * - **A light at the far edge of the floor** — 3.93 / 3.34. The strongest, and
 *   the easiest to stumble on: click near the far wall. Not one of §10's four;
 *   added because the spec's own set left the continuous engine with only one
 *   perturbation clearing the bar.
 * - **A light up on the rim** — 3.38 / 3.15, now at a height that exists.
 * - **Two lights, far apart** — 2.66 / 3.27, at ±8.8. At ±7.5 it scores 1.97 on
 *   the continuous engine and misses; at ±4.5 both populations commit to one
 *   light and it does nothing at all.
 * - **A light removed early** — 1.05 / 1.06. Does *not* separate them on
 *   station-keeping, and is kept.
 * - **Sensor noise** — 1.30 / 1.08 at any level from 0.05 to 0.6, and kept for
 *   the same reason: the handout asks a student what they tried that failed, so
 *   perturbations that plausibly should work and do not are worth having.
 *
 * Three clear a factor of two; the acceptance test asks for at least two.
 */
export const PERTURBATIONS: Perturbation[] = [
  { label: 'a light at the far edge of the floor', lights: [[0, 0.7, 8.8]] },
  { label: 'a light up on the rim', lights: [[0, 2.7, 10]] },
  {
    label: 'two lights, far apart',
    lights: [
      [-8.8, 0.7, 0],
      [8.8, 0.7, 0],
    ],
  },
  {
    label: 'the light removed early',
    lights: [[0, 0.7, 0]],
    removeAt: { index: 0, time: 5 },
  },
  { label: 'sensor noise at 0.3', lights: [[0, 0.7, 0]], sensorNoise: 0.3 },
]
