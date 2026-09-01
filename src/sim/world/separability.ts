import type { ObservationResult } from './observation'

/**
 * The separability battery: the measures §6's "one hard build requirement" is
 * actually checked against, and the tolerances they are checked to.
 *
 * ## Why this exists as its own module
 *
 * Twice, this criterion was reported as satisfied by a statistic that could not
 * see the thing it was meant to see. First mean distance, which is structurally
 * blind to mechanism because every approacher ends up near the light whatever
 * took it there. Then absolute speed, which is blind to direction, so a
 * population driving backwards at 1.05 scored identically to one cruising
 * forwards at 1.05. Both times the suite agreed with itself and Jon found the
 * problem by looking.
 *
 * The common shape of both failures is a *quantitative* statistic policing a
 * *categorical* difference. A student in the Lineages tab views one population
 * at a time and compares from memory, and memory keeps kinds of behaviour, not
 * magnitudes: "it drove backwards", "it parked", "it span on the spot". So the
 * battery names kinds, and every measure below is one a viewer could describe
 * in words without reading a number off a panel.
 *
 * ## Where the tolerances come from
 *
 * Not from taste. **Jon cannot sort W from X by eye** — asked and answered — so
 * whatever W and X differ by is, by observation, invisible. That pair is the
 * unit of invisibility, and every `jnd` here is set at or above the measured
 * W<->X gap on that measure. `separability.probe.ts` prints both columns, so
 * the derivation is re-runnable rather than asserted.
 *
 * Gaps are **absolute, on each measure's own scale**, not ratios. Ratios were
 * what the old suite used and they are wrong twice over: they explode near zero
 * (hence the `Math.max(0.02, ...)` guard the old helper needed) and they are
 * meaningless for a signed quantity, where +0.7 and -0.7 are as far apart as
 * behaviour gets and their ratio is 1.
 */
export interface Measure {
  key: string
  /** What a viewer would say if two populations differed on this. */
  visible: string
  get: (o: ObservationResult) => number
  /**
   * Just-noticeable difference: the largest gap on this measure that is still
   * invisible. Must be >= the measured W<->X gap, since that pair is confirmed
   * indistinguishable.
   */
  jnd: number
}

/**
 * Observation conditions.
 *
 * These match the Lineages tab exactly — same bounds, same 0.3 start ring, same
 * per-vehicle headings, light strength 4, no sensor noise. That correspondence
 * is the reason a headless test can stand in for watching at all, and it is
 * load-bearing: if the tab and the test ever drift apart, the suite goes back to
 * measuring something nobody sees.
 */
export const OBSERVE_OPTS = { startRadius: 0.3, lightStrength: 4, duration: 30 }

export const MEASURES: Measure[] = [
  {
    key: 'meanSpeed',
    visible: 'drives forwards vs drives backwards',
    get: (o) => o.meanSpeed,
    jnd: 0.45, // W<->X 0.239
  },
  {
    key: 'reverseFraction',
    visible: 'spends part of the run backing up',
    get: (o) => o.reverseFraction,
    jnd: 0.10, // W<->X 0.003
  },
  {
    key: 'stoppedFraction',
    visible: 'parks vs keeps moving',
    get: (o) => o.stoppedFraction,
    jnd: 0.20, // W<->X 0.058
  },
  {
    key: 'meanTurnRate',
    visible: 'spins vs drives straight',
    get: (o) => o.meanTurnRate,
    jnd: 0.80, // W<->X 0.515
  },
  {
    key: 'meanTurnTowardsRate',
    visible: 'swings to face the light vs swings away from it',
    get: (o) => o.meanTurnTowardsRate,
    jnd: 0.40, // W<->X 0.199
  },
  {
    key: 'meanFinalHeadingError',
    visible: 'ends up facing the light vs facing away',
    get: (o) => o.meanFinalHeadingError,
    jnd: 0.50, // W<->X 0.149
  },
  {
    key: 'wallFraction',
    visible: 'pinned against the rim vs out on the floor',
    get: (o) => o.wallFraction,
    jnd: 0.15, // W<->X 0.000
  },
  {
    key: 'openingSpeed',
    visible: 'what it does in the first five seconds',
    get: (o) => o.openingSpeed,
    jnd: 0.50, // W<->X 0.200
  },
  {
    key: 'speedHeterogeneity',
    visible: 'moves as a body vs visibly disagrees with itself',
    get: (o) => o.speedHeterogeneity,
    jnd: 0.30, // W<->X 0.112
  },
  {
    key: 'meanDistanceSpread',
    visible: 'holds station vs keeps swinging past',
    get: (o) => o.meanDistanceSpread,
    jnd: 0.30, // W<->X 0.090
  },
  {
    key: 'meanTimeToArrival',
    visible: 'gets there quickly vs slowly',
    get: (o) => o.meanTimeToArrival,
    jnd: 2.00, // W<->X 0.483
  },
  {
    key: 'meanDistance',
    visible: 'settles close in vs further out',
    get: (o) => o.meanDistance,
    jnd: 0.90, // W<->X 0.206
  },
]

export interface Gap {
  measure: Measure
  gap: number
  worst: [string, string]
}

