/**
 * The search that produces the four saved lineages, W X Y Z.
 *
 * §9 of the spec is emphatic that these must be genuine engine output rather
 * than hand-authored genomes — partly because a hand-built "evolved" population
 * is a lie the lab is partly about, and partly because a student can open the
 * lineage tree and see whether the history is real. So this does not construct
 * populations; it runs the engine across seeds and reports which runs came out
 * with the histories and the behaviour the lab needs.
 *
 *   PROBE=1 npx vitest run --disable-console-intercept -t "route"
 */
import { it } from 'vitest'
import { EvolutionWorld } from './evolutionWorld'
import { observe, CENTRE_LIGHT, PERTURBATIONS } from './observation'
import { approachScore, crossing, meanWeight, nearestVariety, type Genome } from '../creature/genome'

const f = (n: number, w = 6) => n.toFixed(2).padStart(w)
const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / (a.length || 1)

/**
 * Which of the two routes out of pool Q a run took.
 *
 * Q starts ipsilateral excitatory and flees light. Under food selection it has
 * two ways to start approaching: flip the straight weights negative, arriving at
 * 3a (ipsilateral inhibitory), or grow the crossed weights positive, arriving at
 * 2b — the same mechanism W and X use. Only the first is any use to the lab,
 * because Y has to be *mechanistically different* from W and X while behaving
 * the same. Which route a lineage takes is partly chance, which is a
 * strengthening of the lab's point rather than a nuisance.
 */
function route(g: Genome): 'ipsi-inhibitory' | 'contra-excitatory' | 'neither' {
  const c = crossing(g)
  const s = meanWeight(g)
  if (approachScore(g) <= 0) return 'neither'
  return c < 0 && s < 0 ? 'ipsi-inhibitory' : c > 0 && s > 0 ? 'contra-excitatory' : 'neither'
}

function populationRoute(w: EvolutionWorld): string {
  const counts = { 'ipsi-inhibitory': 0, 'contra-excitatory': 0, neither: 0 }
  for (const p of w.population) counts[route(p.genome)]++
  const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
  return `${best[0]} (${best[1]}/${w.population.length})`
}

const genomes = (w: EvolutionWorld) => w.population.map((p) => p.genome)

it('probe: which route does pool Q take, per seed', () => {
  console.log('\nQ under food, 40 generations — which route to light-approach')
  for (let seed = 1; seed <= 24; seed++) {
    const w = new EvolutionWorld(seed, {}, 'Q')
    w.run(40)
    const best = [...w.population].sort((a, b) => b.energy - a.energy)[0]
    const obs = observe(genomes(w), CENTRE_LIGHT)
    console.log(
      `  seed ${String(seed).padStart(2)}: ${populationRoute(w).padEnd(28)} best ${nearestVariety(
        best.genome,
      ).padEnd(26)} arrive ${f(obs.meanTimeToArrival)} dist ${f(obs.meanDistance)} got ${f(
        obs.arrivedFraction,
      )}`,
    )
  }
})

it('probe: pool P under food, per seed', () => {
  console.log('\nP under food, 40 generations — W and X come from here')
  for (let seed = 1; seed <= 24; seed++) {
    const w = new EvolutionWorld(seed, {}, 'P')
    w.run(40)
    const obs = observe(genomes(w), CENTRE_LIGHT)
    console.log(
      `  seed ${String(seed).padStart(2)}: ${populationRoute(w).padEnd(28)} arrive ${f(
        obs.meanTimeToArrival,
      )} dist ${f(obs.meanDistance)} got ${f(obs.arrivedFraction)} hue ${f(
        w.history[39].modalHue,
      )}`,
    )
  }
})

it('probe: pool Q under poison, per seed', () => {
  console.log('\nQ under poison, 40 generations — Z comes from here')
  for (let seed = 1; seed <= 12; seed++) {
    const w = new EvolutionWorld(seed, { regime: 'poison' }, 'Q')
    w.run(40)
    const obs = observe(genomes(w), CENTRE_LIGHT)
    console.log(
      `  seed ${String(seed).padStart(2)}: ${populationRoute(w).padEnd(28)} arrive ${f(
        obs.meanTimeToArrival,
      )} dist ${f(obs.meanDistance)} got ${f(obs.arrivedFraction)} hue ${f(
        w.history[39].modalHue,
      )}`,
    )
  }
})

