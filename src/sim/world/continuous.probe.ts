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
import { ContinuousWorld, DEFAULT_CONTINUOUS_PARAMS, type ContinuousParams } from './continuousWorld'
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
          energy: { baseCost, moveCost: 0.06, ambientIncome: 0 },
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
        energy: { baseCost: 0.05, moveCost: 0.06, ambientIncome: 0 },
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

it('continuous: carrying capacity as the mechanism', () => {
  /**
   * The bottleneck the first attempt lost was doing two jobs: strong selection,
   * and a small effective population that lets drift fix a neutral gene. A hard
   * carrying capacity restores both. Reproduction becomes a queue ordered by
   * energy -- truncation selection in continuous time -- and N is pinned, so
   * lineages coalesce in roughly 2N generations instead of never.
   */
  console.log(
    '\n cap life delay | ext | pop | starve/aged | births | approach | vs noSel | hueConc | lineages | parity',
  )
  for (const populationCap of [16, 24, 36]) {
    for (const meanLifespan of [45, 90, 180]) {
      for (const respawnDelay of [1, 4]) {
        const params = {
          populationCap,
          initialPopulation: populationCap,
          reproduceThreshold: 6,
          birthEnergy: 4,
          maxEnergy: 12,
          meanLifespan,
          lifespanSd: meanLifespan / 4,
          energy: { baseCost: 0.05, moveCost: 0.06, ambientIncome: 0 },
          food: { ...DEFAULT_FOOD_PARAMS, count: 4, respawnDelay },
        }
        const runs = SEEDS.map((s) => run(s, params))
        const offRuns = SEEDS.map((s) => run(s, { ...params, selection: false }))
        const end = (w: ContinuousWorld) => w.samples[w.samples.length - 1]
        const endApproach = (w: ContinuousWorld) => end(w)?.approachFraction ?? 0
        const b = (founders: 'all-2b' | 'all-3a') =>
          mean([1, 2, 3].map((s) => run(s, { ...params, mutationScale: 0 }, founders).births))
        const hue = runs.map((w) => end(w)?.hueConcentration ?? 0)
        console.log(
          `${f(populationCap, 4)} ${f(meanLifespan, 4)} ${f(respawnDelay, 5)} | ${String(
            runs.filter((w) => w.extinct).length,
          ).padStart(3)} | ${f(mean(runs.map((w) => end(w)?.population ?? 0)), 3)} | ${f(
            mean(runs.map((w) => w.starved)), 6,
          )}/${f(mean(runs.map((w) => w.diedOfAge)), 6)} | ${f(
            mean(runs.map((w) => w.births)), 6,
          )} | ${f(mean(runs.map(endApproach)), 8)} | ${f(
            mean(runs.map((w, i) => endApproach(w) - endApproach(offRuns[i]))), 8,
          )} | ${f(mean(hue), 7)} (${hue.filter((h) => h >= 0.8).length}/10) | ${f(
            mean(runs.map((w) => end(w)?.survivingLineages ?? 0)), 8,
          )} | ${f(b('all-2b') / Math.max(0.01, b('all-3a')))}`,
        )
      }
    }
  }
})

