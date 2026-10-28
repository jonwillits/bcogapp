import { it } from 'vitest'
import { makeRng } from '../../random'
import { planFor } from '../logs/week'
import { FORAGERS, runForagerWeek, trainedSlowLearner } from './foragers'
import { SlowLearner, YOUTH_PASSES, SEASON_PASSES, oldPatterns, newPatterns, trainInterleaved } from './slow'
import { SeparationStage, FastStore, nightInput } from './store'
import { THINGS } from './world'

/**
 * Every synchronous path a click can reach in Part 5, timed. Multiply by
 * four for a student laptop; anything over about 300 ms on a click path is
 * paid down in slices.
 *
 *   PROBE=1 PROBE_DIR=src/sim/memory/foragers npx vitest run --disable-console-intercept -t "timing:"
 */
const say = (s: string) => console.log(`m10 timing · ${s}`)
const ms = (f: () => void, reps = 1) => {
  const t0 = performance.now()
  for (let i = 0; i < reps; i++) f()
  return (performance.now() - t0) / reps
}

it('timing: Part 5', () => {
  const { plan, clearing } = planFor(1000)
  say(`the slow learner’s youth, ${YOUTH_PASSES} passes of 24 patterns: ${ms(() => { const rng = makeRng(1); const n = new SlowLearner(rng.fork()); trainInterleaved(n, oldPatterns(), YOUTH_PASSES, rng.fork()) }).toFixed(0)} ms; one pass ${ms(() => { const n = trainedSlowLearner(1000); trainInterleaved(n, oldPatterns(), 1, makeRng(2)) }, 20).toFixed(2)} ms`)
  say(`the new season, ${SEASON_PASSES} passes of 6 patterns: ${ms(() => { const n = new SlowLearner(makeRng(1)); n.copyFrom(trainedSlowLearner(1000)); trainInterleaved(n, newPatterns(), SEASON_PASSES, makeRng(3)) }).toFixed(0)} ms`)
  const net = trainedSlowLearner(1000)
  say(`the property table with damage, 20 draws: ${ms(() => { net.damage = { noise: 0.5 }; net.table(THINGS, 20); net.damage = { noise: 0 } }, 5).toFixed(1)} ms`)
  for (const f of FORAGERS) say(`${f.label}, the week of six nights: ${ms(() => runForagerWeek(f.id, 1000, plan, clearing), 3).toFixed(1)} ms`)
  const stage = new SeparationStage('strong', makeRng(4))
  const store = new FastStore(stage)
  const x = nightInput(new Array(13).fill(0), new Array(12).fill(0.3))
  say(`building the strong separation stage: ${ms(() => new SeparationStage('strong', makeRng(4)), 5).toFixed(1)} ms; one retrieval with six nights stored: ${(ms(() => { for (let i = 0; i < 6; i++) store.store(x, [1, 0], 'n'); store.retrieve(x); store.clear() }, 20)).toFixed(2)} ms`)
})
