import { fmt } from './format'
import type {
  SensorInput,
  ActuatorOutput,
  SensorimotorWeights,
} from '../sim/neural/sensorimotor'

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
 * Both actuators' arithmetic, and nothing else.
 *
 * **No heading.** Whoever renders this decides what to call it, because the two
 * labs word it differently and will keep diverging — see the note on primitives
 * versus compositions in `WiringDiagram`.
 */
export function ActuatorEquation({
  weights,
  sensors,
  actuators,
}: {
  weights: SensorimotorWeights
  sensors: SensorInput
  actuators: ActuatorOutput
}) {
  return (
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
  )
}
