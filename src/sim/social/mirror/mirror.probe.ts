import { describe, it } from 'vitest'
import { runSteps, restingFiring } from './schedule'
import { CELLS } from './cells'

/**
 * The cells' mean firing after each of Part 6's steps, over twenty seeds
 * (spec §10.3):
 *
 *   PROBE=1 PROBE_DIR=src/sim/social/mirror npx vitest run --disable-console-intercept -t "mirror:"
 */
describe('mirror:', () => {
  it('mean firing to each kind seen from across, after each step', () => {
    const runs = Array.from({ length: 20 }, (_, i) => runSteps(1000 + i))
    const f = (x: number) => x.toFixed(2)
    const stat = (g: (r: (typeof runs)[number]) => number) => {
      const v = runs.map(g)
      const m = v.reduce((a, b) => a + b, 0) / v.length
      const sd = Math.sqrt(v.reduce((a, b) => a + (b - m) * (b - m), 0) / (v.length - 1))
      return `${f(m)}±${f(sd)}`
    }
    console.log(`\n== Part 6, 20 seeds; resting output ${f(restingFiring())}; own hand seen on ${CELLS.ownViewShare} of own grasps; copy latency ${CELLS.copyLatency} s`)
    for (const step of [1, 2, 3, 4] as const) {
      console.log(`  Step ${step}: precision cell to seen precision ${stat((r) => r[step].precisionCell.toPrecision)}, to seen whole-hand ${stat((r) => r[step].precisionCell.toWholeHand)} | whole-hand cell to seen precision ${stat((r) => r[step].wholeHandCell.toPrecision)}, to seen whole-hand ${stat((r) => r[step].wholeHandCell.toWholeHand)}`)
    }
    const w = runs[0].afterStep2.table()
    console.log('  weights after Step 4 (seed 1000; Step 4 runs on from the cells as Step 2 left them), rows own-precision, own-whole, across-precision, across-whole; columns precision cell, whole-hand cell:')
    for (const row of w) console.log('    ' + row.map(f).join('  '))
  })
})
