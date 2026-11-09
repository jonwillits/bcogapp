import { Panel } from '../../components/Panel'
import type { ProgressStore } from '../../sim/planning/progress/store'
import { AnimalCamera } from '../m09_rat/AnimalCamera'
import { TESTS, type TestId } from '../../sim/planning/tests'
import { RUN_ORDER } from '../../sim/planning/history'
import { HOMININ_LABEL, HOMININ_KINDS, type HomininKind } from '../../sim/planning/hominins/types'
import { positionAt, fmt, describeHands, TIME_SCALE } from '../../sim/planning/studentDay'
import { MORNING_SECONDS, WINDOW_SECONDS } from '../../sim/planning/range/places'
import { NEED_TABLE } from '../../sim/planning/range/needs'
import { separability } from '../../sim/planning/matrix'
import { Btn, Choice, Content, FixedLines, GroupLabel, Note, OrientingPanel, PANEL_STYLE, PART_TITLES, RIGHT_STYLE, StagePanel, Para, Section, useStore } from './ui'
import { InstructionScreen } from '../m10_memory/progress/InstructionScreen'
import { ReferencePanel } from './ReferencePanel'
import { reference } from '../../sim/planning/references'
import { BUILT_FOR_THE_EXPERIMENT_LINE, DRAWN_SIMPLY_LINE, EVERY_STEP_SEEN_LINE, FRESH_START_LINE, PROGRAMMED_HOMININS_LINE, THE_ELDER_LINE, RESTARTED_LINE } from './lines'
import type { PartContext, PartModule } from './contract'
import { BandStore, DAY_UNIT, DAY_LENGTH, ELDER_COLOR, LETTERS, LETTER_COLORS, STUDENT_COLOR } from './band/store'
import { SCREENS, STEP_TITLES, READY_LINE, TEST_DESCRIPTION, TEST_TAKES_AWAY, PROCEDURE_DESCRIPTIONS, PROCEDURE_SECTION, NEEDS_TABLE_LINES, ERECTUS_CARD, THREE_STUDIES, placeName, type Step } from './band/screens'
import { RangeView3D, AboveCamera, HOMININ_CAMERA, type Figure } from './band/RangeView3D'
import { registerResults } from './Part0'

/**
 * Part 3's screens (spec §7): the range in 3D in the canvas; the left
 * column runs the step (Begin, the predictions, the acts in Step 1, the
 * test menu and Run 10 days, Watch day n, Follow, the diagnosis); the stage
 * carries the instruction screens and the status lines over the view; the
 * right column carries My table, the table of what each need takes, and
 * the five procedures in words.
 */

type Ctx = PartContext<BandStore>

registerResults(3, (progress: ProgressStore) => <BandResults progress={progress} />)

const TEST_SHORT: Record<TestId, string> = { T1: 'T1 The usual day', T2: 'T2 Nothing on the grassland', T3: 'T3 Bones at the old kill', T4: 'T4 Termites after rain', T5: 'T5 Tubers in the dry flats', T6: 'T6 Termites, the elder away' }

