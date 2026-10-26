import { Panel } from '../../components/Panel'
import { Section } from '../../components/Section'
import type { ProgressStore } from '../../sim/memory/progress/store'
import { FORAGERS, foragerById, foragerTable, type ForagerBlock, type ForagerId } from '../../sim/memory/foragers/foragers'
import { SEPARATIONS, SEPARATION_SETTING, type Separation } from '../../sim/memory/foragers/store'
import { differentiation } from '../../sim/memory/foragers/slow'
import { BLOCK_LABEL } from '../../sim/memory/logs/features'
import { tallies, type NightTallies } from '../../sim/memory/logs/night'
import type { StudentNights } from '../../sim/memory/logs/results'
import { Btn, Choice, Content, FixedLines, GroupLabel, Note, PANEL_STYLE, PART_TITLES, RIGHT_STYLE, StagePanel, useStore } from './ui'
import { InstructionScreen } from './progress/InstructionScreen'
import { RATS_LINE, SAMPLE_NIGHTS_LINE, PROGRAMS_LINE, SEPARATION_LINE, STRENGTH_LINE, PASS_BACK_LINE, DAMAGE_LINE } from './lines'
import type { PartModule } from './contract'
import { LearnersStore, NOISES, YOUTH_SNAPSHOTS } from './learners/store'
import { STEPS, TABLE_CHOICES, TABLE_COLUMNS, TABLE_ROWS, type Step } from './learners/steps'
import { clearingOf, perMinute, studentRecord, studentTable, studentTallies } from './learners/nights'
import { Diagram } from './learners/Diagram'
import { ClearingOverhead, OVERHEAD_LEGEND } from './learners/Overhead'
import { ConfusionTableView, RetrievalBars, SimilarityMatrix, StoredNights } from './learners/StorePanels'
import { HiddenSnapshots, SeasonPlot } from './learners/HiddenSpace'
import { PropertyTable, TABLE_LEGEND } from './learners/PropertyTable'

/**
 * Part 5's panels (spec §9): the left column runs the step (the chips, the
 * instruction screen's Begin with Go back and Go to, the predictions and
 * Commit my prediction, the step's controls, Go on and Redo); the stage
 * carries the step's panels once its predictions are committed; the right
 * column carries the diagram, the content lines, and the student's own
 * totals. Every forager, store and network is named and explained, never
 * hidden (§9.2).
 */

type Ctx = { store: LearnersStore; header: React.ReactNode; progress: ProgressStore; seed: number }

/** The button that opens Part 5 without the student's nights (§4.3). The shell mounts it on Part 5's lock screen. */
export function UseSampleButton({ progress }: { progress: ProgressStore }) {
  const p = useStore(progress)
  if (p.state.sampleNights || p.partComplete(4)) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }} data-use-sample>
      <Note>For a student whose saved nights are lost: Part 5 can run on a recorded set of nights played by someone else.</Note>
      <div>
        <Btn onClick={() => p.useSampleNights()}>Use a sample set of nights</Btn>
      </div>
    </div>
  )
}

const SHORT_LABELS: [keyof NightTallies | 'perMinute', string][] = [
  ['beetles', 'Beetles eaten'],
  ['digsAtFull', 'Digs at full logs'],
  ['digsAtEmptiedLastNight', 'Digs at logs emptied last night'],
  ['passedOverRefilled', 'Refilled logs passed over (night 3)'],
  ['repeatsBeforeCall', 'Repeat digs, before the call'],
  ['repeatsAfterCall', 'Repeat digs, after the call'],
  ['digsAtSmooth', 'Digs at smooth logs'],
  ['perMinute', 'Beetles per minute'],
]
const LABEL_W = 36
const COL_W = 9

