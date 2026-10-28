import { makeRng } from '../../../sim/random'
import type { ProgressStore } from '../../../sim/memory/progress/store'
import { makeClearings, type Clearing } from '../../../sim/memory/logs/clearings'
import { planFor, runWeekScripted } from '../../../sim/memory/logs/week'
import { tallies, type NightRecord, type NightTallies } from '../../../sim/memory/logs/night'
import { truthOf, type Truth } from '../../../sim/memory/logs/refill'
import type { WeekAnswers } from '../../../sim/memory/logs/question'
import { PAIR_PREDICTION_KEY, TREND_PREDICTION_KEY, weekSummary, type PairPrediction, type Part4WeekResult, type StudentNights, type TrendPrediction, type WeekSummary } from '../../../sim/memory/logs/results'

/**
 * The student's own week, as Part 5 needs it (spec §4.3, §9): read from
 * the progress store once Part 4 is finished, or the sample set, a recorded
 * week from the build's own play, for a student whose saved nights are
 * lost. Every Part 5 panel says when the nights are someone else's.
 */

export const SAMPLE_SEED = 4242
export const WEEK_UNIT = 'p4-week' as const

export function studentNights(progress: ProgressStore, seed: number): StudentNights | null {
  const week = progress.result(WEEK_UNIT) as Part4WeekResult | undefined
  if (!week || !progress.isComplete(WEEK_UNIT)) return null
  return { seed, week, predictions: { pairs: (progress.prediction(PAIR_PREDICTION_KEY) as PairPrediction | null) ?? null, trend: (progress.prediction(TREND_PREDICTION_KEY) as TrendPrediction | null) ?? null }, sample: false }
}

/**
 * The sample set: a scripted forager with a leaky memory for nights. It
 * digs loose-bark logs not yet dug tonight in a seeded order, and avoids a
 * log it emptied last night seven times in ten; its end-of-week answers
 * are right seven times in ten and otherwise name the neighboring night.
 * Deterministic.
 */
export function sampleNights(): StudentNights {
  const seed = SAMPLE_SEED
  const { plan, clearings } = planFor(seed)
  const clearing = clearings.week
  const order = makeRng(seed ^ 0x5a3)
  const memory = makeRng(seed ^ 0x6b4)
  const marks = makeRng(seed ^ 0x7c1)
  const emptiedOn = new Map<number, number>()
  const run = runWeekScripted(plan, clearing, seed, {
    next(sim) {
      const c = sim.clearing.logs.filter((l) => l.kind === 'loose' && sim.dugTonight[l.id] === 0 && !(emptiedOn.get(l.id) === sim.night - 1 && memory.next() < 0.7))
      return c.length ? c[order.int(c.length)] : null
    },
    outcome(log, outcome, sim) {
      if (outcome === 'beetles') emptiedOn.set(log.id, sim.night)
    },
  })
  const after = run.states[run.states.length - 1]
  const answers: WeekAnswers = {}
  for (const l of clearing.logs) {
    if (l.kind !== 'loose') continue
    const t = truthOf(after[l.id], 6)
    let a: Truth = t
    if (t !== 'never' && marks.next() >= 0.7) a = t === 'tonight' ? 'last night' : t === 'last night' ? 'two nights ago' : 'last night'
    answers[l.id] = a
  }
  const week: Part4WeekResult = { plan, clearing: 'week', records: run.records, states: run.states, answers, restarted: false }
  return { seed, week, predictions: { pairs: null, trend: null }, sample: true }
}

/** The clearing a saved week ran in. */
export function clearingOf(nights: StudentNights): Clearing {
  return makeClearings(nights.seed)[nights.week.clearing]
}

export function studentTallies(nights: StudentNights): NightTallies[] {
  return nights.week.records.map(tallies)
}

export function studentSummary(nights: StudentNights): WeekSummary {
  return weekSummary(nights.week, clearingOf(nights))
}

export function studentRecord(nights: StudentNights, night: number): NightRecord {
  return nights.week.records[night - 1]
}

/** Beetles per minute over a night. */
export function perMinute(r: NightRecord): number {
  return r.seconds > 0 ? (r.beetles / r.seconds) * 60 : 0
}
