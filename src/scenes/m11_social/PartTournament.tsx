import { Panel } from '../../components/Panel'
import type { ProgressStore } from '../../sim/social/progress/store'
import { RULES, OUTCOMES, cooperates } from '../../sim/social/game/rules'
import { MUTATIONS, START_WORLDS, type StartWorld } from '../../sim/social/game/grid'
import { Btn, Choice, Content, FixedLines, GroupLabel, Note, PANEL_STYLE, PART_TITLES, RIGHT_STYLE, StagePanel, useStore, moveWord } from './ui'
import { InstructionScreen } from '../m10_memory/progress/InstructionScreen'
import { NO_BRAIN_LINE } from './lines'
import type { PartModule } from './contract'
import { TournamentStore, NOISES, GRID_SPEEDS, type GridSpeed } from './tournament/store'
import { STEPS, type Step } from './tournament/steps'
import { GenerationsPanel, GridPanel, PredictorPanel, ReferenceForStep3, ReferenceForStep4, ReferenceForStep7, RoundRobinTable, RuleBuilder, TwoRulesPanel } from './tournament/panels'

/**
 * Part 2's screens (spec §6): the left column runs the step (the chips,
 * the instruction screen's Begin with Go back and Go to, the predictions
 * and Commit my prediction, the step's controls, Go on and Redo); the
 * stage carries the step's panels once its predictions are committed; the
 * right column carries the six rules as tables, the student's rule, and
 * the content lines.
 */

type Ctx = { store: TournamentStore; header: React.ReactNode; progress: ProgressStore; seed: number }

function Left({ ctx }: { ctx: Ctx }) {
  const s = useStore(ctx.store)
  const spec = s.spec
  return (
    <>
      {ctx.header}
      <Panel title={PART_TITLES.tournament} style={PANEL_STYLE}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Content>{NO_BRAIN_LINE}</Content>
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
                {s.step < 7 && <Btn onClick={() => s.open((s.step + 1) as Step)}>Go to Step {s.step + 1}</Btn>}
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
              <FixedLines lines={spec.predictions.map((p) => `${p.question.slice(0, 44)}`)} mono={false} />
              <FixedLines lines={spec.predictions.map((p) => `Your prediction: ${s.prediction(p.key) ?? '—'}`)} mono={false} />
              <StepControls s={s} />
              {s.badge && <Note data-badge>{s.badge}</Note>}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {s.state === 'running' && <Btn onClick={() => s.finish()}>{s.step < 7 ? `Go on to Step ${s.step + 1}` : 'Finish Part 2'}</Btn>}
                {s.state === 'done' && s.step < 7 && <Btn onClick={() => s.open((s.step + 1) as Step)}>Go on to Step {s.step + 1}</Btn>}
                {s.state === 'done' && <Btn onClick={() => s.redo()}>Redo Step {s.step}</Btn>}
              </div>
            </>
          )}
        </div>
      </Panel>
    </>
  )
}

function StepControls({ s }: { s: TournamentStore }) {
  switch (s.step) {
    case 1:
      return <Note>The four runs are on the stage, with the sliders for R and x.</Note>
    case 2:
      return <Note>Set the chips on the stage. The rule is saved as you set it.</Note>
    case 3:
      return (
        <div>
          <Btn primary onClick={() => s.runRoundRobin()}>
            Run the round-robin
          </Btn>
        </div>
      )
    case 4:
      return (
        <div>
          <Btn primary onClick={() => s.runWithPredictor()} disabled={s.working || !!s.rr4}>
            Run with Predictor
          </Btn>
        </div>
      )
    case 5:
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <GroupLabel>Noise: each move flipped with this probability</GroupLabel>
          <Choice value={String(s.noise)} options={NOISES.map((n) => ({ id: String(n), label: `${Math.round(n * 100)}%` }))} onChange={(v) => s.setNoise(Number(v) as (typeof NOISES)[number])} />
          <div>
            <Btn primary onClick={() => s.runWithNoise()} disabled={s.working || !!s.rr5}>
              Run with mistakes
            </Btn>
          </div>
        </div>
      )
    case 6:
      return (
        <div>
          <Btn primary onClick={() => s.runGenerationsNow()} disabled={s.working || !!s.gen}>
            Run the generations
          </Btn>
          <Note>The cost slider is on the stage once the generations have run. The noise is Step 5’s: {Math.round(s.noise * 100)}%.</Note>
        </div>
      )
    case 7:
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }} data-grid-controls>
          <GroupLabel>Start world</GroupLabel>
          <Choice value={s.world} options={START_WORLDS.map((w) => ({ id: w.id, label: w.label }))} onChange={(v) => s.setWorld(v as StartWorld)} />
          <GroupLabel>Mutation per cell per generation</GroupLabel>
          <Choice value={String(s.mutation)} options={MUTATIONS.map((m) => ({ id: String(m), label: `${(m * 100).toFixed(1)}%` }))} onChange={(v) => s.setMutation(Number(v) as (typeof MUTATIONS)[number])} />
          <GroupLabel>Speed, generations a second</GroupLabel>
          <Choice value={s.speed} options={(Object.keys(GRID_SPEEDS) as GridSpeed[]).map((k) => ({ id: k, label: `${k} (${GRID_SPEEDS[k]})` }))} onChange={(v) => s.setSpeed(v as GridSpeed)} />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {!s.running ? (
              <Btn primary onClick={() => s.runGrid()}>
                Run
              </Btn>
            ) : (
              <Btn onClick={() => s.pauseGrid()}>Pause</Btn>
            )}
            <Btn onClick={() => s.skipAhead()}>Skip ahead 1,000 generations</Btn>
            <Btn onClick={() => s.startGrid()}>Start again</Btn>
          </div>
          {s.world === 'alld' && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <Btn onClick={() => s.dropBlock(2)}>Drop a 2 × 2 block of tit-for-tat</Btn>
              <Btn onClick={() => s.dropBlock(3)}>Drop a 3 × 3 block of tit-for-tat</Btn>
            </div>
          )}
          <Note>The noise is Step 5’s: {Math.round(s.noise * 100)}%. Eight neighbors, 10 rounds an encounter, 40 × 40 cells.</Note>
        </div>
      )
  }
}

