/**
 * Does a continuous life cycle work?
 *
 * Three questions, and they are the ones that decide whether it is worth
 * rewriting the engine:
 *
 *   1. Does the population survive — across seeds, and when it starts small?
 *   2. Does adaptation still happen, measured against a no-selection control?
 *   3. Does strategy parity hold, or does the starvation floor tip it toward
 *      parking? Discrete generations only rank at the end, so variance within a
 *      generation is nearly irrelevant. Starvation is absorbing, so under a
 *      continuous cycle variance becomes lethal, which should systematically
 *      favour the low-variance strategy. That is the prediction being tested.
 *
 *   PROBE=1 npx vitest run --disable-console-intercept -t "continuous"
 */
import { it } from 'vitest'
import { ContinuousWorld, type ContinuousParams } from './continuousWorld'
import { DEFAULT_FOOD_PARAMS } from './food'

const f = (n: number, w = 6) => n.toFixed(2).padStart(w)
const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / (a.length || 1)
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

/** 1200 simulated seconds — the same wall of sim time as 50 discrete generations. */
const DURATION = 1200

function run(seed: number, params: Partial<ContinuousParams> = {}, founders?: 'all-2b' | 'all-3a') {
  const w = new ContinuousWorld(seed, params, founders)
  w.run(DURATION)
  return w
}

const at = (w: ContinuousWorld, t: number) =>
  w.samples.find((s) => s.time >= t) ?? w.samples[w.samples.length - 1]

it('continuous: does the population survive', () => {
  console.log('\nseed | extinct  cap | pop@100 pop@400 pop@1200 | births starved  aged | meanAge')
  for (const seed of SEEDS) {
    const w = run(seed)
    const last = w.samples[w.samples.length - 1]
    console.log(
      `${String(seed).padStart(4)} | ${String(w.extinct).padStart(7)} ${String(
        w.hitCap,
      ).padStart(4)} | ${f(at(w, 100).population, 7)} ${f(at(w, 400).population, 7)} ${f(
        last?.population ?? 0, 8,
      )} | ${f(w.births, 6)} ${f(w.starved, 7)} ${f(w.diedOfAge, 5)} | ${f(
        last?.meanAge ?? 0,
      )}`,
    )
  }
})

it('continuous: does it survive a small start', () => {
  console.log('\ninitial population 6 — Part 2 asks for this')
  for (const seed of SEEDS) {
    const w = run(seed, { initialPopulation: 6 })
    const last = w.samples[w.samples.length - 1]
    console.log(
      `  seed ${String(seed).padStart(2)}: extinct ${String(w.extinct).padStart(5)} final pop ${f(
        last?.population ?? 0, 6,
      )} births ${f(w.births, 6)} lineages ${last?.survivingLineages ?? 0}`,
    )
  }
})

it('continuous: does adaptation happen', () => {
  console.log('\nseed | approach%   start -> end | vs no-selection | hueConc | lineages')
  const gains: number[] = []
  const advantages: number[] = []
  for (const seed of SEEDS) {
    const on = run(seed)
    const off = run(seed, { selection: false })
    const a0 = at(on, 30).approachFraction
    const a1 = on.samples[on.samples.length - 1]?.approachFraction ?? 0
    const offEnd = off.samples[off.samples.length - 1]?.approachFraction ?? 0
    gains.push(a1 - a0)
    advantages.push(a1 - offEnd)
    console.log(
      `${String(seed).padStart(4)} | ${f(a0)} -> ${f(a1)} | ${f(offEnd, 15)} | ${f(
        on.samples[on.samples.length - 1]?.hueConcentration ?? 0, 7,
      )} | ${on.samples[on.samples.length - 1]?.survivingLineages ?? 0}`,
    )
  }
  console.log(
    `  mean gain over the run ${f(mean(gains))}; mean advantage over no-selection ${f(
      mean(advantages),
    )}`,
  )
})

