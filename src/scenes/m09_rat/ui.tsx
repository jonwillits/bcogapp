import type { CSSProperties, ReactNode } from 'react'
import { Btn, Note, GroupLabel, Choice } from '../m06_brain/ui'

/**
 * Small shared pieces for the five tabs. Lab 6's rule holds: selection
 * changes a control's color and never its size (`layout.test.ts`). Lab 7's
 * rule holds: live text never wraps or changes length, and a status readout
 * that fills in over time is a block of fixed lines.
 */
export { Btn, Note, GroupLabel, Choice } from '../m06_brain/ui'

export type Tab = 'world' | 'home' | 'rats' | 'cells' | 'patches'

export const TABS: { id: Tab; title: string; part: string }[] = [
  { id: 'world', title: 'World', part: 'Part 0' },
  { id: 'home', title: 'Home', part: 'Part 1' },
  { id: 'rats', title: 'Rats', part: 'Part 2' },
  { id: 'cells', title: 'Cells', part: 'Part 3' },
  { id: 'patches', title: 'Patches', part: 'Closer' },
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

/** A block of fixed lines: one fact to a line, each worded one way, a line with nothing to say yet left empty. */
export function FixedLines({ lines, mono = true, testId, lineStyle }: { lines: (string | null)[]; mono?: boolean; testId?: string; lineStyle?: (line: string | null, i: number) => CSSProperties | undefined }) {
  return (
    <div data-lines={testId} style={{ fontFamily: mono ? 'var(--font-mono)' : undefined, fontSize: 11.5, whiteSpace: 'pre', lineHeight: 1.5, overflow: 'hidden' }}>
      {lines.map((l, i) => (
        <div key={i} data-line={i} style={lineStyle?.(l, i)}>
          {l ?? ' '}
        </div>
      ))}
    </div>
  )
}

/** The status box's phase line changes color on the return: color only, never size (Jon's rule). */
export const statusStyle = (returnLine: string) => (l: string | null) => (l === returnLine ? { color: 'var(--accent)' } : undefined)

/**
 * An orienting screen before a test (Lab 8's rule): the description is the
 * panel over the view (`OrientingPanel`); the side panel keeps how long the
 * step takes and Begin (Jon, 2026-10-20: the explanation belongs in the
 * middle of the screen, the buttons at the side).
 */
export function Intro({ time, onBegin, disabled, extra }: { time: string; onBegin: () => void; disabled?: boolean; extra?: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} data-intro>
      <Note>What will happen is described over the view.</Note>
      <Content>{time}</Content>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <Btn primary onClick={onBegin} disabled={disabled}>
          Begin
        </Btn>
        {extra}
      </div>
    </div>
  )
}

/** The description of a step, centered over the view while the step waits to begin: the title, what will happen, the content lines, and what to press. */
export function OrientingPanel({ title, lines, content, footer }: { title: string; lines: string[]; content?: string[]; footer: string }) {
  return (
    <div
      data-orienting
      style={{ position: 'absolute', left: '50%', top: 24, transform: 'translateX(-50%)', width: 'min(560px, calc(100vw - 780px))', minWidth: 360, maxHeight: 'calc(100vh - 170px)', overflowY: 'auto', padding: '16px 20px', borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12.5, lineHeight: 1.55, display: 'flex', flexDirection: 'column', gap: 10 }}
    >
      <div style={{ fontSize: 14, fontWeight: 600 }}>{title}</div>
      <GroupLabel>What will happen</GroupLabel>
      {lines.map((l) => (
        <p key={l} style={{ margin: 0 }}>
          {l}
        </p>
      ))}
      {content?.map((l) => (
        <Content key={l}>{l}</Content>
      ))}
      <div style={{ color: 'var(--text-muted)' }}>{footer}</div>
    </div>
  )
}

/** A row of on-screen keys for touch screens: the same commands as the keyboard. */
export function DrivePad({ onKey }: { onKey: (k: 'forward' | 'back' | 'left' | 'right', down: boolean) => void }) {
  const key = (k: 'forward' | 'back' | 'left' | 'right', label: string) => (
    <button
      type="button"
      aria-label={k}
      onPointerDown={(e) => {
        e.preventDefault()
        onKey(k, true)
      }}
      onPointerUp={() => onKey(k, false)}
      onPointerLeave={() => onKey(k, false)}
      onPointerCancel={() => onKey(k, false)}
      style={{ width: 40, height: 34, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 14, fontWeight: 600, cursor: 'pointer', touchAction: 'none' }}
    >
      {label}
    </button>
  )
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 40px)', gap: 4, justifyContent: 'center' }} data-drivepad>
      <span />
      {key('forward', '▲')}
      <span />
      {key('left', '◀')}
      {key('back', '▼')}
      {key('right', '▶')}
    </div>
  )
}

export const PANEL_STYLE: CSSProperties = { width: 310, maxHeight: 'calc(100vh - 84px)', overflowY: 'auto' }
export const RIGHT_STYLE: CSSProperties = { width: 380, maxHeight: 'calc(100vh - 84px)', overflowY: 'auto' }
export const WIDE_RIGHT_STYLE: CSSProperties = { width: 440, maxHeight: 'calc(100vh - 84px)', overflowY: 'auto' }

