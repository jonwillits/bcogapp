import { useEffect, useRef, useState, type ReactNode } from 'react'
import { GLIMPSE_MS, type TestMode } from '../../sim/objects/config'
import { GrayImage } from './ui'

/**
 * The presenter for one trial (spec §7). In *glimpse* mode the image is
 * shown for about GLIMPSE_MS, scheduled on animation frames, then the mask,
 * then the response controls; the duration actually shown (first painted
 * frame of the image to the frame the mask replaced it) is reported for
 * every trial. In *free* mode the image stays until the student answers.
 *
 * `image` and `mask` are row-major grayscale arrays; `strokes` is the
 * alternative for a drawing, drawn as vectors.
 */
export function Glimpse({
  mode,
  trial,
  image,
  mask,
  size,
  display,
  children,
  onShown,
  render,
}: {
  mode: TestMode
  /** A key that changes per trial, so the presenter restarts. */
  trial: number
  image: Float32Array | null
  mask: Float32Array | null
  size: number
  display: number
  /** The response controls, rendered once the image is gone (glimpse) or at once (free). */
  children: ReactNode
  onShown?: (ms: number) => void
  /** Draw the stimulus some other way (a drawing's strokes). The mask still comes from `mask`. */
  render?: ReactNode
}) {
  const [phase, setPhase] = useState<'ready' | 'image' | 'mask'>(mode === 'free' ? 'image' : 'ready')
  const shownAt = useRef(0)
  const reported = useRef(false)

  useEffect(() => {
    setPhase(mode === 'free' ? 'image' : 'ready')
    reported.current = false
  }, [trial, mode])

  useEffect(() => {
    if (mode !== 'glimpse' || phase !== 'image') return
    let raf = 0
    let cancelled = false
    const started = performance.now()
    const finish = (ms: number) => {
      if (cancelled) return
      cancelled = true
      if (!reported.current) { reported.current = true; onShown?.(ms) }
      setPhase('mask')
    }
    // The first frame after the image is in the DOM is when it is painted.
    raf = requestAnimationFrame((t0) => {
      shownAt.current = t0
      const tick = (t: number) => {
        if (cancelled) return
        if (t - t0 >= GLIMPSE_MS - 8) finish(t - t0)
        else raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    })
    // If animation frames stop (a hidden tab, a throttled browser), the
    // mask must still come: a timer stands guard, and the logged duration
    // is then measured from the timer's start.
    const guard = setTimeout(() => finish(performance.now() - started), GLIMPSE_MS + 120)
    return () => { cancelled = true; cancelAnimationFrame(raf); clearTimeout(guard) }
  }, [phase, mode, onShown])

  const stage = (
    <div style={{ width: display, height: display, display: 'flex', alignItems: 'flex-start' }} data-phase={phase}>
      {phase === 'ready' && (
        <button type="button" onClick={() => setPhase('image')} style={{ padding: '10px 16px', fontSize: 13, borderRadius: 8, border: '1px solid var(--accent)', background: 'var(--accent)', color: '#0b111c', fontWeight: 600, cursor: 'pointer' }}>
          Show it
        </button>
      )}
      {phase === 'image' && (render ?? <GrayImage image={image} size={size} display={display} alt="the picture" testId="stimulus" />)}
      {phase === 'mask' && <GrayImage image={mask} size={size} display={display} alt="the mask" testId="mask" />}
    </div>
  )
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
      {stage}
      {(phase === 'mask' || mode === 'free') && <div style={{ width: '100%' }}>{children}</div>}
      {phase === 'image' && mode === 'glimpse' && <div style={{ fontSize: 11, color: 'var(--text-muted)', height: 16 }}>…</div>}
    </div>
  )
}
