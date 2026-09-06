import { Panel } from '../../components/Panel'
import { Button, Slider, Toggle } from '../../components/controls'
import { Section } from '../../components/Section'
import { HEALTHY_CELL, RUNDOWN_SPEEDUP, DEFAULT_AXON } from '../../sim/neuron/cell'
import { INSTANT_RECOVERY } from '../../sim/neuron/unitRanges'
import { NA_OUT_MM, K_OUT_MM } from '../../sim/neuron/hh'
import {
  brainWatts,
  affordableRateHz,
  NEURONS_IN_A_BRAIN,
  ATP_PER_SPIKE_LENNIE,
  BRAIN_WATTS,
} from '../../sim/neuron/energy'
import { PairDiagram } from './PairDiagram'
import { pairData, cellOn } from './pairData'
import { VoltageTrace, GateMeters, CurrentArrows } from './plots'
import { PARTS, ROLE_TO_PART } from './membraneLabels'
import { TabBar, Note, Row, sci, PANEL_STYLE, RIGHT_STYLE, DEFAULT_MS_PER_SECOND, type SceneState } from './NeuronScene'

/**
 * The Membrane tab — implementational: how, and at what cost. The four parts
 * that fill the four roles, a voltage trace, three gate meters, the currents,
 * the concentrations, the pump, and what it is all costing in ATP.
 */

const EQUATIONS = `C dV/dt = −ḡNa m³h (V − ENa) − ḡK n⁴ (V − EK) − gL (V − EL) − Ipump + Iin
dm/dt = αm(V)(1 − m) − βm(V) m
dh/dt = αh(V)(1 − h) − βh(V) h
dn/dt = αn(V)(1 − n) − βn(V) n
ENa = (RT/F) ln([Na]out / [Na]in)      EK = (RT/F) ln([K]out / [K]in)
d[Na]in/dt ∝ −INa − 3 Jpump           d[K]in/dt ∝ −IK + 2 Jpump`

