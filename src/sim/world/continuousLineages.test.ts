import { describe, it, expect } from 'vitest'
import {
  buildContinuousFixtureSet,
  CONTINUOUS_FIXTURE_RECIPES,
  pruneLineage,
} from './continuousLineages'
import { CONTINUOUS_LINEAGE_DATA } from './continuousLineageData'
import { observe, CENTRE_LIGHT, PERTURBATIONS, type ObservationResult } from './observation'
import { crossing, meanWeight, type Genome } from '../creature/genome'
import { hueDistance, modalHue } from './evolutionWorld'

/**
 * Part 3's acceptance tests under the continuous engine.
 *
 * Same two criteria as ever, and they still pull against each other: the three
 * approachers must be indistinguishable in the default world, and perturbations
 * must pull Y away from W and X. Divergence is measured on *how they move* —
 * within-vehicle spread of distance, and speed — rather than on mean distance,
 * for the reason established during the generational build: mean distance is the
 * statistic separability is defined on, precisely because every approacher ends
 * up near the light whatever took it there, so it cannot also see a mechanism.
 */

const OPTS = { startRadius: 0.3, lightStrength: 4, duration: 30 }
const byId = Object.fromEntries(CONTINUOUS_LINEAGE_DATA.map((f) => [f.id, f]))
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

const ratio = (a: number, b: number) =>
  Math.max(a, b) / Math.max(0.02, Math.min(a, b))

describe('the fixtures are genuine engine output', () => {
  it('every fixture reproduces exactly from its recipe', () => {
    const r3 = (n: number) => Math.round(n * 1000) / 1000
    const rebuilt = buildContinuousFixtureSet()
    for (const [i, recipe] of CONTINUOUS_FIXTURE_RECIPES.entries()) {
      const stored = byId[recipe.id]
      expect(rebuilt[i].memberIds, `${recipe.id} member ids`).toEqual(stored.memberIds)
      expect(
        rebuilt[i].genomes.map((g) => ({
          wLL: r3(g.wLL), wLR: r3(g.wLR), wRL: r3(g.wRL), wRR: r3(g.wRR),
          bias: r3(g.bias), hue: r3(g.hue),
        })),
        `${recipe.id} genomes — regenerate per the header of continuousLineageData.ts`,
      ).toEqual(stored.genomes)
      expect(rebuilt[i].lineage.length, `${recipe.id} lineage size`).toBe(
        stored.lineage.length,
      )
    }
  }, 300_000)

  it('every ancestry is well formed and reaches a founder', () => {
    for (const fx of CONTINUOUS_LINEAGE_DATA) {
      const nodes = new Map(fx.lineage.map((n) => [n.id, n]))
      for (const id of fx.memberIds) {
        let cursor = nodes.get(id)
        expect(cursor, `${fx.id}: member ${id} missing from its own lineage`).toBeDefined()
        let hops = 0
        while (cursor && cursor.parentId !== null) {
          const parent = nodes.get(cursor.parentId)
          expect(parent, `${fx.id}: broken link at ${cursor.id}`).toBeDefined()
          // Time runs forwards: a parent is always born before its offspring.
          expect(parent!.bornAt).toBeLessThanOrEqual(cursor.bornAt)
          cursor = parent
          expect(++hops).toBeLessThan(2000)
        }
        expect(cursor!.parentId).toBeNull()
        expect(cursor!.id).toBe(cursor!.founderId)
      }
    }
  })

  it('pruning keeps ancestors and drops dead ends', () => {
    const n = (id: number, parentId: number | null, bornAt: number) => ({
      id, parentId, founderId: 1, bornAt, diedAt: null, mark: 0, reproduced: false,
    })
    const lineage = [n(1, null, 0), n(2, null, 0), n(3, 1, 10), n(4, 2, 10), n(5, 3, 20)]
    expect(pruneLineage(lineage, [5]).map((x) => x.id)).toEqual([1, 3, 5])
  })
})

