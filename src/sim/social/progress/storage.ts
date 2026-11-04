import { browserStorage, type RawStorage } from '../../progress/storage'

/**
 * Lab 11's one storage key (spec §4, §13 item 9). Nothing else in
 * `src/sim/social/` or the scene names the browser's storage: the reads and
 * writes are the shared layer's (`src/sim/progress/storage.ts`), wrapped so
 * that a failure falls back to memory, and `storage.test.ts` holds both
 * directories to this key and no other.
 */

export const STORAGE_KEY = 'bcogapp.m11.v1'

export const BROWSER_STORAGE: RawStorage = browserStorage(STORAGE_KEY)
export type { RawStorage }
