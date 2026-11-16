import { useEffect, useState } from 'react'

/**
 * A cursor that follows the audio clock: while something plays, the
 * component re-reads the clock on every animation frame and draws the
 * cursor where the clock says, so that the drawing can lag a frame but the
 * position is never the frame loop's (spec §3, §14).
 */
export function useAudioCursor(read: () => number | null, active: boolean): number | null {
  const [pos, setPos] = useState<number | null>(null)
  useEffect(() => {
    if (!active) {
      setPos(null)
      return
    }
    let raf = 0
    const tick = () => {
      const v = read()
      setPos(v)
      // For scripts/m13-timing.mjs only: what was drawn and when, in development builds.
      if ((import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV) (window as unknown as { __m13cursor?: unknown }).__m13cursor = { cursorS: v, at: performance.now() }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [active, read])
  return pos
}

/** A timed block stops when the page is hidden or loses focus (LAB_COMMON_FEATURES §7). */
export function useBlockGuard(running: boolean, onStop: (reason: string) => void): void {
  useEffect(() => {
    if (!running) return
    const hidden = () => {
      if (document.hidden) onStop('The page was hidden, so the block stopped.')
    }
    const blur = () => onStop('The page lost focus, so the block stopped.')
    document.addEventListener('visibilitychange', hidden)
    window.addEventListener('blur', blur)
    return () => {
      document.removeEventListener('visibilitychange', hidden)
      window.removeEventListener('blur', blur)
    }
  }, [running, onStop])
}

/** Keys for a block: the map from key to handler, bound while `active`. */
export function useKeys(active: boolean, map: Record<string, () => void>): void {
  useEffect(() => {
    if (!active) return
    const down = (e: KeyboardEvent) => {
      if (e.repeat) return
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return
      const fn = map[e.key.toLowerCase()] ?? map[e.key]
      if (fn) {
        e.preventDefault()
        fn()
      }
    }
    window.addEventListener('keydown', down)
    return () => window.removeEventListener('keydown', down)
  }, [active, map])
}
