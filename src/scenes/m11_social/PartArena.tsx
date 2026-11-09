import { Panel } from '../../components/Panel'
import type { ProgressStore } from '../../sim/social/progress/store'
import { ANIMALS, ANIMAL_IDS, animalById, type AnimalId } from '../../sim/social/arena/animals'
import { EXPERIENCES, type Experience } from '../../sim/social/arena/experience'
import { TESTS } from '../../sim/social/arena/trial'
import { Btn, Choice, Content, FixedLines, GroupLabel, Note, PANEL_STYLE, PART_TITLES, RIGHT_STYLE, StagePanel, useStore } from './ui'
import { InstructionScreen } from '../m10_memory/progress/InstructionScreen'
import { PROGRAMMED_ANIMALS_LINE, THE_LEARNER_LINE } from './lines'
import type { PartModule } from './contract'
import { ArenaStore, TRIAL_SECONDS, TRIALS_PER_RUN, SPEED_RANGE } from './arena/store'
import { STEPS, type Step } from './arena/steps'
import { ArenaView, ARENA_LEGEND } from './arena/ArenaView'

/**
 * Part 4's screens (spec §8): the left column runs the step (the chips,
 * Begin with Go back and Go to, the predictions, the test and animal
 * menus with Run 10 trials and the counter, the line-of-sight toggle, the
 * diagnosis with Commit my diagnosis, Go on and Redo); the stage carries
 * the arena with the trial playing out; the right column the table, and
 * after the commit the reveal with the build's matrix.
 */

type Ctx = { store: ArenaStore; header: React.ReactNode; progress: ProgressStore; seed: number }

const TEST_SHORT: Record<string, string> = { T1: 'T1 Standard', T2: 'T2 Clear barrier', T3: 'T3 Door shut', T4: 'T4 Did not watch', T5: 'T5 Missed a move', T6: 'T6 Swap', T7: 'T7 Released first', T8: 'T8 New layout' }

function Left({ ctx }: { ctx: Ctx }) {
  const s = useStore(ctx.store)
  const spec = s.spec
  return (
    <>
      {ctx.header}
      <Panel title={PART_TITLES.arena} style={PANEL_STYLE}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Content>{PROGRAMMED_ANIMALS_LINE}</Content>
          <GroupLabel>Step</GroupLabel>
          <Choice value={String(s.step)} options={STEPS.map((st) => ({ id: String(st.step), label: `Step ${st.step}`, title: st.title }))} onChange={(v) => s.open(Number(v) as Step)} />
          <Note>{spec.title}</Note>
          {s.state === 'intro' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} data-intro>
              <Note>What will happen is described over the view.</Note>
              <Content>{`About ${spec.minutes} minutes. You can leave and come back at any time.`}</Content>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <Btn primary onClick={() => s.begin()}>
                  Begin
                </Btn>
                {s.step > 1 && <Btn onClick={() => s.open((s.step - 1) as Step)}>Go back to Step {s.step - 1}</Btn>}
                {s.step < 3 && <Btn onClick={() => s.open((s.step + 1) as Step)}>Go to Step {s.step + 1}</Btn>}
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
              <StepControls s={s} />
              {s.badge && <Note data-badge>{s.badge}</Note>}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {s.state === 'running' && (
                  <Btn
                    onClick={() => {
                      s.finish()
                      if (s.step < 3) s.open((s.step + 1) as Step)
                    }}
                  >
                    {s.step < 3 ? `Go on to Step ${s.step + 1}` : 'Finish Part 4'}
                  </Btn>
                )}
                {s.state === 'done' && s.step < 3 && <Btn onClick={() => s.open((s.step + 1) as Step)}>Go on to Step {s.step + 1}</Btn>}
                {s.state === 'done' && <Btn onClick={() => s.redo()}>Redo Step {s.step}</Btn>}
              </div>
            </>
          )}
        </div>
      </Panel>
    </>
  )
}

