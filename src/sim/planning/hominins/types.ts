import type { Rng } from '../../random'
import type { Errand, Observation, Standing } from '../range/acts'
import type { Cue } from '../range/needs'

/**
 * The five programmed hominins of Part 3 (spec §7.4) share this interface.
 * The world tells each one what the morning shows (`dawn`), asks it for one
 * errand at a time (`next`), tells it what it saw (`observe`), and closes the
 * day (`endDay`). A hominin learns only through `observe` and `endDay`, so
 * what each one reads can be checked (spec §11, item 4).
 */

export type HomininKind = 'adapted' | 'learnedValue' | 'copier' | 'shallow' | 'planner'

export const HOMININ_KINDS: readonly HomininKind[] = ['adapted', 'learnedValue', 'copier', 'shallow', 'planner']

export const HOMININ_LABEL: Record<HomininKind, string> = {
  adapted: 'Adapted',
  learnedValue: 'Learned value',
  copier: 'Copier',
  shallow: 'Shallow planner',
  planner: 'Planner',
}

export interface Dawn {
  /** The morning's cue, as seen or heard from camp. */
  cue: Cue
  /** Whether the elder is at camp this morning. */
  elderAtCamp: boolean
  /**
   * What the elder will do this morning, errand by errand, as a hominin
   * following her would see it. Null when she is away. Only the Copier reads
   * it, and only when she is at camp.
   */
  elderErrands: readonly Errand[] | null
}

export interface Hominin {
  readonly kind: HomininKind
  dawn(d: Dawn): void
  /** The next errand, given where it stands and what it holds. */
  next(s: Standing, cue: Cue): Errand
  observe(o: Observation): void
  /** One of its own errands happened, from `before` to `after`, whoever chose it. */
  errandDone(before: Standing, errand: Errand, after: Standing): void
  /** Midday: whether it ate, and where it stood with what in hand. */
  endDay(ate: boolean, final: Standing): void
  /** A copy with the same learned state and a stream of its own, so a run can start from the end of the history. */
  clone(rng: Rng): Hominin
}
