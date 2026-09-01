import { describe, it, expect } from 'vitest'
import { buildFixtureSet, FIXTURE_RECIPES, pruneLineage } from './lineages'
import { LINEAGE_DATA } from './lineageData'
import { observe, CENTRE_LIGHT, PERTURBATIONS, type ObservationResult } from './observation'
import { crossing, meanWeight, type Genome } from '../creature/genome'
import {
  OBSERVE_OPTS,
  onFixtureNativePlatform,
  tells,
  describeGaps,
  SAME_JOB,
  Y_SPECIFICATION,
  DIVERGENCE,
  positiveRatio,
} from './separability'
import { hueDistance, modalHue } from './evolutionWorld'

/**
 * Part 3's acceptance tests — §6's "one hard build requirement" and §10's
 * separability and divergence criteria.
 *
 * Two of §10's criteria are restated here, and unlike the two restated in
 * `evolution.test.ts` these were forced by a conflict inside §10 itself rather
 * than by measurement noise. Both are documented at the test that carries them.
 */

/**
 * The observation conditions, imported rather than restated.
 *
 * This used to be a local copy of the same three numbers. They matched, but
 * nothing made them match — and the battery's thresholds in `separability.ts`
 * are calibrated under `OBSERVE_OPTS`, so a divergence between the two would
 * have meant asserting thresholds derived from a world other than the one being
 * measured. Found by a mutation test that should have gone red and did not,
 * because the mutation was applied to the copy the tests did not use.
 */
const OPTS = OBSERVE_OPTS
const byId = Object.fromEntries(LINEAGE_DATA.map((f) => [f.id, f]))

const APPROACHERS = ['W', 'X', 'Y']

const cache = new Map<string, ObservationResult>()
function look(id: string, worldIndex: number): ObservationResult {
  const key = `${id}|${worldIndex}`
  const hit = cache.get(key)
  if (hit) return hit
  const world = worldIndex === 0 ? CENTRE_LIGHT : PERTURBATIONS[worldIndex - 1]
  const o = observe(byId[id].genomes, world, OPTS)
  cache.set(key, o)
  return o
}


describe('the fixtures are genuine engine output', () => {
  /**
   * §9 forbids hand-authoring these populations, for two reasons: a hand-built
   * "evolved" population is a lie of the kind the lab is partly about, and a
   * student can open the lineage tree and see whether the history is real.
   *
   * This is what makes that claim checkable rather than merely asserted. If
   * anyone edits the stored data, or changes the engine without regenerating,
   * this fails — and it should, because the data would then be describing a
   * history the engine no longer produces.
   */
  /**
   * Gated on the platform the data was generated on, and that gate is doing
   * more work than it looks.
   *
   * Regenerating a fixture is not reproducible across platforms at all.
   * `rng.normal()` is Box-Muller, so it rests on `Math.log`, `Math.sin` and
   * `Math.cos`, which ECMAScript specifies as *implementation-approximated*
   * rather than correctly rounded; a last-bit difference between two V8 builds
   * compounds through hundreds of mutations until it flips which creature wins
   * the reproduction queue. A first attempt at this assumed the ancestry
   * survived even where gene values drifted, on the evidence that member ids
   * matched. The CI runner disproved it immediately: X's pruned lineage came
   * out 102 nodes against 116. Same survivors, different parents.
   *
   * So CI runs the test job on the same architecture, and this gate is the
   * safety net — if the runner image ever changes arch, the guarantee degrades
   * to a visible skip rather than a blocked deploy.
   *
   * None of it reaches students. The fixtures are committed data and every
   * student gets the same populations whatever a build machine computes; what a
   * foreign platform cannot do is re-derive them.
   */
  it.runIf(onFixtureNativePlatform)(
    'every fixture reproduces exactly from its recipe',
    () => {
      const r3 = (n: number) => Math.round(n * 1000) / 1000
      const rebuilt = buildFixtureSet()
      for (const [i, recipe] of FIXTURE_RECIPES.entries()) {
        const stored = byId[recipe.id]
        expect(rebuilt[i].memberIds, `${recipe.id} member ids`).toEqual(stored.memberIds)
        expect(
          rebuilt[i].genomes.map((g) => ({
            wLL: r3(g.wLL), wLR: r3(g.wLR), wRL: r3(g.wRL), wRR: r3(g.wRR),
            bias: r3(g.bias), hue: r3(g.hue),
          })),
          `${recipe.id} genomes — regenerate per the header of lineageData.ts`,
        ).toEqual(stored.genomes)
        expect(rebuilt[i].lineage.length, `${recipe.id} lineage size`).toBe(
          stored.lineage.length,
        )
      }
    },
    120_000,
  )

  it('every ancestry is well formed and reaches a founder', () => {
    for (const fx of LINEAGE_DATA) {
      const nodes = new Map(fx.lineage.map((n) => [n.id, n]))
      for (const id of fx.memberIds) {
        let cursor = nodes.get(id)
        expect(cursor, `${fx.id}: member ${id} is missing from its own lineage`).toBeDefined()
        let hops = 0
        while (cursor && cursor.parentId !== null) {
          const parent = nodes.get(cursor.parentId)
          expect(parent, `${fx.id}: broken link at ${cursor.id}`).toBeDefined()
          expect(parent!.generation).toBe(cursor.generation - 1)
          cursor = parent
          expect(++hops).toBeLessThan(500)
        }
        // The walk ends at a founder: generation 0, its own lineage root.
        expect(cursor!.generation).toBe(0)
        expect(cursor!.id).toBe(cursor!.founderId)
      }
    }
  })

  it('pruning keeps ancestors and drops dead ends', () => {
    const lineage = [
      { id: 1, parentId: null, founderId: 1, generation: 0, hue: 0, energy: 0, reproduced: true },
      { id: 2, parentId: null, founderId: 2, generation: 0, hue: 0, energy: 0, reproduced: false },
      { id: 3, parentId: 1, founderId: 1, generation: 1, hue: 0, energy: 0, reproduced: true },
      { id: 4, parentId: 2, founderId: 2, generation: 1, hue: 0, energy: 0, reproduced: false },
      { id: 5, parentId: 3, founderId: 1, generation: 2, hue: 0, energy: 0, reproduced: false },
    ]
    expect(pruneLineage(lineage, [5]).map((n) => n.id)).toEqual([1, 3, 5])
  })
})

