import { Panel } from '../../components/Panel'
import { Slider } from '../../components/controls'
import { WiringPanel, fmt } from '../../components/WiringPanel'
import { type Vehicle } from '../../sim/world/world'
import { getPreset } from '../../sim/creature/vehiclePresets'

/**
 * The side inspector for a selected vehicle: the shared wiring panel, plus this
 * creature's own tuning. Connection strength and bias belong to the individual,
 * so changing them here affects only the selected vehicle — letting a student
 * hold the other five fixed and vary one.
 *
 * The wiring, arithmetic and sensor trace live in `components/WiringPanel`
 * because Module 2 shows the same instrument; only the sliders below are
 * Module 1's, and they are exactly what Module 2 drops when wiring stops being
 * something you set and becomes something you inherit.
 */
export function VehicleInspector({
  vehicle,
  onClose,
  onTune,
}: {
  vehicle: Vehicle
  onClose: () => void
  onTune: (patch: { strength?: number; bias?: number }) => void
}) {
  const preset = getPreset(vehicle.presetId)

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

      <WiringPanel
        weights={vehicle.weights}
        sensors={vehicle.sensors}
        actuators={vehicle.actuators}
        history={vehicle.history}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          Tuning — affects only this vehicle
        </div>
        {/*
          The slider sets the *magnitude*; the sign belongs to the phenotype
          (a 3a with a positive weight simply is a 2a). So display the signed
          value, which is the number that actually appears in the equation
          above — otherwise the panel would show 2.40 here and −2.40 there.
        */}
        <Slider
          label="Connection strength"
          value={vehicle.strength}
          min={0}
          max={5}
          step={0.1}
          format={(v) => fmt(preset.wiring.sign * v)}
          onChange={(strength) => onTune({ strength })}
        />
        <Slider
          label="Actuator bias"
          value={vehicle.bias}
          min={-1}
          max={2}
          step={0.1}
          format={fmt}
          onChange={(bias) => onTune({ bias })}
        />
      </div>
    </Panel>
  )
}
