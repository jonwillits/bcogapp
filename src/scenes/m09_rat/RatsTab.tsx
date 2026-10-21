import { Panel } from '../../components/Panel'
import { RATS, STRATEGIES, type RatId } from '../../sim/rodent/rats'
import { PATHS, type Apparatus } from '../../sim/rodent/lab'
import { Btn, Choice, Content, FixedLines, GroupLabel, Intro, Note, PANEL_STYLE, RIGHT_STYLE } from './ui'
import { PROGRAMMED_LINE } from './lines'
import { HIDDEN, type RatsStore } from './ratsStore'
import { useStore } from './useStore'

/**
 * Part 2's panels (spec §8). Left: the rat, the apparatus, the room, the
 * changes, Run the test, Skip ahead to the result, the counter, the
 * diagnosis menu and Commit my diagnoses. Right: the result as fixed
 * lines, the radiating paths' bar chart, and after the commit a Reveal per
 * rat. No hidden rat's strategy is in the markup before the commit.
 */

const APPARATUS: { id: Apparatus; label: string }[] = [
  { id: 'plus', label: 'The plus maze' },
  { id: 'water', label: 'The water maze' },
  { id: 'paths', label: 'The radiating paths' },
]

/** Part 2's orienting text, shown over the view until Begin. */
export const RATS_INTRO = {
  title: 'Part 2 — Places or Responses?',
  lines: [
    'You are the experimenter now. In the laboratory is a healthy rat, H. There are also five hidden rats, R1 to R5. H does what a rat does. It uses a map of the room, a route of turns, and a beacon it can head for, each when it is useful. Each hidden rat follows one programmed strategy, or has one of two kinds of damage, and your job is to find out which is which, by running experiments on it.',
    'There are three pieces of apparatus.',
    '- The plus maze: a rat is trained to go from the south arm, to food in the east arm. Then it is started from the north arm.',
    '- The water maze: a pool of cloudy water with a platform just under the surface, and starts around the rim.',
    '- The radiating paths: a rat is trained along a roundabout route to a food box. Then the route is blocked, and a fan of twelve paths is offered.',
    'Each can be run in a rich room, one with many other cues: a rack of cages, a window, a door and a poster in view. They can also be run in a plain enclosure, or with changes, such as the room’s cues rotated, the cues removed just before the choice, or in darkness.',
    'Drag on the view to orbit it, WASD to pan, the arrow keys to rotate, and the scroll wheel to zoom.',
    'Choose a rat, an apparatus, a room and any changes, then press “Run the test” to watch the trials play out, or “Skip ahead to the result”. The result lines on the right say what the rat did. When you can say what cues each hidden rat uses to find the food, choose a diagnosis for every one and press “Commit my diagnoses”. Only then does “Reveal” show what each one was.',
  ],
  content: [PROGRAMMED_LINE],
  time: 'About 22 minutes.',
}

/** Part 2's Controls info panel, opened from the button at the bottom right of the view and closed with its × (Jon's walk, 2026-10-20). */
export const RATS_CONTROLS = {
  title: 'Controls — Part 2',
  lines: [
    'The view. Drag on it to orbit the camera around the apparatus. Scroll to zoom in and out. W, A, S and D pan across the floor. The arrow keys rotate: left and right turn the camera around the apparatus, up and down tilt it. Keys are ignored while a control has focus; click on the view first.',
    'Rat. H is the healthy rat, explained in full on the right. R1 to R5 are the hidden rats; each follows one programmed strategy or has one of two kinds of damage.',
    'Apparatus. The plus maze, the water maze or the radiating paths. Each has a setting of its own: Training trials for the plus maze, Platform for the water maze, The lamp for the radiating paths.',
    'Room and changes. Rich room or plain enclosure. The changes: rotate the room’s cues 90° between training and test, remove the cues just before the choice, or darkness from the start or after setting off.',
    'Running a test. “Run the test” plays the trials on the apparatus, the current one in blue and the earlier ones in faint amber, with the result lines filling in when the run is over; “Skip ahead to the result” fills them at once. Tests run counts your tests. Changing any setting clears the last result.',
    'Diagnosis. A menu for each hidden rat; “Commit my diagnoses” once every rat has one; then “Reveal” beside each rat on the right.',
  ],
  footer: 'Close this panel with the × above or the button below the view.',
}