/**
 * Part 3's criteria under the **generational** engine.
 *
 * Mirrored verbatim from `continuousLineages.test.ts`, deliberately. Nothing
 * student-facing reads these fixtures — the scene imports
 * `CONTINUOUS_LINEAGE_DATA` only — so this file guards the engine that was
 * replaced, not the one that ships. It is kept because the continuous engine was
 * adopted on the evidence that it matched the generational one on every
 * acceptance test, and that comparison is worth nothing if the two suites stop
 * asking the same questions. The criteria themselves live in `separability.ts`
 * so there is one definition rather than two.
 */
describe('Part 3 — they do the same job', () => {
  /**
   * **This replaces §6's separability test, which was retired rather than
   * relaxed.** The distinction matters and is the whole of why these tests look
   * different from the ones they succeed.
   *
   * Relaxing would be keeping the claim "W, X and Y are indistinguishable" and
   * widening the bar until it passed. That is exactly the failure this area has
   * a history of: the suite reported the criterion satisfied twice, on a
   * statistic that could not see what a viewer saw first. Retiring is different
   * — the lab no longer makes that claim. §6 is unsatisfiable in this engine
   * (the argument and its 108 measured configurations are recorded at
   * `SAME_JOB`), so Part 3 now asks which populations do the same *job*, and Y
   * approaching backwards is still Y approaching.
   *
   * A retirement is only honest if the replacement claim is written down and
   * checked. That is these four tests.
   */
  it('W, X and Y all reach the light and stay near it', () => {
    for (const id of APPROACHERS) {
      const o = look(id, 0)
      expect(o.arrivedFraction, `${id} should reach the light`).toBeGreaterThan(
        SAME_JOB.minArrived,
      )
      expect(o.meanDistance, `${id} should stay near it`).toBeLessThan(
        SAME_JOB.maxMeanDistance,
      )
    }
  })

  it('Z does not — it is the contrast that keeps the grouping non-trivial', () => {
    const z = look('Z', 0)
    expect(z.arrivedFraction).toBeLessThan(SAME_JOB.maxFleerArrived)
    for (const id of APPROACHERS)
      expect(
        z.meanDistance / look(id, 0).meanDistance,
        `Z should sit far outside ${id}`,
      ).toBeGreaterThan(SAME_JOB.minFleerDistanceRatio)
  })

  /**
   * The sisters are the calibration point for the whole battery, and the reason
   * its thresholds are derived rather than chosen: Jon cannot sort W from X by
   * eye, so whatever they differ by is, by observation, invisible.
   *
   * It is also a real requirement in its own right. W and X are the homology; if
   * a regenerated pair became tellable apart, a student would split them by
   * watching and Q13's homology arm would collapse with no test failing. Sixty
   * student-reachable worlds were swept looking for one that separates them
   * reliably and none does — the best candidate reverses direction depending on
   * where the light is clicked, and closes entirely if you watch for ninety
   * seconds instead of thirty.
   */
  it('the sisters are indistinguishable, which is what calibrates the battery', () => {
    const t = tells(['W', 'X'].map((id) => ({ id, observation: look(id, 0) })))
    expect(t.length, `W and X should not be tellable apart: ${describeGaps(t)}`).toBe(0)
  })

  /**
   * The battery, inverted from a constraint into a specification.
   *
   * While §6 stood this asked that *no* measure separate the three. Now that the
   * handout says outright that Y approaches backwards, it asks that the
   * separation be exactly what the handout describes and nothing more. A
   * regenerated Y that also parked, span on the spot, hugged the rim or took
   * visibly longer to arrive would make the student-facing description wrong in
   * a new way, and this is what catches it.
   */
  it('Y differs by driving backwards, and by nothing a student is not told about', () => {
    const firing = tells(APPROACHERS.map((id) => ({ id, observation: look(id, 0) })))
    const keys = firing.map((g) => g.measure.key)
    const allowed: readonly string[] = [
      ...Y_SPECIFICATION.mustDiffer,
      ...Y_SPECIFICATION.mayDiffer,
    ]
    const unexpected = firing.filter((g) => !allowed.includes(g.measure.key))
    expect(
      unexpected.length,
      `Y differs on something the handout does not describe: ${describeGaps(unexpected)}`,
    ).toBe(0)
    for (const key of Y_SPECIFICATION.mustDiffer)
      expect(keys, `the handout says Y approaches backwards; ${key} should show it`).toContain(
        key,
      )
  })
})

