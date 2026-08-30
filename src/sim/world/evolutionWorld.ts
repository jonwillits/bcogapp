import type { Rng } from '../random'
import { makeRng } from '../random'
import {
  drawFounder,
  genomeToWeights,
  mutate,
  randomGenome,
  crossing,
  meanWeight,
  hueToCss,
  DEFAULT_MUTATION_RATES,
  FOUNDER_POOLS,
  wrapHue,
  type FounderPool,
  type Genome,
  type MutationRates,
} from '../creature/genome'
import { VehicleWorld, type Vehicle } from './world'
import {
  intakeContributions,
  freshLight,
  lightStrength,
  respawnPoint,
  DEFAULT_FOOD_PARAMS,
  type FoodLight,
  type FoodParams,
} from './food'

/**
 * What a light does to a vehicle sitting in it. `food` is the default world;
 * the other two are Part 2's switches. `neutral` leaves light inert — a world
 * with nothing to be good at — and `poison` inverts the sign, which is what
 * turns a well-adapted population into a badly-adapted one without changing a
 * single gene. That asymmetry is the whole of Q7: an adaptation is a fit
 * between a creature and a particular set of circumstances, and moving the
 * circumstances is enough to destroy it.
 */
export type LightRegime = 'food' | 'neutral' | 'poison'

export const REGIME_SIGN: Record<LightRegime, number> = {
  food: 1,
  neutral: 0,
  poison: -1,
}

/**
 * Energy is spent as well as gained, and spent faster the harder a vehicle
 * drives. Without a movement cost a high-bias vehicle that simply races around
 * the pit at random would out-earn a well-steered one by sheer coverage, and
 * selection would optimize for speed rather than for steering — which is not
 * the thing the lab is about.
 */
export interface EnergyParams {
  /** Drain per second regardless of what the vehicle does. */
  baseCost: number
  /** Extra drain per second per unit of mean actuator output. */
  moveCost: number
}

/**
 * `moveCost` is the consequential one, and it is a straight trade between the
 * acceptance tests. Cheap movement (0.03) and the founders already forage well,
 * so the population barely improves; expensive movement (0.09+) and selection
 * is fierce but parking beats roaming and Part 3's two strategies stop
 * coexisting. 0.06 is the measured best compromise: 83% of the final population
 * steers toward light, strategy parity comes out at 1.08, and a selected
 * population ends 78% above an unselected one from the same seed.
 *
 * `baseCost` is *evolutionarily inert*, and that is worth knowing before anyone
 * tries to tune with it. It subtracts the same amount from every vehicle, so it
 * cannot change their ranking, and selection here is purely rank-based —
 * measured across a 4x sweep, every outcome except the absolute energy numbers
 * was identical. It is kept small for one reason only: to leave mean energy
 * comfortably positive, since Q2 asks a student to read that number off the
 * screen and a negative one invites a question the lab does not want to answer.
 */
export const DEFAULT_ENERGY_PARAMS: EnergyParams = {
  baseCost: 0.05,
  moveCost: 0.06,
}

export interface EvolutionParams {
  populationSize: number
  /** Simulated seconds in one generation. */
  generationLength: number
  /** Multiplier on every mutation sigma. Zero means offspring are exact copies. */
  mutationScale: number
  /** Off: offspring get random genomes instead of their parent's. */
  inheritance: boolean
  /** Off: parents are drawn at random rather than by energy. */
  selection: boolean
  regime: LightRegime
  sensorNoise: number
  bounds: number
  /** Half-width of the uniform weight draw for `diverse` founders. */
  founderSpread: number
  /**
   * Degrees added to the founder pool's centre hue before the draw.
   *
   * The one sanctioned way to influence what colour a lineage ends up wearing.
   * §9 forbids overwriting an evolved population's hue — a scripted colour
   * would make Q15 and Q16 a lie — but explicitly permits choosing the
   * founders' hues, and this is that. It is also provably free of side effects:
   * hue is the last draw `drawFounder` takes, so shifting its centre leaves the
   * position of the random stream, and therefore every weight in the run,
   * exactly where it was. A fixture generated with a shift is the same
   * population, repainted.
   */
  founderHueShift: number
  food: FoodParams
  energy: EnergyParams
  mutationRates: MutationRates
}