describe('the separability test — §6’s one hard build requirement', () => {
  it('time to first arrival falls within 15%', () => {
    const a = APPROACHERS.map((id) => look(id, 0).meanTimeToArrival)
    expect(Math.max(...a) / Math.min(...a) - 1).toBeLessThan(0.15)
  })

  it('mean distance falls within 10% of the pit radius', () => {
    const d = APPROACHERS.map((id) => look(id, 0).meanDistance)
    expect(Math.max(...d) - Math.min(...d)).toBeLessThan(0.9)
  })

  it('neither how much they move nor how much they wander gives them away', () => {
    const spreads = APPROACHERS.map((id) => look(id, 0).meanDistanceSpread)
    const speeds = APPROACHERS.map((id) => look(id, 0).meanSpeed)
    expect(ratio(Math.max(...spreads), Math.min(...spreads))).toBeLessThan(1.6)
    expect(ratio(Math.max(...speeds), Math.min(...speeds))).toBeLessThan(1.6)
  })

  it('Z is obviously different', () => {
    const z = look('Z', 0)
    expect(z.arrivedFraction).toBeLessThan(0.15)
    for (const id of APPROACHERS) {
      const a = look(id, 0)
      expect(a.arrivedFraction, `${id} should reach the light`).toBeGreaterThan(0.4)
      expect(z.meanDistance / a.meanDistance).toBeGreaterThan(1.8)
    }
  })
})

describe('the divergence test', () => {
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
    expect(
      scores.filter((s) => s >= 2).length,
      `per-perturbation: ${PERTURBATIONS.map(
        (p, i) => `${p.label} ${scores[i].toFixed(2)}`,
      ).join(', ')}`,
    ).toBeGreaterThanOrEqual(2)
  })

  it('and the default world still does not', () => {
    expect(separates(0)).toBeLessThan(1.6)
  })
})

describe('the answer key holds', () => {
  const wiring = (genomes: Genome[]) => ({
    crossing: genomes.reduce((a, g) => a + crossing(g), 0) / genomes.length,
    sign: genomes.reduce((a, g) => a + meanWeight(g), 0) / genomes.length,
  })

  it('W and X are contralateral excitatory; Y is ipsilateral inhibitory', () => {
    for (const id of ['W', 'X']) {
      const w = wiring(byId[id].genomes)
      expect(w.crossing, `${id} contralateral`).toBeGreaterThan(1)
      expect(w.sign, `${id} excitatory`).toBeGreaterThan(0)
    }
    const y = wiring(byId.Y.genomes)
    expect(y.crossing, 'Y ipsilateral').toBeLessThan(-1)
    expect(y.sign, 'Y inhibitory').toBeLessThan(0)
  })

  it('Z is ipsilateral excitatory and flees', () => {
    const z = wiring(byId.Z.genomes)
    expect(z.crossing).toBeLessThan(-1)
    expect(z.sign).toBeGreaterThan(0)
  })

  it('W and X share a recent common ancestor; the other pool shares none', () => {
    const ids = (id: string) => new Set(byId[id].lineage.map((n) => n.id))
    const nodes = new Map(
      byId.W.lineage.concat(byId.X.lineage).map((n) => [n.id, n]),
    )
    const shared = [...ids('W')].filter((n) => ids('X').has(n))
    expect(shared.length, 'W and X must share ancestors').toBeGreaterThan(0)

    // Recent: their most recent common ancestor lives well into the run, which
    // is what makes this a homology rather than "everything in a pool is
    // related".
    const mrca = Math.max(...shared.map((n) => nodes.get(n)!.bornAt))
    expect(mrca).toBeGreaterThan(500)

    for (const other of ['Y', 'Z']) {
      expect([...ids('W')].filter((n) => ids(other).has(n))).toHaveLength(0)
    }
  })

  it('W, X and Z wear one colour and Y wears another, for no reason at all', () => {
    const hue = (id: string) => modalHue(byId[id].genomes.map((g) => g.hue)).hue
    expect(hueDistance(hue('W'), hue('Z'))).toBeLessThan(30)
    expect(hueDistance(hue('W'), hue('X'))).toBeLessThan(30)
    expect(hueDistance(hue('Y'), hue('W'))).toBeGreaterThan(90)
    expect(hueDistance(hue('Y'), hue('Z'))).toBeGreaterThan(90)
  })

  it('each fixture has fixed on one colour', () => {
    for (const fx of CONTINUOUS_LINEAGE_DATA) {
      expect(
        modalHue(fx.genomes.map((g) => g.hue)).concentration,
        `${fx.id} should be one colour`,
      ).toBeGreaterThan(0.7)
    }
  })
})
