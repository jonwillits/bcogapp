import type { Rng } from '../../random'
import type { Errand, Observation, Standing } from '../range/acts'
import type { Cue } from '../range/needs'
import type { Dawn, Hominin } from './types'

/**
 * Adapted (spec §7.4.3): every morning, whatever the cue, it fetches a
 * cobble, makes a flake at the outcrop, and goes to the grassland, where the
 * usual need arrives. It uses what it carries on whatever need it meets
 * there. Nothing in it learns, and it reads no cue: its fixed pairing stands
 * for adaptation over its lineage's past, as §12.2.1's simplest procedure.
 */
const ERRANDS: readonly Errand[] = [{ kind: 'fetch', item: 'cobble' }, { kind: 'make', what: 'flake' }, { kind: 'go', place: 'grassland' }]

export class Adapted implements Hominin {
  readonly kind = 'adapted' as const
  private step = 0

  dawn(_d: Dawn): void {
    this.step = 0
  }

  next(_s: Standing, _cue: Cue): Errand {
    const e = ERRANDS[Math.min(this.step, ERRANDS.length - 1)]
    this.step++
    return e
  }

  observe(_o: Observation): void {}

  errandDone(_b: Standing, _e: Errand, _a: Standing): void {}

  endDay(_ate: boolean, _final: Standing): void {}

  clone(_rng: Rng): Hominin {
    return new Adapted()
  }
}
