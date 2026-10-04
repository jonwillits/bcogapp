import { activate, activationSlope, type Activation, type RateUnit } from '../bilaterian/unit'
import { cloneCircuit, setWiring, type Circuit } from '../bilaterian/circuit'
import { learnWeights, thirdFactor, weightChange, type ConnectionLimits } from '../bilaterian/learning/rule'
import type { Rng } from '../random'

/**
 * The fish's nervous system: receptors → a hidden layer → one output unit.
 *
 * It is Lab 4's layer and Lab 5's rule, not a second engine. The units are
 * `RateUnit`s, the hidden layer is the circuit's interneurons, and the output
 * is the circuit's `output` unit — the one thing Labs 4 and 5 forbid, lifted
 * here and nowhere else. A stored weight is written by `setWiring` (the
 * student's hand) or by `learnWeights` (the rule), and by nothing in this
 * file (`fish/oneWriter.test.ts`).
 *
 * **Nothing here keeps a record of a particular occasion.** The fish holds
 * its weights, and the activity of its own units for the one encounter in
 * front of it. Every field is a fixed number of numbers, overwritten in
 * place. The dots on the feature-space plot belong to the experimenter and
 * live in the world, not here.
 */

/**
 * The fish's sigmoid is gentler than Lab 4's (0.15). A rule that scales a
 * hidden unit's change by its slope needs a slope that is not zero almost
 * everywhere. Chosen together with the weight range below; the measurements
 * are in `docs/M07_AS_BUILT_NOTES.md` §5.
 */
export const FISH_SIGMOID_WIDTH = 0.25

/** The slider range, and so the range the rule can reach: a learned weight is one a student could set. */
export const FISH_WEIGHT_RANGE = { min: -6, max: 6, step: 0.1 } as const
export const FISH_BASELINE_RANGE = { min: -6, max: 6, step: 0.1 } as const
export const FISH_THRESHOLD_RANGE = { min: -6, max: 6, step: 0.1 } as const
/** The criterion is the output unit's threshold, on the evidence axis. */
export const CRITERION_RANGE = { min: -3, max: 3, step: 0.05 } as const

export const MAX_TRAINED_HIDDEN = 8
export const MAX_RANDOM_HIDDEN = 200

/** η. Log scale on the slider. */
export const FISH_RATE_RANGE = { min: 0.01, max: 1 } as const

/** Who sets the hidden weights — §7.2.7's answers, plus the hand. */
export type HiddenMode = 'hand' | 'pass-back' | 'random'

export interface HiddenModeSpec {
  id: HiddenMode
  label: string
  /** What a hidden weight's change depends on. */
  dependsOn: string
  /** The line under the setting. */
  line: string
  section: string
}

export const HIDDEN_MODES: readonly HiddenModeSpec[] = [
  {
    id: 'hand',
    label: 'By hand',
    dependsOn: 'Nothing. Only the sliders move the hidden weights.',
    line: 'The rule changes the output unit’s weights and leaves the hidden layer where you put it.',
    section: '§7.2.6',
  },
  {
    id: 'pass-back',
    label: 'Pass the error back',
    dependsOn:
      'Each hidden unit’s share of the error, passed back from the output through the same connections the activity came forward on, scaled by the unit’s slope.',
    line: 'Each connection still changes by its input times its unit’s share of the error. A hidden unit’s share comes back from the units it feeds.',
    section: '§7.2.7, backpropagation',
  },
  {
    id: 'random',
    label: 'Fixed at random',
    dependsOn: 'Nothing. The hidden weights are drawn once from the seed and never change. Only the output’s weights learn.',
    line: 'The fruit fly’s mushroom body is wired like this (§7.3.4). Whether a fish’s pallium is, is not known.',
    section: '§7.2.7, dimensionality expansion and sparse coding',
  },
]

/** The receptors the fish could have been born with, beyond A and B. */
export type BuiltIn = 'both' | 'distance' | 'proportion'

export interface BuiltInSpec {
  id: BuiltIn
  label: string
  respondsTo: string
  arithmetic: string
  line?: string
}

