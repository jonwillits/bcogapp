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
import { observe, CENTRE_LIGHT, PERTURBATIONS, type Perturbation } from './observation'
import { buildFixtureSet } from './lineages'
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

it('probe: real forks — pick the W/X branch seeds', () => {
  const opts = { startRadius: 0.3, lightStrength: 4, duration: 30 }
  console.log('\nP seed / split / branch seeds | W arr dist hue | X arr dist hue')
  for (const pSeed of [2, 3, 6]) {
    for (const splitAt of [25, 30]) {
      const base = new EvolutionWorld(pSeed, {}, 'P')
      base.run(splitAt)
      for (const [bw, bx] of [[101, 202], [303, 404]]) {
        const W = base.fork(bw)
        W.run(40 - splitAt)
        const X = base.fork(bx)
        X.run(40 - splitAt)
        const ow = observe(genomes(W), CENTRE_LIGHT, opts)
        const ox = observe(genomes(X), CENTRE_LIGHT, opts)
        console.log(
          `  P${pSeed} @${splitAt} ${bw}/${bx} | ${f(ow.meanTimeToArrival)} ${f(
            ow.meanDistance,
          )} ${f(W.history[39].modalHue, 6)} | ${f(ox.meanTimeToArrival)} ${f(
            ox.meanDistance,
          )} ${f(X.history[39].modalHue, 6)}`,
        )
      }
    }
  }
})

it('probe: search W/X/Y triples against §10', () => {
  const opts = { startRadius: 0.3, lightStrength: 4, duration: 30 }
  interface Cand { label: string; arr: number; dist: number; hue: number; pSeed?: number; splitAt?: number; branch?: number; seed?: number }

  // Every branch of every candidate P run.
  const branches: Cand[] = []
  for (const pSeed of [1, 2, 3, 5, 6]) {
    for (const splitAt of [25, 30]) {
      const base = new EvolutionWorld(pSeed, {}, 'P')
      base.run(splitAt)
      for (let b = 101; b <= 130; b++) {
        const w = base.fork(b)
        w.run(40 - splitAt)
        const o = observe(genomes(w), CENTRE_LIGHT, opts)
        branches.push({
          label: `P${pSeed}@${splitAt}#${b}`,
          arr: o.meanTimeToArrival, dist: o.meanDistance,
          hue: w.history[39].modalHue, pSeed, splitAt, branch: b,
        })
      }
    }
  }

  // Every Y candidate that took the ipsilateral-inhibitory route.
  const ys: Cand[] = []
  for (let seed = 1; seed <= 30; seed++) {
    const w = new EvolutionWorld(seed, {}, 'Q')
    w.run(40)
    if (!populationRoute(w).startsWith('ipsi')) continue
    const o = observe(genomes(w), CENTRE_LIGHT, opts)
    ys.push({ label: `Q${seed}`, arr: o.meanTimeToArrival, dist: o.meanDistance, hue: w.history[39].modalHue, seed })
  }

  // §10: arrivals within 15% of each other, distances within 0.9 (10% of the
  // pit half-width). Score by the worst of the two margins.
  const results: { score: number; line: string }[] = []
  for (let i = 0; i < branches.length; i++) {
    for (let j = i + 1; j < branches.length; j++) {
      const W = branches[i], X = branches[j]
      if (W.pSeed !== X.pSeed || W.splitAt !== X.splitAt) continue
      for (const Y of ys) {
        const arrs = [W.arr, X.arr, Y.arr]
        const dists = [W.dist, X.dist, Y.dist]
        const arrSpread = Math.max(...arrs) / Math.min(...arrs) - 1
        const distSpread = Math.max(...dists) - Math.min(...dists)
        if (arrSpread > 0.15 || distSpread > 0.9) continue
        results.push({
          score: arrSpread / 0.15 + distSpread / 0.9,
          line: `  ${W.label} / ${X.label} / ${Y.label} | arr ${f(W.arr)} ${f(X.arr)} ${f(
            Y.arr,
          )} (${f(arrSpread * 100, 5)}%) dist ${f(W.dist)} ${f(X.dist)} ${f(Y.dist)} (${f(
            distSpread, 5,
          )}) | hues ${f(W.hue, 6)} ${f(X.hue, 6)} ${f(Y.hue, 6)}`,
        })
      }
    }
  }
  results.sort((a, b) => a.score - b.score)
  console.log(`\n${results.length} triples satisfy §10's separability bounds. Best 15:`)
  for (const r of results.slice(0, 15)) console.log(r.line)
})

