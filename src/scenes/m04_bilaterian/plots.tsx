import { palette } from '../../theme/theme'
import { Plot } from '../../components/Plot'
import { TRACE_LEN } from '../../sim/bilaterian/dishWorld'
import { unitOutput, decisionBoundary, TRUTH_ROWS, type RateUnit, type Activation } from '../../sim/bilaterian/unit'
import { AFFECT_STATES } from '../../sim/bilaterian/modulators'

const AXIS = palette.textMuted
const MONO = 'var(--font-mono)'
/** The chapter's colours: blue where the circuit should fire, orange where it should not. */
const FIRE = '#4f9cff'
const SILENT = '#f0a94b'

/**
 * The decision boundary of the chapter's §4.2.5: x₁ across, x₂ up, the four
 * input combinations coloured by what the target says, the shading the unit
 * currently produces, and the line between them. The live input is the
 * white dot. A correct circuit is one whose shading matches its points.
 */
export function DecisionBoundaryPlot({
  unit,
  activation,
  target,
  live,
  labels,
  width = 300,
  height = 240,
}: {
  unit: RateUnit
  activation: Activation
  target?: readonly boolean[]
  live: [number, number]
  labels: [string, string]
  width?: number
  height?: number
}) {
  const padL = 34
  const padB = 26
  const padT = 8
  const padR = 10
  const lo = -0.25
  const hi = 1.25
  const x = (v: number) => padL + ((v - lo) / (hi - lo)) * (width - padL - padR)
  const y = (v: number) => padT + (1 - (v - lo) / (hi - lo)) * (height - padT - padB)
  const N = 24
  const cells: { x1: number; x2: number; out: number }[] = []
  for (let i = 0; i < N; i++)
    for (let j = 0; j < N; j++) {
      const x1 = lo + ((i + 0.5) / N) * (hi - lo)
      const x2 = lo + ((j + 0.5) / N) * (hi - lo)
      cells.push({ x1, x2, out: unitOutput(unit, [x1, x2], activation) })
    }
  const cw = (width - padL - padR) / N
  const ch = (height - padT - padB) / N
  const b = decisionBoundary(unit)
  let line: { x1: number; y1: number; x2: number; y2: number } | null = null
  if (b) {
    line = { x1: x(lo), y1: y(b.slope * lo + b.intercept), x2: x(hi), y2: y(b.slope * hi + b.intercept) }
  } else if (unit.weights[0]) {
    const xv = (unit.threshold - unit.baseline) / unit.weights[0]
    line = { x1: x(xv), y1: y(lo), x2: x(xv), y2: y(hi) }
  }
  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} style={{ display: 'block', background: 'var(--bg)', borderRadius: 8 }} role="img">
      <defs>
        <clipPath id="db-clip">
          <rect x={padL} y={padT} width={width - padL - padR} height={height - padT - padB} />
        </clipPath>
      </defs>
      {cells.map((c, i) => (
        <rect
          key={i}
          x={x(c.x1) - cw / 2}
          y={y(c.x2) - ch / 2}
          width={cw + 0.5}
          height={ch + 0.5}
          fill={c.out >= 0.5 ? FIRE : SILENT}
          opacity={0.12 + 0.28 * Math.abs(c.out - 0.5) * 2}
        />
      ))}
      {line && (
        <line {...line} stroke={palette.text} strokeWidth={1.6} clipPath="url(#db-clip)" />
      )}
      {[0, 1].map((v) => (
        <g key={v}>
          <text x={x(v)} y={height - padB + 12} textAnchor="middle" fontSize={9} fill={AXIS} fontFamily={MONO}>{v}</text>
          <text x={padL - 5} y={y(v) + 3} textAnchor="end" fontSize={9} fill={AXIS} fontFamily={MONO}>{v}</text>
        </g>
      ))}
      {TRUTH_ROWS.map(([a, c], i) => {
        const fires = target ? target[i] : unitOutput(unit, [a, c], activation) >= 0.5
        return (
          <circle
            key={i}
            cx={x(a)}
            cy={y(c)}
            r={6}
            fill={fires ? FIRE : 'var(--bg)'}
            stroke={fires ? FIRE : SILENT}
            strokeWidth={2}
          />
        )
      })}
      <circle cx={x(Math.max(lo, Math.min(hi, live[0])))} cy={y(Math.max(lo, Math.min(hi, live[1])))} r={4.5} fill="#ffffff" stroke={palette.bg} strokeWidth={1.5} />
      <text x={width - padR} y={height - 4} textAnchor="end" fontSize={9} fill={AXIS}>x₁ = {labels[0]} →</text>
      <text x={padL + 2} y={padT + 9} fontSize={9} fill={AXIS}>↑ x₂ = {labels[1]}</text>
      <text x={width - padR} y={padT + 9} textAnchor="end" fontSize={8} fill={AXIS}>
        {target ? 'points: the target · shading: what the unit does' : 'shading: what the unit does'}
      </text>
    </svg>
  )
}

/**
 * The input–output curve of the activation function: the bare sum along
 * the bottom, the output up the side, the floor and the ceiling drawn in,
 * and a dot for the unit right now.
 */
