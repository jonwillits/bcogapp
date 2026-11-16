import type { ReactNode } from 'react'

/**
 * The plots of this lab: lines over an ordered axis (labeling curves,
 * discrimination, learners against listening, agreement by depth), bars
 * (next-token distributions), and a scatter of labeled points (vowels, the
 * principal plane). SVG, dependency-free, every axis labeled with what it
 * counts and in what units.
 */

export interface Series {
  label: string
  color: string
  points: [number, number][]
  dashed?: boolean
  /** Filled band: [x, lo, hi] per point. */
  band?: [number, number, number][]
}

export function LinePlot({ series, width = 420, height = 200, xLabel, yLabel, xMin, xMax, yMin = 0, yMax = 100, xTicks, yTicks, marks, hLines, logX, testId }: { series: Series[]; width?: number; height?: number; xLabel: string; yLabel: string; xMin?: number; xMax?: number; yMin?: number; yMax?: number; xTicks?: { x: number; label: string }[]; yTicks?: number[]; marks?: { x: number; label: string; color?: string }[]; hLines?: { y: number; label: string; color?: string }[]; logX?: boolean; testId?: string }) {
  const pad = { l: 44, r: 12, t: 12, b: 34 }
  const xs = series.flatMap((s) => s.points.map((p) => p[0]))
  const lo = xMin ?? Math.min(...xs)
  const hi = xMax ?? Math.max(...xs)
  const tx = (x: number) => (logX ? Math.log(x) : x)
  const X = (x: number) => pad.l + ((tx(x) - tx(lo)) / (tx(hi) - tx(lo) || 1)) * (width - pad.l - pad.r)
  const Y = (y: number) => height - pad.b - ((y - yMin) / (yMax - yMin || 1)) * (height - pad.t - pad.b)
  const yt = yTicks ?? [yMin, (yMin + yMax) / 2, yMax]
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${yLabel} against ${xLabel}`} style={{ display: 'block', background: 'var(--bg)', borderRadius: 8 }} data-plot={testId ?? 'line'}>
      {yt.map((y) => (
        <g key={y}>
          <line x1={pad.l} y1={Y(y)} x2={width - pad.r} y2={Y(y)} stroke="var(--border)" />
          <text x={pad.l - 4} y={Y(y) + 3} fontSize={9} textAnchor="end" fill="var(--text-muted)">
            {y}
          </text>
        </g>
      ))}
      {hLines?.map((h) => (
        <g key={h.label}>
          <line x1={pad.l} y1={Y(h.y)} x2={width - pad.r} y2={Y(h.y)} stroke={h.color ?? 'var(--text-muted)'} strokeDasharray="3 3" />
          <text x={width - pad.r - 2} y={Y(h.y) - 3} fontSize={9} textAnchor="end" fill={h.color ?? 'var(--text-muted)'}>
            {h.label}
          </text>
        </g>
      ))}
      {(xTicks ?? []).map((t) => (
        <text key={t.label} x={X(t.x)} y={height - pad.b + 12} fontSize={9} textAnchor="middle" fill="var(--text-muted)">
          {t.label}
        </text>
      ))}
      {marks?.map((m) => (
        <g key={m.label}>
          <line x1={X(m.x)} y1={pad.t} x2={X(m.x)} y2={height - pad.b} stroke={m.color ?? 'var(--sensor)'} strokeDasharray="3 3" />
          <text x={X(m.x) + 3} y={pad.t + 10} fontSize={9} fill={m.color ?? 'var(--sensor)'}>
            {m.label}
          </text>
        </g>
      ))}
      {series.map((s) => (
        <g key={s.label} data-series={s.label}>
          {s.band && <polygon points={[...s.band.map((b) => `${X(b[0])},${Y(b[2])}`), ...s.band.slice().reverse().map((b) => `${X(b[0])},${Y(b[1])}`)].join(' ')} fill={s.color} opacity={0.15} />}
          <polyline points={s.points.map((p) => `${X(p[0])},${Y(p[1])}`).join(' ')} fill="none" stroke={s.color} strokeWidth={2} strokeDasharray={s.dashed ? '5 4' : undefined} />
          {s.points.map((p, i) => (
            <circle key={i} cx={X(p[0])} cy={Y(p[1])} r={2.8} fill={s.color}>
              <title>{`${s.label}: ${p[1].toFixed(1)} at ${p[0]}`}</title>
            </circle>
          ))}
        </g>
      ))}
      <text x={(pad.l + width - pad.r) / 2} y={height - 4} fontSize={10} textAnchor="middle" fill="var(--text-muted)">
        {xLabel}
      </text>
      <text x={10} y={(pad.t + height - pad.b) / 2} fontSize={10} textAnchor="middle" fill="var(--text-muted)" transform={`rotate(-90 10 ${(pad.t + height - pad.b) / 2})`}>
        {yLabel}
      </text>
      {series.map((s, i) => (
        <g key={'k' + s.label}>
          <line x1={pad.l + 8} y1={pad.t + 8 + i * 12} x2={pad.l + 22} y2={pad.t + 8 + i * 12} stroke={s.color} strokeWidth={2} strokeDasharray={s.dashed ? '5 4' : undefined} />
          <text x={pad.l + 26} y={pad.t + 11 + i * 12} fontSize={9} fill="var(--text-muted)">
            {s.label}
          </text>
        </g>
      ))}
    </svg>
  )
}

export interface Bar {
  label: string
  value: number
  color?: string
  group?: string
}

/** Horizontal bars with the number printed, for distributions over tokens and shares. */
export function BarChart({ bars, width = 400, max, format = (v) => v.toFixed(2), rowH = 14, testId }: { bars: Bar[]; width?: number; max?: number; format?: (v: number) => string; rowH?: number; testId?: string }) {
  const m = max ?? Math.max(1e-9, ...bars.map((b) => b.value))
  const labelW = 90
  const valueW = 44
  const barW = width - labelW - valueW - 8
  return (
    <svg width={width} height={bars.length * rowH + 4} viewBox={`0 0 ${width} ${bars.length * rowH + 4}`} style={{ display: 'block' }} data-bars={testId ?? true}>
      {bars.map((b, i) => (
        <g key={b.label + i} data-bar={b.label}>
          <text x={labelW - 4} y={i * rowH + rowH - 3} fontSize={10} textAnchor="end" fill="var(--text)">
            {b.label}
          </text>
          <rect x={labelW} y={i * rowH + 2} width={Math.max(0, (b.value / m) * barW)} height={rowH - 4} fill={b.color ?? 'var(--accent)'} />
          <text x={labelW + barW + 4} y={i * rowH + rowH - 3} fontSize={10} fill="var(--text-muted)" fontFamily="var(--font-mono)">
            {format(b.value)}
          </text>
        </g>
      ))}
    </svg>
  )
}

/** Labeled points on a plane. */
export function Scatter({ points, width = 320, height = 240, xLabel, yLabel, flipX, flipY, testId, children }: { points: { x: number; y: number; label: string; color?: string }[]; width?: number; height?: number; xLabel: string; yLabel: string; flipX?: boolean; flipY?: boolean; testId?: string; children?: ReactNode }) {
  const pad = { l: 40, r: 12, t: 12, b: 30 }
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  const lo = Math.min(...xs)
  const hi = Math.max(...xs)
  const ylo = Math.min(...ys)
  const yhi = Math.max(...ys)
  const X = (x: number) => {
    const u = (x - lo) / (hi - lo || 1)
    return pad.l + (flipX ? 1 - u : u) * (width - pad.l - pad.r)
  }
  const Y = (y: number) => {
    const u = (y - ylo) / (yhi - ylo || 1)
    return height - pad.b - (flipY ? 1 - u : u) * (height - pad.t - pad.b)
  }
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${yLabel} against ${xLabel}`} style={{ display: 'block', background: 'var(--bg)', borderRadius: 8 }} data-plot={testId ?? 'scatter'}>
      {points.map((p) => (
        <g key={p.label} data-point={p.label}>
          <circle cx={X(p.x)} cy={Y(p.y)} r={4} fill={p.color ?? 'var(--accent)'} />
          <text x={X(p.x) + 6} y={Y(p.y) + 3} fontSize={10} fill="var(--text)">
            {p.label}
          </text>
        </g>
      ))}
      {children}
      <text x={(pad.l + width - pad.r) / 2} y={height - 4} fontSize={10} textAnchor="middle" fill="var(--text-muted)">
        {xLabel}
      </text>
      <text x={10} y={(pad.t + height - pad.b) / 2} fontSize={10} textAnchor="middle" fill="var(--text-muted)" transform={`rotate(-90 10 ${(pad.t + height - pad.b) / 2})`}>
        {yLabel}
      </text>
      <text x={pad.l} y={height - pad.b + 12} fontSize={9} fill="var(--text-muted)">
        {(flipX ? hi : lo).toFixed(0)}
      </text>
      <text x={width - pad.r} y={height - pad.b + 12} fontSize={9} textAnchor="end" fill="var(--text-muted)">
        {(flipX ? lo : hi).toFixed(0)}
      </text>
    </svg>
  )
}
