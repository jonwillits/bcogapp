import { useEffect } from 'react'
import { Panel } from '../../components/Panel'
import type { ProgressStore } from '../../sim/social/progress/store'
import { restingFiring } from '../../sim/social/mirror/schedule'
import { referenceById } from '../../sim/social/references'
import { Btn, Choice, Content, FixedLines, GroupLabel, Note, PANEL_STYLE, PART_TITLES, ReferencePanel, RIGHT_STYLE, StagePanel, useStore, useThrottledStore } from './ui'
import { InstructionScreen } from '../m10_memory/progress/InstructionScreen'
import { MODEL_CELLS_LINE, ROLES_LINE, HUMAN_RESULT_LINE } from './lines'
import type { PartModule } from './contract'
import { MirrorStore } from './mirror/store'
import { STEPS, type Step } from './mirror/steps'
import { Legend, TestLines, Traces, WeightTable } from './mirror/RecordingPanel'
import { MacaqueScene } from './mirror/MacaqueScene'

/**
 * Part 6's screens (spec §10): the left column runs the step (the chips,
 * Begin with Go back and Go to, the prediction, the two grasp buttons with
 * their keys, Run 40 grasps, Run the test, Reset the cells in Step 3, the
 * view, Go on and Redo); the view is the 3D table scene; the right column
 * is the recording panel with the content lines.
 */

type Ctx = { store: MirrorStore; header: React.ReactNode; progress: ProgressStore; seed: number }

function useGraspKeys(store: MirrorStore) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      if (el && ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) return
      if (e.code === 'KeyP') store.grasp('precision')
      if (e.code === 'KeyW') store.grasp('wholeHand')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [store])
}

function Left({ ctx }: { ctx: Ctx }) {
  const s = useStore(ctx.store)
  useGraspKeys(ctx.store)
  const spec = s.spec
  return (
    <>
      {ctx.header}
      <Panel title={PART_TITLES.mirror} style={PANEL_STYLE}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Content>{MODEL_CELLS_LINE}</Content>
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
              <GroupLabel>Grasps</GroupLabel>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <Btn primary onClick={() => s.grasp('precision')} disabled={!!s.testing}>
                  Precision grip (P)
                </Btn>
                <Btn primary onClick={() => s.grasp('wholeHand')} disabled={!!s.testing}>
                  Whole-hand grasp (W)
                </Btn>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {s.step > 1 && (
                  <Btn onClick={() => s.runForty()} disabled={!!s.testing || s.autoLeft > 0}>
                    Run 40 grasps
                  </Btn>
                )}
                <Btn onClick={() => s.runTest()} disabled={!!s.testing}>
                  Run the test
                </Btn>
                {s.step === 3 && <Btn onClick={() => s.resetCells()}>Reset the cells</Btn>}
              </div>
              <FixedLines lines={[`${'Grasps this step'.padEnd(20)}${String(s.graspsThisStep).padStart(4)}`, `${'Still to run'.padEnd(20)}${String(s.autoLeft).padStart(4)}`, s.testing ? `${'Test running'.padEnd(20)}${String(Math.ceil(s.testSecondsLeft)).padStart(3)} s` : `${'The other macaque'.padEnd(20)}${{ none: 'does nothing', copy: 'copies you', random: 'grasps at random', opposite: 'does the opposite' }[s.mode]}`]} testId="mirror-status" />
              <label style={{ fontSize: 12, display: 'flex', gap: 6, alignItems: 'center' }}>
                <input type="checkbox" checked={s.sideView} onChange={(e) => s.setSideView(e.target.checked)} /> Side view
              </label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {s.state === 'running' && <Btn onClick={() => s.finish()}>{s.step < 4 ? `Go on to Step ${s.step + 1}` : 'Finish Part 6'}</Btn>}
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

function Stage({ ctx }: { ctx: Ctx }) {
  const s = useStore(ctx.store)
  const spec = s.spec
  if (s.state === 'intro') return <InstructionScreen title={spec.title} willDo={[spec.reread, ...spec.willDo]} minutes={spec.minutes} sitting="leave any time" content={spec.content} keys={['“P”, or the “Precision grip” button: a precision grip.', '“W”, or the “Whole-hand grasp” button: a whole-hand grasp.']} onBegin={() => s.begin()} />
  if (s.state === 'predict')
    return (
      <StagePanel testId="predict">
        <div style={{ fontSize: 14, fontWeight: 600 }}>{spec.title}</div>
        <Note>Choose your prediction on the left and press “Commit my prediction”. Nothing runs until then.</Note>
      </StagePanel>
    )
  return null
}

function Right({ ctx }: { ctx: Ctx }) {
  const s = useThrottledStore(ctx.store, 100)
  const rest = restingFiring()
  return (
    <Panel title="Two premotor cells" style={RIGHT_STYLE}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} data-recording>
        <Traces trace={s.trace} marks={s.marks} now={s.time} />
        <Legend />
        <WeightTable cells={s.cells} />
        <GroupLabel>The test, this step</GroupLabel>
        <TestLines result={s.testResults[s.step] ?? null} rest={rest} />
        <Content>{MODEL_CELLS_LINE}</Content>
        {s.step === 4 && <Content>{HUMAN_RESULT_LINE}</Content>}
        <Content>{ROLES_LINE}</Content>
        <ReferencePanel reference={referenceById('catmur2007')} />
        <ReferencePanel reference={referenceById('mirror-share')} />
      </div>
    </Panel>
  )
}

export { MirrorStore }

export const mirror: PartModule<MirrorStore> = {
  createStore: (seed, progress) => new MirrorStore(seed, progress),
  Left,
  Stage,
  Right,
  Canvas: ({ ctx }) => <MacaqueScene store={ctx.store} />,
}