it('continuous: verify the two best configurations', () => {
  const CONFIGS = {
    'cap24 life45 delay1': {
      populationCap: 24, initialPopulation: 24, meanLifespan: 45, lifespanSd: 11,
      reproduceThreshold: 6, birthEnergy: 4, maxEnergy: 12,
      energy: { baseCost: 0.05, moveCost: 0.06, ambientIncome: 0 },
      food: { ...DEFAULT_FOOD_PARAMS, count: 4, respawnDelay: 1 },
    },
    'cap16 life180 delay4': {
      populationCap: 16, initialPopulation: 16, meanLifespan: 180, lifespanSd: 45,
      reproduceThreshold: 6, birthEnergy: 4, maxEnergy: 12,
      energy: { baseCost: 0.05, moveCost: 0.06, ambientIncome: 0 },
      food: { ...DEFAULT_FOOD_PARAMS, count: 4, respawnDelay: 4 },
    },
  }
  const end = (w: ContinuousWorld) => w.samples[w.samples.length - 1]

  for (const [label, base] of Object.entries(CONFIGS)) {
    console.log(`\n=== ${label}`)

    // Small population — Part 2 asks for this, and it is where drift should win.
    const small = SEEDS.map((s) =>
      run(s, { ...base, populationCap: 6, initialPopulation: 6 }),
    )
    console.log(
      `  N=6: extinct ${small.filter((w) => w.extinct).length}/10  final pop ${f(
        mean(small.map((w) => end(w)?.population ?? 0)), 4,
      )}  lineages ${f(mean(small.map((w) => end(w)?.survivingLineages ?? 0)), 4)}`,
    )

    // Mutation off: improvement then plateau, and variation runs out.
    const noMut = SEEDS.map((s) => run(s, { ...base, mutationScale: 0 }))
    console.log(
      `  mutation 0: lineages ${f(
        mean(noMut.map((w) => end(w)?.survivingLineages ?? 0)), 4,
      )}  approach ${f(mean(noMut.map((w) => end(w)?.approachFraction ?? 0)), 5)}`,
    )

    // Inheritance off: no trend.
    const noInh = SEEDS.map((s) => run(s, { ...base, inheritance: false }))
    console.log(
      `  inheritance off: approach ${f(
        mean(noInh.map((w) => end(w)?.approachFraction ?? 0)), 5,
      )} (vs ${f(mean(SEEDS.map((s) => end(run(s, base))?.approachFraction ?? 0)), 5)} with it)`,
    )

    // Poison: a well-adapted population should collapse.
    let survivedPoison = 0
    for (const seed of SEEDS.slice(0, 5)) {
      const w = new ContinuousWorld(seed, base)
      w.run(900)
      const popBefore = end(w)?.population ?? 0
      w.params.regime = 'poison'
      w.run(300)
      const popAfter = end(w)?.population ?? 0
      if (popAfter < popBefore * 0.6 || w.extinct) survivedPoison++
      void popBefore
    }
    console.log(`  poison switch collapses the population in ${survivedPoison}/5 seeds`)
  }
})

it('phase A: ephemeral food with a continuous cycle', () => {
  /**
   * Total influx under ephemeral food is count x flowRate, independent of how
   * many creatures there are — a clean regulator, where depleting food's influx
   * depends on consumption which depends on population. Paired with a carrying
   * capacity that is the second, independent regulator.
   */
  console.log(
    '\n cap flow life span | ext | pop | births | approach | vs noSel | hueConc | lineages | parity | bias',
  )
  for (const populationCap of [16, 24]) {
    for (const flowRate of [1.2, 1.8, 2.6]) {
      for (const lifetime of [6, 12]) {
        for (const meanLifespan of [90, 180]) {
          const params = {
            populationCap,
            initialPopulation: populationCap,
            reproduceThreshold: 6,
            birthEnergy: 4,
            maxEnergy: 12,
            meanLifespan,
            lifespanSd: meanLifespan / 4,
            energy: { baseCost: 0.05, moveCost: 0.06, ambientIncome: 0 },
            food: { ...DEFAULT_FOOD_PARAMS, mode: 'ephemeral' as const, count: 4, flowRate, lifetime },
          }
          const runs = SEEDS.map((s) => run(s, params))
          const offRuns = SEEDS.map((s) => run(s, { ...params, selection: false }))
          const end = (w: ContinuousWorld) => w.samples[w.samples.length - 1]
          const ap = (w: ContinuousWorld) => end(w)?.approachFraction ?? 0
          const hue = runs.map((w) => end(w)?.hueConcentration ?? 0)
          const b = (founders: 'all-2b' | 'all-3a') =>
            mean([1, 2, 3].map((s) => run(s, { ...params, mutationScale: 0 }, founders).births))
          const bias = mean(
            runs.map((w) => mean(w.creatures.map((c) => c.genome.bias))),
          )
          console.log(
            `${f(populationCap, 4)} ${f(flowRate, 4)} ${f(lifetime, 4)} ${f(
              meanLifespan, 4,
            )} | ${String(runs.filter((w) => w.extinct).length).padStart(3)} | ${f(
              mean(runs.map((w) => end(w)?.population ?? 0)), 3,
            )} | ${f(mean(runs.map((w) => w.births)), 6)} | ${f(
              mean(runs.map(ap)), 8,
            )} | ${f(mean(runs.map((w, i) => ap(w) - ap(offRuns[i]))), 8)} | ${f(
              mean(hue), 7,
            )} (${hue.filter((h) => h >= 0.8).length}/10) | ${f(
              mean(runs.map((w) => end(w)?.survivingLineages ?? 0)), 8,
            )} | ${f(b('all-2b') / Math.max(0.01, b('all-3a')))} | ${f(bias, 4)}`,
          )
        }
      }
    }
  }
})

