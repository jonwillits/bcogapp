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