export const BUILT_INS: readonly BuiltInSpec[] = [
  { id: 'both', label: 'Both together', respondsTo: 'A and B present at once', arithmetic: 'x₁ · x₂' },
  {
    id: 'distance',
    label: 'Distance from the ideal strength',
    respondsTo: 'how far the smell is from (0.5, 0.5)',
    arithmetic: '2 · [(x₁ − 0.5)² + (x₂ − 0.5)²]',
  },
  {
    id: 'proportion',
    label: 'Proportion of A',
    respondsTo: 'the share of the smell that is A, whatever its strength',
    arithmetic: 'x₁ / (x₁ + x₂ + 0.02)',
    line: 'A receptor like this would make the fish tolerant of distance. Whether real fish have anything like it is not something this lab claims.',
  },
]

/** A small floor so the proportion is defined when nothing is smelled at all. */
export const PROPORTION_FLOOR = 0.02

export function builtInValue(id: BuiltIn, x1: number, x2: number): number {
  switch (id) {
    case 'both':
      return x1 * x2
    case 'distance':
      return 2 * ((x1 - 0.5) * (x1 - 0.5) + (x2 - 0.5) * (x2 - 0.5))
    case 'proportion':
      return x1 / (x1 + x2 + PROPORTION_FLOOR)
  }
}

/** Which inputs the network has, in order. A and B can be disconnected only by *Proportion only*. */
export interface Receptors {
  raw: boolean
  builtIns: BuiltIn[]
}

export function inputCount(r: Receptors): number {
  return (r.raw ? 2 : 0) + r.builtIns.length
}

export function inputLabels(r: Receptors): string[] {
  const out = r.raw ? ['receptor A', 'receptor B'] : []
  for (const b of r.builtIns) out.push(BUILT_INS.find((s) => s.id === b)!.label)
  return out
}

/** A smell, as the network's inputs. Writes into `into` so scoring a test set allocates nothing. */
export function receptorInputs(r: Receptors, x1: number, x2: number, into: number[] = []): number[] {
  let k = 0
  if (r.raw) {
    into[k++] = x1
    into[k++] = x2
  }
  for (const b of r.builtIns) into[k++] = builtInValue(b, x1, x2)
  into.length = k
  return into
}

export interface FishLearning {
  on: boolean
  /** η. */
  rate: number
  hidden: HiddenMode
  /** Fixed at random only: baselines set so about one unit in ten is active. */
  sparse: boolean
}

export const DEFAULT_FISH_LEARNING: FishLearning = { on: false, rate: 0.2, hidden: 'hand', sparse: false }

/** How big the starting weights are under *Pass the error back*: small, and not all alike. */
export const START_WEIGHT_SPREAD = 1
/** The length of a random unit's weight vector under *Fixed at random*. */
export const RANDOM_WEIGHT_LENGTH = 2.5
/** The share of units active for a typical smell when *Sparse* is on. */
export const SPARSE_ACTIVE_SHARE = 0.1

/** A grid over the smell space, 21 × 21: what "a typical encounter" is measured over, with no random draw. */
const GRID = 21

function unit(weights: number[], baseline = 0, threshold = 0): RateUnit {
  return { baseline, weights, threshold }
}

/**
 * Build a network. This is construction, like `singleInterneuron` in Lab 4:
 * it makes new units and writes into none that exist.
 *
 * - `hand`: every hidden weight zero, for the student to set.
 * - `pass-back`: small random weights, so no two hidden units start alike.
 * - `random`: each unit a random direction in the input space with its line
 *   through a random point of the smell space; with `sparse`, its baseline
 *   moved until it is active for one typical smell in ten.
 *
 * The output's weights start at zero in every mode.
 */
