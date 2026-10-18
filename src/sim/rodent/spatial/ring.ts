import { activate, type RateUnit } from '../../bilaterian/unit'
import { learnWeights, thirdFactor, weightChange, USUAL_OUTPUT_TAU_S, type ConnectionLimits } from '../../bilaterian/learning/rule'
import type { Rng } from '../../random'
import { TAU, angleDiff, wrap } from './angles'

/**
 * The head-direction system of the Module 9 spec's §6.2: **two rings built
 * from Lab 4's rate units.**
 *
 * **The lower ring generates the heading.** It is the ring attractor of
 * §9.2.4: `N` units, each standing for one direction; each excites its near
 * neighbors through a bell-shaped weight and every unit feeds a shared
 * inhibition, so the ring settles into one bump. Every lower unit is a Lab 4
 * rate unit whose inputs are, in order: the ring's own rates; those rates
 * multiplied by the turn signal (an asymmetric weight, the derivative of the
 * symmetric one, so that a turn slides the bump around the ring: Zhang's
 * 1996 mechanism, the standard one); a steady background drive carried by
 * the turn pathway; and that unit's own landmark nudge.
 *
 * **The bump depends on the turn pathway being intact, not only on
 * turning.** The background drive is part of what holds the bump above
 * threshold. Remove the pathway (the vestibular lesion of §9.3.1) and the
 * drive goes with the turn information: the ring is then too weakly driven
 * to hold a bump against its own noise, and its activity flickers without
 * settling anywhere. That is the one assumption here that the reading does
 * not state (spec §6.2), and `docs/M09_AS_BUILT_NOTES.md` lists it.
 *
 * **The upper ring holds the cells the student sees.** Same size, no
 * connections among its own units; each is driven by its counterpart below
 * through one fixed weight, so a bump below is a bump above and a flicker
 * below is a flicker above.
 *
 * **Landmark input enters at the upper ring and learns there.** Each
 * landmark the system knows of drives a small set of view units, one per
 * direction the landmark can appear in relative to the head. Their weights
 * onto the upper ring start at zero and learn by Lab 5's Coincidence rule —
 * Δbᵢ = η · xᵢ · Φ with Φ = y, the receiving unit's own output, through
 * `thirdFactor('coincidence')` — and are written only by `learnWeights`
 * (`oneWriter.test.ts`). That is the one learner in the scene.
 *
 * **The learned landmark input reaches the lower ring only as a nudge**: a
 * small, bounded input (`NUDGE_MAX`) that can pull a standing bump toward
 * the landmark's learned alignment and can neither make a bump nor hold one
 * by itself (`ring.test.ts`). A landmark corrects a heading; it cannot
 * supply one (§9.3.1).
 */

/** Units on each ring. Eight of the upper ring's are drawn as polar plots, every eighth. */
export const N = 64

/**
 * The lower ring's recurrent weights: a bell of this width (radians) about
 * each unit, minus a uniform inhibition. Mutable only so that
 * `tune.probe.ts` can sweep them; nothing in the scene writes here.
 */
export const RING = {
  excitation: 0.16,
  excitationWidth: (25 * Math.PI) / 180,
  inhibition: 0.114,
  /** The resting drive of a lower unit with no inputs, below threshold: alone, a unit fires at about 0.15. */
  baseline: 0.65,
  threshold: 1.0,
  width: 0.2,
  /** The steady drive the turn pathway supplies whether or not the rat is turning. */
  background: 1.0,
  /** Time constant of a unit's rate, seconds. */
  tau: 0.05,
  /** Seeded noise added to every lower unit's net input each step. */
  noise: 0.04,
  /**
   * What is left of the drive once the turn pathway is removed: other
   * inputs, not enough to hold a bump. Below `CRITICAL_DRIVE` by a margin
   * wider than the nudge, so that the card cannot make up the difference.
   */
  lesionedBackground: 0.45,
}

/** The least background drive at which a settled bump persists, measured by `ring.test.ts` (the probe sweeps it). */
export const CRITICAL_DRIVE = 0.68

/**
 * How strongly the turn signal's asymmetric input moves the bump. Set so
 * that a turn moves the bump by the same angle, slow or fast, measured by
 * `ring.test.ts` over 30°/s and 180°/s. The asymmetric weight is the
 * derivative of the symmetric one times this.
 */