export function ActivationPlot({
  activation,
  threshold,
  net,
  output,
  width = 300,
  height = 110,
}: {
  activation: Activation
  threshold: number
  net: number
  output: number
  width?: number
  height?: number
}) {
  const padL = 30
  const padB = 20
  const padT = 8
  const padR = 8
  const xMin = -3
  const xMax = 3
  const x = (v: number) => padL + ((v - xMin) / (xMax - xMin)) * (width - padL - padR)
  const y = (v: number) => padT + (1 - v) * (height - padT - padB)
  const pts: string[] = []
  for (let v = xMin; v <= xMax + 1e-9; v += 0.02) {
    const out = unitOutput({ baseline: 0, weights: [], threshold }, [], activation)
    void out
    const drive = v - threshold
    const o = activation === 'threshold' ? (drive >= 0 ? 1 : 0) : 1 / (1 + Math.exp(-drive / 0.15))
    pts.push(`${x(v).toFixed(1)},${y(o).toFixed(1)}`)
  }
  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} style={{ display: 'block', background: 'var(--bg)', borderRadius: 8 }} role="img">
      <line x1={padL} x2={width - padR} y1={y(0)} y2={y(0)} stroke={palette.border} />
      <line x1={padL} x2={width - padR} y1={y(1)} y2={y(1)} stroke={palette.border} strokeDasharray="3 3" />
      <line x1={x(threshold)} x2={x(threshold)} y1={padT} y2={height - padB} stroke={palette.border} strokeDasharray="3 3" />
      <polyline points={pts.join(' ')} fill="none" stroke={palette.accent} strokeWidth={2} />
      <circle cx={x(Math.max(xMin, Math.min(xMax, net)))} cy={y(output)} r={5} fill="#ffffff" stroke={palette.bg} strokeWidth={1.5} />
      {[0, 1].map((v) => (
        <text key={v} x={padL - 4} y={y(v) + 3} textAnchor="end" fontSize={8} fill={AXIS} fontFamily={MONO}>{v}</text>
      ))}
      {[xMin, 0, xMax].map((v) => (
        <text key={v} x={x(v)} y={height - padB + 10} textAnchor="middle" fontSize={8} fill={AXIS} fontFamily={MONO}>{v}</text>
      ))}
      <text x={x(threshold)} y={height - padB + 10} textAnchor="middle" fontSize={8} fill={palette.text} fontFamily={MONO}>θ</text>
      <text x={width - padR} y={height - 4} textAnchor="end" fontSize={8} fill={AXIS}>net input, b₀ + Σ bᵢxᵢ →</text>
      <text x={padL + 2} y={padT + 8} fontSize={8} fill={AXIS}>↑ output y · floor 0 · ceiling 1</text>
    </svg>
  )
}

/**
 * The valence–arousal plane of the chapter's `f-valence-arousal`, with its
 * five named states faint and the animal's own state as a live dot.
 */
export function AffectPlane({
  valence,
  arousal,
  hidden,
  width = 300,
  height = 240,
}: {
  valence: number
  arousal: number
  hidden?: boolean
  width?: number
  height?: number
}) {
  const padL = 30
  const padB = 26
  const padT = 14
  const padR = 12
  const x = (v: number) => padL + ((v + 1) / 2) * (width - padL - padR)
  const y = (a: number) => padT + (1 - (a + 1) / 2) * (height - padT - padB)
  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} style={{ display: 'block', background: 'var(--bg)', borderRadius: 8 }} role="img">
      <line x1={x(-1)} x2={x(1)} y1={y(0)} y2={y(0)} stroke={palette.border} />
      <line x1={x(0)} x2={x(0)} y1={y(-1)} y2={y(1)} stroke={palette.border} />
      {AFFECT_STATES.map((s) => (
        <g key={s.name}>
          <circle cx={x(s.valence)} cy={y(s.arousal)} r={3} fill={AXIS} opacity={0.6} />
          <text x={x(s.valence)} y={y(s.arousal) - 7} textAnchor="middle" fontSize={9} fill={AXIS}>{s.name}</text>
        </g>
      ))}
      {!hidden && (
        <circle cx={x(valence)} cy={y(arousal)} r={7} fill="#ffffff" stroke={palette.accent} strokeWidth={2.5} />
      )}
      <text x={x(-1)} y={height - 6} fontSize={9} fill={AXIS}>bad</text>
      <text x={x(1)} y={height - 6} textAnchor="end" fontSize={9} fill={AXIS}>good</text>
      <text x={width / 2} y={height - 6} textAnchor="middle" fontSize={9} fill={AXIS}>valence →</text>
      <text x={4} y={y(1) + 4} fontSize={9} fill={AXIS}>activated</text>
      <text x={4} y={y(-1) + 4} fontSize={9} fill={AXIS}>quiet</text>
      <text x={4} y={y(0) - 4} fontSize={9} fill={AXIS}>arousal ↑</text>
    </svg>
  )
}

/** A rolling trace of one or more series, in the shared Plot. */
export function Trace({
  series,
  yMin,
  yMax,
  width = 300,
  height = 70,
}: {
  series: { color: string; data: number[] }[]
  yMin?: number
  yMax?: number
  width?: number
  height?: number
}) {
  return <Plot width={width} height={height} window={TRACE_LEN} yMin={yMin} yMax={yMax} series={series} />
}