function Left({ ctx }: { ctx: Ctx }) {
  const s = useStore(ctx.store)
  useStore(ctx.progress)
  const screen = SCREENS[s.step]
  const state = s.state
  return (
    <>
      {ctx.header}
      <Panel title={PART_TITLES.band} style={PANEL_STYLE}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Content>{PROGRAMMED_HOMININS_LINE}</Content>
          <GroupLabel>Step</GroupLabel>
          <Choice value={String(s.step)} options={([1, 2, 3, 4] as Step[]).map((st) => ({ id: String(st), label: `Step ${st}`, title: STEP_TITLES[st] }))} onChange={(v) => s.open(Number(v) as Step)} />
          <Note>{screen.title}</Note>
          {state === 'intro' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} data-intro>
              <Note>What you will do is described over the view. Read it, then press “Begin”.</Note>
              <Content>{`About ${screen.minutes} minutes. ${screen.kind === 'experiment' ? 'Two days, each done in one sitting; not scored.' : 'An exploration: leave and return at any time.'}`}</Content>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <Btn primary onClick={() => s.begin()} disabled={s.step === 4 && !s.diagnosed}>
                  Begin
                </Btn>
                {s.step > 1 && <Btn onClick={() => s.open((s.step - 1) as Step)}>Go back to Step {s.step - 1}</Btn>}
                {s.step < 4 && <Btn onClick={() => s.open((s.step + 1) as Step)}>Go to Step {s.step + 1}</Btn>}
              </div>
              {s.step === 4 && !s.diagnosed && <Note>Step 4 opens once the diagnosis of Step 3 is committed.</Note>}
            </div>
          )}
          {state === 'predict' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} data-predict>
              <GroupLabel>Predict first</GroupLabel>
              {screen.predictions.map((p) => (
                <div key={p.key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <Note>{p.question}</Note>
                  <Choice value={s.drafts[p.key] ?? null} options={p.choices.map((c) => ({ id: c, label: c }))} onChange={(c) => s.choose(p.key, c)} />
                </div>
              ))}
              <div>
                <Btn primary onClick={() => s.commitPredictions()} disabled={!s.canCommit()}>
                  Commit my prediction
                </Btn>
              </div>
            </div>
          )}
          {state === 'running' && s.step === 1 && <DayControls s={s} />}
          {state === 'running' && s.step >= 2 && (
            <>
              {screen.predictions.length > 0 && <FixedLines lines={screen.predictions.map((p) => `Your prediction: ${s.prediction(p.key) ?? '—'}`)} mono={false} />}
              <RunControls s={s} />
            </>
          )}
          {state !== 'intro' && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {s.step !== 1 && <Btn onClick={() => s.reopen()}>Show the instructions again</Btn>}
              {s.step > 1 && <Btn onClick={() => s.open((s.step - 1) as Step)}>Go back to Step {s.step - 1}</Btn>}
              {s.step < 4 && <Btn onClick={() => s.open((s.step + 1) as Step)}>Go on to Step {s.step + 1}</Btn>}
            </div>
          )}
          <div>
            <Btn small onClick={() => s.setInfoOpen(!s.infoOpen)}>
              {s.infoOpen ? 'Close the information card' : 'Information card: Homo erectus'}
            </Btn>
          </div>
        </div>
      </Panel>
    </>
  )
}

function DayControls({ s }: { s: BandStore }) {
  const d = s.day
  if (!d) {
    const done1 = s.dayRecord(1)
    const done2 = s.dayRecord(2)
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Note>
          {done1 && done2 ? 'Both days are done and saved. Their summaries are on the right.' : 'The day is saved.'}
        </Note>
      </div>
    )
  }
  const st = d.state
  const acts = d.available()
  const left = st.phase === 'morning' || st.phase === 'dawn' ? MORNING_SECONDS - st.clock : st.phase === 'midday' ? MORNING_SECONDS + WINDOW_SECONDS - st.clock : 0
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }} data-day-controls>
      <FixedLines
        lines={[
          `${'day'.padEnd(16)}${`${s.dayIndex} of 2`.padStart(12)}`,
          `${'range clock'.padEnd(16)}${fmt(st.clock).padStart(12)}`,
          `${st.phase === 'midday' ? 'window left' : 'morning left'.padEnd(16)}${st.phase === 'done' || st.phase === 'afternoon' ? '—'.padStart(12) : `${Math.ceil(left)} s`.padStart(12)}`,
          `${'in hand'.padEnd(16)}${describeHands(st.hands).slice(0, 26).padStart(12)}`,
          `${'near'.padEnd(16)}${(d.nearPlace() ? placeName(d.nearPlace()!) : 'open ground').padStart(12)}`,
        ]}
        testId="day-status"
      />
      {st.act && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }} data-act-progress>
          <Note>{st.message}</Note>
          <div style={{ height: 8, borderRadius: 4, background: 'var(--surface-2)', border: '1px solid var(--border)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${(100 * (st.act.total - st.act.left)) / st.act.total}%`, background: 'var(--accent)' }} />
          </div>
        </div>
      )}
      {!st.act && st.phase !== 'done' && (
        <>
          <GroupLabel>Acts</GroupLabel>
          {acts.length ? (
            acts.map((a) => (
              <div key={a.id}>
                <Btn small primary onClick={() => { a.run(); s.changed() }}>
                  {a.label}
                </Btn>
              </div>
            ))
          ) : (
            <Note>Nothing to do here. Walk to a place to pick something up, or hold what a making needs.</Note>
          )}
        </>
      )}
      {st.phase === 'done' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }} data-day-done>
          <GroupLabel>The day is over</GroupLabel>
          <Note>{st.ate ? 'Your hominin ate.' : 'Your hominin did not eat.'} The day’s record is on the right.</Note>
          <div>
            <Btn primary onClick={() => s.finishDay()}>
              {s.dayIndex === 1 ? 'Save this day and go on to day 2' : 'Save this day and finish Step 1'}
            </Btn>
          </div>
        </div>
      )}
    </div>
  )
}

