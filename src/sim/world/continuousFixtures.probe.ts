/**
 * Phase B — finding W, X, Y and Z under the continuous engine.
 *
 * Same contract as the generational search, and the same two criteria pulling
 * against each other: the three approachers must be indistinguishable in the
 * default world, and at least two perturbations must pull Y away from W and X.
 *
 * Two lessons carried forward from the first search, so they do not have to be
 * relearned:
 *
 *   - Divergence is measured on **how they move** (within-vehicle spread of
 *     distance, and speed), not on mean distance. Mean distance is the statistic
 *     separability is defined on, precisely because every approacher ends up
 *     near the light whatever took it there; it cannot then also see a
 *     mechanism.
 *   - The populations have to be **strongly enough wired to express their
 *     mechanism**. Weakly wired ones pass separability trivially and fail
 *     divergence completely.
 *
 *   PROBE=1 npx vitest run --disable-console-intercept -t "phase B"
 */
import { it } from 'vitest'
import { ContinuousWorld, DEFAULT_CONTINUOUS_PARAMS } from './continuousWorld'
import { observe, CENTRE_LIGHT, PERTURBATIONS } from './observation'
import { nearestVariety, type Genome } from '../creature/genome'

const f = (n: number, w = 6) => n.toFixed(2).padStart(w)
const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / (a.length || 1)
const OPTS = { startRadius: 0.3, lightStrength: 4, duration: 30 }
const ratio = (a: number, b: number) => Math.max(a, b) / Math.max(0.02, Math.min(a, b))

const WORLDS = [CENTRE_LIGHT, ...PERTURBATIONS]

interface Profile {
  label: string
  genomes: Genome[]
  d: number[]
  spread: number[]
  speed: number[]
  arr: number
  hue: number
  /** The commonest Lab 1 variety, and what fraction of the population it is. */
  variety: string
  purity: number
  strength: number
}

function profile(label: string, w: ContinuousWorld): Profile {
  const genomes = w.creatures.map((c) => ({ ...c.genome }))
  const obs = WORLDS.map((world) => observe(genomes, world, OPTS))
  const counts: Record<string, number> = {}
  for (const g of genomes) {
    const v = nearestVariety(g).split(' ')[0]
    counts[v] = (counts[v] ?? 0) + 1
  }
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0] ?? ['none', 0]
  const hues = genomes.map((g) => g.hue)
  let bestHue = hues[0] ?? 0
  let bestCount = 0
  for (const c of hues) {
    const n = hues.filter(
      (h) => Math.min(Math.abs(c - h), 360 - Math.abs(c - h)) <= 20,
    ).length
    if (n > bestCount) {
      bestCount = n
      bestHue = c
    }
  }
  return {
    label,
    genomes,
    d: obs.map((o) => o.meanDistance),
    spread: obs.map((o) => o.meanDistanceSpread),
    speed: obs.map((o) => o.meanSpeed),
    arr: obs[0].meanTimeToArrival,
    hue: bestHue,
    variety: top[0],
    purity: top[1] / (genomes.length || 1),
    strength: mean(
      genomes.map(
        (g) => (Math.abs(g.wLL) + Math.abs(g.wLR) + Math.abs(g.wRL) + Math.abs(g.wRR)) / 4,
      ),
    ),
  }
}

