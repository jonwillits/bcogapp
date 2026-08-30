/**
 * Tuning probes for the Module 2 evolution engine.
 *
 * NOT part of `npm run test` — the filename ends `.probe.ts` so vitest's
 * default include skips it. Run one deliberately:
 *
 *   npx vitest run --include 'src/**\/*.probe.ts' --disable-console-intercept -t "cost model"
 *
 * These exist because §10's acceptance tests are tuning targets rather than
 * pass/fail checks on arbitrary numbers: the way to satisfy them is to measure
 * the frontier and pick a point on it, and the measurements are worth keeping
 * so the next person can see why the constants are what they are.
 */
import { it } from 'vitest'
import { EvolutionWorld, type EvolutionParams } from './evolutionWorld'
import { DEFAULT_FOOD_PARAMS } from './food'
import { approachScore, nearestVariety } from '../creature/genome'

const f = (n: number, w = 6) => n.toFixed(2).padStart(w)
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / (a.length || 1)

interface Outcome {
  gen1: number
  gen50: number
  noSel50: number
  /** Fraction of the final population that steers toward light. */
  approachFrac: number
  meanBias: number
  hueConc: number
}

function outcome(seed: number, params: Partial<EvolutionParams>, gens = 50): Outcome {
  const w = new EvolutionWorld(seed, params)
  w.run(gens)
  const off = new EvolutionWorld(seed, { ...params, selection: false })
  off.run(gens)
  const pop = w.population
  return {
    gen1: w.history[0].meanEnergy,
    gen50: w.history[w.history.length - 1].meanEnergy,
    noSel50: off.history[off.history.length - 1].meanEnergy,
    approachFrac: pop.filter((p) => approachScore(p.genome) > 0).length / pop.length,
    meanBias: mean(pop.map((p) => p.genome.bias)),
    hueConc: w.history[w.history.length - 1].hueConcentration,
  }
}

/** A whole population of chargers against a whole population of parkers. */
function parity(params: Partial<EvolutionParams>, seeds = [1, 2, 3]) {
  const earn = (founders: 'all-2b' | 'all-3a') =>
    mean(
      seeds.map((seed) => {
        const w = new EvolutionWorld(seed, { ...params, mutationScale: 0 }, founders)
        w.run(3)
        return mean(w.history.map((h) => h.meanEnergy))
      }),
    )
  const charger = earn('all-2b')
  const parker = earn('all-3a')
  return { charger, parker, ratio: charger / parker }
}

it('probe: cost model — does anything have to move to eat?', () => {
  console.log(
    'baseC moveC | gen1   gen50  noSel  advant | approach% bias   hueConc | charge park  parity',
  )
  for (const baseCost of [0.05, 0.2, 0.35, 0.5]) {
    for (const moveCost of [0.03, 0.06, 0.09]) {
      const params: Partial<EvolutionParams> = { energy: { baseCost, moveCost } }
      const os = SEEDS.map((s) => outcome(s, params))
      const p = parity(params)
      console.log(
        `${f(baseCost, 5)} ${f(moveCost, 5)} | ${f(mean(os.map((o) => o.gen1)))} ${f(
          mean(os.map((o) => o.gen50)),
        )} ${f(mean(os.map((o) => o.noSel50)))} ${f(
          mean(os.map((o) => o.gen50 - o.noSel50)),
        )} | ${f(mean(os.map((o) => o.approachFrac)), 9)} ${f(
          mean(os.map((o) => o.meanBias)),
        )} ${f(mean(os.map((o) => o.hueConc)), 8)} | ${f(p.charger, 6)} ${f(
          p.parker,
          5,
        )} ${f(p.ratio, 6)}`,
      )
    }
  }
})

it('probe: what actually wins', () => {
  console.log('\nwinning genome after 50 generations, at the current defaults')
  for (const seed of SEEDS) {
    const w = new EvolutionWorld(seed)
    w.run(50)
    const best = [...w.population].sort((a, b) => b.energy - a.energy)[0]
    const h = w.history[w.history.length - 1]
    const approach =
      w.population.filter((p) => approachScore(p.genome) > 0).length / w.population.length
    console.log(
      `  seed ${String(seed).padStart(2)}: ${nearestVariety(best.genome).padEnd(
        26,
      )} bias ${f(best.genome.bias)} approach% ${f(approach)} hueConc ${f(
        h.hueConcentration,
      )}`,
    )
  }
})

it('probe: light count and density', () => {
  console.log('\ncount | gen50  noSel  advant | approach% | charge park  parity')
  for (const count of [2, 3, 4, 6, 8]) {
    const params: Partial<EvolutionParams> = {
      food: { ...DEFAULT_FOOD_PARAMS, count },
    }
    const os = SEEDS.map((s) => outcome(s, params))
    const p = parity(params)
    console.log(
      `${f(count, 5)} | ${f(mean(os.map((o) => o.gen50)))} ${f(
        mean(os.map((o) => o.noSel50)),
      )} ${f(mean(os.map((o) => o.gen50 - o.noSel50)))} | ${f(
        mean(os.map((o) => o.approachFrac)),
        9,
      )} | ${f(p.charger, 6)} ${f(p.parker, 5)} ${f(p.ratio, 6)}`,
    )
  }
})