function Left({ ctx }: { ctx: Ctx }) {
  const s = useStore(ctx.store)
  const nights = s.nights()
  const spec = s.spec
  return (
    <>
      {ctx.header}
      <Panel title={PART_TITLES.learners} style={PANEL_STYLE}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Content>{RATS_LINE}</Content>
          {nights?.sample && <Content>{SAMPLE_NIGHTS_LINE}</Content>}
          {!nights && <UseSampleButton progress={ctx.progress} />}
          <GroupLabel>Step</GroupLabel>
          <Choice value={String(s.step)} options={STEPS.map((st) => ({ id: String(st.step), label: `Step ${st.step}`, title: st.title }))} onChange={(v) => s.open(Number(v) as Step)} />
          <Note>{spec.title}</Note>
          {s.state === 'intro' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} data-intro>
              <Note>What will happen is described over the view.</Note>
              <Content>{`About ${spec.minutes} minutes. You can leave and come back at any time.`}</Content>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <Btn primary onClick={() => s.begin()} disabled={!nights}>
                  Begin
                </Btn>
                {s.step > 1 && <Btn onClick={() => s.open((s.step - 1) as Step)}>Go back to Step {s.step - 1}</Btn>}
                {s.step < 4 && <Btn onClick={() => s.open((s.step + 1) as Step)}>Go to Step {s.step + 1}</Btn>}
              </div>
            </div>
          )}
          {s.state === 'predict' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} data-predict>
              <GroupLabel>Predict first</GroupLabel>
              {spec.predictions.map((p) => (
                <div key={p.key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <Note>{p.question}</Note>
                  {s.prediction(p.key) ? <FixedLines lines={[`Committed: ${s.prediction(p.key)}`]} mono={false} /> : <Choice value={s.drafts[p.key] ?? null} options={p.choices.map((c) => ({ id: c, label: c }))} onChange={(c) => s.choose(p.key, c)} />}
                </div>
              ))}
              <div>
                <Btn primary onClick={() => s.commitPredictions()} disabled={!s.canCommit()}>
                  Commit my prediction
                </Btn>
              </div>
            </div>
          )}
          {(s.state === 'running' || s.state === 'done') && (
            <>
              <FixedLines lines={spec.predictions.map((p) => `Your prediction: ${s.prediction(p.key) ?? '—'}`)} mono={false} />
              {s.step === 1 && <Step1Controls s={s} />}
              {s.step === 2 && <Step2Controls s={s} />}
              {s.step === 3 && <Step3Controls s={s} />}
              {s.step === 4 && <Step4Controls s={s} />}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {s.state === 'running' && (
                  <Btn onClick={() => s.finish()}>{s.step < 4 ? `Go on to Step ${s.step + 1}` : 'Finish Part 5'}</Btn>
                )}
                {s.state === 'done' && s.step < 4 && <Btn onClick={() => s.open((s.step + 1) as Step)}>Go on to Step {s.step + 1}</Btn>}
                {s.state === 'done' && <Btn onClick={() => s.redo()}>Redo Step {s.step}</Btn>}
              </div>
            </>
          )}
        </div>
      </Panel>
    </>
  )
}

function Step1Controls({ s }: { s: LearnersStore }) {
  const nights = s.nights()!
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <GroupLabel>The foragers</GroupLabel>
      <div>
        <Btn primary onClick={() => s.runForagers()} disabled={s.running || !!s.foragerRuns}>
          Run the foragers
        </Btn>
      </div>
      {s.foragerRuns && (
        <>
          <GroupLabel>Replay</GroupLabel>
          <Note>Whose night, which block, which night: the overhead on the stage shows it beside yours.</Note>
          <Choice value={s.replay.who} options={[{ id: 'you', label: 'You' }, ...FORAGERS.map((f) => ({ id: f.id, label: f.label }))]} onChange={(v) => s.setReplay({ who: v as 'you' | ForagerId })} />
          <Choice value={String(s.replay.block)} options={[0, 1].map((b) => ({ id: String(b), label: `${BLOCK_LABEL[nights.blocks[b].plan.kind]}` }))} onChange={(v) => s.setReplay({ block: Number(v) as 0 | 1 })} />
          <Choice value={String(s.replay.night)} options={[1, 2, 3].map((n) => ({ id: String(n), label: `night ${n}` }))} onChange={(v) => s.setReplay({ night: Number(v) as 1 | 2 | 3 })} />
        </>
      )}
    </div>
  )
}

