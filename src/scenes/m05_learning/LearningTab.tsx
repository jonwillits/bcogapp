import { useState } from 'react'
import { Panel } from '../../components/Panel'
import { Section } from '../../components/Section'
import { Slider, Toggle } from '../../components/controls'
import { fmt } from '../../components/format'
import { Note, Row, GroupLabel, PANEL_STYLE, RIGHT_STYLE } from '../m04_bilaterian/BilaterianScene'
import { THIRD_FACTORS, RATE_RANGE, TRACE_RANGE, DISCOUNT_RANGE, weightChange } from '../../sim/bilaterian/learning/rule'
import { SIGNAL_TRACE_LEN } from '../../sim/bilaterian/learning/learningDish'
import { TabBar, type LearningSceneState } from './LearningScene'
import { LinePlot, Legend, Bar } from './plots'
import { SIGNAL_COLORS, TIER_FOUR_LINE } from './labels'

const SUB = '₁₂₃₄₅₆'

/** The learning rate slides on a log scale, so 0.01 and 1 are both reachable by hand. */
const toSlider = (rate: number) => Math.log10(rate)
const fromSlider = (v: number) => Math.round(10 ** v * 1000) / 1000

/**
 * The Learning tab — the one new tab. The rule, with one selector deciding
 * what supplies its third factor; the arithmetic with the live numbers in
 * it; the rate, the trace window and the discount; the two bounds; and the
 * signal trace, so the four settings are visibly four different quantities
 * driving one rule.
 */
