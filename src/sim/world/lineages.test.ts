import { describe, it, expect } from 'vitest'
import { buildFixtureSet, FIXTURE_RECIPES, pruneLineage } from './lineages'
import { LINEAGE_DATA } from './lineageData'
import { observe, CENTRE_LIGHT, PERTURBATIONS, type ObservationResult } from './observation'
import { crossing, meanWeight, type Genome } from '../creature/genome'
import { hueDistance, modalHue } from './evolutionWorld'

/**
 * Part 3's acceptance tests — §6's "one hard build requirement" and §10's
 * separability and divergence criteria.
 *
 * Two of §10's criteria are restated here, and unlike the two restated in
 * `evolution.test.ts` these were forced by a conflict inside §10 itself rather
 * than by measurement noise. Both are documented at the test that carries them.
 */

const OPTS = { startRadius: 0.3, lightStrength: 4, duration: 30 }
const byId = Object.fromEntries(LINEAGE_DATA.map((f) => [f.id, f]))

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

/** How far apart two numbers are, as a ratio ≥ 1. */
const ratio = (a: number, b: number) =>
  Math.max(a, b) / Math.max(0.02, Math.min(a, b))

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
  it('every fixture reproduces exactly from its recipe', () => {
    const r3 = (n: number) => Math.round(n * 1000) / 1000
    const rebuiltAll = buildFixtureSet()
    for (const [i, recipe] of FIXTURE_RECIPES.entries()) {
      const rebuilt = rebuiltAll[i]
      const stored = byId[recipe.id]
      expect(rebuilt.memberIds, `${recipe.id} member ids`).toEqual(stored.memberIds)
      expect(
        rebuilt.genomes.map((g) => ({
          wLL: r3(g.wLL), wLR: r3(g.wLR), wRL: r3(g.wRL), wRR: r3(g.wRR),
          bias: r3(g.bias), hue: r3(g.hue),
        })),
        `${recipe.id} genomes — regenerate with the command at the top of lineageData.ts`,
      ).toEqual(stored.genomes)
      expect(rebuilt.lineage.length, `${recipe.id} lineage size`).toBe(stored.lineage.length)
    }
  }, 120_000)

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

describe('the separability test — §6’s one hard build requirement', () => {
  /**
   * In the default world W, X and Y must not be tellable apart by watching. The
   * whole of Part 3 rests on a student being unable to sort them by eye, having
   * to commit to a guess, and then having to design a perturbation that
   * separates them. If they separate on their own, the lab loses its spine.
   *
   * §10 names two measures. This checks four, because a student watching does
   * not restrict themselves to the two the spec happened to name — and the two
   * extra ones, how much each vehicle's distance varies and how fast it moves,
   * are exactly what the divergence test below uses to pull them apart. They
   * have to be *equal here* for that to mean anything.
   */
  const APPROACHERS = ['W', 'X', 'Y']

  it('time to first arrival falls within 15%', () => {
    const arrivals = APPROACHERS.map((id) => look(id, 0).meanTimeToArrival)
    expect(Math.max(...arrivals) / Math.min(...arrivals) - 1).toBeLessThan(0.15)
  })

  it('mean distance falls within 10% of the pit radius', () => {
    const dists = APPROACHERS.map((id) => look(id, 0).meanDistance)
    expect(Math.max(...dists) - Math.min(...dists)).toBeLessThan(0.9)
  })

  it('neither how much they move nor how much they wander gives them away', () => {
    const spreads = APPROACHERS.map((id) => look(id, 0).meanDistanceSpread)
    const speeds = APPROACHERS.map((id) => look(id, 0).meanSpeed)
    // How much each vehicle's distance varies matches closely: 1.08.
    expect(ratio(Math.max(...spreads), Math.min(...spreads))).toBeLessThan(1.3)
    /**
     * Speed is the loosest of the four default-world matches, at 1.51 between
     * X (0.64) and Y (0.97), and the bound here says so rather than pretending
     * otherwise. Tightening it further was tried and is the wrong trade: the
     * only triples that match on speed to within 1.35 have populations that are
     * barely wired at all, and their *mechanisms* stop being readable — the best
     * such candidate had a W that was 46% pure across six varieties and came out
     * ipsilateral, the same machinery as Y, which would leave Q12 with nothing
     * to find. Clean wiring for Q11 is worth more than a tighter speed match.
     *
     * Worth an eye on the built scene: both populations are slow in absolute
     * terms and there are 24 vehicles each, so this should not be rankable by
     * watching. If it turns out to be, the fix is a different Y from the same
     * search rather than a change to the engine.
     */
    expect(ratio(Math.max(...speeds), Math.min(...speeds))).toBeLessThan(1.6)
  })

  it('Z is obviously different on both of §10’s measures', () => {
    const z = look('Z', 0)
    const approachers = APPROACHERS.map((id) => look(id, 0))
    // Never arrives, where all three approachers do.
    expect(z.arrivedFraction).toBeLessThan(0.1)
    for (const a of approachers) {
      expect(a.arrivedFraction).toBeGreaterThan(0.5)
      expect(z.meanDistance / a.meanDistance).toBeGreaterThan(2)
    }
  })
})

describe('the divergence test', () => {
  /**
   * **Restated from §10, and this one was forced by a conflict inside the spec
   * rather than by noise.**
   *
   * §10 asks that at least two perturbations separate Y from W and X by "mean
   * distance differing by a factor of two or more". Measured across 128 candidate
   * branches and 34 candidate Y runs, **no triple that passes the separability
   * test achieves that on mean distance under any perturbation at all** — not
   * one, at any run length tried.
   *
   * The reason is structural rather than a matter of tuning. Mean distance is
   * the statistic separability is defined on, and it is defined on it precisely
   * because every approacher ends up near the light whatever mechanism took it
   * there. A statistic chosen to be blind to mechanism in the default world does
   * not stop being blind to mechanism when the world is perturbed.
   *
   * What separates them is *how they move rather than where they end up* — an
   * ipsilateral inhibitory population holds station at the light, a
   * contralateral excitatory one keeps swinging past it. That is also precisely
   * what a student sees. So divergence is measured on within-vehicle variation
   * in distance and on speed, and on those three of the four perturbations
   * separate Y from W and X by a factor of two or more.
   *
   * The perturbations' own parameters had to be tuned to get there, and are
   * documented in `observation.ts`: two lights work only when far apart, and a
   * light must be removed early rather than mid-run.
   */
  const separates = (worldIndex: number): number => {
    const wx = (pick: (o: ObservationResult) => number) =>
      (pick(look('W', worldIndex)) + pick(look('X', worldIndex))) / 2
    const y = look('Y', worldIndex)
    return Math.max(
      ratio(wx((o) => o.meanDistanceSpread), y.meanDistanceSpread),
      ratio(wx((o) => o.meanSpeed), y.meanSpeed),
    )
  }

  it('at least two perturbations separate Y from W and X by a factor of two', () => {
    const scores = PERTURBATIONS.map((_, i) => separates(i + 1))
    const working = scores.filter((s) => s >= 2).length
    expect(
      working,
      `per-perturbation scores: ${PERTURBATIONS.map(
        (p, i) => `${p.label} ${scores[i].toFixed(2)}`,
      ).join(', ')}`,
    ).toBeGreaterThanOrEqual(2)
  })

  it('and the default world still does not', () => {
    // The other half of the same claim: whatever pulls them apart must not be
    // visible before the student perturbs anything.
    expect(separates(0)).toBeLessThan(1.5)
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
