import { cloneCircuit, setWiring, type Circuit, type WiringPatch } from '../bilaterian/circuit'
import type { Activation } from '../bilaterian/unit'
import { makeRng, type Rng } from '../random'
import {
  FishBrain,
  buildNetwork,
  evidenceFor,
  inputCount,
  makeScratch,
  type BuiltIn,
  type FishLearning,
  type HiddenMode,
  type Receptors,
} from './brain'
import { KINDS, drawIndividual, sniff, type Kind, type KindId } from './kinds'
import { STAKES_PRESETS, emptyCounts, tally, type Counts, type Stakes } from './sdt'
import type { FishRoute, FishScenario, Mix } from './scenarios'

/**
 * The stream, and the fish holding its place in it.
 *
 * Encounters come to the fish one at a time. Each is a smell, then the fish's
 * verdict, then the outcome — **and the outcome arrives on every encounter,
 * whatever the verdict was.** An eel lunges at empty water if the fish fled; a
 * fruit the fish left is still mouthed. Without that the fish could never
 * learn about anything it avoided, and a hit could never be scored. It is
 * Lab 5's site mechanism.
 *
 * Everything the *experimenter* keeps lives here and not in the fish: the
 * ring of recent encounters drawn on the feature-space plot, the test sets
 * the fish never meets, the learning curve, the scorecard. The fish keeps
 * its weights (`brain.ts`).
 */

/** The two modulators this scene keeps from Lab 4, named as Lab 4 names them. Here they move the criterion and nothing else. */
export type ChemistryId = 'arousal' | 'satiety'

export interface ChemistrySpec {
  id: ChemistryId
  label: string
  does: string
  min: number
  max: number
  healthy: number
}

export const CHEMISTRY: readonly ChemistrySpec[] = [
  {
    id: 'arousal',
    label: 'arousal and vigilance',
    does: 'How readily the fish reacts to anything at all. Raising it lowers the criterion to dart: a jumpier fish.',
    min: 0,
    max: 3,
    healthy: 1,
  },
  {
    id: 'satiety',
    label: 'satiety and tone',
    does: 'How fed the fish is. Lowering it raises the criterion to dart: a hungry fish keeps feeding.',
    min: 0,
    max: 1,
    healthy: 1,
  },
]

/** How far one unit of each modulator moves the criterion, on the evidence axis. */
export const AROUSAL_SHIFT = 0.4
export const SATIETY_SHIFT = 1

export interface Chemistry {
  arousal: number
  satiety: number
}

export function healthyChemistry(): Chemistry {
  return { arousal: 1, satiety: 1 }
}

/**
 * How far the chemistry moves the criterion. For a verdict routed to *dart*,
 * arousal lowers it and hunger raises it. For a verdict routed to *eat* the
 * signs turn over: a hungry fish eats more readily, a vigilant one less.
 */
export function criterionShift(chem: Chemistry, route: FishRoute): { arousal: number; satiety: number; total: number } {
  const sign = route === 'dart' ? 1 : -1
  const arousal = -AROUSAL_SHIFT * (chem.arousal - 1) * sign
  const satiety = SATIETY_SHIFT * (1 - chem.satiety) * sign
  return { arousal, satiety, total: arousal + satiety }
}

export type Distance = 'near' | 'far' | 'both'

export interface WorldSettings {
  /** How much smells vary: how far one eel's smell lies from the typical eel's. */
  spread: number
  source: 'stream' | 'pool'
  poolSize: number
  /** How often the outcome happens: in Part 2, how often an eel is upstream. */
  baseRate: number
  /** Where the things the fish meets are. */
  distance: Distance
  /** Which phase of the scenario the stream is in, from 0. */
  phase: number
  /** The closer: the old kinds stay in the stream through phase 2. */
  stayAround: boolean
  stakes: Stakes
  chemistry: Chemistry
}

