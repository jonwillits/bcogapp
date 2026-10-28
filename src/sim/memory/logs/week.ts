import { makeRng, type Rng } from '../../random'
import { makeClearing, type Clearing } from './clearings'
import { afterNight, freshWeek, type LastEmptied } from './refill'
import { NightSim, type NightOptions, type NightRecord } from './night'
import { planWeek, WEEK_NIGHTS, type WeekPlan } from './features'
import { runScripted, type Policy } from './scripted'

/**
 * The week of six nights in one clearing (spec §8.5): every loose-bark log
 * is full on night 1, and the refill rule carries the state from night to
 * night through night 6. `WeekRun` is the bookkeeping the student's store
 * and the programmed foragers share: the state after each night and the
 * records. The week is one unit (§4.3); an interrupted week runs again in
 * the same clearing, from night 1 with every loose-bark log full and the
 * same order of night features (2026-10-28; the reserve clearing before).
 */

export interface WeekRun {
  plan: WeekPlan
  clearing: Clearing
  /** The state after each night so far; index 0 is the fresh week. */
  states: LastEmptied[]
  records: NightRecord[]
}

export function newWeekRun(plan: WeekPlan, clearing: Clearing): WeekRun {
  return { plan, clearing, states: [freshWeek(clearing.logs.length)], records: [] }
}

/** The stream a night draws from: the seed, the night (0 the practice night) and the attempt, so a redone practice night or a restarted week is a fresh night. The week's streams are as they were before 2026-10-28, so every measured number stands. */
export function nightRng(seed: number, night: number, attempt = 0): Rng {
  return makeRng((seed ^ 0x9a7) + 2 * 7919 + night * 31 + attempt * 104729)
}

/** Start the next night (1 to 6) of a week. */
export function startNight(run: WeekRun, seed: number, attempt = 0, opts: NightOptions = {}): NightSim {
  const night = run.records.length + 1
  if (night > WEEK_NIGHTS) throw new Error('the week is over')
  return new NightSim(run.clearing, run.states[night - 1], night, run.plan.nights[night - 1], nightRng(seed, night, attempt), opts)
}

/** Record a finished night and carry the state forward. */
export function finishNight(run: WeekRun, sim: NightSim): void {
  run.records.push(sim.record)
  run.states.push(afterNight(run.states[run.states.length - 1], sim.record.emptiedTonight, sim.night))
}

export const weekDone = (run: WeekRun): boolean => run.records.length >= WEEK_NIGHTS

/** Run a whole week under a policy; the programmed foragers of Part 5 and the probes use this. */
export function runWeekScripted(plan: WeekPlan, clearing: Clearing, seed: number, policy: Policy, opts: NightOptions = {}, onNight?: (run: WeekRun, sim: NightSim) => void): WeekRun {
  const run = newWeekRun(plan, clearing)
  for (let n = 1; n <= WEEK_NIGHTS; n++) {
    const sim = startNight(run, seed, 0, opts)
    runScripted(sim, policy)
    finishNight(run, sim)
    onNight?.(run, sim)
  }
  return run
}

export function planFor(seed: number): { plan: WeekPlan; clearing: Clearing } {
  return { plan: planWeek(seed), clearing: makeClearing(seed) }
}