export const DEFAULT_EVOLUTION_PARAMS: EvolutionParams = {
  populationSize: 24,
  generationLength: 24,
  mutationScale: 1,
  inheritance: true,
  selection: true,
  regime: 'food',
  sensorNoise: 0,
  bounds: 9,
  founderSpread: 1.6,
  founderHueShift: 0,
  food: { ...DEFAULT_FOOD_PARAMS },
  energy: { ...DEFAULT_ENERGY_PARAMS },
  mutationRates: { ...DEFAULT_MUTATION_RATES },
}

/**
 * One creature in one generation, and its place in the ancestry.
 *
 * `founderId` is carried rather than recomputed by walking parents, because the
 * lineage tree and the Population panel both want to colour by founder on every
 * frame, and a 50-generation run would otherwise walk 50 links per vehicle per
 * repaint.
 */
export interface Individual {
  id: number
  parentId: number | null
  founderId: number
  generation: number
  genome: Genome
  energy: number
  vehicle: Vehicle
}

/** The compact record the lineage tree is drawn from. */
export interface LineageNode {
  id: number
  parentId: number | null
  founderId: number
  generation: number
  hue: number
  /** Energy at the end of the generation this individual lived through. */
  energy: number
  /** Whether this individual left offspring. */
  reproduced: boolean
}

/** One row of the Fitness, Population and Colour panels. */
export interface GenerationRecord {
  generation: number
  meanEnergy: number
  bestEnergy: number
  /** Mean of `crossing()` — where the population sits on the wiring plane. */
  meanCrossing: number
  /** Mean of `meanWeight()` — excitatory above zero, inhibitory below. */
  meanSign: number
  /** The hue with the most neighbours within ±20°. */
  modalHue: number
  /** Fraction of the population within ±20° of `modalHue`. */
  hueConcentration: number
  /** Number of distinct founder lineages still present. */
  survivingLineages: number
}

/** Angular distance between two hues, in degrees, in [0, 180]. */
export function hueDistance(a: number, b: number): number {
  const d = Math.abs(((a - b) % 360) + 360) % 360
  return d > 180 ? 360 - d : d
}

/**
 * The most common hue in a population, and how much of the population sits
 * within `window` degrees of it.
 *
 * Found by trying every individual's hue as the centre and keeping the best,
 * rather than by taking a circular mean. The mean is the wrong statistic here:
 * a population split evenly between two colours has a mean sitting between
 * them where nobody is, which would report a sweep as having failed and a
 * failure as a sweep. With at most sixty individuals the exact answer is cheap.
 */
export function modalHue(
  hues: readonly number[],
  window = 20,
): { hue: number; concentration: number } {
  if (hues.length === 0) return { hue: 0, concentration: 0 }
  let bestHue = hues[0]
  let bestCount = 0
  for (const candidate of hues) {
    let count = 0
    for (const h of hues) if (hueDistance(candidate, h) <= window) count++
    if (count > bestCount) {
      bestCount = count
      bestHue = candidate
    }
  }
  return { hue: bestHue, concentration: bestCount / hues.length }
}

/**
 * How founders are drawn for generation 0.
 *
 * `diverse` is the default world the student meets in Part 1: a broad spread
 * across the whole weight space, so there is real variation for selection to
 * act on and no single strategy is pre-installed. The pool options are what
 * the four saved lineages were grown from, and what Part 2 uses to start from
 * a known variety.
 */
export type FounderSetting = 'diverse' | 'P' | 'Q' | 'all-2a' | 'all-2b' | 'all-3a' | 'all-3c'