export interface Encounter {
  index: number
  kind: KindId
  x1: number
  x2: number
  far: boolean
  /** Which individual of the pool, or −1 in a stream. */
  individual: number
  evidence: number
  /** The held prediction. */
  p: number
  /** The criterion the verdict was taken against. */
  criterion: number
  /** Whether the output's verdict fired: dart, or eat. */
  verdict: boolean
  /** Whether the outcome happened. Known to the world from the start; it reaches the fish at `finish`. */
  happens: boolean
}

export interface TestSet {
  key: string
  label: string
  x1: Float32Array
  x2: Float32Array
  happens: Uint8Array
  kind: KindId[]
}

/** How many recent encounters the experimenter's plot keeps. */
export const RING = 300
/** The learning curve is scored this often, in encounters. */
export const CURVE_STRIDE = 10
/** The learning curve's point budget. When it fills, every other point is dropped and the stride doubles. */
export const CURVE_POINTS = 400

export interface CurvePoint {
  encounter: number
  /** Percent wrong on the ring of recent training encounters. */
  train: number
  /** Percent wrong on each test set. */
  test: number[]
}

export interface WorldOptions {
  settings?: Partial<WorldSettings>
  learning?: Partial<FishLearning>
  hidden?: number
  hiddenMode?: HiddenMode
  sparse?: boolean
  builtIns?: BuiltIn[]
  raw?: boolean
  activation?: Activation
  /** A whole circuit to run instead of the scenario's — the Fish tab's animals. */
  circuit?: Circuit
}

interface SubSeeds {
  init: number
  stream: number
  test: number
  pool: number
  score: number
  anim: number
}

export class FishWorld {
  readonly seed: number
  readonly scenario: FishScenario
  readonly settings: WorldSettings
  readonly brain: FishBrain
  /** The wiring this run started with: what *Reset* restores. */
  private start: Circuit
  private readonly seeds: SubSeeds
  private stream: Rng
  /** How many times new starting weights have been drawn, so each draw differs. */
  private draws = 0
  private scores = 0

  hiddenCount: number
  sparse: boolean

  tests: TestSet[] = []
  pool: { kind: KindId; smell: [number, number]; met: number }[] = []

  /** The encounter in front of the fish whose outcome has not arrived, or null. */
  pending: Encounter | null = null
  /** The last encounter that finished. */
  last: Encounter | null = null
  /** A kind the next encounter must be, once — *An eel comes back*. */
  private forced: KindId | null = null

  encounters = 0
  harm = 0
  meals = 0
  right = 0
  energy = 0
  readonly counts: Counts = emptyCounts()

  /** The experimenter's ring of recent encounters. */
  readonly ring = {
    x1: new Float32Array(RING),
    x2: new Float32Array(RING),
    happens: new Uint8Array(RING),
    right: new Uint8Array(RING),
    kind: new Array<KindId>(RING),
    count: 0,
    next: 0,
  }
  curve: CurvePoint[] = []
  private curveStride = CURVE_STRIDE

  /** Bumped whenever any weight, the network's shape, or a test set changes: what cached instruments key on. */
  version = 0
  private readonly scratch = makeScratch()

