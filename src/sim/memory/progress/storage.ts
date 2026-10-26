/**
 * The one module in the repository that touches the browser's storage.
 *
 * Lab 10 saves progress on the student's own device (spec §4.2, Jon's
 * answer 4 of 2026-10-25), under exactly one key and nowhere else. Every
 * read and write is wrapped so that a failure, in a private window or with
 * site data blocked, falls back to memory rather than breaking the lab
 * (`store.ts`), and the scene then shows the line that results will be lost
 * if the page is closed. `storage.test.ts` holds this file to being the only
 * one in `progress/` that names the storage, and this key to being the only
 * key.
 */

export const STORAGE_KEY = 'bcogapp.m10.v1'

/** The saved text under the one key, or null when there is none or the storage cannot be read. */
export function readRaw(): string | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return typeof value === 'string' ? value : null
  } catch {
    return null
  }
}

/** Write the saved text under the one key. False when the storage cannot be written. */
export function writeRaw(text: string): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, text)
    return localStorage.getItem(STORAGE_KEY) === text
  } catch {
    return false
  }
}

/**
 * Whether the storage can be used: the key is read and its current value,
 * or an empty string when there is none, is written back. No other key is
 * ever touched, so the probe leaves nothing behind that a student did not
 * make.
 */
export function storageAvailable(): boolean {
  try {
    const current = localStorage.getItem(STORAGE_KEY)
    if (current === null) {
      localStorage.setItem(STORAGE_KEY, '')
      const ok = localStorage.getItem(STORAGE_KEY) === ''
      localStorage.removeItem(STORAGE_KEY)
      return ok
    }
    localStorage.setItem(STORAGE_KEY, current)
    return localStorage.getItem(STORAGE_KEY) === current
  } catch {
    return false
  }
}

/** What the store reads and writes: injectable, so a test can block the storage. */
export interface RawStorage {
  read: () => string | null
  write: (text: string) => boolean
}

export const BROWSER_STORAGE: RawStorage = { read: readRaw, write: writeRaw }
