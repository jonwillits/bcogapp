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
   *
   * The spec proposed 4. Measured over ten seeds, 4 leaves the final population
   * only 77% concentrated and passes the fixation test in 4 seeds of 10; 2
   * gives 95% and passes in 10 of 10. The difference is that a lineage keeps
   * diversifying *after* it has swept, and fifty generations is long enough for
   * a sigma of 4 to spread it back out.
   */
  hue: 2,
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

/**
 * **Body colour, read directly off the wiring genes.**
 *
 * Red is how strongly the straight connections run, green how strongly the
 * crossed ones, blue the resting drive. So two creatures the same colour *are*
 * wired the same, and a population converging on one colour is a population
 * whose wiring is converging — which is what makes evolution watchable in the
 * arena rather than only in a panel.
 *
 * This also settles a debt from Lab 1, where colour identified the variety and
 * students spent an hour learning to trust it. Making colour neutral in Lab 2
 * would have quietly punished exactly the habit Lab 1 taught. The neutral trait
 * they need for Q15 and Q16 is still there — it is the `hue` gene, now worn as
 * an ornament rather than as the body (see `markCss`).
 *
 * Channels are floored at 60 rather than 0: this is a dark scene, and a
 * weakly-wired creature would otherwise be black on near-black, which this
 * palette has swallowed twice before.
 */
export function bodyColour(g: Genome): string {
  const channel = (v: number, lo: number, hi: number) =>
    Math.round(60 + 195 * clamp((v - lo) / (hi - lo), 0, 1))
  return `rgb(${channel((g.wLL + g.wRR) / 2, -2.5, 2.5)}, ${channel(
    (g.wLR + g.wRL) / 2,
    -2.5,
    2.5,
  )}, ${channel(g.bias, 0, 1.5)})`
}

/**
 * The neutral trait, as a colour for the creature's ornament.
 *
 * This is the gene that does nothing: not sensed, not in the actuator
 * arithmetic, no effect on energy. It is inherited and it mutates slowly, so it
 * hitchhikes when a lineage sweeps — and a student who has watched fifty
 * generations ends up looking at a population wearing one mark for no reason at
 * all. That is the whole of Q15 and Q16, and nothing may ever set it from
 * fitness.
 */
export function markCss(hue: number): string {
  return `hsl(${wrapHue(hue).toFixed(0)}, 85%, 62%)`
}

/**
 * A genome's hue as a CSS colour.
 *
 * Saturation and lightness are fixed, so hue is the only thing that varies and
 * a student comparing two vehicles is comparing the one gene. They are also
 * both high: this is a dark scene, and a desaturated or dim body would be hard
 * to tell from the floor -- the palette has already swallowed two things drawn
 * correctly in this app.
 */
export function hueToCss(hue: number): string {
  // Comma-separated on purpose: three.js's colour parser does not accept the
  // modern space-separated `hsl(H S% L%)` form and silently falls back to
  // white, which renders every vehicle in the population the same colour. That
  // is not a cosmetic failure -- the whole of Q15 and Q16 is a student watching
  // one colour take over.
  return `hsl(${wrapHue(hue).toFixed(0)}, 72%, 62%)`
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
 * A genome drawn with no ancestry at all — used for the diverse founder draw
 * and, more importantly, for **inheritance off**, where every offspring gets one
 * of these instead of its parent's. Part 2's second experiment is what that
 * setting exists for: selection with nothing to select *on*.
 *
 * `spread` is the half-width of the uniform draw on each weight, and it is a
 * real tuning knob rather than a detail. Drawn across the whole legal range,
 * a good fraction of founders happen to be competent light-seekers by chance
 * and generation 1 is already close to the ceiling — which leaves adaptation
 * with nowhere to go and makes Part 1 a flat line. A narrower draw makes the
 * founders genuinely poor at the problem, which is both what the acceptance
 * test wants and the more honest picture: variation is the raw material, not a
 * pre-loaded answer.
 */
export function randomGenome(rng: Rng, spread: number = GENE_RANGE.weight.max): Genome {
  const w = () => rng.range(-spread, spread)
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
  /**
   * Standard deviation of the founder draw on `hue`, in degrees.
   *
   * Wide on purpose. Which colour a lineage ends up wearing is decided by which
   * founder happened to win, so a narrow founder spread makes every run from a
   * pool come out roughly the same colour — and the four saved lineages then
   * cannot differ in colour in the way Part 3 needs, because two of them share
   * a pool. Widening it costs nothing anywhere else: the hue draw is the last
   * one `drawFounder` takes, so changing its scale leaves the position of the
   * random stream, and therefore every weight in the run, untouched.
   */
  hueSpread: number
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
    hueSpread: 70,
  },
  Q: {
    id: 'Q',
    label: 'Pool Q',
    description:
      'Ipsilateral excitatory. Each sensor drives the actuator on its own side, so it turns away from light and flees, fastest when close.',
    centre: { wLL: 0.8, wLR: 0, wRL: 0, wRR: 0.8, bias: 0.6, hue: 40 },
    spread: 0.3,
    hueSpread: 70,
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
    hue: wrapHue(c.hue + rng.normal() * pool.hueSpread),
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
 * Positive if this genome steers *toward* light, negative if away.
 *
 * The product of the two axes, which works because the four Braitenberg
 * varieties sit in the four quadrants of that plane and approach lives on one
 * diagonal: crossed-and-excitatory (2b) turns toward a light and charges,
 * straight-and-inhibitory (3a) turns toward it and settles, and the other two
 * diagonal-mates turn away. Magnitude is how committed the steering is, so a
 * barely-wired genome scores near zero whichever way it leans.
 *
 * Used for the answer key and for the acceptance tests, never in the UI.
 */
export function approachScore(g: Genome): number {
  return crossing(g) * meanWeight(g)
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
