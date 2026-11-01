import { describe, it } from 'vitest'
import { measureCycle, median, SHIPPED_GRID, type GridSettings } from './grid'

/**
 * The cycle search (spec §6.7, decision 13): the grid of settings the spec
 * lists, each measured over seeds for the five targets, printed as a table
 * with the shipped setting marked. Minutes to run:
 *
 *   PROBE=1 PROBE_DIR=src/sim/social/game npx vitest run --disable-console-intercept -t "cycle:"
 *
 * A narrower sweep: CYCLE_SEEDS=3 CYCLE_QUICK=1.
 */

const SEEDS = Number(process.env.CYCLE_SEEDS ?? 5)
const quick = !!process.env.CYCLE_QUICK

function describeOutcome(s: GridSettings, r: ReturnType<typeof measureCycle>): string {
  const seeds = r.seeds
  const count = (v: (number | null)[]) => v.filter((x) => x !== null).length
  const m = (v: (number | null)[]) => {
    const x = median(v)
    return x === null ? '  -' : String(x).padStart(4)
  }
  const changes = r.mixedChanges.map((c) => c.changes)
  const inOrder = r.mixedChanges.reduce((a, c) => a + c.inOrder, 0)
  const all = r.mixedChanges.reduce((a, c) => a + c.changes, 0)
  const twoPlus = r.mixedChanges.filter((c) => c.changes >= 2).length
  const cycle = count(r.tftToAllc) > seeds / 2 && count(r.allcToAlld) > seeds / 2 && count(r.alldToTftMutants) <= seeds / 2 && count(r.alldToTftBlock) > seeds / 2 && twoPlus > seeds / 2 && inOrder / Math.max(1, all) > 0.5
  const ship = s === SHIPPED_GRID ? ' <= shipped' : ''
  return `${s.neighbors}n ${s.update.padEnd(6)} R=${String(s.rounds).padStart(2)} noise ${String(s.noise).padEnd(4)} mut ${String(s.mutation).padEnd(5)} ${s.width}x${s.height} ${s.payoff.padEnd(6)} | tft>allc ${count(r.tftToAllc)}/${seeds} med ${m(r.tftToAllc)} | allc>alld ${count(r.allcToAlld)}/${seeds} med ${m(r.allcToAlld)} | mutants ${count(r.alldToTftMutants)}/${seeds} | block ${count(r.alldToTftBlock)}/${seeds} med ${m(r.alldToTftBlock)} | mixed changes med ${median(changes)} (2+: ${twoPlus}/${seeds}) in order ${all ? ((100 * inOrder) / all).toFixed(0) : '-'}% | ${cycle ? 'CYCLE' : '-'}${ship}`
}

describe('cycle:', () => {
  it('the search over the spec’s settings', () => {
    const settings: GridSettings[] = []
    const neighborsList: (4 | 8)[] = [4, 8]
    const updates: GridSettings['update'][] = ['best', 'legacy']
    const roundsList = quick ? [10] : [5, 10, 20]
    const noises = quick ? [0, 0.05] : [0, 0.02, 0.05, 0.1]
    const mutations = quick ? [0.002] : [0, 0.002, 0.01]
    const sizes: [number, number][] = quick ? [[40, 40]] : [[20, 30], [40, 40]]
    for (const neighbors of neighborsList)
      for (const update of updates)
        for (const rounds of roundsList)
          for (const noise of noises)
            for (const mutation of mutations)
              for (const [width, height] of sizes) settings.push({ width, height, neighbors, update, rounds, noise, mutation, payoff: 'exact', keep: 0.5 })
    console.log(`\n== Cycle search: ${settings.length} settings × ${SEEDS} seeds, 1,000 generations each run`)
    const t0 = Date.now()
    for (const s of settings) {
      const r = measureCycle(s, SEEDS)
      console.log(describeOutcome(s, r))
    }
    console.log(`  (${((Date.now() - t0) / 60000).toFixed(1)} min)`)
  }, 7_200_000)

  it('the shipped setting over twenty seeds, exact and played payoffs', () => {
    console.log('\n== Shipped setting, 20 seeds')
    console.log(describeOutcome(SHIPPED_GRID, measureCycle(SHIPPED_GRID, 20)))
    const played = { ...SHIPPED_GRID, payoff: 'played' as const }
    console.log(describeOutcome(played, measureCycle(played, 20)))
    console.log('\n== Shipped setting with a 3 × 3 block')
    console.log(describeOutcome(SHIPPED_GRID, measureCycle(SHIPPED_GRID, 20, 1000, 1000, 3)))
  }, 3_600_000)
})