function RunControls({ s }: { s: BandStore }) {
  const hp = s.historyProgress
  const ready = !!s.band
  const speed = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }} data-speed>
      <GroupLabel>Speed: range seconds a second</GroupLabel>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input type="range" min={2} max={60} step={1} value={s.speed} onChange={(e) => s.setSpeed(Number(e.target.value))} aria-label="range seconds a second" style={{ width: 140 }} />
        <FixedLines lines={[`${String(s.speed).padStart(2)}×`]} />
      </div>
    </div>
  )
  const follow = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <GroupLabel>Follow</GroupLabel>
      <Choice value={s.follow} options={[{ id: 'above', label: 'from above' }, ...LETTERS.map((l) => ({ id: l, label: l })), { id: 'elder', label: 'the elder' }]} onChange={(v) => s.setFollow(v as typeof s.follow)} />
    </div>
  )
  const last = s.lastRun
  const watchDays = last && (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }} data-watch>
      <GroupLabel>Watch a day of run {last.index} ({TEST_SHORT[last.test]})</GroupLabel>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {last.days.map((_, i) => (
          <Btn key={i} small primary={s.watching?.run === last && s.watching.day === i} onClick={() => s.watch(last, i)}>
            Watch day {i + 1}
          </Btn>
        ))}
      </div>
      {s.runs.length > 1 && <Note>Earlier runs can be watched from the table on the right.</Note>}
    </div>
  )
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} data-run-controls>
      {!ready && <Note data-badge>Living the hominins’ days before the lab: day {hp.lived} of {hp.of}. A run can start when this reaches {hp.of}.</Note>}
      {s.step === 2 && (
        <div>
          <Btn primary onClick={() => s.run('T1')} disabled={!ready}>
            Run T1 for all five
          </Btn>
        </div>
      )}
      {s.step >= 3 && (
        <>
          <GroupLabel>Test</GroupLabel>
          <Choice value={s.test} options={s.tests.map((t) => ({ id: t, label: TEST_SHORT[t], title: TEST_DESCRIPTION[t] }))} onChange={(v) => s.setTest(v as TestId)} />
          <Note>{TEST_DESCRIPTION[s.test]}</Note>
          <div>
            <Btn primary onClick={() => s.run()} disabled={!ready}>
              Run 10 days
            </Btn>
          </div>
          <FixedLines lines={[`${'Runs used'.padEnd(14)}${String(s.runsUsed).padStart(4)}`]} testId="runs-used" />
        </>
      )}
      {watchDays}
      {s.watching && (
        <div>
          <Btn small onClick={() => s.stopWatching()}>
            Stop watching
          </Btn>
        </div>
      )}
      {speed}
      {follow}
      {s.step === 3 && <Diagnosis s={s} />}
      {s.step === 4 && s.diagnosed && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }} data-variant>
          <GroupLabel>What the Shallow planner counts at the end of its search</GroupLabel>
          <Choice value={s.variant} options={[{ id: 'A', label: 'nothing (a pure depth limit)' }, { id: 'B', label: 'a learned estimate of the state it ends in' }]} onChange={(v) => s.setVariant(v as 'A' | 'B')} />
          <Note>In the first variant, a sequence that reaches no food within two preparatory acts and a place counts for nothing. In the second, such a sequence is valued by an estimate of the state it ends in, learned by a critic over states, Lab 5’s Verdict setting, from the hominin’s own mornings, as AlphaZero scores the position at the end of each continuation with its critic (§12.2.3). The setting applies to your later runs. The handout asks you to leave it as set.</Note>
        </div>
      )}
    </div>
  )
}