  constructor(seed: number, scenario: FishScenario, options: WorldOptions = {}) {
    this.seed = seed >>> 0
    this.scenario = scenario
    const master = makeRng(this.seed)
    const sub = () => Math.floor(master.next() * 0xffffffff) >>> 0
    // Fixed order, so adding a consumer later cannot move an existing stream.
    this.seeds = { init: sub(), stream: sub(), test: sub(), pool: sub(), score: sub(), anim: sub() }
    this.stream = makeRng(this.seeds.stream)
    this.settings = {
      spread: scenario.spread,
      source: scenario.source,
      poolSize: scenario.poolSize,
      baseRate: 0.5,
      distance: 'near',
      phase: 0,
      stayAround: false,
      stakes: { ...STAKES_PRESETS[0].stakes },
      chemistry: healthyChemistry(),
      ...options.settings,
    }
    if (options.settings?.chemistry) this.settings.chemistry = { ...options.settings.chemistry }
    if (options.settings?.stakes) this.settings.stakes = { ...options.settings.stakes }
    this.hiddenCount = options.hidden ?? scenario.hidden
    this.sparse = options.sparse ?? false
    const receptors: Receptors = { raw: options.raw ?? true, builtIns: [...(options.builtIns ?? scenario.builtIns)] }
    const mode = options.hiddenMode ?? scenario.hiddenMode
    const activation = options.activation ?? scenario.activation
    const circuit = options.circuit
      ? cloneCircuit(options.circuit)
      : this.build(receptors, this.hiddenCount, mode, this.sparse, activation, true)
    this.brain = new FishBrain(circuit, receptors, { rate: scenario.rate, hidden: mode, sparse: this.sparse, ...options.learning })
    this.start = cloneCircuit(circuit)
    this.makePool()
    this.makeTests()
  }

  /** The seed of the animation's own stream. Nothing in this file draws from it, so animation cannot perturb a run. */
  get animSeed(): number {
    return this.seeds.anim
  }

  get route(): FishRoute {
    return this.scenario.route
  }

  get mix(): Mix {
    const s = this.scenario
    if (s.phases.length === 1) return s.phases[0]
    // The closer: phase 2 holds the new kinds alone unless the old ones stay around.
    if (this.settings.phase === 1 && this.settings.stayAround) return s.phases[2]
    return s.phases[Math.min(this.settings.phase, s.phases.length - 1)]
  }

  /** The criterion the verdict is taken against: the slider, moved by the chemistry. */
  get effectiveCriterion(): number {
    return this.brain.circuit.output!.threshold + criterionShift(this.settings.chemistry, this.route).total
  }

  // ───────────────────────── the network's shape ─────────────────────────

  private build(receptors: Receptors, hidden: number, mode: HiddenMode, sparse: boolean, activation: Activation, preset: boolean): Circuit {
    const rng = makeRng((this.seeds.init + 7919 * this.draws) >>> 0)
    const c = buildNetwork(receptors, hidden, mode, sparse, activation, rng)
    const p = this.scenario.preset
    if (preset && p && hidden === 0 && inputCount(receptors) === p.weights.length) {
      p.weights.forEach((value, input) => setWiring(c, { layer: 'output', weight: { input, value } }))
      setWiring(c, { layer: 'output', baseline: p.baseline })
    }
    return c
  }

  /**
   * A new network: a different number of hidden units, a different way of
   * setting them, or different receptors. The run starts again from it. The
   * criterion and the activation function are kept.
   */
  reshape(change: { hidden?: number; mode?: HiddenMode; sparse?: boolean; builtIns?: BuiltIn[]; raw?: boolean; redraw?: boolean }): void {
    const b = this.brain
    const criterion = b.circuit.output!.threshold
    const receptors: Receptors = {
      raw: change.raw ?? b.receptors.raw,
      builtIns: change.builtIns ? [...change.builtIns] : b.receptors.builtIns,
    }
    const hidden = change.hidden ?? this.hiddenCount
    const mode = change.mode ?? b.settings.hidden
    const sparse = change.sparse ?? this.sparse
    if (change.redraw) this.draws++
    // Going to *By hand* or *Pass the error back* with the same shape keeps
    // the weights, so a network built by hand can be handed to the rule.
    const sameShape = hidden === this.hiddenCount && inputCount(receptors) === inputCount(b.receptors) && receptors.raw === b.receptors.raw
    // The rule cannot start from a hidden layer whose units are all alike:
    // each would get the same share of the error for ever.
    const blank = b.circuit.interneurons.every((u) => u.baseline === 0 && u.weights.every((w) => w === 0))
    const keep =
      sameShape &&
      !change.redraw &&
      mode !== 'random' &&
      b.settings.hidden !== 'random' &&
      change.builtIns === undefined &&
      !(mode === 'pass-back' && hidden > 0 && blank)
    this.hiddenCount = hidden
    this.sparse = sparse
    b.settings.hidden = mode
    b.settings.sparse = sparse
    if (!keep) {
      const c = this.build(receptors, hidden, mode, sparse, b.circuit.activation, false)
      setWiring(c, { layer: 'output', threshold: criterion })
      b.replace(c, receptors)
      this.start = cloneCircuit(c)
    }
    this.restart()
  }

