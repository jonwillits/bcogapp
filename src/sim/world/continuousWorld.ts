import { makeRng, type Rng } from '../random'
import {
  drawFounder,
  genomeToWeights,
  hueToCss,
  mutate,
  randomGenome,
  approachScore,
  crossing,
  meanWeight,
  DEFAULT_MUTATION_RATES,
  FOUNDER_POOLS,
  wrapHue,
  type Genome,
  type MutationRates,
} from '../creature/genome'
import { VehicleWorld, type Vehicle } from './world'
import {
  harvest,
  freshLight,
  lightStrength,
  respawnPoint,
  DEFAULT_FOOD_PARAMS,
  type FoodLight,
  type FoodParams,
} from './food'
import {
  modalHue,
  REGIME_SIGN,
  type EnergyParams,
  type LightRegime,
  DEFAULT_ENERGY_PARAMS,
} from './evolutionWorld'

/**
 * A **continuous** life cycle, as an alternative to discrete generations.
 *
 * Every creature carries an energy store and a lifespan. Energy rises while it
 * feeds and falls while it lives and moves. Cross the upper threshold and it
 * reproduces, paying for the offspring out of its own store; fall to zero and it
 * starves; outlive your lifespan and you die anyway. Nothing resets, nothing is
 * ranked, and there is no generation boundary.
 *
 * Built to be measured against the generational engine rather than to replace
 * it sight unseen. The parts that are *not* the life cycle — sensing, actuator
 * arithmetic, movement, collisions, the food model, the genome, mutation, the
 * seeded stream — are the same code, so a difference in outcome is a difference
 * in life cycle and nothing else.
 *
 * The three questions it exists to answer are in `continuous.probe.ts`: does the
 * population survive, does adaptation still happen, and does strategy parity
 * hold once starvation makes variance lethal?
 */

export interface ContinuousParams {
  initialPopulation: number
  /** Seconds a creature lives if nothing else kills it. */
  meanLifespan: number
  lifespanSd: number
  /** Energy a newborn starts with, and what a parent drops back to. */
  birthEnergy: number
  /** Cross this and you reproduce. */
  reproduceThreshold: number
  /** Fall to this and you starve. */
  starveThreshold: number
  mutationScale: number
  inheritance: boolean
  /**
   * Off means reproduction is decoupled from behaviour: each step's energy
   * gains are shuffled among the living, so the total and the distribution are
   * unchanged but who earns what is arbitrary. That is the continuous analogue
   * of "parents chosen at random", and it keeps population regulation identical
   * between the two conditions — which is what makes the comparison mean
   * anything.
   */
  selection: boolean
  regime: LightRegime
  sensorNoise: number
  bounds: number
  founderSpread: number
  /**
   * Degrees added to the founder pool's centre hue. The one sanctioned way to
   * influence what colour a lineage wears — hue is the last draw drawFounder
   * takes, so shifting its centre leaves every weight in the run untouched.
   */
  founderHueShift: number
  /**
   * How many creatures the pit supports. **Not a backstop — a mechanism.**
   *
   * When the world is full nobody is born; a creature that has enough energy to
   * reproduce simply waits, and the moment a slot opens the creature with the
   * most energy takes it. That does two jobs the discrete engine got from its
   * generational bottleneck and the first continuous attempt lost entirely.
   *
   * It makes selection strong again: reproduction becomes a queue ordered by
   * how fast you gather energy, so a good forager breeds repeatedly while a
   * poor one never reaches the front. That is truncation selection in
   * continuous time, without a generation boundary.
   *
   * And it pins the effective population size, which is what drift — and
   * therefore colour fixation — depends on. Lineages coalesce in roughly 2N
   * generations, so a population of 20 fixes within a run and a population of
   * 120 does not come close.
   */
  populationCap: number
  /** Energy is not a bottomless store; banking it while waiting has a limit. */
  maxEnergy: number
  food: FoodParams
  energy: EnergyParams
  mutationRates: MutationRates
}

