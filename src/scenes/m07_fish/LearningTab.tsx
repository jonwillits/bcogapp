import { Panel } from '../../components/Panel'
import { Section } from '../../components/Section'
import { Button, Toggle } from '../../components/controls'
import { fmt } from '../../components/format'
import { FISH_RATE_RANGE, HIDDEN_MODES, MAX_RANDOM_HIDDEN, inputLabels, type HiddenMode } from '../../sim/fish/brain'
import type { FishSceneState } from './FishScene'
import { BACKPROP_LINE, LAB5_LINE, TARGET_LINE } from './labels'
import { LearningCurve } from './plots'
import { Content, GroupLabel, LogSlider, Note, PANEL_STYLE, RIGHT_STYLE, Row, TabBar } from './ui'

const sub = (i: number) => '₁₂₃₄₅₆₇₈₉'[i] ?? String(i + 1)
const n3 = (v: number) => (Math.abs(v) < 0.0005 ? '0.000' : (v < 0 ? '−' : '') + Math.abs(v).toFixed(3))
/** `n3` with the sign's place kept, for a line of arithmetic: a space where the minus would be. */
const s3 = (v: number) => (Math.abs(v) >= 0.0005 && v < 0 ? '' : ' ') + n3(v)

/**
 * One connection's change, always on two lines that never wrap: the rule in
 * symbols, and under it the same line in numbers. A negative Φ used to push
 * the single line past the panel's edge and shove everything below it down.
 */
function Arithmetic({ symbols, rate, input, phi, change }: { symbols: string; rate: number; input: string; phi: number; change: number }) {
  return (
    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, whiteSpace: 'pre', overflow: 'hidden' }}>
      {symbols}
      {'\n'}
      {`    = ${rate} · ${input} · ${s3(phi)} = ${s3(change)}`}
    </div>
  )
}

/**
 * The Learning tab. One rule, Lab 5's: every connection changes by its input
 * times its unit's share of the error. The selector decides who sets the
 * hidden layer's weights, and the arithmetic is printed with live numbers
 * for both the output unit and one hidden unit, with where each Φ came from.
 */
