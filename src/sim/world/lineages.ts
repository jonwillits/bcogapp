import {
  EvolutionWorld,
  resetIndividualIds,
  type EvolutionParams,
  type FounderSetting,
  type LineageNode,
  type LightRegime,
} from './evolutionWorld'
import type { Genome } from '../creature/genome'

/**
 * The four saved populations of Part 3 — W, X, Y and Z — and the recipes that
 * produce them.
 *
 * §9 is emphatic that these must be genuine engine output rather than
 * hand-authored genomes, for two reasons that are both about honesty. A
 * hand-built "evolved" population is a lie of exactly the kind the lab is
 * partly about. And a student can open the lineage tree, so a fabricated
 * history would be a fabrication they can see.
 *
 * So nothing here constructs a population. Each recipe is a seed and a set of
 * switches; running it reproduces the fixture exactly, which is what makes the
 * stored data checkable — `lineages.test.ts` regenerates all four and compares.
 */

export interface LineageFixture {
  id: 'W' | 'X' | 'Y' | 'Z'
  /** Which founder pool this descends from. Revealed only by True history. */
  pool: 'P' | 'Q'
  /** The population a student runs, watches and inspects. */
  genomes: Genome[]
  /** Ancestry of exactly these individuals, back to their founders. */
  lineage: LineageNode[]
  /** Ids of the individuals in `genomes`, in the same order. */
  memberIds: number[]
}

export interface FixtureRecipe {
  id: 'W' | 'X' | 'Y' | 'Z'
  pool: 'P' | 'Q'
  regime: LightRegime
  seed: number
  generations: number
  /**
   * If set, this fixture is a branch: the run proceeds to `splitAt`, then forks
   * with `branchSeed` and continues to `generations`. Its sister carries the
   * same `seed` and `splitAt` with a different `branchSeed`, which is what
   * gives the pair a shared trunk and a real most-recent common ancestor.
   */
  splitAt?: number
  branchSeed?: number
  /** Degrees added to the pool's founder hue. See `founderHueShift`. */
  hueShift: number
  /** Why this seed and not another — the answer key, and the regeneration note. */
  note: string
}

/**
 * Keep only the ancestors of a given set of individuals.
 *
 * The full record of a forty-generation run is around a thousand individuals,
 * almost all of them dead ends. What Part 3's tree shows is the ancestry *of
 * the population in front of you*, which after selection has coalesced hard —
 * typically a few dozen nodes. Pruning is what makes the fixture small enough
 * to ship as source and the tree legible enough to read.
 */
export function pruneLineage(
  lineage: readonly LineageNode[],
  memberIds: readonly number[],
): LineageNode[] {
  const byId = new Map(lineage.map((n) => [n.id, n]))
  const keep = new Set<number>()
  const walk = (id: number) => {
    let cursor: number | null = id
    while (cursor !== null && !keep.has(cursor)) {
      keep.add(cursor)
      cursor = byId.get(cursor)?.parentId ?? null
    }
  }
  for (const id of memberIds) walk(id)
  return lineage.filter((n) => keep.has(n.id)).map((n) => ({ ...n }))
}

function harvest(recipe: FixtureRecipe, world: EvolutionWorld): LineageFixture {
  const memberIds = world.population.map((p) => p.id)
  return {
    id: recipe.id,
    pool: recipe.pool,
    genomes: world.population.map((p) => ({ ...p.genome })),
    lineage: pruneLineage(world.lineage, memberIds),
    memberIds,
  }
}

const paramsFor = (recipe: FixtureRecipe): Partial<EvolutionParams> => ({
  regime: recipe.regime,
  founderHueShift: recipe.hueShift,
})

/**
 * Build all four fixtures in one deterministic pass. **This is the only
 * supported way to make them**, and the reason is the sister pair.
 *
 * W and X are branches of one run, and what makes them sisters is that they
 * share the individuals in their trunk — the same ids, on one tree. Building
 * them separately runs the trunk twice: the genomes come out identical, because
 * the seed is the same, but the individuals are numbered afresh and the two
 * trees have no node in common. Everything would look right and the homology
 * would simply not be there for a student to find, which is the one thing Part
 * 3 asks them to do.
 *
 * So the split happens once, here, and both branches fork from it. The id
 * counter is reset first so the numbering does not depend on whatever else the
 * process built earlier.
 */
