import { Panel } from '../../components/Panel'
import { Section } from '../../components/Section'
import { Button, Slider, SelectControl } from '../../components/controls'
import { ValueReadout } from '../../components/ValueReadout'
import { fmt } from '../../components/format'
import {
  setWiring,
  WEIGHT_RANGE,
  BASELINE_RANGE,
  THRESHOLD_RANGE,
  MOTOR_GROUPS,
  type MotorGroup,
} from '../../sim/bilaterian/circuit'
import { ACTIVATIONS, TRUTH_ROWS, truthTableOf, unitOutput, type Activation } from '../../sim/bilaterian/unit'
import { palette } from '../../theme/theme'
import { CircuitDiagram } from './CircuitDiagram'
import { DecisionBoundaryPlot, ActivationPlot, Trace } from './plots'
import { EQUIVALENCE_LINES, HONESTY_LINE } from './labels'
import { TabBar, Note, Row, PANEL_STYLE, RIGHT_STYLE, type SceneState } from './BilaterianScene'

/**
 * The Circuit tab — Parts 1 and 2. The diagram, the routing switch, sliders
 * for every weight, baseline and threshold, the arithmetic printed live, the
 * scenario's truth table with what the animal currently does on each row,
 * and the decision boundary. The dish beside it runs the whole time.
 */
