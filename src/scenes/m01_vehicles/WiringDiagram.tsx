import type { Wiring } from '../../sim/neural/sensorimotor'
import type { SensorInput, ActuatorOutput } from '../../sim/neural/sensorimotor'
import { palette } from '../../theme/theme'

/**
 * The "click a vehicle → see its wiring" inspector graphic. Two sensor nodes
 * (top) connect to two actuator nodes (bottom); the connection pattern shows the
 * crossed/uncrossed wiring, its color shows excitatory (green) vs inhibitory
 * (red), and its thickness + the node glow track the live activation.
 */
export function WiringDiagram({
  wiring,
  sensors,
  actuators,
}: {
  wiring: Wiring
  sensors: SensorInput
  actuators: ActuatorOutput
}) {
  // Extra vertical room so each node's live value sits outside its circle
  // (sensor values above, actuator values below) without touching the edge.
  const W = 236
  const H = 176
  const sL = { x: 58, y: 46 }
  const sR = { x: 178, y: 46 }
  const aL = { x: 58, y: 132 }
  const aR = { x: 178, y: 132 }

  const linkColor = wiring.sign > 0 ? palette.approach : palette.avoid
  const width = (v: number) => 1 + Math.min(6, Math.abs(v) * 3)

  // Which sensor drives which actuator. `full` shows all four connections —
  // ipsilateral/contralateral are the same picture with one pair removed.
  const ipsi = [
    { from: sL, to: aL, v: sensors.left },
    { from: sR, to: aR, v: sensors.right },
  ]
  const contra = [
    { from: sL, to: aR, v: sensors.left },
    { from: sR, to: aL, v: sensors.right },
  ]
  const links =
    wiring.pattern === 'full'
      ? [...contra, ...ipsi] // crossed first so the straight pair draws on top
      : wiring.pattern === 'contralateral'
        ? contra
        : ipsi

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
      {links.map((l, i) => (
        <line
          key={i}
          x1={l.from.x}
          y1={l.from.y}
          x2={l.to.x}
          y2={l.to.y}
          stroke={linkColor}
          strokeWidth={width(l.v)}
          strokeLinecap="round"
          opacity={0.85}
        />
      ))}
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
