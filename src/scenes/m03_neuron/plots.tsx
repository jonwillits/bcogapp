import type { NeuronCell } from '../../sim/neuron/cell'
import { TRACE_SAMPLE_MS } from '../../sim/neuron/cell'
import { palette } from '../../theme/theme'

/**
 * The small instruments of the Unit and Membrane tabs. Dependency-free SVG,
 * like `components/Plot`, but each one has axes and labels a student is asked
 * to read numbers off, which the generic plot does not.
 */

const AXIS = palette.textMuted
const MONO = 'var(--font-mono)'

/** Millivolts against milliseconds, oriented like the reading's action-potential figure. */
export function VoltageTrace({
  cell,
  windowMs,
  width = 300,
  height = 130,
  showFar = true,
}: {
  cell: NeuronCell
  windowMs: number
  width?: number
  height?: number
  showFar?: boolean
}) {
  const padL = 30
  const padB = 16
  const padT = 6
  const vMin = -95
  const vMax = 55
  const n = Math.min(cell.traceCount, Math.round(windowMs / TRACE_SAMPLE_MS))
  const x = (i: number) => padL + ((width - padL - 4) * i) / Math.max(1, n - 1)
  const y = (v: number) => padT + ((vMax - v) / (vMax - vMin)) * (height - padT - padB)
  const read = (buf: Float32Array, i: number) => {
    // i counts from the oldest sample in the window to the newest.
    const idx = (cell.traceHead - n + i + buf.length * 2) % buf.length
    return buf[idx]
  }
  const path = (buf: Float32Array) => {
    let d = ''
    for (let i = 0; i < n; i++) d += `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(read(buf, i)).toFixed(1)}`
    return d
  }
  const ticks = [40, 0, -40, -65, -80]
  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} style={{ display: 'block', background: 'var(--bg)', borderRadius: 8 }} role="img">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={padL} x2={width - 4} y1={y(t)} y2={y(t)} stroke={palette.border} strokeDasharray={t === -65 || t === 0 ? '3 3' : undefined} strokeWidth={t === -65 || t === 0 ? 1 : 0.5} />
          <text x={padL - 3} y={y(t) + 3} textAnchor="end" fontSize={8} fill={AXIS} fontFamily={MONO}>{t}</text>
        </g>
      ))}
      {n > 1 && showFar && <path d={path(cell.traceFar)} fill="none" stroke={palette.sensor} strokeWidth={1} opacity={0.7} />}
      {n > 1 && <path d={path(cell.traceV)} fill="none" stroke="#ffffff" strokeWidth={1.6} />}
      <text x={padL} y={height - 4} fontSize={8} fill={AXIS}>
        ← {windowMs} ms →
      </text>
      <text x={width - 4} y={height - 4} textAnchor="end" fontSize={8} fill={AXIS}>
        mV against ms · white: body · orange: far end
      </text>
    </svg>
  )
}

/** Spikes as ticks over the last `windowMs`. */
export function Raster({
  spikes,
  now,
  windowMs,
  width = 300,
  height = 34,
}: {
  spikes: readonly number[]
  now: number
  windowMs: number
  width?: number
  height?: number
}) {
  const from = now - windowMs
  const x = (t: number) => 4 + ((t - from) / windowMs) * (width - 8)
  const inWindow = spikes.filter((t) => t >= from && t <= now)
  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} style={{ display: 'block', background: 'var(--bg)', borderRadius: 8 }} role="img">
      <line x1={4} x2={width - 4} y1={height - 8} y2={height - 8} stroke={palette.border} />
      {inWindow.map((t, i) => (
        <line key={i} x1={x(t)} x2={x(t)} y1={4} y2={height - 10} stroke="#ffffff" strokeWidth={windowMs < 50 ? 3 : 1.5} />
      ))}
      <text x={4} y={height - 1} fontSize={7} fill={AXIS}>{from.toFixed(0)} ms</text>
      <text x={width - 4} y={height - 1} textAnchor="end" fontSize={7} fill={AXIS}>{now.toFixed(0)} ms</text>
    </svg>
  )
}

