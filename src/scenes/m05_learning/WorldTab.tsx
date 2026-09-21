import { Panel } from '../../components/Panel'
import { Button, Slider, SelectControl, Toggle } from '../../components/controls'
import { ValueReadout } from '../../components/ValueReadout'
import { CONCENTRATION_RANGE } from '../../sim/bilaterian/dishWorld'
import { LEARNING_SCENARIOS } from '../../sim/bilaterian/learning/scenarios'
import { randomSeed } from '../../sim/random'
import { Note, Row, GroupLabel, PANEL_STYLE, RIGHT_STYLE } from '../m04_bilaterian/BilaterianScene'
import { TabBar, type LearningSceneState } from './LearningScene'
import { TIER_FOUR_LINE } from './labels'

const PART_LABEL: Record<string, string> = { 1: 'Part 1', 2: 'Part 2', 3: 'Part 3', closer: 'Closer' }
export const INTERVAL_RANGE = { min: 0, max: 10, step: 0.5 } as const

/**
 * Lab 4's World tab with two additions: the scenario's own controls — its
 * phases, its interval, its switches — and a readout of what the world
 * currently does, because most of these scenarios change it and a student
 * needs to be able to check rather than remember.
 */
export function WorldTab(s: LearningSceneState) {
  const { world, scenario, bump } = s
  const spec = scenario.learning
  const phases = spec.phases

  const left = (
    <Panel title="The world" style={PANEL_STYLE}>
      <TabBar tab={s.tab} onChange={s.setTab} />
      <Note>
        <b>Real time</b>, times the speed control. The same animal in the same dish as Lab 4. What is new is on the Learning tab, and what it does shows on the Circuit tab’s weight trace.
      </Note>
      <SelectControl
        label="Scenario"
        value={scenario.key}
        options={LEARNING_SCENARIOS.map((sc) => ({ value: sc.key, label: `${PART_LABEL[String(sc.part)]} — ${sc.title}` }))}
        onChange={(k) => s.loadScenario(k)}
      />
      <Note>{scenario.blurb}</Note>
      {spec.tierFour && <Note><b>{TIER_FOUR_LINE}</b></Note>}

      {phases && (
        <>
          <GroupLabel>The phases</GroupLabel>
          <Row label="Now in" value={phases[world.phase].label} mono={false} />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {phases.map((p, k) => (
              <Button
                key={p.label}
                variant={k === world.phase ? 'primary' : 'default'}
                onClick={() => {
                  world.setPhase(k)
                  bump()
                }}
              >
                {`Go to phase ${k + 1}`}
              </Button>
            ))}
          </div>
          <Note>Changing phase changes the dish and nothing about the animal: its weights carry over.</Note>
        </>
      )}

      {(spec.intervalControl || spec.flags) && <GroupLabel>This scenario’s controls</GroupLabel>}
      {spec.intervalControl && (
        <>
          <Slider
            label="Interval between the touch and the food"
            value={world.interval}
            min={INTERVAL_RANGE.min}
            max={INTERVAL_RANGE.max}
            step={INTERVAL_RANGE.step}
            format={(v) => `${v.toFixed(1)} s`}
            onChange={(v) => {
              world.interval = v
              bump()
            }}
          />
          <Note>The cues at a touched site dissolve after 1.5 s, so past that the cue is over before the food arrives.</Note>
        </>
      )}
      {spec.flags &&
        Object.keys(spec.flags).map((key) => (
          <Toggle
            key={key}
            label={spec.flagLabels?.[key] ?? key}
            checked={!!world.flags[key]}
            onChange={(v) => {
              world.flags[key] = v
              world.layOutSites()
              bump()
            }}
          />
        ))}

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
      <SelectControl
        label="Source to place on a click"
        value={String(s.placeChannel)}
        options={scenario.channels.filter((c) => !c.internal).map((c) => ({ value: String(c.channel), label: c.name }))}
        onChange={(v) => s.setPlaceChannel(Number(v))}
      />
      <Note>Click the floor to place a source of that cue; right-click removes the nearest. A placed source stays put and carries nothing: it is a cue by itself.</Note>
      <GroupLabel>The run</GroupLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Run seed — same seed, same run</span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, flex: 1 }}>{s.seed}</span>
          <Button onClick={() => s.reset(s.seed)}>Reset</Button>
          <Button onClick={() => s.reset(randomSeed())}>New seed</Button>
        </div>
      </div>
      <Note>
        Reset starts the run again with every control where you left it and <b>the weights back where the run started</b>, so two runs that differ in one setting can be compared. Camera: <b>W A S D</b> to move · <b>arrow keys</b> to rotate.
      </Note>
    </Panel>
  )

  const right = (
    <Panel title="This world" style={RIGHT_STYLE}>
      <GroupLabel>What the world does</GroupLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
        {spec.worldDoes(world).map((line) => (
          <div key={line}>· {line}</div>
        ))}
      </div>
      <Note>What reaching something does is a rule of the dish, not a property of the cue. Nothing arrives labeled.</Note>
      <GroupLabel>What is in the dish</GroupLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {scenario.channels.map((c, i) => (
          <div key={c.channel} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
            <span style={{ width: 12, height: 12, borderRadius: 6, background: c.color, display: 'inline-block', boxShadow: `0 0 6px ${c.color}` }} />
            <span>
              {c.name} — sensory cell x{'₁₂₃₄₅₆'[i]}
            </span>
          </div>
        ))}
      </div>
      <GroupLabel>What the animal is getting done</GroupLabel>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        <ValueReadout label="Meals per minute — over the last minute" value={world.recentCuesPerMinute} digits={1} />
        <ValueReadout label="Meals — total count" value={`${world.cuesReached}`} />
        <ValueReadout label="Harm" value={world.harm} digits={1} />
        <ValueReadout label="Run time" value={`${world.time.toFixed(0)} s`} />
        {spec.sites && <ValueReadout label="Sites touched" value={`${world.trials}`} />}
        {spec.sites && <ValueReadout label="Touched and found nothing" value={`${world.emptyVisits}`} />}
      </div>
      <Note>
        Harm counts what the dish did to the animal. These are counts and rates on the experimenter’s side of the glass; nothing in the animal keeps them.
      </Note>
    </Panel>
  )

  return { left, right }
}
