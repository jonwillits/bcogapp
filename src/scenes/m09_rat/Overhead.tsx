import type { ReactNode } from 'react'
import { LANDMARKS, RANGE } from '../../sim/rodent/range'
import { radiusAt, type Shape } from '../../sim/rodent/shape'

/**
 * The overhead inset (spec §4): a map of the space seen from above. In
 * Part 1 it shows a trial's true outward path, the student's return, the
 * nest and the endpoint — and it is hidden until the commit. In Part 3 it
 * shows the box with the rat's true path and its estimate drawn together.
 */

export function RangeOverhead({ size = 240, extent, out, back, endpoint, navigators, moved, children, label }: { size?: number; extent?: number; out: { x: number; y: number }[]; back: { x: number; y: number }[]; endpoint: { x: number; y: number } | null; navigators?: { label: string; x: number; y: number }[]; moved?: Map<string, { x: number; y: number }> | null; children?: ReactNode; label?: string }) {
  const all = [...out, ...back, ...(endpoint ? [endpoint] : []), ...(navigators ?? []), RANGE.nest]
  const r = extent ?? Math.max(6, ...all.map((p) => Math.hypot(p.x, p.y))) * 1.15
  const S = (v: number) => (v / r) * (size / 2 - 6)
  const X = (x: number) => size / 2 + S(x)
  const Y = (y: number) => size / 2 - S(y)
  const path = (pts: { x: number; y: number }[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`).join(' ')
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block', background: 'var(--bg)', borderRadius: 8 }} role="img" aria-label={label ?? 'overhead view'} data-overhead>
      {LANDMARKS.filter((l) => !l.distant).map((l) => {
        const p = moved?.get(l.id) ?? l
        return <circle key={l.id} cx={X(p.x)} cy={Y(p.y)} r={Math.max(2, S(l.size / 2))} fill="none" stroke="var(--text-muted)" strokeWidth={1} />
      })}
      <path d={path(out)} fill="none" stroke="var(--sensor)" strokeWidth={1.5} />
      <path d={path(back)} fill="none" stroke="var(--accent)" strokeWidth={1.5} strokeDasharray="4 2" />
      <circle cx={X(RANGE.nest.x)} cy={Y(RANGE.nest.y)} r={4} fill="var(--actuator)" data-nest />
      {endpoint && <circle cx={X(endpoint.x)} cy={Y(endpoint.y)} r={4} fill="none" stroke="var(--accent)" strokeWidth={2} data-endpoint />}
      {navigators?.map((n) => (
        <g key={n.label}>
          <rect x={X(n.x) - 3} y={Y(n.y) - 3} width={6} height={6} fill="var(--avoid)" opacity={0.9}>
            <title>{n.label}</title>
          </rect>
        </g>
      ))}
      <text x={6} y={size - 6} fontSize={9} fill="var(--text-muted)">
        {`${(2 * r).toFixed(0)} m across`}
      </text>
      {children}
    </svg>
  )
}

export function BoxOverhead({ size = 200, shape, trace, pinnedLabel }: { size?: number; shape: Shape; trace: { x: number; y: number; ex: number; ey: number }[]; pinnedLabel?: string }) {
  const r = Math.max(shape.width, shape.length) / 2 * 1.1
  const S = (v: number) => (v / r) * (size / 2 - 4)
  const X = (x: number) => size / 2 + S(x)
  const Y = (y: number) => size / 2 - S(y)
  const outline: string[] = []
  for (let i = 0; i <= 64; i++) {
    const a = (2 * Math.PI * i) / 64
    const rr = radiusAt(shape, a)
    outline.push(`${i ? 'L' : 'M'}${X(rr * Math.cos(a)).toFixed(1)},${Y(rr * Math.sin(a)).toFixed(1)}`)
  }
  const truePath = trace.map((p, i) => `${i ? 'L' : 'M'}${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`).join(' ')
  const estPath = trace.map((p, i) => `${i ? 'L' : 'M'}${X(p.ex).toFixed(1)},${Y(p.ey).toFixed(1)}`).join(' ')
  const last = trace[trace.length - 1]
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block', background: 'var(--bg)', borderRadius: 8 }} role="img" aria-label="overhead: the true path and the estimate" data-box-overhead>
      <path d={outline.join(' ')} fill="none" stroke="var(--border)" strokeWidth={1.5} />
      <path d={truePath} fill="none" stroke="var(--sensor)" strokeWidth={1.2} />
      <path d={estPath} fill="none" stroke="var(--accent)" strokeWidth={1.2} strokeDasharray="3 2" />
      {last && <circle cx={X(last.x)} cy={Y(last.y)} r={3} fill="var(--sensor)" />}
      {last && <circle cx={X(last.ex)} cy={Y(last.ey)} r={3} fill="none" stroke="var(--accent)" strokeWidth={1.5} />}
      <text x={5} y={size - 5} fontSize={9} fill="var(--sensor)">
        true path
      </text>
      <text x={size - 5} y={size - 5} fontSize={9} textAnchor="end" fill="var(--accent)">
        the estimate
      </text>
      {pinnedLabel && (
        <text x={5} y={11} fontSize={9} fill="var(--text-muted)">
          {pinnedLabel}
        </text>
      )}
    </svg>
  )
}
