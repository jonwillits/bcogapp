/**
 * Is there a world in which W and X come apart?
 *
 * They are sisters — the same run to 1800 s, then separate streams — and Jon
 * cannot sort them in the default world. That is what makes them the battery's
 * calibration point. But "indistinguishable" is a property of the world you are
 * watching them in, not of the populations, and if some world separates them
 * then Part 3 gets a manipulation a student can perform and be asked to explain.
 *
 * The bar is deliberately high. A separation only a statistic can see is worth
 * nothing here: it has to be something Jon can see, so candidates are ranked by
 * how far over the just-noticeable difference they go, not by how many measures
 * twitch. And anything that shows up under sensor noise has to survive a change
 * of seed, or it is one draw of a random stream rather than a fact about the
 * world.
 */
import { it } from 'vitest'
import { CONTINUOUS_LINEAGE_DATA } from './continuousLineageData'
import { observe, type Perturbation, type ObserveOptions } from './observation'
import { OBSERVE_OPTS, tells, MEASURES } from './separability'
import { crossing, meanWeight, genomeToWeights, type Genome } from '../creature/genome'
import { VehicleWorld, DEFAULT_WORLD_PARAMS } from './world'
import { makeRng } from '../random'

const byId = Object.fromEntries(CONTINUOUS_LINEAGE_DATA.map((f) => [f.id, f]))
const f = (n: number, w = 6, d = 2) => n.toFixed(d).padStart(w)

interface World {
  label: string
  perturbation: Perturbation
  opts: ObserveOptions
}

/**
 * Worlds a student can actually build in the Lineages tab.
 *
 * This restriction is the point rather than a detail. The tab gives them three
 * instruments: left-click adds a light, right-click removes the nearest, and a
 * sensor-noise slider. **Light strength is not a control** — `addSource` is
 * hard-coded to 4 — so a world at strength 2 or 8 is not something a student can
 * reach, however well it separates the sisters. Sweeping worlds nobody can make
 * would be the same mistake as measuring behaviour nobody can see, one level up.
 *
 * A light dropped on the hillside outside the arena sits up on the rim, so
 * raised lights are available; strengths other than 4 are not.
 */
const S = 4
const FLOOR = 0.7
const RIM = 1.7

function worlds(): World[] {
  const out: World[] = []
  const at = (x: number, z: number, y = FLOOR): [number, number, number] => [x, y, z]
  const add = (label: string, lights: [number, number, number][], extra: Partial<Perturbation> = {}, opts: ObserveOptions = {}) =>
    out.push({ label, perturbation: { label, lights, ...extra }, opts: { lightStrength: S, ...opts } })

  // One light, moved off centre: remove the default and place another.
  for (const r of [0, 1, 2, 3, 4, 5, 6, 7, 8]) add(`one light at ${r}`, [at(r, 0)])

  // The default light plus one they add.
  for (const r of [2, 3, 4, 5, 6, 7, 8]) add(`centre + light at ${r}`, [at(0, 0), at(r, 0)])

  // Two placed lights, the default removed.
  for (const r of [2, 3, 4.5, 6, 7.5]) add(`two lights +-${r}`, [at(-r, 0), at(r, 0)])

  // Three and four.
  add('three in a triangle', [at(0, 6), at(-5.2, -3), at(5.2, -3)])
  add('three, close', [at(0, 2.5), at(-2.2, -1.2), at(2.2, -1.2)])
  add('four at the corners', [at(-5, -5), at(5, -5), at(-5, 5), at(5, 5)])

  // Lights up on the rim.
  for (const r of [6, 7.5, 9]) add(`rim light at ${r}`, [at(0, r, RIM)])
  add('two rim lights', [at(-7.5, 0, RIM), at(7.5, 0, RIM)])
  add('centre + rim light', [at(0, 0), at(0, 7.5, RIM)])

  // The noise slider, alone and with a placed light.
  for (const n of [0.1, 0.2, 0.3, 0.45, 0.6]) add(`noise ${n}`, [at(0, 0)], { sensorNoise: n })
  for (const n of [0.2, 0.45]) add(`noise ${n} + light at 5`, [at(5, 0)], { sensorNoise: n })
  for (const n of [0.2, 0.45]) add(`noise ${n} + two lights`, [at(-6, 0), at(6, 0)], { sensorNoise: n })

  // Removing the light partway, which they can do by right-clicking mid-run.
  for (const t of [2, 5, 10]) add(`light removed at ${t}s`, [at(0, 0)], { removeAt: { index: 0, time: t } })

  // Watching for longer, which costs nothing.
  for (const d of [60, 120]) add(`run for ${d}s`, [at(0, 0)], {}, { duration: d })

  return out
}