/** Mean of a sample field over the last `window` seconds — less noisy than the final point. */
function tail(w: ContinuousWorld, pick: (s: { approachFraction: number; hueConcentration: number }) => number, window = 300) {
  const cut = w.time - window
  const xs = w.samples.filter((s) => s.time >= cut).map(pick)
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0
}

it('phase A: narrow in on ephemeral', () => {
  console.log(
    '\nflow life span | pop | births | approach | vs noSel | hueConc | lineages | parity | bias | speed',
  )
  for (const flowRate of [1.8, 2.6, 3.4]) {
    for (const lifetime of [8, 12, 16]) {
      for (const meanLifespan of [45, 60, 90]) {
        const params = {
          populationCap: 16,
          initialPopulation: 16,
          reproduceThreshold: 6,
          birthEnergy: 4,
          maxEnergy: 12,
          meanLifespan,
          lifespanSd: meanLifespan / 4,
          energy: { baseCost: 0.05, moveCost: 0.06, ambientIncome: 0 },
          food: { ...DEFAULT_FOOD_PARAMS, mode: 'ephemeral' as const, count: 4, flowRate, lifetime },
        }
        const runs = SEEDS.map((s) => run(s, params))
        const offRuns = SEEDS.map((s) => run(s, { ...params, selection: false }))
        const ap = (w: ContinuousWorld) => tail(w, (s) => s.approachFraction)
        const hue = runs.map((w) => tail(w, (s) => s.hueConcentration))
        const b = (founders: 'all-2b' | 'all-3a') =>
          mean([1, 2, 3].map((s) => run(s, { ...params, mutationScale: 0 }, founders).births))
        const end = (w: ContinuousWorld) => w.samples[w.samples.length - 1]
        console.log(
          `${f(flowRate, 4)} ${f(lifetime, 4)} ${f(meanLifespan, 4)} | ${f(
            mean(runs.map((w) => end(w)?.population ?? 0)), 3,
          )} | ${f(mean(runs.map((w) => w.births)), 6)} | ${f(mean(runs.map(ap)), 8)} | ${f(
            mean(runs.map((w, i) => ap(w) - ap(offRuns[i]))), 8,
          )} | ${f(mean(hue), 7)} (${hue.filter((h) => h >= 0.8).length}/10) | ${f(
            mean(runs.map((w) => end(w)?.survivingLineages ?? 0)), 8,
          )} | ${f(b('all-2b') / Math.max(0.01, b('all-3a')))} | ${f(
            mean(runs.map((w) => mean(w.creatures.map((c) => c.genome.bias)))), 4,
          )} | ${f(
            mean(
              runs.map((w) =>
                mean(
                  w.creatures.map(
                    (c) =>
                      (Math.abs(c.vehicle.actuators.left) +
                        Math.abs(c.vehicle.actuators.right)) / 2,
                  ),
                ),
              ),
            ), 5,
          )}`,
        )
      }
    }
  }
})

