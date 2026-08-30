import { describe, it, expect } from 'vitest'
import { EvolutionWorld, modalHue, hueDistance, type EvolutionParams } from './evolutionWorld'
import { approachScore, mutate, DEFAULT_MUTATION_RATES } from '../creature/genome'
import { makeRng } from '../random'

/**
 * The Module 2 scene's acceptance tests, from §10 of the scene spec.
 *
 * These are the build's definition of done and they run headless against the
 * sim layer, which is not a convenience but a necessity: the Browser pane
 * throttles requestAnimationFrame, which freezes react-three-fiber's useFrame,
 * so a scripted check in a browser sees zero generations run. Everything the
 * lab actually depends on therefore has to be checkable here.
 *
 * Two of §10's criteria were restated during the build after measurement showed
 * them unsatisfiable as literally written. Both restatements are documented at
 * the test that carries them, and both are noted for Jon to carry back into the
 * spec in Box.
 */

const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / (a.length || 1)

function run(seed: number, params: Partial<EvolutionParams> = {}, gens = 50): EvolutionWorld {
  const w = new EvolutionWorld(seed, params)
  w.run(gens)
  return w
}

/**
 * A finished run, reduced to what the tests read, and memoized.
 *
 * Several tests want the same fifty-generation run over the same ten seeds, and
 * each one costs a few hundred thousand simulation steps. Since `npm run test`
 * gates the deploy, running each of them afresh would put minutes on every
 * push for no extra confidence. Only immutable summaries are cached — a test
 * that needs to keep *stepping* a world (the poison switch) builds its own.
 */
interface Summary {
  history: EvolutionWorld['history']
  genomes: { approach: number; hue: number }[]
}
const cache = new Map<string, Summary>()
function summary(seed: number, params: Partial<EvolutionParams> = {}, gens = 50): Summary {
  const key = `${seed}|${gens}|${JSON.stringify(params)}`
  const hit = cache.get(key)
  if (hit) return hit
  const w = run(seed, params, gens)
  const s: Summary = {
    history: w.history,
    genomes: w.population.map((p) => ({
      approach: approachScore(p.genome),
      hue: p.genome.hue,
    })),
  }
  cache.set(key, s)
  return s
}

function windowOf(s: Summary, from: number, to: number): number {
  return mean(
    s.history.filter((h) => h.generation >= from && h.generation <= to).map((h) => h.meanEnergy),
  )
}

describe('the hue-fixation test', () => {
  /**
   * The one Jon named non-negotiable. Questions 15 and 16 turn entirely on a
   * student looking at a population that has gone one colour, writing a
   * confident adaptive explanation for it, and then being told the gene does
   * nothing. A multicoloured population kills both.
   */
  it('at least 80% of the population is within ±20° of the modal hue, in ≥8 of 10 seeds', () => {
    const passes = SEEDS.filter(
      (s) => summary(s).history[49].hueConcentration >= 0.8,
    ).length
    expect(passes).toBeGreaterThanOrEqual(8)
  })

  it('the colour that sweeps is not the colour that earns', () => {
    // The hitchhike has to be real: if hue correlated with energy, the
    // just-so story would quietly be true and Q16 would be a lie.
    const w = run(3, {}, 12)
    const winner = [...w.population].sort((a, b) => b.energy - a.energy)[0]
    const loser = [...w.population].sort((a, b) => a.energy - b.energy)[0]
    // Both ends of the fitness distribution sit inside the same swept colour.
    expect(hueDistance(winner.genome.hue, loser.genome.hue)).toBeLessThan(60)
  })

  it('hue never enters the actuator arithmetic', () => {
    // Structural rather than statistical: two genomes differing only in hue
    // must produce identical behaviour for all time.
    const base = { wLL: 0.4, wLR: 1.7, wRL: 1.5, wRR: -0.2, bias: 0.7, hue: 10 }
    const other = { ...base, hue: 300 }
    const drive = (hue: number) => {
      const w = new EvolutionWorld(7, { populationSize: 1 })
      w.population[0].genome = hue === 10 ? base : other
      w.world.vehicles[0].weights = {
        leftToLeft: base.wLL,
        leftToRight: base.wLR,
        rightToLeft: base.wRL,
        rightToRight: base.wRR,
        bias: base.bias,
      }
      w.run(2)
      return { x: w.world.vehicles[0].state.x, e: w.population[0].energy }
    }
    expect(drive(10)).toEqual(drive(300))
  })
})

