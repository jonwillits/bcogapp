import type { CSSProperties, ReactNode } from 'react'
import { Btn, Note, GroupLabel, Choice } from '../m06_brain/ui'
import { Content, FixedLines, OrientingPanel, DotPlot, statusStyle } from '../m09_rat/ui'
import { PENDING_REFERENCE_LINE, type Reference } from '../../sim/social/references'

/**
 * Small shared pieces for the seven tabs. Lab 6's rule holds: selection
 * changes a control's color and never its size (`layout.test.ts`). Lab 7's
 * rule holds: live text never wraps or changes length, and a status readout
 * that fills in over time is a block of fixed lines. Lab 9's conventions
 * hold: a button's or key's name in running text is in quotes, and a block
 * of numbers is a block of aligned rows. Every text is selectable.
 */
export { Btn, Note, GroupLabel, Choice, Content, FixedLines, OrientingPanel, DotPlot, statusStyle }
export { useStore, useThrottledStore } from '../m09_rat/useStore'
export { StagePanel, row } from '../m10_memory/ui'

export type Tab = 'open' | 'partners' | 'tournament' | 'shapes' | 'arena' | 'groups' | 'mirror'

/** The tabs: neutral names that hint at nothing Part 3 or Part 5 tests (§13, items 2 and 3). */
export const TABS: { id: Tab; title: string; part: string }[] = [
  { id: 'open', title: 'Open', part: 'Part 0' },
  { id: 'partners', title: 'Partners', part: 'Part 1' },
  { id: 'tournament', title: 'Tournament', part: 'Part 2' },
  { id: 'shapes', title: 'Shapes', part: 'Part 3' },
  { id: 'arena', title: 'Arena', part: 'Part 4' },
  { id: 'groups', title: 'Groups', part: 'Part 5' },
  { id: 'mirror', title: 'Mirror', part: 'Part 6' },
]

export const PART_TITLES: Record<Tab, string> = {
  open: 'Part 0 — General Lab Instructions',
  partners: 'Part 1 — Six Partners',
  tournament: 'Part 2 — The Tournament',
  shapes: 'Part 3 — Shapes and Paths',
  arena: 'Part 4 — What the Dominant Saw',
  groups: 'Part 5 — Two Groups',
  mirror: 'Part 6 — Doing and Watching',
}

