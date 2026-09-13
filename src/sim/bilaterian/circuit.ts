import type { Activation, RateUnit } from './unit'

/**
 * The animal's nervous system as the student sees it: sensory cells → an
 * interneuron layer → two motor groups, forward and reverse, that inhibit
 * each other.
 *
 * Built as the general case — *n* sensory inputs to *m* interneurons, each
 * routed to one of *k* motor groups — so that later modules configure it.
 * Lab 4 instantiates it at m = 1. **No student-reachable configuration
 * composes a hidden layer**: there is no second adjustable layer between the
 * interneurons and the motor groups, and `scenarios.test.ts` asserts every
 * shipped circuit has exactly one interneuron. §4.2.5 hands linear
 * inseparability to Module 7; a Lab 4 that could solve XOR would spend that
 * three modules early.
 *
 * **Routing is a first-class control, not a sign buried in a weight.** Each
 * interneuron's verdict goes to the forward group or the reverse group; the
 * switch is a visible object on the diagram. Flip it and approach becomes
 * avoidance with nothing about any cell changed — §4.2.9's labeled line.
 */

export type MotorGroup = 'forward' | 'reverse'

export const MOTOR_GROUPS: readonly MotorGroup[] = ['forward', 'reverse']

export interface Circuit {
  activation: Activation
  /** m interneurons, each with one weight per sensory cell. */
  interneurons: RateUnit[]
  /** Which motor group each interneuron's verdict reaches. */
  routes: MotorGroup[]
}

/** Slider ranges — the whole student-reachable parameter space. */
export const WEIGHT_RANGE = { min: -3, max: 3, step: 0.1 } as const
export const BASELINE_RANGE = { min: -3, max: 3, step: 0.1 } as const
export const THRESHOLD_RANGE = { min: -3, max: 3, step: 0.1 } as const

export interface WiringPatch {
  interneuron?: number
  weight?: { input: number; value: number }
  baseline?: number
  threshold?: number
  route?: MotorGroup
  activation?: Activation
}

/**
 * **The only code path that writes a stored weight, baseline, threshold or
 * route.** It is called from the Circuit tab's controls and from a scenario
 * loader, and from nowhere else — `noLearning.test.ts` walks the sim
 * directory and fails if anything else assigns to them. Nothing learns: the
 * student is the only thing in the room that can change a weight.
 */
export function setWiring(c: Circuit, patch: WiringPatch): void {
  const j = patch.interneuron ?? 0
  const u = c.interneurons[j]
  if (!u) return
  if (patch.weight) u.weights[patch.weight.input] = patch.weight.value
  if (patch.baseline !== undefined) u.baseline = patch.baseline
  if (patch.threshold !== undefined) u.threshold = patch.threshold
  if (patch.route !== undefined) c.routes[j] = patch.route
  if (patch.activation !== undefined) c.activation = patch.activation
}

/** A deep copy, so a loaded scenario's starting wiring is never edited in place. */
export function cloneCircuit(c: Circuit): Circuit {
  return {
    activation: c.activation,
    interneurons: c.interneurons.map((u) => ({
      baseline: u.baseline,
      threshold: u.threshold,
      weights: [...u.weights],
    })),
    routes: [...c.routes],
  }
}

/** One interneuron over `n` inputs — the Lab 4 instantiation. */
export function singleInterneuron(
  weights: number[],
  baseline: number,
  threshold: number,
  route: MotorGroup,
  activation: Activation = 'threshold',
): Circuit {
  return {
    activation,
    interneurons: [{ baseline, weights: [...weights], threshold }],
    routes: [route],
  }
}

/** Every number on the wiring panel, as one string — what the independence test compares. */
export function wiringSignature(c: Circuit): string {
  return JSON.stringify({
    activation: c.activation,
    routes: c.routes,
    units: c.interneurons.map((u) => ({ b0: u.baseline, b: u.weights, theta: u.threshold })),
  })
}