/**
 * Settled by the Phase A sweeps. Over ten seeds: survives 10/10, the population
 * ends 24 points more light-seeking than a same-seed drift control, colour fixes
 * in 10/10, strategy parity 1.04, and the poison switch collapses the population
 * in 10/10.
 *
 * Two of these numbers were hard-won. **The reproduction threshold is the
 * selection lever** — at 6 a creature reaches it comfortably in a normal life and
 * almost everyone breeds, so the advantage over drift is +0.07; at 10 only good
 * foragers get to the front of the queue and it is +0.23. Push it to 12 and the
 * population starts dying out. And **the food lifetime is what keeps the
 * creatures moving**: mean evolved bias here is 0.48 against the generational
 * engine's 0.07–0.18, because food that moves every twelve seconds makes sitting
 * still unviable. That is the layer-3 near-inertia problem solved by the food
 * model rather than by a floor on the gene.
 */
export const DEFAULT_CONTINUOUS_PARAMS: ContinuousParams = {
  initialPopulation: 16,
  meanLifespan: 60,
  lifespanSd: 15,
  birthEnergy: 4,
  reproduceThreshold: 10,
  starveThreshold: 0,
  mutationScale: 1,
  inheritance: true,
  selection: true,
  regime: 'food',
  sensorNoise: 0,
  bounds: 9,
  founderSpread: 1.6,
  founderHueShift: 0,
  populationCap: 16,
  maxEnergy: 30,
  food: {
    ...DEFAULT_FOOD_PARAMS,
    mode: 'ephemeral',
    count: 4,
    flowRate: 3.4,
    lifetime: 12,
  },
  energy: { ...DEFAULT_ENERGY_PARAMS },
  mutationRates: { ...DEFAULT_MUTATION_RATES },
}

export interface Creature {
  id: number
  parentId: number | null
  founderId: number
  genome: Genome
  energy: number
  age: number
  lifespan: number
  bornAt: number
  vehicle: Vehicle
}

/**
 * One creature's place in the ancestry, for the tree.
 *
 * Time-stamped rather than generation-numbered, because there are no
 * generations any more. The tree Part 3 draws therefore has real time on one
 * axis, which is what a phylogeny actually looks like — and it means a lineage
 * that reproduces fast is visibly bushier than one that does not, rather than
 * both marching in lockstep down a column grid.
 */
export interface Lineage {
  id: number
  parentId: number | null
  founderId: number
  bornAt: number
  /** Sim time of death; null while alive. */
  diedAt: number | null
  /** The neutral gene, carried here so the tree can be drawn in its colours. */
  mark: number
  /** Whether this creature ever reproduced. */
  reproduced: boolean
}

export interface ContinuousSample {
  time: number
  population: number
  births: number
  starved: number
  diedOfAge: number
  meanEnergy: number
  meanAge: number
  /** Fraction of the living that steer toward light. */
  approachFraction: number
  meanCrossing: number
  meanSign: number
  hueConcentration: number
  survivingLineages: number
}

let nextCreatureId = 1

/**
 * Restart creature numbering. Ids are global so four populations can share one
 * tree without colliding, which means an id depends on how many worlds were
 * built before it — and those ids *are* the tree, so the fixture builder resets
 * the counter and builds all four in a fixed order.
 */
export function resetCreatureIds(): void {
  nextCreatureId = 1
}

export class ContinuousWorld {
  params: ContinuousParams
  world: VehicleWorld
  lights: FoodLight[] = []
  creatures: Creature[] = []
  /** Every creature that has ever lived in this run. */
  lineage: Lineage[] = []
  /** Index into `lineage`; the search runs this engine hundreds of times. */
  private lineageById = new Map<number, Lineage>()
  samples: ContinuousSample[] = []
  time = 0
  births = 0
  starved = 0
  diedOfAge = 0
  extinct = false
  hitCap = false

  private rng: Rng
  private founders: 'diverse' | 'P' | 'Q' | 'all-2b' | 'all-3a'
  private sampleAcc = 0

  constructor(
    seed: number,
    params: Partial<ContinuousParams> = {},
    founders: 'diverse' | 'P' | 'Q' | 'all-2b' | 'all-3a' = 'diverse',
  ) {
    this.params = { ...DEFAULT_CONTINUOUS_PARAMS, ...params }
    this.founders = founders
    this.rng = makeRng(seed)
    this.world = new VehicleWorld(
      { bounds: this.params.bounds, sensorNoise: this.params.sensorNoise },
      this.rng,
    )
    this.seedLights()
    this.seedFounders()
  }

