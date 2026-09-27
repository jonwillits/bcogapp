import { useState, type ReactNode } from 'react'
import { BrainLayout } from './layout'
import { Panel } from '../../components/Panel'
import {
  Bench,
  TASKS,
  ROUTES,
  REMOVE_MENU,
  STIMULATE_MENU,
  MENU_LINE,
  NO_FEELING_LINE,
  READOUTS_LINE,
  SCHEMATIC_NUMBERS_LINE,
  LEVEL_LINE,
  REVERSE_INFERENCE_LINE,
  KIND_LABEL,
  type TaskId,
  type TestResult,
  type StimulateResult,
  type RemoveResult,
  type Removable,
  type Stimulable,
  type Route,
  type RecordCell,
  type Level,
} from '../../sim/brain/bench'
import { species, STRUCTURES, labelIn, type StructureId } from '../../sim/brain/structures'
import { BrainModel } from './BrainModel'
import { Btn, Choice, Claims, GroupLabel, KindBadge, Note, StageTitle, PANEL_STYLE, RIGHT_STYLE } from './ui'
import { DoyaTable } from './DoyaTable'

/**
 * Part 2: an address is not an account. One generic mammal, six tasks, four
 * tools, and a result labeled with where it comes from. The bench object
 * holds the map (`sim/brain/bench.ts`); this tab only wires the controls
 * and prints what it returns.
 */

export interface BenchUi {
  bench: Bench
  bump: () => void
}

const MAMMAL = species('mammal')

const TOOL_LINES = {
  record: 'Recording electrodes and brain imaging. Activity in each structure during a task. Correlational.',
  remove: 'Lesions, and neuropsychology in human patients. What a task still needs. Necessity.',
  stimulate: 'Electrical stimulation. What a structure can produce by itself. Sufficiency.',
  silence: 'Targeted silencing of one route, during training only. Which learning depends on one signal reaching its target. The route is restored before Test.',
}

