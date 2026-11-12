import type { Item, Place } from './places'

/**
 * What each need requires (spec §7.3): the table shown on screen throughout
 * Part 3, because it describes the range and not any hominin's rule. **The
 * world reads it; no programmed hominin may** (spec §11, item 4, by the
 * structural test in `structure.test.ts`). The planners learn their own
 * version of it from what they see.
 */

export type Need = 'carcass' | 'marrow' | 'termites' | 'tubers'

export const NEEDS: readonly Need[] = ['carcass', 'marrow', 'termites', 'tubers']

/** The morning's cue, as seen or heard from camp. */
export type Cue = 'vultures' | 'hyenas' | 'rain' | 'dry'

export const CUES: readonly Cue[] = ['vultures', 'hyenas', 'rain', 'dry']

export interface NeedSpec {
  need: Need
  cue: Cue
  place: Place
  takes: Item
  /** The need's label on the table. */
  label: string
  cueLabel: string
  takesLabel: string
}

export const NEED_TABLE: Record<Need, NeedSpec> = {
  carcass: { need: 'carcass', cue: 'vultures', place: 'grassland', takes: 'flake', label: 'A carcass (the usual day)', cueLabel: 'vultures circling over the grassland', takesLabel: 'a flake, to cut meat' },
  marrow: { need: 'marrow', cue: 'hyenas', place: 'oldKill', takes: 'cobble', label: 'Bones with marrow', cueLabel: 'hyenas whooping at dawn near the old kill', takesLabel: 'a cobble, to break bones' },
  termites: { need: 'termites', cue: 'rain', place: 'mounds', takes: 'probe', label: 'Termites', cueLabel: 'winged termites rising from the mounds after rain in the night', takesLabel: 'a probe' },
  tubers: { need: 'tubers', cue: 'dry', place: 'flats', takes: 'diggingStick', label: 'Tubers', cueLabel: 'dry, cracked flats with withered vines', takesLabel: 'a digging stick' },
}

export function needOfCue(cue: Cue): Need {
  return NEEDS.find((n) => NEED_TABLE[n].cue === cue)!
}
