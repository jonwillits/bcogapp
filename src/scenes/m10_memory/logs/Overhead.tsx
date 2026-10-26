import type { ReactNode } from 'react'
import { CLEARING, type Clearing } from '../../../sim/memory/logs/clearings'
import type { NightRecord } from '../../../sim/memory/logs/night'

/**
 * An overhead map of a clearing (spec §8.6, §8.7): the nest, the
 * landmarks, and every log drawn by kind, numbered. For the map question it
 * shows nothing of what happened; for the reveal it adds a night's path
 * and each dig marked by outcome. It is never shown while a night runs
 * (§12, item 4: no minimap).
 */
export function ClearingOverhead({ clearing, record, size = 300, children, label }: { clearing: Clearing; record?: NightRecord | null; size?: number; children?: ReactNode; label?: string }) {
  const r = CLEARING.bound + 1
  const S = (v: number) => (v / r) * (size / 2 - 8)
  const X = (x: number) => size / 2 + S(x - clearing.nest.x)
  const Y = (y: number) => size / 2 - S(y - clearing.nest.y)
  const path = record ? record.path.map((p, i) => `${i ? 'L' : 'M'}${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`).join(' ') : ''
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block', background: 'var(--bg)', borderRadius: 8 }} role="img" aria-label={label ?? 'overhead of the clearing'} data-clearing-overhead>
      {clearing.landmarks.map((l) => (
        <circle key={l.id} cx={X(l.x)} cy={Y(l.y)} r={Math.max(3, S(l.kind === 'tree' ? 0.6 : l.size / 2))} fill="none" stroke="var(--text-muted)" strokeWidth={1} />
      ))}
      {clearing.logs.map((l) => {
        const hx = S((CLEARING.logLength / 2) * Math.cos(l.angle))
        const hy = S((CLEARING.logLength / 2) * Math.sin(l.angle))
        return (
          <g key={l.id} data-log-mark={l.id}>
            <line x1={X(l.x) - hx} y1={Y(l.y) + hy} x2={X(l.x) + hx} y2={Y(l.y) - hy} stroke={l.kind === 'loose' ? '#8a6a3e' : '#c9bfa6'} strokeWidth={l.kind === 'loose' ? 6 : 5} strokeLinecap="round" />
            <text x={X(l.x) + 7} y={Y(l.y) - 6} fontSize={9} fill="var(--text)">
              {l.id + 1}
            </text>
          </g>
        )
      })}
      <circle cx={X(clearing.nest.x)} cy={Y(clearing.nest.y)} r={5} fill="var(--actuator)" data-nest />
      {record && <path d={path} fill="none" stroke="var(--sensor)" strokeWidth={1.2} opacity={0.9} data-path />}
      {record?.digs.map((d, i) => {
        const l = clearing.logs[d.log]
        return d.outcome === 'beetles' ? (
          <circle key={i} cx={X(l.x)} cy={Y(l.y)} r={4.5} fill="#9fd16a" data-dig="beetles" />
        ) : d.outcome === 'empty' ? (
          <circle key={i} cx={X(l.x)} cy={Y(l.y)} r={4.5} fill="none" stroke="#f87171" strokeWidth={1.8} data-dig="empty" />
        ) : (
          <g key={i} data-dig="smooth">
            <line x1={X(l.x) - 4} y1={Y(l.y) - 4} x2={X(l.x) + 4} y2={Y(l.y) + 4} stroke="#f87171" strokeWidth={1.8} />
            <line x1={X(l.x) - 4} y1={Y(l.y) + 4} x2={X(l.x) + 4} y2={Y(l.y) - 4} stroke="#f87171" strokeWidth={1.8} />
          </g>
        )
      })}
      <text x={6} y={size - 6} fontSize={9} fill="var(--text-muted)">
        {`${(2 * r).toFixed(0)} m across · dark logs have loose bark, pale logs are smooth`}
      </text>
      {children}
    </svg>
  )
}

export const OVERHEAD_LEGEND = 'In each overhead: your path in amber; a green dot where a dig found beetles; a red ring where a dig found an empty log; a red cross where a dig was at a smooth log.'
