import type { Rng } from '../random'
import { MORNING_SECONDS, WINDOW_SECONDS, type Item, type Place } from './range/places'
import { NEED_TABLE, NEEDS, needOfCue, type Cue, type Need } from './range/needs'
import { chainFor } from './range/chains'
import { endsMorning, execute, type Errand, type Observation, type Segment, type Standing } from './range/acts'
import type { Hominin } from './hominins/types'

/**
 * One day in the range (spec §7.3, §7.4): dawn with its cue, a morning of
 * errands for each hominin and the elder, and midday, when the day's need
 * appears at its place for a window and whoever is there holding what it
 * takes eats. The world reads the table of what each need takes; the
 * programmed hominins never do.
 */

export interface DayPlan {
  cue: Cue
  /** Whether the need appears for the hidden hominins at midday. False in T2 (the carcass is gone), and in the history on the days the elder used up the termites or tubers before anyone else arrived. */
  needPresent: boolean
  /** The elder: at camp, doing the day's errands in sight of the band; away before dawn, doing them out of sight until later in the day; or at camp and staying there. */
  elder: 'atCamp' | 'away' | 'stays' | 'absent'
}

export interface HomininDay {
  kind: Hominin['kind']
  segments: Segment[]
  final: Standing
  ate: boolean
  /** Whether this was one of the days on which it did a random need's preparation instead of its own procedure. */
  deviated: boolean
  errands: Errand[]
}

export interface ElderDay {
  present: boolean
  segments: Segment[]
  final: Standing
  ate: boolean
  errands: Errand[]
}

export interface DayResult {
  need: Need
  hominins: HomininDay[]
  elder: ElderDay
}

/** The share of days on which a hidden hominin does a random need's preparation instead of its own procedure. */
export const DEVIATION_RATE = 0.15
/** A morning of errands never runs past this many, whatever a procedure asks for. */
const MAX_ERRANDS = 12

const AT_CAMP: Standing = { place: 'camp', hands: [], elapsed: 0 }

function runErrands(standing: Standing, nextErrand: () => Errand, onDone: (before: Standing, e: Errand, after: Standing, seen: Observation[]) => void): { final: Standing; segments: Segment[]; errands: Errand[] } {
  const segments: Segment[] = []
  const errands: Errand[] = []
  let s = standing
  for (let k = 0; k < MAX_ERRANDS; k++) {
    if (s.elapsed >= MORNING_SECONDS) break
    const e = nextErrand()
    const r = execute(s, e)
    segments.push(...r.segments)
    errands.push(e)
    onDone(s, e, r.standing, r.seen)
    s = r.standing
    if (endsMorning(e)) break
  }
  if (!segments.length || segments[segments.length - 1].kind !== 'wait') segments.push({ kind: 'wait', place: s.place, t0: s.elapsed })
  return { final: s, segments, errands }
}

function eats(final: Standing, need: Need, present: boolean): { ate: boolean; used: Item | null } {
  const spec = NEED_TABLE[need]
  const inTime = final.place === spec.place && final.elapsed <= MORNING_SECONDS + WINDOW_SECONDS
  const ate = present && inTime && final.hands.includes(spec.takes)
  return { ate, used: ate ? spec.takes : null }
}

/** Run one day for a band of hidden hominins and the elder. Each hominin's day is its own; only the Copier reads the elder's morning, and only at dawn. */
export function runDay(plan: DayPlan, hominins: readonly Hominin[], rng: Rng, deviationRate = DEVIATION_RATE): DayResult {
  const need = needOfCue(plan.cue)
  // The elder's day, scripted by the scene (spec §7.4.3).
  const elderErrands: Errand[] = plan.elder === 'stays' ? [{ kind: 'stay' }] : plan.elder === 'absent' ? [] : chainFor(need)
  const elderSeen: Observation[] = []
  const elderRun = plan.elder === 'absent' ? { final: AT_CAMP, segments: [] as Segment[], errands: [] as Errand[] } : runErrands(AT_CAMP, () => elderErrands[0] ? elderErrands.shift()! : { kind: 'stay' }, (_b, _e, _a, seen) => elderSeen.push(...seen.map((o) => ({ ...o, who: 'elder' as const }))))
  const elderAte = plan.elder === 'absent' ? { ate: false, used: null } : eats(elderRun.final, need, true)
  const elderOutcome: Observation = { kind: 'outcome', who: 'elder', cue: plan.cue, place: elderRun.final.place, hands: [...elderRun.final.hands], ate: elderAte.ate, used: elderAte.used }
  const elderDay: ElderDay = { present: plan.elder !== 'absent', segments: elderRun.segments, final: elderRun.final, ate: elderAte.ate, errands: plan.elder === 'stays' ? [{ kind: 'stay' }] : plan.elder === 'absent' ? [] : chainFor(need) }

  // Each hominin's deviation draws come from a stream of its own, forked in order, so that one hominin's choices never move another's days.
  const forks = hominins.map(() => rng.fork())
  const days: HomininDay[] = hominins.map((h, i) => {
    const elderAtCamp = plan.elder === 'atCamp' || plan.elder === 'stays'
    h.dawn({ cue: plan.cue, elderAtCamp, elderErrands: elderAtCamp ? elderDay.errands : null })
    const deviated = forks[i].next() < deviationRate
    const script = deviated ? chainFor(NEEDS[forks[i].int(NEEDS.length)]) : null
    let standingNow: Standing = AT_CAMP
    const run = runErrands(
      AT_CAMP,
      () => (script ? (script.shift() ?? { kind: 'stay' }) : h.next(standingNow, plan.cue)),
      (before, e, after, seen) => {
        for (const o of seen) h.observe(o)
        h.errandDone(before, e, after)
        standingNow = after
      },
    )
    const { ate, used } = eats(run.final, need, plan.needPresent)
    h.observe({ kind: 'outcome', who: 'self', cue: plan.cue, place: run.final.place, hands: [...run.final.hands], ate, used })
    // Later in the day, the band sees what the elder did and whether she ate.
    if (plan.elder !== 'absent') {
      for (const o of elderSeen) h.observe(o)
      h.observe(elderOutcome)
    }
    h.endDay(ate, run.final)
    return { kind: h.kind, segments: run.segments, final: run.final, ate, deviated, errands: run.errands }
  })
  return { need, hominins: days, elder: elderDay }
}

/** Whether a hominin's day ended at the grassland holding a flake: T2's strip (spec §7.4.4). */
export function carriedFlakeToGrassland(d: HomininDay): boolean {
  return d.final.place === 'grassland' && d.final.hands.includes('flake')
}

export const PLACE_OF: (need: Need) => Place = (need) => NEED_TABLE[need].place