export function MembraneTab(s: SceneState) {
  const { world, bump } = s
  const { showEquations, traceMs, calcRate, signalling, spikeShare, side } = s.ui
  const cell = cellOn(world, side)
  const p = world.cellParams
  const r = cell.readout()
  const setShowEquations = (showEquations: boolean) => s.patchUi({ showEquations })
  const setTraceMs = (traceMs: number) => s.patchUi({ traceMs })
  const setCalcRate = (calcRate: number) => s.patchUi({ calcRate })
  const setSignalling = (signalling: number) => s.patchUi({ signalling })
  const setSpikeShare = (spikeShare: number) => s.patchUi({ spikeShare })

  const set = (patch: Partial<typeof p>) => {
    world.setCellParams(patch)
    bump()
  }
  const stepOneSpike = () => {
    // Run until the body has fired and the spike has passed, at most 500 ms.
    const before = cell.spikes.length
    let ran = 0
    while (cell.spikes.length === before && ran < 500) {
      world.step(0.001)
      ran++
    }
    world.step(0.004)
    bump()
  }
  const slowdown = 1000 / s.msPerSecond
  const budget = { signallingShare: signalling, spikeShareOfSignalling: spikeShare }
  const watts = brainWatts(calcRate, NEURONS_IN_A_BRAIN, ATP_PER_SPIKE_LENNIE, budget)
  const affordable = affordableRateHz(BRAIN_WATTS, NEURONS_IN_A_BRAIN, ATP_PER_SPIKE_LENNIE, budget)
  const recentFar = cell.farSpikes.filter((t) => t > cell.time - 1000).length
  const recentSoma = cell.spikesInWindow(1000)

  const left = (
    <Panel title="The membrane" style={PANEL_STYLE}>
      <TabBar tab={s.tab} onChange={s.setTab} />
      <Note>
        <b>Time scale: slow motion.</b> {s.msPerSecond} ms of cell time per second — {slowdown >= 1.05 ? `${slowdown.toFixed(0)}× slower than life` : 'real time'}.
        A spike lasts about a millisecond; the vehicle in the arena is running at this speed too.
        Every control here sets both of the vehicle's cells; the instruments show the <b>{side}</b> one.
      </Note>
      <Slider
        label="Simulated time per second"
        value={Math.log10(s.msPerSecond)}
        min={Math.log10(5)}
        max={3}
        step={0.05}
        format={(lg) => `${Math.round(10 ** lg)} ms/s`}
        onChange={(lg) => s.setMsPerSecond(Math.round(10 ** lg))}
      />
      <div style={{ display: 'flex', gap: 6 }}>
        <Button onClick={() => s.setMsPerSecond(DEFAULT_MS_PER_SECOND)}>slow motion</Button>
        <Button onClick={() => s.setMsPerSecond(1000)}>real time</Button>
        <Button onClick={stepOneSpike}>step one spike</Button>
      </div>
      <Section title="Lesion controls" defaultOpen hint="Throw one switch and look at all three tabs.">
        <Slider
          label="Sodium-potassium pump power (Na⁺/K⁺)"
          value={p.pumpPower}
          min={0}
          max={1}
          step={0.05}
          format={(v) => `${(v * 100).toFixed(0)}%`}
          onChange={(pumpPower) => set({ pumpPower })}
        />
        <Slider
          label="Voltage-gated sodium channel block"
          value={p.naBlock}
          min={0}
          max={1}
          step={0.05}
          format={(v) => `${(v * 100).toFixed(0)}%`}
          onChange={(naBlock) => set({ naBlock })}
        />
        <Slider
          label="Sodium inactivation recovery"
          value={Math.log(p.hRecovery)}
          min={0}
          max={Math.log(INSTANT_RECOVERY)}
          step={0.05}
          format={(lg) => {
            const k = Math.exp(lg)
            return k < 1.05 ? 'normal' : k >= INSTANT_RECOVERY * 0.97 ? 'instant' : `${k.toFixed(1)}× faster`
          }}
          onChange={(lg) => set({ hRecovery: Math.min(INSTANT_RECOVERY, Math.exp(lg)) })}
        />
        <Slider
          label="Injected current"
          value={p.iInject}
          min={-10}
          max={40}
          step={0.5}
          format={(v) => `${v.toFixed(1)} µA/cm²`}
          onChange={(iInject) => set({ iInject })}
        />
        <Button onClick={() => set({ pumpPower: 1, naBlock: 0, hRecovery: 1, iInject: 0, myelin: HEALTHY_CELL.myelin })}>
          Restore healthy membrane
        </Button>
      </Section>
      <Toggle label="Show the equations" checked={showEquations} onChange={setShowEquations} />
      {showEquations && (
        <div>
          <pre
            style={{
              margin: 0,
              padding: '8px 9px',
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              fontFamily: 'var(--font-mono)',
              fontSize: 9.5,
              lineHeight: 1.55,
              overflowX: 'auto',
              whiteSpace: 'pre',
            }}
          >
            {EQUATIONS}
          </pre>
          <Note>
            The first four are Hodgkin and Huxley's, 1952, fitted to the squid giant axon at
            6.3 °C; the rates here run at twice their speed (Q10 of 2 = about 13 °C). The last
            two are what this lab adds: the concentrations, the pump, and the reversal potentials
            recomputed from them each step.
          </Note>
        </div>
      )}
      <Section
        title="Energy calculator"
        hint="For Q20 and Q21. Whole-brain power from a firing rate — and the rate a real brain can afford."
      >
        <Row label="Neurons in a human brain" value={sci(NEURONS_IN_A_BRAIN, 0)} />
        <Row label="ATP per spike, whole neuron" value={sci(ATP_PER_SPIKE_LENNIE, 1)} />
        <Note>
          That per-spike figure is from the literature (Lennie, 2003), not from the simulation.
          The cell on this tab is one body and six millimetres of thin axon, and its number
          covers the pump work of one spike in that much membrane — none of the synapses,
          transmitter, vesicles or housekeeping a whole cortical neuron pays for. Multiplying the
          simulated figure by 86 billion would give nonsense.
        </Note>
        <Slider
          label="Average firing rate, every neuron"
          value={Math.log10(calcRate)}
          min={-1}
          max={Math.log10(30)}
          step={0.02}
          format={(lg) => `${(10 ** lg).toFixed(10 ** lg < 1 ? 2 : 1)} spikes/s`}
          onChange={(lg) => setCalcRate(10 ** lg)}
        />
        <Slider
          label="Share of brain energy spent on signalling"
          value={signalling}
          min={0.5}
          max={0.9}
          step={0.01}
          format={(v) => `${(v * 100).toFixed(0)}%`}
          onChange={setSignalling}
        />
        <Slider
          label="Share of signalling spent on action potentials"
          value={spikeShare}
          min={0.3}
          max={0.7}
          step={0.01}
          format={(v) => `${(v * 100).toFixed(0)}%`}
          onChange={setSpikeShare}
        />
        <Row label="Whole-brain power at that rate" value={`${watts >= 100 ? watts.toFixed(0) : watts.toFixed(1)} W`} />
        <Row label="A real brain, at rest" value={`${BRAIN_WATTS} W`} />
        <Row label={`Rate ${BRAIN_WATTS} W can afford`} value={`${affordable.toFixed(2)} spikes/s`} />
      </Section>
      <Section
        title="Things to try"
        hint="Nothing in the lab asks about anything here, and nothing in your report depends on it."
      >
        <Toggle label="Myelin on the axon" checked={p.myelin} onChange={(myelin) => set({ myelin })} />
        <Note>
          Wraps the axon in insulation with a bare node every {DEFAULT_AXON.nodeEvery} patches
          (the chapter's §3.3.5). Watch the conduction speed and the ATP per spike.
        </Note>
      </Section>
    </Panel>
  )

  const right = (
    <Panel title="Two cells, as biology" style={RIGHT_STYLE}>
      <PairDiagram
        mode="membrane"
        labels={PARTS}
        {...pairData(world)}
        selected={side}
        onSelect={(sd) => s.patchUi({ side: sd })}
      />
      <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.45 }}>
        {ROLE_TO_PART.map((m) => (
          <div key={m.role}>
            <span style={{ fontFamily: 'var(--font-mono)' }}>{m.role}</span> → <b>{m.part}</b>: {m.note}
          </div>
        ))}
      </div>
      <Note>
        The {PARTS.junction} here: an excitatory input opens channels that let sodium in; an
        inhibitory one opens channels that let potassium out. Same transmitter, different
        receptor, opposite effect on the voltage. (The chapter's GABA receptor lets chloride in
        instead; the effect is the same, and this model tracks only sodium and potassium.)
      </Note>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Voltage across the membrane</span>
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
            window{' '}
            {[20, 60, 200, 400].map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => setTraceMs(w)}
                style={{
                  marginLeft: 3,
                  fontSize: 10,
                  padding: '1px 5px',
                  borderRadius: 4,
                  border: '1px solid var(--border)',
                  background: traceMs === w ? 'var(--accent)' : 'transparent',
                  color: traceMs === w ? '#0b111c' : 'var(--text)',
                  cursor: 'pointer',
                }}
              >
                {w}
              </button>
            ))}
          </span>
        </div>
        <VoltageTrace cell={cell} windowMs={traceMs} />
        <Note>
          Nothing here plays back a recorded spike. The trace is calculated moment by moment
          from the equations; the shape, height and duration come out of them.
        </Note>
      </div>
      <div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 5 }}>
          The gates, right now
        </div>
        <GateMeters m={r.m} h={r.h} n={r.n} />
      </div>
      <div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>
          Ions crossing the membrane, and the pump
        </div>
        <CurrentArrows iNa={r.iNa} iK={r.iK} iPump={r.iPump} iSyn={r.iSyn} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <Row label="Voltage at the body" value={`${r.vSoma.toFixed(1)} mV`} />
        <Row label="Voltage at the far end of the axon" value={`${r.vFar.toFixed(1)} mV`} />
        <Row label="Spikes at the body, last second" value={`${recentSoma}`} />
        <Row label="Spikes reaching the far end, last second" value={`${recentFar}`} />
        <Row label="Conduction speed (measured)" value={r.conductionVelocity === null ? 'not yet measured' : `${r.conductionVelocity.toFixed(2)} m/s`} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <Row label="Sodium inside / outside" value={`${r.naIn.toFixed(0)} / ${NA_OUT_MM} mM`} />
        <Row label="Potassium inside / outside" value={`${r.kIn.toFixed(0)} / ${K_OUT_MM} mM`} />
        <Row label="E_Na (from the concentrations)" value={`${r.eNa.toFixed(1)} mV`} />
        <Row label="E_K (from the concentrations)" value={`${r.eK.toFixed(1)} mV`} />
      </div>
      <Note>
        The concentrations are live, and the reversal potentials are recomputed from them every
        step. They change here at the rate they would in a 4 µm axon
        {RUNDOWN_SPEEDUP > 1 ? `, shown ${RUNDOWN_SPEEDUP}× faster than life` : ''} — several
        times faster than in a cell body, so that a pump you switch off runs down within a
        simulated minute rather than many.
      </Note>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <Row label="ATP per second (pump turnover, whole cell)" value={sci(r.atpPerSecond)} />
        <Row label="ATP per spike" value={sci(r.atpPerSpike)} />
        <Row label="ATP spent so far, this cell" value={sci(cell.atpTotal)} />
      </div>
      <Note>
        The counter is the pump's cycles, one ATP each, added up across every patch of membrane
        in the cell. Per spike: the sodium a spike lets in, at three sodium carried out per ATP —
        counted for each patch the spike reached.
      </Note>
    </Panel>
  )

  return { left, right }
}