it('phase B: search, with run length as a dimension', () => {
  /**
   * Pool P amplifies a trait it already has; pool Q's route to 3a must flip its
   * straight weights through zero, which is a fitness valley, so Q reaches
   * comparable behaviour far later. Nothing requires the four saved populations
   * to have evolved for equally long -- they are populations somebody else
   * evolved -- so run length is a search dimension rather than a constant.
   */
  const branches: (Profile & { pSeed: number; dur: number })[] = []
  for (const dur of [2400, 3600]) {
    for (const pSeed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const base = new ContinuousWorld(pSeed, DEFAULT_CONTINUOUS_PARAMS, 'P')
      base.run(dur - 600)
      if (base.extinct) continue
      for (let b = 101; b <= 106; b++) {
        const branch = base.fork(b)
        branch.run(600)
        if (branch.extinct) continue
        const p = profile(`P${pSeed}@${dur}#${b}`, branch)
        if (p.variety !== '2b' || p.purity < 0.7) continue
        branches.push({ ...p, pSeed, dur })
      }
    }
  }

  const ys: Profile[] = []
  for (const dur of [4800, 9600]) {
    for (let seed = 1; seed <= 24; seed++) {
      const w = new ContinuousWorld(seed, DEFAULT_CONTINUOUS_PARAMS, 'Q')
      w.run(dur)
      if (w.extinct) continue
      const p = profile(`Q${seed}@${dur}`, w)
      if (p.variety === '3a' && p.purity >= 0.7) ys.push(p)
    }
  }
  console.log(`
${branches.length} clean 2b branches, ${ys.length} clean 3a Q runs`)

  const drop = { arrival: 0, distance: 0, spread: 0, speed: 0, divergence: 0, pass: 0 }
  const results: { score: number; line: string }[] = []
  for (let i = 0; i < branches.length; i++) {
    for (let j = i + 1; j < branches.length; j++) {
      const W = branches[i]
      const X = branches[j]
      if (W.pSeed !== X.pSeed || W.dur !== X.dur) continue
      for (const Y of ys) {
        const arrs = [W.arr, X.arr, Y.arr]
        if (Math.max(...arrs) / Math.min(...arrs) - 1 > 0.15) { drop.arrival++; continue }
        const ds = [W.d[0], X.d[0], Y.d[0]]
        if (Math.max(...ds) - Math.min(...ds) > 0.9) { drop.distance++; continue }
        const sp = [W.spread[0], X.spread[0], Y.spread[0]]
        const sv = [W.speed[0], X.speed[0], Y.speed[0]]
        // 1.6, the same bound accepted for the generational fixtures, where the
        // measured speed spread was 1.51 and documented as the loosest match.
        if (ratio(Math.max(...sp), Math.min(...sp)) > 1.6) { drop.spread++; continue }
        if (ratio(Math.max(...sv), Math.min(...sv)) > 1.6) { drop.speed++; continue }

        const best = [1, 2, 3, 4].map((k) =>
          Math.max(
            ratio((W.spread[k] + X.spread[k]) / 2, Y.spread[k]),
            ratio((W.speed[k] + X.speed[k]) / 2, Y.speed[k]),
          ),
        )
        const working = best.filter((r) => r >= 2).length
        if (working < 2) { drop.divergence++; continue }
        drop.pass++
        results.push({
          score: working * 100 + Math.min(...best.filter((r) => r >= 2)),
          line: `  ${W.label}/${X.label}/${Y.label} | arr ${f(W.arr, 5)} ${f(X.arr, 5)} ${f(
            Y.arr, 5,
          )} | d ${f(W.d[0], 4)} ${f(X.d[0], 4)} ${f(Y.d[0], 4)} | purity ${f(
            W.purity, 4,
          )} ${f(X.purity, 4)} ${f(Y.purity, 4)} | perturb ${best
            .map((r) => f(r, 5))
            .join(' ')} | hues ${f(W.hue, 6)} ${f(X.hue, 6)} ${f(Y.hue, 6)}`,
        })
      }
    }
  }
  console.log(`  where candidates die: ${JSON.stringify(drop)}`)
  results.sort((a, b) => b.score - a.score)
  console.log(`${results.length} triples pass both criteria. Best 14:`)
  for (const r of results.slice(0, 14)) console.log(r.line)
}, 1_800_000)

it('phase B: how P and Q develop, so their durations can be matched', () => {
  /**
   * Pool P amplifies a trait it already has -- contralateral excitation just
   * gets stronger. Pool Q's route to 3a has to flip the straight weights through
   * zero, which is a fitness valley, so it lingers weakly wired for far longer.
   * The two therefore reach comparable behaviour at very different times, and
   * nothing requires the four saved populations to have evolved for equally
   * long: they are simply populations somebody else evolved.
   */
  console.log('\npool seed | duration | arrive  dist  spread speed | |w| | variety purity')
  for (const pool of ['P', 'Q'] as const) {
    for (const seed of [3, 7, 11]) {
      for (const duration of [600, 1200, 2400, 4800, 9600]) {
        const w = new ContinuousWorld(seed, DEFAULT_CONTINUOUS_PARAMS, pool)
        w.run(duration)
        if (w.extinct) {
          console.log(`  ${pool}${String(seed).padStart(3)} | ${f(duration, 8)} | extinct`)
          continue
        }
        const p = profile(`${pool}${seed}@${duration}`, w)
        console.log(
          `  ${pool}${String(seed).padStart(3)} | ${f(duration, 8)} | ${f(p.arr)} ${f(
            p.d[0],
          )} ${f(p.spread[0])} ${f(p.speed[0])} | ${f(p.strength, 4)} | ${p.variety} ${f(
            p.purity, 5,
          )}`,
        )
      }
    }
  }
})