it('phase A: does the energy ceiling neuter the queue', () => {
  /**
   * When the world is full, slots go to whoever has the most energy. But energy
   * is clamped at maxEnergy, so if good foragers all sit at the ceiling they are
   * tied and the sort decides nothing — the queue stops being a competition.
   * Raising the ceiling should restore it.
   */
  console.log('\nmaxE thresh flow span | approach | vs noSel | hueConc | spread of energy | parity')
  for (const maxEnergy of [12, 30, 100]) {
    for (const reproduceThreshold of [6, 10]) {
      for (const meanLifespan of [45, 90]) {
        const params = {
          populationCap: 16,
          initialPopulation: 16,
          reproduceThreshold,
          birthEnergy: 4,
          maxEnergy,
          meanLifespan,
          lifespanSd: meanLifespan / 4,
          energy: { baseCost: 0.05, moveCost: 0.06, ambientIncome: 0 },
          food: { ...DEFAULT_FOOD_PARAMS, mode: 'ephemeral' as const, count: 4, flowRate: 2.6, lifetime: 12 },
        }
        const runs = SEEDS.map((s) => run(s, params))
        const offRuns = SEEDS.map((s) => run(s, { ...params, selection: false }))
        const ap = (w: ContinuousWorld) => tail(w, (s) => s.approachFraction)
        const hue = runs.map((w) => tail(w, (s) => s.hueConcentration))
        const b = (founders: 'all-2b' | 'all-3a') =>
          mean([1, 2, 3].map((s) => run(s, { ...params, mutationScale: 0 }, founders).births))
        // How spread out are the living creatures' energies? If everyone is at
        // the ceiling this is ~0 and the queue is decided by nothing.
        const spread = mean(
          runs.map((w) => {
            const es = w.creatures.map((c) => c.energy)
            const m = mean(es)
            return Math.sqrt(mean(es.map((e) => (e - m) ** 2)))
          }),
        )
        console.log(
          `${f(maxEnergy, 4)} ${f(reproduceThreshold, 6)} ${f(2.6, 4)} ${f(
            meanLifespan, 4,
          )} | ${f(mean(runs.map(ap)), 8)} | ${f(
            mean(runs.map((w, i) => ap(w) - ap(offRuns[i]))), 8,
          )} | ${f(mean(hue), 7)} (${hue.filter((h) => h >= 0.8).length}/10) | ${f(
            spread, 16,
          )} | ${f(b('all-2b') / Math.max(0.01, b('all-3a')))}`,
        )
      }
    }
  }
})

it('phase A: final — push the reproduction threshold', () => {
  /**
   * The ceiling hypothesis was wrong; the threshold is the lever. A high bar
   * means only creatures that forage well ever reach it, so the slots that open
   * go to them and the rest die without issue -- which is differential
   * reproduction with real teeth. Pushed too far it should starve the
   * population of births and go extinct, so the sweep watches for that.
   */
  console.log(
    '\nthresh span flow | ext | births | approach | vs noSel | hueConc | lineages | parity | bias',
  )
  for (const reproduceThreshold of [8, 10, 12, 14]) {
    for (const meanLifespan of [30, 45, 60]) {
      for (const flowRate of [2.6, 3.4]) {
        const params = {
          populationCap: 16,
          initialPopulation: 16,
          reproduceThreshold,
          birthEnergy: 4,
          maxEnergy: 30,
          meanLifespan,
          lifespanSd: meanLifespan / 4,
          energy: { baseCost: 0.05, moveCost: 0.06, ambientIncome: 0 },
          food: { ...DEFAULT_FOOD_PARAMS, mode: 'ephemeral' as const, count: 4, flowRate, lifetime: 12 },
        }
        const runs = SEEDS.map((s) => run(s, params))
        const offRuns = SEEDS.map((s) => run(s, { ...params, selection: false }))
        const ap = (w: ContinuousWorld) => tail(w, (s) => s.approachFraction)
        const hue = runs.map((w) => tail(w, (s) => s.hueConcentration))
        const b = (founders: 'all-2b' | 'all-3a') =>
          mean([1, 2, 3].map((s) => run(s, { ...params, mutationScale: 0 }, founders).births))
        const end = (w: ContinuousWorld) => w.samples[w.samples.length - 1]
        console.log(
          `${f(reproduceThreshold, 6)} ${f(meanLifespan, 4)} ${f(flowRate, 4)} | ${String(
            runs.filter((w) => w.extinct).length,
          ).padStart(3)} | ${f(mean(runs.map((w) => w.births)), 6)} | ${f(
            mean(runs.map(ap)), 8,
          )} | ${f(mean(runs.map((w, i) => ap(w) - ap(offRuns[i]))), 8)} | ${f(
            mean(hue), 7,
          )} (${hue.filter((h) => h >= 0.8).length}/10) | ${f(
            mean(runs.map((w) => end(w)?.survivingLineages ?? 0)), 8,
          )} | ${f(b('all-2b') / Math.max(0.01, b('all-3a')))} | ${f(
            mean(runs.map((w) => mean(w.creatures.map((c) => c.genome.bias)))), 4,
          )}`,
        )
      }
    }
  }
})

