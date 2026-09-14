import { makeRng, type Rng } from '../random'
import { placeAwayFrom, fieldAt, type CueSource } from './fields'
import { cloneCircuit, type Circuit } from './circuit'
import { MODULATOR_IDS, valenceArousal, type ModulatorId } from './modulators'
import { kickModulator, type Levels } from './modulators'
import { Worm, FEEDING_PAUSE_S } from './worm'
import type { Scenario, SourceSpec } from './scenarios'

/**
 * One animal in one dish: the scenario's sources, the worm, and the
 * bookkeeping a scorecard reads — cues reached, reversals, time in reverse,
 * energy, harm.
 *
 * Everything random draws from one stream seeded by the run seed: where a
 * plume reappears, where the animal starts, every reversal and every turn.
 * Same seed and same settings reproduce a run exactly, which is what lets
 * every part of the lab be "change one thing and compare".
 */

export const DISH_BOUNDS = 8
/** A source is reached within this distance of the head. */
export const REACH = 1.0
/** One meal, in seconds of a verdict at full strength. */
const MEAL = 1
/** How long a half-eaten meal is remembered once the animal wanders off, seconds. */
const MEAL_MEMORY_S = 8
/** A plume reappears at least this far from the animal. */
const RESPAWN_CLEAR = 4
/** Samples kept of the live traces, one per step. */
export const TRACE_LEN = 240
/**
 * The concentration control scales the plumes — the sources that come and
 * go — and leaves the fixed features of the dish (a strip of copper, a
 * patch of cool water, decaying matter) as they are. Turning it up is the
 * student's experiment on how strongly a cue speaks, not a rebuild of the dish.
 */
export const CONCENTRATION_RANGE = { min: 0.25, max: 2.5, step: 0.25 } as const

export interface DishOptions {
  /** Start from this wiring instead of the scenario's. */
  circuit?: Circuit
  modulators?: Partial<Levels>
  concentration?: number
}

export class DishWorld {
  readonly scenario: Scenario
  readonly worm: Worm
  readonly seed: number
  /** The wiring this dish started with — what "restore" goes back to. */
  readonly startCircuit: Circuit
  /** Meals eaten, most recent last, for the dish to mark. */
  meals: { x: number; z: number; t: number }[] = []
  sources: CueSource[] = []
  time = 0
  concentration: number
  cuesReached = 0
  /** Sim times at which cues were reached. */
  reached: number[] = []
  harm = 0
  crossings = 0
  /**
   * A meal in progress: how much of it is eaten. An animal eats at the rate
   * its verdict says — a verdict at half strength is half a meal a second —
   * and slows in proportion while it does, so a weak verdict means slow,
   * often-interrupted meals rather than none. The threshold function makes a
   * meal one second flat; the sigmoid grades it.
   */
  meal = 0
  mealSource: number | null = null
  /** Within reach of something it can eat, right now. */
  eating = false
  private lastSide = 0
  private nextId = 1
  private rng: Rng
  /** The interneuron's net input, its output and the reversal rate, per step. */
  trace = {
    net: [] as number[],
    output: [] as number[],
    rate: [] as number[],
    cells: [] as number[][],
    levels: Object.fromEntries(MODULATOR_IDS.map((id) => [id, [] as number[]])) as Record<ModulatorId, number[]>,
    valence: [] as number[],
    arousal: [] as number[],
  }

  constructor(seed: number, scenario: Scenario, opts: DishOptions = {}) {
    this.seed = seed
    this.scenario = scenario
    this.rng = makeRng(seed)
    this.concentration = opts.concentration ?? 1
    for (const spec of scenario.sources) this.spawn(spec, spec.x, spec.z)
    const start = scenario.start ?? placeAwayFrom(this.rng, DISH_BOUNDS, 0, 0, 0)
    const heading = this.rng.range(-Math.PI, Math.PI)
    this.worm = new Worm(
      opts.circuit ? cloneCircuit(opts.circuit) : cloneCircuit(scenario.circuit),
      scenario.channels,
      opts.modulators ?? {},
      { x: start.x, z: start.z, heading },
    )
    this.lastSide = Math.sign(start.z)
    this.startCircuit = cloneCircuit(this.worm.circuit)
  }