it('phase B: pick Z, and the hue that ties it to W', () => {
  /**
   * Y = Q14@4800 sits at hue 25. Z has to flee clearly, be cleanly 2a, and wear
   * a colour far from Y's -- then pool P's founder hue is shifted so W and X
   * land on Z's. That is the coincidence: a colour shared across both founder
   * pools, while the two populations that actually share ancestry (Y and Z) look
   * nothing alike.
   */
  const Y_HUE = 25.30
  const W_NATURAL: Record<number, number> = {}
  for (const dur of [3600]) {
    const base = new ContinuousWorld(8, DEFAULT_CONTINUOUS_PARAMS, 'P')
    base.run(dur - 600)
    for (const b of [103, 106]) {
      const branch = base.fork(b)
      branch.run(600)
      W_NATURAL[b] = profile(`P8@${dur}#${b}`, branch).hue
    }
  }
  console.log(`\nW natural hues: ${JSON.stringify(W_NATURAL)}`)

  console.log('\nZ candidates (pool Q, poison)')
  for (const dur of [2400, 4800]) {
    for (let seed = 1; seed <= 16; seed++) {
      const w = new ContinuousWorld(
        seed,
        { ...DEFAULT_CONTINUOUS_PARAMS, regime: 'poison' as const },
        'Q',
      )
      w.run(dur)
      if (w.extinct) continue
      const p = profile(`Zq${seed}@${dur}`, w)
      const gapY = Math.min(Math.abs(p.hue - Y_HUE), 360 - Math.abs(p.hue - Y_HUE))
      const shift = ((p.hue - W_NATURAL[103]) % 360 + 360) % 360
      console.log(
        `  Q${String(seed).padStart(2)}@${dur}: arr ${f(p.arr)} d ${f(p.d[0])} ${p.variety} ${f(
          p.purity, 4,
        )} | hue ${f(p.hue, 6)} | Y-Z gap ${f(gapY, 6)} | P shift ${f(shift, 6)}`,
      )
    }
  }
}, 1_800_000)

it('phase B: Z in a world with ambient food and dangerous lights', () => {
  console.log('\nambient | ext | pop | births | flees? d(centre) | variety purity | hue')
  for (const ambientIncome of [0.12, 0.18, 0.24, 0.32]) {
    for (const dur of [2400, 4800]) {
      let line = ''
      const rows: string[] = []
      for (const seed of [1, 2, 3, 4]) {
        const w = new ContinuousWorld(
          seed,
          {
            ...DEFAULT_CONTINUOUS_PARAMS,
            regime: 'poison' as const,
            energy: { baseCost: 0.05, moveCost: 0.06, ambientIncome },
          },
          'Q',
        )
        w.run(dur)
        if (w.extinct) { rows.push(`s${seed}:extinct`); continue }
        const p = profile(`Z${seed}`, w)
        rows.push(
          `s${seed}: d ${f(p.d[0], 5)} ${p.variety}${f(p.purity, 4)} hue ${f(p.hue, 6)}`,
        )
      }
      line = `${f(ambientIncome, 7)} @${dur} | ${rows.join(' | ')}`
      console.log(line)
    }
  }
}, 1_800_000)

it('phase B: why does the poison world die so fast', () => {
  const w = new ContinuousWorld(
    1,
    {
      ...DEFAULT_CONTINUOUS_PARAMS,
      regime: 'poison' as const,
      energy: { baseCost: 0.05, moveCost: 0.06, ambientIncome: 0.32 },
    },
    'Q',
  )
  console.log('\n t | pop | mean energy | min energy | starved | aged')
  for (let t = 0; t < 40; t++) {
    w.run(2)
    const es = w.creatures.map((c) => c.energy)
    console.log(
      `${f(w.time, 3)} | ${String(w.creatures.length).padStart(3)} | ${f(
        es.length ? es.reduce((a, b) => a + b, 0) / es.length : 0,
      )} | ${f(es.length ? Math.min(...es) : 0)} | ${String(w.starved).padStart(3)} | ${String(
        w.diedOfAge,
      ).padStart(3)}`,
    )
    if (w.extinct) { console.log('  extinct'); break }
  }
})

it('phase B: how much ambient food does a poison world need', () => {
  console.log('\nambient lights | survivors/4 | pop | d(centre) | variety purity | hue')
  for (const ambientIncome of [0.4, 0.6, 0.8, 1.2]) {
    for (const count of [2, 4]) {
      const rows: string[] = []
      let alive = 0
      for (const seed of [1, 2, 3, 4]) {
        const w = new ContinuousWorld(
          seed,
          {
            ...DEFAULT_CONTINUOUS_PARAMS,
            regime: 'poison' as const,
            energy: { baseCost: 0.05, moveCost: 0.06, ambientIncome },
            food: { ...DEFAULT_CONTINUOUS_PARAMS.food, count },
          },
          'Q',
        )
        w.run(2400)
        if (w.extinct) { rows.push(`s${seed}:dead`); continue }
        alive++
        const p = profile(`Z${seed}`, w)
        rows.push(`s${seed}: d ${f(p.d[0], 5)} ${p.variety}${f(p.purity, 4)} h${f(p.hue, 5)}`)
      }
      console.log(`${f(ambientIncome, 7)} ${f(count, 6)} | ${alive}/4 | ${rows.join(' | ')}`)
    }
  }
}, 1_800_000)

