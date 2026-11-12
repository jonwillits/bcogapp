import type { Rng } from '../../random'
import type { Errand, Observation, Standing } from '../range/acts'
import type { Cue } from '../range/needs'
import { ValueLearner } from './valueLearner'
import { available } from './learnedValue'
import type { Dawn, Hominin } from './types'

/**
 * Copier (spec §7.4.3): on a morning when the elder is at camp, it picks up
 * and makes what it sees the elder pick up and make that morning, and goes
 * where she goes. On a morning when the elder is away, it chooses as Learned
 * value does, from its own learned values, which its own rewards taught it
 * (the rewards that followed copying included). It reads the elder's errands
 * only on the morning in question, and no model of the range.
 */
export class Copier implements Hominin {
  readonly kind = 'copier' as const
  private cue: Cue = 'vultures'
  private copying: Errand[] | null = null
  private before: Standing | null = null

  readonly fallback: ValueLearner

  constructor(rng: Rng, fallback?: ValueLearner) {
    this.fallback = fallback ?? new ValueLearner(rng)
  }

  dawn(d: Dawn): void {
    this.cue = d.cue
    this.fallback.cut()
    this.before = null
    this.copying = d.elderAtCamp && d.elderErrands ? [...d.elderErrands] : null
  }

  next(s: Standing, cue: Cue): Errand {
    if (this.copying) {
      const e = this.copying.shift()
      if (e) return e
      return { kind: 'stay' }
    }
    return this.fallback.choose(s, cue, (e) => available(s, e))
  }

  observe(_o: Observation): void {}

  errandDone(before: Standing, errand: Errand, after: Standing): void {
    this.fallback.transition(this.cue, before, errand, after)
    this.before = after
  }

  endDay(ate: boolean, final?: Standing): void {
    this.fallback.endDay(this.cue, final ?? this.before ?? { place: 'camp', hands: [], elapsed: 0 }, ate)
  }

  clone(rng: Rng): Hominin {
    return new Copier(rng, this.fallback.clone(rng))
  }
}
