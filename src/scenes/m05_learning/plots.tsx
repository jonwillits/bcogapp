import { palette } from '../../theme/theme'

const AXIS = palette.textMuted

/**
 * A line plot with the two things Module 5's instruments need and the shared
 * Plot does not have: reference lines, and a mark where the run began. Kept
 * bright on purpose — the dark theme has swallowed drawn geometry before.
 */
export function LinePlot({
  series,
  yMin,
  yMax,
  capacity,
  width = 320,
  height = 110,
  zeroLine = false,
  references = [],
  startMark = false,
}: {
  series: { color: string; data: number[]; dashed?: boolean }[]
  yMin: number
  yMax: number
  /** How many samples fill the plot. Fewer, and the trace grows from the left. */
  capacity: number
  width?: number
  height?: number
  zeroLine?: boolean
  /** Horizontal reference lines — a weight's value at the start of the run. */
  references?: { value: number; color: string }[]
  /** Draw a vertical mark at the first sample while the start of the run is still on the plot. */
  startMark?: boolean
}) {
  const padL = 26
  const pad = 6
  const n = Math.max(2, ...series.map((s) => s.data.length))
  const span = Math.min(capacity, Math.max(n, Math.min(capacity, 120)))
  const x = (i: number) => padL + (i / Math.max(1, span - 1)) * (width - padL - pad)
  const y = (v: number) => height - pad - ((Math.max(yMin, Math.min(yMax, v)) - yMin) / (yMax - yMin)) * (height - 2 * pad)
  const startVisible = startMark && n < capacity
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" style={{ display: 'block', borderRadius: 8, background: 'var(--bg)' }}>
      {[yMin, (yMin + yMax) / 2, yMax].map((v) => (
        <text key={v} x={padL - 4} y={y(v) + 3} textAnchor="end" fontSize={9} fill={AXIS}>
          {Number.isInteger(v) ? v : v.toFixed(1)}
        </text>
      ))}
      {zeroLine && <line x1={padL} x2={width - pad} y1={y(0)} y2={y(0)} stroke="#6b7da3" strokeWidth={1} />}
      {references.map((r, i) => (
        <line key={i} x1={padL} x2={width - pad} y1={y(r.value)} y2={y(r.value)} stroke={r.color} strokeWidth={1} strokeDasharray="2 4" opacity={0.75} />
      ))}
      {startVisible && (
        <>
          <line x1={x(0)} x2={x(0)} y1={pad} y2={height - pad} stroke="#e8f1ff" strokeWidth={1.5} />
          <text x={x(0) + 4} y={pad + 8} fontSize={9} fill="#e8f1ff">run started</text>
        </>
      )}
      {series.map((s, si) =>
        s.data.length < 2 ? null : (
          <polyline
            key={si}
            fill="none"
            stroke={s.color}
            strokeWidth={2}
            strokeDasharray={s.dashed ? '5 3' : undefined}
            points={s.data.map((v, i) => `${x(i)},${y(v)}`).join(' ')}
          />
        ),
      )}
    </svg>
  )
}

export function Legend({ items }: { items: { color: string; label: string }[] }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, fontSize: 10, color: 'var(--text-muted)' }}>
      {items.map((m) => (
        <span key={m.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 10, height: 3, background: m.color, display: 'inline-block' }} />
          {m.label}
        </span>
      ))}
    </div>
  )
}

/** A decaying bar, 0..1. */
export function Bar({ value, color, label }: { value: number; color: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
      <span style={{ width: 96, color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ flex: 1, height: 9, borderRadius: 5, background: '#1c2740', overflow: 'hidden' }}>
        <span style={{ display: 'block', height: '100%', width: `${Math.max(0, Math.min(1, value)) * 100}%`, background: color }} />
      </span>
      <span style={{ width: 34, textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{value.toFixed(2)}</span>
    </div>
  )
}

/**
 * The chain, trial by trial: one row a trial, one box a point in the chain,
 * shaded by what the critic held that point to be worth when the trial ended,
 * with the surprise left at the food in the last column. The reading's
 * `f-td-chain`, filling in while it runs.
 */
export function ChainGrid({
  names,
  trials,
  firstTrial,
}: {
  names: string[]
  trials: { values: number[]; atFood: number }[]
  firstTrial: number
}) {
  const shade = (v: number, rgb: string) => `rgba(${rgb}, ${Math.max(0, Math.min(1, v / 1.8)).toFixed(2)})`
  const cell = { flex: 1, height: 18, borderRadius: 3, border: '1px solid #33456e', fontSize: 9.5, fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e8f1ff' } as const
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <div style={{ display: 'flex', gap: 3, fontSize: 9.5, color: 'var(--text-muted)' }}>
        <span style={{ width: 44 }}>trial</span>
        {[...names, 'surprise at the food'].map((n) => (
          <span key={n} style={{ flex: 1, textAlign: 'center' }}>{n}</span>
        ))}
      </div>
      {trials.length === 0 && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>No trial finished yet.</div>}
      {trials.map((t, k) => (
        <div key={firstTrial + k} style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
          <span style={{ width: 44, fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{firstTrial + k}</span>
          {t.values.map((v, i) => (
            <span key={i} style={{ ...cell, background: shade(v, '94, 230, 214') }}>{v.toFixed(2)}</span>
          ))}
          <span style={{ ...cell, background: shade(t.atFood * 1.8, '255, 111, 174') }}>{t.atFood.toFixed(2)}</span>
        </div>
      ))}
    </div>
  )
}
