import { clamp } from '../math'
import type { Rng } from '../random'
import type { SensorimotorWeights } from '../neural/sensorimotor'

/**
 * A vehicle's heritable material, at Module-2 stage.
 *
 * There is deliberately nothing here that is not already a Module 1 vehicle's
 * description. Lab 1 told students that "ipsilateral and contralateral are
 * really just this same wiring with half of the connections missing", and the
 * app has carried a full 2x2 weight matrix per vehicle since M1 for exactly
 * this reason. So the genome is not a new abstraction laid over the creature —
 * it is the numbers the creature already had, plus a colour that does nothing.
 *
 * Gene names follow the spec: `w` then the *sensor* side then the *actuator*
 * side, so `wLR` is sensor L driving actuator R. That matches the existing
 * `leftToRight` naming in the sensorimotor layer.
 */
export interface Genome {
  /** sensor L → actuator L */
  wLL: number
  /** sensor L → actuator R */
  wLR: number
  /** sensor R → actuator L */
  wRL: number
  /** sensor R → actuator R */
  wRR: number
  /** resting drive of both actuators */
  bias: number
  /**
   * Body colour, in degrees around the hue circle.
   *
   * **This gene affects nothing whatsoever.** It is not sensed, it does not
   * enter the actuator arithmetic, and it changes no part of how a vehicle
   * moves or what it earns. It is inherited and it mutates, so when a lineage
   * sweeps the population its colour sweeps with it — and a student who has
   * watched 50 generations ends up looking at a population of one colour for no
   * reason at all. Questions 15 and 16 of the handout are built on that being a
   * genuine hitchhike, so nothing may ever set it from fitness, and nothing may
   * ever overwrite it on an evolved population.
   */
  hue: number
}

/** The bounds each gene is clipped to after mutation. */
export const GENE_RANGE = {
  weight: { min: -3, max: 3 },
  bias: { min: 0, max: 1.5 },
} as const

/**
 * How far a gene moves per generation, as the standard deviation of an
 * independent Gaussian draw. Starting values from the spec; the acceptance
 * tests are what settle them.
 */
export interface MutationRates {
  weight: number
  bias: number
  hue: number
}

export const DEFAULT_MUTATION_RATES: MutationRates = {
  weight: 0.15,
  bias: 0.08,
  /**
   * Hue must mutate *slowly relative to a sweep*. If it wandered as fast as the
   * weights, a lineage's descendants would fan back out across the colour
   * circle as fast as the lineage took it over, the population would end up
   * multicoloured, and the lab's best moment — a student writing a confident
   * adaptive explanation for a trait that does nothing — would never arrive.
   */
  hue: 4,
}

/** The genome as the four weights and bias the sensorimotor layer consumes. */
export function genomeToWeights(g: Genome): SensorimotorWeights {
  return {
    leftToLeft: g.wLL,
    leftToRight: g.wLR,
    rightToLeft: g.wRL,
    rightToRight: g.wRR,
    bias: g.bias,
  }
}

/** Wrap a hue into [0, 360). */
export function wrapHue(h: number): number {
  return ((h % 360) + 360) % 360
}

/**
 * Copy a genome with an independent Gaussian perturbation on every gene.
 *
 * Every gene mutates independently and every gene mutates *every* generation —
 * there is no per-gene probability of mutating. That is a simplification of
 * real mutation, and it is the right one here: it makes the mutation-rate
 * slider a single legible quantity ("how far do offspring drift from their
 * parent"), which is what Part 2's first experiment switches to zero.
 *
 * Scale 0 returns an exact copy, which is what makes that experiment clean: with
 * mutation off, offspring are identical to their parent and the only variation
 * in the population is what the founders came with.
 */
export function mutate(
  g: Genome,
  rng: Rng,
  rates: MutationRates,
  scale = 1,
): Genome {
  const w = (v: number) =>
    clamp(
      v + rng.normal() * rates.weight * scale,
      GENE_RANGE.weight.min,
      GENE_RANGE.weight.max,
    )
  return {
    wLL: w(g.wLL),
    wLR: w(g.wLR),
    wRL: w(g.wRL),
    wRR: w(g.wRR),
    bias: clamp(
      g.bias + rng.normal() * rates.bias * scale,
      GENE_RANGE.bias.min,
      GENE_RANGE.bias.max,
    ),
    // Hue wraps rather than clipping: it is a circle, and clipping it would
    // pile lineages up at 0 and 360 and manufacture a convergence that the
    // hue-fixation test is supposed to be measuring honestly.
    hue: wrapHue(g.hue + rng.normal() * rates.hue * scale),
  }
}

/**
 * A genome drawn with no ancestry at all — used for the founder pool's spread
 * and, more importantly, for **inheritance off**, where every offspring gets one
 * of these instead of its parent's. Part 2's second experiment is what that
 * setting exists for: selection with nothing to select *on*.
 */