const score = (w: World, seed = 1) => {
  const o = (id: string) =>
    observe(byId[id].genomes, w.perturbation, { ...OBSERVE_OPTS, ...w.opts, seed })
  const pops = [
    { id: 'W', observation: o('W') },
    { id: 'X', observation: o('X') },
  ]
  const t = tells(pops)
  return {
    pops,
    tells: t,
    // How far the worst offender goes past the threshold of visibility.
    over: t.reduce((a, g) => Math.max(a, g.gap / g.measure.jnd), 0),
  }
}

it('sweep: where do the sisters come apart', () => {
  const rows = worlds().map((w) => ({ w, ...score(w) }))
  rows.sort((a, b) => b.over - a.over)

  console.log('\nWorlds where W and X are tellable apart, most visible first.')
  console.log('"over" is how far past the just-noticeable difference the worst measure goes.')
  console.log('\n  over | tells | world                      | W/X arrived | W/X meanDist')
  console.log('  ' + '-'.repeat(88))
  for (const r of rows.filter((x) => x.tells.length > 0).slice(0, 18)) {
    const [w, x] = r.pops
    console.log(
      `  ${f(r.over, 4, 1)} | ${String(r.tells.length).padStart(5)} | ${r.w.label.padEnd(26)} | ` +
        `${f(w.observation.arrivedFraction, 4)} ${f(x.observation.arrivedFraction, 4)}   | ` +
        `${f(w.observation.meanDistance, 5)} ${f(x.observation.meanDistance, 5)}`,
    )
    for (const g of r.tells)
      console.log(
        `       └─ ${g.measure.key} ${g.gap.toFixed(3)} vs jnd ${g.measure.jnd} — ${g.measure.visible}`,
      )
  }

  const silent = rows.filter((x) => x.tells.length === 0)
  console.log(`\n${silent.length} of ${rows.length} worlds leave them indistinguishable.`)
  console.log('default world is among them:', score(worlds()[8]).tells.length === 0)
}, 900_000)

it('robustness: do the winners survive a nudge to the world', () => {
  /**
   * Varying the seed is not the right check for most of these. Sensor noise is
   * the only stochastic element in `observe`, so a world without noise is fully
   * deterministic and five seeds give five identical answers.
   *
   * The fragility that actually threatens these candidates is geometric: the
   * sixteen creatures start on a fixed ring at fixed angles, so a light placed
   * at exactly one spot can separate two populations through which individuals
   * happen to be pointing at it, rather than through anything about how they are
   * wired. A separation worth building a lab exercise on has to survive the
   * light being somewhere slightly different and the ring being slightly bigger.
   * So each candidate is re-scored under nine nudges of its own world.
   */
  const NUDGES: { label: string; opts: ObserveOptions; dx: number; dz: number }[] = []
  for (const [dx, dz] of [[0, 0], [0.6, 0], [-0.6, 0], [0, 0.6], [0, -0.6]])
    NUDGES.push({ label: `light${dx}${dz}`, opts: {}, dx, dz })
  for (const r of [0.26, 0.34])
    NUDGES.push({ label: `ring ${r}`, opts: { startRadius: r }, dx: 0, dz: 0 })
  for (const n of [0.02, 0.05])
    NUDGES.push({ label: `noise ${n}`, opts: {}, dx: 0, dz: 0 })

  const rows = worlds().map((w) => ({ w, ...score(w) }))
  rows.sort((a, b) => b.over - a.over)
  const top = rows.filter((x) => x.tells.length > 0).slice(0, 8)

  console.log('\nEach candidate re-scored under nine nudges to its own world.')
  console.log('A candidate is only usable if it separates them under all of them.')

  for (const r of top) {
    const results = NUDGES.map((nudge, i) => {
      const lights = r.w.perturbation.lights.map(
        ([x, y, z]) => [x + nudge.dx, y, z + nudge.dz] as [number, number, number],
      )
      const perturbation = {
        ...r.w.perturbation,
        lights,
        sensorNoise:
          nudge.label.startsWith('noise')
            ? Number(nudge.label.split(' ')[1])
            : r.w.perturbation.sensorNoise,
      }
      return score(
        { label: r.w.label, perturbation, opts: { ...r.w.opts, ...nudge.opts } },
        i + 1,
      )
    })
    const held = results.filter((x) => x.tells.length > 0).length
    console.log(
      `\n  ${r.w.label.padEnd(26)} holds in ${held}/${results.length}  ` +
        `${held === results.length ? 'ROBUST' : 'FRAGILE'}`,
    )
    console.log('      over: ' + results.map((x) => f(x.over, 5, 1)).join(' '))
    const keys = new Set<string>()
    for (const x of results) for (const g of x.tells) keys.add(g.measure.key)
    console.log(
      '      measures: ' +
        [...keys]
          .map(
            (k) =>
              `${k} (${results.filter((x) => x.tells.some((g) => g.measure.key === k)).length}/${
                results.length
              })`,
          )
          .join(', '),
    )
  }
}, 900_000)

