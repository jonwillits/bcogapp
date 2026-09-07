import { palette } from '../../theme/theme'
import { fmt } from '../../components/format'
import { DEFAULT_STRENGTH } from '../../sim/world/world'

/**
 * The vehicle's wiring, as Lab 1 drew it, with a cell where each line was.
 *
 * Two sensors at the top, two actuators at the bottom, straight lines and
 * crossed lines between them in Lab 1's conventions — green excitatory, red
 * inhibitory, thickness by drive, the strength printed on the line. What
 * Lab 1 drew as a bare line into an actuator is now a cell: its two inputs
 * meet at an integrator, and its output line runs down to the actuator.
 * Because both sensors' lines are drawn into both cells, there is no
 * doubt that each cell's x₁ is the same-side sensor and its x₂ the opposite
 * one, and the crossing *is* the contralateral wiring. Each cell's lines
 * carry its own strengths, so two cells wired differently look different.
 *
 * Two modes draw the cell in the same place: the Unit tab's roles and the
 * Membrane tab's parts, cross-fading when the mode changes so the roles
 * visibly turn into the parts.
 * The words come in as props; this file knows neither vocabulary.
 *
 * Clicking a cell selects it, and the instruments below the picture show
 * that cell.
 */

export type DiagramMode = 'unit' | 'membrane'
export type Side = 'left' | 'right'

export interface DiagramLabels {
  inputSurface: string
  integrator: string
  outputLine: string
  junction: string
}

export interface PairDiagramProps {
  mode: DiagramMode
  labels: DiagramLabels
  /** Each cell's own baseline and two strengths. */
  wiring: Record<Side, { b0: number; bIpsi: number; bContra: number }>
  /** The two sensors' live readings. */
  sensors: { left: number; right: number }
  /** Each cell's live input rates, [same side, opposite side]. */
  rates: Record<Side, [number, number]>
  /** Each cell's output rate, spikes per second. */
  outputs: Record<Side, number>
  /** Each wheel's speed, arena units per second. */
  wheels: Record<Side, number>
  /** Voltage along each cell, soma first — colours the parts in membrane mode. */
  profiles?: Record<Side, ArrayLike<number>>
  /** Which axon patches are wrapped in myelin (membrane mode). */
  wrapped?: (i: number) => boolean
  /** Whether the inputs are the sensors (true) or the sliders. */
  fromSensors: boolean
  selected: Side
  onSelect: (s: Side) => void
}

const W = 340
const H = 254
const CX: Record<Side, number> = { left: 104, right: 236 }
const S_Y = 40
const IN_Y = 88
const BODY_Y = 126
const LINE_Y0 = 146
const GAP_Y = 200
const A_Y = 224

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

const MONO = 'var(--font-mono)'

