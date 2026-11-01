import { makeRng, type Rng } from '../../random'
import { DOORS, POSITIONS, inLineOfSight } from './geometry'
import type { ContestLearner } from './learner'
import { stageTrial, TRIALS_PER_RUN, type TestSpec, type View } from './trial'

/**
 * The five hidden subordinates (spec §8.4), each a program: it goes to its
 * rule's piece with probability 0.85 and the other with 0.15, and where its
 * rule gives no preference it goes at random. These are programs with
 * rules; the same choices do not show the same rule (§12, line 16).
 */

export type AnimalId = 'barriers' | 'gaze' | 'losNow' | 'losBefore' | 'learner'
export const ANIMAL_IDS: readonly AnimalId[] = ['barriers', 'gaze', 'losNow', 'losBefore', 'learner']
export const FOLLOWS_RULE = 0.85

export interface AnimalSpec {
  id: AnimalId
  /** The name after the reveal. */
  label: string
  /** Its rule, stated on screen after the commit, and in the diagnosis list without the letter. */
  rule: string
  /** The test that separates it, for the reveal. */
  separatedBy: string
}

export const ANIMALS: readonly AnimalSpec[] = [
  { id: 'barriers', label: 'Barriers', rule: 'goes to the piece nearer a barrier, opaque or clear', separatedBy: 'T2' },
  { id: 'gaze', label: 'Gaze', rule: 'goes to the piece farther from where the dominant is facing; with the dominant’s door shut, has no preference', separatedBy: 'T3' },
  { id: 'losNow', label: 'Line of sight now', rule: 'goes to the piece outside the dominant’s line of sight from its door, open or shut', separatedBy: 'T4, T5 and T6' },
  { id: 'losBefore', label: 'Line of sight before', rule: 'goes to the piece the present dominant did not watch being placed or moved, and otherwise to the piece outside its line of sight', separatedBy: 'T4, T5 and T6' },
  { id: 'learner', label: 'Learner', rule: 'predicts from a history of contests which piece the dominant is less likely to take, from layout and behavior alone, and goes there', separatedBy: 'T8' },
]

export const animalById = (id: AnimalId): AnimalSpec => ANIMALS.find((a) => a.id === id)!

/** The piece a rule prefers for a view, or null for no preference. */
export function preference(id: AnimalId, view: View, learner: ContestLearner | null): 0 | 1 | null {
  const outsideSight = (): 0 | 1 | null => {
    const eye = DOORS[view.door]
    const out = ([0, 1] as const).filter((k) => !inLineOfSight(eye, POSITIONS[view.pieces[k].position], view.barriers))
    return out.length === 1 ? out[0] : null
  }
  switch (id) {
    case 'barriers': {
      const near = ([0, 1] as const).filter((k) => view.pieces[k].barrier !== null)
      return near.length === 1 ? near[0] : null
    }
    case 'gaze':
      return view.facing === null ? null : ((1 - view.facing) as 0 | 1)
    case 'losNow':
      return outsideSight()
    case 'losBefore': {
      const unwatched = ([0, 1] as const).filter((k) => {
        const r = view.record[k]
        const placedUnseen = r.placedDoor === 'shut' || !r.presentAtPlacement
        const movedUnseen = r.moved !== null && (r.moved.door === 'shut' || !r.moved.presentAtMove)
        return placedUnseen || movedUnseen
      })
      return unwatched.length === 1 ? unwatched[0] : outsideSight()
    }
    case 'learner':
      return learner ? learner.choose(view) : null
  }
}

/** One animal's choice on one trial: its rule's piece with probability 0.85. */
export function choose(id: AnimalId, view: View, learner: ContestLearner | null, rng: Rng): 0 | 1 {
  const pref = preference(id, view, learner)
  if (pref === null) return rng.int(2) as 0 | 1
  return rng.next() < FOLLOWS_RULE ? pref : ((1 - pref) as 0 | 1)
}

export interface Trial {
  subordinate: 0 | 1
  dominant: 0 | 1 | -1
  got: boolean
  view: View
}

export interface RunResult {
  animal: AnimalId
  test: string
  trials: Trial[]
  /** The share of trials on which the animal went to the test's scored piece. */
  share: number
}

/** Ten trials of one test for one animal. */
export function runTest(id: AnimalId, test: TestSpec, learner: ContestLearner | null, seed: number, trials = TRIALS_PER_RUN): RunResult {
  const rng = makeRng(seed)
  const out: Trial[] = []
  for (let t = 0; t < trials; t++) {
    const staged = stageTrial(test, rng)
    const sub = choose(id, staged.view, learner, rng)
    out.push({ subordinate: sub, dominant: staged.dominant, got: staged.dominant !== sub, view: staged.view })
  }
  return { animal: id, test: test.id, trials: out, share: out.filter((t) => t.subordinate === test.scoredPiece).length / out.length }
}

/** The on-screen letters A to E are dealt to the five programs by the seed, so the order of the buttons says nothing (Lab 9's rule). */
export function lettersFor(seed: number): Record<AnimalId, string> {
  const rng = makeRng(seed ^ 0x5e7a)
  const letters = ['A', 'B', 'C', 'D', 'E']
  for (let i = letters.length - 1; i > 0; i--) {
    const j = rng.int(i + 1)
    ;[letters[i], letters[j]] = [letters[j], letters[i]]
  }
  const out = {} as Record<AnimalId, string>
  ANIMAL_IDS.forEach((id, i) => (out[id] = letters[i]))
  return out
}
