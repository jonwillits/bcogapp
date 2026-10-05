import { Panel } from '../../components/Panel'
import { Section } from '../../components/Section'
import { Button, SelectControl, Slider, Toggle } from '../../components/controls'
import { fmt, fmtSigned } from '../../components/format'
import { RING } from '../../sim/fish/world'
import { ACTIVATIONS, type Activation } from '../../sim/bilaterian/unit'
import type { WiringPatch } from '../../sim/bilaterian/circuit'
import {
  BUILT_INS,
  FISH_BASELINE_RANGE,
  FISH_SIGMOID_WIDTH,
  FISH_THRESHOLD_RANGE,
  FISH_WEIGHT_RANGE,
  MAX_TRAINED_HIDDEN,
  inputLabels,
  type BuiltIn,
} from '../../sim/fish/brain'
import { ROUTE_LABEL } from '../../sim/fish/scenarios'
import type { FishSceneState } from './FishScene'
import { DOTS_LINE, FOREBRAIN_LINE, KIND_COLORS, OUTCOME_WORDS, TWO_RECEPTORS_LINE, BLANK_HIDDEN_LINE } from './labels'
import { FeatureSpacePlot, HiddenSpacePlot, LearningCurve, NetworkDiagram } from './plots'
import { Content, GroupLabel, Note, PANEL_STYLE, RIGHT_STYLE, Row, TabBar } from './ui'

const sub = (i: number) => '₁₂₃₄₅₆₇₈₉'[i] ?? String(i + 1)

/**
 * The Network tab: every number in the fish's nervous system, settable by
 * hand where the scenario allows, and the feature-space panel — the lab's
 * main instrument — at the top of the right side.
 */
