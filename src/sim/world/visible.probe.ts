/**
 * What does a *viewer* see, as opposed to what the separability test measures?
 *
 * Jon reports Y as visibly distinct from W and X in the default world, which the
 * acceptance test says should not be possible. The test measures time to
 * arrival, mean distance, spread of distance and mean speed. This measures the
 * things it does not: whether a creature drives backwards, how sharply it turns,
 * how much of the run it spends stopped, and whether it holds station or circles.
 */
import { it } from 'vitest'
import { CONTINUOUS_LINEAGE_DATA } from './continuousLineageData'
import { VehicleWorld, DEFAULT_WORLD_PARAMS } from './world'
import { ContinuousWorld, DEFAULT_CONTINUOUS_PARAMS } from './continuousWorld'
import { nearestVariety } from '../creature/genome'
import { genomeToWeights, type Genome } from '../creature/genome'
import { observe, CENTRE_LIGHT } from './observation'
import { OBSERVE_OPTS } from './separability'

const f = (n: number, w = 7) => n.toFixed(2).padStart(w)

function watch(genomes: Genome[]) {
  const w = new VehicleWorld({ ...DEFAULT_WORLD_PARAMS })
  w.addSource(0, 0.7, 0, 4)
  const n = genomes.length
  genomes.forEach((g, i) => {
    const a = (i / n) * Math.PI * 2
    const r = DEFAULT_WORLD_PARAMS.bounds * 0.3
    w.addWeightedVehicle(genomeToWeights(g), '#fff', {
      x: Math.cos(a) * r,
      z: Math.sin(a) * r,
      heading: a + Math.PI / 2,
    })
  })

  let samples = 0
  let signedSpeed = 0
  let reverseTime = 0
  let stoppedTime = 0
  let turnRate = 0
  let nearTime = 0
  const prevHeading = w.vehicles.map((v) => v.state.heading)

  for (let i = 0; i < 30 * 30; i++) {
    w.step(1 / 30)
    samples++
    w.vehicles.forEach((v, k) => {
      const s = (v.actuators.left + v.actuators.right) / 2
      signedSpeed += s
      if (s < -0.05) reverseTime++
      if (Math.abs(s) < 0.08) stoppedTime++
      let d = v.state.heading - prevHeading[k]
      while (d > Math.PI) d -= 2 * Math.PI
      while (d < -Math.PI) d += 2 * Math.PI
      turnRate += Math.abs(d) * 30
      prevHeading[k] = v.state.heading
      if (Math.hypot(v.state.x, v.state.z) < 2.5) nearTime++
    })
  }
  const total = samples * n
  return {
    signedSpeed: signedSpeed / total,
    reverse: reverseTime / total,
    stopped: stoppedTime / total,
    turn: turnRate / total,
    near: nearTime / total,
  }
}

it('what a viewer actually sees', () => {
  console.log(
    '\n id | signed speed | % in reverse | % stopped | turn rate | % within 2.5 of the light',
  )
  for (const fx of CONTINUOUS_LINEAGE_DATA) {
    const r = watch(fx.genomes)
    console.log(
      `  ${fx.id} | ${f(r.signedSpeed, 12)} | ${f(r.reverse * 100, 12)} | ${f(
        r.stopped * 100, 9,
      )} | ${f(r.turn, 9)} | ${f(r.near * 100, 25)}`,
    )
  }
})

it('is a non-reversing 3a population even possible', () => {
  /**
   * An inhibitory approacher reverses whenever it is closer than the distance at
   * which bias + w.intensity crosses zero. So how much of the run it spends
   * backing up is set by the ratio of bias to inhibition: weak inhibition and a
   * strong resting drive put that equilibrium close to the light, and the
   * creature spends its time outside it, going forwards.
   */
  console.log('\npool Q under food — every run that reached 3a, and whether it reverses')
  /**
   * `arrived` and `meanDist` are here because their absence is what put Q16@2400
   * forward as the one live candidate. The table used to report signed speed and
   * reverse fraction only, and neither of those can say whether a creature *goes
   * anywhere* — Q16 scored +0.15 and 16% because it is too weakly wired to move
   * much in any direction. Measured on approach it sits at 0.08 arrived and 4.54
   * mean distance, which is Z's behaviour, not an approacher's. Same failure as
   * the absolute-speed metric, one level up: a summary that cannot see the thing
   * the criterion is about.
   */
  console.log('  seed  dur | variety purity | mean bias  mean |w| | signed speed | % reverse | arrived | meanDist')
  for (const dur of [2400, 4800]) {
    for (let seed = 1; seed <= 30; seed++) {
      const w = new ContinuousWorld(seed, DEFAULT_CONTINUOUS_PARAMS, 'Q')
      w.run(dur)
      if (w.extinct) continue
      const g = w.creatures.map((c) => c.genome)
      const counts: Record<string, number> = {}
      for (const x of g) {
        const v = nearestVariety(x).split(' ')[0]
        counts[v] = (counts[v] ?? 0) + 1
      }
      const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
      if (top[0] !== '3a' || top[1] / g.length < 0.6) continue
      const r = watch(g)
      const bias = g.reduce((a, x) => a + x.bias, 0) / g.length
      const mag =
        g.reduce((a, x) => a + (Math.abs(x.wLL) + Math.abs(x.wLR) + Math.abs(x.wRL) + Math.abs(x.wRR)) / 4, 0) /
        g.length
      const o = observe(g, CENTRE_LIGHT, OBSERVE_OPTS)
      console.log(
        `  Q${String(seed).padStart(2)} ${dur} | 3a ${f(top[1] / g.length, 6)} | ${f(
          bias, 9,
        )} ${f(mag, 9)} | ${f(r.signedSpeed, 12)} | ${f(r.reverse * 100, 9)} | ${f(
          o.arrivedFraction, 7,
        )} | ${f(o.meanDistance, 8)}`,
      )
    }
  }
}, 900_000)