const PHASE_A = {
  populationCap: 16,
  initialPopulation: 16,
  reproduceThreshold: 10,
  birthEnergy: 4,
  maxEnergy: 30,
  meanLifespan: 60,
  lifespanSd: 15,
  energy: { baseCost: 0.05, moveCost: 0.06, ambientIncome: 0 },
  food: { ...DEFAULT_FOOD_PARAMS, mode: 'ephemeral' as const, count: 4, flowRate: 3.4, lifetime: 12 },
}

it('phase A: verify the chosen configuration', () => {
  const end = (w: ContinuousWorld) => w.samples[w.samples.length - 1]
  const ap = (w: ContinuousWorld) => tail(w, (s) => s.approachFraction)

  console.log('\n=== chosen: cap 16, threshold 10, lifespan 60, flow 3.4, lifetime 12')

  const base = SEEDS.map((s) => run(s, PHASE_A))
  const off = SEEDS.map((s) => run(s, { ...PHASE_A, selection: false }))
  const hue = base.map((w) => tail(w, (s) => s.hueConcentration))
  console.log(
    `  survives ${10 - base.filter((w) => w.extinct).length}/10 | approach ${f(
      mean(base.map(ap)),
    )} vs drift ${f(mean(off.map(ap)))} (advantage ${f(
      mean(base.map((w, i) => ap(w) - ap(off[i]))),
    )}) | colour fixes ${hue.filter((h) => h >= 0.8).length}/10 at ${f(mean(hue))}`,
  )
  console.log(
    `  births ${f(mean(base.map((w) => w.births)), 5)} | starved ${f(
      mean(base.map((w) => w.starved)), 5,
    )} | aged ${f(mean(base.map((w) => w.diedOfAge)), 5)} | mean bias ${f(
      mean(base.map((w) => mean(w.creatures.map((c) => c.genome.bias)))), 5,
    )}`,
  )

  // Population size is still a real control -- it is the carrying capacity.
  for (const cap of [6, 10, 16, 30, 60]) {
    const runs = SEEDS.map((s) => run(s, { ...PHASE_A, populationCap: cap, initialPopulation: cap }))
    const h = runs.map((w) => tail(w, (s) => s.hueConcentration))
    console.log(
      `  N=${String(cap).padStart(2)}: survives ${
        10 - runs.filter((w) => w.extinct).length
      }/10  final pop ${f(mean(runs.map((w) => end(w)?.population ?? 0)), 5)}  lineages ${f(
        mean(runs.map((w) => end(w)?.survivingLineages ?? 0)), 4,
      )}  colour ${h.filter((x) => x >= 0.8).length}/10`,
    )
  }

  const noMut = SEEDS.map((s) => run(s, { ...PHASE_A, mutationScale: 0 }))
  console.log(
    `  mutation 0: lineages ${f(
      mean(noMut.map((w) => end(w)?.survivingLineages ?? 0)), 4,
    )}  approach ${f(mean(noMut.map(ap)), 5)}  (with mutation ${f(mean(base.map(ap)), 5)})`,
  )

  const noInh = SEEDS.map((s) => run(s, { ...PHASE_A, inheritance: false }))
  console.log(`  inheritance off: approach ${f(mean(noInh.map(ap)), 5)}`)

  let collapsed = 0
  for (const seed of SEEDS) {
    const w = new ContinuousWorld(seed, PHASE_A)
    w.run(900)
    const before = end(w)?.population ?? 0
    w.params.regime = 'poison'
    w.run(300)
    if ((end(w)?.population ?? 0) < before * 0.6 || w.extinct) collapsed++
  }
  console.log(`  poison collapses the population in ${collapsed}/10 seeds`)
})