describe('the divergence test', () => {
  /**
   * **Restated from §10, and restated a second time now.**
   *
   * §10 asks that at least two perturbations separate Y from W and X by a factor
   * of two on *mean distance*. No triple ever achieved that, for a structural
   * reason: mean distance is the statistic separability was defined on, chosen
   * precisely because every approacher ends up near the light whatever took it
   * there. A statistic chosen to be blind to mechanism does not stop being blind
   * when the world is perturbed.
   *
   * The first restatement measured **within-vehicle spread of distance and
   * speed** — holding station versus swinging past. Speed has now been dropped
   * from it, for two reasons. It is signed, so a ratio across a sign flip is
   * meaningless: W at +0.67 against Y at −1.05 scores 33 and would pass any bar
   * without a perturbation doing anything. And the speed difference is visible
   * in the *default* world, so counting it here would let this test pass on
   * something the student can already see — when the point of Q14 is to design a
   * world that shows them something they cannot.
   *
   * So divergence is station-keeping alone. Three of the five perturbations
   * clear a factor of two; two do not, and are kept because the handout asks a
   * student what they tried that failed.
   */
  const stationKeeping = (worldIndex: number): number => {
    const wx =
      (look('W', worldIndex).meanDistanceSpread +
        look('X', worldIndex).meanDistanceSpread) /
      2
    return positiveRatio(wx, look('Y', worldIndex).meanDistanceSpread)
  }

  it('at least two perturbations separate Y from W and X by a factor of two', () => {
    const scores = PERTURBATIONS.map((_, i) => stationKeeping(i + 1))
    expect(
      scores.filter((s) => s >= DIVERGENCE.minRatio).length,
      `per-perturbation: ${PERTURBATIONS.map(
        (p, i) => `${p.label} ${scores[i].toFixed(2)}`,
      ).join(', ')}`,
    ).toBeGreaterThanOrEqual(DIVERGENCE.minPerturbations)
  })

  /**
   * The control that used to sit here asserted that the default world does *not*
   * separate them. It has been retired with §6 — the default world does separate
   * them, openly, and a test saying otherwise would be asserting something known
   * to be false.
   *
   * What replaces it is the claim that actually needs guarding: the perturbation
   * has to *add* something. If the default world already separated them on
   * station-keeping, Q14 would be asking students to discover what they had
   * been looking at all along.
   */
  it('and station-keeping is not already given away in the default world', () => {
    expect(stationKeeping(0)).toBeLessThan(1.6)
  })
})