function Step2Controls({ s }: { s: LearnersStore }) {
  const nights = s.nights()!
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <GroupLabel>How separate the codes are</GroupLabel>
      <Choice value={s.separation} options={SEPARATIONS.map((sep) => ({ id: sep, label: sep, title: SEPARATION_SETTING[sep].label }))} onChange={(v) => s.setSeparation(v as Separation)} />
      <Note>{SEPARATION_SETTING[s.separation].label}.</Note>
      <div>
        <Btn primary onClick={() => s.runStore()} disabled={s.running || !!s.storeRuns.strong}>
          Run the store at every setting
        </Btn>
      </div>
      {s.storeRuns[s.separation] && (
        <>
          <GroupLabel>The cue</GroupLabel>
          <Note>Which block and which night to cue the store for: the panels show that night’s retrieval of last night.</Note>
          <Choice value={String(s.cue.block)} options={[0, 1].map((b) => ({ id: String(b), label: BLOCK_LABEL[nights.blocks[b].plan.kind] }))} onChange={(v) => s.setCue({ block: Number(v) as 0 | 1 })} />
          <Choice value={String(s.cue.night)} options={[2, 3].map((n) => ({ id: String(n), label: `night ${n}` }))} onChange={(v) => s.setCue({ night: Number(v) as 2 | 3 })} />
        </>
      )}
    </div>
  )
}

function Step3Controls({ s }: { s: LearnersStore }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <GroupLabel>The youth</GroupLabel>
      <div>
        <Btn primary onClick={() => s.skipYouth()} disabled={s.running}>
          Skip ahead through the youth
        </Btn>
      </div>
      <FixedLines lines={[`${'Passes of the youth so far'.padEnd(30)}${String(s.youthPass).padStart(5)}`]} />
      <GroupLabel>A new season</GroupLabel>
      <Note>An acorn tree and a weasel join the range. Train the slow learner on them with the fast store’s replay off, then with it on.</Note>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <Btn onClick={() => s.trainSeason('off')} disabled={s.running}>
          Train on the new season, replay off
        </Btn>
        <Btn onClick={() => s.trainSeason('on')} disabled={s.running}>
          Train on the new season, replay on
        </Btn>
      </div>
    </div>
  )
}

function Step4Controls({ s }: { s: LearnersStore }) {
  const committed = s.tableCommitted
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <GroupLabel>Remove the fast store</GroupLabel>
      <div>
        <Btn primary onClick={() => s.removeStore()} disabled={s.running || !!s.noStoreRuns}>
          Remove the fast store
        </Btn>
      </div>
      <GroupLabel>Damage the slow learner</GroupLabel>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 12 }}>
        <span style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--text-muted)' }}>Noise on the hidden units</span>
          <span style={{ fontFamily: 'var(--font-mono)' }}>{s.noise.toFixed(2)}</span>
        </span>
        <input type="range" min={0} max={NOISES.length - 1} step={1} value={NOISES.indexOf(s.noise)} onChange={(e) => s.setNoise(NOISES[Number(e.target.value)])} aria-label="Noise on the hidden units" />
      </label>
      <div>
        <Btn onClick={() => s.runDamaged()} disabled={s.running || s.noise === 0}>
          Run Tonight too with the damaged slow learner
        </Btn>
      </div>
      <GroupLabel>The two-by-two table</GroupLabel>
      <Note>For each kind of damage, does each error rise or stay low? Fill the four cells, then commit.</Note>
      {TABLE_ROWS.map((r) =>
        TABLE_COLUMNS.map((c) => (
          <div key={`${r}|${c}`} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Note>
              {r}: {c}
            </Note>
            {committed ? <FixedLines lines={[committedCell(committed, r, c)]} mono={false} /> : <Choice value={s.tableDraft[`${r}|${c}`] ?? null} options={TABLE_CHOICES.map((x) => ({ id: x, label: x }))} onChange={(v) => s.chooseCell(r, c, v)} />}
          </div>
        )),
      )}
      {!committed && (
        <div>
          <Btn primary onClick={() => s.commitTable()} disabled={!s.tableComplete}>
            Commit my table
          </Btn>
        </div>
      )}
    </div>
  )
}

function committedCell(committed: string, r: string, c: string): string {
  const rows = committed.split('||').map((x) => x.split('|'))
  const i = TABLE_ROWS.indexOf(r as (typeof TABLE_ROWS)[number])
  const j = TABLE_COLUMNS.indexOf(c as (typeof TABLE_COLUMNS)[number])
  return `You said: ${rows[i]?.[j] ?? '—'}`
}