it('continuous: strategy parity', () => {
  // Fitness under a continuous cycle is not energy -- energy is homeostatic,
  // cycling between the birth level and the reproduce threshold whatever the
  // creature is like. It is *births*. So parity is measured in offspring.
  console.log('\nstrategy parity, measured in births over 1200s (mutation off)')
  const earn = (founders: 'all-2b' | 'all-3a') => {
    const runs = [1, 2, 3].map((seed) => run(seed, { mutationScale: 0 }, founders))
    return {
      births: mean(runs.map((w) => w.births)),
      pop: mean(runs.map((w) => w.samples[w.samples.length - 1]?.population ?? 0)),
      extinct: runs.filter((w) => w.extinct).length,
    }
  }
  const charger = earn('all-2b')
  const parker = earn('all-3a')
  console.log(
    `  chargers (2b): ${f(charger.births)} births, final pop ${f(charger.pop)}, extinct ${charger.extinct}/3`,
  )
  console.log(
    `  parkers  (3a): ${f(parker.births)} births, final pop ${f(parker.pop)}, extinct ${parker.extinct}/3`,
  )
  console.log(
    `  parity (charger/parker) = ${f(charger.births / Math.max(0.01, parker.births))}  [want 0.8-1.25]`,
  )
})

it('continuous: sweep the thresholds', () => {
  // Calibrated from the energy budget: a creature nets ~0.08/s, so ~5 energy of
  // surplus over a 60s life. An offspring costing (threshold - birthEnergy)
  // therefore has to cost around 2 for a creature to leave more than one.
  console.log('\nlife repro birth | ext | pop@1200 births starve/age | approach gain | parity')
  for (const meanLifespan of [45, 60, 90]) {
    for (const reproduceThreshold of [5, 6, 7]) {
      for (const birthEnergy of [3, 4]) {
        const params = {
          meanLifespan,
          lifespanSd: meanLifespan / 4,
          reproduceThreshold,
          birthEnergy,
        }
        const runs = SEEDS.slice(0, 5).map((s) => run(s, params))
        const ext = runs.filter((w) => w.extinct).length
        const finalPop = mean(runs.map((w) => w.samples[w.samples.length - 1]?.population ?? 0))
        const births = mean(runs.map((w) => w.births))
        const starve = mean(runs.map((w) => w.starved))
        const aged = mean(runs.map((w) => w.diedOfAge))
        const gain = mean(
          runs.map(
            (w) =>
              (w.samples[w.samples.length - 1]?.approachFraction ?? 0) -
              at(w, 30).approachFraction,
          ),
        )
        const b = (founders: 'all-2b' | 'all-3a') =>
          mean([1, 2, 3].map((s) => run(s, { ...params, mutationScale: 0 }, founders).births))
        const parity = b('all-2b') / Math.max(0.01, b('all-3a'))
        console.log(
          `${f(meanLifespan, 4)} ${f(reproduceThreshold, 5)} ${f(birthEnergy, 5)} | ${String(
            ext,
          ).padStart(3)} | ${f(finalPop, 8)} ${f(births, 6)} ${f(starve, 6)}/${f(aged, 5)} | ${f(
            gain, 13,
          )} | ${f(parity)}`,
        )
      }
    }
  }
})

it('continuous: calibrate the energy budget', () => {
  // How fast does a creature actually net energy? Everything else follows from
  // this: a population sustains itself only if (net rate x lifespan) exceeds
  // maintenance plus the cost of more than one offspring.
  const w = new ContinuousWorld(1, { reproduceThreshold: 1e9, meanLifespan: 1e9 })
  const trace: number[] = []
  for (let t = 0; t < 240; t++) {
    w.run(1)
    trace.push(w.creatures.reduce((a, c) => a + c.energy, 0) / (w.creatures.length || 1))
  }
  console.log('\nmean energy of a non-reproducing population, per 20s:')
  for (let i = 19; i < trace.length; i += 20) {
    console.log(`  t=${String(i + 1).padStart(3)}s  mean energy ${f(trace[i])}`)
  }
  const rate = (trace[239] - trace[19]) / 220
  console.log(`  net accumulation rate ~${f(rate, 5)} energy/second/creature`)
  console.log(`  over a 60s life that is ${f(rate * 60)} energy to spend on offspring`)
})