function Diagnosis({ s }: { s: BandStore }) {
  const d = s.diagnosis()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }} data-diagnosis>
      <GroupLabel>Diagnosis</GroupLabel>
      <Note>For each hominin, the procedure you think it follows. The five descriptions are the five procedures, in plain words, without saying which hominin is which. The same description may be chosen for more than one hominin if you think they do the same.</Note>
      {LETTERS.map((l) => (
        <div key={l} style={{ display: 'flex', gap: 6, alignItems: 'center' }} data-diagnosis-row={l}>
          <span style={{ fontWeight: 700, width: 16, color: LETTER_COLORS[l] }}>{l}</span>
          <select value={s.diagnosed ? (d[l] ?? '') : (s.draftDiagnosis[l] ?? '')} disabled={s.diagnosed} onChange={(e) => s.diagnose(l, e.target.value as HomininKind)} aria-label={`procedure for hominin ${l}`} style={{ flex: 1, fontSize: 11.5, padding: 3, background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 6 }}>
            <option value="">choose a procedure</option>
            {HOMININ_KINDS.map((k) => (
              <option key={k} value={k}>
                {PROCEDURE_DESCRIPTIONS[k].slice(0, 90)}…
              </option>
            ))}
          </select>
        </div>
      ))}
      {!s.diagnosed ? (
        <div>
          <Btn primary onClick={() => s.commitDiagnosis()} disabled={!s.canCommitDiagnosis}>
            Commit my diagnosis
          </Btn>
        </div>
      ) : (
        <Note>Your diagnosis is committed. Each hominin’s procedure is in Step 4.</Note>
      )}
    </div>
  )
}

function Stage({ ctx }: { ctx: Ctx }) {
  const s = useStore(ctx.store)
  useStore(ctx.progress)
  const screen = SCREENS[s.step]
  if (s.infoOpen) return <OrientingPanel title={ERECTUS_CARD.title} lines={ERECTUS_CARD.lines} content={[DRAWN_SIMPLY_LINE]} footer={ERECTUS_CARD.footer} onClose={() => s.setInfoOpen(false)} />
  if (s.state === 'intro') return <InstructionScreen title={screen.title} willDo={screen.reread ? [screen.reread, ...screen.willDo] : screen.willDo} minutes={screen.minutes} sitting={screen.sitting} sittingLine={screen.sittingLine} ready={READY_LINE} keys={screen.keys} content={screen.content} onBegin={() => s.begin()} disabled={s.step === 4 && !s.diagnosed} />
  if (s.state === 'predict')
    return (
      <StagePanel testId="predict">
        <div style={{ fontSize: 14, fontWeight: 600 }}>{screen.title}</div>
        <Note>Choose your prediction on the left and press “Commit my prediction”. Nothing runs until then.</Note>
      </StagePanel>
    )
  // Over the view: a thin status strip at the top, so the range stays visible.
  const lines: string[] = []
  if (s.step === 1 && s.day) {
    const st = s.day.state
    lines.push(`Day ${s.dayIndex} of 2 · ${cueLine(st.cue)} · ${st.phase === 'dawn' ? 'dawn' : st.phase === 'morning' ? `morning, ${Math.ceil(MORNING_SECONDS - st.clock)} s of range time left` : st.phase === 'midday' ? `midday: the need is at its place for ${Math.ceil(MORNING_SECONDS + WINDOW_SECONDS - st.clock)} s more` : st.phase === 'afternoon' ? 'afternoon' : 'the day is over'}`)
    lines.push(st.message)
  } else if (s.watching) {
    const w = s.watching
    const day = w.run.days[w.day]
    lines.push(`Run ${w.run.index}, ${TEST_SHORT[w.run.test]}, day ${w.day + 1} of 10 · ${cueLine(NEED_TABLE[day.need].cue)} · range clock ${fmt(w.clock)} · ${w.clock < MORNING_SECONDS ? 'morning' : w.clock < MORNING_SECONDS + WINDOW_SECONDS ? 'midday: the need is at its place' : 'afternoon'}`)
    lines.push(w.clock >= DAY_LENGTH ? `The day is over. ${day.hominins.map((h, i) => `${s.letters[RUN_ORDER[i]]} ${h.ate ? 'ate' : 'did not eat'}`).join('; ')}.` : 'Watching. Every hominin here is a program; the elder’s errands are set by the scene.')
  } else if (s.step >= 2) lines.push(s.band ? 'The range at dawn. Run a test on the left, then watch any of its days.' : 'The hominins’ days before the lab are being lived; a run can start when they are done.')
  return (
    <div data-stage="band" style={{ position: 'absolute', left: 'calc(50% + var(--stage-shift, 0px))', top: 10, transform: 'translateX(-50%)', width: 'min(640px, calc(100vw - 800px))', minWidth: 380, padding: '8px 14px', borderRadius: 10, background: 'rgba(11,17,28,0.72)', border: '1px solid var(--border)', color: '#fff', fontSize: 12, lineHeight: 1.5, pointerEvents: 'none' }}>
      <div style={{ fontWeight: 600 }}>{screen.title}</div>
      {lines.map((l, i) => (
        <div key={i} data-status-line={i}>
          {l}
        </div>
      ))}
    </div>
  )
}

