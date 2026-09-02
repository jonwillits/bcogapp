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

it('q18: make Z fail visibly fast, without making W fail at all', () => {
  /**
   * Jon watched Z in a food world at two patches and reported the dwindle is
   * real but slow — hard for a student to see inside a lab period. So: which
   * student-reachable setting makes it quick, while leaving W untouched? Both
   * halves matter. A setting that starves everyone is not a demonstration that
   * W is at home and Z is not.
   *
   * Births per minute is tracked alongside the head count, because the panel
   * prints it and a rate can fall long before the arena looks empty.
   */
  const MARKS = [60, 120, 180, 300]
  const variants: [string, Record<string, unknown>, number][] = [
    ['2 patches                    ', { count: 2 }, 9],
    ['1 patch                      ', { count: 1 }, 9],
    ['1 patch, held still          ', { count: 1, driftSpeed: 0 }, 9],
    ['2 patches, bigger arena (11) ', { count: 2 }, 11],
    ['1 patch, bigger arena (11)   ', { count: 1 }, 11],
    ['2 patches, small             ', { count: 2, strength: DEFAULT_CONTINUOUS_PARAMS.food.strength * 0.6 }, 9],
    ['1 patch, small               ', { count: 1, strength: DEFAULT_CONTINUOUS_PARAMS.food.strength * 0.6 }, 9],
  ]

  console.log('\n  FOOD world. "alive" is the head count; "b/m" is births per minute.')
  console.log('  ' + ' '.repeat(31) + '|' + MARKS.map((t) => `  W @${t}s`.padStart(13)).join('') + ' |' + MARKS.map((t) => `  Z @${t}s`.padStart(13)).join(''))
  console.log('  ' + '-'.repeat(31 + 2 + 13 * MARKS.length * 2))

  for (const [label, food, bounds] of variants) {
    const cells = ['W', 'Z'].map((id) => {
      const per = MARKS.map(() => ({ alive: 0, rate: 0, dead: 0 }))
      const SEEDS = [1, 2, 3, 4, 5, 6]
      for (const seed of SEEDS) {
        const w = new ContinuousWorld(
          seed,
          {
            ...DEFAULT_CONTINUOUS_PARAMS,
            regime: 'food',
            bounds,
            founderGenomes: byId[id].genomes,
            food: { ...DEFAULT_CONTINUOUS_PARAMS.food, ...food },
          },
          'diverse',
        )
        w.run(MARKS[MARKS.length - 1])
        const s = w.samples
        const at = (t: number) => s.reduce((b, x) => (Math.abs(x.time - t) < Math.abs(b.time - t) ? x : b), s[0])
        MARKS.forEach((t, i) => {
          const x = at(t), prev = at(Math.max(0, t - 60))
          const dt = x.time - prev.time
          per[i].alive += x.population
          per[i].rate += dt > 0 ? ((x.births - prev.births) / dt) * 60 : 0
          if (x.population === 0) per[i].dead += 1
        })
      }
      return per
        .map((p) => `${(p.alive / SEEDS.length).toFixed(1).padStart(5)}/${(p.rate / SEEDS.length).toFixed(0).padStart(3)}${p.dead ? '†' : ' '}`)
        .join(' ')
    })
    console.log('  ' + label + '|' + cells[0] + ' |' + cells[1])
  }
  console.log('\n  († = at least one seed of six had emptied by then)')
}, 900_000)

it('q18: at patch sizes the slider can actually select', () => {
  /**
   * The slider runs 1.5 to 7 in steps of 0.5 and the default is 4, so the 2.4
   * that came out of the sweep is not a setting a student can choose. Only
   * reachable values below.
   */
  const MARKS = [60, 120, 180, 300]
  console.log('\n  FOOD world, 2 patches. "alive" head count / births per minute.')
  console.log('  ' + 'patch size'.padEnd(12) + '|' + MARKS.map((t) => `  W @${t}s`.padStart(13)).join('') + ' |' + MARKS.map((t) => `  Z @${t}s`.padStart(13)).join(''))
  console.log('  ' + '-'.repeat(12 + 2 + 13 * MARKS.length * 2))
  for (const strength of [3, 2.5, 2, 1.5]) {
    const cells = ['W', 'Z'].map((id) => {
      const SEEDS = [1, 2, 3, 4, 5, 6]
      const per = MARKS.map(() => ({ alive: 0, rate: 0, dead: 0 }))
      for (const seed of SEEDS) {
        const w = new ContinuousWorld(
          seed,
          {
            ...DEFAULT_CONTINUOUS_PARAMS,
            regime: 'food',
            founderGenomes: byId[id].genomes,
            food: { ...DEFAULT_CONTINUOUS_PARAMS.food, count: 2, strength },
          },
          'diverse',
        )
        w.run(MARKS[MARKS.length - 1])
        const s = w.samples
        const at = (t: number) => s.reduce((b, x) => (Math.abs(x.time - t) < Math.abs(b.time - t) ? x : b), s[0])
        MARKS.forEach((t, i) => {
          const x = at(t), prev = at(Math.max(0, t - 60))
          const dt = x.time - prev.time
          per[i].alive += x.population
          per[i].rate += dt > 0 ? ((x.births - prev.births) / dt) * 60 : 0
          if (x.population === 0) per[i].dead += 1
        })
      }
      return per.map((p) => `${(p.alive / SEEDS.length).toFixed(1).padStart(5)}/${(p.rate / SEEDS.length).toFixed(0).padStart(3)}${p.dead ? '†' : ' '}`).join(' ')
    })
    console.log('  ' + String(strength).padEnd(12) + '|' + cells[0] + ' |' + cells[1])
  }
  console.log('\n  († = at least one seed of six had emptied by then)')
}, 900_000)