const NAMED_CENTRES: Record<string, Genome> = {
  'all-2a': { wLL: 1.6, wLR: 0, wRL: 0, wRR: 1.6, bias: 0.6, hue: 200 },
  'all-2b': { wLL: 0, wLR: 1.6, wRL: 1.6, wRR: 0, bias: 0.6, hue: 280 },
  'all-3a': { wLL: -1.6, wLR: 0, wRL: 0, wRR: -1.6, bias: 1.2, hue: 160 },
  'all-3c': { wLL: -1.2, wLR: -1.2, wRL: -1.2, wRR: -1.2, bias: 1.2, hue: 90 },
}

let nextIndividualId = 1

/**
 * Restart individual numbering.
 *
 * Individual ids are global across worlds so that four populations can be shown
 * on one tree without colliding. The cost is that an id depends on how many
 * worlds were built before it, which would make the saved fixtures depend on
 * the order something happened to call things in — and those ids are the tree,
 * so they have to be reproducible. `buildFixtureSet` resets the counter and
 * builds all four in a fixed order, which is the only supported way to make
 * them.
 */
export function resetIndividualIds(): void {
  nextIndividualId = 1
}

/**
 * A breeding population of Module 1 vehicles.
 *
 * Composes a `VehicleWorld` rather than subclassing or flag-switching it: the
 * sensing, the actuator arithmetic, the differential drive and the wall
 * collisions are the Module 1 code, called unchanged, and everything this class
 * adds — energy, depleting food, generations, inheritance — sits strictly
 * outside that. That is the shape `APP_DESIGN`'s one-engine claim actually
 * wants, and it means a bug in Module 2 cannot change how Module 1 behaves.
 */
export class EvolutionWorld {
  params: EvolutionParams
  world: VehicleWorld
  lights: FoodLight[] = []
  population: Individual[] = []
  /** Every individual that has ever lived in this run, for the tree. */
  lineage: LineageNode[] = []
  history: GenerationRecord[] = []
  generation = 0
  /** Simulated seconds since the run began. */
  time = 0
  /** Simulated seconds into the current generation. */
  genTime = 0

  readonly seed: number
  private rng: Rng
  private founders: FounderSetting

  constructor(
    seed: number,
    params: Partial<EvolutionParams> = {},
    founders: FounderSetting = 'diverse',
  ) {
    this.seed = seed
    this.params = { ...DEFAULT_EVOLUTION_PARAMS, ...params }
    this.founders = founders
    this.rng = makeRng(seed)
    this.world = new VehicleWorld(
      { bounds: this.params.bounds, sensorNoise: this.params.sensorNoise },
      this.rng,
    )
    this.seedLights()
    this.seedFounders()
  }

  // ---------------------------------------------------------------- setup

  private seedLights(): void {
    this.lights = []
    for (let i = 0; i < this.params.food.count; i++) {
      const p = respawnPoint(this.lights, this.params.bounds, this.rng)
      const src = this.world.addSource(p.x, 0.7, p.z, this.params.food.strength)
      this.lights.push(freshLight(src, this.params.food.capacity))
    }
  }

  private drawFounderGenome(): Genome {
    if (this.founders === 'diverse') return randomGenome(this.rng, this.params.founderSpread)
    const shift = (pool: FounderPool): FounderPool =>
      this.params.founderHueShift === 0
        ? pool
        : {
            ...pool,
            centre: {
              ...pool.centre,
              hue: wrapHue(pool.centre.hue + this.params.founderHueShift),
            },
          }
    if (this.founders === 'P') return drawFounder(shift(FOUNDER_POOLS.P), this.rng)
    if (this.founders === 'Q') return drawFounder(shift(FOUNDER_POOLS.Q), this.rng)
    const centre = NAMED_CENTRES[this.founders]
    return drawFounder(
      {
        id: this.founders,
        label: this.founders,
        description: '',
        centre,
        spread: 0.3,
        hueSpread: 70,
      },
      this.rng,
    )
  }