  /** The student's hand. It moves the wiring now and the wiring *Reset* returns to. */
  wire(patch: WiringPatch): void {
    setWiring(this.brain.circuit, patch)
    setWiring(this.start, patch)
    this.version++
  }

  /** Put the wiring back to what the scenario started with. */
  restoreScenarioWiring(): void {
    const s = this.scenario
    this.draws = 0
    this.hiddenCount = s.hidden
    this.sparse = false
    this.brain.settings.hidden = s.hiddenMode
    this.brain.settings.sparse = false
    const receptors: Receptors = { raw: true, builtIns: [...s.builtIns] }
    const c = this.build(receptors, s.hidden, s.hiddenMode, false, s.activation, true)
    this.brain.replace(c, receptors)
    this.start = cloneCircuit(c)
    this.restart()
  }

  // ───────────────────────── settings ─────────────────────────

  /** Change something about the world. The test sets are drawn again where the change bears on them. */
  set(change: Partial<WorldSettings>): void {
    const before = this.settings
    const remakeTests = (change.spread !== undefined && change.spread !== before.spread) || (change.baseRate !== undefined && change.baseRate !== before.baseRate)
    const remakePool =
      (change.spread !== undefined && change.spread !== before.spread) ||
      (change.poolSize !== undefined && change.poolSize !== before.poolSize) ||
      (change.source !== undefined && change.source !== before.source)
    Object.assign(this.settings, change)
    if (change.chemistry) this.settings.chemistry = { ...change.chemistry }
    if (change.stakes) this.settings.stakes = { ...change.stakes }
    if (remakePool) this.makePool()
    if (remakeTests) this.makeTests()
    this.version++
  }

  /** *An eel comes back*: the closer's third phase. The next thing upstream is an eel. */
  eelReturns(): void {
    this.settings.phase = 2
    this.forced = 'eel'
    this.version++
  }

  // ───────────────────────── the pool and the test sets ─────────────────────────

  private makePool(): void {
    this.pool = []
    if (this.settings.source !== 'pool') return
    const rng = makeRng(this.seeds.pool)
    const mix = this.scenario.phases[0]
    const n = this.settings.poolSize
    for (let i = 0; i < n; i++) {
      const side = i % 2 === 0 ? mix.happens : mix.doesNot
      const kind = side[Math.floor(i / 2) % side.length]
      this.pool.push({ kind, smell: drawIndividual(KINDS[kind], this.settings.spread, rng), met: 0 })
    }
  }

  /** How many times each individual of the pool has been met, on average. */
  get meetingsPerIndividual(): number {
    if (!this.pool.length) return 0
    let n = 0
    for (const p of this.pool) n += p.met
    return n / this.pool.length
  }

  /**
   * The test sets: encounters from the same kinds in the same proportions,
   * which the fish never meets and never learns from. Drawn from their own
   * stream, so they are the same on every run of a seed.
   */
  private makeTests(): void {
    const rng = makeRng(this.seeds.test)
    const n = this.scenario.testSize
    this.tests = this.scenario.testSets.map((spec) => {
      const set: TestSet = { key: spec.key, label: spec.label, x1: new Float32Array(n), x2: new Float32Array(n), happens: new Uint8Array(n), kind: [] }
      for (let i = 0; i < n; i++) {
        const kind = pickKind(spec.mix, this.settings.baseRate, rng)
        const [x1, x2] = sniff(kind, drawIndividual(kind, this.settings.spread, rng), spec.far, rng)
        set.x1[i] = x1
        set.x2[i] = x2
        set.happens[i] = kind.happens ? 1 : 0
        set.kind.push(kind.id)
      }
      return set
    })
    this.version++
  }

