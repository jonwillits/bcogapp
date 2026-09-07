import { Panel } from '../../components/Panel'
import { Button, Slider, SelectControl } from '../../components/controls'
import { fmt } from '../../components/format'
import { RATE_PER_INTENSITY } from '../../sim/neuron/neuronWorld'
import {
  UNIT_INPUT_RANGE,
  BASELINE_RANGE,
  STRENGTH_RANGE,
  RATE_RANGE,
} from '../../sim/neuron/unitRanges'
import { PairDiagram } from './PairDiagram'
import { pairData, cellOn } from './pairData'
import { TransferPlot, Raster } from './plots'
import { BIOLOGICAL, EQUIVALENCE_LINES } from './unitLabels'
import { TabBar, Note, Row, SideBanner, GroupLabel, PANEL_STYLE, RIGHT_STYLE, type SceneState } from './NeuronScene'

/**
 * The Unit tab — algorithmic: what is computed. The neuron as the reading's
 * §3.2.8 writes it down, in the reading's §3.2 words and no others. Its four
 * elements are named by the job each does; the parts that fill those jobs are
 * named on the Membrane tab, where the chapter names them.
 */

export function UnitTab(s: SceneState) {
  const { world, bump, curve } = s
  const { windowMs, side } = s.ui
  const setWindowMs = (windowMs: number) => s.patchUi({ windowMs })
  const v = BIOLOGICAL
  const cell = cellOn(world, side)
  const u = world.unit[side]
  const otherSide: typeof side = side === 'left' ? 'right' : 'left'
  const fromSensors = world.inputSource === 'sensors'
  const x1 = cell.input.x[0]
  const x2 = cell.input.x[1]
  const total = cell.linearTotal()
  const measuredRate = cell.outputRate(1000)
  const inWindow = cell.spikesInWindow(windowMs)

  const setUnit = (patch: Parameters<typeof world.setWiring>[1]) => {
    world.setWiring(side, patch)
    bump()
  }
  const setSlider = (i: 0 | 1, value: number) => {
    world.inputSource = 'sliders'
    world.sliderRates[i] = value
    bump()
  }

  const left = (
    <Panel title={`The ${v.cell}`} style={PANEL_STYLE}>
      <TabBar tab={s.tab} onChange={s.setTab} />
      <Note>
        <b>Time scale: real time.</b> Rates in, a {v.strength} on each connection, a total,
        and a {v.rate} out. The vehicle has two {v.cell}s, one for each actuator, each with its
        own {v.baseline} and {v.strength}s — six numbers, as in Lab 1. Its four elements are
        named by the job each one does.
      </Note>
      <SideBanner side={side} noun={v.cell} onChange={(sd) => s.patchUi({ side: sd })} />
      <GroupLabel>Wiring — fixed until you change it</GroupLabel>
      <SelectControl
        label="Where the inputs come from"
        value={world.inputSource}
        options={[
          { value: 'sensors', label: "the vehicle's sensors (live)" },
          { value: 'sliders', label: 'the sliders below' },
        ]}
        onChange={(src) => {
          world.inputSource = src
          if (src === 'sliders') world.sliderRates = [Math.round(x1), Math.round(x2)]
          bump()
        }}
      />
      <Slider
        label={`${v.baseline} b₀`}
        value={u.b0}
        min={BASELINE_RANGE.min}
        max={BASELINE_RANGE.max}
        step={BASELINE_RANGE.step}
        format={(x) => `${fmt(x)} ${v.rateUnit}`}
        onChange={(b0) => setUnit({ b0 })}
      />
      {(
        [
          { key: 'bIpsi', label: `${v.strength} b₁ (same-side sensor)`, value: u.bIpsi },
          { key: 'bContra', label: `${v.strength} b₂ (opposite-side sensor)`, value: u.bContra },
        ] as const
      ).map((row) => (
        <Slider
          key={row.key}
          label={row.label}
          value={row.value}
          min={STRENGTH_RANGE.min}
          max={STRENGTH_RANGE.max}
          step={STRENGTH_RANGE.step}
          format={fmt}
          onChange={(val) => setUnit({ [row.key]: val })}
        />
      ))}
      <Button title="Give the other cell this wiring" onClick={() => { world.copyWiring(side); bump() }}>
        Give the {otherSide} {v.cell} this wiring
      </Button>
      <GroupLabel>Activity — live, and changing with the input</GroupLabel>
      <Slider
        label={`input ${v.rate} x₁${fromSensors ? ' — from the same-side sensor' : ''}`}
        value={fromSensors ? Math.min(RATE_RANGE.max, x1) : world.sliderRates[0]}
        min={RATE_RANGE.min}
        max={RATE_RANGE.max}
        step={RATE_RANGE.step}
        format={(x) => `${x.toFixed(fromSensors ? 1 : 0)} ${v.rateUnit}`}
        onChange={(val) => setSlider(0, val)}
      />
      <Slider
        label={`input ${v.rate} x₂${fromSensors ? ' — from the opposite-side sensor' : ''}`}
        value={fromSensors ? Math.min(RATE_RANGE.max, x2) : world.sliderRates[1]}
        min={RATE_RANGE.min}
        max={RATE_RANGE.max}
        step={RATE_RANGE.step}
        format={(x) => `${x.toFixed(fromSensors ? 1 : 0)} ${v.rateUnit}`}
        onChange={(val) => setSlider(1, val)}
      />
      {fromSensors && (
        <Note>
          A sensor reading of 1.00 is an input {v.rate} of {RATE_PER_INTENSITY} {v.rateUnit}.
          Moving x₁ or x₂ switches both cells' inputs to the sliders; the vehicle then drives on
          the cells' output regardless of what its sensors see.
        </Note>
      )}
      <Slider
        label="Time window for the output"
        value={Math.log10(windowMs)}
        min={0}
        max={3}
        step={0.05}
        format={(lg) => `${Math.round(10 ** lg)} ms`}
        onChange={(lg) => setWindowMs(Math.round(10 ** lg))}
      />
    </Panel>
  )

  const right = (
    <Panel title="Two cells, one wiring" style={RIGHT_STYLE}>
      <PairDiagram
        mode="unit"
        labels={v}
        {...pairData(world)}
        selected={side}
        onSelect={(sd) => s.patchUi({ side: sd })}
      />
      <Note>
        Lab 1's wiring, with a {v.cell} where each line was. Each {v.cell}'s x₁ is its own
        side's sensor and its x₂ the other side's; the crossed lines are the b₂ connections.
        The muted numbers on the lines are {v.strength}s — fixed until you change them. The
        bright numbers at the sensors, inputs, outputs and actuators are activity — live.
        Below: the <b>{side}</b> {v.cell}.
      </Note>
      <div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 5 }}>
          What the arithmetic says
        </div>
        <pre
          style={{
            margin: 0,
            padding: '8px 9px',
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            fontFamily: 'var(--font-mono)',
            fontSize: 10.5,
            lineHeight: 1.6,
            overflowX: 'auto',
          }}
        >
          {`y = b₀ + b₁x₁ + b₂x₂\n` +
            `  = ${fmt(u.b0)} + (${fmt(u.bIpsi)} × ${fmt(x1)}) + (${fmt(u.bContra)} × ${fmt(x2)})\n` +
            `  = ${fmt(total)}` +
            (total < 0 ? `   → held at 0` : '')}
        </pre>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Row label={`Output ${v.rate}, measured from the membrane (last 1 s)`} value={`${measuredRate.toFixed(1)} ${v.rateUnit}`} />
        <Row label="The arithmetic's total" value={`${fmt(Math.max(0, total))} ${v.rateUnit}`} />
      </div>
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10.5,
          lineHeight: 1.5,
          padding: '6px 8px',
          border: '1px dashed var(--border)',
          borderRadius: 'var(--radius-sm)',
          color: 'var(--text-muted)',
        }}
      >
        {EQUIVALENCE_LINES.map((l) => (
          <div key={l}>{l}</div>
        ))}
        <div style={{ marginTop: 3 }}>One number, two names. They are the same number.</div>
      </div>
      <div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 5 }}>
          Input–output curve · the dot is the cell right now
        </div>
        <TransferPlot
          xMin={UNIT_INPUT_RANGE.min}
          xMax={UNIT_INPUT_RANGE.max}
          floor={curve.floor}
          ceiling={curve.ceiling || UNIT_INPUT_RANGE.max}
          opX={total}
          opY={measuredRate}
          measured={curve.sweep}
          yMax={UNIT_INPUT_RANGE.max}
          xLabel={`total arriving input, b₀ + Σ bᵢxᵢ`}
          yLabel={`output ${v.rate}`}
        />
        <Note>
          Dashed: what the arithmetic predicts, held at zero below zero and nothing else. Orange:
          measured from the membrane across a sweep of inputs — its flat parts are measured, not
          set; the most it can sustain under any steady drive is{' '}
          {curve.ceiling ? curve.ceiling.toFixed(0) : '…'} {v.rateUnit}. The cell this measures
          has no branching input surface, so it cannot speak to whether a real one computes more
          than a sum.
        </Note>
      </div>
      <div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 5 }}>
          {v.spikeTrain} · last {windowMs} ms
        </div>
        <Raster spikes={cell.spikes} now={cell.time} windowMs={windowMs} />
        <Note>
          In the last {windowMs} ms: <b>{inWindow}</b> {inWindow === 1 ? v.spike : `${v.spike}s`}
          {windowMs >= 100 ? ` → ${((inWindow * 1000) / windowMs).toFixed(0)} ${v.rateUnit}` : ''}.
          Nothing about the {v.cell} changes as this slider moves.
        </Note>
      </div>
    </Panel>
  )

  return { left, right }
}
