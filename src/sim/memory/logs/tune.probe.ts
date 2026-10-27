import { it } from 'vitest'
import { makeRng } from '../../random'
import { planFor, runBlockScripted } from './block'
import { tallies } from './night'
import { nearest, setScriptPace, type Policy } from './scripted'
import type { Log } from './clearings'
import { mean } from '../../bilaterian/measure'

/**
 * How long a night is (spec §8.3, §14): tuned so that a scripted forager
 * that remembers perfectly empties about four of the seven loose-bark logs
 * per night, and a scripted forager that knows only the usual fact digs at
 * about two logs emptied the night before on nights 2 and 3. Twenty seeds,
 * a sweep of night lengths.
 *
 *   PROBE=1 PROBE_DIR=src/sim/memory/logs npx vitest run --disable-console-intercept -t "tune:"
 */

const SEEDS = Array.from({ length: 20 }, (_, i) => 1000 + i)
const say = (s: string) => console.log(`m10 tune · ${s}`)

/** Remembers perfectly: knows the kinds, the rule and every night of the block; digs the nearest log it knows to be full. */
function perfect(): Policy {
  const known = new Map<number, number | null>() // log → night last emptied, as the forager has seen it
  let night = 0
  return {
    next(sim) {
      if (sim.night !== night) night = sim.night
      const candidates = sim.clearing.logs.filter((l) => l.kind === 'loose' && (known.get(l.id) ?? null) !== night - 1 && sim.dugTonight[l.id] === 0)
      return nearest(sim, candidates)
    },
    outcome(log: Log, outcome, sim) {
      if (outcome === 'beetles') known.set(log.id, sim.night)
    },
  }
}

/** Knows only the usual fact: digs at loose-bark logs not yet dug tonight, in a seeded order. */
function usualOnly(seed: number): Policy {
  const rng = makeRng(seed ^ 0x77)
  return {
    next(sim) {
      const candidates = sim.clearing.logs.filter((l) => l.kind === 'loose' && sim.dugTonight[l.id] === 0)
      if (!candidates.length) return null
      return candidates[rng.int(candidates.length)]
    },
  }
}

it('tune: the night’s length', () => {
  for (const [pace, seconds] of [[1.5, 45], [1.5, 55], [1.5, 60], [1.5, 80], [1.5, 90], [1.5, 100], [1.5, 120], [1.0, 90], [0.75, 80], [0.75, 90], [0.75, 100], [0.75, 120]] as const) {
    setScriptPace(pace)
    const perfEmptied: number[][] = [[], [], []]
    const usualEmptiedLast: number[][] = [[], [], []]
    const usualDigs: number[][] = [[], [], []]
    for (const seed of SEEDS) {
      const { plan, clearings } = planFor(seed)
      for (const block of plan.blocks) {
        const clearing = clearings[block.clearing]
        const p = runBlockScripted(block, clearing, seed, perfect(), { seconds })
        p.records.forEach((r, i) => perfEmptied[i].push(tallies(r).digsAtFull))
        const u = runBlockScripted(block, clearing, seed, usualOnly(seed), { seconds })
        u.records.forEach((r, i) => {
          const t = tallies(r)
          usualEmptiedLast[i].push(t.digsAtEmptiedLastNight)
          usualDigs[i].push(t.digs)
        })
      }
    }
    say(`pace ${pace} m/s, ${seconds} s: perfect empties ${perfEmptied.map((v) => mean(v).toFixed(1)).join(' / ')} per night (nights 1 / 2 / 3); usual-only digs ${usualDigs.map((v) => mean(v).toFixed(1)).join(' / ')} and at logs emptied last night ${usualEmptiedLast.map((v) => mean(v).toFixed(1)).join(' / ')}`)
  }
}, 600_000)