  /** The evidence the fish's present weights give each member of a test set. */
  testEvidence(set: TestSet, into?: Float32Array): Float32Array {
    const n = set.x1.length
    const out = into && into.length === n ? into : new Float32Array(n)
    const b = this.brain
    for (let i = 0; i < n; i++) out[i] = evidenceFor(b.circuit, b.receptors, set.x1[i], set.x2[i], this.scratch)
    return out
  }

  /** The four counts on a test set, at a criterion. */
  testCounts(set: TestSet, criterion = this.effectiveCriterion): Counts {
    const c = emptyCounts()
    const b = this.brain
    for (let i = 0; i < set.x1.length; i++) {
      const ev = evidenceFor(b.circuit, b.receptors, set.x1[i], set.x2[i], this.scratch)
      tally(c, set.happens[i] === 1, ev >= criterion)
    }
    return c
  }

  /** Percent of a test set the fish's present weights and criterion get right. */
  testAccuracy(set: TestSet, criterion = this.effectiveCriterion): number {
    const c = this.testCounts(set, criterion)
    const n = set.x1.length
    return n ? (100 * (c.hits + c.correctRejections)) / n : 0
  }

  /** Percent of the ring of recent training encounters the fish got right when it met them. */
  get recentTrainingAccuracy(): number {
    const n = this.ring.count
    if (!n) return 0
    let r = 0
    for (let i = 0; i < n; i++) r += this.ring.right[i]
    return (100 * r) / n
  }

  /**
   * *Score this criterion*: the present weights and criterion on fresh
   * encounters, with no learning and nothing recorded. Its own stream.
   */
  scoreFresh(n = 500, criterion = this.effectiveCriterion): { counts: Counts; energyPer100: number } {
    const rng = makeRng((this.seeds.score + 104729 * this.scores++) >>> 0)
    const counts = emptyCounts()
    const b = this.brain
    const s = this.settings.stakes
    let energy = 0
    for (let i = 0; i < n; i++) {
      const kind = pickKind(this.mix, this.settings.baseRate, rng)
      const far = this.settings.distance === 'far' || (this.settings.distance === 'both' && rng.next() < 0.5)
      const [x1, x2] = sniff(kind, drawIndividual(kind, this.settings.spread, rng), far, rng)
      const judged = evidenceFor(b.circuit, b.receptors, x1, x2, this.scratch) >= criterion
      tally(counts, kind.happens, judged)
      energy += kind.happens ? (judged ? s.hit : s.miss) : judged ? s.falseAlarm : s.correctRejection
    }
    return { counts, energyPer100: (100 * energy) / n }
  }

  // ───────────────────────── one encounter ─────────────────────────

  /** A smell arrives. The fish's prediction is made and held, and its verdict taken. */
  begin(): Encounter {
    if (this.pending) return this.pending
    const st = this.settings
    let kindId: KindId
    let x: [number, number]
    let far = false
    let individual = -1
    if (st.source === 'pool' && this.pool.length) {
      individual = this.stream.int(this.pool.length)
      const who = this.pool[individual]
      kindId = who.kind
      x = sniff(KINDS[kindId], who.smell, false, this.stream)
    } else {
      const kind: Kind = this.forced ? KINDS[this.forced] : pickKind(this.mix, st.baseRate, this.stream)
      this.forced = null
      kindId = kind.id
      far = st.distance === 'far' || (st.distance === 'both' && this.stream.next() < 0.5)
      x = sniff(kind, drawIndividual(kind, st.spread, this.stream), far, this.stream)
    }
    const b = this.brain
    b.sense(x[0], x[1], this.encounters)
    const criterion = this.effectiveCriterion
    this.pending = {
      index: this.encounters,
      kind: kindId,
      x1: x[0],
      x2: x[1],
      far,
      individual,
      evidence: b.evidence,
      p: b.held.value,
      criterion,
      verdict: b.evidence >= criterion,
      happens: KINDS[kindId].happens,
    }
    return this.pending
  }

