import { makeRng } from '../random'
import { bandForRun, liveHistory, HistoryRun, RUN_ORDER, type Band } from './history'
import type { ShallowVariant } from './hominins/planners'
import type { HomininKind } from './hominins/types'
import { runTest, TEST_IDS, type TestId } from './tests'

/**
 * The hominins × tests matrix over seeds, for one variant of the Shallow
 * planner, and the table of how hard each pair of hominins is to tell apart
 * (spec §7.5): the best test for the pair, the difference in shares on it,
 * and the number of ten-day runs after which comparing the two shares tells
 * the pair apart in 95% of simulated students.
 */

export interface MatrixCell {
  mean: number
  sd: number
  /** Every run's share, for the separability table. */
  runs: number[]
}

export interface Matrix {
  variant: ShallowVariant
  seeds: number[]
  cells: Record<HomininKind, Record<TestId, MatrixCell>>
  /** T2's strips, averaged over seeds: the share carrying a flake to the grassland on each of the ten days. */
  t2Strip: Record<HomininKind, number[]>
}

export const MATRIX_SEEDS = Array.from({ length: 20 }, (_, i) => 1000 + i)

export function computeMatrix(variant: ShallowVariant, seeds = MATRIX_SEEDS, bands?: Band[], runsPerSeed = 1): Matrix {
  const cells = Object.fromEntries(RUN_ORDER.map((k) => [k, Object.fromEntries(TEST_IDS.map((t) => [t, { mean: 0, sd: 0, runs: [] as number[] }]))])) as Matrix['cells']
  const stripSum = Object.fromEntries(RUN_ORDER.map((k) => [k, new Array<number>(10).fill(0)])) as Record<HomininKind, number[]>
  let stripRuns = 0
  seeds.forEach((seed, si) => {
    const band = bands?.[si] ?? liveHistory(seed)
    for (let r = 0; r < runsPerSeed; r++) {
      for (const t of TEST_IDS) {
        const rng = makeRng((seed * 31 + TEST_IDS.indexOf(t) * 7 + r * 101) >>> 0)
        const result = runTest(t, bandForRun(band, variant, rng), rng)
        for (const k of RUN_ORDER) cells[k][t].runs.push(result.shares[k])
        if (t === 'T2') {
          stripRuns++
          for (const k of RUN_ORDER) result.strip[k].forEach((v, d) => (stripSum[k][d] += v ? 1 : 0))
        }
      }
    }
  })
  for (const k of RUN_ORDER)
    for (const t of TEST_IDS) {
      const c = cells[k][t]
      const n = c.runs.length
      c.mean = c.runs.reduce((a, b) => a + b, 0) / n
      c.sd = Math.sqrt(c.runs.reduce((a, b) => a + (b - c.mean) ** 2, 0) / Math.max(1, n - 1))
    }
  const t2Strip = Object.fromEntries(RUN_ORDER.map((k) => [k, stripSum[k].map((s) => s / Math.max(1, stripRuns))])) as Record<HomininKind, number[]>
  return { variant, seeds, cells, t2Strip }
}

export interface PairRow {
  a: HomininKind
  b: HomininKind
  bestTest: TestId | null
  /** The difference in mean shares on the best test (a − b). */
  difference: number
  /** Runs after which comparing the two means tells the pair apart in 95% of simulated students, or null if not within 10. */
  runsFor95: number | null
  /** Tests on which the pair differs by at least 0.3. */
  separatingTests: TestId[]
}

/** The share of simulated students whose n-run means put a and b in the right order, by resampling runs. */
function orderedShare(aRuns: number[], bRuns: number[], n: number, sign: number, draws = 2000): number {
  const rng = makeRng(42 + n)
  let right = 0
  for (let d = 0; d < draws; d++) {
    let ma = 0
    let mb = 0
    for (let i = 0; i < n; i++) {
      ma += aRuns[rng.int(aRuns.length)]
      mb += bRuns[rng.int(bRuns.length)]
    }
    if (sign * (ma - mb) > 0) right++
  }
  return right / draws
}

export function separability(m: Matrix, maxRuns = 10): PairRow[] {
  const rows: PairRow[] = []
  for (let i = 0; i < RUN_ORDER.length; i++)
    for (let j = i + 1; j < RUN_ORDER.length; j++) {
      const a = RUN_ORDER[i]
      const b = RUN_ORDER[j]
      let bestTest: TestId | null = null
      let difference = 0
      const separatingTests: TestId[] = []
      for (const t of TEST_IDS) {
        const d = m.cells[a][t].mean - m.cells[b][t].mean
        if (Math.abs(d) >= 0.3) separatingTests.push(t)
        if (Math.abs(d) > Math.abs(difference)) {
          difference = d
          bestTest = t
        }
      }
      let runsFor95: number | null = null
      if (bestTest && Math.abs(difference) > 1e-9) {
        const sign = Math.sign(difference)
        for (let n = 1; n <= maxRuns; n++) {
          if (orderedShare(m.cells[a][bestTest].runs, m.cells[b][bestTest].runs, n, sign) >= 0.95) {
            runsFor95 = n
            break
          }
        }
      }
      rows.push({ a, b, bestTest, difference, runsFor95, separatingTests })
    }
  return rows
}