export function CircuitTab(s: SceneState) {
  const { world, scenario, bump, hideNumbers } = s
  const worm = world.worm
  const circuit = worm.circuit
  const u = circuit.interneurons[0]
  const cells = worm.cells
  const locks = scenario.locks
  const x = cells.map((c) => c.output)
  const net = worm.net[0] ?? 0
  const y = worm.output[0] ?? 0
  const n = cells.length
  const route = circuit.routes[0]

  const set = (patch: Parameters<typeof setWiring>[1]) => {
    setWiring(circuit, patch)
    bump()
  }

  const sub = (i: number) => '₁₂₃₄'[i]

  const left = (
    <Panel title="The circuit" style={PANEL_STYLE}>
      <TabBar tab={s.tab} onChange={s.setTab} />
      <Note>
        The animal has one sensory cell per cue, at the head, and it steers by comparing what each
        cell senses now against a moment ago. Every number in its nervous system is on the right;
        everything you can change about it is here. The dish itself is on the World tab.
      </Note>
      <Section key={`${scenario.key}-wiring`} title="Wiring — fixed until you change it" defaultOpen={scenario.open.circuit} hint="Weights, the baseline, the threshold, the routing switch and the activation function. Locked ones are printed, not slid.">
        {hideNumbers ? (
          <Note>This animal’s numbers are hidden until you reveal its faults on the Worms tab. The diagram still shows how it is wired.</Note>
        ) : (
          <>
            {locks.route ? (
              <Row label="The verdict goes to" value={`the ${route} group (locked)`} mono={false} />
            ) : (
              <SelectControl
                label="The verdict goes to"
                value={route}
                options={MOTOR_GROUPS.map((g) => ({ value: g, label: `the ${g} group` }))}
                onChange={(g: MotorGroup) => set({ route: g })}
              />
            )}
            {cells.map((_, i) => {
              const label = `weight b${sub(i)} — from the ${scenario.channels[i].name} cell`
              return locks.weights[i] ? (
                <Row key={i} label={`${label} (locked)`} value={fmt(u.weights[i])} />
              ) : (
                <Slider
                  key={i}
                  label={label}
                  value={u.weights[i]}
                  min={WEIGHT_RANGE.min}
                  max={WEIGHT_RANGE.max}
                  step={WEIGHT_RANGE.step}
                  format={fmt}
                  onChange={(v) => set({ weight: { input: i, value: v } })}
                />
              )
            })}
            {locks.baseline ? (
              <Row label="baseline b₀ (locked)" value={fmt(u.baseline)} />
            ) : (
              <Slider
                label="baseline b₀"
                value={u.baseline}
                min={BASELINE_RANGE.min}
                max={BASELINE_RANGE.max}
                step={BASELINE_RANGE.step}
                format={fmt}
                onChange={(v) => set({ baseline: v })}
              />
            )}
            {locks.threshold ? (
              <Row label="threshold θ (locked)" value={fmt(u.threshold)} />
            ) : (
              <Slider
                label="threshold θ"
                value={u.threshold}
                min={THRESHOLD_RANGE.min}
                max={THRESHOLD_RANGE.max}
                step={THRESHOLD_RANGE.step}
                format={fmt}
                onChange={(v) => set({ threshold: v })}
              />
            )}
            {locks.activation ? (
              <Row label="activation function (locked)" value={ACTIVATIONS.find((a) => a.value === circuit.activation)!.label} mono={false} />
            ) : (
              <SelectControl
                label="activation function"
                value={circuit.activation}
                options={ACTIVATIONS}
                onChange={(a: Activation) => set({ activation: a })}
              />
            )}
            <Note>
              The baseline and the threshold are two knobs on the same line — on purpose. Neither is derived from the other here; find out for yourself what each does to the boundary, and why moving either one alone can turn AND into OR.
            </Note>
            <Button
              onClick={() => {
                const from = world.startCircuit
                circuit.activation = from.activation
                circuit.routes = [...from.routes]
                circuit.interneurons.forEach((_, j) => {
                  const src = from.interneurons[j]
                  setWiring(circuit, { interneuron: j, baseline: src.baseline, threshold: src.threshold })
                  src.weights.forEach((w, i) => setWiring(circuit, { interneuron: j, weight: { input: i, value: w } }))
                })
                bump()
              }}
            >
              Restore the wiring this scenario started with
            </Button>
          </>
        )}
      </Section>
    </Panel>
  )

  const fName = circuit.activation === 'threshold' ? 'threshold function' : 'sigmoid function'
  const fRule =
    circuit.activation === 'threshold'
      ? `y = 1 if net ≥ θ, else 0`
      : `y = 1 / (1 + e^(−(net − θ) / 0.15))`
  const terms = cells.map((c, i) => `(${fmt(u.weights[i])} × ${fmt(c.output)})`).join(' + ')
  const table = truthTableOf(u, circuit.activation)
  const target = scenario.target
  const present = x.map((v) => v >= 0.999)
  const rowNow = TRUTH_ROWS.findIndex(([a, b]) => (a === 1) === present[0] && (n < 2 || (b === 1) === (present[1] ?? false)))
  const satisfied = target ? table.filter((fires, i) => fires === target.act[i]).length : 0

  const right = (
    <Panel title="The nervous system" style={RIGHT_STYLE}>
      <CircuitDiagram
        circuit={circuit}
        cells={cells}
        channels={scenario.channels}
        output={worm.output}
        motor={worm.motor}
        hideNumbers={hideNumbers}
        routeLocked={locks.route || hideNumbers}
        onFlipRoute={() => set({ route: route === 'forward' ? 'reverse' : 'forward' })}
      />
      <Note>{HONESTY_LINE}</Note>
      <Section key={`${scenario.key}-arithmetic`} title="The arithmetic" defaultOpen={scenario.open.arithmetic} hint="What the interneuron computes, with the live numbers in it.">
        {hideNumbers ? (
          <Note>Hidden until you reveal.</Note>
        ) : (
          <>
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
              {`net = b₀ + ${cells.map((_, i) => `b${sub(i)}x${sub(i)}`).join(' + ')}\n` +
                `    = ${fmt(u.baseline)} + ${terms}\n` +
                `    = ${fmt(net)}\n` +
                `y   = f(net − θ)   f: the ${fName}\n` +
                `    ${fRule}\n` +
                `    = ${y.toFixed(2)}   → the ${route} group`}
            </pre>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Row label="Verdict y, from the running animal" value={y.toFixed(2)} />
              <Row label="Predicted from the arithmetic" value={unitOutput(u, x, circuit.activation).toFixed(2)} />
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
            <ActivationPlot activation={circuit.activation} threshold={u.threshold} net={net} output={y} />
            <Note>
              The activation function has a floor at zero and a ceiling at one. The threshold function is a hard step; the sigmoid function is the same thing with a slope in the middle.
            </Note>
          </>
        )}
      </Section>
      <Section key={`${scenario.key}-target`} title="The target function" defaultOpen={scenario.open.target} hint="What the animal must do on each combination of cues, and what it does now.">
        {!target ? (
          <Note>This scenario has no target function: two graded quantities set against each other, and the behavior is whichever wins.</Note>
        ) : hideNumbers ? (
          <Note>Hidden until you reveal.</Note>
        ) : (
          <>
            <Note>
              <b>{target.name}</b>: {target.sentence}. Act means <b>{target.verb}</b>.
            </Note>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr style={{ color: 'var(--text-muted)' }}>
                  <th style={{ textAlign: 'left', padding: '2px 4px' }}>{scenario.channels[0].name}</th>
                  <th style={{ textAlign: 'left', padding: '2px 4px' }}>{scenario.channels[1]?.name}</th>
                  <th style={{ textAlign: 'left', padding: '2px 4px' }}>target</th>
                  <th style={{ textAlign: 'left', padding: '2px 4px' }}>the animal</th>
                  <th style={{ padding: '2px 4px' }}></th>
                </tr>
              </thead>
              <tbody>
                {TRUTH_ROWS.map(([a, b], i) => {
                  const ok = table[i] === target.act[i]
                  const here = i === rowNow
                  return (
                    <tr key={i} style={{ background: here ? 'color-mix(in srgb, var(--accent) 16%, transparent)' : undefined }}>
                      <td style={{ padding: '3px 4px' }}>{a ? 'present' : 'absent'}</td>
                      <td style={{ padding: '3px 4px' }}>{b ? 'present' : 'absent'}</td>
                      <td style={{ padding: '3px 4px', color: target.act[i] ? palette.accent : palette.sensor }}>{target.act[i] ? 'act' : 'do not act'}</td>
                      <td style={{ padding: '3px 4px', color: table[i] ? palette.accent : palette.sensor }}>{table[i] ? 'acts' : 'does not'}</td>
                      <td style={{ padding: '3px 4px', textAlign: 'center', color: ok ? palette.approach : palette.avoid }}>{ok ? '✓' : '✗'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <ValueReadout label="Rows satisfied" value={`${satisfied} of 4`} />
            <Note>The highlighted row is the combination the animal is in right now: a cue counts as present when its cell reads its ceiling, an input of exactly 1.</Note>
          </>
        )}
      </Section>
      <Section
        key={`${scenario.key}-boundary`}
        title="The decision boundary"
        defaultOpen={scenario.open.boundary}
        hint="Every combination of the two inputs is a point. The interneuron’s decision on any input can be drawn as a line through this space. Each point’s color is its target: blue for act (1), orange for do not act (0)."
      >
        {n !== 2 ? (
          <Note>Two inputs make a plane. This scenario has {n}.</Note>
        ) : hideNumbers ? (
          <Note>Hidden until you reveal.</Note>
        ) : (
          <>
            <DecisionBoundaryPlot
              unit={u}
              activation={circuit.activation}
              target={target?.act}
              live={[x[0], x[1]]}
              labels={[scenario.channels[0].name, scenario.channels[1].name]}
            />
            <Note>
              The background is blue where the current weights output act (1) and orange where they output do not act (0). The white line is the current decision boundary, set by the weights, the baseline and the threshold. Move one number and watch whether the line slides or turns.
            </Note>
          </>
        )}
      </Section>
      <Section title="Steering" defaultOpen hint="The rule for turning, and what it is doing now.">
        {!hideNumbers && (
          <>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Sensory cells over time</div>
            <Trace series={cells.map((_, i) => ({ color: scenario.channels[i].color, data: world.trace.cells[i] ?? [] }))} yMin={0} yMax={1} />
          </>
        )}
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Verdict y (blue) and reversal rate per second (orange), over time</div>
        <Trace
          series={[
            { color: palette.accent, data: world.trace.output },
            { color: palette.sensor, data: world.trace.rate.map((r) => Math.min(1, r / 4)) },
          ]}
          yMin={0}
          yMax={1}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {!hideNumbers && (
            <Row
              label={route === 'forward' ? 'Now against a moment ago, of the net input' : 'Now against a moment ago, of the verdict'}
              value={fmt(worm.steer[0] ?? 0)}
            />
          )}
          <Row label="Reversal rate now" value={`${worm.rate.toFixed(2)} /s`} />
          <Row label="Wave" value={worm.mode === 'reverse' ? 'tail to head (reversing)' : worm.mode === 'turning' ? 'the deep bend' : 'head to tail (forward)'} mono={false} />
        </div>
        <Note>
          Routed forward, the animal compares the net input now against a moment ago: rising, and nothing triggers a reversal; falling, and reversal probability climbs. Routed to reverse, it compares the verdict the same way, and runs while the verdict fires. Going straight is not something the animal does; it is what happens when the rule for turning is not met. Nothing compares one side of the head against the other.
        </Note>
      </Section>
    </Panel>
  )

  return { left, right }
}