function Stage({ ctx }: { ctx: Ctx }) {
  const s = useStore(ctx.store)
  const spec = s.spec
  const nights = s.nights()
  if (s.state === 'intro') {
    return <InstructionScreen title={spec.title} willDo={[spec.reread, ...spec.willDo]} minutes={spec.minutes} sitting="leave any time" content={spec.content} onBegin={() => s.begin()} disabled={!nights} />
  }
  if (s.state === 'predict') {
    return (
      <StagePanel testId="predict">
        <div style={{ fontSize: 14, fontWeight: 600 }}>{spec.title}</div>
        <Note>{spec.reread}</Note>
        <Note>Choose a prediction on the left and press “Commit my prediction”. Nothing runs until then.</Note>
        <Diagram step={s.step} />
      </StagePanel>
    )
  }
  if (!nights) return null
  return (
    <StagePanel wide testId={`step-${s.step}`}>
      {s.badge && <div style={{ padding: '4px 10px', borderRadius: 999, background: 'var(--surface-2)', border: '1px solid var(--border)', fontSize: 12, alignSelf: 'center' }}>{s.badge}</div>}
      {s.step === 1 && <Step1Stage s={s} nights={nights} />}
      {s.step === 2 && <Step2Stage s={s} nights={nights} />}
      {s.step === 3 && <Step3Stage s={s} />}
      {s.step === 4 && <Step4Stage s={s} nights={nights} />}
    </StagePanel>
  )
}

/** The tallies of one night, with beetles per minute, as a row of values. */
function nightValues(t: NightTallies, seconds: number): Record<string, number | null> {
  return { ...t, perMinute: seconds > 0 ? (t.beetles / seconds) * 60 : 0 }
}

function sumValues(rows: Record<string, number | null>[]): Record<string, number | null> {
  const out: Record<string, number | null> = {}
  for (const [k] of SHORT_LABELS) {
    const vals = rows.map((r) => r[k]).filter((v): v is number => v !== null)
    out[k] = vals.length ? (k === 'perMinute' ? vals.reduce((a, b) => a + b, 0) / vals.length : vals.reduce((a, b) => a + b, 0)) : null
  }
  return out
}

function tableLines(columns: { label: string; values: Record<string, number | null> }[]): string[] {
  const head = `${''.padEnd(LABEL_W)}${columns.map((c) => c.label.slice(0, COL_W - 1).padStart(COL_W)).join('')}`
  return [head, ...SHORT_LABELS.map(([k, label]) => `${label.padEnd(LABEL_W)}${columns.map((c) => (c.values[k] === null ? '—'.padStart(COL_W) : (k === 'perMinute' ? c.values[k]!.toFixed(2) : String(c.values[k])).padStart(COL_W))).join('')}`)]
}

const COLUMN_SHORT: Record<ForagerId | 'you', string> = { you: 'you', usual: 'usual', tendency: 'tendency', tonight: 'tonight', blurred: 'blurred' }

