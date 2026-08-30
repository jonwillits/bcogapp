import { it } from 'vitest'
import { EvolutionWorld } from './evolutionWorld'
import { observe, CENTRE_LIGHT, PERTURBATIONS } from './observation'
import { crossing, meanWeight, nearestVariety, type Genome } from '../creature/genome'

const f = (n: number, w = 6) => n.toFixed(2).padStart(w)
const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / (a.length || 1)
const opts = { startRadius: 0.3, lightStrength: 4, duration: 30 }
const g = (w: EvolutionWorld) => w.population.map((p) => p.genome)

function make(pSeed: number, split: number, branch: number, gens: number) {
  const base = new EvolutionWorld(pSeed, {}, 'P')
  base.run(split)
  const b = base.fork(branch)
  b.run(gens - split)
  return b
}
function q(seed: number, gens: number, regime: 'food' | 'poison' = 'food') {
  const w = new EvolutionWorld(seed, { regime }, 'Q')
  w.run(gens)
  return w
}

function report(label: string, W: Genome[], X: Genome[], Y: Genome[]) {
  console.log(`\n=== ${label}`)
  for (const [n, pop] of [['W', W], ['X', X], ['Y', Y]] as const) {
    const varieties: Record<string, number> = {}
    for (const x of pop) {
      const v = nearestVariety(x).split(' ')[0]
      varieties[v] = (varieties[v] ?? 0) + 1
    }
    const top = Object.entries(varieties).sort((a, b) => b[1] - a[1])
    console.log(
      `  ${n}: crossing ${f(mean(pop.map(crossing)))} sign ${f(
        mean(pop.map(meanWeight)),
      )} |w| ${f(
        mean(pop.map((x) => (Math.abs(x.wLL) + Math.abs(x.wLR) + Math.abs(x.wRL) + Math.abs(x.wRR)) / 4)),
      )} | purity ${f(top[0][1] / pop.length)} ${JSON.stringify(varieties)}`,
    )
  }
  const ratio = (a: number, b: number) => Math.max(a, b) / Math.max(0.02, Math.min(a, b))
  const worlds = [CENTRE_LIGHT, ...PERTURBATIONS]
  console.log('  world                          | Wsp Xsp Ysp | Wv  Xv  Yv  | spreadR speedR')
  for (const world of worlds) {
    const [ow, ox, oy] = [W, X, Y].map((p) => observe(p, world, opts))
    const sr = ratio((ow.meanDistanceSpread + ox.meanDistanceSpread) / 2, oy.meanDistanceSpread)
    const vr = ratio((ow.meanSpeed + ox.meanSpeed) / 2, oy.meanSpeed)
    console.log(
      `  ${world.label.padEnd(30)} | ${f(ow.meanDistanceSpread, 3)} ${f(
        ox.meanDistanceSpread, 3,
      )} ${f(oy.meanDistanceSpread, 3)} | ${f(ow.meanSpeed, 3)} ${f(ox.meanSpeed, 3)} ${f(
        oy.meanSpeed, 3,
      )} | ${f(sr)} ${f(vr)}`,
    )
  }
}

it('compare the two candidate fixture sets', () => {
  report(
    'candidate A — P4@120 #105/#108, Q23@120 (clean wiring, speed ratio 1.51)',
    g(make(4, 90, 105, 120)), g(make(4, 90, 108, 120)), g(q(23, 120)),
  )
  report(
    'candidate B — P1@90 #105/#107, Q15@90 (two perturbations at 2x)',
    g(make(1, 60, 105, 90)), g(make(1, 60, 107, 90)), g(q(15, 90)),
  )
})