it('phase B: how long until the wiring is strong enough to express itself', () => {
  /**
   * The layer-3 lesson, applied before the fixture search rather than after:
   * weakly wired populations behave the same everywhere, so they pass
   * separability trivially and fail divergence completely. The fixtures need to
   * have run long enough for their mechanisms to have consequences.
   */
  console.log('\ntime | pool P: |w| bias cross sign | pool Q: |w| bias cross sign')
  for (const seconds of [600, 1200, 2400, 4800]) {
    const row: string[] = []
    for (const pool of ['P', 'Q'] as const) {
      const w = new ContinuousWorld(3, PHASE_A, pool)
      w.run(seconds)
      const g = w.creatures.map((c) => c.genome)
      const m = (pick: (x: typeof g[0]) => number) => mean(g.map(pick))
      row.push(
        `${f(
          m((x) => (Math.abs(x.wLL) + Math.abs(x.wLR) + Math.abs(x.wRL) + Math.abs(x.wRR)) / 4),
        )} ${f(m((x) => x.bias), 5)} ${f(m((x) => x.wLR + x.wRL - x.wLL - x.wRR))} ${f(
          m((x) => (x.wLL + x.wLR + x.wRL + x.wRR) / 4), 5,
        )}`,
      )
    }
    console.log(`${f(seconds, 4)} | ${row.join(' | ')}`)
  }
})

it('phase C: regrowing patches instead of teleporting lights', () => {
  /**
   * Nothing moves. A patch is grazed down and recovers in place, so the world
   * keeps the property that made ephemeral food worth having -- sustained
   * influx is count x regrowthRate, independent of population -- while being
   * visible and organic instead of abrupt.
   */
  console.log(
    '\nregrow cap count | ext | pop | births | approach | vs noSel | markConc | parity | bias | speed',
  )
  for (const regrowthRate of [0.6, 1.0, 1.6]) {
    for (const capacity of [6, 12, 24]) {
      for (const count of [4, 6]) {
        const params = {
          ...DEFAULT_CONTINUOUS_PARAMS,
          food: {
            ...DEFAULT_CONTINUOUS_PARAMS.food,
            mode: 'regrowing' as const,
            count,
            capacity,
            regrowthRate,
          },
        }
        const runs = SEEDS.map((s) => run(s, params))
        const offRuns = SEEDS.map((s) => run(s, { ...params, selection: false }))
        const end = (w: ContinuousWorld) => w.samples[w.samples.length - 1]
        const ap = (w: ContinuousWorld) => tail(w, (s) => s.approachFraction)
        const marks = runs.map((w) => tail(w, (s) => s.hueConcentration))
        const b = (founders: 'all-2b' | 'all-3a') =>
          mean([1, 2, 3].map((s) => run(s, { ...params, mutationScale: 0 }, founders).births))
        console.log(
          `${f(regrowthRate, 6)} ${f(capacity, 3)} ${f(count, 5)} | ${String(
            runs.filter((w) => w.extinct).length,
          ).padStart(3)} | ${f(mean(runs.map((w) => end(w)?.population ?? 0)), 3)} | ${f(
            mean(runs.map((w) => w.births)), 6,
          )} | ${f(mean(runs.map(ap)), 8)} | ${f(
            mean(runs.map((w, i) => ap(w) - ap(offRuns[i]))), 8,
          )} | ${f(mean(marks), 8)} (${marks.filter((m) => m >= 0.8).length}/10) | ${f(
            b('all-2b') / Math.max(0.01, b('all-3a')),
          )} | ${f(mean(runs.map((w) => mean(w.creatures.map((c) => c.genome.bias)))), 4)} | ${f(
            mean(
              runs.map((w) =>
                mean(
                  w.creatures.map(
                    (c) =>
                      (Math.abs(c.vehicle.actuators.left) +
                        Math.abs(c.vehicle.actuators.right)) / 2,
                  ),
                ),
              ),
            ), 5,
          )}`,
        )
      }
    }
  }
}, 1_800_000)

