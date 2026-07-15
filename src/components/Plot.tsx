import { useId } from 'react'

export interface PlotSeries {
  label?: string
  color: string
  /** Y values, oldest → newest; X is implied by index. */
  data: number[]
}

export interface PlotProps {
  series: PlotSeries[]
  width?: number
  height?: number
  /** Fixed y-range; if omitted, auto-scales to the data. */
  yMin?: number
  yMax?: number
  /** How many samples wide the x-window is; defaults to the longest series. */
  window?: number
}

/**
 * A small dependency-free SVG line plot for time series (sensor traces, and
 * later membrane-voltage plots for the M3 neuron scene). Auto-scales unless a
 * y-range is given. Reusable across scenes.
 */
export function Plot({
  series,
  width = 236,
  height = 84,
  yMin,
  yMax,
  window,
}: PlotProps) {
  const clipId = useId()
  const pad = 4
  const n = window ?? Math.max(2, ...series.map((s) => s.data.length))

  const allValues = series.flatMap((s) => s.data)
  const lo = yMin ?? (allValues.length ? Math.min(...allValues) : 0)
  const hiRaw = yMax ?? (allValues.length ? Math.max(...allValues) : 1)
  const hi = hiRaw - lo < 1e-6 ? lo + 1 : hiRaw

  const x = (i: number) =>
    pad + (i / Math.max(1, n - 1)) * (width - 2 * pad)
  const y = (v: number) =>
    height - pad - ((v - lo) / (hi - lo)) * (height - 2 * pad)

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      style={{ display: 'block', borderRadius: 8, background: 'var(--bg)' }}
    >
      <defs>
        <clipPath id={clipId}>
          <rect x={0} y={0} width={width} height={height} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        {series.map((s, si) => {
          if (s.data.length < 2) return null
          // Right-align the trace so the newest sample sits at the right edge.
          const offset = n - s.data.length
          const points = s.data
            .map((v, i) => `${x(i + offset)},${y(v)}`)
            .join(' ')
          return (
            <polyline
              key={si}
              points={points}
              fill="none"
              stroke={s.color}
              strokeWidth={1.5}
              strokeLinejoin="round"
            />
          )
        })}
      </g>
    </svg>
  )
}