it('continuous: make food scarce', () => {
  /**
   * The previous sweep found no selection at all: nobody starved, so the only
   * death was old age, which is blind to the genome. The cause is that a light
   * respawns 0.3s after it is stripped, so with a large population the food
   * influx is roughly count x capacity / 0.3 -- effectively unlimited.
   *
   * Scarcity has to come from the respawn delay. Influx is bounded by
   * count x capacity / delay, and selection can only bite when that is less
   * than what the population needs.
   */
  console.log('\nlights delay | influx/s | ext cap | pop@1200 | starve/aged | approach gain | parity')
  for (const count of [2, 4]) {
    for (const respawnDelay of [2, 6, 12, 20]) {
      const params = {
        populationCap: 400,
        reproduceThreshold: 6,
        birthEnergy: 4,
        meanLifespan: 60,
        lifespanSd: 15,
        food: { ...DEFAULT_FOOD_PARAMS, count, respawnDelay },
      }
      const runs = SEEDS.slice(0, 5).map((s) => run(s, params))
      const ext = runs.filter((w) => w.extinct).length
      const cap = runs.filter((w) => w.hitCap).length
      const finalPop = mean(runs.map((w) => w.samples[w.samples.length - 1]?.population ?? 0))
      const starve = mean(runs.map((w) => w.starved))
      const aged = mean(runs.map((w) => w.diedOfAge))
      const gain = mean(
        runs.map(
          (w) =>
            (w.samples[w.samples.length - 1]?.approachFraction ?? 0) -
            at(w, 30).approachFraction,
        ),
      )
      const b = (founders: 'all-2b' | 'all-3a') =>
        mean([1, 2, 3].map((s) => run(s, { ...params, mutationScale: 0 }, founders).births))
      const parity = b('all-2b') / Math.max(0.01, b('all-3a'))
      console.log(
        `${f(count, 6)} ${f(respawnDelay, 5)} | ${f(
          (count * 9) / respawnDelay, 8,
        )} | ${String(ext).padStart(3)} ${String(cap).padStart(3)} | ${f(
          finalPop, 8,
        )} | ${f(starve, 7)}/${f(aged, 6)} | ${f(gain, 13)} | ${f(parity)}`,
      )
    }
  }
})

