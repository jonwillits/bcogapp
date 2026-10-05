import { Panel } from '../../components/Panel'
import { Button, SelectControl, Slider, Toggle } from '../../components/controls'
import { ValueReadout } from '../../components/ValueReadout'
import { FISH_SCENARIOS, EEL_RETURNS, ROUTE_LABEL } from '../../sim/fish/scenarios'
import { KINDS, POOL_RANGE, SPREAD_RANGE, FAR_DILUTION } from '../../sim/fish/kinds'
import { percentCorrect } from '../../sim/fish/sdt'
import { BUILT_INS } from '../../sim/fish/brain'
import type { FishSceneState } from './FishScene'
import { MURKY_LINE, ORIENTING_LINE, KIND_COLORS, RECEPTOR_COLORS } from './labels'
import { Content, GroupLabel, Note, PANEL_STYLE, RIGHT_STYLE, Row, TabBar } from './ui'

/**
 * The World tab: which stream the fish is in, what that stream does, and
 * the general settings. Lab 4's convention: the world's settings live here
 * and not under the animal's wiring.
 */
export function WorldTab(s: FishSceneState) {
  const { world, scenario, bump } = s
  const st = world.settings
  const mix = world.mix
  const closer = scenario.extras.includes('phases')
  const downstream = scenario.extras.includes('downstream')
  const proportion = world.brain.receptors.builtIns.includes('proportion')
  const kinds = [...mix.happens, ...mix.doesNot]

  const left = (
    <Panel title="The world" style={PANEL_STYLE}>
      <TabBar tab={s.tab} onChange={s.setTab} />
      <SelectControl
        label="Scenario"
        value={scenario.key}
        options={FISH_SCENARIOS.map((x) => ({ value: x.key, label: `${x.letter} — ${x.title}` }))}
        onChange={(key: string) => s.loadScenario(key)}
      />
      <Note>{scenario.blurb}</Note>

      {closer && (
        <>
          <GroupLabel>The phases</GroupLabel>
          <Row label="Now in" value={`phase ${st.phase + 1}: ${st.phase === 2 ? EEL_RETURNS.toLowerCase() : mix.label}`} mono={false} />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {[0, 1].map((k) => (
              <Button
                key={k}
                variant={k === st.phase ? 'primary' : 'default'}
                onClick={() => {
                  world.set({ phase: k })
                  s.restartShow()
                  bump()
                }}
              >
                {'Go to phase ' + (k + 1)}
              </Button>
            ))}
            <Button
              variant={st.phase === 2 ? 'primary' : 'default'}
              onClick={() => {
                world.eelReturns()
                s.restartShow()
                bump()
              }}
            >
              {'Go to phase 3: ' + EEL_RETURNS}
            </Button>
          </div>
          <Toggle
            label="Eels and suckers stay around"
            checked={st.stayAround}
            onChange={(v) => {
              world.set({ stayAround: v })
              s.restartShow()
              bump()
            }}
          />
          <Note>
            Changing phase changes what is in the stream and nothing about the fish: its weights carry over. With <b>Eels and suckers stay around</b> on, phase 2 mixes the old animals in with the new. Phase 3 puts an eel upstream next, and then all four.
          </Note>
        </>
      )}

      {downstream && (
        <>
          <GroupLabel>Distance</GroupLabel>
          <Row label="The fish now encounters things that are" value={st.distance === 'both' ? 'near and far' : st.distance} mono={false} />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <Button
              variant={st.distance === 'far' ? 'primary' : 'default'}
              onClick={() => {
                world.set({ distance: st.distance === 'far' ? 'near' : 'far' })
                s.restartShow()
                bump()
              }}
            >
              {st.distance === 'far' ? 'Go back upstream' : 'Go downstream'}
            </Button>
          </div>
          <Toggle
            label="Learn from every distance"
            checked={st.distance === 'both'}
            onChange={(v) => {
              world.set({ distance: v ? 'both' : 'near' })
              s.restartShow()
              bump()
            }}
          />
          <Toggle
            label="Proportion of A (a built-in receptor)"
            checked={proportion}
            onChange={(v) => {
              world.reshape({ builtIns: v ? ['proportion'] : [], raw: true })
              s.restartShow()
              bump()
            }}
          />
          <Note>{BUILT_INS.find((x) => x.id === 'proportion')!.line}</Note>
          {proportion && (
            <Toggle
              label="Proportion only (receptors A and B disconnected)"
              checked={!world.brain.receptors.raw}
              onChange={(v) => {
                world.reshape({ builtIns: ['proportion'], raw: !v })
                s.restartShow()
                bump()
              }}
            />
          )}
          <Note>
            Far things are diluted: both receptors read {FAR_DILUTION} of what they read near. <b>Go downstream</b> changes where the fish is, and no weight. Switching a receptor on or off starts the run again with a new network.
          </Note>
        </>
      )}

      <GroupLabel>The stream</GroupLabel>
      {s.can('source') ? (
        <SelectControl
          label="Where the encounters come from"
          value={st.source}
          options={[
            { value: 'pool', label: 'a small pool: the same individuals, again and again' },
            { value: 'stream', label: 'a stream: every encounter is a new individual' },
          ]}
          onChange={(v: 'stream' | 'pool') => {
            world.set({ source: v })
            world.reset()
            s.restartShow()
            bump()
          }}
        />
      ) : (
        <Row label="Where the encounters come from" value={st.source === 'pool' ? 'a small pool' : 'a stream'} mono={false} />
      )}
      {st.source === 'pool' &&
        (s.can('poolSize') ? (
          <Slider
            label="How many individuals live here"
            value={st.poolSize}
            min={POOL_RANGE.min}
            max={POOL_RANGE.max}
            step={POOL_RANGE.step}
            format={(v) => String(v)}
            onChange={(v) => {
              world.set({ poolSize: v })
              world.reset()
              s.restartShow()
              bump()
            }}
          />
        ) : (
          <Row label="How many individuals live here" value={String(st.poolSize)} />
        ))}
      {scenario.key !== 'island' &&
        (s.can('spread') ? (
          <Slider
            label="How much smells vary"
            value={st.spread}
            min={SPREAD_RANGE.min}
            max={SPREAD_RANGE.max}
            step={SPREAD_RANGE.step}
            onChange={(v) => {
              world.set({ spread: v })
              bump()
            }}
          />
        ) : (
          <Row label="How much smells vary (locked)" value={st.spread.toFixed(2)} />
        ))}

      <GroupLabel>The run</GroupLabel>
      <Row label="Run seed" value={String(s.seed)} />
      <div style={{ display: 'flex', gap: 6 }}>
        <Button onClick={s.reset}>Reset</Button>
        <Button onClick={s.newSeed}>New seed</Button>
      </div>
      <Note>
        <b>Reset</b> starts the run again from the same seed, with every control where you left it and the weights back where the run started. A weight you set by hand counts as where the run started. <b>New seed</b> gives a different stream, different test sets and, where starting weights are drawn at random, different ones.
      </Note>
    </Panel>
  )

  const total = world.encounters
  const right = (
    <Panel title="This world" style={RIGHT_STYLE}>
      <GroupLabel>What the world does</GroupLabel>
      <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, lineHeight: 1.5 }}>
        {kinds.map((id) => (
          <li key={id}>{KINDS[id].does}</li>
        ))}
        <li>The outcome arrives on every encounter, whatever the fish did.</li>
        {st.source === 'pool' ? (
          <li>
            {st.poolSize} individuals live here. Each has its own smell, and the fish encounters the same ones again and again.
          </li>
        ) : (
          <li>Every encounter is a new individual.</li>
        )}
        {downstream && <li>{st.distance === 'far' ? 'Everything the fish encounters here is far off, and its smell is diluted.' : st.distance === 'both' ? 'Half of what the fish encounters is near and half is far off.' : 'Everything the fish encounters here is near.'}</li>}
        <li>The verdict goes to: {ROUTE_LABEL[world.route]} (locked).</li>
      </ul>
      <Content>{MURKY_LINE}</Content>
      <Content>
        A smell is drawn as specks carried on the current: <span style={{ color: RECEPTOR_COLORS.a }}>pink</span> for receptor A’s response and <span style={{ color: RECEPTOR_COLORS.b }}>green</span> for receptor B’s. The more specks of a color, the stronger that response.
      </Content>
      <Content>{ORIENTING_LINE}</Content>

      <GroupLabel>What is in the stream</GroupLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 12 }}>
        {kinds.map((id) => {
          const k = KINDS[id]
          return (
            <span key={id} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ width: 10, height: 10, borderRadius: 5, background: k.happens ? KIND_COLORS.happens : KIND_COLORS.doesNot, display: 'inline-block' }} />
              <span style={{ flex: 1 }}>{k.label}</span>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                {k.typical ? `typically (${k.typical[0].toFixed(2)}, ${k.typical[1].toFixed(2)})` : 'anywhere'}
              </span>
            </span>
          )
        })}
      </div>

      <GroupLabel>Scorecard</GroupLabel>
      <ValueReadout label="Encounters" value={total} digits={0} />
      <ValueReadout label="Harm taken" value={world.harm} digits={0} />
      <ValueReadout label="Meals" value={world.meals} digits={0} />
      <ValueReadout label="Percent of verdicts right" value={total ? percentCorrect(world.counts) : 0} digits={1} unit="%" />
      {st.source === 'pool' && <ValueReadout label="Encounters per individual, on average" value={world.meetingsPerIndividual} digits={1} />}
    </Panel>
  )

  return { left, right }
}