export interface TransferPlotProps {
  /** Horizontal axis: total arriving input. */
  xMin: number
  xMax: number
  /** Measured floor and ceiling — from the cell, never from a parameter. */
  floor: number
  ceiling: number
  /** Live operating point. */
  opX: number
  opY: number
  /** The measured sweep, if the overlay is on. */
  measured?: { x: number[]; y: number[] } | null
  yMax: number
  xLabel: string
  yLabel: string
  width?: number
  height?: number
}

/**
 * The input–output curve. Off overlay: the arithmetic clipped at the measured
 * floor and ceiling, which is the reading's figure with the ceiling the text
 * mentions drawn in. On overlay: the arithmetic's own line, floored at zero
 * and nothing else, against the curve measured from the membrane.
 */
export function TransferPlot({
  xMin,
  xMax,
  floor,
  ceiling,
  opX,
  opY,
  measured,
  yMax,
  xLabel,
  yLabel,
  width = 300,
  height = 150,
}: TransferPlotProps) {
  const padL = 30
  const padB = 20
  const padT = 8
  const padR = 8
  const x = (T: number) => padL + ((T - xMin) / (xMax - xMin)) * (width - padL - padR)
  const y = (r: number) => padT + (1 - Math.max(0, Math.min(yMax, r)) / yMax) * (height - padT - padB)
  const clipped = (T: number) => Math.max(floor, Math.min(ceiling, T))
  const raw = (T: number) => Math.max(0, T)
  const line = (f: (T: number) => number) => {
    const pts: string[] = []
    for (let T = xMin; T <= xMax; T += (xMax - xMin) / 60) pts.push(`${x(T).toFixed(1)},${y(f(T)).toFixed(1)}`)
    return pts.join(' ')
  }
  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} style={{ display: 'block', background: 'var(--bg)', borderRadius: 8 }} role="img">
      <line x1={padL} x2={width - padR} y1={y(0)} y2={y(0)} stroke={palette.border} />
      <line x1={x(0)} x2={x(0)} y1={padT} y2={height - padB} stroke={palette.border} strokeDasharray="3 3" />
      {[0, yMax / 2, yMax].map((r) => (
        <text key={r} x={padL - 3} y={y(r) + 3} textAnchor="end" fontSize={8} fill={AXIS} fontFamily={MONO}>{r.toFixed(0)}</text>
      ))}
      {[xMin, 0, xMax].map((T) => (
        <text key={T} x={x(T)} y={height - padB + 10} textAnchor="middle" fontSize={8} fill={AXIS} fontFamily={MONO}>{T.toFixed(0)}</text>
      ))}
      {measured ? (
        <>
          <polyline points={line(raw)} fill="none" stroke={palette.accent} strokeWidth={1.5} strokeDasharray="4 3" />
          <polyline
            points={measured.x.map((T, i) => `${x(T).toFixed(1)},${y(measured.y[i]).toFixed(1)}`).join(' ')}
            fill="none"
            stroke={palette.sensor}
            strokeWidth={2}
          />
          {measured.x.map((T, i) => (
            <circle key={i} cx={x(T)} cy={y(measured.y[i])} r={2} fill={palette.sensor} />
          ))}
        </>
      ) : (
        <polyline points={line(clipped)} fill="none" stroke={palette.accent} strokeWidth={2} />
      )}
      <circle cx={x(Math.max(xMin, Math.min(xMax, opX)))} cy={y(opY)} r={5} fill="#ffffff" stroke={palette.bg} strokeWidth={1.5} />
      <text x={width - padR} y={height - 4} textAnchor="end" fontSize={8} fill={AXIS}>{xLabel} →</text>
      <text x={padL + 2} y={padT + 8} fontSize={8} fill={AXIS}>↑ {yLabel}</text>
      {measured && (
        <text x={width - padR} y={padT + 8} textAnchor="end" fontSize={8} fill={AXIS}>
          dashed: the arithmetic · orange: measured
        </text>
      )}
    </svg>
  )
}