export function RatsLeft({ store, header }: { store: RatsStore; header: React.ReactNode }) {
  const s = useStore(store)
  const t = s.settings
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {header}
      <Panel title="Part 2 — Places or Responses?" style={PANEL_STYLE}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {!s.started && <Intro time={RATS_INTRO.time} onBegin={() => s.begin()} />}
          <GroupLabel>Rat</GroupLabel>
          <Choice value={s.rat} options={s.order.map((id) => ({ id, label: s.labels[id] }))} onChange={(id) => s.setRat(id as RatId)} />
          <Note>{s.rat === 'H' ? RATS[0].reveal : 'A hidden rat: it follows one programmed strategy. Run tests until you can say which.'}</Note>
          <Content>{PROGRAMMED_LINE}</Content>
          <GroupLabel>Apparatus</GroupLabel>
          <Choice value={t.apparatus} options={APPARATUS} onChange={(a) => s.set('apparatus', a)} />
          {t.apparatus === 'plus' && (
            <>
              <Note>Training from the south arm to food in the east arm; the probe starts from the north arm. Going to the place is place learning; repeating the turn is response learning.</Note>
              <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Training trials</span>
              <Choice value={String(t.training)} options={[4, 16, 64].map((n) => ({ id: String(n), label: String(n) }))} onChange={(v) => s.set('training', Number(v) as 4 | 16 | 64)} />
            </>
          )}
          {t.apparatus === 'water' && (
            <>
              <Note>A round pool of cloudy water. Starts vary around the rim. The probe removes the platform.</Note>
              <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Platform</span>
              <Choice value={t.platform} options={[{ id: 'hidden', label: 'hidden' }, { id: 'visible', label: 'visible, with a flag' }]} onChange={(v) => s.set('platform', v as 'hidden' | 'visible')} />
            </>
          )}
          {t.apparatus === 'paths' && (
            <>
              <Note>Training along the roundabout route; then the route is blocked and a fan of paths is offered. The lamp stands behind the old food box.</Note>
              <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>The lamp</span>
              <Choice value={t.lamp} options={[{ id: 'on', label: 'in place' }, { id: 'off', label: 'switched off' }, { id: 'moved', label: 'moved across the room' }]} onChange={(v) => s.set('lamp', v as 'on' | 'off' | 'moved')} />
            </>
          )}
          <GroupLabel>Room</GroupLabel>
          <Choice value={t.room} options={[{ id: 'rich', label: 'rich room' }, { id: 'plain', label: 'plain enclosure' }]} onChange={(v) => s.set('room', v as 'rich' | 'plain')} />
          <GroupLabel>Changes</GroupLabel>
          <label style={{ fontSize: 12, display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="checkbox" checked={t.rotateCues} onChange={(e) => s.set('rotateCues', e.target.checked)} /> Rotate the room’s cues 90° between training and test
          </label>
          <label style={{ fontSize: 12, display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="checkbox" checked={t.removeCues} onChange={(e) => s.set('removeCues', e.target.checked)} /> Remove the cues just before the choice
          </label>
          <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Darkness</span>
          <Choice value={t.darkness} options={[{ id: 'none', label: 'none' }, { id: 'fromStart', label: 'from the start' }, { id: 'afterStart', label: 'after setting off' }]} onChange={(v) => s.set('darkness', v as 'none' | 'fromStart' | 'afterStart')} />
          <GroupLabel>Run</GroupLabel>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <Btn primary onClick={() => s.run()}>
              Run the test
            </Btn>
            <Btn onClick={() => s.skipToResult()} disabled={!s.result || s.resultReady}>
              Skip ahead to the result
            </Btn>
          </div>
          <FixedLines lines={[`Tests run ${String(s.testsRun).padStart(3)}`, `Trials in a run ${String(t.trials).padStart(2)}`]} />
          <GroupLabel>Diagnosis</GroupLabel>
          {s.order.filter((id) => HIDDEN.includes(id)).map((id) => (
            <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
              <span style={{ width: 24, fontFamily: 'var(--font-mono)' }}>{s.labels[id]}</span>
              <select value={s.diagnoses[id] ?? ''} disabled={s.committed} onChange={(e) => s.diagnose(id, e.target.value as (typeof STRATEGIES)[number]['id'])} style={{ flex: 1, fontSize: 12, padding: 3, background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 6 }}>
                <option value="">— choose —</option>
                {STRATEGIES.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.label}
                  </option>
                ))}
              </select>
            </div>
          ))}
          <div>
            <Btn primary onClick={() => s.commit()} disabled={!s.canCommit}>
              Commit my diagnoses
            </Btn>
          </div>
          {!s.committed && <Note>“Commit my diagnoses” is available once every hidden rat has a diagnosis.</Note>}
        </div>
      </Panel>
    </div>
  )
}

