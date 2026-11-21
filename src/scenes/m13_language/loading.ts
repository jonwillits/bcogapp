/**
 * Loading with a count (Jon, 2026-11-20; walk-through §12 item 7): a
 * step's files are fetched all at once, and the store keeps a count of
 * how many are in, for the loading line. The downloads are small (a
 * part's two dozen files come in tens of milliseconds from the dev
 * server); the count is there so that a slow connection shows movement.
 */
export interface LoadProgress {
  done: number
  total: number
  /** What is counted: `sound` for files, `syllable` for Part 1 Step 4's prepared patches. */
  what: 'sound' | 'file' | 'syllable'
}

/** Run every task at once; report the count as each one finishes. */
export async function loadAll<T>(tasks: (() => Promise<T>)[], onProgress: (p: LoadProgress) => void, what: LoadProgress['what'] = 'sound'): Promise<T[]> {
  let done = 0
  onProgress({ done, total: tasks.length, what })
  return Promise.all(
    tasks.map(async (t) => {
      const r = await t()
      done += 1
      onProgress({ done, total: tasks.length, what })
      return r
    }),
  )
}

/** The loading line's text: what is loading and the count. */
export function loadingText(subject: string, p: LoadProgress | null): string {
  if (!p || p.total === 0) return `Loading ${subject}.`
  const unit = p.what === 'syllable' ? 'syllables' : p.what === 'file' ? 'files' : 'sounds'
  return p.what === 'syllable' ? `Preparing ${subject}: ${p.done} of ${p.total} ${unit}.` : `Loading ${subject}: ${p.done} of ${p.total} ${unit}.`
}