export function buildNetwork(
  receptors: Receptors,
  hidden: number,
  mode: HiddenMode,
  sparse: boolean,
  activation: Activation,
  rng: Rng,
): Circuit {
  const n = inputCount(receptors)
  const units: RateUnit[] = []
  for (let j = 0; j < hidden; j++) {
    if (mode === 'hand') {
      units.push(unit(new Array<number>(n).fill(0)))
    } else if (mode === 'pass-back') {
      const w = Array.from({ length: n }, () => rng.range(-START_WEIGHT_SPREAD, START_WEIGHT_SPREAD))
      units.push(unit(w, rng.range(-START_WEIGHT_SPREAD, START_WEIGHT_SPREAD)))
    } else {
      units.push(randomUnit(receptors, sparse, rng))
    }
  }
  return {
    activation,
    interneurons: units,
    routes: [],
    output: unit(new Array<number>(hidden > 0 ? hidden : n).fill(0)),
  }
}

function randomUnit(receptors: Receptors, sparse: boolean, rng: Rng): RateUnit {
  const n = inputCount(receptors)
  // A random direction: normal draws, scaled to a fixed length.
  const w = Array.from({ length: n }, () => rng.normal())
  const len = Math.hypot(...w) || 1
  for (let i = 0; i < n; i++) w[i] = (w[i] / len) * RANDOM_WEIGHT_LENGTH
  const cx = rng.next()
  const cy = rng.next()
  const x: number[] = []
  if (!sparse) {
    receptorInputs(receptors, cx, cy, x)
    let at = 0
    for (let i = 0; i < n; i++) at += w[i] * x[i]
    return unit(w, clamp(-at, FISH_BASELINE_RANGE.min, FISH_BASELINE_RANGE.max))
  }
  const sums: number[] = []
  for (let a = 0; a < GRID; a++)
    for (let b = 0; b < GRID; b++) {
      receptorInputs(receptors, a / (GRID - 1), b / (GRID - 1), x)
      let s = 0
      for (let i = 0; i < n; i++) s += w[i] * x[i]
      sums.push(s)
    }
  sums.sort((p, q) => p - q)
  const cut = sums[Math.floor(sums.length * (1 - SPARSE_ACTIVE_SHARE))]
  return unit(w, clamp(-cut, FISH_BASELINE_RANGE.min, FISH_BASELINE_RANGE.max))
}

/** The output unit's prediction: the sigmoid of the evidence, and of nothing else. The criterion is not in it. */
export function predictionOf(evidence: number): number {
  return 1 / (1 + Math.exp(-evidence / FISH_SIGMOID_WIDTH))
}

/** Scratch space for a forward pass, so scoring a test set allocates nothing. */
export interface Scratch {
  x: number[]
  net: number[]
  h: number[]
}

export function makeScratch(): Scratch {
  return { x: [], net: [], h: [] }
}

/**
 * The evidence for a smell: the output unit's net input, b₀ + Σ bⱼhⱼ. The
 * output unit's threshold — the criterion — is deliberately not in it.
 */
export function evidenceFor(c: Circuit, receptors: Receptors, x1: number, x2: number, s: Scratch): number {
  const x = receptorInputs(receptors, x1, x2, s.x)
  const out = c.output!
  const hidden = c.interneurons
  let ev = out.baseline
  if (hidden.length === 0) {
    for (let i = 0; i < x.length; i++) ev += out.weights[i] * x[i]
    s.net.length = 0
    s.h.length = 0
    return ev
  }
  for (let j = 0; j < hidden.length; j++) {
    const u = hidden[j]
    let net = u.baseline
    for (let i = 0; i < x.length; i++) net += u.weights[i] * x[i]
    s.net[j] = net
    const h = activate(c.activation, net, u.threshold, FISH_SIGMOID_WIDTH)
    s.h[j] = h
    ev += out.weights[j] * h
  }
  s.net.length = hidden.length
  s.h.length = hidden.length
  return ev
}

/** One hidden unit's output for a smell — what its thumbnail is drawn from. */
export function hiddenOutputFor(c: Circuit, receptors: Receptors, j: number, x1: number, x2: number, s: Scratch): number {
  const x = receptorInputs(receptors, x1, x2, s.x)
  const u = c.interneurons[j]
  let net = u.baseline
  for (let i = 0; i < x.length; i++) net += u.weights[i] * x[i]
  return activate(c.activation, net, u.threshold, FISH_SIGMOID_WIDTH)
}

