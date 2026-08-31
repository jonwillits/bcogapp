import {
  ContinuousWorld,
  resetCreatureIds,
  DEFAULT_CONTINUOUS_PARAMS,
  type ContinuousParams,
  type Lineage,
} from './continuousWorld'
import type { LightRegime } from './evolutionWorld'
import type { Genome } from '../creature/genome'

/**
 * The four saved populations of Part 3, under the continuous engine.
 *
 * As before, nothing here constructs a population: each recipe is a seed and a
 * set of switches, and running it reproduces the fixture exactly. That is what
 * makes §9's "genuine history" claim checkable rather than asserted — a student
 * can open the lineage tree, so the tree has to be true.
 *
 * What is new is that the four did not all evolve for the same length of time,
 * and one of them evolved in a different kind of world. Both are consequences of
 * measurement rather than convenience, and both are recorded on the recipes.
 */

export interface ContinuousFixture {
  id: 'W' | 'X' | 'Y' | 'Z'
  pool: 'P' | 'Q'
  /** The population a student runs, watches and inspects. */
  genomes: Genome[]
  /** Ancestry of exactly these creatures, back to their founders. */
  lineage: Lineage[]
  memberIds: number[]
  /** Sim seconds this population was evolved for — the tree's time axis. */
  duration: number
}

export interface ContinuousFixtureRecipe {
  id: 'W' | 'X' | 'Y' | 'Z'
  pool: 'P' | 'Q'
  regime: LightRegime
  seed: number
  /** Simulated seconds of evolution. */
  duration: number
  /** If set, this fixture is a branch of a run split at this time. */
  splitAt?: number
  branchSeed?: number
  hueShift: number
  /** Overrides for the world this population evolved in. */
  world?: Partial<ContinuousParams>
  note: string
}

/**
 * Found by search, not chosen — `continuousFixtures.probe.ts` scores every
 * branch of every candidate P run against every clean pool-Q run, on both halves
 * of §10 at once.
 */
export const CONTINUOUS_FIXTURE_RECIPES: ContinuousFixtureRecipe[] = [
  {
    id: 'W',
    pool: 'P',
    regime: 'food',
    seed: 8,
    splitAt: 3000,
    branchSeed: 103,
    duration: 3600,
    hueShift: 24,
    note: "Sister of X: the same run to 3000s, then a different stream. 81% contralateral excitatory. The hue shift lands its colour on Z's, which is the coincidence Part 3 turns on.",
  },
  {
    id: 'X',
    pool: 'P',
    regime: 'food',
    seed: 8,
    splitAt: 3000,
    branchSeed: 106,
    duration: 3600,
    hueShift: 24,
    note: 'The other branch of the same split. 94% contralateral excitatory; matches W to 10% on arrival time and 0.27 units on mean distance.',
  },
  {
    id: 'Y',
    pool: 'Q',
    regime: 'food',
    seed: 14,
    duration: 4800,
    hueShift: 0,
    note: "Pool Q took the ipsilateral-inhibitory route on this seed, and cleanly -- every one of the sixteen is 3a-like. Evolved for 4800s against W and X's 3600 because the two pools develop at different rates: P amplifies a trait it already has, while Q's route to 3a has to flip its straight weights through zero, which is a fitness valley. At equal durations the two are five times apart on time-to-arrival, and no triple survives.",
  },
  {
    id: 'Z',
    pool: 'Q',
    regime: 'poison',
    seed: 4,
    duration: 4800,
    hueShift: 0,
    world: {
      energy: { baseCost: 0.05, moveCost: 0.06, ambientIncome: 0.4 },
      food: { ...DEFAULT_CONTINUOUS_PARAMS.food, count: 2 },
    },
    note: "Still ipsilateral excitatory, still flees -- all sixteen of them. Never reaches the light, and sits 2.5x further out than the three approachers. Its world has **ambient food and dangerous lights**, which is not decoration: once energy drives reproduction, a world whose only feature is harmful is one where nothing can ever breed, and the first attempt at Z went extinct in every seed. Its colour lands on W's and 131 degrees from Y's, so the population that actually shares Y's ancestry is the one that looks least like it.",
  },
]

