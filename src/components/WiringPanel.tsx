import { ValueReadout } from './ValueReadout'
import { WiringDiagram } from './WiringDiagram'
import { ActuatorEquation } from './ActuatorEquation'
import { SensorTrace } from './SensorTrace'
import type {
  SensorInput,
  ActuatorOutput,
  SensorimotorWeights,
} from '../sim/neural/sensorimotor'

export { fmt } from './format'

/**
 * **The instrument a student learned to read in Lab 1**, and the one thing the
 * Module 2 spec is most insistent must not be rebuilt: Part 3 asks them to open
 * a panel they already know how to use, so it has to be this component and not
 * a lookalike.
 *
 * **This is now Module 1's composition, not a shared one.** It was shared with
 * Module 2 until that panel needed different headings and a different grouping,
 * at which point the honest choices were a growing set of flags to switch parts
 * of it off, or two compositions over the same primitives. The parts —
 * `WiringDiagram`, `ActuatorEquation`, `SensorTrace` — are the shared things;
 * this file is one arrangement of them and `m02_evolution/IndividualPanel` is
 * another. Module 2's spec insistence that Part 3 open "the panel they already
 * know" is satisfied by the instruments being identical, which they are.
 *
 * It stays in `components/` for now only because moving it would edit Module 1,
 * which is live and deliberately untouched pending the wider decision about how
 * per-module UI should vary.
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
        <ActuatorEquation weights={weights} sensors={sensors} actuators={actuators} />
      </div>

      <div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
          Sensor activation over time
        </div>
        <SensorTrace history={history} width={plotWidth} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <ValueReadout label="Speed" value={speed} unit="u/s" />
      </div>
    </>
  )
}