function Step1Stage({ s, nights }: { s: LearnersStore; nights: StudentNights }) {
  const runs = s.foragerRuns
  if (!runs) return <Note>Press “Run the foragers” on the left. The table and the replay appear here when the four foragers have run your six nights.</Note>
  const perBlock = ([0, 1] as const).map((b) => {
    const seconds = nights.blocks[b].records[0]?.seconds ?? 1
    const you = studentTallies(nights, b).map((t) => nightValues(t, seconds))
    const columns = [{ label: COLUMN_SHORT.you, values: sumValues(you), nights: you }, ...FORAGERS.map((f) => {
      const per = runs[f.id][b].tallies.map((t) => nightValues(t, seconds))
      return { label: COLUMN_SHORT[f.id], values: sumValues(per), nights: per }
    })]
    return { b, columns }
  })
  const who = s.replay.who
  const clearing = clearingOf(nights, s.replay.block)
  const yours = studentRecord(nights, s.replay.block, s.replay.night)
  const theirs = who === 'you' ? null : runs[who][s.replay.block].run.records[s.replay.night - 1]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }} data-step1-reveal>
      {perBlock.map(({ b, columns }) => (
        <div key={b} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <GroupLabel>{`${BLOCK_LABEL[nights.blocks[b].plan.kind]}: over the three nights`}</GroupLabel>
          <FixedLines lines={tableLines(columns)} testId={`block-${b}-totals`} />
          <Section title="Night by night">
            {[0, 1, 2].map((n) => (
              <div key={n} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <Note>Night {n + 1}</Note>
                <FixedLines lines={tableLines(columns.map((c) => ({ label: c.label, values: c.nights[n] })))} />
              </div>
            ))}
          </Section>
        </div>
      ))}
      <Note>Columns: you, then {FORAGERS.map((f) => `${COLUMN_SHORT[f.id]} = ${f.label}`).join(', ')}. Beetles per minute is the mean over the nights.</Note>
      <GroupLabel>Replay: {who === 'you' ? 'your night' : `${foragerById(who).label}, beside yours`}</GroupLabel>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <ClearingOverhead clearing={clearing} record={yours} label={`you, ${BLOCK_LABEL[nights.blocks[s.replay.block].plan.kind]}, night ${s.replay.night}`} />
        {theirs && <ClearingOverhead clearing={clearing} record={theirs} label={`${foragerById(who as ForagerId).label}, night ${s.replay.night}`} />}
      </div>
      <Note>{OVERHEAD_LEGEND}</Note>
      <GroupLabel>The foragers</GroupLabel>
      {FORAGERS.map((f) => (
        <Note key={f.id}>
          <b style={{ color: 'var(--text)' }}>{f.label}.</b> Uses {f.uses}. Has no {f.hasNo}.
        </Note>
      ))}
      <Content>{PROGRAMS_LINE}</Content>
    </div>
  )
}

function Step2Stage({ s, nights }: { s: LearnersStore; nights: StudentNights }) {
  const runsAt = s.storeRuns[s.separation]
  if (!runsAt) return <Note>Press “Run the store at every setting” on the left. The codes, the similarity between the nights, the retrieval and the confusion tables appear here when the store has run your nights at the three settings.</Note>
  const block = runsAt[s.cue.block]
  const store = block.store
  const retrieval = block.retrievals.find((r) => r.night === s.cue.night)
  const clearing = clearingOf(nights, s.cue.block)
  const logLabels = clearing.logs.map((l) => `log ${l.id + 1}${l.kind === 'smooth' ? ' (smooth)' : ''}`)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }} data-step2-reveal>
      <GroupLabel>{`${BLOCK_LABEL[nights.blocks[s.cue.block].plan.kind]}, separation ${s.separation}: the stored nights`}</GroupLabel>
      {store && <StoredNights nights={store.nights} />}
      <GroupLabel>Similarity between the stored nights’ codes</GroupLabel>
      {store && <SimilarityMatrix matrix={store.similarity()} labels={store.nights.map((n) => n.label)} />}
      <Content>{SEPARATION_LINE}</Content>
      <GroupLabel>{`Retrieval on night ${s.cue.night}: what was emptied last night?`}</GroupLabel>
      {retrieval && retrieval.retrieval.contributions.length > 0 ? <RetrievalBars retrieval={retrieval.retrieval} labels={store!.nights.slice(0, retrieval.retrieval.contributions.length).map((n) => n.label)} logLabels={logLabels} treated={retrieval.treatedEmptied} /> : <Note>Nothing was stored before this night.</Note>}
      <Content>{STRENGTH_LINE}</Content>
      <GroupLabel>Confusions between nights: the store beside you</GroupLabel>
      {([0, 1] as const).map((b) => (
        <div key={b} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Note>{BLOCK_LABEL[nights.blocks[b].plan.kind]}</Note>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <ConfusionTableView table={studentTable(nights, b)} title="you" />
            {SEPARATIONS.map((sep) => s.storeRuns[sep] && <ConfusionTableView key={sep} table={foragerTable(s.storeRuns[sep]![b])} title={`the store, ${sep}`} />)}
          </div>
        </div>
      ))}
    </div>
  )
}

