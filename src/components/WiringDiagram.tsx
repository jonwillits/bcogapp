import type {
  SensorInput,
  ActuatorOutput,
  SensorimotorWeights,
} from '../sim/neural/sensorimotor'
import { DEFAULT_STRENGTH } from '../sim/world/world'
import { palette } from '../theme/theme'

/**
 * A connection this weak is drawn as a faint dotted line rather than a real
 * one: present in the genome, doing nothing you could see. A weight of exactly
 * zero — M1's zeroed diagonal — is not drawn at all, because for a Module 1
 * vehicle that connection genuinely does not exist.
 *
 * The distinction matters from Module 2 on, where weights are continuous and
 * evolve. "Ipsilateral" then means "the crossed weights drifted near zero", and
 * a student asked to classify the wiring needs to see that as *nearly* absent
 * rather than as absent or as present.
 */
const EFFECTIVELY_ABSENT = 0.15

/**
 * The "click a vehicle → see its wiring" inspector graphic. Two sensor nodes
 * (top) connect to two actuator nodes (bottom); the connection pattern shows the
 * crossed/uncrossed wiring, its color shows excitatory (green) vs inhibitory
 * (red), and its thickness + the node glow track the live activation.
 *
 * Takes the full 2×2 weight matrix rather than a wiring *pattern*, because from
 * Module 2 on there is no pattern to name: the four weights are genes and each
 * one is a real number that evolves. Every Module 1 vehicle is that same matrix
 * with a diagonal zeroed, so this draws M1 exactly as it always did — but a
 * connection's sign and thickness are now read per connection, which is what
 * lets an evolved genome with, say, one strong crossed excitatory weight and one
 * weak straight inhibitory one show up honestly.
 */