  private spawn(spec: SourceSpec, x: number, z: number): CueSource {
    const s: CueSource = {
      id: this.nextId++,
      channel: spec.channel,
      x,
      z,
      strength: spec.strength,
      scale: spec.scale,
      lifetime: spec.lifetime,
      born: this.time,
    }
    this.sources.push(s)
    return s
  }

  /** The spec a live source was built from, for respawning it. */
  private specOf(s: CueSource): SourceSpec | undefined {
    return this.scenario.sources.find(
      (sp) => sp.channel === s.channel && sp.strength === s.strength && sp.scale === s.scale,
    )
  }

  private respawn(s: CueSource): void {
    this.sources = this.sources.filter((q) => q.id !== s.id)
    const spec = this.specOf(s)
    if (!spec || spec.respawn === 'none') return
    const head = this.worm.head
    let p = this.clearGround(head.x, head.z)
    if (spec.respawn === 'far-side') {
      // Across the strip from wherever the animal is, so it must cross again.
      const side = head.z >= 0 ? -1 : 1
      p = { x: this.rng.range(-4, 4), z: side * this.rng.range(3, 5.5) }
    }
    this.spawn({ ...spec, lifetime: spec.lifetime }, p.x, p.z)
  }

  /**
   * Somewhere a plume can appear: away from the animal, and not inside one of
   * the dish's fixed features. A plume that appeared in the middle of a bog
   * would draw a healthy animal in and then refuse to feed it, which is the
   * hungry animal's story and not the healthy one's.
   */
  private clearGround(ax: number, az: number): { x: number; z: number } {
    // Clear of the dish's fixed features, and far enough from every other
    // plume that the two never add up past the sensory cell's ceiling —
    // past the ceiling a halved gain and a halved weight stop being the same
    // animal. If the dish is too full for that, settle for clear of the
    // fixed features; never for a plume inside a bog.
    const fixed = this.sources.filter((s) => s.lifetime === null && this.specOf(s)?.keepPlumesOut)
    const plumes = this.sources.filter((s) => s.lifetime !== null)
    for (let tries = 0; tries < 80; tries++) {
      const p = placeAwayFrom(this.rng, DISH_BOUNDS, ax, az, RESPAWN_CLEAR)
      if (fixed.every((f) => fieldAt(f, p.x, p.z) < 0.5) && plumes.every((f) => fieldAt(f, p.x, p.z) < 0.8)) return p
    }
    for (let tries = 0; tries < 40; tries++) {
      const p = placeAwayFrom(this.rng, DISH_BOUNDS, ax, az, RESPAWN_CLEAR)
      if (fixed.every((f) => fieldAt(f, p.x, p.z) < 0.5)) return p
    }
    return placeAwayFrom(this.rng, DISH_BOUNDS, ax, az, RESPAWN_CLEAR)
  }

  /** Click-the-ground placement, as Labs 1 to 3 have it. */
  addSource(channel: number, x: number, z: number): void {
    const like = this.scenario.sources.find((s) => s.channel === channel)
    this.spawn(
      {
        channel,
        x,
        z,
        strength: like?.strength ?? 4,
        scale: like?.scale ?? 2.2,
        lifetime: null,
        respawn: 'none',
      },
      x,
      z,
    )
  }

  removeNearest(x: number, z: number): void {
    let best: CueSource | null = null
    let bestD = Infinity
    for (const s of this.sources) {
      const d = Math.hypot(s.x - x, s.z - z)
      if (d < bestD) {
        bestD = d
        best = s
      }
    }
    if (best) this.sources = this.sources.filter((q) => q.id !== best.id)
  }