  private seedFounders(): void {
    const genomes: Genome[] = []
    for (let i = 0; i < this.params.populationSize; i++) {
      genomes.push(this.drawFounderGenome())
    }
    this.installGeneration(genomes.map((g) => ({ genome: g, parentId: null, founderId: -1 })))
    // A founder is its own lineage's root, which cannot be known until its id
    // is assigned — hence the placeholder above and the fixup here.
    for (const ind of this.population) {
      ind.founderId = ind.id
    }
    for (const node of this.lineage) {
      if (node.generation === 0) node.founderId = node.id
    }
  }

  /**
   * Place the population for a generation.
   *
   * Deliberately deterministic — an evenly spaced ring with tangential headings
   * — rather than a random scatter. Two reasons, both about what the lab
   * measures. Within a run, identical starting conditions each generation mean
   * a difference in energy is a difference in genome rather than in luck of
   * placement, which is what makes the fitness plot readable. Across runs, it
   * means the four saved populations are compared from the same starting line,
   * which the separability test needs.
   */
  private placement(i: number, n: number): { x: number; z: number; heading: number } {
    const angle = (i / n) * Math.PI * 2
    const r = this.params.bounds * 0.55
    return {
      x: Math.cos(angle) * r,
      z: Math.sin(angle) * r,
      // Tangential, so nobody starts aimed at the middle or at a wall.
      heading: angle + Math.PI / 2,
    }
  }

  /**
   * Build the vehicles and individuals for a generation. Does not touch the
   * lineage record, so it can serve both a fresh generation and a fork, which
   * re-materializes individuals that already have a place in the tree.
   */
  private materialize(
    specs: {
      id?: number
      genome: Genome
      parentId: number | null
      founderId: number
      generation?: number
    }[],
  ): Individual[] {
    this.world.vehicles = []
    this.population = []
    const n = specs.length
    specs.forEach((spec, i) => {
      const pose = this.placement(i, n)
      const vehicle = this.world.addWeightedVehicle(
        genomeToWeights(spec.genome),
        hueToCss(spec.genome.hue),
        pose,
      )
      this.population.push({
        id: spec.id ?? nextIndividualId++,
        parentId: spec.parentId,
        founderId: spec.founderId,
        generation: spec.generation ?? this.generation,
        genome: spec.genome,
        energy: 0,
        vehicle,
      })
    })
    return this.population
  }

  private installGeneration(
    specs: { genome: Genome; parentId: number | null; founderId: number }[],
  ): void {
    for (const ind of this.materialize(specs)) {
      this.lineage.push({
        id: ind.id,
        parentId: ind.parentId,
        founderId: ind.founderId,
        generation: ind.generation,
        hue: ind.genome.hue,
        energy: 0,
        reproduced: false,
      })
    }
  }

  /**
   * Split this population into an independent branch that carries on from
   * exactly here with a different random stream.
   *
   * This is how W and X are made, and the reason it exists rather than "run the
   * engine twice and call them sisters" is that Part 3's payoff is a student
   * opening the tree. Two separate runs would show two separate trees with no
   * common ancestor, and the homology the lab asks them to find would simply
   * not be there to find. A fork shares the whole trunk: the same founders, the
   * same individuals generation by generation up to the split, and one point
   * after which the two branches diverge.
   *
   * The world is copied along with the population — same light positions, same
   * stores — so the only thing that differs after the split is which way the
   * dice fall. That is what a lineage splitting actually is.
   */
  fork(newSeed: number): EvolutionWorld {
    const child = new EvolutionWorld(newSeed, this.params, this.founders)
    child.generation = this.generation
    child.time = this.time
    child.genTime = this.genTime
    child.history = this.history.map((h) => ({ ...h }))
    child.lineage = this.lineage.map((n) => ({ ...n }))

    child.world.sources = []
    child.lights = this.lights.map((l) => {
      const src = child.world.addSource(
        l.source.x,
        l.source.y,
        l.source.z,
        l.source.strength,
      )
      return { source: src, store: l.store, capacity: l.capacity, respawnAt: l.respawnAt }
    })

    child.materialize(
      this.population.map((p) => ({
        id: p.id,
        genome: { ...p.genome },
        parentId: p.parentId,
        founderId: p.founderId,
        generation: p.generation,
      })),
    )
    return child
  }

