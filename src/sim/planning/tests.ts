import type { Rng } from '../random'
import { carriedFlakeToGrassland, runDay, type DayPlan, type DayResult } from './day'
import type { Hominin, HomininKind } from './hominins/types'
import { RUN_ORDER } from './history'

/**
 * The chain of tests, T1 to T6 (spec §7.4.4). A run is ten days of one test
 * for all five hidden hominins at once, with the elder. The measure for T1
 * and T3 to T6 is the share of days on which a hominin reached the need's
 * place within the window holding what it takes; for T2, a strip of ten days
 * showing on which days it carried a flake to the grassland, and the share
 * over days 2 to 10.
 */

export type TestId = 'T1' | 'T2' | 'T3' | 'T4' | 'T5' | 'T6'

export const TEST_IDS: readonly TestId[] = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6']

export interface TestSpec {
  id: TestId
  title: string
  /** The days, in order (one entry, repeated, or ten). */
  days: (day: number) => DayPlan
  /** What the test takes away, as the panel says it after the commit. */
  takesAway: string
  measure: 'ate' | 'strip'
}

export const RUN_DAYS = 10

export const TESTS: Record<TestId, TestSpec> = {
  T1: { id: 'T1', title: 'The usual day', days: () => ({ cue: 'vultures', needPresent: true, elder: 'atCamp' }), takesAway: 'nothing', measure: 'ate' },
  T2: { id: 'T2', title: 'Nothing on the grassland', days: (d) => ({ cue: 'vultures', needPresent: false, elder: d === 0 ? 'atCamp' : 'stays' }), takesAway: 'the outcome that followed the usual errands', measure: 'strip' },
  T3: { id: 'T3', title: 'Bones at the old kill', days: () => ({ cue: 'hyenas', needPresent: true, elder: 'atCamp' }), takesAway: 'the usual need', measure: 'ate' },
  T4: { id: 'T4', title: 'Termites after rain', days: () => ({ cue: 'rain', needPresent: true, elder: 'atCamp' }), takesAway: 'any reward for this need', measure: 'ate' },
  T5: { id: 'T5', title: 'Tubers in the dry flats', days: () => ({ cue: 'dry', needPresent: true, elder: 'atCamp' }), takesAway: 'the same, with a need that takes four preparatory acts', measure: 'ate' },
  T6: { id: 'T6', title: 'Termites, the elder away', days: () => ({ cue: 'rain', needPresent: true, elder: 'absent' }), takesAway: 'the elder to watch', measure: 'ate' },
}

export interface RunResult {
  test: TestId
  /** By hominin, in RUN_ORDER: the share (T1, T3–T6: of days eaten; T2: of days 2–10 carrying a flake to the grassland). */
  shares: Record<HomininKind, number>
  /** T2's strip, and for the other tests the day-by-day eating, by hominin. */
  strip: Record<HomininKind, boolean[]>
  days: DayResult[]
}

/** Run one test for ten days on a band of five, which goes on learning within the run. */
export function runTest(test: TestId, band: Hominin[], rng: Rng): RunResult {
  const spec = TESTS[test]
  const days: DayResult[] = []
  const strip = Object.fromEntries(RUN_ORDER.map((k) => [k, [] as boolean[]])) as Record<HomininKind, boolean[]>
  for (let d = 0; d < RUN_DAYS; d++) {
    const result = runDay(spec.days(d), band, rng)
    days.push(result)
    result.hominins.forEach((hd, i) => strip[RUN_ORDER[i]].push(spec.measure === 'strip' ? carriedFlakeToGrassland(hd) : hd.ate))
  }
  const shares = Object.fromEntries(
    RUN_ORDER.map((k) => {
      const s = strip[k]
      const counted = spec.measure === 'strip' ? s.slice(1) : s
      return [k, counted.filter(Boolean).length / counted.length]
    }),
  ) as Record<HomininKind, number>
  return { test, shares, strip, days }
}