describe('the adaptation test', () => {
  /**
   * **Restated from §10.** The spec asks for "mean energy at generation 50 at
   * least twice mean energy at generation 1, in ≥9 of 10 seeds". Measured, that
   * criterion is unstable rather than demanding: generation 1's mean is a
   * single noisy number that the cost model can push through zero, and the
   * ratio then goes to infinity or undefined. Across the parameter sweep the
   * configurations that passed it most often were the ones whose generation-1
   * mean happened to sit near zero — i.e. it was selecting for a fragile
   * denominator, not for adaptation.
   *
   * What the spec plainly *means* is that the population gets better at the
   * problem. The honest measurement of that is the lab's own Part 2 logic:
   * compare against the same seed with selection switched off. Same founders,
   * same lights, same mutations — the only difference is whether energy decides
   * who breeds. That has no unstable denominator and it isolates adaptation
   * from how generous the world happens to be.
   */
  it('a selected population ends well above an unselected one, in every seed', () => {
    const advantages = SEEDS.map((seed) => {
      const on = windowOf(summary(seed), 45, 50)
      const off = windowOf(summary(seed, { selection: false }), 45, 50)
      return on - off
    })
    expect(advantages.every((a) => a > 0)).toBe(true)
    expect(mean(advantages)).toBeGreaterThan(1)
  })

  it('improvement is visible in the number Q2 asks a student to write down', () => {
    // Q2 has them record mean energy at generation 1 and at generation 50. If
    // the two were within noise of each other, Part 1 would have nothing in it.
    const gains = SEEDS.map((seed) => {
      const s = summary(seed)
      return windowOf(s, 45, 50) - windowOf(s, 1, 5)
    })
    expect(gains.filter((g) => g > 0).length).toBeGreaterThanOrEqual(9)
  })

  it('what evolves is steering toward light, not merely standing still', () => {
    // The failure this guards against is real and was observed mid-build: with
    // movement priced too high, the cheapest genome wins and the population
    // converges on vehicles that barely move. Q8 -- "the lights taught the
    // vehicles to steer toward them" -- needs there to be steering to argue
    // about.
    const fractions = SEEDS.map((seed) => {
      const g = summary(seed).genomes
      return g.filter((p) => p.approach > 0).length / g.length
    })
    expect(mean(fractions)).toBeGreaterThan(0.6)
  })
})

describe('the strategy-parity test', () => {
  /**
   * From §3.1: at the default light density, neither parking nor roaming may
   * dominate. If one did, selection would push every population to the same
   * variety and W, X and Y could not differ in the way Part 3 needs.
   */
  it('a population of chargers and a population of parkers earn within 20% of each other', () => {
    const earn = (founders: 'all-2b' | 'all-3a') =>
      mean(
        [1, 2, 3].map((seed) => {
          const w = new EvolutionWorld(seed, { mutationScale: 0 }, founders)
          w.run(3)
          return mean(w.history.map((h) => h.meanEnergy))
        }),
      )
    const ratio = earn('all-2b') / earn('all-3a')
    expect(ratio).toBeGreaterThan(0.8)
    expect(ratio).toBeLessThan(1.25)
  })
})