it('phase C: spread the patches out', () => {
  /**
   * Six patches regrowing steadily is a world where camping one pays as well as
   * foraging, so nothing selects for steering. Holding total influx roughly
   * constant (count x regrowthRate) while raising the count spreads the same
   * food over more places, so getting to a fresh patch takes travel and skill --
   * and a high capacity means an untouched patch has accumulated a lot, which
   * rewards arriving somewhere new.
   */
  console.log(
    '\ncount regrow cap influx | ext | births | approach | vs noSel | markConc | parity | bias speed',
  )
  for (const [count, regrowthRate] of [[6, 0.6], [8, 0.45], [12, 0.3], [16, 0.22]] as const) {
    for (const capacity of [12, 30, 60]) {
      const params = {
        ...DEFAULT_CONTINUOUS_PARAMS,
        food: {
          ...DEFAULT_CONTINUOUS_PARAMS.food,
          mode: 'regrowing' as const,
          count,
          capacity,
          regrowthRate,
        },
      }
      const runs = SEEDS.map((s) => run(s, params))
      const offRuns = SEEDS.map((s) => run(s, { ...params, selection: false }))
      const ap = (w: ContinuousWorld) => tail(w, (s) => s.approachFraction)
      const marks = runs.map((w) => tail(w, (s) => s.hueConcentration))
      const b = (founders: 'all-2b' | 'all-3a') =>
        mean([1, 2, 3].map((s) => run(s, { ...params, mutationScale: 0 }, founders).births))
      console.log(
        `${f(count, 5)} ${f(regrowthRate, 6)} ${f(capacity, 3)} ${f(
          count * regrowthRate, 6,
        )} | ${String(runs.filter((w) => w.extinct).length).padStart(3)} | ${f(
          mean(runs.map((w) => w.births)), 6,
        )} | ${f(mean(runs.map(ap)), 8)} | ${f(
          mean(runs.map((w, i) => ap(w) - ap(offRuns[i]))), 8,
        )} | ${f(mean(marks), 8)} (${marks.filter((m) => m >= 0.8).length}/10) | ${f(
          b('all-2b') / Math.max(0.01, b('all-3a')),
        )} | ${f(mean(runs.map((w) => mean(w.creatures.map((c) => c.genome.bias)))), 4)} ${f(
          mean(
            runs.map((w) =>
              mean(
                w.creatures.map(
                  (c) =>
                    (Math.abs(c.vehicle.actuators.left) + Math.abs(c.vehicle.actuators.right)) / 2,
                ),
              ),
            ),
          ), 5,
        )}`,
      )
    }
  }
}, 1_800_000)