it('why: is the difference explainable from the wiring a student can reveal', () => {
  /**
   * A manipulation is only worth setting a student if the thing it exposes has
   * an answer they can find. W is 81% contralateral excitatory and X is 100% --
   * the one documented difference between the sisters. If the individuals that
   * fail to reach an off-centre light are W's odd fifth, "reveal the wiring"
   * answers the question the manipulation raises and the exercise closes.
   *
   * Each creature is run **alone, at its own position on the ring**. Passing a
   * one-genome array to `observe` does not do that: the ring angle is computed
   * from the array's length, so a population of one is placed at angle 0 --
   * which, with the light at (4, 0), starts it 1.3 units away and has every
   * creature "arrive" regardless of its wiring.
   */
  const LIGHT: [number, number] = [4, 0]

  const solo = (g: Genome, i: number, n: number) => {
    const w = new VehicleWorld({ ...DEFAULT_WORLD_PARAMS }, makeRng(1))
    w.addSource(LIGHT[0], 0.7, LIGHT[1], 4)
    const angle = (i / n) * Math.PI * 2
    const r = DEFAULT_WORLD_PARAMS.bounds * 0.3
    w.addWeightedVehicle(genomeToWeights(g), '#fff', {
      x: Math.cos(angle) * r,
      z: Math.sin(angle) * r,
      heading: angle + Math.PI / 2,
    })
    let closest = Infinity
    for (let k = 0; k < 30 * 30; k++) {
      w.step(1 / 30)
      const v = w.vehicles[0]
      closest = Math.min(closest, Math.hypot(v.state.x - LIGHT[0], v.state.z - LIGHT[1]))
    }
    return closest
  }

  for (const id of ['W', 'X']) {
    const genomes = byId[id].genomes
    const n = genomes.length
    console.log(`\n=== ${id}: each creature run alone, from its own start, light at (4, 0) ===`)
    console.log('  #  | crossing | mean w |  bias | closest | reached')
    const per = genomes.map((g, i) => ({ i, g, closest: solo(g, i, n) }))
    for (const p of per)
      console.log(
        `  ${String(p.i).padStart(2)} | ${f(crossing(p.g), 8)} | ${f(meanWeight(p.g), 6)} | ` +
          `${f(p.g.bias, 5)} | ${f(p.closest, 7)} | ${p.closest <= 1.5 ? 'yes' : 'no '}`,
      )
    const reached = per.filter((p) => p.closest <= 1.5)
    console.log(`  reached alone: ${reached.length}/${n}`)

    // Does reaching track any gene a student could read off the wiring panel?
    const corr = (pick: (g: Genome) => number) => {
      const xs = per.map((p) => pick(p.g))
      const ys = per.map((p) => (p.closest <= 1.5 ? 1 : 0))
      const mx = xs.reduce((a, b) => a + b, 0) / n
      const my = ys.reduce((a, b) => a + b, 0) / n
      const num = xs.reduce((a, x, k) => a + (x - mx) * (ys[k] - my), 0)
      const den = Math.sqrt(
        xs.reduce((a, x) => a + (x - mx) ** 2, 0) * ys.reduce((a, y) => a + (y - my) ** 2, 0),
      )
      return den > 1e-9 ? num / den : NaN
    }
    console.log(
      `  correlation of reaching with: crossing ${f(corr(crossing), 6)}  ` +
        `mean w ${f(corr(meanWeight), 6)}  bias ${f(corr((g) => g.bias), 6)}`,
    )
  }

  // And the crowd effect: the same populations together, which is what a student sees.
  console.log('\n=== together, which is what a student actually watches ===')
  for (const id of ['W', 'X']) {
    const o = observe(byId[id].genomes, { label: '', lights: [[4, 0.7, 0]] }, {
      ...OBSERVE_OPTS,
      lightStrength: 4,
    })
    console.log(
      `  ${id}: arrived ${f(o.arrivedFraction, 5)}  meanClosest ${f(o.meanClosest, 5)}  ` +
        `meanDist ${f(o.meanDistance, 5)}  arrival-t ${f(o.meanTimeToArrival, 5, 1)}`,
    )
  }
})