export function NetworkTab(s: FishSceneState) {
  const { world, bump, hide } = s
  const b = world.brain
  const c = b.circuit
  const out = c.output!
  const hidden = c.interneurons
  const labels = inputLabels(b.receptors)
  const random = b.settings.hidden === 'random'
  const words = OUTCOME_WORDS[world.route]

  const set = (patch: WiringPatch) => {
    world.wire(patch)
    bump()
  }
  const reshape = (change: Parameters<typeof world.reshape>[0]) => {
    world.reshape(change)
    s.restartShow()
    s.setHoverUnit(null)
    bump()
  }

  const weightRow = (key: string, label: string, value: number, patch: (v: number) => WiringPatch, locked: boolean) =>
    locked ? (
      <Row key={key} label={`${label}${hide ? '' : ' (locked)'}`} value={hide ? '·' : fmt(value)} />
    ) : (
      <Slider key={key} label={label} value={value} min={FISH_WEIGHT_RANGE.min} max={FISH_WEIGHT_RANGE.max} step={FISH_WEIGHT_RANGE.step} format={fmt} onChange={(v) => set(patch(v))} />
    )

  const outputInputs = hidden.length > 0 ? hidden.map((_, j) => `hidden unit ${j + 1}`) : labels
  const shownHidden = Math.min(hidden.length, 8)
  // A hidden weight is the student's to set unless the layer is fixed at random.
  const hiddenLocked = !s.can('weights') || random

  const left = (
    <Panel title="The network" style={PANEL_STYLE}>
      <TabBar tab={s.tab} onChange={s.setTab} />
      <Note>
        Receptors, a hidden layer where there is one, and one output unit. The output unit’s net input is the <b>evidence</b>. Whether the fish responds depends on where that evidence falls against a criterion, on the Decision tab.
      </Note>
      {hide ? (
        <Note>This fish’s numbers are hidden until you reveal it on the Fish tab. The diagram still shows how it is wired.</Note>
      ) : (
        <>
          <Section key={`${world.scenario.key}-shape`} title="Shape — units and receptors" defaultOpen>
            {s.can('hiddenCount') && !random ? (
              <Slider
                label="Number of hidden units"
                value={hidden.length}
                min={0}
                max={MAX_TRAINED_HIDDEN}
                step={1}
                format={(v) => String(v)}
                onChange={(v) => reshape({ hidden: v })}
              />
            ) : (
              <Row label={`Number of hidden units${random ? ' (set on the Learning tab)' : ' (locked)'}`} value={String(hidden.length)} />
            )}
            {s.can('activation') ? (
              <SelectControl label="activation function" value={c.activation} options={ACTIVATIONS} onChange={(a: Activation) => set({ activation: a })} />
            ) : (
              <Row label="activation function (locked)" value={ACTIVATIONS.find((a) => a.value === c.activation)!.label} mono={false} />
            )}
            <Note>
              The sigmoid here is gentler than Lab 4’s: its width is {FISH_SIGMOID_WIDTH} units of net input, so its slope is not zero almost everywhere. The activation function shapes the hidden units. The output unit’s prediction is always the sigmoid of its evidence.
            </Note>
            {s.can('builtIns') && (
              <>
                <GroupLabel>Built-in receptors</GroupLabel>
                {BUILT_INS.map((spec) => {
                  const on = b.receptors.builtIns.includes(spec.id)
                  return (
                    <div key={spec.id} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <Toggle
                        label={`${spec.label}: ${spec.arithmetic}`}
                        checked={on}
                        onChange={(v) => {
                          const next = BUILT_INS.map((x) => x.id).filter((id) => (id === spec.id ? v : b.receptors.builtIns.includes(id))) as BuiltIn[]
                          reshape({ builtIns: next })
                        }}
                      />
                      <Note>Responds to {spec.respondsTo}.{spec.line ? ` ${spec.line}` : ''}</Note>
                    </div>
                  )
                })}
                <Note>A built-in receptor is one the fish would have been born with. Switching one on or off starts the run again with a new network.</Note>
              </>
            )}
          </Section>

          <Section key={`${world.scenario.key}-out`} title="The output unit" defaultOpen={hidden.length === 0} hint="Its weights and its baseline. Its threshold is the criterion, on the Decision tab.">
            {outputInputs.length <= 12 ? (
              outputInputs.map((name, i) => weightRow(`o${i}`, `weight b${sub(i)} — from ${name}`, out.weights[i], (v) => ({ layer: 'output', weight: { input: i, value: v } }), !s.can('weights')))
            ) : (
              <Note>{outputInputs.length} weights, one from each hidden unit. Too many to set by hand; the rule sets them.</Note>
            )}
            {s.can('baseline') ? (
              <Slider label="baseline b₀" value={out.baseline} min={FISH_BASELINE_RANGE.min} max={FISH_BASELINE_RANGE.max} step={FISH_BASELINE_RANGE.step} format={fmt} onChange={(v) => set({ layer: 'output', baseline: v })} />
            ) : (
              <Row label="baseline b₀ (locked)" value={fmt(out.baseline)} />
            )}
            <Row label="criterion (its threshold θ)" value={fmt(out.threshold)} />
          </Section>

          {hidden.slice(0, shownHidden).map((u, j) => (
            <Section key={`${world.scenario.key}-${hidden.length}-${labels.length}-h${j}`} title={`Hidden unit ${j + 1}`} hint={random ? 'Fixed at random: drawn once from the seed, and never changed.' : undefined}>
              {labels.map((name, i) => weightRow(`h${j}-${i}`, `weight b${sub(i)} — from ${name}`, u.weights[i], (v) => ({ interneuron: j, weight: { input: i, value: v } }), hiddenLocked))}
              {hiddenLocked || !s.can('baseline') ? (
                <Row label="baseline b₀" value={fmt(u.baseline)} />
              ) : (
                <Slider label="baseline b₀" value={u.baseline} min={FISH_BASELINE_RANGE.min} max={FISH_BASELINE_RANGE.max} step={FISH_BASELINE_RANGE.step} format={fmt} onChange={(v) => set({ interneuron: j, baseline: v })} />
              )}
              {hiddenLocked || !s.can('thresholds') ? (
                <Row label="threshold θ" value={fmt(u.threshold)} />
              ) : (
                <Slider label="threshold θ" value={u.threshold} min={FISH_THRESHOLD_RANGE.min} max={FISH_THRESHOLD_RANGE.max} step={FISH_THRESHOLD_RANGE.step} format={fmt} onChange={(v) => set({ interneuron: j, threshold: v })} />
              )}
            </Section>
          ))}
          {hidden.length > shownHidden && <Note>Eight sample units are listed. The other {hidden.length - shownHidden} are wired the same way.</Note>}

          <Button
            onClick={() => {
              world.restoreScenarioWiring()
              s.restartShow()
              s.setHoverUnit(null)
              bump()
            }}
          >
            Restore the wiring this scenario started with
          </Button>
        </>
      )}
      <Content>{TWO_RECEPTORS_LINE}</Content>
      <Content>{FOREBRAIN_LINE}</Content>
    </Panel>
  )

  const pairOk = hidden.length >= 2
  const pa = Math.min(s.view.pair[0], Math.max(0, hidden.length - 1))
  const pb = Math.min(s.view.pair[1], Math.max(0, hidden.length - 1))
  const unitOptions = hidden.slice(0, shownHidden).map((_, j) => ({ value: String(j), label: `hidden unit ${j + 1}` }))
  const e = world.pending ?? world.last

  const right = (
    <Panel title="What the network is doing" style={RIGHT_STYLE}>
      <Section key={`${world.scenario.key}-fs`} title="The feature space" defaultOpen>
        {world.idleBlankHiddenLayer && !hide && <Content>{BLANK_HIDDEN_LINE}</Content>}
        <FeatureSpacePlot world={world} showTest={s.view.showTest} showPrototypes={s.view.showPrototypes} hoverUnit={hide ? null : s.hoverUnit} hideShading={hide} />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, fontSize: 10.5, color: 'var(--text-muted)' }}>
          <span><span style={{ color: KIND_COLORS.happens }}>●</span> {words.happens}</span>
          <span><span style={{ color: KIND_COLORS.doesNot }}>●</span> {words.doesNot}</span>
          <span>○ test set</span>
          <span>◯ the smell now</span>
        </div>
        <Toggle label="Show the test set" checked={s.view.showTest} onChange={(v) => s.setView({ showTest: v })} />
        <Toggle label="Show each kind’s average (its prototype)" checked={s.view.showPrototypes} onChange={(v) => s.setView({ showPrototypes: v })} />
        {!hide && (
          <Note>
            The shading is the output unit’s prediction for every smell: blue where the prediction is high, orange where it is low. The white line is the <b>decision boundary</b>: the smells whose evidence sits exactly at the criterion. One unit draws one straight line. <b>Linear separability</b> is whether one straight line can divide the two kinds. Filled dots are the last {RING} encounters, the <b>training set</b> as it arrives; hollow dots are the <b>test set</b>, which the fish never encounters.
            {s.hoverUnit !== null && ` The shading is now hidden unit ${s.hoverUnit + 1}’s own output.`}
          </Note>
        )}
        <Content>{DOTS_LINE}</Content>
        {!hide && e && (
          <>
            <Row label="The smell now" value={`A ${e.x1.toFixed(2)} · B ${e.x2.toFixed(2)}`} />
            <Row label="its evidence, and the prediction p" value={`${fmtSigned(e.evidence)} · ${e.p.toFixed(2)}`} />
          </>
        )}
      </Section>

      <Section key={`${world.scenario.key}-diagram`} title="The diagram" defaultOpen>
        <NetworkDiagram world={world} hide={hide} hoverUnit={s.hoverUnit} onHover={s.setHoverUnit} routeLabel={ROUTE_LABEL[world.route]} />
        {hidden.length > 0 && !hide && (
          <Note>
            Each hidden unit’s square shows that unit’s own output over the whole smell space. Point at one and the feature space above is shaded by it instead.
            {hidden.length > shownHidden && ` Eight sample units are drawn, of ${hidden.length}.`}
            {random && ` For the smell now, ${b.activeHidden} of ${hidden.length} hidden units are active.`}
          </Note>
        )}
      </Section>

      {pairOk && (
        <Section key={`${world.scenario.key}-${hidden.length}-hs`} title="The hidden-activity space" defaultOpen={world.scenario.open.includes('hidden-space') || hidden.length === 2}>
          {hidden.length > 2 && (
            <div style={{ display: 'flex', gap: 6 }}>
              <SelectControl label="across" value={String(pa)} options={unitOptions} onChange={(v: string) => s.setView({ pair: [Number(v), pb] })} />
              <SelectControl label="up" value={String(pb)} options={unitOptions} onChange={(v: string) => s.setView({ pair: [pa, Number(v)] })} />
            </div>
          )}
          <HiddenSpacePlot world={world} a={pa} b={hidden.length > 2 ? pb : 1} hide={hide} />
          <Note>
            The same encounters, each drawn where the hidden layer puts it: by the output of two hidden units instead of by the two receptors. The large markers are each kind’s typical smell.
            {hidden.length === 2
              ? ' The white line is the output unit’s, and in this space it is straight.'
              : ' With more than two hidden units the output reads all of them, so its boundary is not a line in any one pair’s plane, and none is drawn.'}
          </Note>
        </Section>
      )}

      <Section key={`${world.scenario.key}-curve`} title="The learning curve" defaultOpen={world.scenario.open.includes('curve')}>
        <LearningCurve world={world} />
        <Note>Percent wrong, against encounters. The training line is scored on the last {RING} encounters as they arrived; each test line is the fish’s present weights on a test set it never encounters. When the training line runs well below a test line, that gap is <b>overfitting</b>.{world.scenario.key === 'new-predator' && ' With two test sets, one line falling while the other rises is what catastrophic interference looks like here.'}{world.scenario.key === 'downstream' && ' The far test set holds smells unlike any that reach the fish while it learns near: it measures out-of-distribution generalization, and invariance to distance.'}</Note>
      </Section>
    </Panel>
  )

  return { left, right }
}