function StepControls({ s }: { s: ArenaStore }) {
  const sight = (
    <label style={{ fontSize: 12, display: 'flex', gap: 6, alignItems: 'center' }}>
      <input type="checkbox" checked={s.showSight} onChange={(e) => s.setShowSight(e.target.checked)} /> Draw the dominant’s line of sight
    </label>
  )
  const speed = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }} data-speed>
      <GroupLabel>Speed: seconds a trial</GroupLabel>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>fast</span>
        <input type="range" min={SPEED_RANGE.min} max={SPEED_RANGE.max} step={SPEED_RANGE.step} value={s.trialSeconds} onChange={(e) => s.setTrialSeconds(Number(e.target.value))} aria-label="seconds a trial" style={{ width: 140 }} />
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>slow</span>
        <FixedLines lines={[`${s.trialSeconds.toFixed(1)} s`]} />
      </div>
    </div>
  )
  if (s.step === 1)
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div>
          <Btn primary onClick={() => s.runAll('T1')} disabled={!!s.playing}>
            Run T1 for all five
          </Btn>
        </div>
        {speed}
        {sight}
      </div>
    )
  if (s.step === 2)
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }} data-test-menu>
        <GroupLabel>Test</GroupLabel>
        <Choice value={s.test} options={s.tests.map((t) => ({ id: t.id, label: TEST_SHORT[t.id], title: t.what }))} onChange={(v) => s.setTest(v)} />
        <Note>{TESTS.find((t) => t.id === s.test)?.what}</Note>
        <GroupLabel>Animal</GroupLabel>
        <Choice value={s.animal} options={s.order.map((a) => ({ id: a, label: s.letters[a] }))} onChange={(v) => s.setAnimal(v as AnimalId)} />
        <div>
          <Btn primary onClick={() => s.runCurrent()} disabled={!!s.playing}>
            Run {TRIALS_PER_RUN} trials
          </Btn>
        </div>
        <FixedLines lines={[`${'Runs used'.padEnd(14)}${String(s.runsUsed).padStart(4)}`]} testId="runs-used" />
        {speed}
        {sight}
        <GroupLabel>Diagnosis</GroupLabel>
        <Note>For each animal, the rule you think it follows. The five descriptions are the five rules, without saying which animal is which.</Note>
        {s.order.map((a) => (
          <div key={a} style={{ display: 'flex', gap: 6, alignItems: 'center' }} data-diagnosis-row={s.letters[a]}>
            <span style={{ fontWeight: 700, width: 16 }}>{s.letters[a]}</span>
            <select value={s.diagnosed ? (s.diagnosis()[a] ?? '') : (s.draftDiagnosis[a] ?? '')} disabled={s.diagnosed} onChange={(e) => s.diagnose(a, e.target.value as AnimalId)} aria-label={`rule for animal ${s.letters[a]}`} style={{ flex: 1, fontSize: 11.5, padding: 3, background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 6 }}>
              <option value="">choose a rule</option>
              {ANIMALS.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.rule}
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
          <Note>Your diagnosis is committed. The animals’ rules are on the right, and in Step 3.</Note>
        )}
      </div>
    )
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {!s.diagnosed && <Note>Step 3 shows every animal’s rule once the diagnosis of Step 2 is committed.</Note>}
      {s.diagnosed && (
        <>
          <GroupLabel>The learner’s experience</GroupLabel>
          <Choice value={s.experience} options={EXPERIENCES.map((e) => ({ id: e.id, label: e.label }))} onChange={(v) => s.setExperience(v as Experience)} />
          <div>
            <Btn primary onClick={() => s.runAll('T8')} disabled={!!s.playing}>
              Run T8 for all five
            </Btn>
          </div>
          <Content>{THE_LEARNER_LINE}</Content>
          {speed}
          {sight}
        </>
      )}
    </div>
  )
}

function Stage({ ctx }: { ctx: Ctx }) {
  const s = useStore(ctx.store)
  const spec = s.spec
  if (s.state === 'intro') return <InstructionScreen title={spec.title} willDo={spec.reread ? [spec.reread, ...spec.willDo] : spec.willDo} minutes={spec.minutes} sitting="leave any time" content={spec.content} onBegin={() => s.begin()} />
  if (s.state === 'predict')
    return (
      <StagePanel testId="predict">
        <div style={{ fontSize: 14, fontWeight: 600 }}>{spec.title}</div>
        <Note>Choose your prediction on the left and press “Commit my prediction”. Nothing runs until then.</Note>
      </StagePanel>
    )
  if (s.step === 3 && !s.matrix && s.diagnosed) s.computeMatrix()
  const v = s.trialOnView
  const door = s.step === 3 && s.test === 'T8' ? 'top' : 'east'
  return (
    <StagePanel wide testId={`step-${s.step}`}>
      <div style={{ fontSize: 14, fontWeight: 600 }}>{spec.title}</div>
      <ArenaView trial={v?.trial ?? null} letter={v ? v.run.letter : null} clock={v?.clock ?? TRIAL_SECONDS} showSight={s.showSight} door={door} />
      <FixedLines lines={v ? [`${`Animal ${v.run.letter}`.padEnd(12)}${TEST_SHORT[v.run.test].padEnd(20)}trial ${String(v.index + 1).padStart(2)} of ${v.run.trials.length}`, `${'Went to'.padEnd(12)}${v.clock >= 0.9 ? (v.trial.subordinate === TESTS.find((t) => t.id === v.run.test)!.scoredPiece ? 'the scored piece' : 'the other piece') : ' '}`, `${'This run'.padEnd(12)}${s.playing ? ' ' : `${(v.run.share * 100).toFixed(0)}% on the scored piece`}`] : ['No run yet.', ' ', ' ']} testId="trial-status" />
      <Note>{ARENA_LEGEND}</Note>
      {s.step === 3 && s.diagnosed && <RevealOnStage s={s} />}
    </StagePanel>
  )
}