describe('the answer key holds', () => {
  const wiring = (genomes: Genome[]) => ({
    crossing: genomes.reduce((a, g) => a + crossing(g), 0) / genomes.length,
    sign: genomes.reduce((a, g) => a + meanWeight(g), 0) / genomes.length,
  })

  it('W and X are contralateral excitatory; Y is ipsilateral inhibitory', () => {
    // Q11 asks a student to read this off the wiring panel, so it has to be
    // there to read. Q12 needs W/X and Y to be genuinely different machinery.
    for (const id of ['W', 'X']) {
      const w = wiring(byId[id].genomes)
      expect(w.crossing, `${id} should be contralateral`).toBeGreaterThan(1)
      expect(w.sign, `${id} should be excitatory`).toBeGreaterThan(0)
    }
    const y = wiring(byId.Y.genomes)
    expect(y.crossing, 'Y should be ipsilateral').toBeLessThan(-1)
    expect(y.sign, 'Y should be inhibitory').toBeLessThan(0)
  })

  it('Z is ipsilateral excitatory and flees', () => {
    const z = wiring(byId.Z.genomes)
    expect(z.crossing).toBeLessThan(-1)
    expect(z.sign).toBeGreaterThan(0)
  })

  it('W and X share a recent common ancestor; Y and Z share none with them', () => {
    // The homology, checked in the tree rather than asserted in a comment.
    const founders = (id: string) => new Set(byId[id].lineage.filter((n) => n.generation === 0).map((n) => n.id))
    const w = founders('W')
    const x = founders('X')
    const shared = [...w].filter((f) => x.has(f))
    expect(shared.length, 'W and X must share founders').toBeGreaterThan(0)

    // The split is real *and recent*: their most recent common ancestor lives
    // long after the founders, which is what makes this a homology rather than
    // the trivial observation that everything in one pool is related. Note the
    // MRCA sits somewhat before the fork generation -- the two branches descend
    // from different individuals alive at the split, whose own common ancestor
    // is a few generations further back.
    const ids = (id: string) => new Set(byId[id].lineage.map((n) => n.id))
    const nodesOf = new Map(byId.W.lineage.concat(byId.X.lineage).map((n) => [n.id, n]))
    const shared2 = [...ids('W')].filter((n) => ids('X').has(n))
    const mrca = Math.max(...shared2.map((n) => nodesOf.get(n)!.generation))
    expect(mrca, 'W and X must have a recent common ancestor').toBeGreaterThan(50)

    // ...and nothing is shared with the other pool.
    for (const other of ['Y', 'Z']) {
      expect([...w].filter((f) => founders(other).has(f))).toHaveLength(0)
    }
  })

  it('W, X and Z wear one colour and Y wears another, for no reason at all', () => {
    // The coincidence. Q10 offers homology, analogy and coincidence; the colour
    // is the third, and it has to be visible enough to tempt.
    const hue = (id: string) => modalHue(byId[id].genomes.map((g) => g.hue)).hue
    expect(hueDistance(hue('W'), hue('Z'))).toBeLessThan(20)
    expect(hueDistance(hue('W'), hue('X'))).toBeLessThan(20)
    expect(hueDistance(hue('Y'), hue('W'))).toBeGreaterThan(90)
    expect(hueDistance(hue('Y'), hue('Z'))).toBeGreaterThan(90)
  })

  it('each fixture has fixed on one colour', () => {
    // Otherwise "they share a colour" is not a thing a student can see.
    for (const fx of LINEAGE_DATA) {
      expect(
        modalHue(fx.genomes.map((g) => g.hue)).concentration,
        `${fx.id} should be one colour`,
      ).toBeGreaterThan(0.7)
    }
  })
})