export const TURN_GAIN = 0.05

/** The upper ring: one fixed weight from the lower counterpart, a threshold, a width. */
export const UPPER = { fromLower: 3.0, threshold: 0.8, width: 0.25 } as const

/** View units per landmark: one per direction the landmark can appear in relative to the head, with this tuning width. */
export const VIEW_UNITS = 12
export const VIEW_WIDTH = (18 * Math.PI) / 180

/**
 * A learned landmark weight saturates here. Kept small on purpose: the
 * landmark input on the upper ring is a fraction of the lower ring's drive,
 * so that after the lesion the upper ring shows the lower ring's flicker and
 * not the card (§9.3.1: the signal never came back with the card in view).
 */
export const LANDMARK_WEIGHT_MAX = 0.08
/** η for the landmark weights, per second of coactivity. Sets how many minutes a card takes to gain control (§9.3.1: about 8, not 1). */
export const LANDMARK_RATE = 0.002

/** The nudge: the summed landmark input onto a lower unit, times this gain, clamped to ±NUDGE_MAX. */
export const NUDGE_GAIN = 0.3
export const NUDGE_MAX = 0.03

/**
 * `controlOf` at or above this means the landmark's learned input can pull
 * a standing bump to its alignment (measured: `ring.test.ts`, the displaced
 * bump). The scene prints a card as having taken control when it crosses it.
 */
export const CONTROL_BAR = 0.5

/** A landmark the system can see this step: which one, and where it appears relative to the head. */
export interface LandmarkView {
  id: string
  /** Egocentric bearing, radians, counterclockwise positive, 0 straight ahead. */
  bearing: number
  /** 0 to 1: how fully it is seen (distance and light). */
  strength: number
}

const LOWER_INPUTS = 2 * N + 2

function bell(d: number, width: number): number {
  return Math.exp(-(d * d) / (2 * width * width))
}

/** One lower unit's weights over [rates, turn·rates, background, own nudge]. */
function lowerUnit(j: number): RateUnit {
  const w = new Array<number>(LOWER_INPUTS).fill(0)
  for (let k = 0; k < N; k++) {
    const d = angleDiff((TAU * j) / N, (TAU * k) / N)
    const sym = RING.excitation * bell(d, RING.excitationWidth) - RING.inhibition
    // d(bell)/d(d) = −d/width² · bell; the sign makes a positive (counterclockwise) turn signal move the bump toward larger j.
    const asym = -RING.excitation * (d / (RING.excitationWidth * RING.excitationWidth)) * bell(d, RING.excitationWidth)
    w[k] = sym
    w[N + k] = TURN_GAIN * asym
  }
  w[2 * N] = RING.background
  w[2 * N + 1] = 1
  return { baseline: RING.baseline, threshold: RING.threshold, weights: w }
}

/** One upper unit: the fixed weight from below, then `VIEW_UNITS` zero weights for each landmark the system knows of. */
function upperUnit(landmarks: number): RateUnit {
  const w = new Array<number>(1 + landmarks * VIEW_UNITS).fill(0)
  w[0] = UPPER.fromLower
  return { baseline: 0, threshold: UPPER.threshold, weights: w }
}

export class HeadDirection {
  /** Preferred direction of unit j on either ring, radians. */
  static preferred(j: number): number {
    return (TAU * j) / N
  }

  readonly lower: RateUnit[]
  readonly upper: RateUnit[]
  readonly lowerRate = new Float64Array(N)
  readonly upperRate = new Float64Array(N)
  /** The landmark nudge delivered to each lower unit last step, after the clamp. */
  readonly nudge = new Float64Array(N)
  /** The landmark input each upper unit received last step, before the nudge's gain and clamp. */
  readonly landmarkDrive = new Float64Array(N)
  /** The landmarks with view units, in the order their weights sit after the lower-drive weight. A landmark not listed is not seen. */
  readonly landmarkIds: readonly string[]
  /** View-unit activity last step, `VIEW_UNITS` per known landmark. */
  readonly viewActivity: Float64Array
  /** Whether the turn pathway is intact. Removing it removes the turn signal and the background drive together. */
  pathway = true
  /** Whether the landmark weights may change. Off during a settle; on in the scene. */
  learning = true
  /** Probe only: scales the background drive, to find the least drive that holds a bump. */
  driveScale = 1
  time = 0
  private readonly rng: Rng
  private readonly lowerInput = new Float64Array(LOWER_INPUTS)
  private readonly next = new Float64Array(N)
  private readonly limits: ConnectionLimits[]
  private readonly changes: number[]
  /** Each upper unit's recent average output: what weakening measures its output against (Lab 5's `usualOutput`). */
  readonly usual = new Float64Array(N)