export function LearningTab(s: FishSceneState) {
  const { world, bump, hide } = s
  const b = world.brain
  const st = b.settings
  const hidden = b.circuit.interneurons
  const last = b.last
  const labels = inputLabels(b.receptors)
  const canMode = s.can('hiddenMode')
  const e = world.last

  const reshape = (change: Parameters<typeof world.reshape>[0]) => {
    world.reshape(change)
    s.restartShow()
    s.setHoverUnit(null)
    bump()
  }

  const left = (
    <Panel title="The learning rule" style={PANEL_STYLE}>
      <TabBar tab={s.tab} onChange={s.setTab} />
      {hide ? (
        <Note>This fish’s numbers are hidden until you reveal it on the Fish tab.</Note>
      ) : (
        <>
          {s.can('learningOn') ? (
            <Toggle
              label="Learning on"
              checked={st.on}
              onChange={(v) => {
                st.on = v
                bump()
              }}
            />
          ) : (
            <Row label="Learning (locked)" value={st.on ? 'on' : 'off'} mono={false} />
          )}
          <Note>Off, the fish is Lab 4’s animal: its weights stay where they are put. On, every encounter’s outcome moves them a little.</Note>
          {s.can('rate') ? (
            <LogSlider
              label="learning rate η"
              value={st.rate}
              min={FISH_RATE_RANGE.min}
              max={FISH_RATE_RANGE.max}
              format={(v) => String(v)}
              onChange={(v) => {
                st.rate = v
                bump()
              }}
            />
          ) : (
            <Row label="learning rate η (locked)" value={String(st.rate)} />
          )}

          <GroupLabel>Who sets the hidden weights?</GroupLabel>
          {HIDDEN_MODES.map((m) => {
            const selected = st.hidden === m.id
            const disabled = !canMode && !selected
            return (
              <button
                key={m.id}
                type="button"
                disabled={!canMode}
                onClick={() => reshape({ mode: m.id as HiddenMode, hidden: m.id === 'random' ? Math.max(2, world.hiddenCount) : Math.min(8, world.hiddenCount) })}
                style={{
                  textAlign: 'left',
                  padding: '7px 9px',
                  borderRadius: 'var(--radius-sm)',
                  border: `1px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
                  background: selected ? 'rgba(79,156,255,0.16)' : 'transparent',
                  color: 'var(--text)',
                  font: 'inherit',
                  fontSize: 12,
                  cursor: canMode ? 'pointer' : 'default',
                  opacity: disabled ? 0.45 : 1,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontWeight: 600 }}>{m.label}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: 10.5 }}>{m.section}</span>
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: 11, lineHeight: 1.4, marginTop: 2 }}>
                  <i>A hidden weight’s change depends on:</i> {m.dependsOn}
                </div>
                <div style={{ fontSize: 11, lineHeight: 1.4, marginTop: 3 }}>{m.line}</div>
              </button>
            )
          })}
          {!canMode && <Note>This scenario holds the setting where it is.</Note>}
          {hidden.length === 0 && <Note>There is no hidden layer yet. Add hidden units on the Network tab, and this setting is what moves their weights.</Note>}

          {st.hidden === 'random' && canMode && (
            <>
              <LogSlider label="Number of hidden units, fixed at random" value={Math.max(2, world.hiddenCount)} min={2} max={MAX_RANDOM_HIDDEN} integer format={(v) => String(v)} onChange={(v) => reshape({ hidden: v })} />
              <Toggle label="Sparse: about one unit in ten active at once" checked={world.sparse} onChange={(v) => reshape({ sparse: v })} />
              <Note>
                Spreading two receptors across many more units is <b>dimensionality expansion</b>. With <b>sparse coding</b>, each unit’s baseline is set so that it is active for about one smell in ten.
              </Note>
            </>
          )}
          {st.hidden !== 'hand' && hidden.length > 0 && canMode && (
            <Button onClick={() => reshape({ redraw: true })}>Start from new random weights</Button>
          )}
          <Content>{BACKPROP_LINE}</Content>
          <Note>{LAB5_LINE}</Note>
        </>
      )}
    </Panel>
  )

  const outIn = hidden.length > 0 ? hidden.map((_, j) => `h${sub(j)}`) : labels.map((_, i) => `x${sub(i)}`)
  const outVals = hidden.length > 0 ? b.h : b.x
  const showOut = Math.min(outIn.length, 4)
  const j = Math.min(s.hoverUnit ?? 0, Math.max(0, hidden.length - 1))
  const right = (
    <Panel title="What the rule is doing" style={RIGHT_STYLE}>
      {hide ? (
        <Note>Hidden until you reveal this fish.</Note>
      ) : (
        <>
          <Section key={`${world.scenario.key}-arith`} title="The arithmetic" defaultOpen hint="Δb = η · x · Φ for every connection, on the last encounter. Φ is the unit’s share of the error.">
            {!st.on && <Note>Learning is off, so nothing changed on the last encounter.</Note>}
            <GroupLabel>The output unit</GroupLabel>
            <Row label="a — what arrived" value={e ? (e.happens ? '1 (it happened)' : '0 (it did not)') : '—'} />
            <Row label="p — the prediction, made before and held" value={e ? e.p.toFixed(3) : '—'} />
            <Row label="Φ = a − p" value={st.on && e ? n3(last.phiOut) : '—'} />
            <Content>{TARGET_LINE}</Content>
            {st.on &&
              e &&
              Array.from({ length: showOut }, (_, i) => (
                <Arithmetic key={i} symbols={`Δb${sub(i)} = η · ${outIn[i]} · Φ`} rate={st.rate} input={(outVals[i] ?? 0).toFixed(2)} phi={last.phiOut} change={last.output[i] ?? 0} />
              ))}
            {st.on && e && (
              <Arithmetic symbols="Δb₀ = η · 1 · Φ" rate={st.rate} input="1" phi={last.phiOut} change={last.outputBaseline} />
            )}
            {outIn.length > showOut && <Note>…and {outIn.length - showOut} more connections onto the output unit, by the same line.</Note>}

            {hidden.length > 0 && (
              <>
                <GroupLabel>Hidden unit {j + 1}</GroupLabel>
                {st.hidden === 'pass-back' ? (
                  <>
                    <Row label="its slope, f′(net)" value={st.on && e ? n3(last.slope[j] ?? 0) : '—'} />
                    <Row label={`the weight from it to the output, b${sub(j)}`} value={fmt(b.circuit.output!.weights[j])} />
                    <Row label="the output unit’s Φ" value={st.on && e ? n3(last.phiOut) : '—'} />
                    <Row label="Φ = slope · weight · output’s Φ" value={st.on && e ? n3(last.phiHidden[j] ?? 0) : '—'} />
                    <Note>
                      <b>Where this Φ comes from:</b> the unit it feeds, passed back through the connection its activity went forward on. This is <b>backpropagation</b>, and the problem it answers is <b>structural credit assignment</b>. With the threshold function the slope is zero, so the share is zero and no hidden weight moves.
                    </Note>
                    {st.on &&
                      e &&
                      labels.slice(0, 3).map((_, i) => (
                        <Arithmetic key={i} symbols={`Δb${sub(i)} = η · x${sub(i)} · Φ`} rate={st.rate} input={(b.x[i] ?? 0).toFixed(2)} phi={last.phiHidden[j] ?? 0} change={last.hidden[j]?.[i] ?? 0} />
                      ))}
                  </>
                ) : (
                  <Note>
                    {st.hidden === 'hand'
                      ? 'By hand: the rule does not reach this unit. Its weights are where the sliders put them.'
                      : 'Fixed at random: the rule does not reach this unit. Its weights were drawn once from the seed.'}{' '}
                    Only the output unit’s weights change.
                  </Note>
                )}
                {hidden.length > 1 && <Note>Point at a hidden unit on the Network tab’s diagram to print that unit’s line here instead.</Note>}
              </>
            )}
          </Section>
          <Section key={`${world.scenario.key}-lcurve`} title="The learning curve" defaultOpen>
            <LearningCurve world={world} />
            <Row label="Encounters so far" value={world.encounters.toLocaleString('en-US')} />
            {world.settings.source === 'pool' && <Row label="Encounters per individual, on average" value={world.meetingsPerIndividual.toFixed(1)} />}
          </Section>
        </>
      )}
    </Panel>
  )

  return { left, right }
}