/** What the rule did on the last encounter, for the printed arithmetic. Overwritten, never appended to. */
export interface LastChange {
  /** Φ at the output: a − p. */
  phiOut: number
  /** Φ at each hidden unit. */
  phiHidden: number[]
  /** f′(net) at each hidden unit. */
  slope: number[]
  /** Δb per output connection. */
  output: number[]
  outputBaseline: number
  /** Δb per hidden connection, [unit][input]. */
  hidden: number[][]
  hiddenBaseline: number[]
}

export class FishBrain {
  circuit: Circuit
  receptors: Receptors
  readonly settings: FishLearning

  /** The inputs for the smell now in front of the fish. */
  readonly x: number[] = []
  /** Each hidden unit's net input and output for it. */
  readonly net: number[] = []
  readonly h: number[] = []
  /** The evidence for it. */
  evidence = 0
  /**
   * The held prediction. `value` was generated when the smell arrived, at
   * encounter `madeAt`, and is not recomputed when the outcome does. This
   * register is what earns the word *predicts* (§5.2.6).
   */
  readonly held = { value: 0.5, madeAt: -1 }
  /** Whether a smell has been sensed whose outcome has not arrived. */
  awaiting = false
  readonly last: LastChange = {
    phiOut: 0,
    phiHidden: [],
    slope: [],
    output: [],
    outputBaseline: 0,
    hidden: [],
    hiddenBaseline: [],
  }
  private readonly scratch = makeScratch()

  constructor(circuit: Circuit, receptors: Receptors, settings: Partial<FishLearning> = {}) {
    this.circuit = circuit
    this.receptors = { raw: receptors.raw, builtIns: [...receptors.builtIns] }
    this.settings = { ...DEFAULT_FISH_LEARNING, ...settings }
  }

  /** A new network in place of the old one: a different number of units, or different receptors. */
  replace(circuit: Circuit, receptors: Receptors): void {
    this.circuit = circuit
    this.receptors = { raw: receptors.raw, builtIns: [...receptors.builtIns] }
    this.awaiting = false
  }

  /** The smell arrives. The prediction is made now, and held. */
  sense(x1: number, x2: number, encounter: number): void {
    this.evidence = evidenceFor(this.circuit, this.receptors, x1, x2, this.scratch)
    copyInto(this.x, this.scratch.x)
    copyInto(this.net, this.scratch.net)
    copyInto(this.h, this.scratch.h)
    this.held.value = predictionOf(this.evidence)
    this.held.madeAt = encounter
    this.awaiting = true
  }

  /** How many hidden units are active (at or above half) for the smell in front of the fish. */
  get activeHidden(): number {
    let k = 0
    for (const v of this.h) if (v >= 0.5) k++
    return k
  }

