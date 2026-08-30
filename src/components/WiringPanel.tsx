import { Plot } from './Plot'
import { ValueReadout } from './ValueReadout'
import { WiringDiagram } from './WiringDiagram'
import type {
  SensorInput,
  ActuatorOutput,
  SensorimotorWeights,
} from '../sim/neural/sensorimotor'
import { HISTORY_LEN } from '../sim/world/world'
import { palette } from '../theme/theme'

/** Format for display: a real minus sign, 2dp, and no "−0.00". */
export function fmt(n: number): string {
  const v = Math.abs(n) < 0.005 ? 0 : n
  return (v < 0 ? '−' : '') + Math.abs(v).toFixed(2)
}

/**
 * One actuator's arithmetic, written out with live numbers:
 *   A_L = 0.60 + (−2.40 × 0.29) + (−2.40 × 0.45)
 *       = −1.18
 * Only the connections that actually exist contribute a term, so the equation
 * *is* the wiring: an ipsilateral vehicle shows one term per actuator, while a
 * fully-connected one shows two identical expressions for A_L and A_R — which
 * is exactly why it can't steer.
 *
 * The result goes on its own line rather than trailing the sum: the widest
 * case (fully connected) would otherwise run past the panel and hide the very
 * number the student is after.
 */
function equation(
  name: string,
  bias: number,
  terms: { w: number; s: number }[],
  total: number,
): string {
  const parts = terms
    .filter((t) => t.w !== 0)
    .map((t) => `(${fmt(t.w)} × ${fmt(t.s)})`)
  const rhs = parts.length ? `${fmt(bias)} + ${parts.join(' + ')}` : fmt(bias)
  return `${name} = ${rhs}\n${' '.repeat(name.length)} = ${fmt(total)}`
}

/**
 * **The instrument a student learned to read in Lab 1**, and the one thing the
 * Module 2 spec is most insistent must not be rebuilt: Part 3 asks them to open
 * a panel they already know how to use, so it has to be this component and not
 * a lookalike.
 *
 * It lives in `components/` rather than in either scene for that reason. Module
 * 1 wraps it with the per-vehicle tuning sliders; Module 2 wraps it with a
 * genome and an ancestry, and has no sliders because from Module 2 on the
 * wiring is inherited rather than set by hand. What is inside — the diagram,
 * the arithmetic, the sensor trace — is identical in both.
 */
export function WiringPanel({
  weights,
  sensors,
  actuators,
  history,
  plotWidth = 296,
}: {
  weights: SensorimotorWeights
  sensors: SensorInput
  actuators: ActuatorOutput
  history: { left: number[]; right: number[] }
  plotWidth?: number
}) {
  const speed = (actuators.left + actuators.right) / 2

  return (
    <>
      <WiringDiagram weights={weights} sensors={sensors} actuators={actuators} />

      <div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 5 }}>
          How each actuator gets its value
        </div>
        <pre
          style={{
            margin: 0,
            padding: '8px 9px',
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            lineHeight: 1.6,
            color: 'var(--text)',
            overflowX: 'auto',
          }}
        >
          {equation(
            'A_L',
            weights.bias,
            [
              { w: weights.leftToLeft, s: sensors.left },
              { w: weights.rightToLeft, s: sensors.right },
            ],
            actuators.left,
          )}
          {'\n'}
          {equation(
            'A_R',
            weights.bias,
            [
              { w: weights.leftToRight, s: sensors.left },
              { w: weights.rightToRight, s: sensors.right },
            ],
            actuators.right,
          )}
        </pre>
      </div>

      <div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
          Sensor activation over time
        </div>
        <Plot
          width={plotWidth}
          window={HISTORY_LEN}
          series={[
            { color: palette.sensor, data: history.left },
            { color: palette.accent, data: history.right },
          ]}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <ValueReadout label="Speed" value={speed} unit="u/s" />
      </div>
    </>
  )
}