function Step3Stage({ s }: { s: LearnersStore }) {
  const net = s.youthNet
  const d = net ? differentiation(net) : null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }} data-step3-reveal>
      <GroupLabel>The slow learner’s world</GroupLabel>
      <PropertyTable />
      <Note>{TABLE_LEGEND}</Note>
      <Content>{PASS_BACK_LINE}</Content>
      <GroupLabel>The hidden-activity space through the youth</GroupLabel>
      {s.snapshots.length ? <HiddenSnapshots snapshots={s.snapshots} /> : <Note>Press “Skip ahead through the youth” on the left. Snapshots at passes {YOUTH_SNAPSHOTS.join(', ')} appear here, side by side.</Note>}
      {d && <FixedLines lines={[`${'Distance across stays-put against moves'.padEnd(44)}${d.top.toFixed(2).padStart(6)}`, `${'Distance across wood/plants and air/ground'.padEnd(44)}${d.middle.toFixed(2).padStart(6)}`, `${'Distance within the pairs'.padEnd(44)}${d.pairs.toFixed(2).padStart(6)}`]} testId="differentiation" />}
      <Note>The youth is long: many nights, each night’s encounters replayed interleaved with the others’, before the network represents what the things have in common (§10.1.2).</Note>
      <GroupLabel>A new season</GroupLabel>
      {s.season.off.length > 1 || s.season.on.length > 1 ? (
        <>
          <Note>Of the old things’ properties, the share still said yes to, against presentations of the new season.</Note>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <div>
              <Note>The specific properties</Note>
              <SeasonPlot off={s.season.off} on={s.season.on} which="specific" />
            </div>
            <div>
              <Note>All three levels, averaged</Note>
              <SeasonPlot off={s.season.off} on={s.season.on} which="all" />
            </div>
          </div>
          <FixedLines
            lines={[
              s.season.off.length > 1 ? `${'Replay off: specific properties kept at the end'.padEnd(50)}${s.season.off[s.season.off.length - 1].specific.toFixed(2).padStart(6)}` : null,
              s.season.on.length > 1 ? `${'Replay on: specific properties kept at the end'.padEnd(50)}${s.season.on[s.season.on.length - 1].specific.toFixed(2).padStart(6)}` : null,
            ]}
            testId="season-lines"
          />
        </>
      ) : (
        <Note>Train on the new season with replay off and with replay on, from the left. The plot appears here.</Note>
      )}
    </div>
  )
}

function Step4Stage({ s, nights }: { s: LearnersStore; nights: StudentNights }) {
  const reading = s.noise > 0 ? s.damagedReading() : null
  const measured = s.measuredTable()
  const totals = (runs: ForagerBlock[]) => sumValues(runs.flatMap((b, i) => b.tallies.map((t) => nightValues(t, nights.blocks[i].records[0]?.seconds ?? 1))))
  const youValues = sumValues(([0, 1] as const).flatMap((b) => studentTallies(nights, b).map((t) => nightValues(t, nights.blocks[b].records[0]?.seconds ?? 1))))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }} data-step4-reveal>
      <GroupLabel>Remove the fast store</GroupLabel>
      {s.noStoreRuns && s.intactRuns && s.usualRuns ? (
        <>
          <FixedLines lines={tableLines([{ label: 'you', values: youValues }, { label: 'intact', values: totals(s.intactRuns) }, { label: 'no store', values: totals(s.noStoreRuns) }, { label: 'usual', values: totals(s.usualRuns) }])} testId="no-store-table" />
          <Note>Over both blocks. Columns: you; Tonight too intact; Tonight too without its store; Usual only.</Note>
          <Note>Without the store, digs at logs emptied last night rise to Usual only’s level, and digs at smooth logs stay near zero, because the slow learner’s knowledge of kinds is intact. The tendency weights still learn. New things in a new season are learned only slowly, by direct experience over many nights, with no replay to interleave. H.M. and K.C. (§10.3.1, §10.3.2): learning new occasions impaired, old general knowledge spared, new facts learned slowly.</Note>
        </>
      ) : (
        <Note>Press “Remove the fast store” on the left.</Note>
      )}
      <GroupLabel>Damage the slow learner</GroupLabel>
      {reading ? (
        <>
          <Note>How the damaged network answers, at noise {s.noise.toFixed(2)} on its hidden units, averaged over twenty draws.</Note>
          <PropertyTable outputs={reading.table} />
          <Note>{TABLE_LEGEND}</Note>
          <FixedLines lines={[`${'General properties still said yes'.padEnd(40)}${reading.kept.general.toFixed(2).padStart(6)}`, `${'Middle properties still said yes'.padEnd(40)}${reading.kept.middle.toFixed(2).padStart(6)}`, `${'Specific properties still said yes'.padEnd(40)}${reading.kept.specific.toFixed(2).padStart(6)}`]} testId="kept-lines" />
        </>
      ) : (
        <Note>Move the slider on the left. The property table shows how the damaged network answers.</Note>
      )}
      {s.noisyRuns && s.intactRuns && (
        <>
          <FixedLines lines={tableLines([{ label: 'you', values: youValues }, { label: 'intact', values: totals(s.intactRuns) }, { label: 'damaged', values: totals(s.noisyRuns.blocks) }])} testId="damaged-table" />
          <Note>Over both blocks, with the slow learner at noise {s.noisyRuns.noise.toFixed(2)}. The forager starts digging at smooth logs, because has beetles and has no beetles are specific properties of two kinds of wood; its digs at logs emptied last night stay low, because the fast store is intact. Semantic dementia (§10.3.3): old knowledge of kinds lost first at the specific end, memory for recent occasions spared.</Note>
        </>
      )}
      <Content>{DAMAGE_LINE}</Content>
      <GroupLabel>The two-by-two table</GroupLabel>
      {s.tableCommitted && measured ? (
        <>
          <FixedLines
            lines={[
              `${'damage \\ error'.padEnd(26)}${'emptied last night'.padStart(20)}${'smooth logs'.padStart(14)}`,
              `${'intact (totals)'.padEnd(26)}${String(measured.intact.emptiedLast).padStart(20)}${String(measured.intact.smooth).padStart(14)}`,
              ...measured.rows.map((r) => `${r.damage.padEnd(26)}${`${r.emptiedLast} ${r.verdict[0]}`.padStart(20)}${`${r.smooth} ${r.verdict[1]}`.padStart(14)}`),
            ]}
            testId="measured-table"
          />
          <Note>Totals over both blocks; digs at logs emptied last night count nights 2 and 3. An error rises when the damaged forager’s total is at least one more than the intact forager’s. The two patterns are opposite: each kind of damage raises one error and not the other. That is a double dissociation (§10.3.1).</Note>
        </>
      ) : s.tableCommitted ? (
        <Note>Run both kinds of damage to see the measured table beside yours.</Note>
      ) : (
        <Note>Fill the table on the left and commit it. The measured table appears here after the commit.</Note>
      )}
    </div>
  )
}

