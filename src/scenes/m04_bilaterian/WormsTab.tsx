import { Panel } from '../../components/Panel'
import { Toggle } from '../../components/controls'
import { ValueReadout } from '../../components/ValueReadout'
import { animalById, type AnimalId } from '../../sim/bilaterian/animals'
import { TabBar, Note, GroupLabel, PANEL_STYLE, RIGHT_STYLE, ANIMAL_WARM_UP_S, type SceneState } from './BilaterianScene'

/**
 * The Worms tab: five animals, each loaded one at a time into the same
 * dish. W0 is diagnosed on the panel as a worked example. W1 to W4 keep
 * their faults hidden behind Reveal faults, which sits under "When you have
 * committed". A scorecard per animal, so the five compare without leaving
 * the tab.
 */
export function WormsTab(s: SceneState) {
  const ids: AnimalId[] = ['healthy', 'W0', 'W1', 'W2', 'W3', 'W4']
  const current = animalById(s.animal)
  const w = s.world
  const shown = s.animal === 'healthy' || s.animal === 'W0' || s.revealed

  const left = (
    <Panel title="Worms" style={PANEL_STYLE}>
      <TabBar tab={s.tab} onChange={s.setTab} />
      <Note>
        Four animals, W1 to W4, are all bad at reaching food, and bad at it in ways that look the
        same from outside. Each has a different thing wrong with it — or nothing wrong at all. W0
        is a worked example. Load one; the other two tabs then show that animal.
      </Note>
      <GroupLabel>Load an animal</GroupLabel>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
        {ids.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => s.loadAnimal(id)}
            style={{
              padding: '7px 0',
              fontSize: 13,
              fontFamily: 'var(--font-mono)',
              fontWeight: 600,
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
              cursor: 'pointer',
              background: s.animal === id && s.scenario.key === 'diagnosis' ? 'var(--accent)' : 'transparent',
              color: s.animal === id && s.scenario.key === 'diagnosis' ? '#0b111c' : 'var(--text)',
            }}
          >
            {id === 'healthy' ? 'Healthy' : id}
          </button>
        ))}
      </div>
      <Note>
        Each animal loads into the same dish with the same seed, already {ANIMAL_WARM_UP_S} seconds into its run, so the scorecard has a minute on it. Reset replays the same run.
      </Note>
      <Note>
        Things you can change while you watch: the cue concentration and the sources in the dish, on the Circuit tab. The numbers on W1 to W4’s panels stay hidden until you reveal.
      </Note>
      <GroupLabel>When you have committed</GroupLabel>
      <Toggle label="Reveal faults" checked={s.revealed} onChange={s.setRevealed} />
    </Panel>
  )

  const right = (
    <Panel title={s.animal === 'healthy' ? 'The healthy animal' : `Animal ${s.animal}`} style={RIGHT_STYLE}>
      <GroupLabel>Scorecard</GroupLabel>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        <ValueReadout label="Cues reached per minute — over the last minute" value={w.recentCuesPerMinute} digits={1} />
        <ValueReadout label="Cues reached per minute — over the whole run" value={w.cuesPerMinute} digits={2} />
        <ValueReadout label="Cues reached — total count" value={`${w.cuesReached}`} />
        <ValueReadout label="Reversals per minute" value={w.reversalsPerMinute} digits={1} />
        <ValueReadout label="Time in reverse" value={`${(100 * w.fractionInReverse).toFixed(0)}%`} />
        <ValueReadout label="Energy per cue reached" value={Number.isFinite(w.energyPerCue) ? w.energyPerCue.toFixed(1) : '—'} />
        <ValueReadout label="Run time" value={`${w.time.toFixed(0)} s`} />
      </div>
      <Note>Both of the first two are rates, in cues per minute: one counts only the last minute and jumps about, the other averages the whole run and settles. The total count is the plain number eaten. Energy per cue is everything the animal has spent moving, reversing and turning, divided by the cues it has reached.</Note>
      {s.animal === 'healthy' && (
        <Note>The default: every weight, switch and threshold at its healthy value, every modulator at its healthy level. What the five are compared against.</Note>
      )}
      {s.animal !== 'healthy' && !shown && (
        <Note>
          Its fault is hidden. Watch it, decide what kind of thing could be wrong — a wiring fault shows on the panel and a chemistry fault does not — build your table, commit, then design a world that separates the ones you cannot tell apart. Then press <b>Reveal faults</b>.
        </Note>
      )}
      {s.animal !== 'healthy' && shown && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12.5, lineHeight: 1.5 }}>
          <div>
            <b>The fault.</b> {current.fault}
          </div>
          <div>
            <b>Where it lives:</b> {current.where === 'neither' ? 'neither — it is not broken' : `the ${current.where}`}
          </div>
          <div>
            <b>What is normal, and must be.</b> {current.normal}
          </div>
          <div>
            <b>How it separates.</b> {current.separates}
          </div>
          {s.animal === 'W0' && (
            <Note>
              Notice the shape of the reasoning: the diagnosis rests as much on the healthy chemistry as on the flipped switch. What is ruled out counts.
            </Note>
          )}
        </div>
      )}
      {s.revealed && (
        <Note>
          Every one of the five is the healthy animal with exactly one named thing changed; the full sets are in <code>src/sim/bilaterian/animals.ts</code>, healthy default alongside.
        </Note>
      )}
    </Panel>
  )

  return { left, right }
}