  private seedLights(): void {
    const { food } = this.params
    for (let i = 0; i < food.count; i++) {
      const p = respawnPoint(this.lights, this.params.bounds, this.rng)
      const src = this.world.addSource(p.x, 0.7, p.z, food.strength)
      // Stagger the first expiries across one lifetime, or every light in the
      // world moves at the same instant for the whole run.
      const expiresAt =
        food.mode === 'ephemeral' ? this.rng.range(0, food.lifetime) : Infinity
      this.lights.push(freshLight(src, food.capacity, expiresAt))
    }
  }

  private drawGenome(): Genome {
    const shifted = (pool: typeof FOUNDER_POOLS.P) =>
      this.params.founderHueShift === 0
        ? pool
        : {
            ...pool,
            centre: {
              ...pool.centre,
              hue: wrapHue(pool.centre.hue + this.params.founderHueShift),
            },
          }
    switch (this.founders) {
      case 'P':
        return drawFounder(shifted(FOUNDER_POOLS.P), this.rng)
      case 'Q':
        return drawFounder(shifted(FOUNDER_POOLS.Q), this.rng)
      case 'all-2b':
        return drawFounder(
          {
            id: '2b', label: '2b', description: '', spread: 0.3, hueSpread: 70,
            centre: { wLL: 0, wLR: 1.6, wRL: 1.6, wRR: 0, bias: 0.6, hue: 280 },
          },
          this.rng,
        )
      case 'all-3a':
        return drawFounder(
          {
            id: '3a', label: '3a', description: '', spread: 0.3, hueSpread: 70,
            centre: { wLL: -1.6, wLR: 0, wRL: 0, wRR: -1.6, bias: 1.2, hue: 160 },
          },
          this.rng,
        )
      default:
        return randomGenome(this.rng, this.params.founderSpread)
    }
  }

  private drawLifespan(): number {
    return Math.max(
      5,
      this.params.meanLifespan + this.rng.normal() * this.params.lifespanSd,
    )
  }

  private seedFounders(): void {
    const n = this.params.initialPopulation
    for (let i = 0; i < n; i++) {
      const angle = (i / n) * Math.PI * 2
      const r = this.params.bounds * 0.55
      const genome = this.drawGenome()
      const c = this.spawn(genome, null, -1, {
        x: Math.cos(angle) * r,
        z: Math.sin(angle) * r,
        heading: angle + Math.PI / 2,
      })
      // A founder roots its own lineage, which cannot be known until its id is
      // assigned — so fix the creature *and* the tree node it already wrote.
      c.founderId = c.id
      const node = this.lineageById.get(c.id)
      if (node) node.founderId = c.id
      /**
       * Founder ages are staggered across the lifespan rather than all starting
       * at zero. Otherwise the entire founding population reaches old age within
       * a few seconds of each other and the world empties in one stroke — a
       * cohort crash that has nothing to do with how well anything forages.
       */
      c.age = this.rng.range(0, c.lifespan)
    }
  }

  private spawn(
    genome: Genome,
    parentId: number | null,
    founderId: number,
    pose: { x: number; z: number; heading: number },
  ): Creature {
    const vehicle = this.world.addWeightedVehicle(
      genomeToWeights(genome),
      hueToCss(genome.hue),
      pose,
    )
    const c: Creature = {
      id: nextCreatureId++,
      parentId,
      founderId,
      genome,
      energy: this.params.birthEnergy,
      age: 0,
      lifespan: this.drawLifespan(),
      bornAt: this.time,
      vehicle,
    }
    this.creatures.push(c)
    const node: Lineage = {
      id: c.id,
      parentId,
      founderId,
      bornAt: this.time,
      diedAt: null,
      mark: genome.hue,
      reproduced: false,
    }
    this.lineage.push(node)
    this.lineageById.set(node.id, node)
    return c
  }

