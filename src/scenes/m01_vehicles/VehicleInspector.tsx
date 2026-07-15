import { useEffect, useReducer, useRef } from 'react'
import { Panel } from '../../components/Panel'
import { ValueReadout } from '../../components/ValueReadout'
import { Plot } from '../../components/Plot'
import { WiringDiagram } from './WiringDiagram'
import type { Vehicle } from '../../sim/world/world'
import { getPreset } from '../../sim/creature/vehiclePresets'
import { palette } from '../../theme/theme'

const HISTORY = 80

/**
 * The side inspector for a selected vehicle: its wiring, a live sensor trace,
 * and read-off values for the handout. Self-refreshes at 10 Hz by reading the
 * (mutated-in-place) vehicle object — no per-frame React work in the scene.
 */
export function VehicleInspector({
  vehicle,
  onClose,
}: {
  vehicle: Vehicle
  onClose: () => void
}) {
  const [, tick] = useReducer((x) => x + 1, 0)
  const histL = useRef<number[]>([])
  const histR = useRef<number[]>([])

  useEffect(() => {
    histL.current = []
    histR.current = []
    const id = setInterval(() => {
      const push = (arr: number[], v: number) => {
        arr.push(v)
        if (arr.length > HISTORY) arr.shift()
      }
      push(histL.current, vehicle.sensors.left)
      push(histR.current, vehicle.sensors.right)
      tick()
    }, 100)
    return () => clearInterval(id)
  }, [vehicle])

  const preset = getPreset(vehicle.presetId)
  const speed = (vehicle.motors.left + vehicle.motors.right) / 2

  return (
    <Panel
      title="Vehicle inspector"
      onClose={onClose}
      headerAccessory={
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            color: vehicle.color,
          }}
        >
          {preset.label}
        </span>
      }
    >
      <div>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>{preset.name}</div>
        <div
          style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.45 }}
        >
          {preset.description}
        </div>
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
          window={HISTORY}
          series={[
            { color: palette.sensor, data: histL.current },
            { color: palette.accent, data: histR.current },
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
