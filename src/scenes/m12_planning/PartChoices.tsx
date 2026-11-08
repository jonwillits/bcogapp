import { useEffect } from 'react'
import { Panel } from '../../components/Panel'
import type { ProgressStore } from '../../sim/planning/progress/store'
import { FRAMING, ANCHOR, PAIRS, seriesOptions, type Item } from '../../sim/planning/choices/gambles'
import { DELAYS, REVERSAL_PAIRS, LATER_AMOUNT } from '../../sim/planning/choices/delays'
import { dollars, type Option } from '../../sim/planning/choices/options'
import { Btn, Choice, Content, FixedLines, GroupLabel, Note, PANEL_STYLE, PART_TITLES, RIGHT_STYLE, StagePanel, useStore } from './ui'
import { InstructionScreen } from '../m10_memory/progress/InstructionScreen'
import { HYPOTHETICAL_MONEY_LINE } from './lines'
import type { PartContext, PartModule } from './contract'
import { ChoicesStore, GAMBLES_UNIT, DELAYS_UNIT, dispenserUnit } from './choices/store'
import { SCREENS, STEP_TITLES, READY_LINE, type Step } from './choices/screens'
import { OptionCards, Wheel, HigherLower, Estimate, DiseaseProblem, capital } from './choices/Cards'
import { DispenserScreen } from './choices/Dispenser'
import { ForagerScreen } from './choices/Forager'
import { GamblesReveal, DelaysReveal, DispensersReveal, ChoicesResults } from './choices/Reveal'
import { registerResults } from './Part0'

/**
 * Part 1's screens (spec §5): the left column runs the step (the step
 * buttons, Begin with Go to and Go back, the progress through a step's
 * items, Redo for the exploration); the stage carries the instruction
 * screen, the cards, the wheel, the dispenser or the bird; the right column
 * carries the step's reveal once its unit is complete, and a line saying
 * what is missing before that.
 */

type Ctx = PartContext<ChoicesStore>

registerResults(1, (progress: ProgressStore) => <ChoicesResults progress={progress} />)

function Left({ ctx }: { ctx: Ctx }) {
  const s = useStore(ctx.store)
  const p = useStore(ctx.progress)
  const screen = SCREENS[s.step]
  const state = s.state
  return (
    <>
      {ctx.header}
      <Panel title={PART_TITLES.choices} style={PANEL_STYLE}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Content>{HYPOTHETICAL_MONEY_LINE}</Content>
          <GroupLabel>Step</GroupLabel>
          <Choice value={String(s.step)} options={([1, 2, 3, 4] as Step[]).map((st) => ({ id: String(st), label: `Step ${st}`, title: STEP_TITLES[st] }))} onChange={(v) => s.open(Number(v) as Step)} />
          <Note>{screen.title}</Note>
          <FixedLines lines={[`Step 1  ${p.isComplete(GAMBLES_UNIT) ? 'done' : `${s.gamblesDoneCount()} of ${s.gamblePlan.items.length} choices made`}`, `Step 2  ${p.isComplete(DELAYS_UNIT) ? 'done' : `${s.delays.next} of ${s.delayPlan.items.length} choices made`}`, `Step 3  ${p.isComplete(dispenserUnit(0)) && p.isComplete(dispenserUnit(1)) ? 'both blocks done' : p.isComplete(dispenserUnit(0)) ? 'block 1 of 2 done' : 'no block done'}`, `Step 4  an exploration`]} testId="step-progress" />
          {state === 'intro' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} data-intro>
              <Note>What you will do is described over the view. Read it, then press “Begin”.</Note>
              <Content>{`About ${screen.minutes} minutes. ${screen.kind === 'experiment' ? 'An experiment, done once.' : 'An exploration: leave and return at any time.'}`}</Content>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <Btn primary onClick={() => s.begin()}>
                  Begin
                </Btn>
                {s.step > 1 && <Btn onClick={() => s.open((s.step - 1) as Step)}>Go back to Step {s.step - 1}</Btn>}
                {s.step < 4 && <Btn onClick={() => s.open((s.step + 1) as Step)}>Go to Step {s.step + 1}</Btn>}
              </div>
            </div>
          )}
          {state === 'running' && s.step === 1 && <Note>Choice {s.gamblesDoneCount() + 1} of {s.gamblePlan.items.length}. The results of this step appear on the right after the last choice.</Note>}
          {state === 'running' && s.step === 2 && <Note>Choice {s.delays.next + 1} of {s.delayPlan.items.length}. The results of this step appear on the right after the last choice.</Note>}
          {state === 'running' && s.step === 3 && <Note>Block {s.blockIndex + 1} of 2 is running over the view. The results of this step appear on the right when both blocks are done.</Note>}
          {state === 'running' && s.step === 4 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <Btn onClick={() => s.reopen()}>Show the instructions again</Btn>
            </div>
          )}
          {(state === 'done' || (state === 'running' && s.step === 4)) && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {s.step > 1 && <Btn onClick={() => s.open((s.step - 1) as Step)}>Go back to Step {s.step - 1}</Btn>}
              {s.step < 4 && <Btn onClick={() => s.open((s.step + 1) as Step)}>Go on to Step {s.step + 1}</Btn>}
            </div>
          )}
          {state === 'done' && <Note>This step is done and saved. Its results are on the right. An experiment is not redone: someone who knows what it tests is no longer a naive subject.</Note>}
        </div>
      </Panel>
    </>
  )
}

