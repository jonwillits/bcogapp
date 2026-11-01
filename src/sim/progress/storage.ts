/**
 * The browser's storage behind one key, for any lab that saves progress.
 *
 * Every read and write is wrapped so that a failure, in a private window or
 * with site data blocked, falls back to memory rather than breaking the lab
 * (`store.ts`), and the scene then shows the line that results will be lost
 * if the page is closed. A lab names its one key once, in its own
 * `storage.ts`, and nothing else in the lab touches the storage: Lab 11's
 * `storage.test.ts` holds its directories to that.
 *
 * Lab 10 keeps its own copy of these three functions in
 * `src/sim/memory/progress/storage.ts`, written before this layer existed
 * and pinned by its own test; the key there is `bcogapp.m10.v1`.
 */

/** What a store reads and writes: injectable, so a test can block the storage. */
export interface RawStorage {
  read: () => string | null
  write: (text: string) => boolean
}

/** A storage behind one key in the browser's local storage. */
export function browserStorage(key: string): RawStorage {
  return {
    read: () => {
      try {
        const value = localStorage.getItem(key)
        return typeof value === 'string' ? value : null
      } catch {
        return null
      }
    },
    write: (text: string) => {
      try {
        localStorage.setItem(key, text)
        return localStorage.getItem(key) === text
      } catch {
        return false
      }
    },
  }
}