export function LearningTab(s: LearningSceneState) {
  const { world, scenario, bump } = s
  const spec = scenario.learning
  const l = world.learner
  const set = l.settings
  const change = (patch: Partial<typeof set>) => {
    Object.assign(set, patch)
    bump()
  }
  const current = THIRD_FACTORS.find((f) => f.id === set.factor)!
  const usesTrace = spec.show.trace && set.factor === 'verdict'

  const left = (
    <Panel title="The learning rule" style={PANEL_STYLE}>
      <TabBar tab={s.tab} onChange={s.setTab} />
      <Note>
        In Lab 4 you were the only thing that could change a weight. Here a rule can: every plastic connection changes by <b>Δbᵢ = η · xᵢ · Φ</b> — its own input, times a third factor Φ, scaled by the learning rate η. Your job is choosing what Φ is allowed to depend on.
      </Note>
      <Toggle label="Learning on" checked={set.on} onChange={(v) => change({ on: v })} />

      <GroupLabel>The rule — what supplies Φ</GroupLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {THIRD_FACTORS.map((f) => {
          const offered = spec.factors.includes(f.id)
          const chosen = set.factor === f.id
          return (
            <label
              key={f.id}
              style={{
                display: 'flex',
                gap: 8,
                alignItems: 'flex-start',
                padding: '6px 8px',
                borderRadius: 'var(--radius-sm)',
                border: `1px solid ${chosen ? 'var(--accent)' : 'var(--border)'}`,
                opacity: offered ? 1 : 0.45,
                cursor: offered ? 'pointer' : 'not-allowed',
              }}
            >
              <input type="radio" name="third-factor" checked={chosen} disabled={!offered} onChange={() => change({ factor: f.id })} style={{ marginTop: 3 }} />
              <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 12.5, fontWeight: 600 }}>
                  {f.label} <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 400 }}>Φ = {f.phi}</span>{' '}
                  <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>{f.section}</span>
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>Needs: {f.needs}</span>
              </span>
            </label>
          )
        })}
      </div>
      {spec.factors.length === 1 && <Note>This scenario holds the rule at {current.label}. Part 2’s scenarios unlock the other three.</Note>}

      <GroupLabel>Rates and windows</GroupLabel>
      <Slider
        label="learning rate η"
        value={toSlider(set.rate)}
        min={toSlider(RATE_RANGE.min)}
        max={toSlider(RATE_RANGE.max)}
        step={0.01}
        format={(v) => fromSlider(v).toString()}
        onChange={(v) => change({ rate: fromSlider(v) })}
      />
      <Note>How much one occasion is allowed to matter. The slider runs from 0.01 to 1: a hundredfold.</Note>
      {spec.show.trace && (
        <>
          <Slider
            label="eligibility trace window"
            value={set.traceWindow}
            min={TRACE_RANGE.min}
            max={TRACE_RANGE.max}
            step={TRACE_RANGE.step}
            format={(v) => `${v.toFixed(1)} s`}
            onChange={(v) => change({ traceWindow: v })}
          />
          <Note>
            How long a connection stays a candidate after its input has gone. §5.2.8 proposes this as a procedure; §5.3.8 reports that a synapse can be left in a state like it. Those are two claims, and only the first is what this slider is.
          </Note>
        </>
      )}
      {spec.show.discount && (
        <>
          <Slider
            label="discount γ, per second of delay"
            value={set.discount}
            min={DISCOUNT_RANGE.min}
            max={DISCOUNT_RANGE.max}
            step={DISCOUNT_RANGE.step}
            format={(v) => v.toFixed(2)}
            onChange={(v) => change({ discount: v })}
          />
          <Note>An outcome ten seconds away counts for γ¹⁰ of the same outcome now: {fmt(set.discount ** 10)} at this setting.</Note>
        </>
      )}

      <GroupLabel>Bounds</GroupLabel>
      {spec.boundsLocked ? (
        <Note>Both bounds are held off in this scenario. They are the next scenario’s to explore.</Note>
      ) : (
        <>
          <Toggle label="Weakening (long-term depression) — §5.3.2" checked={set.weakening} onChange={(v) => change({ weakening: v })} />
          <Note>
            Off: under Coincidence Φ is never negative, so a weight can grow without limit and can never shrink — §5.2.1’s limitation. On: the receiving cell’s output is measured against how active it has been lately, so a sending cell active while the receiving cell is quiet weakens the connection, down to nothing and no further.
          </Note>
          <Toggle label="Competition — §5.3.5" checked={set.competition} onChange={(v) => change({ competition: v })} />
          <Note>What a connection needs in order to grow is limited and shared among the connections onto one cell: past a total of 2, strengthening some weakens the others.</Note>
        </>
      )}
    </Panel>
  )

  const right = (
    <Panel title="What the rule is doing" style={RIGHT_STYLE}>
      <Section title="The arithmetic" defaultOpen hint="Δbᵢ = η · xᵢ · Φ, with the live numbers in it.">
        <Arithmetic s={s} />
      </Section>
      {spec.show.twoEquations && (
        <Section title="One algorithm, written down twice" defaultOpen hint="Rescorla and Wagner’s rule above the delta rule, with one set of numbers flowing through both.">
          <TwoEquations s={s} />
        </Section>
      )}
      <Section title="The signal trace" defaultOpen hint="Φ over the last minute, whatever currently supplies it.">
        <LinePlot
          series={[
            { color: SIGNAL_COLORS.phi, data: world.signalTrace.phi },
            { color: SIGNAL_COLORS.verdict, data: world.signalTrace.output, dashed: true },
          ]}
          yMin={-1.5}
          yMax={1.5}
          capacity={SIGNAL_TRACE_LEN}
          height={100}
          zeroLine
        />
        <Legend
          items={[
            { color: SIGNAL_COLORS.phi, label: `Φ = ${current.phi} (${current.label})` },
            { color: SIGNAL_COLORS.verdict, label: 'the verdict y' },
          ]}
        />
        <Row label="Φ now" value={fmt(l.phi)} />
        <Row label="Where Φ comes from" value={current.from} mono={false} />
        {set.factor === 'teacher' && (
          <Note>
            <b>The target is supplied by the scenario.</b> Nothing inside the animal holds it. Ask where an animal in a dish would get one.
          </Note>
        )}
        {set.factor === 'prediction' && (
          <Row
            label="The held prediction p"
            value={`${fmt(l.held.value)} · made ${fmt(Math.max(0, l.time - l.held.madeAt))} s ago${l.arrivalBeganAt === null ? '' : ' · held: something is arriving'}`}
          />
        )}
      </Section>
      {(spec.show.credit || usesTrace) && (
        <Section title="Credit" defaultOpen hint="Which connections are still candidates, and what each point is worth.">
          {spec.tierFour && <Note><b>{TIER_FOUR_LINE}</b></Note>}
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Eligibility on each connection — a mark that fades</div>
          {scenario.channels.map((c, i) => (
            <Bar key={c.channel} value={l.eligibility[i] ?? 0} color={c.color} label={`e${SUB[i]} ${c.name}`} />
          ))}
          <Row label="The critic’s value estimate" value={fmt(l.value)} />
          <Row label="The broadcast signal δ" value={fmt(l.broadcast)} />
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>What the critic holds each cue to be worth</div>
          {scenario.channels.map((c, i) =>
            l.config.predicts[i] ? <Row key={c.channel} label={`value of ${c.name}`} value={fmt(l.critic.weights[i])} /> : null,
          )}
          <Note>
            Two parts. The <b>critic</b> holds the value estimate and its errors are the broadcast signal; the <b>actor</b> holds the weights on the Circuit tab, and the critic’s errors are what move them. An animal that cannot yet act well can still be getting better at telling good situations from bad.
          </Note>
        </Section>
      )}
    </Panel>
  )

  return { left, right }
}

