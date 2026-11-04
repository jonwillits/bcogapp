import type { RateUnit } from '../../bilaterian/unit'
import { activate } from '../../bilaterian/unit'
import { learnWeights, thirdFactor, weightChange, type ConnectionLimits } from '../../bilaterian/learning/rule'

/**
 * Two premotor cells (spec §10.2): a *precision cell* and a *whole-hand
 * cell*, in the area where the first mirror neurons were recorded, F5
 * (§11.3.5). Each fires when the student's macaque performs its grasp,
 * through a fixed motor input that does not learn. Each has four visual
 * inputs, viewpoint-specific: a precision grip and a whole-hand grasp seen
 * from the macaque's own view (its own hand), and the two seen from across
 * the table (the other macaque's hand). The visual weights start at zero
 * and learn by Lab 5's Prediction setting: the visual inputs make a
 * prediction p of the motor drive, the drive a arrives (1 while the cell's
 * grasp is being performed, 0 otherwise), Φ = a − p through
 * `thirdFactor()`, and Δbᵢ = η · xᵢ · Φ written only by `learnWeights`.
 * That setting is contingency-sensitive: a seen grasp that is as often
 * absent as present when the drive arrives is unlearned as fast as it is
 * learned.
 *
 * **Blocking, and the own hand.** A view of one's own hand that is present
 * on every own grasp predicts the drive perfectly, and the Prediction rule
 * then credits nothing to a seen copy that comes with it (Lab 5's
 * blocking). The macaque here sees its own hand on `OWN_VIEW_SHARE` of its
 * grasps and is looking elsewhere on the rest, a stated modeling choice
 * recorded in the as-built notes and raised on the walk.
 *
 * These are model cells; they do not show what mirror neurons do for the
 * animal (§12, line 22).
 */

export type Grasp = 'precision' | 'wholeHand'
export const GRASPS: readonly Grasp[] = ['precision', 'wholeHand']
export const GRASP_LABEL: Record<Grasp, string> = { precision: 'precision grip', wholeHand: 'whole-hand grasp' }

/** The four visual inputs, in weight order. */
export const VISUAL_INPUTS = ['precision grip seen from my own view', 'whole-hand grasp seen from my own view', 'precision grip seen from across the table', 'whole-hand grasp seen from across the table'] as const
export type VisualInput = 0 | 1 | 2 | 3
export const ownView = (g: Grasp): VisualInput => (g === 'precision' ? 0 : 1)
export const acrossView = (g: Grasp): VisualInput => (g === 'precision' ? 2 : 3)

/** The design constants, swept once in `mirror.probe.ts` before the targets were measured and not retuned after (the as-built notes record the sweep). A probe may override them; nothing in the scene does. */
export const CELLS = {
  /** η, per second. */
  rate: 0.3,
  /** The fixed motor input's weight. */
  motor: 1,
  weightRange: { min: -2, max: 2 },
  /** The cell's output: a sigmoid over its drive, half on at 0.5. */
  threshold: 0.5,
  width: 0.2,
  /** A grasp takes about this long, seconds. */
  graspSeconds: 1.5,
  /** The other macaque's copy begins this long after the student's grasp begins. */
  copyLatency: 0.2,
  /** The share of its own grasps on which the macaque sees its own hand. */
  ownViewShare: 0.3,
}

const LIMITS: ConnectionLimits[] = Array.from({ length: 4 }, () => ({ plastic: true, min: CELLS.weightRange.min, max: CELLS.weightRange.max }))

export class MirrorCell {
  readonly grasp: Grasp
  readonly unit: RateUnit
  /** The prediction made from the visual inputs at the start of the step and held. */
  held = 0
  /** Φ on the last step. */
  phi = 0
  /** The cell's output on the last step. */
  firing = 0

  constructor(grasp: Grasp) {
    this.grasp = grasp
    this.unit = { baseline: 0, threshold: 0, weights: [0, 0, 0, 0] }
  }

  /** The visual inputs' prediction of the motor drive. */
  prediction(x: readonly number[]): number {
    let p = 0
    for (let i = 0; i < 4; i++) p += this.unit.weights[i] * (x[i] ?? 0)
    return p
  }

  /** The output for visual inputs and a motor drive: the fixed motor input plus what the visual weights add. */
  output(x: readonly number[], motor: number): number {
    return activate('sigmoid', CELLS.motor * motor + this.prediction(x), CELLS.threshold, CELLS.width)
  }

  /** One step: the output, and Φ = a − p where a is the motor drive. */
  step(dt: number, x: readonly number[], motor: number, learn: boolean): void {
    this.held = this.prediction(x)
    this.firing = this.output(x, motor)
    if (!learn) {
      this.phi = 0
      return
    }
    this.phi = thirdFactor('prediction', { output: this.firing, weakening: false, usualOutput: 0, arriving: motor, heldPrediction: this.held, target: null, broadcast: 0 })
    const changes = x.map((xi) => weightChange(CELLS.rate, xi, this.phi) * dt)
    learnWeights(this.unit, changes, LIMITS, false)
  }

  reset(): void {
    learnWeights(this.unit, this.unit.weights.map((w) => -w), LIMITS, false)
  }

  /** Take another cell's weights, through the rule's one write. */
  copyFrom(other: MirrorCell): void {
    learnWeights(this.unit, this.unit.weights.map((w, i) => other.unit.weights[i] - w), LIMITS, false)
  }
}

export class MirrorCells {
  readonly precision = new MirrorCell('precision')
  readonly wholeHand = new MirrorCell('wholeHand')

  get cells(): [MirrorCell, MirrorCell] {
    return [this.precision, this.wholeHand]
  }

  cell(g: Grasp): MirrorCell {
    return g === 'precision' ? this.precision : this.wholeHand
  }

  /** One step of both cells: the visual inputs, and which grasp the student's macaque is performing, if any. */
  step(dt: number, x: readonly number[], performing: Grasp | null, learn = true): void {
    this.precision.step(dt, x, performing === 'precision' ? 1 : 0, learn)
    this.wholeHand.step(dt, x, performing === 'wholeHand' ? 1 : 0, learn)
  }

  /** The 4 × 2 weight table: rows the visual inputs, columns the two cells. */
  table(): number[][] {
    return VISUAL_INPUTS.map((_, i) => [this.precision.unit.weights[i], this.wholeHand.unit.weights[i]])
  }

  reset(): void {
    this.precision.reset()
    this.wholeHand.reset()
  }

  copyFrom(other: MirrorCells): void {
    this.precision.copyFrom(other.precision)
    this.wholeHand.copyFrom(other.wholeHand)
  }
}