  /**
   * The outcome arrives: a = 1 if it happened, 0 if it did not. Every
   * connection changes by Δb = η · x · Φ, and `thirdFactor` supplies every Φ:
   * the output's from the world (a − p, the prediction held), a hidden
   * unit's from the output it feeds.
   */
  resolve(a: number): void {
    if (!this.awaiting) return
    this.awaiting = false
    const s = this.settings
    const c = this.circuit
    const out = c.output!
    const hidden = c.interneurons
    const last = this.last
    if (!s.on) {
      last.phiOut = 0
      last.phiHidden.length = 0
      last.slope.length = 0
      last.output.length = 0
      last.outputBaseline = 0
      last.hidden.length = 0
      last.hiddenBaseline.length = 0
      return
    }

    // Φ at the output: Lab 5's Prediction setting, unchanged.
    const phiOut = thirdFactor('prediction', {
      output: this.held.value,
      weakening: false,
      usualOutput: 0,
      arriving: a,
      heldPrediction: this.held.value,
      target: null,
      broadcast: 0,
    })
    last.phiOut = phiOut

    // Φ at each hidden unit, from the unit it feeds — computed before any
    // weight moves, through the connection the activity went forward on.
    const passBack = s.hidden === 'pass-back'
    last.phiHidden.length = hidden.length
    last.slope.length = hidden.length
    for (let j = 0; j < hidden.length; j++) {
      const slope = activationSlope(c.activation, this.net[j], hidden[j].threshold, FISH_SIGMOID_WIDTH)
      last.slope[j] = slope
      last.phiHidden[j] = passBack
        ? thirdFactor('passed-back', {
            output: this.h[j],
            weakening: false,
            usualOutput: 0,
            arriving: null,
            heldPrediction: 0,
            target: null,
            broadcast: 0,
            slope,
            downstream: [{ weight: out.weights[j], phi: phiOut }],
          })
        : 0
    }

    // Δb = η · x · Φ, for every connection.
    const outIn = hidden.length > 0 ? this.h : this.x
    last.output.length = outIn.length
    for (let i = 0; i < outIn.length; i++) last.output[i] = weightChange(s.rate, outIn[i], phiOut)
    last.outputBaseline = weightChange(s.rate, 1, phiOut)
    last.hidden.length = hidden.length
    last.hiddenBaseline.length = hidden.length
    for (let j = 0; j < hidden.length; j++) {
      const row = (last.hidden[j] ??= [])
      row.length = this.x.length
      for (let i = 0; i < this.x.length; i++) row[i] = weightChange(s.rate, this.x[i], last.phiHidden[j])
      last.hiddenBaseline[j] = weightChange(s.rate, 1, last.phiHidden[j])
    }

    learnWeights(out, last.output, LIMITS, false, {
      change: last.outputBaseline,
      min: FISH_BASELINE_RANGE.min,
      max: FISH_BASELINE_RANGE.max,
    })
    if (passBack) {
      for (let j = 0; j < hidden.length; j++) {
        learnWeights(hidden[j], last.hidden[j], LIMITS, false, {
          change: last.hiddenBaseline[j],
          min: FISH_BASELINE_RANGE.min,
          max: FISH_BASELINE_RANGE.max,
        })
      }
    }
  }
}

/** Every connection is plastic between the slider's ends. One list, long enough for the widest unit. */
const LIMITS: readonly ConnectionLimits[] = Array.from({ length: MAX_RANDOM_HIDDEN + 8 }, () => ({
  plastic: true,
  min: FISH_WEIGHT_RANGE.min,
  max: FISH_WEIGHT_RANGE.max,
}))

function copyInto(into: number[], from: readonly number[]): void {
  into.length = from.length
  for (let i = 0; i < from.length; i++) into[i] = from[i]
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

/**
 * The chapter's hand-built network for the fruit (`f-xor-three-ways`): OR,
 * NOT-AND, then AND, each with weights of 1 or −1. Each unit's line is placed
 * with its baseline, and every threshold is left at zero, so the output's
 * criterion stays neutral and the network can be handed to the rule as it is.
 */
export function chapterXorNetwork(): Circuit {
  const c = buildNetwork({ raw: true, builtIns: [] }, 2, 'hand', false, 'threshold', NO_DRAWS)
  setWiring(c, { interneuron: 0, weight: { input: 0, value: 1 } })
  setWiring(c, { interneuron: 0, weight: { input: 1, value: 1 } })
  setWiring(c, { interneuron: 0, baseline: -0.5 })
  setWiring(c, { interneuron: 1, weight: { input: 0, value: -1 } })
  setWiring(c, { interneuron: 1, weight: { input: 1, value: -1 } })
  setWiring(c, { interneuron: 1, baseline: 1.5 })
  setWiring(c, { layer: 'output', weight: { input: 0, value: 1 } })
  setWiring(c, { layer: 'output', weight: { input: 1, value: 1 } })
  setWiring(c, { layer: 'output', baseline: -1.5 })
  return cloneCircuit(c)
}

/** A stream for construction that draws nothing — `hand` mode never asks it for a number. */
const NO_DRAWS: Rng = {
  next: () => 0,
  range: () => 0,
  int: () => 0,
  normal: () => 0,
  fork: () => NO_DRAWS,
}