/**
 * W and X are sister lineages: one run of P, split late, so they share a recent
 * common ancestor that already had the trait. That is the homology, and it has
 * to be a real split in a real tree rather than two separate runs.
 */
it('probe: splitting one P run into sisters W and X', () => {
  console.log('\nP split at generation 30, then 10 more generations apart')
  for (let seed = 1; seed <= 12; seed++) {
    const base = new EvolutionWorld(seed, {}, 'P')
    base.run(30)
    const parents = genomes(base)

    // Two continuations of the same population, differing only in the stream
    // they carry on with -- which is what a lineage splitting actually is.
    const branch = (offset: number) => {
      const w = new EvolutionWorld(seed + offset, {}, 'P')
      w.population.forEach((ind, i) => {
        ind.genome = parents[i % parents.length]
      })
      w.run(10)
      return w
    }
    const wPop = branch(1000)
    const xPop = branch(2000)
    const ow = observe(genomes(wPop), CENTRE_LIGHT)
    const ox = observe(genomes(xPop), CENTRE_LIGHT)
    console.log(
      `  seed ${String(seed).padStart(2)}: W arrive ${f(ow.meanTimeToArrival)} dist ${f(
        ow.meanDistance,
      )} | X arrive ${f(ox.meanTimeToArrival)} dist ${f(ox.meanDistance)} | gap ${f(
        Math.abs(ow.meanTimeToArrival - ox.meanTimeToArrival) /
          Math.max(ow.meanTimeToArrival, ox.meanTimeToArrival),
      )}`,
    )
  }
})

it('probe: how separable are the perturbations', () => {
  // Uses whichever seeds the earlier probes suggest; adjust as the search
  // narrows. Reports every perturbation for a pair, so the divergence test can
  // be checked before any of this is frozen into a fixture.
  const P_SEED = 1
  const Q_SEED = 1
  const p = new EvolutionWorld(P_SEED, {}, 'P')
  p.run(40)
  const q = new EvolutionWorld(Q_SEED, {}, 'Q')
  q.run(40)
  console.log('\nperturbation                              | P dist  Q dist  ratio')
  for (const pert of [CENTRE_LIGHT, ...PERTURBATIONS]) {
    const a = observe(genomes(p), pert)
    const b = observe(genomes(q), pert)
    console.log(
      `  ${pert.label.padEnd(40)} | ${f(a.meanDistance)} ${f(b.meanDistance)} ${f(
        Math.max(a.meanDistance, b.meanDistance) /
          Math.max(0.01, Math.min(a.meanDistance, b.meanDistance)),
      )}`,
    )
  }
  console.log(
    `  (P route ${populationRoute(p)}, Q route ${populationRoute(q)}, mean approach ${f(
      mean(genomes(p).map(approachScore)),
    )} / ${f(mean(genomes(q).map(approachScore)))})`,
  )
})

const IDEAL: Record<string, Genome> = {
  // The three behaviours Part 3 has to be able to show, as textbook genomes.
  // If the observation world cannot separate these, it cannot separate
  // anything, and measuring evolved populations with it is meaningless.
  '2b charge': { wLL: 0, wLR: 2, wRL: 2, wRR: 0, bias: 0.6, hue: 0 },
  '3a settle': { wLL: -2, wLR: 0, wRL: 0, wRR: -2, bias: 1.2, hue: 0 },
  '2a flee': { wLL: 2, wLR: 0, wRL: 0, wRR: 2, bias: 0.6, hue: 0 },
}

it('probe: can the observation world tell a charger from a fleer at all', () => {
  console.log('\nstart light dur | 2b: arr dist got | 3a: arr dist got | 2a: arr dist got')
  for (const startRadius of [0.3, 0.45, 0.6]) {
    for (const lightStrength of [2, 4, 8]) {
      for (const duration of [30, 45]) {
        const cells = Object.values(IDEAL).map((g) => {
          const pop = Array.from({ length: 12 }, () => g)
          const o = observe(pop, CENTRE_LIGHT, {
            startRadius,
            lightStrength,
            duration,
          })
          return `${f(o.meanTimeToArrival, 5)} ${f(o.meanDistance, 5)} ${f(
            o.arrivedFraction,
            4,
          )}`
        })
        console.log(
          `${f(startRadius, 5)} ${f(lightStrength, 5)} ${f(duration, 3)} | ${cells.join(
            ' | ',
          )}`,
        )
      }
    }
  }
})

