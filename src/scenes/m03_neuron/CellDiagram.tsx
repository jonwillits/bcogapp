import { palette } from '../../theme/theme'
import { fmt } from '../../components/format'

/**
 * One cell, drawn three ways in the same place.
 *
 * The four elements sit at fixed positions — inputs on the left, a body in
 * the middle, a long line to the right, a gap at its end — and the three
 * modes draw them differently in those same positions, cross-fading when the
 * mode changes. That is the point: switching from the Unit tab to the
 * Membrane tab should visibly turn each *role* into the *part* that fills it,
 * rather than swap one picture for another.
 *
 * The words come in as props. This file knows nothing about what the parts
 * are called at either level; `unitLabels.ts` and `membraneLabels.ts` do, and
 * the naming test holds each tab to its own vocabulary.
 */

export type DiagramMode = 'unit' | 'artificial' | 'membrane'

export interface DiagramLabels {
  inputSurface: string
  integrator: string
  outputLine: string
  junction: string
}

export interface CellDiagramProps {
  mode: DiagramMode
  labels: DiagramLabels
  /** b₁, b₂, b₃ */
  strengths: [number, number, number]
  baseline: number
  /** x₁, x₂, x₃ */
  rates: [number, number, number]
  /** Output rate, spikes per second. */
  output: number
  /** Voltage along the axon, soma first — colours the output line in membrane mode. */
  profile?: ArrayLike<number>
  /** Which patches are wrapped in myelin (membrane mode). */
  wrapped?: (i: number) => boolean
  /** Whether the second input is inhibitory, for the junction's ion label. */
  width?: number
}

const W = 320
const H = 168
const IN_X = 26
const BODY = { x: 118, y: 84 }
const LINE_X0 = 150
const LINE_X1 = 268
const GAP_X = 272
const TARGET_X = 292

/** Voltage → colour, blue at rest through white to yellow at the peak. */
export function voltageColour(v: number): string {
  const t = Math.max(0, Math.min(1, (v + 80) / 120))
  if (t < 0.5) {
    const u = t / 0.5
    return `rgb(${Math.round(60 + 160 * u)}, ${Math.round(90 + 140 * u)}, ${Math.round(200 + 40 * u)})`
  }
  const u = (t - 0.5) / 0.5
  return `rgb(${Math.round(220 + 35 * u)}, ${Math.round(230 - 40 * u)}, ${Math.round(240 - 200 * u)})`
}

