import { it } from 'vitest'
import { NeuronWorld } from './neuronWorld'
import { HEALTHY_SCENARIO, DIAGNOSTIC_CELLS, WORLD_SPEEDS, type Scenario } from './cells'
import { measureThreshold, measureCeiling, measureVelocity } from './measure'
import { INSTANT_RECOVERY } from './unitRanges'
import { wheelSpeeds } from '../creature/vehicle'

/**
 * A crib sheet for watching the scene at localhost:5173 — what a person
 * should expect to see, as counts, times and kinds, so that looking is a
 * check against predictions rather than an impression. Nothing headless can
 * see motion; this prints what the motion should be.
 *
 *   PROBE=1 PROBE_DIR=src/sim/neuron npx vitest run --disable-console-intercept -t "crib"
 */

function kinds(scenario: Scenario, seed: number, seconds = 120, warm = 0) {
  const w = new NeuronWorld(seed, scenario)
  if (warm > 0) w.run(warm)
  const before = w.lightsCollected
  let stopped = 0
  let steps = 0
  let speedSum = 0
  let turnSum = 0
  let backwards = 0
  const dt = 1 / 30
  for (let i = 0; i < seconds * 30; i++) {
    w.step(dt)
    const ws = wheelSpeeds(w.vehicle.actuators, w.vehicle.config)
    const sp = (ws.left + ws.right) / 2
    speedSum += sp
    turnSum += Math.abs(ws.left - ws.right)
    if (Math.abs(sp) < 0.2) stopped++
    if (sp < -0.2) backwards++
    steps++
  }
  return {
    perMin: ((w.lightsCollected - before) / seconds) * 60,
    speed: speedSum / steps,
    turn: turnSum / steps,
    stopped: stopped / steps,
    backwards: backwards / steps,
    rate: w.cell.outputRate(),
    eNa: w.cell.readout().eNa,
  }
}

function describe(k: ReturnType<typeof kinds>): string {
  const parts: string[] = []
  if (k.stopped > 0.8) parts.push('parked most of the time')
  else if (k.stopped > 0.5) parts.push('stopped about half the time')
  else parts.push('mostly moving')
  if (k.speed > 0.7) parts.push('cruises briskly')
  else if (k.speed > 0.3) parts.push('crawls')
  else parts.push('barely moves')
  if (k.turn > 0.7) parts.push('swings toward lights')
  else if (k.turn > 0.3) parts.push('turns a little')
  else parts.push('drives straight')
  if (k.backwards > 0.1) parts.push('reverses sometimes')
  return parts.join(', ')
}

it('crib: what the five cells should look like', () => {
  console.log('')
  console.log('=== The cell (Membrane tab) ===')
  console.log(`threshold, measured        ${measureThreshold().toFixed(1)} mV   (the reading says about −50)`)
  console.log(`ceiling, healthy           ${measureCeiling()} spikes/s`)
  console.log(`ceiling, instant recovery  ${measureCeiling({ hRecovery: INSTANT_RECOVERY })} spikes/s   (off the top of the Unit tab's plot)`)
  console.log(`conduction, unmyelinated   ${measureVelocity().velocity?.toFixed(2)} m/s   · myelin ${measureVelocity({ myelin: true }).velocity?.toFixed(1)} m/s`)
  console.log('A spike on the trace: rest −65, peak about +40, about a millisecond wide, a dip to −75 after.')
  console.log('Gates in order: m up first (green), h down during the spike (red), n up late and down late (blue).')
  console.log('Pump off, real time: rest creeps up, spikes shrink to half within a minute, gone by ninety seconds, ATP/s reads 0.')
  console.log('')
  console.log('=== The world, fast world, three lights, two minutes from a cold start ===')
  const seeds = [1, 2, 3]
  const summarise = (label: string, sc: Scenario, warm = 0) => {
    const ks = seeds.map((s) => kinds(sc, s, 120, warm))
    const mean = (f: (k: ReturnType<typeof kinds>) => number) => ks.reduce((a, k) => a + f(k), 0) / ks.length
    const m = {
      perMin: mean((k) => k.perMin),
      speed: mean((k) => k.speed),
      turn: mean((k) => k.turn),
      stopped: mean((k) => k.stopped),
      backwards: mean((k) => k.backwards),
      rate: mean((k) => k.rate),
      eNa: mean((k) => k.eNa),
    }
    console.log(
      `${label.padEnd(9)} lights/min ${m.perMin.toFixed(1).padStart(4)} [${ks.map((k) => k.perMin.toFixed(1)).join(' ')}]  E_Na ${m.eNa.toFixed(0)} mV  · ${describe(m)}`,
    )
  }
  summarise('healthy', HEALTHY_SCENARIO)
  for (const c of DIAGNOSTIC_CELLS) summarise(c.id, c.scenario, 45)
  console.log('')
  console.log('Slow world (0.5 u/s), the N1 test:')
  for (const id of ['N1', 'N2', 'N3', 'N4']) {
    const sc = DIAGNOSTIC_CELLS.find((c) => c.id === id)!.scenario
    summarise(id, { ...sc, world: { ...sc.world, lightSpeed: WORLD_SPEEDS.slow } }, 45)
  }
  console.log('')
  console.log('What should NOT happen: no vehicle leaves the arena; no light passes through a vehicle;')
  console.log('the vehicle never changes size when the body-size slider moves; a chemical vehicle never turns sharply;')
  console.log('the Unit tab never says dendrite/soma/axon/synapse; nothing anywhere is called an activation function.')
}, 1_800_000)