it('probe: why does nothing arrive at a single centre light', () => {
  const w = new EvolutionWorld(1, {}, 'Q')
  w.run(40)
  const g = genomes(w)
  console.log('\nevolved population (Q, seed 1, gen 40)')
  console.log(
    `  mean bias ${f(mean(g.map((x) => x.bias)))} mean |w| ${f(
      mean(g.map((x) => (Math.abs(x.wLL) + Math.abs(x.wLR) + Math.abs(x.wRL) + Math.abs(x.wRR)) / 4)),
    )} mean approach ${f(mean(g.map(approachScore)))}`,
  )
  console.log('\n  lightStrength duration | arrive  dist   got   (Q, seed 1)')
  for (const lightStrength of [4, 8, 16, 30]) {
    for (const duration of [30, 60]) {
      const o = observe(g, CENTRE_LIGHT, { lightStrength, duration })
      console.log(
        `  ${f(lightStrength, 13)} ${f(duration, 8)} | ${f(o.meanTimeToArrival)} ${f(
          o.meanDistance,
        )} ${f(o.arrivedFraction)}`,
      )
    }
  }

  console.log('\n  the same, for a hand-built ideal 3a and 2b (sanity check)')
  const ideal3a = Array.from({ length: 12 }, (): Genome => ({
    wLL: -2, wLR: 0, wRL: 0, wRR: -2, bias: 1.2, hue: 0,
  }))
  const ideal2b = Array.from({ length: 12 }, (): Genome => ({
    wLL: 0, wLR: 2, wRL: 2, wRR: 0, bias: 0.6, hue: 0,
  }))
  for (const [label, pop] of [['3a', ideal3a], ['2b', ideal2b]] as const) {
    for (const lightStrength of [4, 16]) {
      const o = observe(pop, CENTRE_LIGHT, { lightStrength })
      console.log(
        `  ${label} @ strength ${f(lightStrength, 4)} | arrive ${f(
          o.meanTimeToArrival,
        )} dist ${f(o.meanDistance)} got ${f(o.arrivedFraction)}`,
      )
    }
  }
})

/**
 * The decisive measurement: do *evolved* populations come out close enough to
 * satisfy §6's one hard build requirement, where textbook genomes plainly do
 * not?
 */
it('probe: candidate fixtures side by side', () => {
  const opts = { startRadius: 0.3, lightStrength: 4, duration: 30 }
  const show = (label: string, g: Genome[]) => {
    const o = observe(g, CENTRE_LIGHT, opts)
    console.log(
      `  ${label.padEnd(22)} arrive ${f(o.meanTimeToArrival)} dist ${f(
        o.meanDistance,
      )} closest ${f(o.meanClosest)} settled ${f(o.meanFinalDistance)} got ${f(
        o.arrivedFraction,
      )}`,
    )
  }

  console.log('\ntextbook genomes, for reference')
  for (const [label, g] of Object.entries(IDEAL)) {
    show(label, Array.from({ length: 12 }, () => g))
  }

  console.log('\nevolved: P under food (W/X candidates)')
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const w = new EvolutionWorld(seed, {}, 'P')
    w.run(40)
    show(`P seed ${seed} [${populationRoute(w).slice(0, 10)}]`, genomes(w))
  }

  console.log('\nevolved: Q under food, ipsi-inhibitory route (Y candidates)')
  for (const seed of [1, 8, 9, 14, 17, 22, 23]) {
    const w = new EvolutionWorld(seed, {}, 'Q')
    w.run(40)
    show(`Q seed ${seed} [${populationRoute(w).slice(0, 10)}]`, genomes(w))
  }

  console.log('\nevolved: Q under poison (Z candidates)')
  for (const seed of [1, 2, 3, 4]) {
    const w = new EvolutionWorld(seed, { regime: 'poison' }, 'Q')
    w.run(40)
    show(`Zq seed ${seed}`, genomes(w))
  }
})