function Stage({ ctx }: { ctx: Ctx }) {
  const s = useStore(ctx.store)
  useStore(ctx.progress)
  const screen = SCREENS[s.step]
  const state = s.state
  if (state === 'intro') return <InstructionScreen title={screen.title} willDo={screen.willDo} minutes={screen.minutes} sitting={screen.sitting} sittingLine={screen.sittingLine} ready={READY_LINE} keys={screen.keys} content={screen.content} onBegin={() => s.begin()} />
  if (s.step === 1) return state === 'done' ? <DoneStage title={screen.title} /> : <GamblesStage s={s} />
  if (s.step === 2) return state === 'done' ? <DoneStage title={screen.title} /> : <DelaysStage s={s} />
  if (s.step === 3)
    return state === 'done' ? (
      <DoneStage title={screen.title} />
    ) : (
      <StagePanel testId="dispenser">
        <div style={{ fontSize: 14, fontWeight: 600 }}>{screen.title}</div>
        <DispenserScreen s={s} />
      </StagePanel>
    )
  return (
    <StagePanel wide testId="forager">
      <div style={{ fontSize: 14, fontWeight: 600 }}>{screen.title}</div>
      <ForagerScreen s={s} />
    </StagePanel>
  )
}

function DoneStage({ title }: { title: string }) {
  return (
    <StagePanel testId="done">
      <div style={{ fontSize: 14, fontWeight: 600 }}>{title}</div>
      <Note>This step is done. Its results are on the right, and under “My results, all parts” on the Open tab.</Note>
    </StagePanel>
  )
}

function GamblesStage({ s }: { s: ChoicesStore }) {
  const it = s.currentItem
  useEffect(() => {
    s.noteShown()
  }, [s, it])
  if (!it) return null
  const swap = s.gamblePlan.swap[s.gambles.next]
  const title = SCREENS[1].title
  const count = `Choice ${s.gamblesDoneCount() + 1} of ${s.gamblePlan.items.length}`
  if (it.kind === 'wheel') {
    const q = (it.materials === 1 ? ANCHOR.reserve : ANCHOR.published).quantity
    return (
      <StagePanel testId="wheel">
        <div style={{ fontSize: 14, fontWeight: 600 }}>{title}</div>
        <Note>{count}: the wheel of fortune.</Note>
        <Wheel stopsAt={it.anchor} state={s.wheel} onSpin={() => s.spin()} />
        {s.wheel === 'stopped' && s.higher === null && <HigherLower quantity={q} stopsAt={it.anchor} onAnswer={(h) => s.answerHigher(h)} />}
        {s.wheel === 'stopped' && s.higher !== null && <Estimate quantity={q} onSubmit={(v) => s.answerEstimate(v)} />}
      </StagePanel>
    )
  }
  if (it.kind === 'disease') {
    const f = it.materials === 1 ? FRAMING.reserve : FRAMING.published
    const programs = it.version === 'saved' ? f.saved : f.lost
    const shown: [string, string] = swap ? [programs[1], programs[0]] : [programs[0], programs[1]]
    return (
      <StagePanel wide testId="disease">
        <div style={{ fontSize: 14, fontWeight: 600 }}>{title}</div>
        <Note>{count}.</Note>
        <DiseaseProblem intro={f.intro} programs={shown} question={f.question} onChoose={(side) => s.chooseCard(side)} />
      </StagePanel>
    )
  }
  let a: Option
  let b: Option
  if (it.kind === 'pair') [a, b] = PAIRS[it.pair][it.version].options
  else {
    const { fixed, varying } = seriesOptions(it.series, s.gambles.responses.series[it.series].x)
    a = fixed
    b = varying
  }
  const shown: [Option, Option] = swap ? [b, a] : [a, b]
  const question = it.kind === 'series' && it.series === 'mixed' ? 'Would you accept this gamble, or take nothing?' : 'Which would you choose?'
  return (
    <StagePanel wide testId="cards">
      <div style={{ fontSize: 14, fontWeight: 600 }}>{title}</div>
      <Note>{count}. All amounts are hypothetical.</Note>
      <OptionCards a={shown[0]} b={shown[1]} onChoose={(side) => s.chooseCard(side)} question={question} />
    </StagePanel>
  )
}

