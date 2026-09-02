/**
 * Does Q18 actually demonstrate something?
 *
 * Q18 asks which of W and Z is "better adapted", the point being that the
 * answer depends entirely on the world. That only lands if a student can watch
 * each population meet the other's world and see it fail. Measured before
 * building the control, because a control that produces no visible difference
 * is worse than the missing one it replaces.
 */
import { it } from 'vitest'
import { CONTINUOUS_LINEAGE_DATA } from './continuousLineageData'
import { ContinuousWorld, DEFAULT_CONTINUOUS_PARAMS } from './continuousWorld'
import type { LightRegime } from './evolutionWorld'

const AMBIENT_WHEN_LIGHT_IS_NOT_FOOD = 0.6
const byId = Object.fromEntries(CONTINUOUS_LINEAGE_DATA.map((f) => [f.id, f]))

function run(id: string, regime: LightRegime, seed: number, duration = 300) {
  const w = new ContinuousWorld(
    seed,
    {
      ...DEFAULT_CONTINUOUS_PARAMS,
      regime,
      founderGenomes: byId[id].genomes,
      energy: {
        ...DEFAULT_CONTINUOUS_PARAMS.energy,
        ambientIncome: regime === 'food' ? 0 : AMBIENT_WHEN_LIGHT_IS_NOT_FOOD,
      },
    },
    'diverse',
  )
  w.run(duration)
  const last = w.samples[w.samples.length - 1]
  const died = w.samples.find((x) => x.population === 0)
  return {
    alive: last.population,
    births: last.births,
    starved: last.starved,
    ofAge: last.diedOfAge,
    diedOutAt: died ? died.time : null,
    extinct: w.extinct,
  }
}

it('q18: each population in its own world and in the other one', () => {
  for (const id of ['W', 'Z']) {
    for (const regime of ['food', 'poison'] as LightRegime[]) {
      const rows = [1, 2, 3, 4, 5].map((s) => run(id, regime, s))
      const mean = (f: (r: (typeof rows)[0]) => number) =>
        rows.reduce((a, r) => a + f(r), 0) / rows.length
      const wipedOut = rows.filter((r) => r.extinct).length
      const own =
        (id === 'W' && regime === 'food') || (id === 'Z' && regime === 'poison')
      console.log(
        `  Population ${id} in a ${regime.toUpperCase().padEnd(6)} world ` +
          `${own ? '(its own)   ' : "(the other's)"} | ` +
          `alive ${mean((r) => r.alive).toFixed(1).padStart(4)}  ` +
          `born ${mean((r) => r.births).toFixed(0).padStart(3)}  ` +
          `starved ${mean((r) => r.starved).toFixed(1).padStart(5)}  ` +
          `old age ${mean((r) => r.ofAge).toFixed(0).padStart(3)}  ` +
          `died out ${wipedOut}/5`,
      )
    }
    console.log('')
  }
}, 600_000)

it('q18: can Z be made to fail in a food world', () => {
  /**
   * Z flees light, so in a world where the lights *are* the food it ought to
   * starve — and it does not, because four patches drifting around a 9-unit
   * arena find the creature even when the creature will not find them. Food
   * comes to you. That is the same effect that makes selection for approach
   * weak in Part 1.
   *
   * If a student-reachable setting makes the failure visible, Q18 works and the
   * handout can name it. Every knob below is one the World Options panel has.
   */
  const variants: [string, Record<string, unknown>][] = [
    ['default (drift 0.5, 4 patches)', {}],
    ['patches held still (drift 0)', { driftSpeed: 0 }],
    ['2 patches', { count: 2 }],
    ['2 patches, held still', { count: 2, driftSpeed: 0 }],
    ['smaller patches', { strength: DEFAULT_CONTINUOUS_PARAMS.food.strength * 0.6 }],
    ['2 small patches, held still', { count: 2, driftSpeed: 0, strength: DEFAULT_CONTINUOUS_PARAMS.food.strength * 0.6 }],
  ]
  console.log('\n  Both populations in a FOOD world. Z should struggle and W should not.')
  console.log('  ' + 'setting'.padEnd(32) + '|      W: alive starved died |      Z: alive starved died')
  console.log('  ' + '-'.repeat(94))
  for (const [label, food] of variants) {
    const cells = ['W', 'Z'].map((id) => {
      const rows = [1, 2, 3, 4, 5].map((seed) => {
        const w = new ContinuousWorld(
          seed,
          {
            ...DEFAULT_CONTINUOUS_PARAMS,
            regime: 'food',
            founderGenomes: byId[id].genomes,
            food: { ...DEFAULT_CONTINUOUS_PARAMS.food, ...food },
          },
          'diverse',
        )
        w.run(300)
        const last = w.samples[w.samples.length - 1]
        return { alive: last.population, starved: last.starved, extinct: w.extinct }
      })
      const m = (f: (r: (typeof rows)[0]) => number) =>
        rows.reduce((a, r) => a + f(r), 0) / rows.length
      return `${m((r) => r.alive).toFixed(1).padStart(10)} ${m((r) => r.starved).toFixed(1).padStart(7)} ${String(rows.filter((r) => r.extinct).length).padStart(4)}/5`
    })
    console.log('  ' + label.padEnd(32) + '|' + cells[0] + ' |' + cells[1])
  }
}, 900_000)