it('probe: verify the chosen fixture set end to end', () => {
  const opts = { startRadius: 0.3, lightStrength: 4, duration: 30 }
  const built = buildFixtureSet()
  console.log('\n id pool | arrive  dist  settled | modal hue | route | lineage nodes')
  const summary: { id: string; arr: number; dist: number; hue: number }[] = []
  for (const fx of built) {
    const o = observe(fx.genomes, CENTRE_LIGHT, opts)
    const counts = { 'ipsi-inhibitory': 0, 'contra-excitatory': 0, neither: 0 }
    for (const g of fx.genomes) counts[route(g)]++
    const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
    const hues = fx.genomes.map((g) => g.hue)
    let bestHue = hues[0], bestCount = 0
    for (const c of hues) {
      const n = hues.filter((h) => Math.min(Math.abs(c - h), 360 - Math.abs(c - h)) <= 20).length
      if (n > bestCount) { bestCount = n; bestHue = c }
    }
    summary.push({ id: fx.id, arr: o.meanTimeToArrival, dist: o.meanDistance, hue: bestHue })
    console.log(
      `  ${fx.id}  ${fx.pool}   | ${f(o.meanTimeToArrival)} ${f(o.meanDistance)} ${f(
        o.meanFinalDistance,
      )} | ${f(bestHue, 9)} | ${best[0]} ${best[1]}/${fx.genomes.length} | ${fx.lineage.length}`,
    )
  }

  const approachers = summary.filter((s) => s.id !== 'Z')
  const arrs = approachers.map((s) => s.arr)
  const dists = approachers.map((s) => s.dist)
  console.log(
    `\n  separability: arrival spread ${f(
      (Math.max(...arrs) / Math.min(...arrs) - 1) * 100, 5,
    )}% (bound 15%), distance spread ${f(Math.max(...dists) - Math.min(...dists), 5)} (bound 0.90)`,
  )
  const gap = (a: number, b: number) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b))
  const h = Object.fromEntries(summary.map((s) => [s.id, s.hue]))
  console.log(
    `  hue gaps: W-Z ${f(gap(h.W, h.Z), 6)}  W-X ${f(gap(h.W, h.X), 6)}  W-Y ${f(
      gap(h.W, h.Y), 6,
    )}  Y-Z ${f(gap(h.Y, h.Z), 6)}`,
  )

  console.log('\n  divergence: mean distance under each perturbation')
  console.log('  perturbation                             |     W      X      Y      Z | Y vs W/X')
  for (const pert of PERTURBATIONS) {
    const d = built.map((fx) => observe(fx.genomes, pert, opts).meanDistance)
    const wx = (d[0] + d[1]) / 2
    const ratio = Math.max(wx, d[2]) / Math.max(0.01, Math.min(wx, d[2]))
    console.log(
      `  ${pert.label.padEnd(40)} | ${f(d[0])} ${f(d[1])} ${f(d[2])} ${f(d[3])} | ${f(ratio)}`,
    )
  }
})

/**
 * The final fixture search, scoring both halves of §10 at once on statistics
 * that can actually see the difference.
 *
 * Measured findings that shaped this, in order:
 *
 * At 40 generations the evolved populations are barely wired -- mean |w| around
 * 0.6, bias 0.1, speeds under 0.3 -- so their mechanisms have almost no
 * behavioural consequence. 4777 triples pass separability and *none* of them
 * diverges anywhere, which kills Q14.
 *
 * At 120 generations they are strongly wired, 66 triples pass separability, and
 * still none reaches §10's factor of two on **mean distance** under any
 * perturbation. That is not a tuning failure. Mean distance is the wrong
 * statistic: every approacher ends up near the light whatever mechanism took it
 * there, so the number that separability is defined on is the same number that
 * cannot see a mechanism.
 *
 * What does see it is variation -- whether a vehicle holds still at the light or
 * keeps swinging past it. That is also what a student sees. So the search scores
 * within-vehicle spread of distance, and speed, requiring the three approachers
 * to match on all three statistics in the default world and Y to come apart on
 * at least two perturbations.
 */