export function BenchTab({ bench, bump, header }: BenchUi & { header?: ReactNode }) {
  const [taskId, setTaskId] = useState<TaskId>('orient')
  const [last, setLast] = useState<TestResult | null>(null)
  const [stim, setStim] = useState<StimulateResult | null>(null)
  const [removeMsg, setRemoveMsg] = useState<RemoveResult | null>(null)
  const [recorded, setRecorded] = useState<{ task: TaskId; cells: RecordCell[] } | null>(null)
  const [stimTarget, setStimTarget] = useState<Stimulable>('periaqueductalGray')
  const [point, setPoint] = useState(0.5)
  const [selected, setSelected] = useState<StructureId | null>(null)

  const t = TASKS.find((x) => x.id === taskId)!
  const trainedUnder = bench.trainedUnder[taskId]

  const removedStructures: StructureId[] = bench.removed ? [bench.removed === 'pallium' ? 'pallium' : bench.removed === 'dopamineClusters' ? 'dopamineClusters' : 'amygdala'] : []

  const doTest = () => {
    setLast(bench.test(taskId))
    setStim(null)
    bump()
  }
  const doTrain = () => {
    bench.train(taskId)
    setLast(null)
    bump()
  }
  const doRecord = () => {
    setRecorded({ task: taskId, cells: bench.record(taskId) })
    bump()
  }
  const doRemove = (r: Removable) => {
    setRemoveMsg(bench.remove(r))
    setLast(null)
    bump()
  }
  const doRestore = () => {
    bench.restore()
    setRemoveMsg(null)
    setLast(null)
    bump()
  }
  const doStimulate = () => {
    setStim(bench.stimulate(stimTarget, { task: taskId, point }))
    setLast(null)
    bump()
  }
  const setSilence = (r: Route | 'none') => {
    bench.silence = r === 'none' ? null : r
    bump()
  }

  const stimulatedStructure: StructureId | null = stim ? (stim.target === 'tectum' ? 'tectum' : stim.target === 'periaqueductalGray' ? 'periaqueductalGray' : 'dopamineClusters') : null

  return (
    <BrainLayout
      header={header}
      left={
      <Panel title="The bench" style={PANEL_STYLE}>
        <Note>
          One generic mammal, not a named species. A result that comes from a particular experiment names the animal it was found in.
        </Note>

        <GroupLabel>Task</GroupLabel>
        <Choice value={taskId} options={TASKS.map((x) => ({ id: x.id, label: x.label }))} onChange={(id) => { setTaskId(id); setLast(null); setStim(null) }} />
        <Note>
          <b>{t.label}.</b> {t.what} <i>Measured:</i> {t.measured}
        </Note>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {t.learned && <Btn onClick={doTrain}>Train</Btn>}
          <Btn onClick={doTest} primary>
            {t.learned ? 'Test' : 'Run'}
          </Btn>
          {t.learned && trainedUnder !== null && (
            <Btn small onClick={() => { bench.untrain(taskId); setLast(null); bump() }}>
              Clear training
            </Btn>
          )}
          {t.learned && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {trainedUnder === null ? 'untrained' : trainedUnder === 'none' ? 'trained' : `trained with the ${ROUTES.find((r) => r.id === trainedUnder)!.label} silenced`}
            </span>
          )}
        </div>
        {t.learned && <Note>Training is instantaneous. Nothing here asks you to wait.</Note>}

        <GroupLabel>Record</GroupLabel>
        <Note>{TOOL_LINES.record}</Note>
        <Btn onClick={doRecord}>Record during {t.label}</Btn>

        <GroupLabel>Remove</GroupLabel>
        <Note>{TOOL_LINES.remove}</Note>
        <Choice
          value={bench.removed}
          options={REMOVE_MENU.map((m) => ({ id: m.id, label: m.label }))}
          onChange={(id) => doRemove(id)}
        />
        {bench.removed && (
          <Btn small onClick={doRestore}>
            Restore {REMOVE_MENU.find((m) => m.id === bench.removed)!.label}
          </Btn>
        )}
        {removeMsg && !removeMsg.ok && (
          <div style={{ fontSize: 12, padding: '6px 8px', borderRadius: 6, border: '1px solid #f87171', color: '#f87171' }}>
            {removeMsg.text} <Claims ids={removeMsg.claims} />
          </div>
        )}
        <Note>{MENU_LINE}</Note>

        <GroupLabel>Stimulate</GroupLabel>
        <Note>{TOOL_LINES.stimulate}</Note>
        <Choice value={stimTarget} options={STIMULATE_MENU.map((m) => ({ id: m.id, label: m.label }))} onChange={setStimTarget} />
        {stimTarget === 'tectum' && (
          <label style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span>
              Point on the tectum: <span style={{ fontFamily: 'var(--font-mono)' }}>{point.toFixed(2)}</span> (0 one end, 1 the other)
            </span>
            <input type="range" min={0} max={1} step={0.05} value={point} onChange={(e) => setPoint(Number(e.target.value))} style={{ accentColor: 'var(--accent)' }} />
          </label>
        )}
        <Btn onClick={doStimulate}>Stimulate</Btn>
        <Note>{MENU_LINE}</Note>

        <GroupLabel>Silence a pathway during training</GroupLabel>
        <Note>{TOOL_LINES.silence}</Note>
        <Choice
          value={bench.silence ?? 'none'}
          options={[{ id: 'none' as const, label: 'nothing silenced' }, ...ROUTES.map((r) => ({ id: r.id, label: `${r.label} ${r.to}` }))]}
          onChange={setSilence}
        />
        <Note>Set this, then press Train. The route is restored before Test.</Note>

        <GroupLabel>What the bench reads out</GroupLabel>
        <Note>{READOUTS_LINE}</Note>
        <Note>
          <b>{NO_FEELING_LINE}</b>
        </Note>
      </Panel>
      }
      stage={
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 760, margin: '0 auto' }}>
        <StageTitle sub="Nothing here is a simulated body. Every result is labeled with where it comes from.">Part 2 — An address is not an account</StageTitle>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 150px', gap: 12, alignItems: 'start' }}>
          <BrainModel species={MAMMAL} selected={selected} onSelect={setSelected} removed={removedStructures} stimulated={stimulatedStructure} stimulatedPoint={point} />
          <Silhouette movement={last?.movement ?? 'normal'} direction={stim?.target === 'tectum' ? stim.direction ?? 0 : null} />
        </div>
        {selected && <StructureLine id={selected} />}
        {last && <ResultCard r={last} />}
        {stim && <StimCard r={stim} />}
        {!last && !stim && (
          <Note>Choose a task and press {t.learned ? 'Train, then Test' : 'Run'}. Then take the animal apart with Remove, Stimulate and Silence, and watch what each result is labeled.</Note>
        )}
        <RunRecord bench={bench} task={taskId} />
        <Note>{SCHEMATIC_NUMBERS_LINE}</Note>
      </div>
      }
      right={
      <Panel title="Recordings and notes" style={RIGHT_STYLE}>
        {recorded ? <RecordTable rec={recorded} /> : <Note>Press <b>Record</b> during a task to see activity in every structure.</Note>}
        <GroupLabel>Doya’s table — fill it in yourself</GroupLabel>
        <DoyaTable />
      </Panel>
      }
    />
  )
}

