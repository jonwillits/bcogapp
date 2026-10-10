/**
 * Part 1, Step 3: for each layer, how closely that layer's activity for a
 * shifted (or turned) drawing matches its activity for the original, one
 * line per shift (or turn). A match of 1 is identical activity.
 */
export interface ToleranceSeries {
  label: string
  color: string
  /** One match per layer, in layer order. */
  match: number[]
}

export function TolerancePlot({ layers, series, title, width = 320, height = 170 }: { layers: string[]; series: ToleranceSeries[]; title: string; width?: number; height?: number }) {
  const padL = 34, padR = 26, padT = 18, padB = 34
  const x = (i: number) => padL + (i / Math.max(1, layers.length - 1)) * (width - padL - padR)
  const yy = (v: number) => height - padB - ((Math.max(-0.2, Math.min(1, v)) + 0.2) / 1.2) * (height - padT - padB)
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title} data-plot={title} style={{ display: 'block', background: 'var(--bg)', borderRadius: 8 }}>
      <text x={padL} y={12} fontSize={11} fill="var(--text)">{title}</text>
      {[0, 0.5, 1].map((v) => (
        <g key={v}>
          <line x1={padL} x2={width - padR} y1={yy(v)} y2={yy(v)} stroke="var(--border)" strokeWidth={1} />
          <text x={padL - 4} y={yy(v) + 3.5} fontSize={9.5} fill="var(--text-muted)" textAnchor="end">{v.toFixed(1)}</text>
        </g>
      ))}
      {layers.map((l, i) => (
        <text key={l} x={x(i)} y={height - padB + 12} fontSize={9} fill="var(--text-muted)" textAnchor="middle">{l}</text>
      ))}
      <text x={padL - 28} y={padT + (height - padT - padB) / 2} fontSize={9} fill="var(--text-muted)" transform={`rotate(-90 ${padL - 28} ${padT + (height - padT - padB) / 2})`} textAnchor="middle">match</text>
      {series.map((s) => (
        <g key={s.label}>
          <polyline points={s.match.map((m, i) => `${x(i)},${yy(m)}`).join(' ')} fill="none" stroke={s.color} strokeWidth={1.8} />
          {s.match.map((m, i) => <circle key={i} cx={x(i)} cy={yy(m)} r={2.2} fill={s.color} />)}
        </g>
      ))}
      {series.map((s, k) => (
        <g key={`k${s.label}`}>
          <rect x={padL + k * 58} y={height - 12} width={10} height={3} fill={s.color} />
          <text x={padL + k * 58 + 13} y={height - 8} fontSize={9} fill="var(--text-muted)">{s.label}</text>
        </g>
      ))}
    </svg>
  )
}