it('probe: final fixture search', () => {
  const opts = { startRadius: 0.3, lightStrength: 4, duration: 30 }
  const WORLDS = [CENTRE_LIGHT, ...PERTURBATIONS]

  interface Cand {
    label: string
    d: number[]
    spread: number[]
    speed: number[]
    arr: number
    hue: number
    strength: number
    gens: number
  }
  const profile = (label: string, w: EvolutionWorld, gens: number): Cand => {
    const g = genomes(w)
    const obs = WORLDS.map((world) => observe(g, world, opts))
    return {
      label,
      d: obs.map((o) => o.meanDistance),
      spread: obs.map((o) => o.meanDistanceSpread),
      speed: obs.map((o) => o.meanSpeed),
      arr: obs[0].meanTimeToArrival,
      hue: w.history[w.history.length - 1].modalHue,
      strength: mean(
        g.map((x) => (Math.abs(x.wLL) + Math.abs(x.wLR) + Math.abs(x.wRL) + Math.abs(x.wRR)) / 4),
      ),
      gens,
    }
  }

  const branches: (Cand & { pSeed: number })[] = []
  const ys: Cand[] = []
  for (const gens of [90, 120, 160]) {
    const split = gens - 30
    for (const pSeed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
      const base = new EvolutionWorld(pSeed, {}, 'P')
      base.run(split)
      for (let b = 101; b <= 108; b++) {
        const w = base.fork(b)
        w.run(gens - split)
        branches.push({ ...profile(`P${pSeed}@${gens}#${b}`, w, gens), pSeed })
      }
    }
    for (let seed = 1; seed <= 30; seed++) {
      const w = new EvolutionWorld(seed, {}, 'Q')
      w.run(gens)
      if (!populationRoute(w).startsWith('ipsi')) continue
      ys.push(profile(`Q${seed}@${gens}`, w, gens))
    }
  }
  console.log(`
${branches.length} P branches, ${ys.length} ipsi-inhibitory Q runs`)

  const ratio = (a: number, b: number) =>
    Math.max(a, b) / Math.max(0.02, Math.min(a, b))

  const results: { score: number; line: string }[] = []
  for (let i = 0; i < branches.length; i++) {
    for (let j = i + 1; j < branches.length; j++) {
      const W = branches[i], X = branches[j]
      if (W.pSeed !== X.pSeed || W.gens !== X.gens) continue
      for (const Y of ys) {
        if (Y.gens !== W.gens) continue

        // Separability, in the default world, on every statistic a student
        // could sort them by -- not just the two §10 names.
        const arrs = [W.arr, X.arr, Y.arr]
        if (Math.max(...arrs) / Math.min(...arrs) - 1 > 0.15) continue
        const ds = [W.d[0], X.d[0], Y.d[0]]
        if (Math.max(...ds) - Math.min(...ds) > 0.9) continue
        // Pairwise across all three, not each against the average of the other
        // two: a student compares populations with each other, so the widest
        // gap between any two is what they would notice.
        const spreads0 = [W.spread[0], X.spread[0], Y.spread[0]]
        const speeds0 = [W.speed[0], X.speed[0], Y.speed[0]]
        if (ratio(Math.max(...spreads0), Math.min(...spreads0)) > 1.35) continue
        if (ratio(Math.max(...speeds0), Math.min(...speeds0)) > 1.35) continue

        // Divergence, under each perturbation, on the statistics that can see
        // a mechanism.
        const per = [1, 2, 3, 4].map((k) => ({
          dist: ratio((W.d[k] + X.d[k]) / 2, Y.d[k]),
          spread: ratio((W.spread[k] + X.spread[k]) / 2, Y.spread[k]),
          speed: ratio((W.speed[k] + X.speed[k]) / 2, Y.speed[k]),
        }))
        const best = per.map((p) => Math.max(p.spread, p.speed))
        const count = best.filter((r) => r >= 2).length
        if (count === 0) continue
        results.push({
          score: count * 100 + Math.min(...best.filter((r) => r >= 2)),
          line: `  ${W.label}/${X.label}/${Y.label} | sep arr ${f(
            (Math.max(...arrs) / Math.min(...arrs) - 1) * 100, 5,
          )}% d ${f(Math.max(...ds) - Math.min(...ds), 4)} | best-per-perturbation ${best
            .map((r) => f(r, 5))
            .join(' ')} | |w| ${f(W.strength, 4)}/${f(Y.strength, 4)}`,
        })
      }
    }
  }
  results.sort((a, b) => b.score - a.score)
  console.log(`${results.length} triples separable AND divergent on at least one perturbation.`)
  const hist: Record<number, number> = {}
  for (const r of results) {
    const c = Math.floor(r.score / 100)
    hist[c] = (hist[c] ?? 0) + 1
  }
  console.log(`  perturbations reaching 2x: ${JSON.stringify(hist)}`)
  for (const r of results.slice(0, 16)) console.log(r.line)
}, 900_000)