/** The largest pairwise gap on every measure, across a set of populations. */
export function gaps(
  populations: readonly { id: string; observation: ObservationResult }[],
): Gap[] {
  return MEASURES.map((measure) => {
    let gap = 0
    let worst: [string, string] = ['', '']
    for (let i = 0; i < populations.length; i++) {
      for (let j = i + 1; j < populations.length; j++) {
        const d = Math.abs(
          measure.get(populations[i].observation) -
            measure.get(populations[j].observation),
        )
        if (d > gap) {
          gap = d
          worst = [populations[i].id, populations[j].id]
        }
      }
    }
    return { measure, gap, worst }
  })
}

/** Measures on which a set of populations is tellable apart by watching. */
export function tells(
  populations: readonly { id: string; observation: ObservationResult }[],
): Gap[] {
  return gaps(populations).filter((g) => g.gap > g.measure.jnd)
}

export const describeGaps = (gs: readonly Gap[]): string =>
  gs
    .map(
      (g) =>
        `${g.measure.key} ${g.gap.toFixed(3)} > ${g.measure.jnd} (${g.worst.join(
          ' vs ',
        )}) — ${g.measure.visible}`,
    )
    .join('; ')

// ---------------------------------------------------------------------------
// Part 3's acceptance criteria.
//
// Defined here rather than in either test file because both engines assert them
// and two copies of a criterion are two things free to drift apart. The tests
// supply the fixtures; this supplies what is required of them.
// ---------------------------------------------------------------------------

/**
 * What §6 asked for, what replaced it, and why that is not the same as giving up.
 *
 * §6 required W, X and Y to be indistinguishable in the default world. That is
 * **unsatisfiable in this engine**, and not for want of searching: an inhibitory
 * approacher reverses whenever sensed intensity exceeds `bias / |w|`, and it
 * steers by `|w| ×` the intensity *difference* — the same intensity scale. Any
 * light bright enough to steer by is bright enough to reverse in. Raising the
 * bias to open a window instead inflates the turning radius, because bias
 * cancels out of `a_R − a_L` but not out of `a_R + a_L`, so the creature stops
 * being able to curve into the light at all. Measured across 108 configurations
 * of bias floor, light strength, light height and reverse-clamping, plus every
 * pool-Q run that reached a clean 3a: reversal was never once near the threshold
 * of invisibility. Reversal is not a side effect of how a 3a approaches. It is
 * how a 3a approaches.
 *
 * And the mechanism space is closed. Of the six varieties only 2b and 3a turn
 * toward a source and stay — 2a flees, 3b wanders off, and the two
 * fully-connected patterns drive both actuators identically and cannot steer at
 * all. W and X must share wiring, since that is the homology; Y must differ,
 * since that is the analogy. So it is always two-against-one on wiring, and
 * reversal tracks wiring.
 *
 * So the lab stopped claiming they match. Part 3 now asks which populations do
 * the same *job*, and Y approaching backwards is still Y approaching. The four
 * criteria below are what that claim needs to be true, and the second of them is
 * the one that keeps this honest: retiring a test is only legitimate if the
 * replacement claim is written down and checked, or it is just a deletion with
 * a reason attached.
 */
export const SAME_JOB = {
  /** Every approacher must actually reach the light. */
  minArrived: 0.5,
  /** ...and stay near it rather than passing through. */
  maxMeanDistance: 2.5,
  /** Z must not, by a clear margin. */
  maxFleerArrived: 0.15,
  minFleerDistanceRatio: 1.8,
} as const

/**
 * Which measures Y is *allowed* to differ from W and X on.
 *
 * This is the battery inverted. While §6 stood, the requirement was that no
 * measure separate them; now that the handout says outright that Y approaches
 * backwards, the requirement is that **the separation is exactly what the
 * handout describes and nothing more**.
 *
 * `mustDiffer` is the claim the handout makes, so a Y that stopped reversing
 * would fail here and the handout would need rewriting. `mayDiffer` are
 * consequences of the same single fact — a creature travelling backwards
 * necessarily has a different opening, swings the other way relative to the
 * light, and is less uniform — so they are permitted but not required.
 *
 * Everything else in `MEASURES` must match. If a regenerated Y also parked, span
 * on the spot, hugged the rim, took visibly longer to arrive or settled further
 * out, the description a student is given would be wrong in a new way, and this
 * is what fails.
 */
export const Y_SPECIFICATION = {
  mustDiffer: ['meanSpeed', 'reverseFraction'],
  mayDiffer: ['meanTurnTowardsRate', 'openingSpeed', 'speedHeterogeneity'],
} as const

/** Divergence, measured on station-keeping alone. See `PERTURBATIONS`. */
export const DIVERGENCE = {
  /** §10's factor of two, on within-vehicle spread of distance. */
  minRatio: 2,
  /** ...achieved by at least this many of the perturbations offered. */
  minPerturbations: 2,
} as const

/** Ratio of two positive quantities, guarded against a near-zero denominator. */
export const positiveRatio = (a: number, b: number) =>
  Math.max(a, b) / Math.max(0.02, Math.min(a, b))