/** Meters, one decimal, as a fixed-width field. */
export const m1 = (v: number) => `${v.toFixed(1).padStart(5)} m`
export const pct = (v: number) => `${Math.round(v * 100)}%`

/** A small SVG plot of points, x against y, with optional reference lines. */
export function DotPlot({ points, xLabel, yLabel, width = 300, height = 150, xMax, yMax, marks, legend }: { points: { x: number; y: number; label?: string; color?: string }[]; xLabel: string; yLabel: string; width?: number; height?: number; xMax?: number; yMax?: number; marks?: { x: number; label: string }[]; legend?: { label: string; color: string }[] }) {
  const pad = { l: 36, r: 10, t: 10, b: 28 }
  const mx = xMax ?? Math.max(1, ...points.map((p) => p.x), ...(marks ?? []).map((m) => m.x)) * 1.1
  const my = yMax ?? Math.max(1, ...points.map((p) => p.y)) * 1.15
  const X = (x: number) => pad.l + (x / mx) * (width - pad.l - pad.r)
  const Y = (y: number) => height - pad.b - (y / my) * (height - pad.t - pad.b)
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block', background: 'var(--bg)', borderRadius: 8 }} role="img" aria-label={`${yLabel} against ${xLabel}`}>
      <line x1={pad.l} y1={Y(0)} x2={width - pad.r} y2={Y(0)} stroke="var(--border)" />
      <line x1={pad.l} y1={pad.t} x2={pad.l} y2={Y(0)} stroke="var(--border)" />
      {marks?.map((m) => (
        <g key={m.label}>
          <line x1={X(m.x)} y1={pad.t} x2={X(m.x)} y2={Y(0)} stroke="var(--sensor)" strokeDasharray="3 3" />
          <text x={X(m.x) + 3} y={pad.t + 10} fontSize={9} fill="var(--sensor)">
            {m.label}
          </text>
        </g>
      ))}
      {points.map((p, i) => (
        <circle key={i} cx={X(p.x)} cy={Y(p.y)} r={3.5} fill={p.color ?? 'var(--accent)'}>
          {p.label && <title>{p.label}</title>}
        </circle>
      ))}
      {legend?.map((l, i) => (
        <g key={l.label} data-legend={l.label}>
          <circle cx={pad.l + 8} cy={pad.t + 8 + i * 12} r={3.5} fill={l.color} />
          <text x={pad.l + 16} y={pad.t + 11 + i * 12} fontSize={9} fill="var(--text-muted)">
            {l.label}
          </text>
        </g>
      ))}
      <text x={(pad.l + width - pad.r) / 2} y={height - 8} fontSize={10} textAnchor="middle" fill="var(--text-muted)">
        {xLabel}
      </text>
      <text x={10} y={(pad.t + height - pad.b) / 2} fontSize={10} textAnchor="middle" fill="var(--text-muted)" transform={`rotate(-90 10 ${(pad.t + height - pad.b) / 2})`}>
        {yLabel}
      </text>
      <text x={pad.l - 4} y={Y(0) + 3} fontSize={9} textAnchor="end" fill="var(--text-muted)">
        0
      </text>
      <text x={pad.l - 4} y={pad.t + 3} fontSize={9} textAnchor="end" fill="var(--text-muted)">
        {my.toFixed(my < 5 ? 1 : 0)}
      </text>
      <text x={width - pad.r} y={Y(0) + 12} fontSize={9} textAnchor="end" fill="var(--text-muted)">
        {mx.toFixed(0)}
      </text>
    </svg>
  )
}

/** The 0-to-1 line of Step 5: 0 at the true nest, 1 at where the moved landmarks point. */
export function ConflictLine({ score, others }: { score: number | null; others?: { label: string; score: number }[] }) {
  const w = 300
  const X = (s: number) => 20 + Math.max(-0.3, Math.min(1.3, s)) * (w - 40)
  return (
    <svg width={w} height={46} viewBox={`0 0 ${w} 46`} style={{ display: 'block' }} role="img" aria-label="conflict score line">
      <line x1={X(0)} y1={22} x2={X(1)} y2={22} stroke="var(--border)" strokeWidth={2} />
      <text x={X(0)} y={40} fontSize={9} textAnchor="middle" fill="var(--text-muted)">
        0 the true nest
      </text>
      <text x={X(1)} y={40} fontSize={9} textAnchor="middle" fill="var(--text-muted)">
        1 the moved landmarks
      </text>
      {others?.map((o) => (
        <g key={o.label}>
          <circle cx={X(o.score)} cy={22} r={3} fill="var(--text-muted)">
            <title>{o.label}</title>
          </circle>
        </g>
      ))}
      {score !== null && <circle cx={X(score)} cy={22} r={5} fill="var(--accent)" />}
    </svg>
  )
}

export { Choice as Chips }