  constructor(rng: Rng, landmarkIds: readonly string[], startHeading = 0) {
    this.rng = rng
    this.landmarkIds = [...landmarkIds]
    this.lower = Array.from({ length: N }, (_, j) => lowerUnit(j))
    this.upper = Array.from({ length: N }, () => upperUnit(landmarkIds.length))
    this.viewActivity = new Float64Array(landmarkIds.length * VIEW_UNITS)
    this.limits = [{ plastic: false, min: UPPER.fromLower, max: UPPER.fromLower }]
    for (let i = 0; i < this.viewActivity.length; i++) this.limits.push({ plastic: true, min: 0, max: LANDMARK_WEIGHT_MAX })
    this.changes = new Array<number>(1 + this.viewActivity.length).fill(0)
    this.settle(startHeading)
  }

  /** Put a bump at `heading` and let the ring settle on it, with no turn and no landmark. */
  settle(heading: number, seconds = 1): void {
    for (let j = 0; j < N; j++) this.lowerRate[j] = bell(angleDiff(heading, HeadDirection.preferred(j)), RING.excitationWidth)
    const was = this.learning
    this.learning = false
    for (let t = 0; t < seconds / 0.02; t++) this.step(0.02, 0, [], true)
    this.learning = was
  }

  /**
   * One step. `turn` is the turn signal in radians per second as the
   * vestibular pathway reports it (already noisy); it is ignored when the
   * pathway is removed. `quiet` switches the lower ring's noise off, for the
   * drift-with-nothing-pushing test.
   */
  step(dt: number, turn: number, views: readonly LandmarkView[], quiet = false): void {
    this.time += dt
    const omega = this.pathway ? turn : 0
    const bg = (this.pathway ? 1 : RING.lesionedBackground / RING.background) * this.driveScale

    // 1. View units: which direction each landmark in view appears in.
    const x = this.viewActivity
    x.fill(0)
    let seen = false
    for (const v of views) {
      const at = this.landmarkIds.indexOf(v.id)
      if (at < 0 || v.strength <= 0) continue
      seen = true
      for (let i = 0; i < VIEW_UNITS; i++) {
        x[at * VIEW_UNITS + i] = v.strength * bell(angleDiff((TAU * i) / VIEW_UNITS, v.bearing), VIEW_WIDTH)
      }
    }

    // 2. The landmark input each upper unit receives, and from it the nudge to its lower counterpart.
    //    This is the one path from a landmark to the lower ring (`structure.test.ts`).
    const drive = this.landmarkDrive
    drive.fill(0)
    if (seen) {
      for (let j = 0; j < N; j++) {
        const w = this.upper[j].weights
        let s = 0
        for (let i = 0; i < x.length; i++) s += w[1 + i] * x[i]
        drive[j] = s
      }
    }
    for (let j = 0; j < N; j++) this.nudge[j] = boundedNudge(drive[j])

    // 3. The lower ring: a Lab 4 rate unit per direction, integrated with its time constant.
    const inp = this.lowerInput
    for (let k = 0; k < N; k++) {
      inp[k] = this.lowerRate[k]
      inp[N + k] = omega * this.lowerRate[k]
    }
    inp[2 * N] = bg
    const next = this.next
    for (let j = 0; j < N; j++) {
      inp[2 * N + 1] = this.nudge[j]
      const u = this.lower[j]
      let net = u.baseline
      const w = u.weights
      for (let i = 0; i < LOWER_INPUTS; i++) net += w[i] * inp[i]
      if (!quiet) net += RING.noise * this.rng.normal()
      const target = activate('sigmoid', net, u.threshold, RING.width)
      next[j] = this.lowerRate[j] + ((target - this.lowerRate[j]) * dt) / RING.tau
    }
    this.lowerRate.set(next)

    // 4. The upper ring: its lower counterpart through one fixed weight, plus the landmark input.
    for (let j = 0; j < N; j++) {
      const u = this.upper[j]
      const net = u.baseline + u.weights[0] * this.lowerRate[j] + drive[j]
      this.upperRate[j] = activate('sigmoid', net, u.threshold, UPPER.width)
    }

    // 5. Coincidence with weakening: a view weight grows when its view unit and its upper unit are
    //    active together, and shrinks when the view unit is active while the upper unit is quieter than usual.
    for (let j = 0; j < N; j++) this.usual[j] += ((this.upperRate[j] - this.usual[j]) * dt) / USUAL_OUTPUT_TAU_S
    if (this.learning && seen) {
      const changes = this.changes
      for (let j = 0; j < N; j++) {
        const phi = thirdFactor('coincidence', { output: this.upperRate[j], weakening: true, usualOutput: this.usual[j], arriving: null, heldPrediction: 0, target: null, broadcast: 0 })
        changes[0] = 0
        for (let i = 0; i < x.length; i++) changes[1 + i] = x[i] > 0 ? weightChange(LANDMARK_RATE, x[i], phi) * dt : 0
        learnWeights(this.upper[j], changes, this.limits, false)
      }
    }
  }