  /**
   * Split this population into an independent branch carrying on from exactly
   * here with a different random stream — the continuous equivalent of the
   * generational engine's fork, and how the sister lineages W and X are made.
   *
   * Shares the whole trunk: the same founders, the same individuals, the same
   * ids. Two separate runs would give two separate trees with no common
   * ancestor, and the homology Part 3 asks a student to find would not be there.
   */
  fork(newSeed: number): ContinuousWorld {
    const child = new ContinuousWorld(newSeed, this.params, this.founders)
    child.time = this.time
    child.births = this.births
    child.starved = this.starved
    child.diedOfAge = this.diedOfAge
    child.samples = this.samples.map((s) => ({ ...s }))
    child.lineage = this.lineage.map((n) => ({ ...n }))
    child.lineageById = new Map(child.lineage.map((n) => [n.id, n]))

    child.world.sources = []
    child.lights = this.lights.map((l) => ({
      source: child.world.addSource(l.source.x, l.source.y, l.source.z, l.source.strength),
      store: l.store,
      capacity: l.capacity,
      respawnAt: l.respawnAt,
      expiresAt: l.expiresAt,
    }))

    child.world.vehicles = []
    child.creatures = this.creatures.map((c) => ({
      ...c,
      genome: { ...c.genome },
      vehicle: child.world.addWeightedVehicle(
        genomeToWeights(c.genome),
        hueToCss(c.genome.hue),
        { ...c.vehicle.state },
      ),
    }))
    return child
  }

  step(dt: number): void {
    if (this.creatures.length === 0) {
      this.extinct = true
      return
    }
    this.world.step(dt)

    const { regime, food, energy, selection } = this.params
    const sign = REGIME_SIGN[regime]

    // 1. What each creature earned and spent this step.
    const { intake, drawn } = harvest(
      this.creatures.map((c) => ({
        x: c.vehicle.state.x,
        y: c.vehicle.config.sensorHeight,
        z: c.vehicle.state.z,
      })),
      this.lights,
      food,
      dt,
    )

    if (regime === 'food' && food.mode === 'depleting' && food.deplete) {
      this.lights.forEach((l, i) => {
        if (l.respawnAt !== null || drawn[i] <= 0) return
        l.store -= drawn[i]
        if (l.store <= 0) {
          l.store = 0
          l.respawnAt = this.time + food.respawnDelay
          this.world.removeSource(l.source.id)
        }
      })
    }

    const net = this.creatures.map((c, i) => {
      const v = c.vehicle
      const effort = (Math.abs(v.actuators.left) + Math.abs(v.actuators.right)) / 2
      return (
        sign * intake[i] +
        energy.ambientIncome * dt -
        (energy.baseCost + energy.moveCost * effort) * dt
      )
    })

    // 2. Selection off: shuffle who got what, so the total and the spread are
    //    unchanged but nothing a creature does affects what it earns.
    if (!selection) {
      for (let i = net.length - 1; i > 0; i--) {
        const j = this.rng.int(i + 1)
        ;[net[i], net[j]] = [net[j], net[i]]
      }
    }

    this.creatures.forEach((c, i) => {
      c.energy = Math.min(this.params.maxEnergy, c.energy + net[i])
      c.age += dt
    })

    if (regime === 'food' && food.mode === 'depleting' && food.deplete) {
      for (const l of this.lights) {
        if (l.respawnAt === null) l.source.strength = lightStrength(l, food)
      }
    }

    this.time += dt
    this.respawnDue()
    this.reproduce()
    this.reap()

    this.sampleAcc += dt
    if (this.sampleAcc >= 1) {
      this.sampleAcc = 0
      this.record()
    }
  }

  private respawnDue(): void {
    const { food, bounds } = this.params

    // Ephemeral: a light simply moves when its time is up, eaten or not.
    if (food.mode === 'ephemeral') {
      for (const l of this.lights) {
        if (this.time < l.expiresAt) continue
        this.world.removeSource(l.source.id)
        const p = respawnPoint(this.lights, bounds, this.rng)
        l.source = this.world.addSource(p.x, 0.7, p.z, food.strength)
        l.expiresAt = this.time + food.lifetime
      }
      return
    }

    for (const l of this.lights) {
      if (l.respawnAt === null || this.time < l.respawnAt) continue
      const p = respawnPoint(this.lights, bounds, this.rng)
      l.store = l.capacity
      l.respawnAt = null
      l.source = this.world.addSource(p.x, 0.7, p.z, food.strength)
    }
  }