export function WiringDiagram({
  weights,
  sensors,
  actuators,
}: {
  weights: SensorimotorWeights
  sensors: SensorInput
  actuators: ActuatorOutput
}) {
  // Extra vertical room so each node's live value sits outside its circle
  // (sensor values above, actuator values below) without touching the edge, and
  // so the two headings have somewhere to go.
  const W = 236
  const H = 204
  const sL = { x: 58, y: 62 }
  const sR = { x: 178, y: 62 }
  const aL = { x: 58, y: 148 }
  const aR = { x: 178, y: 148 }

  /**
   * Thickness tracks the live *drive* through the connection — weight × sensor.
   * Using the drive rather than the bare sensor value is what makes a weak
   * inherited connection look weak; under the old sensor-only rule every
   * connection a vehicle had was drawn the same width regardless of its
   * strength, so dragging the connection-strength slider changed nothing.
   *
   * The response is a square root rather than linear, and that is the whole of
   * why the slider now reads clearly. Sensor values in ordinary play sit around
   * 0.1–0.5, so a linear map spends almost all of its range on drives that
   * never occur and squeezes every real reading into the bottom two pixels —
   * which is exactly how it looked. A square root spends the range where the
   * values actually are.
   */
  const width = (w: number, s: number) =>
    1 + Math.min(9, Math.sqrt(Math.abs(w * s) / DEFAULT_STRENGTH) * 7)

  // All four connections, always considered; which ones are *drawn* falls out
  // of their weights. Crossed pair first so the straight pair draws on top,
  // which is the stacking M1's fully-connected vehicles have always had.
  const links = [
    { from: sL, to: aR, w: weights.leftToRight, s: sensors.left },
    { from: sR, to: aL, w: weights.rightToLeft, s: sensors.right },
    { from: sL, to: aL, w: weights.leftToLeft, s: sensors.left },
    { from: sR, to: aR, w: weights.rightToRight, s: sensors.right },
  ]
    .filter((l) => Math.abs(l.w) > 1e-9)
    // Faint near-absent connections underneath the real ones.
    .sort((a, b) => Math.abs(a.w) - Math.abs(b.w))

  const sensorGlow = (v: number) => Math.min(1, v * 1.2)
  const actuatorGlow = (v: number) => Math.min(1, Math.max(0, v) / 3)

  // A node carries its letter inside and its live value just outside, so the
  // numbers a student needs are on the picture rather than in a separate list.
  const node = (
    x: number,
    y: number,
    fill: string,
    glow: number,
    label: string,
    value: number,
    valueBelow: boolean,
  ) => (
    <g>
      <circle
        cx={x}
        cy={y}
        r={16}
        fill={fill}
        opacity={0.35 + 0.65 * glow}
        stroke={palette.border}
      />
      <text
        x={x}
        y={y + 4}
        textAnchor="middle"
        fontSize={11}
        fill={palette.text}
        fontFamily="var(--font-mono)"
      >
        {label}
      </text>
      <text
        x={x}
        y={valueBelow ? y + 31 : y - 22}
        textAnchor="middle"
        fontSize={11}
        fill={palette.text}
        fontFamily="var(--font-mono)"
      >
        {value.toFixed(2)}
      </text>
    </g>
  )

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="Sensor to actuator wiring"
    >
      {links.map((l, i) => {
        const absent = Math.abs(l.w) < EFFECTIVELY_ABSENT
        return (
          <line
            key={i}
            x1={l.from.x}
            y1={l.from.y}
            x2={l.to.x}
            y2={l.to.y}
            stroke={
              absent
                ? palette.textMuted
                : l.w > 0
                  ? palette.approach
                  : palette.avoid
            }
            strokeWidth={absent ? 1 : width(l.w, l.s)}
            strokeDasharray={absent ? '2 4' : undefined}
            strokeLinecap="round"
            opacity={absent ? 0.5 : 0.85}
          />
        )
      })}
      {/*
        Each connection's own strength, printed small at the midpoint of its
        line. The numbers on the nodes change every frame; these do not, and
        telling apart "what this creature is sensing right now" from "how
        strongly it is wired" is exactly what Q11 asks a student to do.

        Placed a third of the way down from the sensor rather than at the
        midpoint, because the two crossed connections *share* their midpoint —
        both run through the centre of the diagram — and labelling both there
        prints one number on top of the other. A third of the way down, all four
        land in distinct places, and the straight pair is nudged outward so its
        labels clear the lines they belong to.
      */}
      {links.map((l, i) => {
        const t = 0.32
        const straight = l.from.x === l.to.x
        return (
          <text
            key={`w${i}`}
            x={l.from.x + (l.to.x - l.from.x) * t + (straight ? (l.from.x < W / 2 ? -14 : 14) : 0)}
            y={l.from.y + (l.to.y - l.from.y) * t + 3}
            textAnchor="middle"
            fontSize={9}
            fill={palette.textMuted}
            fontFamily="var(--font-mono)"
          >
            {l.w.toFixed(1)}
          </text>
        )
      })}
      <text x={W / 2} y={11} textAnchor="middle" fontSize={9} fill={palette.textMuted}>
        Current sensor activation
      </text>
      <text x={W / 2} y={H - 3} textAnchor="middle" fontSize={9} fill={palette.textMuted}>
        Current actuator activation
      </text>
      {node(sL.x, sL.y, palette.sensor, sensorGlow(sensors.left), 'S', sensors.left, false)}
      {node(sR.x, sR.y, palette.sensor, sensorGlow(sensors.right), 'S', sensors.right, false)}
      {node(aL.x, aL.y, palette.accent, actuatorGlow(actuators.left), 'A', actuators.left, true)}
      {node(aR.x, aR.y, palette.accent, actuatorGlow(actuators.right), 'A', actuators.right, true)}
      <text x={sL.x - 26} y={sL.y + 4} fontSize={10} fill={palette.textMuted}>
        L
      </text>
      <text x={sR.x + 20} y={sR.y + 4} fontSize={10} fill={palette.textMuted}>
        R
      </text>
    </svg>
  )
}