it('phase C: drifting patches', () => {
  /**
   * Food that wanders instead of teleporting. Same economics as ephemeral --
   * a steady flow per patch, so influx is count x flowRate and independent of
   * population -- but following food that is going somewhere is a steering
   * problem, where a patch vanishing is a search that restarts from nothing.
   */
  console.log(
    '\ndrift flow count | ext | births | approach | vs noSel | markConc | parity | bias speed',
  )
  for (const driftSpeed of [0.25, 0.5, 0.9, 1.5]) {
    for (const flowRate of [2.6, 3.4]) {
      for (const count of [3, 4]) {
        const params = {
          ...DEFAULT_CONTINUOUS_PARAMS,
          food: {
            ...DEFAULT_CONTINUOUS_PARAMS.food,
            mode: 'drifting' as const,
            count,
            flowRate,
            driftSpeed,
          },
        }
        const runs = SEEDS.map((s) => run(s, params))
        const offRuns = SEEDS.map((s) => run(s, { ...params, selection: false }))
        const ap = (w: ContinuousWorld) => tail(w, (s) => s.approachFraction)
        const marks = runs.map((w) => tail(w, (s) => s.hueConcentration))
        const b = (founders: 'all-2b' | 'all-3a') =>
          mean([1, 2, 3].map((s) => run(s, { ...params, mutationScale: 0 }, founders).births))
        console.log(
          `${f(driftSpeed, 5)} ${f(flowRate, 4)} ${f(count, 5)} | ${String(
            runs.filter((w) => w.extinct).length,
          ).padStart(3)} | ${f(mean(runs.map((w) => w.births)), 6)} | ${f(
            mean(runs.map(ap)), 8,
          )} | ${f(mean(runs.map((w, i) => ap(w) - ap(offRuns[i]))), 8)} | ${f(
            mean(marks), 8,
          )} (${marks.filter((m) => m >= 0.8).length}/10) | ${f(
            b('all-2b') / Math.max(0.01, b('all-3a')),
          )} | ${f(mean(runs.map((w) => mean(w.creatures.map((c) => c.genome.bias)))), 4)} ${f(
            mean(
              runs.map((w) =>
                mean(
                  w.creatures.map(
                    (c) =>
                      (Math.abs(c.vehicle.actuators.left) + Math.abs(c.vehicle.actuators.right)) / 2,
                  ),
                ),
              ),
            ), 5,
          )}`,
        )
      }
    }
  }
}, 1_800_000)

it('phase C: settle the drifting world', () => {
  console.log('\ndrift flow count | ext | births | approach | vs noSel | markConc | parity | bias speed')
  for (const driftSpeed of [0.4, 0.5, 0.65]) {
    for (const flowRate of [3.0, 3.4, 4.0]) {
      for (const count of [4, 5]) {
        const params = {
          ...DEFAULT_CONTINUOUS_PARAMS,
          food: {
            ...DEFAULT_CONTINUOUS_PARAMS.food,
            mode: 'drifting' as const,
            count,
            flowRate,
            driftSpeed,
          },
        }
        const runs = SEEDS.map((s) => run(s, params))
        const offRuns = SEEDS.map((s) => run(s, { ...params, selection: false }))
        const ap = (w: ContinuousWorld) => tail(w, (s) => s.approachFraction)
        const marks = runs.map((w) => tail(w, (s) => s.hueConcentration))
        const b = (founders: 'all-2b' | 'all-3a') =>
          mean([1, 2, 3].map((s) => run(s, { ...params, mutationScale: 0 }, founders).births))
        console.log(
          `${f(driftSpeed, 5)} ${f(flowRate, 4)} ${f(count, 5)} | ${String(
            runs.filter((w) => w.extinct).length,
          ).padStart(3)} | ${f(mean(runs.map((w) => w.births)), 6)} | ${f(
            mean(runs.map(ap)), 8,
          )} | ${f(mean(runs.map((w, i) => ap(w) - ap(offRuns[i]))), 8)} | ${f(
            mean(marks), 8,
          )} (${marks.filter((m) => m >= 0.8).length}/10) | ${f(
            b('all-2b') / Math.max(0.01, b('all-3a')),
          )} | ${f(mean(runs.map((w) => mean(w.creatures.map((c) => c.genome.bias)))), 4)} ${f(
            mean(
              runs.map((w) =>
                mean(
                  w.creatures.map(
                    (c) =>
                      (Math.abs(c.vehicle.actuators.left) + Math.abs(c.vehicle.actuators.right)) / 2,
                  ),
                ),
              ),
            ), 5,
          )}`,
        )
      }
    }
  }
}, 1_800_000)