export function buildFixtureSet(
  recipes: readonly FixtureRecipe[] = FIXTURE_RECIPES,
): LineageFixture[] {
  resetIndividualIds()
  const out = new Map<string, LineageFixture>()

  // The sister pair first, from one trunk.
  const pair = recipes.filter((r) => r.splitAt !== undefined)
  if (pair.length) {
    const [first] = pair
    const base = new EvolutionWorld(first.seed, paramsFor(first), first.pool as FounderSetting)
    base.run(first.splitAt!)
    for (const recipe of pair) {
      const branch = base.fork(recipe.branchSeed!)
      branch.run(recipe.generations - recipe.splitAt!)
      out.set(recipe.id, harvest(recipe, branch))
    }
  }

  for (const recipe of recipes) {
    if (recipe.splitAt !== undefined) continue
    const world = new EvolutionWorld(
      recipe.seed,
      paramsFor(recipe),
      recipe.pool as FounderSetting,
    )
    world.run(recipe.generations)
    out.set(recipe.id, harvest(recipe, world))
  }

  return recipes.map((r) => out.get(r.id)!)
}

/**
 * The four recipes, and why each seed rather than another.
 *
 * Found by search, not by choice: `fixtures.probe.ts` enumerates every branch of
 * every candidate P run against every Q run that took the ipsilateral-inhibitory
 * route, and scores the triples against §10's separability bounds. 4777 triples
 * pass; this is the tightest.
 */
export const FIXTURE_RECIPES: FixtureRecipe[] = [
  {
    id: 'W',
    pool: 'P',
    regime: 'food',
    seed: 4,
    splitAt: 90,
    branchSeed: 105,
    generations: 120,
    hueShift: 18.4,
    note: 'Sister of X: the same run to generation 90, then a different stream. 120 generations rather than 40 because a forty-generation population is barely wired (mean |w| ~0.6) and its mechanism has almost no behavioural consequence -- every world looks the same and Q14 has nothing to find. By 120 the wiring is strong enough to behave like what it is. The hue shift lands its colour on Z\'s; see founderHueShift for why that changes nothing else.',
  },
  {
    id: 'X',
    pool: 'P',
    regime: 'food',
    seed: 4,
    splitAt: 90,
    branchSeed: 108,
    generations: 120,
    hueShift: 18.4,
    note: 'The other branch of the same split. Matches W to 7.7% on time-to-arrival and 0.24 units on mean distance.',
  },
  {
    id: 'Y',
    pool: 'Q',
    regime: 'food',
    seed: 23,
    generations: 120,
    hueShift: 0,
    note: 'Q took the ipsilateral-inhibitory route on this seed, and cleanly -- 23 of 24 individuals are 3a-like. That matters as much as the behaviour: Q11 asks a student to read the wiring off the panel, so a population that is a mixture of varieties has no answer. The other route out of Q arrives at the same mechanism as W and X and would make Part 3 vacuous. Indistinguishable from W and X in the default world; comes apart from them under three of the four perturbations.',
  },
  {
    id: 'Z',
    pool: 'Q',
    regime: 'poison',
    seed: 2,
    generations: 120,
    hueShift: 0,
    note: 'Still ipsilateral excitatory, still flees. Mean distance 6.69 against the approachers\' 3.0, and it never arrives. Chosen from twenty candidates for the hue: 171 degrees from Y, so the one population that shares a founder pool with Y is the one that looks least like it, while W and X -- which share no ancestor with it at all -- wear its colour.',
  },
]

/**
 * The answer key, in one table.
 *
 * W ~ X is **homology**: sister branches of one run, sharing every ancestor up
 * to generation 25. W ~ Y and X ~ Y is **analogy**: the same behaviour reached
 * from a different pool by a different mechanism, with no common ancestor that
 * had it. Z is the contrast case that keeps the behavioural grouping from being
 * trivially "all of them". And the body colour W, X and Z share is
 * **coincidence** — it spans both pools and means nothing at all.
 */
export const FIXTURE_ANSWERS: Record<string, string> = {
  W: 'Contralateral excitatory, from pool P. Sister of X; they share every ancestor to generation 25.',
  X: 'Contralateral excitatory, from pool P. Sister of W — the homology.',
  Y: 'Ipsilateral inhibitory, from pool Q, which fled light. Evolved approach independently, by the other of the two routes out of Q — the analogy.',
  Z: 'Ipsilateral excitatory, from pool Q under poison. Still flees light. Shares a body colour with W and X, which means nothing.',
}