function Stage({ ctx }: { ctx: Ctx }) {
  const s = useStore(ctx.store)
  const spec = s.spec
  if (s.state === 'intro') return <InstructionScreen title={spec.title} willDo={[spec.reread, ...spec.willDo]} minutes={spec.minutes} sitting="leave any time" content={spec.content} onBegin={() => s.begin()} />
  if (s.state === 'predict')
    return (
      <StagePanel testId="predict">
        <div style={{ fontSize: 14, fontWeight: 600 }}>{spec.title}</div>
        <Note>Choose your prediction on the left and press “Commit my prediction”. Nothing runs until then.</Note>
      </StagePanel>
    )
  return (
    <StagePanel wide testId={`step-${s.step}`}>
      <div style={{ fontSize: 14, fontWeight: 600 }}>{spec.title}</div>
      {s.step === 1 && <TwoRulesPanel s={s} />}
      {s.step === 2 && <RuleBuilder s={s} />}
      {s.step === 3 && (s.rr3 ? <RoundRobinTable rr={s.rr3} testId="rr3" /> : <Note>Press “Run the round-robin” on the left.</Note>)}
      {s.step === 3 && <ReferenceForStep3 />}
      {s.step === 4 && (s.rr4 && s.versus.length ? <PredictorPanel s={s} /> : <Note>{s.working ? s.badge : 'Press “Run with Predictor” on the left.'}</Note>)}
      {s.step === 4 && <ReferenceForStep4 />}
      {s.step === 5 && (s.rr5 ? <RoundRobinTable rr={s.rr5} against={s.rr4} testId="rr5" /> : <Note>{s.working ? s.badge : 'Set the noise on the left and press “Run with mistakes”.'}</Note>)}
      {s.step === 6 && (s.gen ? <GenerationsPanel s={s} /> : <Note>{s.working ? s.badge : 'Press “Run the generations” on the left.'}</Note>)}
      {s.step === 7 && <GridPanel s={s} />}
      {s.step === 7 && <ReferenceForStep7 />}
    </StagePanel>
  )
}

function Right({ ctx }: { ctx: Ctx }) {
  const s = useStore(ctx.store)
  const mine = s.myRule()
  const tableOf = (r: { first: number; after: Record<string, number> }) => `${moveWord(r.first === 1 ? 'C' : 'D').slice(0, 1)}  ${OUTCOMES.map((o) => (cooperates(r as never, o) === 1 ? 'C' : cooperates(r as never, o) === 0 ? 'D' : cooperates(r as never, o).toFixed(2))).join('  ')}`
  return (
    <Panel title="The rules" style={RIGHT_STYLE}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Note>Every entry is a table of moves: a first move, then a move after each outcome of the previous round, from its own side (its move, then the partner’s). C is cooperate, D defect; a fraction is how often it cooperates.</Note>
        <FixedLines lines={[`${''.padEnd(36)}${'first'.padEnd(4)}${'CC'.padEnd(3)}${'CD'.padEnd(3)}${'DC'.padEnd(3)}${'DD'}`, ...RULES.map((r) => `${r.label.padEnd(36)}${tableOf(r)}`), `${mine.label.padEnd(36)}${tableOf(mine)}`]} testId="rules-table" />
        <FixedLines lines={RULES.map((r) => `${r.label}: ${r.description}`)} mono={false} />
        <Note>Predictor is not a table: it estimates and searches (Step 4).</Note>
      </div>
    </Panel>
  )
}

export { TournamentStore }

export const tournament: PartModule<TournamentStore> = {
  createStore: (seed, progress) => new TournamentStore(seed, progress),
  Left,
  Stage,
  Right,
}
