import type { Errand } from './acts'
import { NEED_TABLE, type Need } from './needs'

/**
 * The preparation for each need, as the world and the elder know it (spec
 * §7.3's last column): the errands that end holding what the need takes, at
 * the need's place. Read by the world, the elder and the 15% deviation; never
 * by a programmed hominin's procedure.
 */
export function chainFor(need: Need): Errand[] {
  const spec = NEED_TABLE[need]
  const prep: Errand[] =
    spec.takes === 'flake'
      ? [{ kind: 'fetch', item: 'cobble' }, { kind: 'make', what: 'flake' }]
      : spec.takes === 'cobble'
        ? [{ kind: 'fetch', item: 'cobble' }]
        : spec.takes === 'probe'
          ? [{ kind: 'fetch', item: 'sapling' }, { kind: 'make', what: 'probe' }]
          : [{ kind: 'fetch', item: 'cobble' }, { kind: 'make', what: 'flake' }, { kind: 'fetch', item: 'sapling' }, { kind: 'make', what: 'diggingStick' }]
  return [...prep, { kind: 'go', place: spec.place }]
}