export function CellDiagram({
  mode,
  labels,
  strengths,
  baseline,
  rates,
  output,
  profile,
  wrapped,
  width = W,
}: CellDiagramProps) {
  const inputs = [0, 1, 2].map((i) => ({
    y: 44 + i * 40,
    b: strengths[i],
    x: rates[i],
  }))
  const fade = (on: boolean) => ({
    opacity: on ? 1 : 0,
    transition: 'opacity 600ms ease',
  })
  const strokeFor = (b: number) =>
    Math.abs(b) < 0.05 ? palette.textMuted : b > 0 ? palette.approach : palette.avoid
  const widthFor = (b: number, x: number) => 1 + Math.min(6, Math.sqrt(Math.abs(b * x)) * 0.9)
  const outGlow = Math.min(1, output / 80)

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ maxWidth: width, display: 'block' }} role="img">
      {/* ---- shared: the three input lines and their strengths ---- */}
      {inputs.map((inp, i) => (
        <g key={i}>
          <line
            x1={IN_X}
            y1={inp.y}
            x2={BODY.x - 26}
            y2={BODY.y + (i - 1) * 10}
            stroke={strokeFor(inp.b)}
            strokeWidth={widthFor(inp.b, inp.x)}
            strokeLinecap="round"
            opacity={0.85}
          />
          <text x={IN_X - 4} y={inp.y + 4} textAnchor="end" fontSize={10} fill={palette.text} fontFamily="var(--font-mono)">
            x{['₁', '₂', '₃'][i]} {inp.x.toFixed(0)}
          </text>
          <text
            x={(IN_X + BODY.x - 26) / 2 - 4}
            y={(inp.y + BODY.y + (i - 1) * 10) / 2 - 5}
            textAnchor="middle"
            fontSize={9}
            fill={palette.textMuted}
            fontFamily="var(--font-mono)"
          >
            b{['₁', '₂', '₃'][i]} {fmt(inp.b)}
          </text>
        </g>
      ))}
      {/* baseline enters from below */}
      <line x1={BODY.x} y1={H - 14} x2={BODY.x} y2={BODY.y + 22} stroke={palette.textMuted} strokeWidth={1} strokeDasharray="3 3" />
      <text x={BODY.x + 4} y={H - 8} fontSize={9} fill={palette.textMuted} fontFamily="var(--font-mono)">
        b₀ {fmt(baseline)}
      </text>

      {/* ---- unit mode: roles as plain shapes ---- */}
      <g style={fade(mode === 'unit')}>
        <rect x={BODY.x - 30} y={BODY.y - 22} width={60} height={44} rx={8} fill={palette.surface2} stroke={palette.border} />
        <text x={BODY.x} y={BODY.y + 4} textAnchor="middle" fontSize={11} fill={palette.text}>
          Σ
        </text>
        <line x1={LINE_X0} y1={BODY.y} x2={LINE_X1} y2={BODY.y} stroke={palette.accent} strokeWidth={2 + 4 * outGlow} strokeLinecap="round" />
        <rect x={TARGET_X - 6} y={BODY.y - 12} width={22} height={24} rx={4} fill="none" stroke={palette.border} />
        <rect x={IN_X - 2} y={30} width={12} height={106} rx={3} fill="none" stroke={palette.border} strokeDasharray="2 3" />
        <text x={IN_X + 4} y={22} textAnchor="middle" fontSize={9} fill={palette.textMuted}>{labels.inputSurface}</text>
        <text x={BODY.x} y={BODY.y - 28} textAnchor="middle" fontSize={9} fill={palette.textMuted}>{labels.integrator}</text>
        <text x={(LINE_X0 + LINE_X1) / 2} y={BODY.y - 10} textAnchor="middle" fontSize={9} fill={palette.textMuted}>{labels.outputLine}</text>
        <text x={GAP_X + 8} y={BODY.y + 26} textAnchor="middle" fontSize={9} fill={palette.textMuted}>{labels.junction}</text>
      </g>

      {/* ---- artificial mode: the reading's figure — circles and arrows ---- */}
      <g style={fade(mode === 'artificial')}>
        <circle cx={BODY.x} cy={BODY.y} r={20} fill={palette.surface2} stroke={palette.border} />
        <text x={BODY.x} y={BODY.y + 4} textAnchor="middle" fontSize={12} fill={palette.text}>
          Σ
        </text>
        {/* the function box: a curve with no name */}
        <rect x={LINE_X0 + 14} y={BODY.y - 16} width={40} height={32} rx={4} fill={palette.surface2} stroke={palette.border} />
        <polyline
          points={`${LINE_X0 + 18},${BODY.y + 10} ${LINE_X0 + 32},${BODY.y + 10} ${LINE_X0 + 50},${BODY.y - 10}`}
          fill="none"
          stroke={palette.accent}
          strokeWidth={1.5}
        />
        <line x1={LINE_X0} y1={BODY.y} x2={LINE_X0 + 14} y2={BODY.y} stroke={palette.accent} strokeWidth={1.5} />
        <line x1={LINE_X0 + 54} y1={BODY.y} x2={LINE_X1 + 20} y2={BODY.y} stroke={palette.accent} strokeWidth={1.5} markerEnd="url(#arrow)" />
        <text x={LINE_X1 + 26} y={BODY.y + 4} fontSize={11} fill={palette.text} fontFamily="var(--font-mono)">y</text>
        <text x={IN_X + 4} y={22} textAnchor="middle" fontSize={9} fill={palette.textMuted}>{labels.inputSurface}</text>
        <text x={BODY.x} y={BODY.y - 28} textAnchor="middle" fontSize={9} fill={palette.textMuted}>{labels.integrator}</text>
        <text x={LINE_X1 - 10} y={BODY.y - 10} textAnchor="middle" fontSize={9} fill={palette.textMuted}>{labels.outputLine}</text>
      </g>

      {/* ---- membrane mode: the parts that fill the roles ---- */}
      <g style={fade(mode === 'membrane')}>
        {/* branching input surface */}
        {inputs.map((inp, i) => (
          <g key={i} stroke={palette.textMuted} strokeWidth={1.2} fill="none">
            <path d={`M ${IN_X + 2} ${inp.y} q 10 -8 22 -10 M ${IN_X + 2} ${inp.y} q 12 6 22 12 M ${IN_X + 14} ${inp.y - 5} l 8 -8`} />
          </g>
        ))}
        {/* the body */}
        <ellipse cx={BODY.x} cy={BODY.y} rx={30} ry={24} fill={profile ? voltageColour(profile[0]) : palette.surface2} stroke={palette.border} />
        {/* the output line, patch by patch */}
        {profile
          ? Array.from({ length: profile.length - 1 }, (_, k) => {
              const n = profile.length - 1
              const x0 = LINE_X0 + ((LINE_X1 - LINE_X0) * k) / n
              const x1 = LINE_X0 + ((LINE_X1 - LINE_X0) * (k + 1)) / n
              const isWrapped = wrapped?.(k + 1) ?? false
              return (
                <line
                  key={k}
                  x1={x0}
                  y1={BODY.y}
                  x2={x1 + 0.5}
                  y2={BODY.y}
                  stroke={voltageColour(profile[k + 1])}
                  strokeWidth={isWrapped ? 9 : 5}
                  opacity={isWrapped ? 0.55 : 1}
                />
              )
            })
          : null}
        {/* the gap */}
        <rect x={GAP_X - 2} y={BODY.y - 14} width={4} height={28} fill={palette.bg} />
        <path d={`M ${TARGET_X - 6} ${BODY.y - 14} v 28`} stroke={palette.border} strokeWidth={2} />
        <circle cx={GAP_X - 6} cy={BODY.y - 5} r={1.6} fill={palette.sensor} />
        <circle cx={GAP_X - 7} cy={BODY.y + 4} r={1.6} fill={palette.sensor} />
        <circle cx={GAP_X - 4} cy={BODY.y + 9} r={1.6} fill={palette.sensor} />
        <text x={IN_X + 4} y={22} textAnchor="middle" fontSize={9} fill={palette.textMuted}>{labels.inputSurface}</text>
        <text x={BODY.x} y={BODY.y - 30} textAnchor="middle" fontSize={9} fill={palette.textMuted}>{labels.integrator}</text>
        <text x={(LINE_X0 + LINE_X1) / 2} y={BODY.y - 10} textAnchor="middle" fontSize={9} fill={palette.textMuted}>{labels.outputLine}</text>
        <text x={GAP_X + 8} y={BODY.y + 26} textAnchor="middle" fontSize={9} fill={palette.textMuted}>{labels.junction}</text>
      </g>

      <defs>
        <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 z" fill={palette.accent} />
        </marker>
      </defs>
      <text x={LINE_X1 - 2} y={BODY.y + 22} textAnchor="end" fontSize={9} fill={palette.text} fontFamily="var(--font-mono)">
        y {output.toFixed(0)}
      </text>
    </svg>
  )
}