/** Hodgkin and Huxley's m, h and n, as three bars. */
export function GateMeters({ m, h, n }: { m: number; h: number; n: number }) {
  const bars = [
    { label: 'sodium activation', sym: 'm', v: m, color: palette.approach },
    { label: 'sodium inactivation', sym: 'h', v: h, color: palette.avoid },
    { label: 'potassium', sym: 'n', v: n, color: palette.accent },
  ]
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
      {bars.map((b) => (
        <div key={b.sym} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
          <div style={{ width: '100%', height: 64, background: 'var(--bg)', borderRadius: 6, position: 'relative', overflow: 'hidden' }}>
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                height: `${Math.max(0, Math.min(1, b.v)) * 100}%`,
                background: b.color,
                opacity: 0.85,
              }}
            />
          </div>
          <div style={{ fontFamily: MONO, fontSize: 11 }}>
            {b.sym} = {b.v.toFixed(2)}
          </div>
          <div style={{ fontSize: 9.5, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.2 }}>{b.label}</div>
        </div>
      ))}
    </div>
  )
}

/**
 * Ions crossing the membrane: arrows sized by current, and the pump as its own
 * machine moving three sodium out and two potassium in per cycle.
 */
export function CurrentArrows({
  iNa,
  iK,
  iPump,
  iSyn,
  width = 300,
}: {
  iNa: number
  iK: number
  iPump: number
  iSyn: number
  width?: number
}) {
  const H = 96
  const mem = { y0: 38, y1: 56 }
  // Log-ish scaling so a 1 µA/cm² leak and a 400 µA/cm² spike both read.
  const len = (i: number) => Math.min(30, 4 + 6 * Math.log10(1 + Math.abs(i)))
  const arrow = (xc: number, i: number, inward: boolean, color: string, label: string) => {
    const L = len(i)
    const y0 = inward ? mem.y0 - 4 - L : mem.y1 + 4 + L
    const y1 = inward ? mem.y1 + 6 : mem.y0 - 6
    return (
      <g key={label}>
        <line x1={xc} y1={y0} x2={xc} y2={y1} stroke={color} strokeWidth={2 + Math.min(4, Math.abs(i) / 40)} markerEnd={`url(#tip-${label})`} />
        <defs>
          <marker id={`tip-${label}`} markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 z" fill={color} />
          </marker>
        </defs>
        <text x={xc} y={inward ? mem.y1 + 18 : mem.y0 - 12} textAnchor="middle" fontSize={8} fill={AXIS}>
          {label} {Math.abs(i).toFixed(1)}
        </text>
      </g>
    )
  }
  return (
    <svg width="100%" viewBox={`0 0 ${width} ${H}`} style={{ display: 'block' }} role="img">
      <text x={4} y={10} fontSize={8} fill={AXIS}>outside</text>
      <text x={4} y={H - 3} fontSize={8} fill={AXIS}>inside</text>
      <rect x={0} y={mem.y0} width={width} height={mem.y1 - mem.y0} fill={palette.surface2} stroke={palette.border} />
      {/* sodium: positive = outward in the model's sign convention */}
      {arrow(60, iNa, iNa < 0, palette.approach, 'Na⁺')}
      {arrow(120, iK, iK < 0, palette.accent, 'K⁺')}
      {arrow(180, iSyn, iSyn > 0, palette.sensor, 'synaptic input')}
      {/* the pump */}
      <g>
        <rect x={228} y={mem.y0 - 6} width={30} height={mem.y1 - mem.y0 + 12} rx={5} fill={palette.surface} stroke={palette.text} strokeWidth={1.2} />
        <text x={243} y={mem.y0 - 12} textAnchor="middle" fontSize={8} fill={AXIS}>pump {iPump.toFixed(1)} µA/cm²</text>
        <text x={243} y={mem.y0 + 3} textAnchor="middle" fontSize={7} fill={palette.approach}>3 Na⁺ ↑</text>
        <text x={243} y={mem.y1 - 1} textAnchor="middle" fontSize={7} fill={palette.accent}>2 K⁺ ↓</text>
        <text x={243} y={mem.y1 + 18} textAnchor="middle" fontSize={8} fill={AXIS}>1 ATP / cycle</text>
      </g>
      <text x={width - 4} y={H - 3} textAnchor="end" fontSize={7} fill={AXIS}>µA/cm²</text>
    </svg>
  )
}