it('probe: assemble a full candidate set and score it against §10', () => {
  const opts = { startRadius: 0.3, lightStrength: 4, duration: 30 }
  const measure = (g: Genome[]) => observe(g, CENTRE_LIGHT, opts)

  console.log('\nsplitting P seed 2 at generation 30, branches run 10 more')
  for (const pSeed of [1, 2, 3, 5, 6]) {
    const base = new EvolutionWorld(pSeed, {}, 'P')
    base.run(30)
    const parents = genomes(base)
    const branch = (offset: number) => {
      const w = new EvolutionWorld(pSeed * 7919 + offset, {}, 'P')
      w.population.forEach((ind, i) => { ind.genome = parents[i % parents.length] })
      w.run(10)
      return w
    }
    const W = branch(1)
    const X = branch(2)
    const ow = measure(genomes(W))
    const ox = measure(genomes(X))
    console.log(
      `  P${pSeed}: W arr ${f(ow.meanTimeToArrival)} dist ${f(ow.meanDistance)} hue ${f(
        W.history[W.history.length - 1].modalHue, 6,
      )} | X arr ${f(ox.meanTimeToArrival)} dist ${f(ox.meanDistance)} hue ${f(
        X.history[X.history.length - 1].modalHue, 6,
      )}`,
    )
  }

  console.log('\nY candidates (Q food, ipsi-inhibitory) and Z candidates (Q poison), with hues')
  for (const seed of [1, 8, 9, 14, 17, 22]) {
    const y = new EvolutionWorld(seed, {}, 'Q')
    y.run(40)
    console.log(`  Y  Q${String(seed).padStart(2)}: hue ${f(y.history[39].modalHue, 6)}`)
  }
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const z = new EvolutionWorld(seed, { regime: 'poison' }, 'Q')
    z.run(40)
    console.log(`  Z  Q${String(seed).padStart(2)}: hue ${f(z.history[39].modalHue, 6)}`)
  }
})

it('probe: can W and X fix on different hues while behaving alike', () => {
  const opts = { startRadius: 0.3, lightStrength: 4, duration: 30 }
  console.log('\nsplit generation | W arr dist hue | X arr dist hue | hue gap')
  for (const splitGen of [10, 15, 20, 30]) {
    for (const pSeed of [2, 3, 6]) {
      const base = new EvolutionWorld(pSeed, {}, 'P')
      base.run(splitGen)
      const parents = genomes(base)
      const branch = (offset: number) => {
        const w = new EvolutionWorld(pSeed * 7919 + offset, {}, 'P')
        w.population.forEach((ind, i) => { ind.genome = parents[i % parents.length] })
        w.run(40 - splitGen)
        return w
      }
      const W = branch(1)
      const X = branch(2)
      const ow = observe(genomes(W), CENTRE_LIGHT, opts)
      const ox = observe(genomes(X), CENTRE_LIGHT, opts)
      const hw = W.history[W.history.length - 1].modalHue
      const hx = X.history[X.history.length - 1].modalHue
      const gap = Math.min(Math.abs(hw - hx), 360 - Math.abs(hw - hx))
      console.log(
        `  gen ${String(splitGen).padStart(2)} P${pSeed} | ${f(ow.meanTimeToArrival)} ${f(
          ow.meanDistance,
        )} ${f(hw, 6)} | ${f(ox.meanTimeToArrival)} ${f(ox.meanDistance)} ${f(
          hx, 6,
        )} | ${f(gap, 6)}`,
      )
    }
  }
})

it('probe: pick Y and Z, hue gap included', () => {
  const opts = { startRadius: 0.3, lightStrength: 4, duration: 30 }
  console.log('\nY candidates (Q food, ipsi-inhibitory route)')
  const ys: { seed: number; hue: number; arr: number; dist: number; route: string }[] = []
  for (let seed = 1; seed <= 24; seed++) {
    const w = new EvolutionWorld(seed, {}, 'Q')
    w.run(40)
    const r = populationRoute(w)
    if (!r.startsWith('ipsi')) continue
    const o = observe(genomes(w), CENTRE_LIGHT, opts)
    ys.push({ seed, hue: w.history[39].modalHue, arr: o.meanTimeToArrival, dist: o.meanDistance, route: r })
    console.log(
      `  Q${String(seed).padStart(2)}: arr ${f(o.meanTimeToArrival)} dist ${f(
        o.meanDistance,
      )} hue ${f(w.history[39].modalHue, 6)}  ${r}`,
    )
  }
  console.log('\nZ candidates (Q poison)')
  for (let seed = 1; seed <= 16; seed++) {
    const w = new EvolutionWorld(seed, { regime: 'poison' }, 'Q')
    w.run(40)
    const o = observe(genomes(w), CENTRE_LIGHT, opts)
    console.log(
      `  Q${String(seed).padStart(2)}: arr ${f(o.meanTimeToArrival)} dist ${f(
        o.meanDistance,
      )} settled ${f(o.meanFinalDistance)} hue ${f(w.history[39].modalHue, 6)}`,
    )
  }
})