function Arithmetic({ s }: { s: LearningSceneState }) {
  const { world, scenario } = s
  const l = world.learner
  const set = l.settings
  const [x, setX] = useState(40)
  const [y, setY] = useState(40)
  const field = { width: 56, fontFamily: 'var(--font-mono)', fontSize: 12, background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 4px' }
  return (
    <>
      <pre style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: 11.5, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
        {scenario.channels
          .map((c, i) =>
            l.config.limits[i].plastic
              ? `Δb${SUB[i]} = η · x${SUB[i]} · Φ = ${fmt(set.rate)} · ${fmt(l.eligibility[i])} · ${fmt(l.phi)} = ${fmt(set.on ? l.changePerSecond[i] : 0)} per second   (${c.name})`
              : `Δb${SUB[i]} = 0   (${c.name}: innate)`,
          )
          .join('\n')}
      </pre>
      <Note>
        Every connection uses the same η and the same Φ; only its own input differs. {set.traceWindow > 0 ? 'With a trace window above zero, xᵢ here is the input as the connection still holds it.' : ''}
      </Note>
      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>One occasion, by hand — under Coincidence, at the learning rate set on the left</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-mono)', fontSize: 12, flexWrap: 'wrap' }}>
        Δb₁ = {fmt(set.rate)} ·
        <input aria-label="sending rate x" type="number" value={x} onChange={(e) => setX(Number(e.target.value))} style={field} /> ·
        <input aria-label="receiving rate y" type="number" value={y} onChange={(e) => setY(Number(e.target.value))} style={field} /> ={' '}
        <b>{Number(weightChange(set.rate, x, y).toPrecision(6))}</b>
      </div>
      <Note>The reading’s §5.2.1 works this with both firing rates at 40. Try its two learning rates.</Note>
    </>
  )
}

function TwoEquations({ s }: { s: LearningSceneState }) {
  const l = s.world.learner
  const arriving = s.world.arriving
  const a = arriving === null ? '—' : fmt(arriving)
  const p = fmt(l.held.value)
  const err = arriving === null ? '—' : fmt(arriving - l.held.value)
  const mono = { fontFamily: 'var(--font-mono)', fontSize: 11.5, lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap' as const }
  return (
    <>
      <pre style={mono}>
        {`Rescorla & Wagner, 1972   ΔV  = αβ · (λ − V)\n` +
          `                               = ${fmt(l.settings.rate)} · (${a} − ${p}) = ${arriving === null ? '—' : fmt(l.settings.rate * (arriving - l.held.value))}\n` +
          `Widrow & Hoff, 1960       Δb₁ = η · (t − o) · x₁\n` +
          `                               = ${fmt(l.settings.rate)} · (${a} − ${p}) · x₁`}
      </pre>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <Row label="λ = t — what the world delivered" value={a} />
        <Row label="V = o — what was already predicted" value={p} />
        <Row label="αβ = η — the rate terms" value={fmt(l.settings.rate)} />
        <Row label="(λ − V) = (t − o) — the prediction error" value={err} />
      </div>
      <Note>
        The numbers fill in while something is arriving at the animal’s mouth, and read — between arrivals. x₁ does not appear in the upper line because on a conditioning trial a cue is either there or not.
      </Note>
    </>
  )
}
