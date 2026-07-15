import { Panel } from '../../components/Panel'
import { ValueReadout } from '../../components/ValueReadout'
import { Plot } from '../../components/Plot'
import { WiringDiagram } from './WiringDiagram'
import { type Vehicle, HISTORY_LEN } from '../../sim/world/world'
import { getPreset } from '../../sim/creature/vehiclePresets'
import { palette } from '../../theme/theme'

/**
 * The side inspector for a selected vehicle: its wiring, a live sensor trace,
 * and read-off values for the handout. Pure render from the (mutated-in-place)
 * vehicle object; the scene re-renders it while the sim advances. The sensor
 * trace lives on the vehicle and is sampled once per sim step, so it advances
 * in sim time and freezes when paused.
 */
export function VehicleInspector({
  vehicle,
  onClose,
}: {
  vehicle: Vehicle
  onClose: () => void
}) {
  const preset = getPreset(vehicle.presetId)
  const speed = (vehicle.motors.left + vehicle.motors.right) / 2

  return (
    <Panel
      title="Vehicle inspector"
      onClose={onClose}
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
        Its two sensors connect to its two motors as shown. From the wiring and
        the live values, work out why it behaves the way it does.
      </div>

      <WiringDiagram
        wiring={preset.wiring}
        sensors={vehicle.sensors}
        motors={vehicle.motors}
      />

      <div>
        <div
          style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}
        >
          Sensor activation over time
        </div>
        <Plot
          window={HISTORY_LEN}
          series={[
            { color: palette.sensor, data: vehicle.history.left },
            { color: palette.accent, data: vehicle.history.right },
          ]}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <ValueReadout label="Sensor L" value={vehicle.sensors.left} />
        <ValueReadout label="Sensor R" value={vehicle.sensors.right} />
        <ValueReadout label="Motor L" value={vehicle.motors.left} />
        <ValueReadout label="Motor R" value={vehicle.motors.right} />
        <ValueReadout label="Speed" value={speed} unit="u/s" />
      </div>
    </Panel>
  )
}