/** Keep only the ancestors of a given set of creatures. */
export function pruneLineage(
  lineage: readonly Lineage[],
  memberIds: readonly number[],
): Lineage[] {
  const byId = new Map(lineage.map((n) => [n.id, n]))
  const keep = new Set<number>()
  for (const id of memberIds) {
    let cursor: number | null = id
    while (cursor !== null && !keep.has(cursor)) {
      keep.add(cursor)
      cursor = byId.get(cursor)?.parentId ?? null
    }
  }
  return lineage.filter((n) => keep.has(n.id)).map((n) => ({ ...n }))
}

function paramsFor(recipe: ContinuousFixtureRecipe): Partial<ContinuousParams> {
  return {
    ...DEFAULT_CONTINUOUS_PARAMS,
    regime: recipe.regime,
    founderHueShift: recipe.hueShift,
    ...recipe.world,
  }
}

function harvestFixture(
  recipe: ContinuousFixtureRecipe,
  world: ContinuousWorld,
): ContinuousFixture {
  const memberIds = world.creatures.map((c) => c.id)
  return {
    id: recipe.id,
    pool: recipe.pool,
    genomes: world.creatures.map((c) => ({ ...c.genome })),
    lineage: pruneLineage(world.lineage, memberIds),
    memberIds,
    duration: recipe.duration,
  }
}

/**
 * Build all four in one deterministic pass — the only supported way to make
 * them.
 *
 * W and X are sisters, and what makes them sisters is sharing the individuals in
 * their trunk: the same ids, on one tree. Building them separately runs the
 * trunk twice, so the genomes match but the creatures are numbered afresh and
 * the two trees have no node in common. Everything would look right and the
 * homology would not be there for a student to find.
 */
export function buildContinuousFixtureSet(
  recipes: readonly ContinuousFixtureRecipe[] = CONTINUOUS_FIXTURE_RECIPES,
): ContinuousFixture[] {
  resetCreatureIds()
  const out = new Map<string, ContinuousFixture>()

  const pair = recipes.filter((r) => r.splitAt !== undefined)
  if (pair.length) {
    const [first] = pair
    const base = new ContinuousWorld(first.seed, paramsFor(first), first.pool)
    base.run(first.splitAt!)
    for (const recipe of pair) {
      const branch = base.fork(recipe.branchSeed!)
      branch.run(recipe.duration - recipe.splitAt!)
      out.set(recipe.id, harvestFixture(recipe, branch))
    }
  }

  for (const recipe of recipes) {
    if (recipe.splitAt !== undefined) continue
    const world = new ContinuousWorld(recipe.seed, paramsFor(recipe), recipe.pool)
    world.run(recipe.duration)
    out.set(recipe.id, harvestFixture(recipe, world))
  }

  return recipes.map((r) => out.get(r.id)!)
}

/**
 * The answer key.
 *
 * W ~ X is **homology** — sister branches of one run, sharing every ancestor to
 * 3000 seconds. W ~ Y and X ~ Y is **analogy** — the same behaviour reached from
 * a different pool by different machinery, with no common ancestor that had it.
 * Z is the contrast that keeps the behavioural grouping from being "all of
 * them". And the colour W, X and Z share is **coincidence**: it spans both
 * founder pools and means nothing at all.
 */
export const CONTINUOUS_FIXTURE_ANSWERS: Record<string, string> = {
  W: 'Contralateral excitatory, pool P. Sister of X; they share every ancestor to 3000s.',
  X: 'Contralateral excitatory, pool P. Sister of W — the homology.',
  Y: 'Ipsilateral inhibitory, pool Q, which fled light. Evolved approach independently by the other of the two routes out of Q — the analogy.',
  Z: 'Ipsilateral excitatory, pool Q, evolved where light was dangerous and food was everywhere. Still flees. Shares a body colour with W and X, which means nothing.',
}