  // ----------------------------------------------------------------- run

  /** Advance the world by `dt` simulated seconds. */
  step(dt: number): void {
    this.world.step(dt)
    this.accrueEnergy(dt)
    this.time += dt
    this.genTime += dt
    this.respawnDue()
  }

  private accrueEnergy(dt: number): void {
    const { regime, food, energy } = this.params
    const sign = REGIME_SIGN[regime]
    for (const ind of this.population) {
      const v = ind.vehicle
      const c = intakeContributions(
        v.state.x,
        v.config.sensorHeight,
        v.state.z,
        this.lights,
        food,
      )
      let total = 0
      for (const contribution of c) total += contribution

      const gain = sign * food.intakeRate * total * dt
      const effort = (Math.abs(v.actuators.left) + Math.abs(v.actuators.right)) / 2
      const cost = (energy.baseCost + energy.moveCost * effort) * dt
      ind.energy += gain - cost

      // Only food is consumed. A poisonous light is a hazard rather than a
      // resource, and a hazard that got used up would let a population
      // stumble through a poison world by eating the poison.
      if (regime === 'food' && food.deplete) {
        for (let i = 0; i < this.lights.length; i++) {
          if (c[i] <= 0) continue
          const l = this.lights[i]
          l.store -= food.intakeRate * c[i] * dt
          if (l.store <= 0) {
            l.store = 0
            l.respawnAt = this.time + food.respawnDelay
            this.world.removeSource(l.source.id)
          }
        }
      }
    }
    // Keep every rendered light in step with what is left in it -- once, after
    // all the draws, not once per vehicle.
    if (regime === 'food' && food.deplete) {
      for (const l of this.lights) {
        if (l.respawnAt === null) l.source.strength = lightStrength(l, food)
      }
    }
  }

  private respawnDue(): void {
    for (const l of this.lights) {
      if (l.respawnAt === null || this.time < l.respawnAt) continue
      const p = respawnPoint(this.lights, this.params.bounds, this.rng)
      l.store = l.capacity
      l.respawnAt = null
      // A respawned light is a new light in a new place, so it gets a new
      // source rather than moving the old one -- the id changes, which is what
      // stops a student's "remove the nearest light" from silently targeting a
      // light that is no longer there.
      l.source = this.world.addSource(p.x, 0.7, p.z, this.params.food.strength)
    }
  }

  /** Run exactly one generation from wherever the current one stands. */
  stepGeneration(dt = 1 / 30): void {
    const target = this.params.generationLength
    let guard = 0
    while (this.genTime < target && guard++ < 200000) {
      this.step(Math.min(dt, target - this.genTime))
    }
    this.endGeneration()
  }

  /** Run `n` whole generations. */
  run(n: number, dt = 1 / 30): void {
    for (let i = 0; i < n; i++) this.stepGeneration(dt)
  }

  // ------------------------------------------------------------ breeding

