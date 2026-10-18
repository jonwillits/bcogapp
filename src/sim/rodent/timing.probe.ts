import { it } from 'vitest'
import { RecordingSession } from './recording'
import { BOX_A } from './rooms'
import { HomingTrial, planBlock, runNavigators } from './homing'
import { RATS, runTest } from './rats'
import { DEFAULT_TEST } from './lab'
import { HABITATS, Night, NIGHT, tryEverySetting } from './patch'
import { RANGE } from './range'
import { angleDiff } from './spatial/angles'

/**
 * Every synchronous path a click or a frame can reach, timed
 * (`APP_DESIGN.md`, hard requirements). Multiply by four for a student
 * laptop; anything over about 300 ms on a click path is a freeze. Skips
 * are paid in slices on a timer (`SKIP_SLICE` in the scene's cells store:
 * 20 simulated seconds a slice), so the number that matters is one slice.
 *
 *   PROBE=1 PROBE_DIR=src/sim/rodent npx vitest run --disable-console-intercept -t "timing:"
 */
const say = (s: string) => console.log(`m09 timing · ${s}`)
const ms = (f: () => void, reps = 1) => {
  const t0 = performance.now()
  for (let i = 0; i < reps; i++) f()
  return (performance.now() - t0) / reps
}

it('timing: every click path and every frame', () => {
  say(`construct a recording session: ${ms(() => new RecordingSession(1, BOX_A), 5).toFixed(1)} ms`)
  const s = new RecordingSession(2, BOX_A)
  s.exploring = true
  s.run(60)
  say(`one sim step of Part 3 (rings, estimate, cells, maps): ${(ms(() => s.step(), 2000) * 1000).toFixed(0)} µs; one frame's six steps ${(ms(() => s.run(0.12), 50)).toFixed(2)} ms`)
  say(`one skip slice of 20 simulated seconds: ${ms(() => s.run(20), 5).toFixed(0)} ms; Skip ahead 2 minutes in all ${ms(() => s.run(120)).toFixed(0)} ms; 10 minutes ${ms(() => s.run(600)).toFixed(0)} ms`)
  say(`rendering the panel's maps: 16 rate maps ${ms(() => { for (const k of ['place0', 'place1', 'place2', 'place3', 'place4', 'place5', 'grid0-0', 'grid0-1', 'grid1-0', 'grid1-1', 'grid2-0', 'grid2-1', 'border0', 'border1', 'border2', 'border3']) s.maps.rateMap(k) }, 5).toFixed(1)} ms; eight head-direction tunings ${ms(() => { for (let i = 0; i < 8; i++) s.maps.hdTuning(`hd${i}`) }, 5).toFixed(2)} ms`)
  say(`a carry to another room: ${ms(() => s.carry(), 3).toFixed(1)} ms`)

  const plan = planBlock('dark', 3)[5]
  const t = new HomingTrial(plan, 3)
  let guard = 0
  const tStep = ms(() => {
    while (!t.done && guard++ < 20000) {
      const target = t.currentBeetle ?? RANGE.nest
      const want = Math.atan2(target.y - t.body.y, target.x - t.body.x)
      const d = angleDiff(t.body.heading, want)
      t.step(0.02, { forward: Math.abs(d) < 0.5 ? 1 : 0, turn: d > 0.05 ? 1 : d < -0.05 ? -1 : 0 })
      if (t.phase === 'return' && Math.hypot(t.body.x, t.body.y) < 0.5) t.here()
    }
  })
  say(`a whole four-leg homing trial, scripted (${t.record.steps.length} steps): ${tStep.toFixed(1)} ms; the four navigators on it: ${ms(() => runNavigators(t.record, 3), 5).toFixed(1)} ms`)

  for (const app of ['plus', 'water', 'paths'] as const) {
    say(`Run the test, ${app}, healthy rat, 8 trials: ${ms(() => runTest(RATS[0], { ...DEFAULT_TEST, apparatus: app }, 7), 5).toFixed(1)} ms`)
  }
  const night = new Night(HABITATS[0], 8, 1)
  say(`one night of ${NIGHT / 3600} hours at 0.1 s steps: ${ms(() => night.run(NIGHT)).toFixed(0)} ms; one slice of 15 simulated minutes ${ms(() => new Night(HABITATS[0], 8, 2).run(900), 5).toFixed(1)} ms`)
  say(`Try every setting, ten nights: ${ms(() => tryEverySetting(HABITATS[1], 5)).toFixed(0)} ms (paid one night per timer tick)`)
})