function cueLine(cue: string): string {
  return cue === 'vultures' ? 'vultures circle over the grassland' : cue === 'hyenas' ? 'hyenas whoop near the old kill' : cue === 'rain' ? 'rain fell in the night; winged termites rise from the mounds' : 'the flats are dry and cracked'
}

function CanvasPart({ ctx }: { ctx: Ctx }) {
  const s = ctx.store
  const figures = (): Figure[] => {
    const out: Figure[] = []
    if (s.step === 1 && s.day) {
      const d = s.day
      const p = d.pose
      out.push({ id: 'me', label: 'you', ring: STUDENT_COLOR, x: p.x, z: p.y, heading: p.heading, moving: d.body.lastStep !== 0 || d.body.lastTurn !== 0, hands: d.state.hands })
      const e = positionAt(d.elderSegments, d.state.clock)
      out.push({ id: 'elder', label: 'the elder', ring: ELDER_COLOR, x: e.x, z: e.z, heading: e.heading, moving: e.moving, hands: handsAt(d.elderSegments, d.state.clock), doing: e.doing })
      return out
    }
    const w = s.watching
    const day = w ? w.run.days[w.day] : null
    const t = w ? w.clock : 0
    RUN_ORDER.forEach((kind, i) => {
      const letter = s.letters[kind]
      const segs = day ? day.hominins[i].segments : []
      const p = day ? positionAt(segs, t) : { x: (i - 2) * 1.6, z: -1.5, heading: Math.PI / 2, moving: false, doing: '' }
      out.push({ id: letter, label: letter, ring: LETTER_COLORS[letter], x: p.x, z: p.z, heading: p.heading, moving: p.moving, hands: day ? handsAt(segs, t) : [], doing: day ? p.doing : undefined })
    })
    if (!day || day.elder.present) {
      const e = day ? positionAt(day.elder.segments, t) : { x: 0, z: 1.5, heading: -Math.PI / 2, moving: false, doing: '' }
      out.push({ id: 'elder', label: 'the elder', ring: ELDER_COLOR, x: e.x, z: e.z, heading: e.heading, moving: e.moving, hands: day ? handsAt(day.elder.segments, t) : [], doing: day ? e.doing : undefined })
    }
    return out
  }
  const figs = figures()
  const day = s.step === 1 ? s.day : null
  const w = s.watching
  const cue = day ? day.state.cue : w ? NEED_TABLE[w.run.days[w.day].need].cue : 'vultures'
  const need = day ? day.state.need : w ? w.run.days[w.day].need : 'carcass'
  const needPresent = day ? day.state.needPresent : w ? w.clock >= MORNING_SECONDS && w.clock < MORNING_SECONDS + WINDOW_SECONDS && w.run.test !== 'T2' : false
  const elderAway = w ? !w.run.days[w.day].elder.present : false
  const followId = s.step === 1 ? 'me' : s.follow === 'above' ? null : s.follow
  const followed = followId ? figs.find((f) => f.id === followId) : null
  const pose = () => {
    const f = followId ? figures().find((x) => x.id === followId) : null
    return f ? { x: f.x, y: f.z, heading: f.heading } : { x: 0, y: 0, heading: 0 }
  }
  return (
    <>
      <RangeView3D obstacles={s.obstacles} cue={cue} need={need} needPresent={needPresent} elderAway={elderAway} figures={figs} clock={ctx.clock} lowDetail={ctx.lowDetail} hideId={followed && ctx.view === 'eye' ? followed.id : null} labels />
      {followed ? <AnimalCamera pose={pose} view={ctx.view} fov={ctx.fov} scale={HOMININ_CAMERA} /> : <AboveCamera fov={ctx.fov} />}
    </>
  )
}