export function randomGenome(rng: Rng): Genome {
  const w = () => rng.range(GENE_RANGE.weight.min, GENE_RANGE.weight.max)
  return {
    wLL: w(),
    wLR: w(),
    wRL: w(),
    wRR: w(),
    bias: rng.range(GENE_RANGE.bias.min, GENE_RANGE.bias.max),
    hue: rng.range(0, 360),
  }
}

/**
 * A founder pool: a genome centre plus the spread founders are drawn around it
 * with. The two pools the four saved lineages descend from are **P** and **Q**,
 * and the whole of Part 3 turns on their difference.
 */
export interface FounderPool {
  id: string
  label: string
  /** What the pool does before any evolution — the honest answer key. */
  description: string
  centre: Genome
  /** Standard deviation of the founder draw around `centre`, per weight gene. */
  spread: number
}

/**
 * `hue` on a pool centre is a *starting* colour, not a fixed one: it mutates
 * from generation 1 like any other gene, and which colour a lineage ends up
 * with is whatever its winning ancestor happened to carry. Choosing centres is
 * the only sanctioned way to influence the outcome — the spec forbids
 * overwriting an evolved population's hue, because a scripted colour would make
 * the lab's central demonstration a lie.
 */
export const FOUNDER_POOLS: Record<'P' | 'Q', FounderPool> = {
  P: {
    id: 'P',
    label: 'Pool P',
    description:
      'Contralateral excitatory, weakly. Each sensor drives the opposite actuator, so it turns toward light and charges at it — badly, and it overshoots.',
    centre: { wLL: 0, wLR: 0.8, wRL: 0.8, wRR: 0, bias: 0.6, hue: 210 },
    spread: 0.3,
  },
  Q: {
    id: 'Q',
    label: 'Pool Q',
    description:
      'Ipsilateral excitatory. Each sensor drives the actuator on its own side, so it turns away from light and flees, fastest when close.',
    centre: { wLL: 0.8, wLR: 0, wRL: 0, wRR: 0.8, bias: 0.6, hue: 40 },
    spread: 0.3,
  },
}

/**
 * Draw one founder from a pool: the centre plus Gaussian noise on each weight.
 *
 * Note that the spread is applied to *all four* weights including the ones the
 * pool centres at zero. That is deliberate and is what makes Part 3's story
 * possible: pool Q's crossed connections are not absent, they are near zero,
 * so selection has something to grow if it takes the contralateral route to
 * light-approach rather than the inhibitory one.
 */
export function drawFounder(pool: FounderPool, rng: Rng): Genome {
  const c = pool.centre
  const w = (v: number) =>
    clamp(
      v + rng.normal() * pool.spread,
      GENE_RANGE.weight.min,
      GENE_RANGE.weight.max,
    )
  return {
    wLL: w(c.wLL),
    wLR: w(c.wLR),
    wRL: w(c.wRL),
    wRR: w(c.wRR),
    bias: clamp(
      c.bias + rng.normal() * 0.15,
      GENE_RANGE.bias.min,
      GENE_RANGE.bias.max,
    ),
    hue: wrapHue(c.hue + rng.normal() * 25),
  }
}

/**
 * Where a genome sits on the two axes the Population panel plots, and the same
 * two numbers a student reads off the wiring panel by eye.
 *
 * `crossing` is how much more the crossed connections carry than the straight
 * ones: strongly positive is contralateral, strongly negative is ipsilateral,
 * near zero is fully connected (or barely connected at all). `sign` is the mean
 * weight: positive is excitatory, negative inhibitory. Lab 1's six varieties
 * sit at known corners of that plane, which is what makes a sweep legible as a
 * cloud crossing it.
 */
export function crossing(g: Genome): number {
  return g.wLR + g.wRL - (g.wLL + g.wRR)
}

export function meanWeight(g: Genome): number {
  return (g.wLL + g.wLR + g.wRL + g.wRR) / 4
}

/**
 * The nearest Lab 1 designation for a genome, for the answer key and the
 * fixture-generation reports — **not** for the student-facing UI, which shows
 * the wiring panel and lets them classify it themselves (that is Q11).
 */
export function nearestVariety(g: Genome): string {
  const c = crossing(g)
  const s = meanWeight(g)
  const pattern = c > 0.6 ? 'contra' : c < -0.6 ? 'ipsi' : 'full'
  const sign = s >= 0 ? 'excitatory' : 'inhibitory'
  const label =
    pattern === 'contra'
      ? s >= 0
        ? '2b'
        : '3b'
      : pattern === 'ipsi'
        ? s >= 0
          ? '2a'
          : '3a'
        : s >= 0
          ? '2c'
          : '3c'
  return `${label} (${pattern}, ${sign})`
}