export function TabBar({ tab, onChange, locked }: { tab: Tab; onChange: (t: Tab) => void; locked: Partial<Record<Tab, string | null>> }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }} role="tablist">
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={tab === t.id}
          title={locked[t.id] ?? undefined}
          onClick={() => onChange(t.id)}
          style={{
            flex: '1 1 23%',
            padding: '5px 1px',
            fontSize: 10.5,
            lineHeight: 1.15,
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border)',
            cursor: 'pointer',
            background: tab === t.id ? 'var(--accent)' : 'transparent',
            color: tab === t.id ? '#0b111c' : locked[t.id] ? 'var(--text-muted)' : 'var(--text)',
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

export const PANEL_STYLE: CSSProperties = { width: 310, maxHeight: 'calc(100vh - 84px)', overflowY: 'auto' }
export const RIGHT_STYLE: CSSProperties = { width: 440, maxHeight: 'calc(100vh - 84px)', overflowY: 'auto' }

/** A tab that cannot open yet says why, in one line, and names the part that unlocks it (§4.2). */
export function LockedPanel({ title, reason, children }: { title: string; reason: string; children?: ReactNode }) {
  return (
    <div
      data-stage="locked"
      style={{ position: 'absolute', left: 'calc(50% + var(--stage-shift, 0px))', top: 24, transform: 'translateX(-50%)', width: 'min(560px, calc(100vw - 800px))', minWidth: 380, padding: '16px 20px', borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12.5, lineHeight: 1.55, display: 'flex', flexDirection: 'column', gap: 10, pointerEvents: 'auto' }}
    >
      <div style={{ fontSize: 14, fontWeight: 600 }}>{title}</div>
      <Note>{reason}</Note>
      {children}
    </div>
  )
}

/** Two choices as a pair of large buttons, the chosen one colored: Cooperate or Defect, and the like. */
export function BigChoice<T extends string>({ value, options, onChange, testId, disabled }: { value: T | null; options: { id: T; label: string }[]; onChange: (v: T) => void; testId?: string; disabled?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 8 }} data-choice={testId}>
      {options.map((o) => {
        const on = value === o.id
        return (
          <button
            key={o.id}
            type="button"
            aria-pressed={on}
            disabled={disabled}
            onClick={() => onChange(o.id)}
            style={{ flex: 1, padding: '10px 0', fontSize: 14, fontWeight: 600, borderRadius: 'var(--radius-sm)', border: '2px solid var(--border)', background: on ? 'var(--accent)' : 'var(--surface-2)', color: on ? '#0b111c' : 'var(--text)', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1 }}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/** A reference panel (spec §11): the source, the values or the pending line, how the procedure differed. */
export function ReferencePanel({ reference }: { reference: Reference }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 10px', borderRadius: 8, border: '1px dashed var(--border)' }} data-reference={reference.id} data-pending={reference.values ? undefined : true}>
      <GroupLabel>{reference.title}</GroupLabel>
      <Note>{reference.source}; {reference.where}.</Note>
      {reference.values ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {reference.values.map((v) => (
            <Note key={v.label} style={{ color: 'var(--text)' }}>
              {v.label}: <span style={{ fontFamily: 'var(--font-mono)' }}>{typeof v.value === 'number' ? v.value.toFixed(2) : v.value}</span>
            </Note>
          ))}
        </div>
      ) : (
        <Content>{PENDING_REFERENCE_LINE}</Content>
      )}
      <Note>How it differed: {reference.differed}</Note>
    </div>
  )
}

/**
 * A line plot of several series over a shared x, as a small SVG, with the
 * legend under it as wrapped text so that it never sits over the curves
 * or the axis (Jon, 2026-11-02). A mark is a dashed vertical line with a
 * label at the top or the bottom.
 */
export function LinePlot({ series, width = 420, height = 180, yMax = 1, xLabel, yLabel, marks }: { series: { label: string; color: string; data: number[] }[]; width?: number; height?: number; yMax?: number; xLabel: string; yLabel: string; marks?: { x: number; label: string; color?: string; at?: 'top' | 'bottom' }[] }) {
  const pad = { l: 36, r: 10, t: 10, b: 26 }
  const n = Math.max(2, ...series.map((s) => s.data.length))
  const X = (i: number) => pad.l + (i / (n - 1)) * (width - pad.l - pad.r)
  const Y = (v: number) => height - pad.b - (Math.min(yMax, Math.max(0, v)) / yMax) * (height - pad.t - pad.b)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxWidth: '100%' }} data-lineplot>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block', background: 'var(--bg)', borderRadius: 8, maxWidth: '100%' }} role="img" aria-label={`${yLabel} against ${xLabel}`}>
        <line x1={pad.l} y1={Y(0)} x2={width - pad.r} y2={Y(0)} stroke="var(--border)" />
        <line x1={pad.l} y1={pad.t} x2={pad.l} y2={Y(0)} stroke="var(--border)" />
        {marks?.map((m) => (
          <g key={m.label} data-mark={m.label}>
            <line x1={X(m.x)} y1={pad.t} x2={X(m.x)} y2={Y(0)} stroke={m.color ?? 'var(--sensor)'} strokeDasharray="3 3" />
            <text x={X(m.x) + 3} y={m.at === 'bottom' ? Y(0) - 4 : pad.t + 10} fontSize={9} fill={m.color ?? 'var(--sensor)'}>
              {m.label}
            </text>
          </g>
        ))}
        {series.map((s) => (
          <path key={s.label} d={s.data.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ')} fill="none" stroke={s.color} strokeWidth={1.6} data-series={s.label} />
        ))}
        <text x={(pad.l + width - pad.r) / 2} y={height - 8} fontSize={10} textAnchor="middle" fill="var(--text-muted)">
          {xLabel}
        </text>
        <text x={10} y={(pad.t + height - pad.b) / 2} fontSize={10} textAnchor="middle" fill="var(--text-muted)" transform={`rotate(-90 10 ${(pad.t + height - pad.b) / 2})`}>
          {yLabel}
        </text>
        <text x={pad.l - 4} y={pad.t + 3} fontSize={9} textAnchor="end" fill="var(--text-muted)">
          {yMax}
        </text>
        <text x={pad.l - 4} y={Y(0) + 3} fontSize={9} textAnchor="end" fill="var(--text-muted)">
          0
        </text>
        <text x={width - pad.r} y={Y(0) + 12} fontSize={9} textAnchor="end" fill="var(--text-muted)">
          {n - 1}
        </text>
      </svg>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 12px', fontSize: 10.5, color: 'var(--text-muted)', maxWidth: width }} data-legend>
        {series.map((s) => (
          <span key={s.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 10, height: 3, background: s.color, display: 'inline-block', borderRadius: 1 }} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  )
}

/** Several choices at once, as toggles: a checked one changes color and nothing else. */
export function MultiChoice<T extends string>({ values, options, onToggle, testId }: { values: T[]; options: { id: T; label: string; title?: string }[]; onToggle: (v: T) => void; testId?: string }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }} data-multi={testId}>
      {options.map((o) => {
        const on = values.includes(o.id)
        return (
          <button key={o.id} type="button" title={o.title} aria-pressed={on} onClick={() => onToggle(o.id)} style={{ padding: '4px 9px', fontSize: 11.5, borderRadius: 999, border: '1px solid var(--border)', cursor: 'pointer', background: on ? 'var(--accent)' : 'var(--surface-2)', color: on ? '#0b111c' : 'var(--text)', fontWeight: 500 }}>
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/** A hex color as its three channels, for a canvas. */
export function rgbOf(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

/** The six entries' colors, one a rule, the student's (yellow, apart from Always defect's red on the grid; Jon's walk 2026-11-02), and Predictor's. */
export const ENTRY_COLORS: Record<string, string> = { allc: '#34d399', alld: '#f87171', tft: '#4f9cff', grim: '#c084fc', wsls: '#f0a94b', stft: '#67e8f9', predictor: '#e7ecf3', mine: '#fde047' }

/** A move as a short word. */
export const moveWord = (m: 'C' | 'D'): string => (m === 'C' ? 'Cooperate' : 'Defect')
