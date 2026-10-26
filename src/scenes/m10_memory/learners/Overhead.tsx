import { CLEARING, type Clearing } from '../../../sim/memory/logs/clearings'
import type { NightRecord } from '../../../sim/memory/logs/night'

/**
 * An overhead of a clearing with one night's path and digs (spec §9.2): the
 * nest, the landmarks, every log drawn by kind, the path, and each dig
 * marked by its outcome. Drawn only after the step's commit.
 */
export function ClearingOverhead({ clearing, record, size = 200, label }: { clearing: Clearing; record: NightRecord | null; size?: number; label: string }) {
  const r = CLEARING.bound
  const S = (v: number) => (v / r) * (size / 2 - 6)
  const X = (x: number) => size / 2 + S(x - clearing.nest.x)
  const Y = (y: number) => size / 2 - S(y - clearing.nest.y)
  const path = record ? record.path.map((p, i) => `${i ? 'L' : 'M'}${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`).join(' ') : ''
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block', background: 'var(--bg)', borderRadius: 8 }} role="img" aria-label={label} data-clearing-overhead={label}>
      {clearing.landmarks.map((l) => (
        <circle key={l.id} cx={X(l.x)} cy={Y(l.y)} r={Math.max(2, S(l.kind === 'tree' ? 0.6 : l.size / 2))} fill="none" stroke="var(--text-muted)" strokeWidth={1} />
      ))}
      {clearing.logs.map((l) => {
        const hx = (CLEARING.logLength / 2) * Math.cos(l.angle)
        const hy = (CLEARING.logLength / 2) * Math.sin(l.angle)
        return <line key={l.id} x1={X(l.x - hx)} y1={Y(l.y - hy)} x2={X(l.x + hx)} y2={Y(l.y + hy)} stroke={l.kind === 'loose' ? '#a0784a' : '#8a8f99'} strokeWidth={l.kind === 'loose' ? 5 : 3} strokeLinecap="round" data-log-kind={l.kind} />
      })}
      <circle cx={X(clearing.nest.x)} cy={Y(clearing.nest.y)} r={4} fill="var(--actuator)" />
      {record && <path d={path} fill="none" stroke="var(--sensor)" strokeWidth={1.2} opacity={0.9} data-path />}
      {record?.digs.map((d, i) => {
        const l = clearing.logs[d.log]
        return d.outcome === 'beetles' ? (
          <circle key={i} cx={X(l.x)} cy={Y(l.y)} r={4} fill="var(--actuator)" data-dig="beetles" />
        ) : d.outcome === 'empty' ? (
          <circle key={i} cx={X(l.x)} cy={Y(l.y)} r={4} fill="none" stroke="var(--avoid)" strokeWidth={2} data-dig="empty" />
        ) : (
          <g key={i} data-dig="smooth">
            <line x1={X(l.x) - 4} y1={Y(l.y) - 4} x2={X(l.x) + 4} y2={Y(l.y) + 4} stroke="var(--text-muted)" strokeWidth={2} />
            <line x1={X(l.x) - 4} y1={Y(l.y) + 4} x2={X(l.x) + 4} y2={Y(l.y) - 4} stroke="var(--text-muted)" strokeWidth={2} />
          </g>
        )
      })}
      <text x={6} y={size - 6} fontSize={9} fill="var(--text-muted)">
        {label}
      </text>
    </svg>
  )
}

export const OVERHEAD_LEGEND = 'Loose-bark logs are drawn thick and brown, smooth logs thin and gray. The path is amber. A dig that found beetles is a green dot, a dig at an empty log a red ring, a dig at a smooth log a gray cross. The nest is the green dot at the center.'
