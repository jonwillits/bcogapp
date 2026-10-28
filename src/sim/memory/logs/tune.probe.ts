import { it } from 'vitest'
import { makeRng } from '../../random'
import { planFor, runWeekScripted } from './week'
import { tallies } from './night'
import { nearest, setScriptPace, type Policy } from './scripted'
import type { Log } from './clearings'
import { whenScore } from './results'
import { mean } from '../../bilaterian/measure'

/**
 * How long a night is (spec §8.3, §14): set so that a scripted forager that
 * remembers perfectly, walking at half the key pace, empties about four of
 * the seven loose-bark logs on a night when all are full, and a scripted
 * forager that knows only the usual fact digs at about two logs emptied the
 * night before. Twenty seeds, the week of six nights, a sweep of paces and
 * night lengths. Re-measured 2026-10-27 for the week (the looks of the logs
 * change nothing here: a scripted forager already knows which log is which).
 *
 *   PROBE=1 PROBE_DIR=src/sim/memory/logs npx vitest run --disable-console-intercept -t "tune:"
 */

const SEEDS = Array.from({ length: 20 }, (_, i) => 1000 + i)
const say = (s: string) => console.log(`m10 tune · ${s}`)
const f1 = (v: number) => v.toFixed(1)
const f2 = (v: number) => v.toFixed(2)

/** Remembers perfectly: knows the kinds, the rule and every night of the week; digs the nearest log it knows to be full. */
export function perfect(): Policy {
  const known = new Map<number, number | null>() // log → night last emptied, as the forager has seen it
  return {
    next(sim) {
      const candidates = sim.clearing.logs.filter((l) => l.kind === 'loose' && (known.get(l.id) ?? null) !== sim.night - 1 && sim.dugTonight[l.id] === 0)
      return nearest(sim, candidates)
    },
    outcome(log: Log, outcome, sim) {
      if (outcome === 'beetles') known.set(log.id, sim.night)
    },
  }
}

/** Knows only the usual fact: digs at loose-bark logs not yet dug tonight, in a seeded order. */
export function usualOnly(seed: number): Policy {
  const rng = makeRng(seed ^ 0x77)
  return {
    next(sim) {
      const candidates = sim.clearing.logs.filter((l) => l.kind === 'loose' && sim.dugTonight[l.id] === 0)
      if (!candidates.length) return null
      return candidates[rng.int(candidates.length)]
    },
  }
}

it('tune: the night’s length over the week', () => {
  for (const [pace, seconds] of [[1.5, 90], [1.0, 90], [0.75, 80], [0.75, 90], [0.75, 100], [0.75, 120]] as const) {
    setScriptPace(pace)
    const perfEmptied: number[][] = Array.from({ length: 6 }, () => [])
    const usualEmptiedLast: number[][] = Array.from({ length: 6 }, () => [])
    const usualDigs: number[][] = Array.from({ length: 6 }, () => [])
    const usualShare: number[][] = Array.from({ length: 6 }, () => [])
    const usualDigShare: number[][] = Array.from({ length: 6 }, () => [])
    const perfectPassed: number[][] = Array.from({ length: 6 }, () => [])
    for (const seed of SEEDS) {
      const { plan, clearings } = planFor(seed)
      const clearing = clearings.week
      const p = runWeekScripted(plan, clearing, seed, perfect(), { seconds })
      p.records.forEach((r, i) => {
        perfEmptied[i].push(tallies(r).digsAtFull)
        perfectPassed[i].push(whenScore(r, p.states[i], clearing).decisions)
      })
      const u = runWeekScripted(plan, clearing, seed, usualOnly(seed), { seconds })
      u.records.forEach((r, i) => {
        const t = tallies(r)
        usualEmptiedLast[i].push(t.digsAtEmptiedLastNight)
        usualDigs[i].push(t.digs)
        const w = whenScore(r, u.states[i], clearing)
        if (w.decisions) usualShare[i].push(w.errors / w.decisions)
        if (w.digDecisions) usualDigShare[i].push(w.digErrors / w.digDecisions)
      })
    }
    say(`pace ${pace} m/s, night ${seconds} s: perfect empties ${perfEmptied.map((v) => f1(mean(v))).join(' / ')} (nights 1 to 6); its when-decisions nights 3 to 6 ${perfectPassed.slice(2).map((v) => f1(mean(v))).join(' / ')}`)
    say(`   usual-only digs ${usualDigs.map((v) => f1(mean(v))).join(' / ')}; at logs emptied last night ${usualEmptiedLast.map((v) => f1(mean(v))).join(' / ')}; share of when-errors nights 3 to 6 ${usualShare.slice(2).map((v) => f2(mean(v))).join(' / ')} (over digs alone ${usualDigShare.slice(2).map((v) => f2(mean(v))).join(' / ')})`)
  }
  setScriptPace(0.75)
}, 600_000)
