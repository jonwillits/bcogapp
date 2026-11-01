import { ANIMAL_IDS, runTest, type AnimalId } from './animals'
import { trainLearner, type Experience } from './experience'
import { TESTS } from './trial'

/**
 * The animals × tests matrix (spec §8.4): the share of trials on which
 * each animal went to the scored piece, for each test, averaged over
 * seeds, with the learner trained afresh for each seed. The record the
 * spec asks for; `matrix.probe.ts` prints it and `arena.test.ts` holds it
 * to the three checks.
 */

export interface Matrix {
  seeds: number
  experience: Experience
  hidden: number
  /** mean[animal][test] */
  mean: Record<AnimalId, Record<string, number>>
  sd: Record<AnimalId, Record<string, number>>
}

export function animalsByTests(seeds: number, experience: Experience = 'usual', hidden = 0, seedBase = 1000, trials = 10): Matrix {
  const cells: Record<AnimalId, Record<string, number[]>> = {} as never
  for (const a of ANIMAL_IDS) {
    cells[a] = {}
    for (const t of TESTS) cells[a][t.id] = []
  }
  for (let s = 0; s < seeds; s++) {
    const seed = seedBase + s
    const learner = trainLearner(experience, seed, hidden)
    for (const a of ANIMAL_IDS) for (const t of TESTS) cells[a][t.id].push(runTest(a, t, a === 'learner' ? learner : null, seed * 131 + t.id.charCodeAt(1) * 7 + ANIMAL_IDS.indexOf(a), trials).share)
  }
  const mean = {} as Matrix['mean']
  const sd = {} as Matrix['sd']
  for (const a of ANIMAL_IDS) {
    mean[a] = {}
    sd[a] = {}
    for (const t of TESTS) {
      const v = cells[a][t.id]
      const m = v.reduce((x, y) => x + y, 0) / v.length
      mean[a][t.id] = m
      sd[a][t.id] = Math.sqrt(v.reduce((x, y) => x + (y - m) * (y - m), 0) / Math.max(1, v.length - 1))
    }
  }
  return { seeds, experience, hidden, mean, sd }
}

/** Whether two animals differ by at least `gap` on some test among those given. */
export function separated(m: Matrix, a: AnimalId, b: AnimalId, tests: string[], gap = 0.3): string | null {
  for (const t of tests) if (Math.abs(m.mean[a][t] - m.mean[b][t]) >= gap) return t
  return null
}
