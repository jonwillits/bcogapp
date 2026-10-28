import type { ReactNode } from 'react'
import { BEACONS, CLEARING, type Clearing, type Log } from '../../../sim/memory/logs/clearings'
import type { NightRecord } from '../../../sim/memory/logs/night'

/**
 * An overhead map of a clearing (spec §8.6, §8.7): the nest, the
 * landmarks, and every log drawn by kind and by its look (its length and
 * thickness, its branch stubs, its moss, its shade), numbered where asked.
 * For the end-of-week question it shows nothing of what happened; for the
 * reveal it adds a night's path, each dig marked by outcome, and each log
 * passed close by and never dug. It is never shown before or during the
 * week (§12, item 4: no map of the week's clearing until the question).
 */

function shade(base: [number, number, number], tint: number): string {
  // tint −1 darkens by a quarter, +1 lightens by a quarter.
  const k = tint * 0.25
  const c = base.map((v) => Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k)))
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`
}

export function logColor(l: Log): string {
  return l.kind === 'loose' ? shade([138, 106, 62], 0) : shade([201, 191, 166], 0)
}

/** One log by its look, in map units: a thick line, stubs off its side, moss along its top. */
export function LogMark({ l, X, Y, S }: { l: Log; X: (x: number) => number; Y: (y: number) => number; S: (v: number) => number }) {
  const k = l.look
  const cx = Math.cos(l.angle)
  const cy = Math.sin(l.angle)
  const hx = (k.length / 2) * cx
  const hy = (k.length / 2) * cy
  const width = Math.max(3, S(k.radius * 2.6))
  return (
    <g data-log-mark={l.id} data-log-kind={l.kind}>
      <line x1={X(l.x - hx)} y1={Y(l.y - hy)} x2={X(l.x + hx)} y2={Y(l.y + hy)} stroke={logColor(l)} strokeWidth={width} strokeLinecap="round" />
      {k.stubs.map((st, i) => {
        const px = l.x + st.along * k.length * cx
        const py = l.y + st.along * k.length * cy
        const side = Math.cos(st.around) >= 0 ? 1 : -1
        const ex = px - side * st.length * cy
        const ey = py + side * st.length * cx
        return <line key={i} x1={X(px)} y1={Y(py)} x2={X(ex)} y2={Y(ey)} stroke={logColor(l)} strokeWidth={Math.max(1.5, width * 0.4)} strokeLinecap="round" data-stub />
      })}
      {k.moss > 0 && <line x1={X(l.x - hx * 0.85 * k.moss)} y1={Y(l.y - hy * 0.85 * k.moss)} x2={X(l.x + hx * 0.85 * k.moss)} y2={Y(l.y + hy * 0.85 * k.moss)} stroke="#4f8a4a" strokeWidth={Math.max(1, width * 0.3)} strokeLinecap="round" data-moss />}
    </g>
  )
}

export interface OverheadProps {
  clearing: Clearing
  record?: NightRecord | null
  size?: number
  children?: ReactNode
  label?: string
  /** Number the logs (the question and the reveal; never during the week). */
  numbered?: boolean
}

export function ClearingOverhead({ clearing, record, size = 300, children, label, numbered = true }: OverheadProps) {
  const r = CLEARING.bound + 3.5
  const S = (v: number) => (v / r) * (size / 2 - 8)
  const X = (x: number) => size / 2 + S(x - clearing.nest.x)
  const Y = (y: number) => size / 2 - S(y - clearing.nest.y)
  const path = record ? record.path.map((p, i) => `${i ? 'L' : 'M'}${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`).join(' ') : ''
  const dugIds = new Set(record?.digs.map((d) => d.log) ?? [])
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block', background: 'var(--bg)', borderRadius: 8 }} role="img" aria-label={label ?? 'overhead of the clearing'} data-clearing-overhead>
      {clearing.landmarks.map((l) => (
        <circle key={l.id} cx={X(l.x)} cy={Y(l.y)} r={Math.max(3, S(l.kind === 'tree' ? 0.6 : l.size / 2))} fill="none" stroke="var(--text-muted)" strokeWidth={1} />
      ))}
      {BEACONS.map((b, i) => (
        <rect key={`b${i}`} x={X(clearing.nest.x + b.x) - 2} y={Y(clearing.nest.y + b.y) - 2} width={4} height={4} fill="var(--text-muted)" data-beacon />
      ))}
      {clearing.logs.map((l) => (
        <g key={l.id}>
          <LogMark l={l} X={X} Y={Y} S={S} />
          {numbered && (
            <text x={X(l.x) + 8} y={Y(l.y) - 7} fontSize={9} fill="var(--text)">
              {l.id + 1}
            </text>
          )}
        </g>
      ))}
      <circle cx={X(clearing.nest.x)} cy={Y(clearing.nest.y)} r={5} fill="var(--actuator)" data-nest />
      {record && <path d={path} fill="none" stroke="var(--sensor)" strokeWidth={1.2} opacity={0.9} data-path />}
      {record &&
        clearing.logs
          .filter((l) => l.kind === 'loose' && record.passedClose[l.id] && !dugIds.has(l.id))
          .map((l) => <circle key={`p${l.id}`} cx={X(l.x)} cy={Y(l.y)} r={7} fill="none" stroke="var(--text-muted)" strokeWidth={1.2} strokeDasharray="2 2" data-passed={l.id} />)}
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
        {`${(2 * r).toFixed(0)} m across · dark logs have loose bark, pale logs are smooth · each log drawn by its look · the squares at the edge are the beacons, three north and two east`}
      </text>
      {children}
    </svg>
  )
}

export const OVERHEAD_LEGEND = 'In each overhead: your path in amber; a green dot where a dig found beetles; a red ring where a dig found an empty log; a red cross where a dig was at a smooth log; a dashed gray ring round a loose-bark log you passed close by and never dug.'