describe('the knockout tests, one per row of the handout Part 2 table', () => {
  /**
   * **Restated from §10.** The spec asks that with mutation at zero, "mean
   * energy at generation 30 is within 2% of its value at generation 15". A
   * single generation's mean is not that stable: lights respawn at seeded but
   * arbitrary points, so consecutive generations of a genetically *identical*
   * population differ by tens of percent purely from where the food landed.
   * Measured drift between two single generations ran to 38% with the genome
   * frozen solid.
   *
   * So the plateau is measured between five-generation windows, which is the
   * same move the lab itself teaches about noisy measurements. The claim being
   * tested is unchanged: improvement happens, and then it stops.
   */
  it('mutation 0: the population improves, then plateaus', () => {
    // Measured across the ten seeds rather than within each one, and that is
    // forced rather than chosen. Where the food happens to land moves a single
    // generation's mean by around ±0.6, which is the same size as the entire
    // improvement a frozen population makes -- so one seed's mid-to-late
    // difference is mostly noise and says nothing either way. Aggregated, the
    // shape is unmistakable and is exactly Q3's claim.
    const early: number[] = []
    const mid: number[] = []
    const late: number[] = []
    for (const seed of SEEDS) {
      const s = summary(seed, { mutationScale: 0 }, 30)
      early.push(windowOf(s, 1, 5))
      mid.push(windowOf(s, 11, 15))
      late.push(windowOf(s, 26, 30))
    }
    const rise = mean(mid) - mean(early)
    const after = mean(late) - mean(mid)

    // It improves. It must NOT be flat from the start: the founders are varied,
    // and Q3's whole point is that selection has something to work with even
    // with mutation off, because variation was already there.
    expect(rise).toBeGreaterThan(0.3)
    // And then it stops, because with no mutation there is no new variation
    // left to select once the best founder has taken over.
    expect(Math.abs(after)).toBeLessThan(rise / 3)
  })

  it('mutation 0: variation runs out — the population goes genetically uniform', () => {
    // The mechanism behind the plateau, checked directly rather than inferred
    // from the energy curve. This is what Q3 is really asking a student to see:
    // where the wiring the population ends up with came from.
    const uniform = SEEDS.filter((seed) => {
      const w = run(seed, { mutationScale: 0 }, 30)
      return w.history[29].survivingLineages <= 2
    }).length
    expect(uniform).toBeGreaterThanOrEqual(9)
  })

  it('mutation 0: offspring really are exact copies', () => {
    const rng = makeRng(1)
    const g = { wLL: 0.3, wLR: -1.2, wRL: 2, wRR: 0.1, bias: 0.8, hue: 123 }
    expect(mutate(g, rng, DEFAULT_MUTATION_RATES, 0)).toEqual(g)
  })

  it('inheritance off: no upward trend across 30 generations', () => {
    const trends = SEEDS.map((seed) => {
      const s = summary(seed, { inheritance: false }, 30)
      return windowOf(s, 26, 30) - windowOf(s, 1, 5)
    })
    // Individual seeds wander either way; what must not happen is a systematic
    // climb, because with offspring drawn fresh each generation there is
    // nothing for selection to accumulate.
    expect(Math.abs(mean(trends))).toBeLessThan(0.5)
  })

  it('selection off: the population still changes, and two draws end differently', () => {
    const w = run(4, { selection: false }, 30)
    const start = w.history[0]
    const end = w.history[29]
    // Drift moves it...
    expect(Math.abs(end.meanCrossing - start.meanCrossing)).toBeGreaterThan(0.05)
    // ...and it is genuinely drift, so the same founders reach a different
    // place when the random draws differ. (Same seed, different world: the
    // student's second run in Part 2 step 3.)
    const other = run(4, { selection: false, sensorNoise: 0.0001 }, 30)
    expect(other.history[29].modalHue).not.toBe(end.modalHue)
  })

  it('N = 6: the best founder lineage often fails to fix', () => {
    // Q6. With a small population chance beats selection often enough to see.
    let bestFounderWon = 0
    for (const seed of SEEDS) {
      const w = run(seed, { populationSize: 6 }, 30)
      // Who was the best founder, judged on generation 0's own energies?
      const gen0 = w.lineage.filter((l) => l.generation === 0)
      const best = [...gen0].sort((a, b) => b.energy - a.energy)[0]
      const survivors = new Set(w.population.map((p) => p.founderId))
      if (survivors.size === 1 && survivors.has(best.id)) bestFounderWon++
    }
    expect(bestFounderWon).toBeLessThanOrEqual(7)
  })

  it('poison: a well-adapted population falls below its generation-1 level within 10 generations', () => {
    const collapsed = SEEDS.map((seed) => {
      const w = run(seed, {}, 30)
      const gen1 = w.history[0].meanEnergy
      w.setRegime('poison')
      w.run(10)
      return w.history[39].meanEnergy < gen1
    })
    expect(collapsed.every(Boolean)).toBe(true)
  })
})

describe('determinism, which Part 2 rests on entirely', () => {
  it('the same seed and settings replay the identical run', () => {
    const a = run(11, {}, 12)
    const b = run(11, {}, 12)
    expect(b.history).toEqual(a.history)
    expect(b.population.map((p) => p.genome)).toEqual(a.population.map((p) => p.genome))
  })

  it('changing one switch changes only what that switch controls', () => {
    // The founder draw happens before any control can matter, so two runs from
    // the same seed must start from an identical founding population however
    // they are set up. This is what "Reset (same seed), change one switch"
    // actually promises.
    const a = new EvolutionWorld(21, {})
    const b = new EvolutionWorld(21, { selection: false, mutationScale: 0 })
    expect(b.population.map((p) => p.genome)).toEqual(a.population.map((p) => p.genome))
  })

  it('different seeds give different runs', () => {
    expect(run(31, {}, 8).history[7].meanEnergy).not.toBe(
      run(32, {}, 8).history[7].meanEnergy,
    )
  })
})

describe('modal hue', () => {
  it('reports a split population as split, where a circular mean would not', () => {
    // Half at 10°, half at 190° -- diametrically opposed. A circular mean sits
    // at an arbitrary point between them and would claim high concentration.
    const hues = [5, 10, 15, 185, 190, 195]
    const { concentration } = modalHue(hues)
    expect(concentration).toBeCloseTo(0.5)
  })

  it('handles the wrap at 0/360', () => {
    const { concentration } = modalHue([355, 358, 2, 5, 8])
    expect(concentration).toBe(1)
  })
})