  step(dt: number): void {
    const w = this.worm
    const sc = this.scenario

    // Plumes dissipate.
    for (const s of [...this.sources]) {
      if (s.lifetime !== null && this.time - s.born > s.lifetime) this.respawn(s)
    }

    // What the world does at the head: thick going, harm per second.
    const c = w.cells.map((cell) => cell.concentration)
    w.speedFactor = sc.linger ? sc.linger(c) : 1
    if (sc.hazard) this.harm += sc.hazard(c) * dt
    // Slow to eat only while actually at the food: a meal remembered from
    // a plume the animal has wandered off must not hold it still out in the dish.
    if (this.eating) w.speedFactor *= 1 - w.feedDrive

    w.step(dt, this.sources, this.rng, DISH_BOUNDS, (s) => (s.lifetime === null ? 1 : this.concentration))

    // Reaching a source: only a verdict routed forward feeds, at the rate
    // it fires.
    const head = w.head
    let eating: CueSource | null = null
    if (w.pauseLeft <= 0 && w.feedDrive > 0.02) {
      for (const s of this.sources) {
        if (Math.hypot(s.x - head.x, s.z - head.z) > REACH) continue
        if (sc.onReach(s.channel, c) === 'ignore') continue
        eating = s
        break
      }
    }
    this.eating = eating !== null
    if (this.mealSource !== null && !this.sources.some((q) => q.id === this.mealSource)) {
      this.meal = 0
      this.mealSource = null
    }
    if (eating) {
      if (this.mealSource !== eating.id) {
        this.meal = 0
        this.mealSource = eating.id
      }
      this.meal += w.feedDrive * dt
      if (this.meal >= MEAL) {
        const outcome = sc.onReach(eating.channel, c)
        if (outcome === 'nourish') {
          this.cuesReached++
          this.reached.push(this.time)
          this.meals.push({ x: eating.x, z: eating.z, t: this.time })
          if (this.meals.length > 6) this.meals.shift()
          kickModulator(w.mod, 'satiety', 0.05, this.time)
          kickModulator(w.mod, 'relief', 0.25, this.time)
        } else if (outcome === 'harm') {
          // A startle, and no more: harm must not teach the animal anything.
          // A bigger kick here made a poisoned animal too jittery to feed
          // after a few minutes, which read as recovery, and the closer
          // depends on the animal being unable to fix itself.
          this.harm += 1
          kickModulator(w.mod, 'arousal', 0.1, this.time)
        }
        w.pause(FEEDING_PAUSE_S + 2 * w.mod.level.relief)
        this.meal = 0
        this.mealSource = null
        this.respawn(eating)
      }
    } else {
      // Out of reach: a meal in progress is not forgotten at once. The animal
      // wanders around a plume rather than sitting on its centre, and a weak
      // verdict finishes its meal over several passes rather than never.
      this.meal *= Math.exp(-dt / MEAL_MEMORY_S)
    }

    if (sc.countCrossings) {
      const side = Math.sign(w.head.z)
      if (side !== 0 && this.lastSide !== 0 && side !== this.lastSide) this.crossings++
      if (side !== 0) this.lastSide = side
    }

    this.time += dt
    push(this.trace.net, w.net[0] ?? 0)
    push(this.trace.output, w.output[0] ?? 0)
    push(this.trace.rate, w.rate)
    w.cells.forEach((cell, i) => {
      if (!this.trace.cells[i]) this.trace.cells[i] = []
      push(this.trace.cells[i], cell.output)
    })
    for (const id of MODULATOR_IDS) push(this.trace.levels[id], w.mod.level[id])
    const va = valenceArousal(w.mod.level, w.signedVerdict)
    push(this.trace.valence, va.valence)
    push(this.trace.arousal, va.arousal)
  }

  run(seconds: number, dt = 1 / 30): void {
    const n = Math.round(seconds / dt)
    for (let i = 0; i < n; i++) this.step(dt)
  }

  get cuesPerMinute(): number {
    return this.time > 0 ? (60 * this.cuesReached) / this.time : 0
  }

  /** The last minute of the run. */
  get recentCuesPerMinute(): number {
    const window = Math.min(60, this.time)
    if (window <= 0) return 0
    const from = this.time - window
    return (60 * this.reached.filter((t) => t >= from).length) / window
  }

  get reversalsPerMinute(): number {
    return this.time > 0 ? (60 * this.worm.reversals) / this.time : 0
  }

  get fractionInReverse(): number {
    return this.time > 0 ? this.worm.timeInReverse / this.time : 0
  }

  get energyPerCue(): number {
    return this.cuesReached > 0 ? this.worm.energy / this.cuesReached : Infinity
  }
}

function push(arr: number[], v: number): void {
  arr.push(v)
  if (arr.length > TRACE_LEN) arr.shift()
}