/** What a programmed hominin holds at a moment, replayed from its segments. */
function handsAt(segments: readonly { kind: string; t0: number; t1?: number; item?: string; what?: string }[], t: number): Item[] {
  let hands: string[] = []
  for (const seg of segments) {
    if ((seg.t1 ?? seg.t0) > t) break
    if (seg.kind === 'pickUp' && seg.item) hands.push(seg.item)
    if (seg.kind === 'putDown' && seg.item) hands = hands.filter((h, i) => !(h === seg.item && i === hands.indexOf(seg.item!)))
    if (seg.kind === 'make' && seg.what) {
      if (seg.what === 'flake') hands.push('flake')
      else hands = hands.map((h) => (h === 'sapling' ? seg.what! : h))
    }
  }
  return hands.slice(0, 2) as Item[]
}
type Item = import('../../sim/planning/range/places').Item

function Bottom({ ctx, press, act }: { ctx: Ctx; press: (k: 'forward' | 'back' | 'left' | 'right', down: boolean) => void; act: () => void }) {
  const s = useStore(ctx.store)
  if (s.step !== 1 || !s.day) return null
  const key = (k: 'forward' | 'back' | 'left' | 'right', label: string) => (
    <button type="button" aria-label={k} onPointerDown={(e) => { e.preventDefault(); press(k, true) }} onPointerUp={() => press(k, false)} onPointerLeave={() => press(k, false)} onPointerCancel={() => press(k, false)} style={{ width: 40, height: 34, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 14, fontWeight: 600, cursor: 'pointer', touchAction: 'none' }}>
      {label}
    </button>
  )
  return (
    <div style={{ display: 'flex', gap: 14, alignItems: 'center', pointerEvents: 'auto' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 40px)', gap: 4, justifyContent: 'center' }} data-drivepad>
        <span />
        {key('forward', '▲')}
        <span />
        {key('left', '◀')}
        {key('back', '▼')}
        {key('right', '▶')}
      </div>
      <Btn primary onClick={() => { act(); s.act() }}>
        Act
      </Btn>
      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Arrow keys or WASD walk and turn · “Enter” or “Act” does the first act listed under “Acts” · the range clock runs at {TIME_SCALE} range seconds a second</div>
    </div>
  )
}

function Right({ ctx }: { ctx: Ctx }) {
  const s = useStore(ctx.store)
  const p = useStore(ctx.progress)
  const table = s.table()
  const tests = s.testsRun()
  const strips = s.t2Strips()
  return (
    <Panel title={s.step === 1 ? 'The day' : s.step === 4 ? 'What each one was doing' : 'My table'} style={RIGHT_STYLE}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {s.step === 1 && (
          <>
            {[1, 2].map((n) => {
              const r = s.dayRecord(n as 1 | 2)
              return r ? (
                <div key={n} style={{ display: 'flex', flexDirection: 'column', gap: 4 }} data-day-record={n}>
                  <GroupLabel>
                    Day {n}: {cueLine(r.cue)}; your hominin {r.ate ? 'ate' : 'did not eat'}
                  </GroupLabel>
                  {r.restarts > 0 && <Content>{RESTARTED_LINE}</Content>}
                  <FixedLines lines={r.log.length ? r.log : ['nothing recorded']} mono={false} />
                </div>
              ) : null
            })}
            {s.day && <FixedLines lines={s.day.state.log.length ? s.day.state.log : ['Dawn. Nothing yet.']} mono={false} testId="day-log" />}
          </>
        )}
        {s.step >= 2 && s.step <= 3 && (
          <>
            <Note>Per hominin and test: for T1 and T3 to T6, the share of the ten days on which the hominin reached the need’s place within the window holding what it takes, averaged over your runs of that test, with the number of runs in brackets; for T2, the share of days 2 to 10 on which it carried a flake to the grassland. Only tests you have run are shown.</Note>
            {tests.length ? <FixedLines lines={[`${'hominin'.padEnd(9)}${tests.map((t) => t.padStart(10)).join('')}`, ...LETTERS.map((l) => `${l.padEnd(9)}${tests.map((t) => (table[l][t] ? `${table[l][t]!.share.toFixed(2)} (${table[l][t]!.runs})` : '').padStart(10)).join('')}`)]} testId="my-table" /> : <Note>No runs yet.</Note>}
            {strips && (
              <>
                <GroupLabel>T2, the most recent run: on which of the ten days each hominin carried a flake to the grassland</GroupLabel>
                <FixedLines lines={LETTERS.map((l) => `${l}  ${strips[l].map((v) => (v ? '■' : '·')).join(' ')}`)} testId="t2-strip" />
              </>
            )}
            {s.runs.length > 0 && (
              <>
                <GroupLabel>Your runs</GroupLabel>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {s.runs.map((r) => (
                    <Btn key={r.index} small onClick={() => s.watch(r, 0)}>
                      Run {r.index}: {r.test}
                    </Btn>
                  ))}
                </div>
              </>
            )}
            <FixedLines lines={tests.map((t) => `${t}: ${TEST_DESCRIPTION[t]}`)} mono={false} />
            <Content>{FRESH_START_LINE}</Content>
            <Content>{THE_ELDER_LINE}</Content>
            {(tests.includes('T4') || tests.includes('T5')) && <Content>{EVERY_STEP_SEEN_LINE}</Content>}
          </>
        )}
        {s.step === 4 && s.diagnosed && <Reveal s={s} />}
        <GroupLabel>What each need takes</GroupLabel>
        <Note>This table describes the range, not any hominin’s rule. A preparatory act is an errand before the need’s place: fetching an item at its source, or making an item from what is in hand.</Note>
        <div style={{ overflowX: 'auto' }}>
          <FixedLines lines={NEEDS_TABLE_LINES} testId="needs-table" />
        </div>
        <Content>{BUILT_FOR_THE_EXPERIMENT_LINE}</Content>
        {s.step >= 2 && (
          <>
            <GroupLabel>The five procedures, in plain words</GroupLabel>
            <FixedLines lines={HOMININ_KINDS.map((k) => `${s.diagnosed ? `${s.letters[k]} ${HOMININ_LABEL[k]}: ` : '• '}${PROCEDURE_DESCRIPTIONS[k]}`)} mono={false} testId="procedures-in-words" />
            {!s.diagnosed && <Note>A procedure’s name and letter appear only after “Commit my diagnosis”.</Note>}
          </>
        )}
        {p.isComplete(DAY_UNIT(1)) && s.step === 1 && null}
      </div>
    </Panel>
  )
}

function Reveal({ s }: { s: BandStore }) {
  const d = s.diagnosis()
  const m = s.matrixRun?.result
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }} data-reveal="band">
      <Section title="Each hominin’s procedure, beside your diagnosis">
        {s.order.map(({ letter, kind }) => (
          <Note key={letter} style={{ color: 'var(--text)' }}>
            <strong style={{ color: LETTER_COLORS[letter] }}>{letter}</strong> — {HOMININ_LABEL[kind]} ({PROCEDURE_SECTION[kind]}): {PROCEDURE_DESCRIPTIONS[kind]}{' '}
            <span style={{ color: d[letter] === kind ? 'var(--actuator)' : 'var(--avoid)' }}>{d[letter] === kind ? 'You said the same.' : `You said: ${d[letter] ? HOMININ_LABEL[d[letter]!] : '—'}.`}</span>
          </Note>
        ))}
        <FixedLines lines={[`${'Diagnoses right'.padEnd(20)}${String(s.rightCount()).padStart(2)} of 5`]} />
      </Section>
      <Section title="What each test took away">
        <FixedLines lines={TESTS && Object.keys(TEST_TAKES_AWAY).map((t) => `${t}: ${TEST_TAKES_AWAY[t]}`)} mono={false} />
      </Section>
      <Section title="The full matrix from runs made when this lab was built: the mean share over 20 seeds of one ten-day run each, with the spread across seeds in brackets, for each variant of the Shallow planner">
        {m ? (
          <>
            {(['A', 'B'] as const).map((v) => (
              <div key={v} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <GroupLabel>Variant {v}: the Shallow planner counts {v === 'A' ? 'nothing' : 'a learned estimate of the state it ends in'} at the end of its search{v === s.variant ? ' (your runs)' : ''}</GroupLabel>
                <FixedLines lines={[`${''.padEnd(18)}${(['T1', 'T2', 'T3', 'T4', 'T5', 'T6'] as TestId[]).map((t) => t.padStart(12)).join('')}`, ...s.order.map(({ letter, kind }) => `${`${letter} ${HOMININ_LABEL[kind]}`.padEnd(18)}${(['T1', 'T2', 'T3', 'T4', 'T5', 'T6'] as TestId[]).map((t) => `${m[v].cells[kind][t].mean.toFixed(2)} (${m[v].cells[kind][t].sd.toFixed(2)})`.padStart(12)).join('')}`)]} testId={`matrix-${v}`} />
                <FixedLines lines={[`T2 strip: the share of seeds in which each hominin carried a flake to the grassland on each day`, ...s.order.map(({ letter, kind }) => `${letter}  ${m[v].t2Strip[kind].map((x) => x.toFixed(2)).join(' ')}`)]} />
                <FixedLines lines={separability(m[v]).map((r) => `${s.letters[r.a]} vs ${s.letters[r.b]}: best told apart by ${r.bestTest ?? 'nothing'}, difference ${Math.abs(r.difference).toFixed(2)}, runs for 95% of students ${r.runsFor95 ?? 'more than 10'}`)} mono={false} />
              </div>
            ))}
          </>
        ) : (
          <Note data-badge>{s.matrixRun?.badge || 'Computing the matrix.'} {s.matrixRun ? `${Math.round(100 * s.matrixRun.progress)}%` : ''}</Note>
        )}
      </Section>
      <Section title="Three studies from the reading">
        <Note>Each sentence describes a study’s design. The panel does not say which test each study resembles.</Note>
        {THREE_STUDIES.map((t, i) => (
          <Para key={i}>{t}</Para>
        ))}
        <ReferencePanel reference={reference('erectus')} />
        <ReferencePanel reference={reference('needs-evidence')} />
      </Section>
    </div>
  )
}

function BandResults({ progress }: { progress: ProgressStore }) {
  const r1 = progress.isComplete(DAY_UNIT(1)) ? (progress.result(DAY_UNIT(1)) as { cue: string; ate: boolean; log: string[] }) : null
  const r2 = progress.isComplete(DAY_UNIT(2)) ? (progress.result(DAY_UNIT(2)) as { cue: string; ate: boolean; log: string[] }) : null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }} data-results="band">
      {[r1, r2].map((r, i) => (r ? <FixedLines key={i} lines={[`Day ${i + 1}: ${cueLine(r.cue)}; ${r.ate ? 'ate' : 'did not eat'}`, ...r.log]} mono={false} /> : <Note key={i}>Day {i + 1} is not done.</Note>))}
      <Note>Part 3’s Steps 2 to 4 are explorations; the diagnosis, once committed, is on the Band tab.</Note>
    </div>
  )
}

export { BandStore }

export const band: PartModule<BandStore> = {
  createStore: (seed, progress) => new BandStore(seed, progress),
  Left,
  Stage,
  Right,
  Canvas: CanvasPart,
  Bottom,
  Results: ({ progress }) => <BandResults progress={progress} />,
}
