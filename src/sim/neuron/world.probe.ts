import { it } from 'vitest'
import { NeuronWorld } from './neuronWorld'
import { HEALTHY_SCENARIO, DIAGNOSTIC_CELLS, type Scenario } from './cells'
import { wheelSpeeds } from '../creature/vehicle'

function trial(scenario: Scenario, seed: number, seconds = 180, warm = 0) {
  const w = new NeuronWorld(seed, scenario)
  if (warm > 0) w.run(warm)
  const before = w.lightsCollected
  const atp0 = w.atpTotal
  let stopped = 0, steps = 0, speedSum = 0, turnSum = 0
  const dt = 1 / 30
  for (let i = 0; i < seconds * 30; i++) {
    w.step(dt)
    const ws = wheelSpeeds(w.vehicle.actuators, w.vehicle.config)
    const sp = (ws.left + ws.right) / 2
    speedSum += sp
    turnSum += Math.abs(ws.left - ws.right)
    if (Math.abs(sp) < 0.2) stopped++
    steps++
  }
  const r = w.cell.readout()
  return {
    perMin: ((w.lightsCollected - before) / seconds) * 60,
    speed: speedSum / steps,
    turn: turnSum / steps,
    stopped: stopped / steps,
    atpPerLight: (w.atpTotal - atp0) / Math.max(1, w.lightsCollected - before),
    atpPerMin: ((w.atpTotal - atp0) / seconds) * 60,
    eNa: r.eNa,
  }
}
const f = (x: number) => x.toFixed(2)
function report(label: string, sc: Scenario, seeds: number[], warm = 0) {
  const rs = seeds.map((s) => trial(sc, s, 180, warm))
  const mean = (k: keyof ReturnType<typeof trial>) => rs.reduce((a, r) => a + r[k], 0) / rs.length
  console.log(label.padEnd(16), 'lights/min', f(mean('perMin')), '[' + rs.map((r) => f(r.perMin)).join(' ') + ']', 'speed', f(mean('speed')), 'turn', f(mean('turn')), 'stopped', f(mean('stopped')), 'atp/light', mean('atpPerLight').toExponential(2), 'atp/min', mean('atpPerMin').toExponential(2), 'eNa', f(mean('eNa')))
}
/**
 * The world sweep: lights per minute for the healthy vehicle and the five
 * cells over four seeds of three minutes, with the visible kinds — how fast it
 * moves, how much it turns, how often it is stopped — beside the number. The
 * acceptance tests in `neuronWorld.test.ts` are the two-seed, two-minute cut
 * of this.
 *
 *   PROBE=1 PROBE_DIR=src/sim/neuron npx vitest run --disable-console-intercept -t "world sweep"
 */
it('world sweep', () => {
  const seeds = [1, 2, 3, 4]
  report('healthy fast', HEALTHY_SCENARIO, seeds)
  for (const c of DIAGNOSTIC_CELLS) report(c.id, c.scenario, seeds, 45)
})

/** Candidate values for the two cells whose one parameter is a matter of degree. */
it('world variants', () => {
  const seeds = [1, 2, 3, 4]
  report('healthy fast', HEALTHY_SCENARIO, seeds)
  report('N1', DIAGNOSTIC_CELLS[1].scenario, seeds, 45)
  report('N2', DIAGNOSTIC_CELLS[2].scenario, seeds, 45)
  const n3 = DIAGNOSTIC_CELLS[3].scenario
  for (const pp of [0.2]) report(`N3 pump ${pp}`, { ...n3, cell: { ...n3.cell, pumpPower: pp } }, seeds, 45)
  const n4 = DIAGNOSTIC_CELLS[4].scenario
  for (const b0 of [-6, -10]) report(`N4 b0 ${b0}`, { ...n4, unit: { ...n4.unit, b0 } }, seeds, 45)
})
