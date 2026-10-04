import { it } from 'vitest'
import { FishWorld, type WorldOptions } from './world'
import { FISH_SCENARIOS, scenarioByKey } from './scenarios'
import { evidenceFor, hiddenOutputFor, makeScratch } from './brain'

/**
 * Every synchronous path a click or a render can reach, timed
 * (`APP_DESIGN.md`, hard requirements). Multiply by four for a student
 * laptop; anything over about 300 ms on a click path is a freeze.
 *
 *   PROBE=1 PROBE_DIR=src/sim/fish npx vitest run --disable-console-intercept -t "timing:"
 *
 * *Skip ahead* is paid down a hundred encounters a slice on a timer
 * (`SKIP_SLICE` in the scene), so the number that matters is one slice.
 */

const say = (s: string) => console.log(`m07 timing · ${s}`)
const ms = (f: () => void, reps = 1) => {
  const t0 = performance.now()
  for (let i = 0; i < reps; i++) f()
  return (performance.now() - t0) / reps
}

it('timing: every click path and every render', () => {
  for (const s of FISH_SCENARIOS) say(`construct ${s.key}: ${ms(() => new FishWorld(1, s), 20).toFixed(2)} ms`)

  const cases: [string, string, WorldOptions][] = [
    ['fruit, six hidden units, pass the error back', 'fruit', { hidden: 6, hiddenMode: 'pass-back', learning: { on: true } }],
    ['island, 200 random units, sparse', 'island', { hidden: 200, hiddenMode: 'random', sparse: true, learning: { on: true } }],
    ['island, 200 random units, not sparse', 'island', { hidden: 200, hiddenMode: 'random', learning: { on: true } }],
    ['diagnosis (2,000 in the test set)', 'diagnosis', {}],
    ['pool, eight hidden units', 'pool', { learning: { on: true } }],
    ['new predator, six hidden units, two test sets', 'new-predator', { learning: { on: true } }],
  ]
  for (const [name, key, opts] of cases) {
    const w = new FishWorld(3, scenarioByKey(key), opts)
    w.run(100)
    let worst = 0
    let total = 0
    for (let i = 0; i < 10; i++) {
      const t = ms(() => w.run(100))
      worst = Math.max(worst, t)
      total += t
    }
    say(`${name}: one slice of 100 encounters, worst ${worst.toFixed(1)} ms; Skip ahead 1,000 in all ${total.toFixed(0)} ms`)
    say(`  reshape to this network: ${ms(() => w.reshape({ redraw: true }), 5).toFixed(2)} ms; reset: ${ms(() => w.reset(), 5).toFixed(2)} ms`)

    // What the panels compute per render.
    const b = w.brain
    const s = makeScratch()
    const lattice = ms(() => {
      for (let i = 0; i <= 26; i++) for (let j = 0; j <= 26; j++) evidenceFor(b.circuit, b.receptors, i / 26, j / 26, s)
      for (let i = 0; i < 26; i++) for (let j = 0; j < 26; j++) evidenceFor(b.circuit, b.receptors, (i + 0.5) / 26, (j + 0.5) / 26, s)
    }, 10)
    const thumbs = ms(() => {
      const n = Math.min(8, b.circuit.interneurons.length)
      for (let u = 0; u < n; u++) for (let i = 0; i < 81; i++) hiddenOutputFor(b.circuit, b.receptors, u, (i % 9) / 9, Math.floor(i / 9) / 9, s)
    }, 10)
    const tests = ms(() => {
      for (const t of w.tests) {
        w.testCounts(t)
        w.testEvidence(t)
      }
    }, 10)
    say(`  per render: feature-space lattice ${lattice.toFixed(2)} ms; thumbnails ${thumbs.toFixed(2)} ms; test sets scored ${tests.toFixed(2)} ms; Score this criterion ${ms(() => w.scoreFresh(500), 5).toFixed(2)} ms`)
  }
})
