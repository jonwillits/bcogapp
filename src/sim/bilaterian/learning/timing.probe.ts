import { it } from 'vitest'
import { LearningDish } from './learningDish'
import { LEARNING_SCENARIOS } from './scenarios'

/**
 * Every synchronous path a click or a frame can reach, timed. The rule in
 * `APP_DESIGN.md`: take the number on the development Mac, multiply by four,
 * and anything over about 300 ms on a click path is a freeze.
 *
 *   PROBE=1 PROBE_DIR=src/sim/bilaterian/learning npx vitest run --disable-console-intercept -t "timing"
 */
const ms = (fn: () => void, n = 1) => {
  const t0 = performance.now()
  for (let i = 0; i < n; i++) fn()
  return (performance.now() - t0) / n
}

it('timing', () => {
  for (const s of LEARNING_SCENARIOS) {
    let w = new LearningDish(1, s)
    const build = ms(() => { w = new LearningDish(1, s) }, 20)
    w.run(120)
    const step = ms(() => w.step(1 / 30), 3000)
    // One frame at the top of the speed control: 8 × 0.05 s = 0.4 s of simulation, 12 steps.
    const frame = ms(() => { for (let k = 0; k < 12; k++) w.step(1 / 30) }, 200)
    const phase = ms(() => w.setPhase((w.phase + 1) % (s.learning.phases?.length ?? 1)), 50)
    const relay = ms(() => w.layOutSites(), 50)
    const response = ms(() => w.responseToCue(), 2000)
    console.log(`${s.key.padEnd(13)} build ${build.toFixed(2)} ms · step ${step.toFixed(3)} ms · frame at 8× ${frame.toFixed(2)} ms · phase change ${phase.toFixed(2)} ms · lay out sites ${relay.toFixed(2)} ms · response ${response.toFixed(4)} ms`)
  }
})
