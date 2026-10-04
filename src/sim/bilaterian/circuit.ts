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
 * **Module 7 is where that ban lifts, and only for its own scene.** A circuit
 * may carry an `output` unit, which reads the interneurons' outputs rather
 * than the sensory cells: the interneurons are then a hidden layer. Nothing
 * in Lab 4's or Lab 5's world reads `output`, no circuit either of them
 * ships has one (`circuit.test.ts`, `learning/structure.test.ts`), and their
 * no-XOR sweeps still run. Only `src/sim/fish/` builds a circuit with one.
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
  /**
   * Module 7 only: one unit that reads the interneurons' outputs, or the
   * inputs themselves when there are no interneurons. Absent — not merely
   * undefined — on every circuit Labs 4 and 5 build.
   */
  output?: RateUnit
}

/** Slider ranges — the whole student-reachable parameter space. */
export const WEIGHT_RANGE = { min: -3, max: 3, step: 0.1 } as const
export const BASELINE_RANGE = { min: -3, max: 3, step: 0.1 } as const
export const THRESHOLD_RANGE = { min: -3, max: 3, step: 0.1 } as const

export interface WiringPatch {
  /** Which unit: an interneuron by index (the default), or Module 7's output unit. */
  layer?: 'output'
  interneuron?: number
  weight?: { input: number; value: number }
  baseline?: number
  threshold?: number
  route?: MotorGroup
  activation?: Activation
}

/**
 * **One of exactly two code paths that write a stored weight, and the only
 * one that writes a baseline, a threshold or a route.** It is called from
 * the Circuit tab's controls and from a scenario loader. In Lab 4 it was the
 * only writer of anything — the student was the only thing in the room that
 * could change a weight — and `noLearning.test.ts` said so. Module 5 retired
 * that test on purpose: the second writer is the learning rule's
 * `learnWeights` in `learning/rule.ts`, and `learning/oneWriter.test.ts`
 * walks the sim directory and fails if a third appears. With no learning
 * layer attached, Lab 4 runs bit-for-bit as it shipped
 * (`learning/lab4Regression.test.ts`).
 */
export function setWiring(c: Circuit, patch: WiringPatch): void {
  const j = patch.interneuron ?? 0
  const u = patch.layer === 'output' ? c.output : c.interneurons[j]
  if (!u) return
  if (patch.weight) u.weights[patch.weight.input] = patch.weight.value
  if (patch.baseline !== undefined) u.baseline = patch.baseline
  if (patch.threshold !== undefined) u.threshold = patch.threshold
  if (patch.route !== undefined && patch.layer !== 'output') c.routes[j] = patch.route
  if (patch.activation !== undefined) c.activation = patch.activation
}

/** A deep copy, so a loaded scenario's starting wiring is never edited in place. */
export function cloneCircuit(c: Circuit): Circuit {
  const unit = (u: RateUnit): RateUnit => ({ baseline: u.baseline, threshold: u.threshold, weights: [...u.weights] })
  const copy: Circuit = {
    activation: c.activation,
    interneurons: c.interneurons.map(unit),
    routes: [...c.routes],
  }
  if (c.output) copy.output = unit(c.output)
  return copy
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
  const unit = (u: RateUnit) => ({ b0: u.baseline, b: u.weights, theta: u.threshold })
  return JSON.stringify({
    activation: c.activation,
    routes: c.routes,
    units: c.interneurons.map(unit),
    ...(c.output ? { output: unit(c.output) } : {}),
  })
}
