import { it } from 'vitest'
import { VehicleWorld, DEFAULT_WORLD_PARAMS } from './world'
import { genomeToWeights, type Genome } from '../creature/genome'
import { LINEAGE_DATA } from './lineageData'

const f = (n: number, w = 6) => n.toFixed(2).padStart(w)

/** One vehicle, one centre light, watched for 40 s. */
function trace(g: Genome, lightStrength = 4, startD = 5) {
  const w = new VehicleWorld({ ...DEFAULT_WORLD_PARAMS })
  w.addSource(0, 0.7, 0, lightStrength)
  const v = w.addWeightedVehicle(genomeToWeights(g), '#fff', {
    x: startD, z: 0, heading: Math.PI, // aimed straight at the light
  })
  const rows: { t: number; d: number; speed: number }[] = []
  for (let i = 0; i < 40 * 30; i++) {
    w.step(1 / 30)
    const t = (i + 1) / 30
    if (Math.abs(t * 4 - Math.round(t * 4)) < 1e-9 && Math.round(t * 4) % 20 === 0) {
      rows.push({
        t,
        d: Math.hypot(v.state.x, v.state.z),
        speed: (v.actuators.left + v.actuators.right) / 2,
      })
    }
  }
  // Behaviour over the last 10 s: is it at rest, circling, or oscillating?
  const tail: number[] = []
  for (let i = 0; i < 10 * 30; i++) {
    w.step(1 / 30)
    tail.push(Math.hypot(v.state.x, v.state.z))
  }
  const mean = tail.reduce((a, b) => a + b, 0) / tail.length
  const sd = Math.sqrt(tail.reduce((a, b) => a + (b - mean) ** 2, 0) / tail.length)
  const finalSpeed = Math.abs((v.actuators.left + v.actuators.right) / 2)
  return { rows, mean, sd, finalSpeed }
}

const show = (label: string, g: Genome, strength = 4) => {
  const r = trace(g, strength)
  console.log(
    `\n${label}  (light strength ${strength})\n  ` +
      r.rows.map((x) => `t=${x.t.toFixed(0)}s d=${f(x.d, 4)} v=${f(x.speed, 5)}`).join('\n  '),
  )
  const verdict =
    r.finalSpeed < 0.08 && r.sd < 0.15 ? 'AT REST'
    : r.sd < 0.3 ? 'holding a steady distance (circling or hovering)'
    : 'oscillating in and out'
  console.log(`  last 10s: mean d ${f(r.mean)} sd ${f(r.sd)} final |v| ${f(r.finalSpeed)} -> ${verdict}`)
}

it('do vehicles ever come to rest at a light', () => {
  show('textbook 3a  (ipsi inhibitory, w=-2, bias 1.2)',
    { wLL: -2, wLR: 0, wRL: 0, wRR: -2, bias: 1.2, hue: 0 })
  show('weak 3a      (w=-0.4, bias 1.2)',
    { wLL: -0.4, wLR: 0, wRL: 0, wRR: -0.4, bias: 1.2, hue: 0 })
  show('textbook 2b  (contra excitatory, w=+2, bias 0.6)',
    { wLL: 0, wLR: 2, wRL: 2, wRR: 0, bias: 0.6, hue: 0 })
  show('no wiring    (all w=0, bias 0.6)',
    { wLL: 0, wLR: 0, wRL: 0, wRR: 0, bias: 0.6, hue: 0 })

  // And the real evolved populations, mean genome of each.
  for (const fx of LINEAGE_DATA) {
    const n = fx.genomes.length
    const m = (pick: (g: Genome) => number) => fx.genomes.reduce((a, g) => a + pick(g), 0) / n
    show(`fixture ${fx.id} (mean genome)`, {
      wLL: m((g) => g.wLL), wLR: m((g) => g.wLR),
      wRL: m((g) => g.wRL), wRR: m((g) => g.wRR),
      bias: m((g) => g.bias), hue: 0,
    })
  }
})