export function PairDiagram({
  mode,
  labels,
  wiring,
  sensors,
  rates,
  outputs,
  wheels,
  profiles,
  wrapped,
  fromSensors,
  selected,
  onSelect,
}: PairDiagramProps) {
  const fade = (on: boolean) => ({ opacity: on ? 1 : 0, transition: 'opacity 600ms ease' })
  const strokeFor = (b: number) => (b > 0 ? palette.approach : palette.avoid)
  // Lab 1's rule: thickness by drive, square-rooted so ordinary readings use
  // the range, and a connection of exactly zero is not drawn at all.
  const width = (b: number, x: number) =>
    1 + Math.min(9, Math.sqrt(Math.abs(b * x) / (DEFAULT_STRENGTH * 10)) * 7)
  const sides: Side[] = ['left', 'right']
  const other = (s: Side): Side => (s === 'left' ? 'right' : 'left')
  const sensorOf = (s: Side) => (s === 'left' ? sensors.left : sensors.right)

  // Connections: each cell's same-side (straight) and opposite-side (crossed) line.
  const links = sides.flatMap((s) => [
    { from: { x: CX[s], y: S_Y + 15 }, to: { x: CX[s] - 14, y: IN_Y }, b: wiring[s].bIpsi, x: rates[s][0], straight: true, key: `${s}-ipsi` },
    { from: { x: CX[other(s)], y: S_Y + 15 }, to: { x: CX[s] + 14, y: IN_Y }, b: wiring[s].bContra, x: rates[s][1], straight: false, key: `${s}-contra` },
  ]).filter((l) => Math.abs(l.b) > 1e-9)

  const roleLabel = (y: number, text: string) => (
    <text x={CX.left - 46} y={y} textAnchor="end" fontSize={9} fill={palette.textMuted}>
      {text}
    </text>
  )

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }} role="img" aria-label="Two sensors, two cells, two actuators">
      <text x={W / 2} y={9} textAnchor="middle" fontSize={9} fill={palette.textMuted}>
        {fromSensors ? 'Current sensor activation' : 'Inputs from the sliders — the sensors are not driving the cells'}
      </text>

      {/* connections, crossed pair first so the straight pair draws on top */}
      {[...links].sort((a, b) => Number(a.straight) - Number(b.straight)).map((l) => (
        <line
          key={l.key}
          x1={l.from.x}
          y1={l.from.y}
          x2={l.to.x}
          y2={l.to.y}
          stroke={strokeFor(l.b)}
          strokeWidth={width(l.b, l.x)}
          strokeLinecap="round"
          opacity={0.85}
        />
      ))}
      {links.map((l) => {
        const t = l.straight ? 0.5 : 0.68
        const x = l.from.x + (l.to.x - l.from.x) * t + (l.straight ? (l.from.x < W / 2 ? -16 : 16) : 0)
        const y = l.from.y + (l.to.y - l.from.y) * t + (l.straight ? 3 : 12)
        return (
          <text key={`${l.key}-w`} x={x} y={y} textAnchor="middle" fontSize={9} fill={palette.textMuted} fontFamily={MONO}>
            {l.straight ? 'b₁' : 'b₂'} {fmt(l.b)}
          </text>
        )
      })}

      {/* sensors */}
      {sides.map((s) => (
        <g key={`S-${s}`} opacity={fromSensors ? 1 : 0.45}>
          <circle cx={CX[s]} cy={S_Y} r={15} fill={palette.sensor} opacity={0.35 + 0.65 * Math.min(1, sensorOf(s) * 1.2)} stroke={palette.border} />
          <text x={CX[s]} y={S_Y + 4} textAnchor="middle" fontSize={11} fill={palette.text} fontFamily={MONO}>S</text>
          <text x={CX[s]} y={S_Y - 19} textAnchor="middle" fontSize={10} fill={palette.text} fontFamily={MONO}>{sensorOf(s).toFixed(2)}</text>
          <text x={CX[s] + (s === 'left' ? -24 : 24)} y={S_Y + 4} fontSize={10} fill={palette.textMuted} textAnchor="middle">{s === 'left' ? 'L' : 'R'}</text>
        </g>
      ))}

      {/* the two cells */}
      {sides.map((s) => {
        const cx = CX[s]
        const profile = profiles?.[s]
        const somaColour = profile ? voltageColour(profile[0]) : palette.surface2
        const isSel = selected === s
        return (
          <g key={`cell-${s}`} style={{ cursor: 'pointer' }} onClick={() => onSelect(s)}>
            {/* selection */}
            <rect x={cx - 40} y={IN_Y - 14} width={80} height={A_Y - IN_Y - 4} rx={10} fill="none" stroke={isSel ? palette.accent : palette.border} strokeWidth={isSel ? 1.6 : 0.8} strokeDasharray={isSel ? undefined : '3 4'} opacity={isSel ? 0.9 : 0.5} />
            {/* the two input rates, printed where the lines arrive */}
            <text x={cx - 14} y={IN_Y - 4} textAnchor="middle" fontSize={8.5} fill={palette.text} fontFamily={MONO}>x₁ {rates[s][0].toFixed(0)}</text>
            <text x={cx + 14} y={IN_Y - 4} textAnchor="middle" fontSize={8.5} fill={palette.text} fontFamily={MONO}>x₂ {rates[s][1].toFixed(0)}</text>
            <line x1={cx - 14} y1={IN_Y} x2={cx - 6} y2={BODY_Y - 14} stroke={palette.textMuted} strokeWidth={1} />
            <line x1={cx + 14} y1={IN_Y} x2={cx + 6} y2={BODY_Y - 14} stroke={palette.textMuted} strokeWidth={1} />
            {/* baseline enters from the side */}
            <line x1={cx + 40} y1={BODY_Y} x2={cx + 26} y2={BODY_Y} stroke={palette.textMuted} strokeWidth={1} strokeDasharray="3 3" />
            <text x={cx + 30} y={BODY_Y - 5} textAnchor="middle" fontSize={8} fill={palette.textMuted} fontFamily={MONO}>b₀ {fmt(wiring[s].b0)}</text>

            {/* unit mode: a box */}
            <g style={fade(mode === 'unit')}>
              <rect x={cx - 26} y={BODY_Y - 16} width={52} height={32} rx={7} fill={palette.surface2} stroke={palette.border} />
              <text x={cx} y={BODY_Y + 4} textAnchor="middle" fontSize={11} fill={palette.text}>Σ</text>
              <line x1={cx} y1={LINE_Y0} x2={cx} y2={GAP_Y - 3} stroke={palette.accent} strokeWidth={2 + 4 * Math.min(1, outputs[s] / 80)} strokeLinecap="round" />
              <rect x={cx - 12} y={GAP_Y + 2} width={24} height={6} rx={2} fill="none" stroke={palette.border} />
            </g>


            {/* membrane mode: the parts */}
            <g style={fade(mode === 'membrane')}>
              <g stroke={palette.textMuted} strokeWidth={1.1} fill="none">
                <path d={`M ${cx - 14} ${IN_Y} l -8 -6 M ${cx - 14} ${IN_Y} l 6 -8 M ${cx + 14} ${IN_Y} l 8 -6 M ${cx + 14} ${IN_Y} l -6 -8`} />
              </g>
              <ellipse cx={cx} cy={BODY_Y} rx={26} ry={18} fill={somaColour} stroke={palette.border} />
              {profile
                ? Array.from({ length: profile.length - 1 }, (_, k) => {
                    const n = profile.length - 1
                    const y0 = LINE_Y0 + ((GAP_Y - 3 - LINE_Y0) * k) / n
                    const y1 = LINE_Y0 + ((GAP_Y - 3 - LINE_Y0) * (k + 1)) / n
                    const isWrapped = wrapped?.(k + 1) ?? false
                    return (
                      <line key={k} x1={cx} y1={y0} x2={cx} y2={y1 + 0.5} stroke={voltageColour(profile[k + 1])} strokeWidth={isWrapped ? 9 : 5} opacity={isWrapped ? 0.55 : 1} />
                    )
                  })
                : null}
              {/* the gap, with vesicles */}
              <rect x={cx - 12} y={GAP_Y - 1} width={24} height={8} fill={palette.bg} />
              <circle cx={cx - 4} cy={GAP_Y - 5} r={1.5} fill={palette.sensor} />
              <circle cx={cx + 3} cy={GAP_Y - 6} r={1.5} fill={palette.sensor} />
              <circle cx={cx} cy={GAP_Y - 9} r={1.5} fill={palette.sensor} />
              <line x1={cx - 12} y1={GAP_Y + 8} x2={cx + 12} y2={GAP_Y + 8} stroke={palette.border} strokeWidth={2} />
            </g>

            {/* output rate, beside the output line */}
            <text x={cx + 8} y={LINE_Y0 + 52} fontSize={9} fill={palette.text} fontFamily={MONO}>
              y {outputs[s].toFixed(0)}
            </text>

            {/* the actuator */}
            <circle cx={cx} cy={A_Y} r={13} fill={palette.accent} opacity={0.35 + 0.65 * Math.min(1, Math.max(0, wheels[s]) / 3)} stroke={palette.border} />
            <text x={cx} y={A_Y + 4} textAnchor="middle" fontSize={11} fill={palette.text} fontFamily={MONO}>A</text>
            <text x={cx} y={A_Y + 26} textAnchor="middle" fontSize={9} fill={palette.text} fontFamily={MONO}>{wheels[s].toFixed(2)}</text>
          </g>
        )
      })}

      {/* the four names, once, beside the left cell */}
      {roleLabel(IN_Y - 2, labels.inputSurface)}
      {roleLabel(BODY_Y + 3, labels.integrator)}
      {roleLabel(LINE_Y0 + 28, labels.outputLine)}
      {roleLabel(GAP_Y + 6, labels.junction)}
      <text x={W / 2} y={H - 2} textAnchor="middle" fontSize={8.5} fill={palette.textMuted}>
        muted numbers on the lines: strengths, fixed · bright numbers: activity, live · click a cell to show it below
      </text>
    </svg>
  )
}