  /** The outcome arrives — whatever the verdict was — and the fish learns from it. */
  finish(): Encounter | null {
    const e = this.pending
    if (!e) return null
    this.pending = null
    const kind = KINDS[e.kind]
    const st = this.settings.stakes
    tally(this.counts, e.happens, e.verdict)
    const correct = e.verdict === e.happens
    if (correct) this.right++
    if (this.route === 'dart') {
      // Stayed with an eel there: struck. Stayed with none: it fed.
      if (!e.verdict && e.happens) this.harm++
      if (!e.verdict && !e.happens) this.meals++
    } else {
      // Ate something good: a meal. Ate something that sickens: harm.
      if (e.verdict && e.happens) this.meals++
      if (e.verdict && !e.happens && kind.harms) this.harm++
    }
    this.energy += e.happens ? (e.verdict ? st.hit : st.miss) : e.verdict ? st.falseAlarm : st.correctRejection
    if (e.individual >= 0) this.pool[e.individual].met++

    const moved = this.brain.settings.on
    this.brain.resolve(e.happens ? 1 : 0)
    if (moved) this.version++

    const r = this.ring
    r.x1[r.next] = e.x1
    r.x2[r.next] = e.x2
    r.happens[r.next] = e.happens ? 1 : 0
    r.right[r.next] = correct ? 1 : 0
    r.kind[r.next] = e.kind
    r.next = (r.next + 1) % RING
    if (r.count < RING) r.count++

    this.encounters++
    this.last = e
    if (this.encounters % this.curveStride === 0) this.recordCurve()
    return e
  }

  runEncounter(): Encounter {
    this.begin()
    return this.finish()!
  }

  /** Run `n` encounters without drawing them. The same run as watching them. */
  run(n: number): void {
    if (this.pending) {
      this.finish()
      n--
    }
    for (let i = 0; i < n; i++) this.runEncounter()
  }

  private recordCurve(): void {
    this.curve.push({
      encounter: this.encounters,
      train: 100 - this.recentTrainingAccuracy,
      test: this.tests.map((t) => 100 - this.testAccuracy(t)),
    })
    if (this.curve.length >= CURVE_POINTS) {
      this.curve = this.curve.filter((_, i) => i % 2 === 1)
      this.curveStride *= 2
    }
  }

  // ───────────────────────── reset ─────────────────────────

  /** Start the run again: the same stream from its seed, the counters at zero, the settings kept. */
  private restart(): void {
    this.stream = makeRng(this.seeds.stream)
    this.scores = 0
    this.pending = null
    this.last = null
    this.forced = null
    this.encounters = 0
    this.harm = 0
    this.meals = 0
    this.right = 0
    this.energy = 0
    this.counts.hits = this.counts.misses = this.counts.falseAlarms = this.counts.correctRejections = 0
    this.ring.count = 0
    this.ring.next = 0
    this.curve = []
    this.curveStride = CURVE_STRIDE
    for (const p of this.pool) p.met = 0
    this.brain.awaiting = false
    this.version++
  }

  /**
   * *Reset*: the run starts again with every control where it was left and
   * the weights back where the run started (Lab 5's rule). A weight set by
   * hand is part of where the run started.
   */
  reset(): void {
    this.brain.replace(cloneCircuit(this.start), this.brain.receptors)
    if (this.scenario.phases.length > 1) this.settings.phase = 0
    this.restart()
  }
}

/** Draw a kind: the outcome happens with probability `baseRate`, then evenly among the kinds on that side. */
export function pickKind(mix: Mix, baseRate: number, rng: Rng): Kind {
  const side = rng.next() < baseRate ? mix.happens : mix.doesNot
  return KINDS[side.length === 1 ? side[0] : side[rng.int(side.length)]]
}
