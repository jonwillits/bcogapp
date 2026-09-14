import { Panel } from '../../components/Panel'
import { Section } from '../../components/Section'
import { Slider } from '../../components/controls'
import { MODULATORS, valenceArousal, nearestState, MODULATOR_DECAY_S } from '../../sim/bilaterian/modulators'
import { AffectPlane, ModulatorTrace } from './plots'
import { TabBar, Note, Row, PANEL_STYLE, RIGHT_STYLE, type SceneState } from './BilaterianScene'

/**
 * The Chemistry tab — Part 3's instrument. Four modulator controls named
 * for what they do, the valence–arousal plane with the animal's state as a
 * live dot, and a persistence readout. Moving any control here changes what
 * the animal does and changes nothing on the Circuit tab: the modulators
 * are gains applied at simulation time, stored apart from every weight.
 */
export function ChemistryTab(s: SceneState) {
  const { world, bump, hideNumbers } = s
  const mod = world.worm.mod
  const { valence, arousal } = valenceArousal(mod.level, world.worm.signedVerdict)
  const state = nearestState(valence, arousal)

  const left = (
    <Panel title="The chemistry" style={PANEL_STYLE}>
      <TabBar tab={s.tab} onChange={s.setTab} />
      <Note>
        Four modulators, each released into the tissue rather than into a synapse. None carries a
        message; each changes what the cells do with the messages they already get. Set one and
        the animal’s behavior changes while every number on the Circuit tab stays exactly as it was.
      </Note>
      {hideNumbers ? (
        <Note>This animal’s chemistry is hidden until you reveal its faults on the Worms tab.</Note>
      ) : (
        MODULATORS.map((m) => (
          <div key={m.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <Slider
              label={m.label}
              value={mod.setPoint[m.id]}
              min={m.min}
              max={m.max}
              step={0.05}
              format={(v) => v.toFixed(2)}
              onChange={(v) => {
                mod.setPoint[m.id] = v
                mod.level[m.id] = v
                bump()
              }}
            />
            <Note>{m.does}</Note>
          </div>
        ))
      )}
    </Panel>
  )

  const away = MODULATORS.filter((m) => Math.abs(mod.level[m.id] - mod.setPoint[m.id]) > 0.01)
  const lastEvent = MODULATORS.map((m) => mod.lastEvent[m.id])
    .filter((t): t is number => t !== null)
    .reduce((a, b) => Math.max(a, b), -Infinity)
  const held = world.worm.reverseHeldFor

  const right = (
    <Panel title="The animal’s state" style={RIGHT_STYLE}>
      <AffectPlane valence={valence} arousal={arousal} hidden={hideNumbers} trail={{ valence: world.trace.valence, arousal: world.trace.arousal }} />
      {hideNumbers ? (
        <Note>The dot is hidden until you reveal.</Note>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <Row label="Valence" value={valence.toFixed(2)} />
            <Row label="Arousal" value={arousal.toFixed(2)} />
            <Row label="Nearest named state" value={state} mono={false} />
          </div>
          <Note>
            An affective state is a position in this space, not a word. Each control moves the dot in one direction, and where the animal ends up depends on where it started. What it senses right now nudges the dot too; the faint line is where the dot has been over the last eight seconds.
          </Note>
          <Section title="Persistence" defaultOpen hint="How long the current state has outlasted whatever set it, and what is holding it.">
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>The four levels over the last eight seconds, each as a fraction of its own range</div>
            <ModulatorTrace levels={world.trace.levels} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <Row
                label="Last event that moved the chemistry"
                value={Number.isFinite(lastEvent) ? `${(world.time - lastEvent).toFixed(0)} s ago` : 'none yet'}
              />
              {away.length === 0 ? (
                <Row label="Held by chemistry" value="nothing decaying" mono={false} />
              ) : (
                away.map((m) => {
                  const gap = mod.level[m.id] - mod.setPoint[m.id]
                  return (
                    <Row
                      key={m.id}
                      label={`${m.label}: ${gap > 0 ? 'raised' : 'lowered'} by an event, decaying`}
                      value={`${Math.abs(gap).toFixed(2)} to go · ~${MODULATOR_DECAY_S} s per e-fold`}
                    />
                  )
                })
              )}
              <Row
                label="Held by the reverse group’s loop"
                value={held === null ? 'not running' : `running ${held.toFixed(1)} s since its trigger`}
              />
            </div>
            <Note>
              Two ways a state outlasts its cause. A modulator level set by an event decays back over minutes, and nothing is written down anywhere. The reverse group keeps itself running for a second or two after the pulse that started it, through its loop onto itself — a circuit that is still running.
            </Note>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {MODULATORS.map((m) => (
                <Row key={m.id} label={`${m.label} — level / set-point`} value={`${mod.level[m.id].toFixed(2)} / ${mod.setPoint[m.id].toFixed(2)}`} />
              ))}
            </div>
          </Section>
        </>
      )}
    </Panel>
  )

  return { left, right }
}
