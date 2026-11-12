import type { Rng } from '../../random'
import { canMake, type Errand, type Observation, type Standing } from '../range/acts'
import type { Cue } from '../range/needs'
import { ValueLearner } from './valueLearner'
import type { Dawn, Hominin } from './types'

/**
 * Learned value (spec §7.4.3): it chooses its errands by values learned from
 * the reward that followed its own errands on past mornings, by Lab 5's
 * Verdict setting. What it learns about is the morning's cue, what it is
 * holding, and where it is. It learns only from its own rewards: it reads
 * nothing another hominin does, and no model of the range (§12.2.1,
 * model-free).
 */
export class LearnedValue implements Hominin {
  readonly kind = 'learnedValue' as const
  private cue: Cue = 'vultures'
  private before: Standing | null = null
  readonly learner: ValueLearner

  constructor(rng: Rng, learner?: ValueLearner) {
    this.learner = learner ?? new ValueLearner(rng)
  }

  dawn(d: Dawn): void {
    this.cue = d.cue
    this.learner.cut()
    this.before = null
  }

  next(s: Standing, cue: Cue): Errand {
    return this.learner.choose(s, cue, (e) => available(s, e))
  }

  /** It credits its own errands, whoever chose them, and ignores everything else. */
  observe(_o: Observation): void {}

  /** The world reports each of the hominin's own errands with the standing before and after. */
  errandDone(before: Standing, errand: Errand, after: Standing): void {
    this.learner.transition(this.cue, before, errand, after)
    this.before = after
  }

  endDay(ate: boolean, final?: Standing): void {
    this.learner.endDay(this.cue, final ?? this.before ?? { place: 'camp', hands: [], elapsed: 0 }, ate)
  }

  clone(rng: Rng): Hominin {
    return new LearnedValue(rng, this.learner.clone(rng))
  }
}

/** Which errands a standing allows: a make needs its inputs in hand; everything else is open. */
export function available(s: Standing, e: Errand): boolean {
  return e.kind !== 'make' || canMake(s.hands, e.what)
}