it('phase B: two candidate provenances for Z', () => {
  const approachers = { arr: 12.3, d: 2.08 } // the chosen W/X/Y triple
  const show = (label: string, w: ContinuousWorld) => {
    if (w.extinct) { console.log(`  ${label}: extinct`); return }
    const p = profile(label, w)
    console.log(
      `  ${label.padEnd(34)} arr ${f(p.arr)} d ${f(p.d[0])} (${f(
        p.d[0] / approachers.d, 4,
      )}x the approachers) | ${p.variety} ${f(p.purity, 4)} | |w| ${f(p.strength, 4)} | hue ${f(
        p.hue, 6,
      )}`,
    )
  }

  console.log('\nOption 1 — Z evolved in a poison world (ambient food, dangerous lights)')
  for (const [ambient, count, seed, dur] of [
    [0.4, 2, 4, 2400], [0.4, 2, 2, 4800], [0.6, 2, 2, 4800], [0.4, 2, 4, 4800],
  ] as const) {
    const w = new ContinuousWorld(
      seed,
      {
        ...DEFAULT_CONTINUOUS_PARAMS,
        regime: 'poison' as const,
        energy: { baseCost: 0.05, moveCost: 0.06, ambientIncome: ambient },
        food: { ...DEFAULT_CONTINUOUS_PARAMS.food, count },
      },
      'Q',
    )
    w.run(dur)
    show(`poison a=${ambient} n=${count} seed ${seed}@${dur}`, w)
  }

  console.log('\nOption 2 — Z from pool Q in the *same* food world as Y, never adapted')
  for (const [seed, dur] of [[7, 2400], [7, 4800], [7, 9600], [2, 4800], [5, 4800], [9, 4800]] as const) {
    const w = new ContinuousWorld(seed, DEFAULT_CONTINUOUS_PARAMS, 'Q')
    w.run(dur)
    show(`food seed ${seed}@${dur}`, w)
  }
}, 1_800_000)

it('phase B redo: Z under drifting food', () => {
  /**
   * Y is now Q2@4800 at hue 74.4, and W/X are P7@2400 branches at hue ~192.
   * Z needs to flee clearly, be cleanly 2a, and wear a colour far from Y's --
   * then pool P's founder hue is shifted so W and X land on Z's.
   *
   * Its world still needs ambient food: poison alone means negative intake only,
   * so nothing can ever reach the reproduction threshold.
   */
  const Y_HUE = 74.37
  const W_NATURAL = 192.04
  const approachers = 1.46 // mean distance of the chosen W/X/Y triple
  console.log('\nambient count seed dur | arr    d     xApproach | variety purity | hue | Y-Z gap | P shift')
  for (const ambientIncome of [0.4, 0.6]) {
    for (const count of [2, 4]) {
      for (const seed of [1, 2, 3, 4, 5, 6]) {
        const w = new ContinuousWorld(
          seed,
          {
            ...DEFAULT_CONTINUOUS_PARAMS,
            regime: 'poison' as const,
            energy: { baseCost: 0.05, moveCost: 0.06, ambientIncome },
            food: { ...DEFAULT_CONTINUOUS_PARAMS.food, count },
          },
          'Q',
        )
        w.run(4800)
        if (w.extinct) continue
        const p = profile(`Z${seed}`, w)
        if (p.variety !== '2a' || p.purity < 0.7) continue
        const gap = Math.min(Math.abs(p.hue - Y_HUE), 360 - Math.abs(p.hue - Y_HUE))
        const shift = ((p.hue - W_NATURAL) % 360 + 360) % 360
        console.log(
          `${f(ambientIncome, 7)} ${f(count, 5)} ${f(seed, 4)} 4800 | ${f(p.arr)} ${f(
            p.d[0], 5,
          )} ${f(p.d[0] / approachers, 9)} | ${p.variety} ${f(p.purity, 5)} | ${f(
            p.hue, 6,
          )} | ${f(gap, 7)} | ${f(shift, 7)}`,
        )
      }
    }
  }
}, 1_800_000)