  private reproduce(): void {
    const { reproduceThreshold, birthEnergy, populationCap } = this.params
    // Snapshot: a creature born this instant must not itself reproduce yet.
    // Ordered by energy, so when a slot opens it goes to whoever is furthest
    // ahead rather than to whoever happens to sit earliest in the array.
    const ready = this.creatures
      .filter((c) => c.energy >= reproduceThreshold)
      .sort((a, b) => b.energy - a.energy)
    for (const parent of ready) {
      if (this.creatures.length >= populationCap) {
        this.hitCap = true
        break
      }
      parent.energy = birthEnergy
      const parentNode = this.lineageById.get(parent.id)
      if (parentNode) parentNode.reproduced = true
      const genome = this.params.inheritance
        ? mutate(parent.genome, this.rng, this.params.mutationRates, this.params.mutationScale)
        : randomGenome(this.rng, this.params.founderSpread)
      this.spawn(genome, parent.id, parent.founderId, {
        x: parent.vehicle.state.x + this.rng.range(-0.5, 0.5),
        z: parent.vehicle.state.z + this.rng.range(-0.5, 0.5),
        heading: this.rng.range(0, Math.PI * 2),
      })
      this.births++
    }
  }

  private reap(): void {
    const survivors: Creature[] = []
    for (const c of this.creatures) {
      const starving = this.params.selection && c.energy <= this.params.starveThreshold
      const old = c.age >= c.lifespan
      if (starving) this.starved++
      else if (old) this.diedOfAge++
      if (starving || old) {
        const node = this.lineageById.get(c.id)
        if (node) node.diedAt = this.time
        this.world.removeVehicle(c.vehicle.id)
      } else {
        survivors.push(c)
      }
    }
    this.creatures = survivors
    if (this.creatures.length === 0) this.extinct = true
  }

  private record(): void {
    const pop = this.creatures
    const n = pop.length || 1
    const { hue, concentration } = modalHue(pop.map((c) => c.genome.hue))
    this.samples.push({
      time: this.time,
      population: pop.length,
      births: this.births,
      starved: this.starved,
      diedOfAge: this.diedOfAge,
      meanEnergy: pop.reduce((a, c) => a + c.energy, 0) / n,
      meanAge: pop.reduce((a, c) => a + c.age, 0) / n,
      approachFraction: pop.filter((c) => approachScore(c.genome) > 0).length / n,
      meanCrossing: pop.reduce((a, c) => a + crossing(c.genome), 0) / n,
      meanSign: pop.reduce((a, c) => a + meanWeight(c.genome), 0) / n,
      hueConcentration: concentration,
      survivingLineages: new Set(pop.map((c) => c.founderId)).size,
    })
    void hue
  }

  /** A light the student placed. It joins the pool and behaves like any other. */
  addLight(x: number, y: number, z: number): void {
    const src = this.world.addSource(x, y, z, this.params.food.strength)
    this.lights.push(
      freshLight(
        src,
        this.params.food.capacity,
        this.params.food.mode === 'ephemeral'
          ? this.time + this.params.food.lifetime
          : Infinity,
      ),
    )
  }

  removeLightNearest(x: number, z: number, radius: number): boolean {
    let best = -1
    let bestD = Infinity
    this.lights.forEach((l, i) => {
      if (l.respawnAt !== null) return
      const d = Math.hypot(l.source.x - x, l.source.z - z)
      if (d < bestD) {
        bestD = d
        best = i
      }
    })
    if (best < 0 || bestD > radius) return false
    this.world.removeSource(this.lights[best].source.id)
    this.lights.splice(best, 1)
    return true
  }

  run(seconds: number, dt = 1 / 30): void {
    const steps = Math.round(seconds / dt)
    for (let i = 0; i < steps && !this.extinct; i++) this.step(dt)
  }
}