it('probe: which statistic separates settling from orbiting', () => {
  const opts = { startRadius: 0.3, lightStrength: 4, duration: 30 }
  const WORLDS = [CENTRE_LIGHT, ...PERTURBATIONS]
  const pops: [string, Genome[]][] = [
    ['ideal 2b', Array.from({ length: 12 }, () => IDEAL['2b charge'])],
    ['ideal 3a', Array.from({ length: 12 }, () => IDEAL['3a settle'])],
  ]
  const built = buildFixtureSet()
  for (const fx of built) pops.push([`fixture ${fx.id}`, fx.genomes])

  for (const world of WORLDS) {
    console.log(`\n${world.label}`)
    console.log('  population   | dist  spread speed  near%  settled')
    for (const [label, g] of pops) {
      const o = observe(g, world, opts)
      console.log(
        `  ${label.padEnd(12)} | ${f(o.meanDistance)} ${f(o.meanDistanceSpread)} ${f(
          o.meanSpeed,
        )} ${f(o.timeNearFraction)} ${f(o.meanFinalDistance)}`,
      )
    }
  }
})

it('probe: what are the fixtures actually wired like', () => {
  const built = buildFixtureSet()
  for (const fx of built) {
    const g = fx.genomes
    const m = (fn: (x: Genome) => number) => mean(g.map(fn))
    const varieties: Record<string, number> = {}
    for (const x of g) {
      const v = nearestVariety(x).split(' ')[0]
      varieties[v] = (varieties[v] ?? 0) + 1
    }
    console.log(
      `\n${fx.id}: wLL ${f(m((x) => x.wLL))} wLR ${f(m((x) => x.wLR))} wRL ${f(
        m((x) => x.wRL),
      )} wRR ${f(m((x) => x.wRR))} bias ${f(m((x) => x.bias))}`,
    )
    console.log(
      `   crossing ${f(m(crossing))} sign ${f(m(meanWeight))} mean|w| ${f(
        m((x) => (Math.abs(x.wLL) + Math.abs(x.wLR) + Math.abs(x.wRL) + Math.abs(x.wRR)) / 4),
      )}  varieties ${JSON.stringify(varieties)}`,
    )
  }
})

it('probe: does longer evolution strengthen the wiring', () => {
  console.log('\ngens | pool | mean|w|  bias  crossing  sign | obs speed spread dist')
  for (const [pool, regime] of [['P', 'food'], ['Q', 'food']] as const) {
    for (const gens of [40, 80, 140]) {
      const w = new EvolutionWorld(5, { regime }, pool)
      w.run(gens)
      const g = genomes(w)
      const m = (fn: (x: Genome) => number) => mean(g.map(fn))
      const o = observe(g, CENTRE_LIGHT, { startRadius: 0.3, lightStrength: 4, duration: 30 })
      console.log(
        `${f(gens, 4)} | ${pool}    | ${f(
          m((x) => (Math.abs(x.wLL) + Math.abs(x.wLR) + Math.abs(x.wRL) + Math.abs(x.wRR)) / 4),
        )} ${f(m((x) => x.bias))} ${f(m(crossing))} ${f(m(meanWeight))} | ${f(
          o.meanSpeed,
        )} ${f(o.meanDistanceSpread)} ${f(o.meanDistance)}`,
      )
    }
  }
})