it('continuous: make starvation possible', () => {
  /**
   * Across the scarcity sweep, starvation counts were 0-3 in every condition.
   * The reason is a timescale mismatch: at a base cost of 0.05/s a newborn with
   * 4 energy takes 80s to burn through it, and creatures only live 60s. They
   * always die of old age first, and old age is blind to the genome — so the
   * only selection left is differential *fecundity*, which is weak.
   *
   * Note this is a real difference between the two engines. In the discrete
   * model the base cost is evolutionarily inert: it subtracts the same from
   * everyone and selection is rank-based. Here it sets how fast a creature
   * starves, and starvation is absorbing, so it becomes one of the most
   * consequential parameters in the model.
   */
  console.log(
    '\nbaseC life delay | ext | pop@1200 | starved/aged | approach gain | vs noSel | parity',
  )
  for (const baseCost of [0.05, 0.15, 0.3]) {
    for (const meanLifespan of [60, 120]) {
      for (const respawnDelay of [2, 6]) {
        const params = {
          populationCap: 400,
          reproduceThreshold: 6,
          birthEnergy: 4,
          meanLifespan,
          lifespanSd: meanLifespan / 4,
          energy: { baseCost, moveCost: 0.06 },
          food: { ...DEFAULT_FOOD_PARAMS, count: 4, respawnDelay },
        }
        const runs = SEEDS.slice(0, 5).map((s) => run(s, params))
        const offRuns = SEEDS.slice(0, 5).map((s) => run(s, { ...params, selection: false }))
        const ext = runs.filter((w) => w.extinct).length
        const finalPop = mean(runs.map((w) => w.samples[w.samples.length - 1]?.population ?? 0))
        const starve = mean(runs.map((w) => w.starved))
        const aged = mean(runs.map((w) => w.diedOfAge))
        const endApproach = (w: ContinuousWorld) =>
          w.samples[w.samples.length - 1]?.approachFraction ?? 0
        const gain = mean(runs.map((w) => endApproach(w) - at(w, 30).approachFraction))
        const adv = mean(runs.map((w, i) => endApproach(w) - endApproach(offRuns[i])))
        const b = (founders: 'all-2b' | 'all-3a') =>
          mean([1, 2, 3].map((s) => run(s, { ...params, mutationScale: 0 }, founders).births))
        const parity = b('all-2b') / Math.max(0.01, b('all-3a'))
        console.log(
          `${f(baseCost, 5)} ${f(meanLifespan, 4)} ${f(respawnDelay, 5)} | ${String(ext).padStart(
            3,
          )} | ${f(finalPop, 8)} | ${f(starve, 7)}/${f(aged, 6)} | ${f(gain, 13)} | ${f(
            adv, 7,
          )} | ${f(parity)}`,
        )
      }
    }
  }
})

it('continuous: long lives, so starvation can outpace old age', () => {
  /**
   * At a base cost of 0.05/s a creature that eats nothing dies in 80s. Give it
   * a lifespan well beyond that and starvation becomes the *main* cause of
   * death for poor foragers, while good ones reproduce and live on — which is
   * differential mortality and differential fecundity at once, and the design
   * Jon actually described.
   */
  console.log(
    '\nlife delay | ext | pop@1200 | starved/aged | approach gain | vs noSel | hueConc | parity',
  )
  for (const meanLifespan of [180, 300, 600]) {
    for (const respawnDelay of [4, 6, 10]) {
      const params = {
        populationCap: 400,
        reproduceThreshold: 6,
        birthEnergy: 4,
        meanLifespan,
        lifespanSd: meanLifespan / 4,
        energy: { baseCost: 0.05, moveCost: 0.06 },
        food: { ...DEFAULT_FOOD_PARAMS, count: 4, respawnDelay },
      }
      const runs = SEEDS.slice(0, 5).map((s) => run(s, params))
      const offRuns = SEEDS.slice(0, 5).map((s) => run(s, { ...params, selection: false }))
      const endApproach = (w: ContinuousWorld) =>
        w.samples[w.samples.length - 1]?.approachFraction ?? 0
      const b = (founders: 'all-2b' | 'all-3a') =>
        mean([1, 2, 3].map((s) => run(s, { ...params, mutationScale: 0 }, founders).births))
      console.log(
        `${f(meanLifespan, 4)} ${f(respawnDelay, 5)} | ${String(
          runs.filter((w) => w.extinct).length,
        ).padStart(3)} | ${f(
          mean(runs.map((w) => w.samples[w.samples.length - 1]?.population ?? 0)), 8,
        )} | ${f(mean(runs.map((w) => w.starved)), 7)}/${f(
          mean(runs.map((w) => w.diedOfAge)), 6,
        )} | ${f(mean(runs.map((w) => endApproach(w) - at(w, 30).approachFraction)), 13)} | ${f(
          mean(runs.map((w, i) => endApproach(w) - endApproach(offRuns[i]))), 7,
        )} | ${f(
          mean(runs.map((w) => w.samples[w.samples.length - 1]?.hueConcentration ?? 0)), 7,
        )} | ${f(b('all-2b') / Math.max(0.01, b('all-3a')))}`,
      )
    }
  }
})
