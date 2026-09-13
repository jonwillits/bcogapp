import { palette } from '../../theme/theme'
import { fmt } from '../../components/format'
import type { Circuit, MotorGroup } from '../../sim/bilaterian/circuit'
import type { SensoryCell } from '../../sim/bilaterian/worm'
import type { ChannelSpec } from '../../sim/bilaterian/scenarios'

/**
 * The nervous system as the student sees it: sensory cells at the top, one
 * interneuron, and two motor groups at the bottom that inhibit each other.
 * A descendant of Lab 1's wiring picture — sensor nodes, actuator nodes,
 * green excitatory and red inhibitory lines, thickness by drive, the
 * numbers printed on the picture — with more in it.
 *
 * The routing switch is a visible object: a pill on the interneuron's
 * output line, saying which motor group the verdict reaches. Click it to
 * flip it, where the scenario allows. Nothing about any cell changes when
 * it flips, which is the whole of §4.2.9.
 *
 * With `hideNumbers`, the structure is drawn and every number is withheld:
 * the four hidden animals of Part 3 are diagnosed by behaviour and by
 * experiment, not by reading the panel.
 */
export function CircuitDiagram({
  circuit,
  cells,
  channels,
  output,
  motor,
  hideNumbers,
  routeLocked,
  onFlipRoute,
}: {
  circuit: Circuit
  cells: readonly SensoryCell[]
  channels: readonly ChannelSpec[]
  output: readonly number[]
  motor: { forward: number; reverse: number }
  hideNumbers: boolean
  routeLocked: boolean
  onFlipRoute: () => void
}) {
  const W = 340
  const H = 296
  const n = cells.length
  const cellX = (i: number) => (n === 1 ? W / 2 : 90 + (i * (W - 180)) / Math.max(1, n - 1))
  const S_Y = 52
  const I = { x: W / 2, y: 152 }
  const J = { x: W / 2, y: 204 }
  const F = { x: 96, y: 254 }
  const R = { x: W - 96, y: 254 }
  const u = circuit.interneurons[0]
  const route: MotorGroup = circuit.routes[0]
  const y = output[0] ?? 0
  const num = (v: number, d = 2) => (hideNumbers ? '·' : fmt(v).padStart(0) && v.toFixed(d).replace('-', '−'))

  const width = (w: number, x: number) => 1 + Math.min(9, Math.sqrt(Math.abs(w * x)) * 7)

  const node = (x: number, yy: number, r: number, fill: string, glow: number, label: string) => (
    <g>
      <circle cx={x} cy={yy} r={r} fill={fill} opacity={0.3 + 0.7 * Math.max(0, Math.min(1, glow))} stroke={palette.border} />
      <text x={x} y={yy + 4} textAnchor="middle" fontSize={11} fill={palette.text} fontFamily="var(--font-mono)">
        {label}
      </text>
    </g>
  )

  const target = route === 'forward' ? F : R
  const other = route === 'forward' ? R : F

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Sensory cells, one interneuron, two motor groups">
      {/* weights: sensory cell → interneuron */}
      {cells.map((c, i) => {
        const w = u.weights[i] ?? 0
        const absent = Math.abs(w) < 1e-9
        return (
          <g key={`w${i}`}>
            <line
              x1={cellX(i)}
              y1={S_Y + 16}
              x2={I.x}
              y2={I.y - 16}
              stroke={absent ? palette.textMuted : w > 0 ? palette.approach : palette.avoid}
              strokeWidth={absent ? 1 : width(w, c.output)}
              strokeDasharray={absent ? '2 4' : undefined}
              strokeLinecap="round"
              opacity={absent ? 0.5 : 0.85}
            />
            <text
              x={cellX(i) + (I.x - cellX(i)) * 0.55 + (cellX(i) < I.x ? -16 : cellX(i) > I.x ? 16 : 18)}
              y={S_Y + 16 + (I.y - 16 - S_Y - 16) * 0.55 + 3}
              textAnchor="middle"
              fontSize={9.5}
              fill={palette.textMuted}
              fontFamily="var(--font-mono)"
            >
              b{'₁₂₃₄'[i]} = {hideNumbers ? '?' : fmt(w)}
            </text>
          </g>
        )
      })}
      {/* interneuron → junction → routed motor group */}
      <line x1={I.x} y1={I.y + 16} x2={J.x} y2={J.y - 9} stroke={palette.accent} strokeWidth={1 + 6 * y} strokeLinecap="round" />
      <line x1={J.x} y1={J.y + 9} x2={target.x} y2={target.y - 16} stroke={palette.accent} strokeWidth={1 + 6 * y} strokeLinecap="round" />
      <line x1={J.x} y1={J.y + 9} x2={other.x} y2={other.y - 16} stroke={palette.textMuted} strokeWidth={1} strokeDasharray="2 4" opacity={0.5} />
      {/* mutual inhibition between the motor groups */}
      <path d={`M ${F.x + 16} ${F.y - 6} Q ${W / 2} ${F.y - 22} ${R.x - 18} ${R.y - 6}`} fill="none" stroke={palette.avoid} strokeWidth={1.4} />
      <line x1={R.x - 18} y1={R.y - 12} x2={R.x - 18} y2={R.y} stroke={palette.avoid} strokeWidth={2} />
      <path d={`M ${R.x - 16} ${R.y + 6} Q ${W / 2} ${R.y + 22} ${F.x + 18} ${F.y + 6}`} fill="none" stroke={palette.avoid} strokeWidth={1.4} />
      <line x1={F.x + 18} y1={F.y} x2={F.x + 18} y2={F.y + 12} stroke={palette.avoid} strokeWidth={2} />
      <text x={W / 2} y={F.y + 3} textAnchor="middle" fontSize={8} fill={palette.textMuted}>each inhibits the other</text>

      {/* sensory cells */}
      {cells.map((c, i) => (
        <g key={`c${i}`}>
          {node(cellX(i), S_Y, 16, channels[i]?.color ?? palette.sensor, c.output, `x${'₁₂₃₄'[i]}`)}
          <text x={cellX(i)} y={S_Y - 24} textAnchor="middle" fontSize={9.5} fill={palette.text}>
            {channels[i]?.name ?? `cue ${i + 1}`}
          </text>
          <text x={cellX(i)} y={S_Y + 30} textAnchor="middle" fontSize={10} fill={palette.text} fontFamily="var(--font-mono)">
            {hideNumbers ? '·' : c.output.toFixed(2)}
          </text>
        </g>
      ))}
      {/* the interneuron */}
      {node(I.x, I.y, 18, palette.accent, y, 'y')}
      <text x={I.x + 26} y={I.y - 4} fontSize={9.5} fill={palette.textMuted} fontFamily="var(--font-mono)">
        b₀ = {hideNumbers ? '?' : fmt(u.baseline)}
      </text>
      <text x={I.x + 26} y={I.y + 8} fontSize={9.5} fill={palette.textMuted} fontFamily="var(--font-mono)">
        θ = {hideNumbers ? '?' : fmt(u.threshold)}
      </text>
      <text x={I.x - 26} y={I.y + 3} textAnchor="end" fontSize={10} fill={palette.text} fontFamily="var(--font-mono)">
        {hideNumbers ? '·' : y.toFixed(2)}
      </text>
      <text x={I.x} y={I.y - 26} textAnchor="middle" fontSize={9} fill={palette.textMuted}>interneuron</text>

      {/* the routing switch */}
      <g
        onClick={routeLocked ? undefined : onFlipRoute}
        style={{ cursor: routeLocked ? 'default' : 'pointer' }}
        role={routeLocked ? undefined : 'button'}
      >
        <rect x={J.x - 44} y={J.y - 9} width={88} height={18} rx={9} fill={routeLocked ? palette.surface2 : palette.surface} stroke={routeLocked ? palette.border : palette.accent} strokeWidth={1.2} />
        <text x={J.x} y={J.y + 4} textAnchor="middle" fontSize={9.5} fill={palette.text}>
          → {route} group
        </text>
      </g>
      <text x={J.x + 50} y={J.y + 4} fontSize={8} fill={palette.textMuted}>{routeLocked ? 'locked' : 'click to flip'}</text>

      {/* motor groups */}
      {node(F.x, F.y, 16, palette.actuator, motor.forward, 'F')}
      {node(R.x, R.y, 16, palette.sensor, motor.reverse, 'R')}
      <text x={F.x} y={F.y + 30} textAnchor="middle" fontSize={9.5} fill={palette.text}>forward group</text>
      <text x={R.x} y={R.y + 30} textAnchor="middle" fontSize={9.5} fill={palette.text}>reverse group</text>
      <text x={F.x - 26} y={F.y + 3} textAnchor="end" fontSize={9.5} fill={palette.text} fontFamily="var(--font-mono)">{num(motor.forward)}</text>
      <text x={R.x + 26} y={R.y + 3} fontSize={9.5} fill={palette.text} fontFamily="var(--font-mono)">{num(motor.reverse)}</text>
      <text x={W / 2} y={H - 4} textAnchor="middle" fontSize={8.5} fill={palette.textMuted}>
        forward wave: head to tail · reverse wave: tail to head
      </text>
    </svg>
  )
}