export function printMatrix(m: Matrix): string[] {
  const lines = [`Shallow planner variant ${m.variant}; ${m.seeds.length} seeds × ${m.cells.adapted.T1.runs.length / m.seeds.length} run(s) of ${10} days`]
  lines.push(`${'hominin'.padEnd(14)}${TEST_IDS.map((t) => t.padStart(14)).join('')}`)
  for (const k of RUN_ORDER) lines.push(`${k.padEnd(14)}${TEST_IDS.map((t) => `${m.cells[k][t].mean.toFixed(2)} (${m.cells[k][t].sd.toFixed(2)})`.padStart(14)).join('')}`)
  lines.push(`T2 strip (share carrying a flake to the grassland, days 1–10):`)
  for (const k of RUN_ORDER) lines.push(`  ${k.padEnd(14)}${m.t2Strip[k].map((v) => v.toFixed(2)).join(' ')}`)
  return lines
}

export function printSeparability(rows: PairRow[]): string[] {
  return rows.map((r) => `${r.a} vs ${r.b}: best ${r.bestTest ?? 'none'}, difference ${r.difference.toFixed(2)}, runs for 95%: ${r.runsFor95 ?? '>10'}; separating tests: ${r.separatingTests.join(' ') || 'none'}`)
}

/**
 * The matrix paid in slices: the histories a few days at a time, then one
 * test run per slice, for both variants of the Shallow planner from the
 * same bands. `step()` does one slice and returns whether the whole is
 * done; `progress` is 0 to 1 and `badge` says what is being computed.
 */
export class MatrixRun {
  readonly seeds: number[]
  private histories: HistoryRun[]
  private bands: (Band | null)[]
  private h = 0
  /** The test runs still to do: seed index, test, variant. */
  private queue: { si: number; t: TestId; variant: ShallowVariant }[] = []
  private cells: Record<ShallowVariant, Matrix['cells']>
  private stripSum: Record<ShallowVariant, Record<HomininKind, number[]>>
  private stripRuns: Record<ShallowVariant, number> = { A: 0, B: 0 }
  private total: number
  private doneRuns = 0
  result: { A: Matrix; B: Matrix } | null = null
  badge = ''

  readonly daysPerSlice: number

  constructor(seeds = MATRIX_SEEDS, daysPerSlice = 40) {
    this.seeds = seeds
    this.daysPerSlice = daysPerSlice
    this.histories = seeds.map((s) => new HistoryRun(s))
    this.bands = seeds.map(() => null)
    const empty = () => Object.fromEntries(RUN_ORDER.map((k) => [k, Object.fromEntries(TEST_IDS.map((t) => [t, { mean: 0, sd: 0, runs: [] as number[] }]))])) as Matrix['cells']
    this.cells = { A: empty(), B: empty() }
    const strips = () => Object.fromEntries(RUN_ORDER.map((k) => [k, new Array<number>(10).fill(0)])) as Record<HomininKind, number[]>
    this.stripSum = { A: strips(), B: strips() }
    for (const variant of ['A', 'B'] as ShallowVariant[]) seeds.forEach((_, si) => TEST_IDS.forEach((t) => this.queue.push({ si, t, variant })))
    this.total = this.queue.length
  }

  get progress(): number {
    const histShare = this.histories.reduce((a, r) => a + r.progress / r.days, 0) / this.histories.length
    return 0.6 * histShare + 0.4 * (this.doneRuns / this.total)
  }

  step(): boolean {
    if (this.result) return true
    if (this.h < this.histories.length) {
      const r = this.histories[this.h]
      if (r.step(this.daysPerSlice)) {
        this.bands[this.h] = r.band()
        this.h++
      }
      this.badge = `Living the hominins’ days before the lab — seed ${Math.min(this.h + 1, this.histories.length)} of ${this.histories.length}`
      return false
    }
    const job = this.queue.shift()
    if (job) {
      const seed = this.seeds[job.si]
      const rng = makeRng((seed * 31 + TEST_IDS.indexOf(job.t) * 7) >>> 0)
      const result = runTest(job.t, bandForRun(this.bands[job.si]!, job.variant, rng), rng)
      for (const k of RUN_ORDER) this.cells[job.variant][k][job.t].runs.push(result.shares[k])
      if (job.t === 'T2') {
        this.stripRuns[job.variant]++
        for (const k of RUN_ORDER) result.strip[k].forEach((v, d) => (this.stripSum[job.variant][k][d] += v ? 1 : 0))
      }
      this.doneRuns++
      this.badge = `Running the build’s tests — ${this.doneRuns} of ${this.total}`
      return false
    }
    const finish = (variant: ShallowVariant): Matrix => {
      const cells = this.cells[variant]
      for (const k of RUN_ORDER)
        for (const t of TEST_IDS) {
          const c = cells[k][t]
          const n = c.runs.length
          c.mean = c.runs.reduce((a, b) => a + b, 0) / n
          c.sd = Math.sqrt(c.runs.reduce((a, b) => a + (b - c.mean) ** 2, 0) / Math.max(1, n - 1))
        }
      const t2Strip = Object.fromEntries(RUN_ORDER.map((k) => [k, this.stripSum[variant][k].map((s) => s / Math.max(1, this.stripRuns[variant]))])) as Record<HomininKind, number[]>
      return { variant, seeds: this.seeds, cells, t2Strip }
    }
    this.result = { A: finish('A'), B: finish('B') }
    this.badge = ''
    return true
  }
}
