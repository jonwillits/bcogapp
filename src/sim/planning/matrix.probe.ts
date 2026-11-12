import { describe, it } from 'vitest'
import { computeMatrix, printMatrix, printSeparability, separability, MATRIX_SEEDS } from './matrix'
import { liveHistory, printCounts } from './history'

/**
 * Prints the record spec §7.5 asks for: the history's counts, the hominins ×
 * tests matrix over 20 seeds for each variant of the Shallow planner, and the
 * table of how hard each pair is to tell apart. Run with
 * PROBE=1 npx vitest run src/sim/planning/matrix.probe.ts --disable-console-intercept
 */
describe.skipIf(!process.env.PROBE)('m12 part 3 matrix', () => {
  it('prints the history, the matrices and the separability tables', { timeout: 600_000 }, () => {
    const t0 = Date.now()
    const bands = MATRIX_SEEDS.map((s) => liveHistory(s))
    console.log(`histories: ${((Date.now() - t0) / 1000).toFixed(1)} s`)
    const b = bands[0]
    console.log(`\nSeed ${b.seed} history (${b.dayKinds.length} days: ${(['carcass', 'marrow', 'termites', 'tubers'] as const).map((n) => `${n} ${b.dayKinds.filter((d) => d === n).length}`).join(', ')})`)
    const labels = ['adapted', 'learnedValue', 'copier', 'shallow A', 'shallow B', 'planner']
    b.counts.forEach((c, i) => console.log(printCounts(c, labels[i]).join('\n')))
    for (const variant of ['A', 'B'] as const) {
      const t1 = Date.now()
      const m = computeMatrix(variant, MATRIX_SEEDS, bands, 3)
      console.log(`\n${printMatrix(m).join('\n')}`)
      console.log(printSeparability(separability(m)).join('\n'))
      console.log(`(${((Date.now() - t1) / 1000).toFixed(1)} s)`)
    }
  })
})