export function RatsRight({ store }: { store: RatsStore }) {
  const s = useStore(store)
  const r = s.result
  return (
    <Panel title="Results" style={RIGHT_STYLE}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <GroupLabel>This test</GroupLabel>
        {!r && <Note>Run a test. The trials play out on the apparatus; the result lines fill in when the run is over, or after Skip ahead to the result.</Note>}
        {r && !s.resultReady && <FixedLines lines={[`Rat ${s.labels[r.rat]}`, `Trial ${Math.min(s.trialIndex + 1, r.trials.length)} of ${r.trials.length}${s.showingTraining ? ' (training route)' : ''}`, null, null]} />}
        {r && s.resultReady && (
          <>
            <FixedLines lines={[`Rat ${s.labels[r.rat]}`, ...r.lines]} testId="result-lines" />
            {r.pathCounts && <PathBars counts={r.pathCounts} />}
            {r.settings.apparatus === 'water' && (
              <FixedLines lines={r.trials.slice(r.trials.length - 1 - r.settings.trials, -1).map((t, i) => `Test trial ${String(i + 1).padStart(2)}: ${t.latency == null ? 'not found in 60 s' : `${(t.latency ?? 0).toFixed(1).padStart(5)} s`}`)} />
            )}
            {r.settings.apparatus === 'plus' && <FixedLines lines={r.trials.slice(-r.settings.trials).map((t, i) => `Probe trial ${String(i + 1).padStart(2)}: ${t.arm} arm`)} />}
          </>
        )}
        <GroupLabel>The rats</GroupLabel>
        {s.order.map((id) => RATS.find((x) => x.id === id)!).map((rat) => (
          <div key={rat.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }} data-rat={rat.id}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12 }}>
              <span style={{ fontFamily: 'var(--font-mono)', width: 24 }}>{s.labels[rat.id]}</span>
              {rat.hidden ? (
                s.committed ? (
                  <Btn small onClick={() => s.reveal(rat.id)}>
                    {s.revealed.has(rat.id) ? 'Revealed' : 'Reveal'}
                  </Btn>
                ) : (
                  <span style={{ color: 'var(--text-muted)' }}>hidden until the commit</span>
                )
              ) : (
                <span style={{ color: 'var(--text-muted)' }}>healthy, explained in full</span>
              )}
            </div>
            {(!rat.hidden || s.revealed.has(rat.id)) && (
              <div data-revealed={rat.id}>
                <Note style={{ paddingLeft: 32 }}>
                  {rat.hidden ? `${STRATEGIES.find((st) => st.id === rat.strategy)?.label}. ` : ''}
                  {rat.reveal}
                  {rat.hidden && s.diagnoses[rat.id] ? ` You said: ${STRATEGIES.find((st) => st.id === s.diagnoses[rat.id])?.label}.` : ''}
                </Note>
              </div>
            )}
          </div>
        ))}
      </div>
    </Panel>
  )
}

/** The radiating paths' bar chart, in the layout of the chapter's figure: path 1 at the left. */
function PathBars({ counts }: { counts: number[] }) {
  const w = 300
  const h = 110
  const max = Math.max(1, ...counts)
  const bw = (w - 30) / 12
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block', background: 'var(--bg)', borderRadius: 8 }} role="img" aria-label="rats choosing each path" data-path-bars>
      {counts.map((c, i) => {
        const bh = (c / max) * (h - 36)
        return (
          <g key={i}>
            <rect x={20 + i * bw + 2} y={h - 22 - bh} width={bw - 4} height={bh} fill={i + 1 === PATHS.goalPath ? 'var(--sensor)' : 'var(--accent)'} />
            <text x={20 + i * bw + bw / 2} y={h - 8} fontSize={9} textAnchor="middle" fill="var(--text-muted)">
              {i + 1}
            </text>
            {c > 0 && (
              <text x={20 + i * bw + bw / 2} y={h - 26 - bh} fontSize={9} textAnchor="middle" fill="var(--text)">
                {c}
              </text>
            )}
          </g>
        )
      })}
      <text x={w - 4} y={12} fontSize={9} textAnchor="end" fill="var(--text-muted)">
        path 6 is nearest the old food box
      </text>
    </svg>
  )
}
