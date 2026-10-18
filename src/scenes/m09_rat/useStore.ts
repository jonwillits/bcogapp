import { useSyncExternalStore } from 'react'

/** Subscribe a component to a store with `subscribe` and `version`. */
export function useStore<T extends { subscribe: (fn: () => void) => () => void; version: number }>(store: T): T {
  useSyncExternalStore(
    (fn) => store.subscribe(fn),
    () => store.version,
    () => store.version,
  )
  return store
}

import { useEffect, useReducer } from 'react'

/**
 * Subscribe at most every `ms` milliseconds: for a panel whose render is
 * the cost (Part 3's sixteen heat maps), so that the frame loop's bumps do
 * not redraw it every frame.
 */
export function useThrottledStore<T extends { subscribe: (fn: () => void) => () => void; version: number }>(store: T, ms: number): T {
  const [, force] = useReducer((x: number) => x + 1, 0)
  useEffect(() => {
    let last = 0
    let timer: ReturnType<typeof setTimeout> | null = null
    const unsub = store.subscribe(() => {
      const now = performance.now()
      if (now - last >= ms) {
        last = now
        force()
      } else if (!timer) {
        timer = setTimeout(() => {
          timer = null
          last = performance.now()
          force()
        }, ms - (now - last))
      }
    })
    return () => {
      unsub()
      if (timer) clearTimeout(timer)
    }
  }, [store, ms])
  return store
}
