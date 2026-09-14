/// <reference types="node" />
import { describe, it } from 'vitest'
import { ANIMALS } from './animals'
import { DIAGNOSIS, scenarioByKey } from './scenarios'
import { runSeeds, timeToSource, mean } from './measure'
import { TUNING } from './worm'

if (process.env.TUNE) Object.assign(TUNING, JSON.parse(process.env.TUNE))
const ONLY = process.env.ANIMALS?.split(',')

/**
 * The tuning table for Module 4: what each animal does in the diagnosis
 * dish, at the shipped concentration and at maximum, and the steering
 * test's two headings.
 *
 *   PROBE=1 PROBE_DIR=src/sim/bilaterian npx vitest run --disable-console-intercept -t "crib"
 */
const SEEDS = Number(process.env.SEEDS ?? 8)
const SECONDS = Number(process.env.SECONDS ?? 180)

describe('m04 tuning', () => {
  it('crib: what the six animals should look like', () => {
    const rows: string[] = []
    for (const conc of (process.env.CONCS ?? '1,2.5').split(',').map(Number)) {
      for (const a of ANIMALS) {
        if (ONLY && !ONLY.includes(a.id)) continue
        const r = runSeeds(DIAGNOSIS, SEEDS, SECONDS, {
          circuit: a.circuit,
          modulators: a.modulators,
          concentration: conc,
        })
        rows.push(
          `${String(conc).padStart(2)}x  ${a.id.padEnd(8)} cues/min ${r.cuesPerMinute.toFixed(2)}  rev/min ${r.reversalsPerMinute.toFixed(1)}  rev% ${(100 * r.fractionInReverse).toFixed(0)}  E/cue ${r.energyPerCue.toFixed(1)}`,
        )
      }
    }
    console.log(`\nTUNE ${process.env.TUNE ?? '{}'}\n` + rows.join('\n'))
    console.log(
      [
        '',
        '=== The Worms tab, what to look for ===',
        'healthy   skirts the grey bogs; a meal about every forty seconds, a ring flashes and the plume goes',
        'W0        flees every plume it finds; crawls in a bog rather than avoiding it (the whole verdict is inverted)',
        'W1, W3    climb to a plume and eat slowly and seldom; you should not be able to say which is which',
        'W2        reverses more than twice as often as anything else, bends wildly, still finds most of its food',
        'W4        walks into a bog and crawls; reversals per minute a quarter of healthy',
        'at 2.5×   W3 eats like a healthy animal; W1 still almost nothing',
      ].join('\n'),
    )
  })

  it('steering', () => {
    const ll = scenarioByKey('labeled-line')
    for (const dist of [6]) {
      const toward = Array.from({ length: 20 }, (_, i) => timeToSource(500 + i, ll, dist, 0))
      const away = Array.from({ length: 20 }, (_, i) => timeToSource(500 + i, ll, dist, Math.PI))
      console.log(
        `dist ${dist}: toward ${mean(toward).toFixed(1)} s  away ${mean(away).toFixed(1)} s  ratio ${(mean(away) / mean(toward)).toFixed(2)}  timeouts ${toward.filter((t) => t >= 120).length}/${away.filter((t) => t >= 120).length}`,
      )
    }
  })

  it('scenarios', () => {
    for (const key of ['labeled-line', 'trade-off', 'target-and', 'target-or', 'target-and-not', 'reversal']) {
      const r = runSeeds(scenarioByKey(key), 4, 120)
      console.log(
        `${key.padEnd(16)} cues/min ${r.cuesPerMinute.toFixed(2)}  rev/min ${r.reversalsPerMinute.toFixed(1)}  harm ${r.harm.toFixed(1)}`,
      )
    }
  })
})
