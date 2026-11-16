import { Panel } from '../../components/Panel'
import type { ProgressStore } from '../../sim/language/progress/store'
import { Content, FixedLines, Note, RIGHT_STYLE, PART_TITLES, useStore } from './ui'
import { StepLeft, StepStage } from './steps'
import { MADE_UP_LANGUAGE_LINE } from './lines'
import type { PartContext, PartModule } from './contract'
import { StreamStore, MINUTE_UNIT, BOARD_UNIT } from './stream/store'
import { SCREENS, STEP_TITLES } from './stream/screens'
import { Step1Stage } from './stream/Step1'
import { Step2Stage, Step2Panel } from './stream/Step2'
import { Step3Stage, Step3Controls } from './stream/Step3'
import { Step4Stage, Step4Controls } from './stream/Step4'
import { MinuteReveal, BoardReveal, StreamResults } from './stream/Reveal'
import { registerResults } from './Part0'

/**
 * Part 2's screens (spec §6): the left column runs the step; the stage
 * carries the instruction screen and then the minute, the board, the
 * learners, or the real speech; the right column carries the board's panel
 * of counts and, once a unit is complete, its reveal.
 */

type Ctx = PartContext<StreamStore>

registerResults(2, (progress: ProgressStore) => <StreamResults progress={progress} />)

function progressLines(s: StreamStore): string[] {
  const p = s.progress
  return [`Step 1  ${p.isComplete(MINUTE_UNIT) ? 'done' : 'not started'}`, `Step 2  ${p.isComplete(BOARD_UNIT) ? 'done' : s.board.found.length ? `${s.board.found.length} ${s.board.found.length === 1 ? 'word' : 'words'} found` : 'not started'}`, `Step 3  an exploration${s.allPredicted ? ', predictions committed' : ''}`, 'Step 4  an exploration']
}

function Left({ ctx }: { ctx: Ctx }) {
  return <StepLeft ctx={ctx} tab="stream" screens={SCREENS} progressLines={progressLines} topLines={[MADE_UP_LANGUAGE_LINE]} controls={(s) => (s.step === 3 ? <Step3Controls s={s} /> : s.step === 4 ? <Step4Controls s={s} /> : null)} />
}

function Stage({ ctx }: { ctx: Ctx }) {
  return <StepStage ctx={ctx} tab="stream" screens={SCREENS} running={(s) => (s.step === 1 ? <Step1Stage s={s} /> : s.step === 2 ? <Step2Stage s={s} /> : s.step === 3 ? <Step3Stage s={s} /> : <Step4Stage s={s} />)} done={(s) => (s.step === 1 ? <Step1Stage s={s} /> : s.step === 2 ? <Step2Stage s={s} /> : null)} />
}

function Right({ ctx }: { ctx: Ctx }) {
  const s = useStore(ctx.store)
  useStore(ctx.progress)
  const minute = s.minuteResult()
  const board = s.boardResult()
  return (
    <Panel title={`${PART_TITLES.stream}: ${STEP_TITLES[s.step].replace(/^Step \d — /, '')}`} style={RIGHT_STYLE}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <FixedLines lines={progressLines(s)} testId="results-progress" />
        {s.loadError && <Note data-load-error>{s.loadError}</Note>}
        {s.step === 1 && (minute ? <MinuteReveal result={minute} /> : <Note data-results-pending>The results of this step appear here once your answer is committed. Nothing about the language’s words is shown before then.</Note>)}
        {s.step === 2 && s.state !== 'intro' && !board && <Step2Panel s={s} />}
        {s.step === 2 && board && <BoardReveal seed={s.seed} result={board} />}
        {s.step === 3 && s.state !== 'intro' && <Content>Each learner’s panel is in the center, under the plot. The reveal’s table of scores fills in as you run the learners at each amount.</Content>}
        {s.step === 4 && s.state !== 'intro' && <Content>The strip, the histogram, and the dips learner’s shares are in the center. Choose an utterance on the left.</Content>}
      </div>
    </Panel>
  )
}

export const stream: PartModule<StreamStore> = {
  createStore: (seed, progress) => new StreamStore(seed, progress),
  Left,
  Stage,
  Right,
  Results: StreamResults,
}
export { StreamStore }
