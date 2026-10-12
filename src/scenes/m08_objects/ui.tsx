import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import { glimpseSummary, type GlimpseRecord } from '../../sim/objects/trials'
import { Note } from '../m06_brain/ui'

/**
 * Small shared pieces for the five tabs. Lab 6's rule holds: selection
 * changes a control's color and never its size (`layout.test.ts`). The
 * generic pieces (Btn, Choice, Note, GroupLabel, StageTitle, the panel
 * widths) are Lab 6's own, imported rather than copied.
 */
export { Btn, Choice, Note, GroupLabel, StageTitle, RIGHT_STYLE } from '../m06_brain/ui'

/**
 * The left column scrolls as one piece. Lab 6's panel capped its own height
 * and scrolled inside; with a tall header above it (the developer control)
 * the panel shrank to a sliver and could not be reached (Jon, 2026-10-12).
 */
export const PANEL_STYLE: CSSProperties = { width: 300, flexShrink: 0 }
export { BrainLayout as ObjectsLayout } from '../m06_brain/layout'

export type Tab = 'draw' | 'parts' | 'views' | 'noise' | 'closer'

export const TABS: { id: Tab; title: string; part: string }[] = [
  { id: 'draw', title: 'Draw', part: 'Part 1' },
  { id: 'parts', title: 'Parts', part: 'Part 2' },
  { id: 'views', title: 'Views', part: 'Part 3' },
  { id: 'noise', title: 'Noise', part: 'Part 4' },
  { id: 'closer', title: 'Closer', part: 'Closer' },
]

export function TabBar({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  return (
    <div style={{ display: 'flex', gap: 4 }} role="tablist">
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={tab === t.id}
          onClick={() => onChange(t.id)}
          style={{
            flex: 1,
            padding: '5px 2px',
            fontSize: 11.5,
            lineHeight: 1.15,
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border)',
            cursor: 'pointer',
            background: tab === t.id ? 'var(--accent)' : 'transparent',
            color: tab === t.id ? '#0b111c' : 'var(--text)',
            fontWeight: 600,
          }}
        >
          {t.title}
          <div style={{ fontSize: 8.5, fontWeight: 400, opacity: 0.8 }}>{t.part}</div>
        </button>
      ))}
    </div>
  )
}

/** A line of content: one of the things the scene says on its own face. */
export function Content({ children }: { children: ReactNode }) {
  return <p style={{ margin: 0, fontSize: 11.5, lineHeight: 1.45, color: 'var(--text)', borderLeft: '2px solid var(--accent)', paddingLeft: 8 }}>{children}</p>
}

/**
 * A block of fixed lines: one fact to a line, each worded one way, a line
 * with nothing to say yet left empty so nothing below it moves. Lab 7's
 * rule for live text.
 */
export function FixedLines({ lines, mono = true }: { lines: (string | null)[]; mono?: boolean }) {
  return (
    <div style={{ fontFamily: mono ? 'var(--font-mono)' : undefined, fontSize: 11.5, whiteSpace: 'pre', lineHeight: 1.5 }}>
      {lines.map((l, i) => (
        <div key={i} data-line={i}>{l ?? ' '}</div>
      ))}
    </div>
  )
}

/** A grayscale image from a row-major array in [0, 1], drawn to a canvas at a display size. Dark theme: images sit on their own light frame. */
export function GrayImage({ image, size, display, alt, testId }: { image: Float32Array | null; size: number; display: number; alt: string; testId?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const ctx = c.getContext('2d')
    if (!ctx) return
    if (!image) { ctx.clearRect(0, 0, size, size); return }
    const data = ctx.createImageData(size, size)
    for (let i = 0; i < size * size; i++) {
      const v = Math.round(Math.max(0, Math.min(1, image[i])) * 255)
      data.data[4 * i] = v; data.data[4 * i + 1] = v; data.data[4 * i + 2] = v; data.data[4 * i + 3] = 255
    }
    ctx.putImageData(data, 0, 0)
  }, [image, size])
  return <canvas ref={ref} width={size} height={size} role="img" aria-label={alt} data-image={testId} style={{ width: display, height: display, imageRendering: display > size ? 'pixelated' : 'auto', background: '#808080', borderRadius: 6, border: '1px solid var(--border)' }} />
}

/** A drawing as strokes, drawn as the pad draws it: ink on a pale ground, in the 256 space. */
export function StrokesView({ strokes, display, ink = '#0b111c', paper = '#f2f4f7', testId }: { strokes: [number[], number[]][]; display: number; ink?: string; paper?: string; testId?: string }) {
  return (
    <svg width={display} height={display} viewBox="0 0 256 256" role="img" data-strokes={testId} style={{ background: paper, borderRadius: 6, border: '1px solid var(--border)', display: 'block' }}>
      {strokes.map((s, i) => (
        <polyline key={i} points={s[0].map((x, k) => `${x},${s[1][k]}`).join(' ')} fill="none" stroke={ink} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </svg>
  )
}

/** A grid of names to answer with. The names are words, so nothing needs a licence. */
export function NameGrid({ names, value, onChange, columns = 4, disabled }: { names: string[]; value: string | null; onChange: (v: string) => void; columns?: number; disabled?: boolean }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: 4 }}>
      {names.map((n) => {
        const on = value === n
        return (
          <button
            key={n}
            type="button"
            disabled={disabled}
            aria-pressed={on}
            onClick={() => onChange(n)}
            style={{
              padding: '5px 4px',
              fontSize: 11.5,
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
              background: on ? 'var(--accent)' : 'var(--surface-2)',
              color: on ? '#0b111c' : 'var(--text)',
              cursor: disabled ? 'default' : 'pointer',
              fontWeight: 500,
            }}
          >
            {n}
          </button>
        )
      })}
    </div>
  )
}

/** A small key/value table for results. */
export function ResultTable({ head, rows, mono = true }: { head: string[]; rows: (string | number)[][]; mono?: boolean }) {
  const cell: CSSProperties = { border: '1px solid var(--border)', padding: '4px 6px', fontSize: 11.5, textAlign: 'right', fontFamily: mono ? 'var(--font-mono)' : undefined }
  const first: CSSProperties = { ...cell, textAlign: 'left', fontFamily: undefined }
  const h: CSSProperties = { ...cell, color: 'var(--text-muted)', fontSize: 10.5, fontFamily: undefined }
  return (
    <table style={{ borderCollapse: 'collapse', width: '100%' }}>
      <thead>
        <tr>{head.map((x, i) => <th key={i} style={i === 0 ? { ...h, textAlign: 'left' } : h}>{x}</th>)}</tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>{r.map((x, j) => <td key={j} style={j === 0 ? first : cell}>{x}</td>)}</tr>
        ))}
      </tbody>
    </table>
  )
}

export const pct = (v: number) => `${Math.round(v * 100)}%`

/** "an umbrella", "a mushroom". */
export const withArticle = (noun: string) => `${/^[aeiou]/i.test(noun) ? 'an' : 'a'} ${noun}`

/** The durations actually shown on this test's glimpse trials: count, mean and range, for the walk-through (spec §7). */
export function GlimpseSummary({ records }: { records: GlimpseRecord[] }) {
  const g = glimpseSummary(records)
  if (!g) return null
  return <Note data-glimpse-summary>Glimpses shown: {g.n}, mean {Math.round(g.mean)} ms, from {Math.round(g.min)} to {Math.round(g.max)} ms.</Note>
}