it('viewing protocol: does it hold at any angle, and for longer than 30s', () => {
  /**
   * Two things a probe can assume and a person watching cannot.
   *
   * Jon places the light by clicking the floor, so it lands at whatever angle he
   * clicks — not at (4, 0), which is where every measurement so far put it. The
   * sixteen start positions are a fixed ring with fixed headings, so the light's
   * angle relative to that ring is a real variable, not a relabelling.
   *
   * And he will watch for as long as it takes, not for exactly thirty seconds.
   * A gap that closes at sixty would make the protocol depend on stopping at the
   * right moment, which is not something to ask of a viewer.
   */
  const R = 4
  console.log('\n=== light at radius 4, swept around the ring (30s) ===')
  console.log('  angle |  W arrived  X arrived | W closest  X closest | separated')
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2
    const lights: [number, number, number][] = [[Math.cos(a) * R, 0.7, Math.sin(a) * R]]
    const o = (id: string) =>
      observe(byId[id].genomes, { label: '', lights }, { ...OBSERVE_OPTS, lightStrength: 4 })
    const w = o('W')
    const x = o('X')
    const t = tells([
      { id: 'W', observation: w },
      { id: 'X', observation: x },
    ])
    console.log(
      `  ${String(Math.round((a * 180) / Math.PI)).padStart(5)}° | ${f(w.arrivedFraction, 10)} ${f(
        x.arrivedFraction, 10,
      )} | ${f(w.meanClosest, 9)} ${f(x.meanClosest, 9)} | ` +
        (t.length ? `yes (${t.map((g) => g.measure.key).join(', ')})` : 'NO'),
    )
  }

  console.log('\n=== light at (4, 0), watched for longer ===')
  console.log('  duration |  W arrived  X arrived | W closest  X closest | separated')
  for (const duration of [15, 30, 45, 60, 90, 120]) {
    const lights: [number, number, number][] = [[4, 0.7, 0]]
    const o = (id: string) =>
      observe(byId[id].genomes, { label: '', lights }, { ...OBSERVE_OPTS, lightStrength: 4, duration })
    const w = o('W')
    const x = o('X')
    const t = tells([
      { id: 'W', observation: w },
      { id: 'X', observation: x },
    ])
    console.log(
      `  ${String(duration).padStart(8)}s | ${f(w.arrivedFraction, 10)} ${f(
        x.arrivedFraction, 10,
      )} | ${f(w.meanClosest, 9)} ${f(x.meanClosest, 9)} | ` +
        (t.length ? `yes (${t.map((g) => g.measure.key).join(', ')})` : 'NO'),
    )
  }
})

it('the honest robustness test: rotate the whole world, and watch for longer', () => {
  /**
   * The nudge test above was not good enough, and the light-at-4 candidate is
   * why. Nudging a light by 0.6 units tests whether a separation is *locally*
   * stable, and that one was — 9 of 9. Rotating the same light around the ring
   * shows the separation is angle-dependent: absent at half the angles, and at
   * 225 degrees it reverses, with W reaching the light more often than X. It was
   * never a fact about the two populations, only about where the light happened
   * to sit relative to sixteen fixed start positions.
   *
   * A student clicks wherever they click, and watches for as long as they like.
   * So the real test is: does the separation survive rotating the entire light
   * configuration around the arena, and does it survive being watched?
   */
  const rotate = (
    lights: readonly [number, number, number][],
    a: number,
  ): [number, number, number][] =>
    lights.map(([x, y, z]) => [
      x * Math.cos(a) - z * Math.sin(a),
      y,
      x * Math.sin(a) + z * Math.cos(a),
    ])

  const rows = worlds().map((w) => ({ w, ...score(w) }))
  rows.sort((a, b) => b.over - a.over)
  const top = rows.filter((x) => x.tells.length > 0).slice(0, 8)

  console.log('\n  world                      | separates at N of 8 angles | at 30s / at 90s | reverses?')
  console.log('  ' + '-'.repeat(92))
  for (const r of top) {
    const counts: Record<number, number> = { 30: 0, 90: 0 }
    let reverses = false
    for (const duration of [30, 90]) {
      for (let k = 0; k < 8; k++) {
        const lights = rotate(r.w.perturbation.lights, (k / 8) * Math.PI * 2)
        const o = (id: string) =>
          observe(byId[id].genomes, { ...r.w.perturbation, lights }, {
            ...OBSERVE_OPTS,
            ...r.w.opts,
            duration,
          })
        const w = o('W')
        const x = o('X')
        if (
          tells([
            { id: 'W', observation: w },
            { id: 'X', observation: x },
          ]).length
        )
          counts[duration]++
        // Does the direction of the difference flip between angles?
        if (duration === 30 && w.arrivedFraction > x.arrivedFraction + 0.1) reverses = true
      }
    }
    console.log(
      `  ${r.w.label.padEnd(26)} |            ${String(counts[30]).padStart(2)} of 8         | ` +
        `${String(counts[30]).padStart(2)}/8  ${String(counts[90]).padStart(2)}/8      | ` +
        (reverses ? 'YES — direction flips' : 'no'),
    )
  }
  console.log('\nA usable manipulation would separate them at 8 of 8 angles, at both durations,')
  console.log('and never in the opposite direction. Nothing here does.')
}, 900_000)
