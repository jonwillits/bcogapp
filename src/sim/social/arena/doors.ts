/**
 * The names of the dominant's doors and of a barrier's sides, and nothing
 * else: a module the learner's features can read without reaching the
 * geometry (`structure.test.ts`). `geometry.ts` gives each door its place.
 */
export type DoorId = 'east' | 'east-low' | 'east-high' | 'top' | 'top-left' | 'top-right' | 'bottom' | 'bottom-left' | 'bottom-right'
export const DOOR_IDS: readonly DoorId[] = ['east', 'east-low', 'east-high', 'top', 'top-left', 'top-right', 'bottom', 'bottom-left', 'bottom-right']
export type Side = 'N' | 'E' | 'S' | 'W'
export const SIDES: readonly Side[] = ['N', 'E', 'S', 'W']