  /** The heading the lower ring's bump stands for, and how clearly it stands for one: the mean vector of its rates. */
  decodeLower(): { heading: number; strength: number } {
    return decode(this.lowerRate)
  }

  decodeUpper(): { heading: number; strength: number } {
    return decode(this.upperRate)
  }

  /** The heading estimate the rest of the spatial system reads: the upper ring's bump. */
  heading(): number {
    return this.decodeUpper().heading
  }

  /**
   * How firmly a landmark's learned input holds a heading. The nudge the
   * landmark would deliver if it stood straight ahead at full strength is
   * summed as a vector over the lower ring: its peak in units of `NUDGE_MAX`,
   * times how far it points one way (0 when it is spread evenly, 1 when it
   * is all at one unit). Reads weights and does nothing to any ring.
   */
  controlOf(id: string): number {
    const at = this.landmarkIds.indexOf(id)
    if (at < 0) return 0
    let peak = 0
    let sx = 0
    let sy = 0
    let total = 0
    for (let j = 0; j < N; j++) {
      const w = this.upper[j].weights
      let s = 0
      for (let i = 0; i < VIEW_UNITS; i++) s += w[1 + at * VIEW_UNITS + i] * bell(angleDiff((TAU * i) / VIEW_UNITS, 0), VIEW_WIDTH)
      const n = boundedNudge(s)
      peak = Math.max(peak, n)
      const a = HeadDirection.preferred(j)
      sx += n * Math.cos(a)
      sy += n * Math.sin(a)
      total += n
    }
    if (total <= 1e-9) return 0
    return (peak / NUDGE_MAX) * (Math.sqrt(sx * sx + sy * sy) / total)
  }

  /** The learned weights from one landmark's view units onto the upper ring, as a VIEW_UNITS × N table (for the panel). */
  landmarkWeights(id: string): number[][] {
    const at = this.landmarkIds.indexOf(id)
    if (at < 0) return []
    return Array.from({ length: VIEW_UNITS }, (_, i) => this.upper.map((u) => u.weights[1 + at * VIEW_UNITS + i]))
  }

  /** Every learned weight, flattened, for the test that lists what changes during a session. */
  learnedWeights(): number[] {
    const out: number[] = []
    for (const u of this.upper) for (let i = 1; i < u.weights.length; i++) out.push(u.weights[i])
    return out
  }
}

/** The nudge: landmark drive times a small gain, clamped. The clamp is the point. */
export function boundedNudge(landmarkDrive: number): number {
  const n = NUDGE_GAIN * landmarkDrive
  return n > NUDGE_MAX ? NUDGE_MAX : n < -NUDGE_MAX ? -NUDGE_MAX : n
}

function decode(rates: Float64Array): { heading: number; strength: number } {
  let x = 0
  let y = 0
  let total = 0
  for (let j = 0; j < N; j++) {
    const a = HeadDirection.preferred(j)
    x += rates[j] * Math.cos(a)
    y += rates[j] * Math.sin(a)
    total += rates[j]
  }
  if (total <= 1e-9) return { heading: 0, strength: 0 }
  return { heading: wrap(Math.atan2(y, x)), strength: Math.sqrt(x * x + y * y) / total }
}
