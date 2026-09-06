import { Panel } from '../../components/Panel'
import { Section } from '../../components/Section'
import { Button, Slider, SelectControl } from '../../components/controls'
import { ValueReadout } from '../../components/ValueReadout'
import { WORLD_SPEEDS } from '../../sim/neuron/cells'
import { VEHICLE_TOP_SPEED } from '../../sim/neuron/neuronWorld'
import {
  SIGNAL_TYPES,
  BODY_SIZES_M,
  formatDistance,
  formatTime,
  arrivingFraction,
} from '../../sim/neuron/signals'
import { randomSeed } from '../../sim/random'
import { palette } from '../../theme/theme'
import { TabBar, Note, Row, sci, PANEL_STYLE, RIGHT_STYLE, type SceneState } from './NeuronScene'

/**
 * The World tab — computational: what problem is being solved. One vehicle,
 * moving lights, and the cost and delay of getting a signal across a body.
 *
 * The readouts are grouped by what a part of the lab is reading them for,
 * and the two comparisons that carry a question — how the reaction time
 * divides, and how fast the lights move against how fast the vehicle can —
 * are drawn as bars rather than printed as numbers to compare in the head.
 */

/** Three parts of one total, as one bar. */
function StackedBar({ parts }: { parts: { label: string; value: number; color: string }[] }) {
  const total = parts.reduce((a, p) => a + (Number.isFinite(p.value) ? p.value : 0), 0)
  const infinite = parts.some((p) => !Number.isFinite(p.value))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', height: 12, borderRadius: 6, overflow: 'hidden', background: 'var(--bg)' }}>
        {infinite ? (
          <div style={{ flex: 1, background: palette.avoid, opacity: 0.6 }} />
        ) : (
          parts.map((p) => (
            <div key={p.label} style={{ width: `${total > 0 ? (100 * p.value) / total : 0}%`, background: p.color }} title={p.label} />
          ))
        )}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)' }}>
        {parts.map((p) => (
          <span key={p.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: p.color, display: 'inline-block' }} />
            {p.label} <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)' }}>{formatTime(p.value)}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

/** Two speeds on one scale. */
function SpeedBars({ rows, max }: { rows: { label: string; value: number; color: string }[]; max: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {rows.map((r) => (
        <div key={r.label} style={{ display: 'grid', gridTemplateColumns: '92px 1fr 52px', gap: 8, alignItems: 'center', fontSize: 11 }}>
          <span style={{ color: 'var(--text-muted)' }}>{r.label}</span>
          <div style={{ height: 10, borderRadius: 5, background: 'var(--bg)', overflow: 'hidden' }}>
            <div style={{ width: `${Math.min(100, (100 * r.value) / max)}%`, height: '100%', background: r.color }} />
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', textAlign: 'right' }}>{r.value.toFixed(1)} u/s</span>
        </div>
      ))}
    </div>
  )
}

export function WorldTab(s: SceneState) {
  const { world, bump } = s
  const rt = world.reactionTime()
  const sizeIndex = Math.max(
    0,
    BODY_SIZES_M.findIndex((m) => Math.abs(Math.log10(m) - Math.log10(world.settings.bodySizeM)) < 0.01),
  )
  const arriving = arrivingFraction(world.settings.signal, world.pathLength)
  const usesCell = world.settings.signal === 'spikes'

  const left = (
    <Panel title="The world" style={PANEL_STYLE}>
      <TabBar tab={s.tab} onChange={s.setTab} />
      <Note>
        <b>Time scale: real time</b>, times the speed control. One vehicle, lights that
        move. The line from each sensor to each actuator is now a cell with a length, a
        membrane and a running cost.
      </Note>
      <SelectControl
        label="Signal type"
        value={world.settings.signal}
        options={SIGNAL_TYPES}
        onChange={(v) => {
          world.setSignal(v)
          bump()
        }}
      />
      <Slider
        label="Body size (signal path length)"
        value={sizeIndex}
        min={0}
        max={BODY_SIZES_M.length - 1}
        step={1}
        format={(i) => formatDistance(BODY_SIZES_M[Math.round(i)])}
        onChange={(i) => {
          world.setBodySize(BODY_SIZES_M[Math.round(i)])
          bump()
        }}
      />
      <Note>
        Sets how far the signal has to travel, and so the <b>travel</b> time in the readouts.
        The vehicle is drawn the same size whatever this says.
      </Note>
      <Slider
        label="World speed (how fast the lights move)"
        value={world.settings.lightSpeed}
        min={0.25}
        max={6}
        step={0.25}
        format={(v) => `${v.toFixed(2)} u/s`}
        onChange={(v) => {
          world.setLightSpeed(v)
          bump()
        }}
      />
      <div style={{ display: 'flex', gap: 6 }}>
        <Button onClick={() => { world.setLightSpeed(WORLD_SPEEDS.slow); bump() }}>slow ({WORLD_SPEEDS.slow})</Button>
        <Button onClick={() => { world.setLightSpeed(WORLD_SPEEDS.fast); bump() }}>fast ({WORLD_SPEEDS.fast})</Button>
      </div>
      <Slider
        label="How many lights"
        value={world.settings.lightCount}
        min={1}
        max={5}
        step={1}
        format={(v) => v.toFixed(0)}
        onChange={(v) => {
          world.setLightCount(Math.round(v))
          bump()
        }}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Run seed — same seed, same run</span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, flex: 1 }}>{s.seed}</span>
          <Button onClick={() => s.reset(s.seed)}>Reset</Button>
          <Button onClick={() => s.reset(randomSeed())}>New seed</Button>
        </div>
      </div>
      <Note>Camera: <b>W A S D</b> to move · <b>arrow keys</b> to rotate · drag and scroll also work.</Note>
    </Panel>
  )

  const right = (
    <Panel title="Readouts" style={RIGHT_STYLE}>
      <Section title="Reaction time" defaultOpen hint="How long the vehicle takes to act on what it senses, and which part of the trip takes it.">
        <ValueReadout label="Reaction time" value={formatTime(rt.total)} />
        <StackedBar
          parts={[
            { label: 'sensing', value: rt.sensing, color: palette.sensor },
            { label: 'travel', value: rt.travel, color: palette.accent },
            { label: 'integration', value: rt.integration, color: palette.approach },
          ]}
        />
      </Section>

      <Section title="The signal" defaultOpen hint="What the body-size and signal-type controls do to the trip.">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <Row label="Signal path length" value={formatDistance(world.pathLength)} />
          <Row label="Travel time" value={formatTime(rt.travel)} />
          <Row label="Arrives at the far end" value={`${(arriving * 100).toFixed(arriving < 0.01 ? 2 : 0)}% of what left`} />
          {usesCell && <Row label="Conduction speed (measured)" value={`${world.spikeVelocity.toFixed(2)} m/s`} />}
        </div>
        <Note>
          {world.settings.signal === 'chemical' &&
            'Diffusing chemical: travel grows with the square of the distance, everything arrives, and it lingers about as long as it took to come. At the larger sizes it will not arrive within a run; the number is still the answer.'}
          {world.settings.signal === 'graded' &&
            'Graded electrical: fast, but it fades with distance, and beyond a centimetre it is gone.'}
          {world.settings.signal === 'spikes' &&
            'Spikes: distance over the conduction speed measured on the Membrane tab, and what arrives is what left.'}
        </Note>
        {!usesCell && (
          <Note>
            This signal type does not use the spiking cell: the actuators get the delayed signal
            through Lab 1's arithmetic. The Unit and Membrane tabs still show the cell, running on
            the same sensor rates.
          </Note>
        )}
      </Section>

      <Section title="Lights" defaultOpen hint="What the vehicle is getting done, and what it is costing.">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          <ValueReadout label="Collected" value={`${world.lightsCollected}`} />
          <ValueReadout label="Per minute" value={world.recentLightsPerMinute} digits={1} />
          <ValueReadout label="ATP, both cells" value={sci(world.atpTotal, 1)} />
          <ValueReadout label="ATP per light" value={sci(world.energyPerLight, 1)} />
        </div>
        <Note>
          Per minute is the last minute; over the whole run so far it is{' '}
          <span style={{ fontFamily: 'var(--font-mono)' }}>{world.lightsPerMinute.toFixed(1)}</span>. A light
          counts when the vehicle catches it: driving into it, moving at least as fast as it is.
          One that runs into a parked vehicle, or streaks past one that could never keep up, bounces off.
        </Note>
      </Section>

      <Section title="The world" hint="How fast the lights move against how fast the vehicle can.">
        <SpeedBars
          max={6}
          rows={[
            { label: 'lights move at', value: world.settings.lightSpeed, color: palette.sensor },
            { label: "vehicle's top speed", value: VEHICLE_TOP_SPEED, color: palette.accent },
          ]}
        />
        <Row label="Run time" value={`${world.time.toFixed(0)} s`} />
      </Section>
    </Panel>
  )

  return { left, right }
}
