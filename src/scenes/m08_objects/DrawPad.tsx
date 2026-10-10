import { useRef, useState } from 'react'
import type { Drawing } from '../../sim/objects/raster'
import { Btn } from './ui'

/**
 * The drawing pad: pointer strokes captured in the 256 × 256 space Quick,
 * Draw! uses, kept as vectors until the last moment, since Part 2's erasers
 * work on strokes. *Undo* removes the last stroke, *Clear* all of them.
 * Nothing drawn here leaves the page; `privacy.test.ts` holds the scene to
 * that.
 */
export function DrawPad({ drawing, onChange, size = 256, prompt }: { drawing: Drawing; onChange: (d: Drawing) => void; size?: number; prompt?: string }) {
  const svgRef = useRef<SVGSVGElement>(null)
  // The stroke being drawn lives in a ref, not state: pointer events can
  // arrive faster than React re-renders, and a stroke must not lose points.
  const liveRef = useRef<[number[], number[]] | null>(null)
  const [, redraw] = useState(0)
  // The strokes as last emitted, so two strokes ending before a re-render both survive.
  const strokesRef = useRef(drawing)
  const emitted = useRef(drawing)
  if (drawing !== emitted.current) { strokesRef.current = drawing; emitted.current = drawing }

  const point = (e: React.PointerEvent): [number, number] => {
    const r = svgRef.current!.getBoundingClientRect()
    const x = ((e.clientX - r.left) / r.width) * 256
    const y = ((e.clientY - r.top) / r.height) * 256
    return [Math.max(0, Math.min(255, Math.round(x))), Math.max(0, Math.min(255, Math.round(y)))]
  }
  const start = (e: React.PointerEvent) => {
    try { (e.target as Element).setPointerCapture?.(e.pointerId) } catch { /* synthetic events have no capture */ }
    const [x, y] = point(e)
    liveRef.current = [[x], [y]]
    redraw((n) => n + 1)
  }
  const move = (e: React.PointerEvent) => {
    const live = liveRef.current
    if (!live) return
    const [x, y] = point(e)
    const lx = live[0][live[0].length - 1], ly = live[1][live[1].length - 1]
    if (Math.abs(x - lx) + Math.abs(y - ly) < 2) return
    live[0].push(x); live[1].push(y)
    redraw((n) => n + 1)
  }
  const end = () => {
    const live = liveRef.current
    if (!live) return
    liveRef.current = null
    strokesRef.current = [...strokesRef.current, live]
    emitted.current = strokesRef.current
    onChange(strokesRef.current)
  }
  const all = liveRef.current ? [...drawing, liveRef.current] : drawing

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: size }}>
      {prompt && <div style={{ fontSize: 12.5 }}><b>Draw this:</b> {prompt}</div>}
      <svg
        ref={svgRef}
        width={size}
        height={size}
        viewBox="0 0 256 256"
        data-pad
        style={{ background: '#f2f4f7', borderRadius: 8, border: '1px solid var(--border)', touchAction: 'none', cursor: 'crosshair', display: 'block' }}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        onPointerLeave={end}
      >
        {all.map((s, i) => (
          <polyline key={i} points={s[0].map((x, k) => `${x},${s[1][k]}`).join(' ')} fill="none" stroke="#0b111c" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
        ))}
      </svg>
      <div style={{ display: 'flex', gap: 6 }}>
        <Btn small onClick={() => onChange(drawing.slice(0, -1))} disabled={!drawing.length}>Undo</Btn>
        <Btn small onClick={() => onChange([])} disabled={!drawing.length}>Clear</Btn>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: 'var(--text-muted)', alignSelf: 'center' }}>{drawing.length} stroke{drawing.length === 1 ? '' : 's'}</span>
      </div>
    </div>
  )
}
