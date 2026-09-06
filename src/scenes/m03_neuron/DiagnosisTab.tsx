import { Panel } from '../../components/Panel'
import { Toggle } from '../../components/controls'
import { DIAGNOSTIC_CELLS } from '../../sim/neuron/cells'
import { TabBar, Note, PANEL_STYLE, RIGHT_STYLE, DIAGNOSTIC_WARM_UP_S, type SceneState, type LoadedCell } from './NeuronScene'

/**
 * The Diagnosis tab: five cells, N0 explained, N1–N4 hidden until the student
 * has committed. Loading one replaces the vehicle, its cell and its world;
 * the other three tabs then show that cell.
 */
export function DiagnosisTab(s: SceneState) {
  const cells: LoadedCell[] = ['healthy', 'N0', 'N1', 'N2', 'N3', 'N4']
  const current = DIAGNOSTIC_CELLS.find((c) => c.id === s.loaded)

  const left = (
    <Panel title="Diagnosis" style={PANEL_STYLE}>
      <TabBar tab={s.tab} onChange={s.setTab} />
      <Note>
        Four vehicles, N1 to N4, are all bad at finding light, and bad at it in ways that look
        the same from outside. Each has a different thing wrong with it, and one has nothing
        wrong with it at all. N0 is a worked example. Load one; the other three tabs then show
        that vehicle's cell.
      </Note>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
        {cells.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => s.load(c)}
            style={{
              padding: '7px 0',
              fontSize: 13,
              fontFamily: 'var(--font-mono)',
              fontWeight: 600,
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
              cursor: 'pointer',
              background: s.loaded === c ? 'var(--accent)' : 'transparent',
              color: s.loaded === c ? '#0b111c' : 'var(--text)',
            }}
          >
            {c}
          </button>
        ))}
      </div>
      <Note>
        Each cell loads with its own world, already {DIAGNOSTIC_WARM_UP_S} seconds into its run, so
        what you see is how it drives once it has been driving for a while. Reset replays the same
        run from that point.
      </Note>
      <Toggle label="Reveal faults" checked={s.revealed} onChange={s.setRevealed} />
    </Panel>
  )

  const shown = current && (current.id === 'N0' || s.revealed)

  const right = (
    <Panel title={s.loaded === 'healthy' ? 'Healthy cell' : `Cell ${s.loaded}`} style={RIGHT_STYLE}>
      {s.loaded === 'healthy' && (
        <Note>
          The default: every parameter at its healthy value, in the fast world. Everything the
          four cells are compared against.
        </Note>
      )}
      {current && !shown && (
        <Note>
          Its fault is hidden. Watch it in the World tab, decide which tab to open first and why,
          commit to a diagnosis, then design a test for the ones you cannot separate. Things you
          can change: how fast the lights move, how many there are, how long the vehicle has to
          keep working, and the body size. Then press <b>Reveal faults</b>.
        </Note>
      )}
      {current && shown && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12.5, lineHeight: 1.5 }}>
          <div>
            <b>The fault.</b> {current.fault}
          </div>
          <div>
            <b>Level:</b>{' '}
            {current.level === 'none' ? 'none — it is not broken' : `${current.level}`}
          </div>
          <div>
            <b>What is normal, and must be.</b> {current.normal}
          </div>
          {current.id === 'N0' && (
            <Note>
              Notice the shape of the reasoning: the diagnosis rests as much on the healthy
              membrane as on the odd arithmetic. What is ruled out counts.
            </Note>
          )}
        </div>
      )}
      {s.revealed && (
        <Note>
          Every one of the five is the healthy cell with exactly one named parameter changed; the
          full parameter sets are in <code>src/sim/neuron/cells.ts</code>, healthy default
          alongside.
        </Note>
      )}
    </Panel>
  )

  return { left, right }
}