function DelaysStage({ s }: { s: ChoicesStore }) {
  const it = s.currentDelayItem
  if (!it) return null
  const swap = s.delayPlan.swap[s.delays.next]
  let a: Option
  let b: Option
  if (it.kind === 'titration') {
    const d = DELAYS.find((x) => x.id === it.delay)!
    const x = s.delays.responses.titrations[it.delay].x
    a = { outcomes: [{ amount: x, p: 1 }], text: `${dollars(x)} today` }
    b = { outcomes: [{ amount: LATER_AMOUNT, p: 1 }], text: `$${LATER_AMOUNT} after ${d.label}` }
  } else {
    const pr = REVERSAL_PAIRS.find((x) => x.id === it.pair)!
    a = { outcomes: [{ amount: pr.sooner.amount, p: 1 }], text: pr.sooner.label }
    b = { outcomes: [{ amount: pr.later.amount, p: 1 }], text: pr.later.label }
  }
  const shown: [Option, Option] = swap ? [b, a] : [a, b]
  return (
    <StagePanel wide testId="delay-cards">
      <div style={{ fontSize: 14, fontWeight: 600 }}>{SCREENS[2].title}</div>
      <Note>Choice {s.delays.next + 1} of {s.delayPlan.items.length}. All amounts are hypothetical.</Note>
      <OptionCards a={shown[0]} b={shown[1]} onChoose={(side) => s.chooseDelayCard(side)} question="Which would you choose?" />
    </StagePanel>
  )
}

function Right({ ctx }: { ctx: Ctx }) {
  const s = useStore(ctx.store)
  const p = useStore(ctx.progress)
  if (s.step === 4)
    return (
      <Panel title="Step 4" style={RIGHT_STYLE}>
        <Note>Step 4 is an exploration. What it shows is on the screen in the middle, and nothing is saved from it.</Note>
      </Panel>
    )
  const done = s.step === 1 ? p.isComplete(GAMBLES_UNIT) : s.step === 2 ? p.isComplete(DELAYS_UNIT) : s.bothBlocksDone
  return (
    <Panel title={`My results: ${STEP_TITLES[s.step]}`} style={RIGHT_STYLE}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {!done && <Note>{s.step === 3 ? 'The results of this step appear here once both blocks are done.' : 'The results of this step appear here once its last choice is made. Nothing about what the choices measure is shown before then.'}</Note>}
        {done && s.step === 1 && <GamblesReveal progress={p} />}
        {done && s.step === 2 && <DelaysReveal progress={p} />}
        {done && s.step === 3 && <DispensersReveal progress={p} />}
      </div>
    </Panel>
  )
}

export { ChoicesStore, capital }
export type { Item }

export const choices: PartModule<ChoicesStore> = {
  createStore: (seed, progress) => new ChoicesStore(seed, progress),
  Left,
  Stage,
  Right,
  Results: ({ progress }) => <ChoicesResults progress={progress} />,
}