it('probe: can the perturbations themselves be tuned to separate', () => {
  const opts = { startRadius: 0.3, lightStrength: 4, duration: 30 }
  // The strongest-wired separable triple the final search found.
  const base = new EvolutionWorld(4, {}, 'P')
  base.run(90)
  const W = base.fork(105); W.run(30)
  const X = base.fork(108); X.run(30)
  const Yw = new EvolutionWorld(23, {}, 'Q'); Yw.run(120)
  const [gW, gX, gY] = [genomes(W), genomes(X), genomes(Yw)]

  const ratio = (a: number, b: number) => Math.max(a, b) / Math.max(0.02, Math.min(a, b))
  const score = (pert: Perturbation) => {
    const [ow, ox, oy] = [gW, gX, gY].map((g) => observe(g, pert, opts))
    const wx = (k: (o: typeof ow) => number) => (k(ow) + k(ox)) / 2
    return {
      dist: ratio(wx((o) => o.meanDistance), oy.meanDistance),
      spread: ratio(wx((o) => o.meanDistanceSpread), oy.meanDistanceSpread),
      speed: ratio(wx((o) => o.meanSpeed), oy.meanSpeed),
      near: ratio(wx((o) => o.timeNearFraction) + 0.01, oy.timeNearFraction + 0.01),
    }
  }
  const show = (label: string, pert: Perturbation) => {
    const s = score(pert)
    console.log(
      `  ${label.padEnd(38)} dist ${f(s.dist)} spread ${f(s.spread)} speed ${f(
        s.speed,
      )} near ${f(s.near)}`,
    )
  }

  console.log('\ndefault world (must NOT separate)')
  show('one light at the centre', CENTRE_LIGHT)

  console.log('\nrim light, by height and distance')
  for (const y of [1.7, 2.7, 3.7]) {
    for (const z of [6, 7.5, 9]) {
      show(`rim light y=${y} z=${z}`, { label: '', lights: [[0, y, z]] })
    }
  }

  console.log('\ntwo lights, by separation')
  for (const sep of [2, 3.5, 4.5, 6, 7.5]) {
    show(`two lights at ±${sep}`, {
      label: '', lights: [[-sep, 0.7, 0], [sep, 0.7, 0]],
    })
  }

  console.log('\nsensor noise, by level')
  for (const n of [0.05, 0.1, 0.15, 0.2, 0.3, 0.5]) {
    show(`sensor noise ${n}`, { label: '', lights: [[0, 0.7, 0]], sensorNoise: n })
  }

  console.log('\nlight removed, by time')
  for (const t of [5, 10, 15, 20, 25]) {
    show(`light removed at ${t}s`, {
      label: '', lights: [[0, 0.7, 0]], removeAt: { index: 0, time: t },
    })
  }
})

it('probe: pick Z at 120 generations and set the hue shift', () => {
  const opts = { startRadius: 0.3, lightStrength: 4, duration: 30 }
  const modal = (g: Genome[]) => {
    const hues = g.map((x) => x.hue)
    let bh = hues[0], bc = 0
    for (const c of hues) {
      const n = hues.filter((h) => Math.min(Math.abs(c - h), 360 - Math.abs(c - h)) <= 20).length
      if (n > bc) { bc = n; bh = c }
    }
    return bh
  }
  const base = new EvolutionWorld(4, {}, 'P')
  base.run(90)
  const W = base.fork(105); W.run(30)
  const Yw = new EvolutionWorld(23, {}, 'Q'); Yw.run(120)
  const hW = modal(genomes(W)), hY = modal(genomes(Yw))
  console.log(`\nW natural hue ${f(hW, 7)}   Y hue ${f(hY, 7)}`)
  console.log('\nZ candidates at 120 generations (Q, poison)')
  for (let seed = 1; seed <= 20; seed++) {
    const z = new EvolutionWorld(seed, { regime: 'poison' }, 'Q')
    z.run(120)
    const o = observe(genomes(z), CENTRE_LIGHT, opts)
    const hZ = modal(genomes(z))
    const gapYZ = Math.min(Math.abs(hY - hZ), 360 - Math.abs(hY - hZ))
    const shift = ((hZ - hW) % 360 + 360) % 360
    console.log(
      `  Q${String(seed).padStart(2)}: dist ${f(o.meanDistance)} spread ${f(
        o.meanDistanceSpread,
      )} hue ${f(hZ, 7)} | Y-Z gap ${f(gapYZ, 6)} | P hueShift needed ${f(shift, 6)}`,
    )
  }
})
