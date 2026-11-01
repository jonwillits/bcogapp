import { describe, it } from 'vitest'
import { animalsByTests } from './matrix'
import { ANIMAL_IDS, animalById } from './animals'
import { TESTS } from './trial'

/**
 * Prints the animals × tests matrix over twenty seeds (spec §8.4), for the
 * learner with its usual experience and with many rooms, one layer and a
 * hidden layer:
 *
 *   PROBE=1 PROBE_DIR=src/sim/social/arena npx vitest run --disable-console-intercept -t "matrix:"
 */

describe('matrix:', () => {
  it('animals × tests, twenty seeds', () => {
    for (const [experience, hidden] of [
      ['usual', 0],
      ['many', 0],
      ['usual', 8],
      ['many', 8],
    ] as const) {
      const m = animalsByTests(20, experience, hidden)
      console.log(`\n== share of trials on the scored piece, mean over 20 seeds (sd), learner: ${experience}, hidden ${hidden}`)
      console.log('  ' + ''.padEnd(22) + TESTS.map((t) => t.id.padEnd(12)).join(''))
      for (const a of ANIMAL_IDS) console.log('  ' + animalById(a).label.padEnd(22) + TESTS.map((t) => `${m.mean[a][t.id].toFixed(2)} (${m.sd[a][t.id].toFixed(2)})`.padEnd(12)).join(''))
    }
  }, 600000)
})