function RevealOnStage({ s }: { s: ArenaStore }) {
  const d = s.diagnosis()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} data-reveal>
      <GroupLabel>Every animal’s rule, beside your diagnosis</GroupLabel>
      {s.order.map((a) => (
        <Note key={a} style={{ color: 'var(--text)' }}>
          <strong>{s.letters[a]}</strong> — {animalById(a).label}: {animalById(a).rule}. Separated by {animalById(a).separatedBy}. <span style={{ color: d[a] === a ? 'var(--actuator)' : 'var(--avoid)' }}>{d[a] === a ? 'You said the same.' : `You said: ${d[a] ? animalById(d[a]!).rule : '—'}.`}</span>
        </Note>
      ))}
      <FixedLines lines={[`${'Diagnoses right'.padEnd(20)}${String(s.rightCount()).padStart(2)} of 5`]} />
      <GroupLabel>The full matrix: each animal’s share on the piece the test scores, over 200 trials of each pair, with the spread across runs of 10 in brackets; the learner with the usual room</GroupLabel>
      {s.matrix ? <MatrixLines s={s} /> : <Note data-badge>{s.badge || 'Running the matrix…'}</Note>}
      <Note>The learner’s share on T2 is above the three sighted animals’ 0.5: in its history a piece with no barrier beside it was always the one the dominant took, so it leans toward the piece by the clear barrier, which it has never seen a dominant see through. The spread across runs is wide there.</Note>
    </div>
  )
}

function MatrixLines({ s }: { s: ArenaStore }) {
  const m = s.matrix!
  const head = `${''.padEnd(24)}${TESTS.map((t) => t.id.padStart(11)).join('')}`
  return (
    <>
      <FixedLines lines={[head, ...s.order.map((a) => `${`${s.letters[a]} ${animalById(a).label}`.padEnd(24)}${TESTS.map((t) => `${m.mean[a][t.id].toFixed(2)} (${m.sd[a][t.id].toFixed(2)})`.padStart(11)).join('')}`)]} testId="matrix" scroll />
      <Note>{WIDE_TABLE_NOTE}</Note>
    </>
  )
}

/** Both of Part 4's tables are wider than their panels on most screens; Mac scrollbars show only while scrolling, so the line says it (two students' reports, 2026-11-09). */
const WIDE_TABLE_NOTE = 'This table scrolls sideways when it is wider than its panel: drag or swipe across it to reach the later tests.'

function Right({ ctx }: { ctx: Ctx }) {
  const s = useStore(ctx.store)
  const tableRows = s.tableRows()
  const tests = s.testsRun()
  const head = `${'animal'.padEnd(8)}${tests.map((t) => t.padStart(10)).join('')}`
  const rows = tableRows.map((row) => `${row.label.padEnd(8)}${tests.map((t) => (row.cells[t] ? `${row.cells[t].share.toFixed(2)} (${row.cells[t].runs})` : '').padStart(10)).join('')}`)
  const learnerSplit = tableRows.some((r) => r.experience === 'many') && tableRows.some((r) => r.experience === 'usual')
  return (
    <Panel title="My table" style={RIGHT_STYLE}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Note>Per animal and test: the share of trials on which the animal went to the piece the test scores, averaged over your runs of that pair, with the number of runs in brackets. Only tests you have run are shown.</Note>
        {tests.length ? <FixedLines lines={[head, ...rows]} testId="my-table" scroll /> : <Note>No runs yet.</Note>}
        {tests.length > 5 && <Note>{WIDE_TABLE_NOTE}</Note>}
        {learnerSplit && <Note>The learner has a row for each experience it has run under: “usual” is the usual room, “many” is many rooms.</Note>}
        <FixedLines lines={TESTS.filter((t) => tests.includes(t.id)).map((t) => `${t.id}: ${t.scoredLabel}`)} mono={false} />
        <GroupLabel>The five rules, in words</GroupLabel>
        <FixedLines lines={ANIMALS.map((r) => `${s.diagnosed ? `${s.letters[r.id]} ${r.label}: ` : '• '}${r.rule}`)} mono={false} testId="rules-in-words" />
        {s.diagnosed && <Note>The letters beside the rules were added when you committed your diagnosis.</Note>}
        {ANIMAL_IDS.length > 0 && !s.diagnosed && <Note>A rule’s letter appears only after “Commit my diagnosis”.</Note>}
      </div>
    </Panel>
  )
}

export { ArenaStore }

export const arena: PartModule<ArenaStore> = {
  createStore: (seed, progress) => new ArenaStore(seed, progress),
  Left,
  Stage,
  Right,
}