function StructureLine({ id }: { id: StructureId }) {
  const s = STRUCTURES.find((x) => x.id === id)!
  return (
    <div style={{ fontSize: 12, padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)' }}>
      <b>{labelIn(s, MAMMAL)}.</b> {s.description} {s.namedNotSpent && <i>{s.namedNotSpent}</i>} <Claims ids={s.claims} />
    </div>
  )
}

function ResultCard({ r }: { r: TestResult }) {
  const t = TASKS.find((x) => x.id === r.task)!
  const grey = r.kind === 'notReported'
  return (
    <div data-result-kind={r.kind} style={{ padding: '10px 12px', borderRadius: 10, border: `1px solid ${grey ? '#2a3446' : 'var(--border)'}`, background: grey ? '#161b26' : 'var(--surface)', color: grey ? 'var(--text-muted)' : 'var(--text)' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <b>{t.label}</b>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.under}{r.trainedUnder && r.trainedUnder !== 'none' ? ` · trained with the ${ROUTES.find((x) => x.id === r.trainedUnder)!.label} silenced` : r.trainedUnder === 'none' ? ' · trained' : t.learned ? ' · untrained' : ''}</span>
        <span style={{ flex: 1 }} />
        <KindBadge kind={r.kind} claims={r.kind === 'follows' ? r.claims : undefined} />
      </div>
      <p style={{ margin: '6px 0', fontSize: 13 }}>{r.text}</p>
      {r.movement && (
        <div style={{ fontSize: 12 }}>
          <span style={{ color: 'var(--text-muted)' }}>movement: </span>
          <b style={{ color: r.movement === 'slow' ? '#f87171' : '#34d399' }}>{r.movement}</b>
        </div>
      )}
      {r.readouts.map((ro) => (
        <div key={ro.label} style={{ fontSize: 12, display: 'flex', justifyContent: 'space-between', gap: 10 }}>
          <span style={{ color: 'var(--text-muted)' }}>{ro.label}</span>
          <span style={{ fontFamily: 'var(--font-mono)' }}>{ro.value ?? 'not scorable'}</span>
        </div>
      ))}
      {!grey && (
        <div style={{ marginTop: 6, fontSize: 11.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {r.kind === 'reported' && <span><span style={{ color: 'var(--text-muted)' }}>claim: </span><Claims ids={r.claims} /></span>}
          {r.speciesNote && <span><span style={{ color: 'var(--text-muted)' }}>found in: </span>{r.speciesNote}</span>}
          {r.note && <span style={{ color: 'var(--text-muted)' }}>{r.note}</span>}
        </div>
      )}
    </div>
  )
}

function StimCard({ r }: { r: StimulateResult }) {
  const grey = r.kind === 'notReported'
  const label = STIMULATE_MENU.find((m) => m.id === r.target)!.label
  return (
    <div data-result-kind={r.kind} style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', background: grey ? '#161b26' : 'var(--surface)', color: grey ? 'var(--text-muted)' : 'var(--text)' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <b>Stimulate {label}</b>
        {r.point !== undefined && <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>point {r.point.toFixed(2)}</span>}
        <span style={{ flex: 1 }} />
        <KindBadge kind={r.kind} claims={r.kind === 'follows' ? r.claims : undefined} />
      </div>
      <p style={{ margin: '6px 0', fontSize: 13 }}>{r.text}</p>
      {!grey && (
        <div style={{ fontSize: 11.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {r.kind === 'reported' && <span><span style={{ color: 'var(--text-muted)' }}>claim: </span><Claims ids={r.claims} /></span>}
          {r.speciesNote && <span><span style={{ color: 'var(--text-muted)' }}>found in: </span>{r.speciesNote}</span>}
        </div>
      )}
    </div>
  )
}

function RunRecord({ bench, task }: { bench: Bench; task: TaskId }) {
  const runs = bench.runs[task]
  if (!runs.length) return null
  return (
    <div style={{ fontSize: 11.5 }}>
      <GroupLabel>The last few runs — {TASKS.find((x) => x.id === task)!.label}</GroupLabel>
      {runs.map((r, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, padding: '2px 0', color: 'var(--text-muted)' }}>
          <span style={{ width: 40, fontWeight: 600, color: 'var(--text)' }}>{r.what}</span>
          <span style={{ width: 150 }}>{r.under}</span>
          <span>{r.summary}</span>
        </div>
      ))}
    </div>
  )
}

const LEVEL_W: Record<Level, number> = { none: 0, low: 1, moderate: 2, high: 3 }

function RecordTable({ rec }: { rec: { task: TaskId; cells: RecordCell[] } }) {
  const t = TASKS.find((x) => x.id === rec.task)!
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <GroupLabel>Recording during {t.label}</GroupLabel>
      <Note>{LEVEL_LINE} Every non-grey cell follows from a stated function; none is an experiment the chapter reports. A grey cell is not an inactive structure.</Note>
      <Note>
        <b>{REVERSE_INFERENCE_LINE}</b> <Claims ids={['§6.2.1-C5']} />
      </Note>
      <table style={{ borderCollapse: 'collapse', fontSize: 11.5, width: '100%' }}>
        <tbody>
          {rec.cells.map((c) => (
            <tr key={c.structure} data-record-kind={c.kind} style={{ borderTop: '1px solid var(--border)', color: c.level === null ? 'var(--text-muted)' : 'var(--text)' }}>
              <td style={{ padding: '3px 4px 3px 0', width: '46%' }}>{c.label}</td>
              <td style={{ padding: '3px 0', width: 62 }}>
                {c.level === null ? (
                  <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{KIND_LABEL.notReported}</span>
                ) : (
                  <span style={{ display: 'inline-flex', gap: 2 }} title={c.level}>
                    {[1, 2, 3].map((i) => (
                      <span key={i} style={{ width: 12, height: 10, borderRadius: 2, background: i <= LEVEL_W[c.level!] ? '#f0a94b' : 'var(--surface-2)', border: '1px solid var(--border)' }} />
                    ))}
                  </span>
                )}
              </td>
              <td style={{ padding: '3px 0 3px 6px', fontSize: 10.5 }}>
                {c.level === null ? (
                  <span style={{ color: 'var(--text-muted)' }}>{c.note ?? ''}</span>
                ) : (
                  <>
                    <div>{c.level}</div>
                    <Claims ids={c.claims} />
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rec.cells.filter((c) => c.shift).map((c) => (
        <div key={c.structure} style={{ fontSize: 11.5, padding: '6px 8px', borderRadius: 6, border: '1px dashed #f472b6' }}>
          <b>{c.label} across training.</b> Early: {c.shift!.early}. Late: {c.shift!.late}. <span style={{ color: 'var(--text-muted)' }}>{c.crossRef}</span>
        </div>
      ))}
      {rec.cells.filter((c) => c.level !== null && c.note && !c.shift).map((c) => (
        <Note key={c.structure}>
          <b>{c.label}:</b> {c.note}
        </Note>
      ))}
    </div>
  )
}

/**
 * A schematic silhouette with two readouts drawn on it: how it moves, and
 * where it has turned. It is not a species and not a body; it is a diagram.
 */
function Silhouette({ movement, direction }: { movement: 'normal' | 'slow' | null; direction: number | null }) {
  const slow = movement === 'slow'
  const turn = direction ?? 0
  return (
    <svg viewBox="0 0 150 130" width="100%" role="img" aria-label="a generic mammal, schematic">
      <g fill={slow ? '#6b7280' : '#9aa6b8'} stroke="#c9d2df" strokeWidth={1}>
        <ellipse cx={80} cy={70} rx={38} ry={20} />
        <rect x={52} y={84} width={8} height={26} rx={3} />
        <rect x={66} y={86} width={8} height={26} rx={3} />
        <rect x={92} y={86} width={8} height={26} rx={3} />
        <rect x={104} y={84} width={8} height={26} rx={3} />
        <path d="M 116 62 q 18 -10 22 4" fill="none" strokeWidth={3} />
        <g transform={`translate(44 58) rotate(${turn / 3})`}>
          <ellipse cx={0} cy={0} rx={16} ry={12} />
          <circle cx={-10} cy={-3} r={2} fill="#0e1420" stroke="none" />
          <path d="M -4 -11 l 4 -8 l 4 8" />
        </g>
      </g>
      <text x={75} y={124} fontSize={9.5} fill="#9aa6b8" textAnchor="middle">
        {slow ? 'movement: slow, hard to start' : direction !== null ? `turned ${Math.abs(turn)}° ${turn < 0 ? 'left' : turn > 0 ? 'right' : ''}`.trim() : 'a generic mammal'}
      </text>
    </svg>
  )
}