function Right({ ctx }: { ctx: Ctx }) {
  const s = useStore(ctx.store)
  const nights = s.nights()
  return (
    <Panel title="The model, and your nights" style={RIGHT_STYLE}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Diagram step={s.step} />
        <Note>The tendency system stores no occasion: one weight per log, a residue of what paid off. The fast store holds each night after one exposure. The slow learner comes to represent what is generally true of the things in the range, from many interleaved experiences.</Note>
        {nights?.sample && <Content>{SAMPLE_NIGHTS_LINE}</Content>}
        {nights && (
          <>
            <GroupLabel>Your nights</GroupLabel>
            {([0, 1] as const).map((b) => (
              <FixedLines key={b} lines={[`${BLOCK_LABEL[nights.blocks[b].plan.kind]}, clearing ${nights.blocks[b].clearing}`, ...nights.blocks[b].records.map((r, i) => `${`night ${i + 1}`.padEnd(10)}beetles ${String(tallies(r).beetles).padStart(2)}   per minute ${perMinute(r).toFixed(2)}`)]} />
            ))}
            {nights.prediction && <FixedLines lines={[`Your Part 4 prediction: ${nights.prediction}`]} mono={false} />}
          </>
        )}
        {s.step === 2 && <Content>{SEPARATION_LINE}</Content>}
        {s.step === 3 && <Content>{PASS_BACK_LINE}</Content>}
        {s.step === 4 && <Content>{DAMAGE_LINE}</Content>}
        <Content>{PROGRAMS_LINE}</Content>
      </div>
    </Panel>
  )
}

export const learners: PartModule<LearnersStore> = {
  createStore: (seed, progress) => new LearnersStore(seed, progress),
  Left: ({ ctx }) => <Left ctx={ctx as unknown as Ctx} />,
  Stage: ({ ctx }) => <Stage ctx={ctx as unknown as Ctx} />,
  Right: ({ ctx }) => <Right ctx={ctx as unknown as Ctx} />,
}

export { LearnersStore }
