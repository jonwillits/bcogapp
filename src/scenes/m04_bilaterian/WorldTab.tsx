import { Panel } from '../../components/Panel'
import { Button, Slider, SelectControl } from '../../components/controls'
import { ValueReadout } from '../../components/ValueReadout'
import { CONCENTRATION_RANGE } from '../../sim/bilaterian/dishWorld'
import { randomSeed } from '../../sim/random'
import { TabBar, Note, Row, GroupLabel, PANEL_STYLE, RIGHT_STYLE, SCENARIOS, type SceneState } from './BilaterianScene'

const PART_LABEL: Record<string, string> = { 1: 'Part 1', 2: 'Part 2', 3: 'Part 3', closer: 'Closer' }

/**
 * The World tab: the dish and what is in it. Which scenario, how strong the
 * plumes are, what a click places, the run seed. General settings live
 * here rather than under the circuit, because changing the world is not
 * changing the animal.
 */
export function WorldTab(s: SceneState) {
  const { world, scenario, bump } = s

  const left = (
    <Panel title="The world" style={PANEL_STYLE}>
      <TabBar tab={s.tab} onChange={s.setTab} />
      <Note>
        <b>Real time</b>, times the speed control. One animal in a dish of cue fields. Each
        scenario sets which cues are in the dish, what they are called, and which of the animal’s
        controls are locked.
      </Note>
      <SelectControl
        label="Scenario"
        value={scenario.key}
        options={SCENARIOS.map((sc) => ({ value: sc.key, label: `${PART_LABEL[String(sc.part)]} — ${sc.title}` }))}
        onChange={(k) => s.loadScenario(k)}
      />
      <Note>{scenario.blurb}</Note>
      {scenario.keepWiringFrom && (
        <Note>
          Loaded from <b>{scenario.keepWiringFrom}</b>, the interneuron keeps the numbers you set there.
        </Note>
      )}
      {scenario.key === 'diagnosis' && (
        <Note>
          The Worms tab loads each of the six animals into this dish. Animal <b>{s.animal === 'healthy' ? 'Healthy' : s.animal}</b> is in it now.
        </Note>
      )}
      <GroupLabel>The cues</GroupLabel>
      <Slider
        label="Cue concentration (the plumes)"
        value={world.concentration}
        min={CONCENTRATION_RANGE.min}
        max={CONCENTRATION_RANGE.max}
        step={CONCENTRATION_RANGE.step}
        format={(v) => `${v.toFixed(2)}×`}
        onChange={(v) => {
          world.concentration = v
          bump()
        }}
      />
      <Note>Scales the plumes that come and go, not the fixed features of the dish. Kept when you load another scenario or animal.</Note>
      <SelectControl
        label="Source to place on a click"
        value={String(s.placeChannel)}
        options={scenario.channels.map((c) => ({ value: String(c.channel), label: c.name }))}
        onChange={(v) => s.setPlaceChannel(Number(v))}
      />
      <Note>Click the floor to place a source of that cue; right-click removes the nearest. Placed sources stay put.</Note>
      <GroupLabel>The run</GroupLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Run seed — same seed, same run</span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, flex: 1 }}>{s.seed}</span>
          <Button onClick={() => s.reset(s.seed)}>Reset</Button>
          <Button onClick={() => s.reset(randomSeed())}>New seed</Button>
        </div>
      </div>
      <Note>Reset keeps every control where you left it. Camera: <b>W A S D</b> to move · <b>arrow keys</b> to rotate · drag and scroll also work.</Note>
    </Panel>
  )

  const right = (
    <Panel title="This world" style={RIGHT_STYLE}>
      <GroupLabel>What is in the dish</GroupLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {scenario.channels.map((c) => (
          <div key={c.channel} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
            <span style={{ width: 12, height: 12, borderRadius: 6, background: c.color, display: 'inline-block', boxShadow: `0 0 6px ${c.color}` }} />
            <span>
              {c.name} — sensory cell x{'₁₂₃₄'[c.channel]}
            </span>
          </div>
        ))}
      </div>
      <Note>
        A plume glows brighter toward its center, the way the field it draws is stronger there; the bead at the middle is the source. Plumes drift away and reappear elsewhere after a while; a plume that is being eaten flashes a ring and vanishes.
      </Note>
      <GroupLabel>What the animal is getting done</GroupLabel>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        <ValueReadout label="Cues reached per minute" value={world.recentCuesPerMinute} digits={1} />
        <ValueReadout label="Over the whole run" value={world.cuesPerMinute} digits={2} />
        <ValueReadout label="Harm" value={world.harm} digits={1} />
        {scenario.countCrossings && <ValueReadout label="Crossings of the strip" value={`${world.crossings}`} />}
        <ValueReadout label="Reversals per minute" value={world.reversalsPerMinute} digits={1} />
        <ValueReadout label="Run time" value={`${world.time.toFixed(0)} s`} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <Row label="Cues reached" value={`${world.cuesReached}`} />
        <Row label="Sources in the dish" value={`${world.sources.length}`} />
      </div>
      <Note>
        Cues reached per minute is the last minute. Harm counts what the dish did to the animal: a meal it should not have eaten, or a second spent somewhere it should not be.
      </Note>
    </Panel>
  )

  return { left, right }
}
