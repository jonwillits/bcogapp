import { Panel } from '../../components/Panel'
import { Button, Slider, SelectControl } from '../../components/controls'
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
import { TabBar, Note, Row, sci, PANEL_STYLE, RIGHT_STYLE, type SceneState } from './NeuronScene'

/**
 * The World tab — computational: what problem is being solved. One vehicle,
 * moving lights, and the cost and delay of getting a signal across a body.
 */
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Row label="Reaction time" value={formatTime(rt.total)} />
        <div style={{ paddingLeft: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Row label="sensing" value={formatTime(rt.sensing)} />
          <Row label="travel" value={formatTime(rt.travel)} />
          <Row label="integration" value={formatTime(rt.integration)} />
        </div>
        <Row label="Signal path length" value={formatDistance(world.pathLength)} />
        <Row label="Arrives at the far end" value={`${(arriving * 100).toFixed(arriving < 0.01 ? 2 : 0)}% of what left`} />
        {usesCell && (
          <Row label="Conduction speed (measured)" value={`${world.spikeVelocity.toFixed(2)} m/s`} />
        )}
      </div>
      <Note>
        {world.settings.signal === 'chemical' &&
          'A diffusing chemical: travel time grows with the square of the distance, everything arrives, and it lingers about as long as it took to come. At the larger sizes it will not arrive within a run — the number above is still the answer.'}
        {world.settings.signal === 'graded' &&
          'A graded electrical signal: fast, but it fades with distance — what arrives is a fraction of what left, and beyond a centimetre it is gone.'}
        {world.settings.signal === 'spikes' &&
          'Spikes: travel time is distance over the conduction speed measured on the Membrane tab, and what arrives is what left, at every distance.'}
      </Note>
      {!usesCell && (
        <Note>
          This signal type does not use the spiking cell. The actuators are driven by the delayed
          signal through Lab 1's arithmetic; the Unit and Membrane tabs still show the cell, running
          on the same sensor rates.
        </Note>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Row label="Lights collected" value={`${world.lightsCollected}`} />
        <Row label="per minute (whole run)" value={world.lightsPerMinute.toFixed(2)} />
        <Row label="per minute (last minute)" value={world.recentLightsPerMinute.toFixed(2)} />
        <Row label="ATP spent, both cells" value={sci(world.atpTotal)} />
        <Row label="Energy per light collected" value={`${sci(world.energyPerLight)} ATP`} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Row label="Lights move at" value={`${world.settings.lightSpeed.toFixed(2)} u/s`} />
        <Row label="Vehicle's top speed" value={`${VEHICLE_TOP_SPEED.toFixed(1)} u/s`} />
        <Row label="Run time" value={`${world.time.toFixed(0)} s`} />
      </div>
      <Note>
        A light counts as collected when the vehicle catches it: driving into it, and moving at
        least as fast as the light is. One that runs into a parked vehicle, or streaks through
        one that could never keep up with it, bounces off.
      </Note>
    </Panel>
  )

  return { left, right }
}
