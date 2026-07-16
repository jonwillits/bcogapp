import { Panel } from '../../components/Panel'
import { ValueReadout } from '../../components/ValueReadout'
import { Plot } from '../../components/Plot'
import { Slider } from '../../components/controls'
import { WiringDiagram } from './WiringDiagram'
import { type Vehicle, HISTORY_LEN } from '../../sim/world/world'
import { getPreset } from '../../sim/creature/vehiclePresets'
import { palette } from '../../theme/theme'

/** Format for display: a real minus sign, 2dp, and no "−0.00". */
function fmt(n: number): string {
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
  base: number,
  terms: { w: number; s: number }[],
  total: number,
): string {
  const parts = terms
    .filter((t) => t.w !== 0)
    .map((t) => `(${fmt(t.w)} × ${fmt(t.s)})`)
  const rhs = parts.length ? `${fmt(base)} + ${parts.join(' + ')}` : fmt(base)
  return `${name} = ${rhs}\n${' '.repeat(name.length)} = ${fmt(total)}`
}

/**
 * The side inspector for a selected vehicle: its wiring with live values, the
 * arithmetic behind each actuator, a sensor trace, and this creature's own
 * tuning. Gain and base belong to the individual, so changing them here
 * affects only the selected vehicle — letting a student hold the other five
 * fixed and vary one.
 */
export function VehicleInspector({
  vehicle,
  onClose,
  onTune,
}: {
  vehicle: Vehicle
  onClose: () => void
  onTune: (patch: { gain?: number; base?: number }) => void
}) {
  const preset = getPreset(vehicle.presetId)
  const w = vehicle.weights
  const s = vehicle.sensors
  const speed = (vehicle.actuators.left + vehicle.actuators.right) / 2
  // Every connection currently shares one strength (sign × gain); they only
  // diverge once learning adjusts them individually.
  const strength = preset.wiring.sign * vehicle.gain

  return (
    <Panel
      title="Vehicle inspector"
      onClose={onClose}
      style={{ width: 320 }}
      headerAccessory={
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontFamily: 'var(--font-mono)',
            fontSize: 13,
            fontWeight: 600,
            color: vehicle.color,
          }}
        >
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: vehicle.color,
            }}
          />
          {preset.label}
        </span>
      }
    >
      <div style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.45 }}>
        Its two sensors connect to its two actuators as shown. From the wiring and
        the live values, work out why it behaves the way it does.
      </div>

      <WiringDiagram
        wiring={preset.wiring}
        sensors={s}
        actuators={vehicle.actuators}
      />

      <div>
        <div
          style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 5 }}
        >
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
            vehicle.base,
            [
              { w: w.leftToLeft, s: s.left },
              { w: w.rightToLeft, s: s.right },
            ],
            vehicle.actuators.left,
          )}
          {'\n'}
          {equation(
            'A_R',
            vehicle.base,
            [
              { w: w.leftToRight, s: s.left },
              { w: w.rightToRight, s: s.right },
            ],
            vehicle.actuators.right,
          )}
        </pre>
      </div>

      <div>
        <div
          style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}
        >
          Sensor activation over time
        </div>
        <Plot
          width={296}
          window={HISTORY_LEN}
          series={[
            { color: palette.sensor, data: vehicle.history.left },
            { color: palette.accent, data: vehicle.history.right },
          ]}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <ValueReadout label="Connection strength" value={strength} />
        <ValueReadout label="Speed" value={speed} unit="u/s" />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          Tuning — affects only this vehicle
        </div>
        <Slider
          label="Sensor gain"
          value={vehicle.gain}
          min={0}
          max={5}
          step={0.1}
          onChange={(gain) => onTune({ gain })}
        />
        <Slider
          label="Base drive"
          value={vehicle.base}
          min={-1}
          max={2}
          step={0.1}
          onChange={(base) => onTune({ base })}
        />
      </div>
    </Panel>
  )
}