  /**
   * Close the generation: record it, choose parents, and install their
   * offspring.
   *
   * Population size is constant, so the top half leaving two offspring each is
   * the same rule as "everyone above the median replaces itself twice". With
   * selection off the same number of parents is drawn uniformly instead, which
   * keeps every other quantity identical between the two conditions — the point
   * of Part 2's third experiment is drift, and it is only visible if nothing
   * else moved.
   */
  endGeneration(): void {
    this.recordGeneration()

    const n = this.params.populationSize
    const parentCount = Math.max(1, Math.floor(n / 2))
    const ranked = [...this.population]
    if (this.params.selection) {
      ranked.sort((a, b) => b.energy - a.energy)
    } else {
      // Fisher-Yates from the seeded stream, so "at random" is still replayable.
      for (let i = ranked.length - 1; i > 0; i--) {
        const j = this.rng.int(i + 1)
        ;[ranked[i], ranked[j]] = [ranked[j], ranked[i]]
      }
    }
    const parents = ranked.slice(0, parentCount)

    const byId = new Map(this.lineage.map((l) => [l.id, l]))
    for (const p of parents) {
      const node = byId.get(p.id)
      if (node) node.reproduced = true
    }

    const specs: { genome: Genome; parentId: number | null; founderId: number }[] = []
    for (let i = 0; i < n; i++) {
      const parent = parents[i % parents.length]
      const genome = this.params.inheritance
        ? mutate(parent.genome, this.rng, this.params.mutationRates, this.params.mutationScale)
        : randomGenome(this.rng, this.params.founderSpread)
      specs.push({
        genome,
        parentId: parent.id,
        // With inheritance off an offspring is not descended from anything in
        // any meaningful sense, but it still has a parent in the tree -- which
        // is exactly the picture Q4 wants: ancestry without resemblance.
        founderId: parent.founderId,
      })
    }

    this.generation++
    this.genTime = 0
    this.installGeneration(specs)
    this.refillLights()
  }

  /**
   * Every generation starts with a full larder in the same places.
   *
   * Lights keep the positions they have drifted to, but their stores are
   * refilled and any that are out come back. Otherwise a late generation would
   * inherit whatever the previous one left behind and mean energy would fall
   * across a run for reasons that have nothing to do with the population —
   * which is the number Q2 asks a student to compare between generation 1 and
   * generation 50.
   */
  private refillLights(): void {
    for (const l of this.lights) {
      l.store = l.capacity
      if (l.respawnAt !== null) {
        l.respawnAt = null
        const p = respawnPoint(this.lights, this.params.bounds, this.rng)
        l.source = this.world.addSource(p.x, 0.7, p.z, this.params.food.strength)
      } else {
        l.source.strength = this.params.food.strength
      }
    }
  }

  private recordGeneration(): void {
    const pop = this.population
    const energies = pop.map((p) => p.energy)
    const hues = pop.map((p) => p.genome.hue)
    const { hue, concentration } = modalHue(hues)

    const byId = new Map(this.lineage.map((l) => [l.id, l]))
    for (const p of pop) {
      const node = byId.get(p.id)
      if (node) node.energy = p.energy
    }

    this.history.push({
      generation: this.generation,
      meanEnergy: energies.reduce((a, b) => a + b, 0) / (energies.length || 1),
      bestEnergy: energies.length ? Math.max(...energies) : 0,
      meanCrossing:
        pop.reduce((a, p) => a + crossing(p.genome), 0) / (pop.length || 1),
      meanSign:
        pop.reduce((a, p) => a + meanWeight(p.genome), 0) / (pop.length || 1),
      modalHue: hue,
      hueConcentration: concentration,
      survivingLineages: new Set(pop.map((p) => p.founderId)).size,
    })
  }

  // ------------------------------------------------------------ controls

  /**
   * Change the world under a population that is already living in it — which
   * is how Part 2's fifth experiment works: evolve a well-adapted population,
   * then switch the lights to poison **without resetting**, and watch what
   * being well-adapted was worth.
   */
  setRegime(regime: LightRegime): void {
    this.params.regime = regime
  }

  setSensorNoise(noise: number): void {
    this.params.sensorNoise = noise
    this.world.params.sensorNoise = noise
  }

  /** A light the student placed. It joins the pool and behaves like any other. */
  addLight(x: number, y: number, z: number): void {
    const src = this.world.addSource(x, y, z, this.params.food.strength)
    this.lights.push(freshLight(src, this.params.food.capacity))
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

  clearLights(): void {
    for (const l of this.lights) this.world.removeSource(l.source.id)
    this.lights = []
  }
}
