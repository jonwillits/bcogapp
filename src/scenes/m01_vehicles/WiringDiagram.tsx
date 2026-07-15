import type { Wiring } from '../../sim/neural/sensorimotor'
import type { SensorInput, MotorOutput } from '../../sim/neural/sensorimotor'
import { palette } from '../../theme/theme'

/**
 * The "click a vehicle → see its wiring" inspector graphic. Two sensor nodes
 * (top) connect to two motor nodes (bottom); the connection pattern shows the
 * crossed/uncrossed wiring, its color shows excitatory (green) vs inhibitory
 * (red), and its thickness + the node glow track the live activation.
 */
export function WiringDiagram({
  wiring,
  sensors,
  motors,
}: {
  wiring: Wiring
  sensors: SensorInput
  motors: MotorOutput
}) {
  const W = 236
  const H = 150
  const sL = { x: 58, y: 30 }
  const sR = { x: 178, y: 30 }
  const mL = { x: 58, y: 120 }
  const mR = { x: 178, y: 120 }

  const linkColor = wiring.sign > 0 ? palette.approach : palette.avoid
  const width = (v: number) => 1 + Math.min(6, Math.abs(v) * 3)

  // Which sensor drives which motor.
  const links = wiring.crossed
    ? [
        { from: sL, to: mR, v: sensors.left },
        { from: sR, to: mL, v: sensors.right },
      ]
    : [
        { from: sL, to: mL, v: sensors.left },
        { from: sR, to: mR, v: sensors.right },
      ]

  const sensorGlow = (v: number) => Math.min(1, v * 1.2)
  const motorGlow = (v: number) => Math.min(1, Math.max(0, v) / 3)

  const node = (
    x: number,
    y: number,
    fill: string,
    glow: number,
    label: string,
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
    </g>
  )

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="Sensor to motor wiring"
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
      {node(sL.x, sL.y, palette.sensor, sensorGlow(sensors.left), 'S')}
      {node(sR.x, sR.y, palette.sensor, sensorGlow(sensors.right), 'S')}
      {node(mL.x, mL.y, palette.accent, motorGlow(motors.left), 'M')}
      {node(mR.x, mR.y, palette.accent, motorGlow(motors.right), 'M')}
      <text x={sL.x - 26} y={sL.y + 4} fontSize={10} fill={palette.textMuted}>
        L
      </text>
      <text x={sR.x + 20} y={sR.y + 4} fontSize={10} fill={palette.textMuted}>
        R
      </text>
    </svg>
  )
}
