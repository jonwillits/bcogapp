import type { ReactNode } from 'react'
import type { Tab } from './FishScene'

export { Note, Row, GroupLabel, PANEL_STYLE, RIGHT_STYLE } from '../m04_bilaterian/BilaterianScene'

const TABS: { id: Tab; title: string; sub: string }[] = [
  { id: 'world', title: 'World', sub: 'the stream' },
  { id: 'network', title: 'Network', sub: 'the wiring' },
  { id: 'learning', title: 'Learning', sub: 'the rule' },
  { id: 'decision', title: 'Decision', sub: 'the criterion' },
  { id: 'fish', title: 'Fish', sub: 'diagnosis' },
]

/** The five tabs. A selected tab changes color and nothing else, so the row never reflows. */
export function TabBar({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  return (
    <div style={{ display: 'flex', gap: 3 }}>
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          style={{
            flex: 1,
            padding: '5px 2px',
            fontSize: 11,
            lineHeight: 1.15,
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border)',
            cursor: 'pointer',
            background: tab === t.id ? 'var(--accent)' : 'transparent',
            color: tab === t.id ? '#0b111c' : 'var(--text)',
          }}
        >
          {t.title}
          <div style={{ fontSize: 8, opacity: 0.8 }}>{t.sub}</div>
        </button>
      ))}
    </div>
  )
}

/** A line of content: one of the things the scene says on its own face. */
export function Content({ children }: { children: ReactNode }) {
  return (
    <p style={{ margin: 0, fontSize: 11.5, lineHeight: 1.45, color: 'var(--text)', borderLeft: '2px solid var(--accent)', paddingLeft: 8 }}>{children}</p>
  )
}

/** A number box, for the by-hand calculator and the stakes. */
export function NumberBox({ label, value, onChange, width = 58 }: { label: string; value: number; onChange: (v: number) => void; width?: number }) {
  return (
    <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, fontSize: 12 }}>
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        style={{
          width,
          padding: '3px 5px',
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          textAlign: 'right',
          color: 'var(--text)',
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          borderRadius: 6,
        }}
      />
    </label>
  )
}

/** The slider for a rate that spans two orders of magnitude: even steps of the exponent, rounded to two figures. */
export function LogSlider({
  label,
  value,
  min,
  max,
  onChange,
  format,
  integer = false,
}: {
  label: string
  value: number
  min: number
  max: number
  onChange: (v: number) => void
  format?: (v: number) => string
  integer?: boolean
}) {
  const span = Math.log10(max / min)
  const pos = Math.log10(value / min) / span
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 12 }}>
      <span style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ color: 'var(--text-muted)' }}>{label}</span>
        <span style={{ fontFamily: 'var(--font-mono)' }}>{format ? format(value) : String(value)}</span>
      </span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.005}
        value={Math.max(0, Math.min(1, pos))}
        onChange={(e) => onChange(fromLog(parseFloat(e.target.value), min, max, integer))}
      />
    </label>
  )
}

/** A slider position in [0, 1] to a value on a log scale, at two significant figures (or a whole number). */
export function fromLog(pos: number, min: number, max: number, integer = false): number {
  const raw = min * Math.pow(max / min, pos)
  if (integer) return Math.max(min, Math.min(max, Math.round(raw)))
  const v = Number(raw.toPrecision(2))
  return Math.max(min, Math.min(max, v))
}
