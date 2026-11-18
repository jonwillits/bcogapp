import type { ProgressStore } from '../../sim/language/progress/store'
import { Note, useStore } from './ui'
import { StepNav, StepStage } from './steps'
import { MADE_UP_LANGUAGE_LINE } from './lines'
import type { PartContext, PartModule } from './contract'
import { StreamStore, MINUTE_UNIT, BOARD_UNIT, type BoardResult, type MinuteResult } from './stream/store'
import { SCREENS, STEP_TITLES } from './stream/screens'
import { Step1Stage } from './stream/Step1'
import { Step2Stage } from './stream/Step2'
import { Step3Stage } from './stream/Step3'
import { Step4Stage } from './stream/Step4'
import { MinuteReveal, BoardReveal } from './stream/Reveal'
import { registerStepResults } from './results'

/**
 * Part 2's screens (spec §6): the navigation panel is navigation only (Jon,
 * 2026-11-16, LAB_COMMON_FEATURES §1); the main panel carries the
 * instruction screen and then the minute, the board with its panel of
 * counts beside it, the learners with their predictions and slider, or the
 * real speech with its menu, and, once a unit is complete, its reveal under
 * the step (Jon, 2026-11-18). Steps 1 and 2 register their results for the
 * All Results tab.
 */

type Ctx = PartContext<StreamStore>

registerStepResults([
  { part: 2, tab: 'stream', step: 1, title: STEP_TITLES[1], done: (p: ProgressStore) => p.isComplete(MINUTE_UNIT), render: (p: ProgressStore) => <MinuteReveal result={p.result(MINUTE_UNIT) as MinuteResult} mode="results" /> },
  { part: 2, tab: 'stream', step: 2, title: STEP_TITLES[2], done: (p: ProgressStore) => p.isComplete(BOARD_UNIT), render: (p: ProgressStore) => <BoardReveal seed={p.seed} result={p.result(BOARD_UNIT) as BoardResult} mode="results" /> },
])

function progressLines(s: StreamStore): string[] {
  const p = s.progress
  return [`Step 1  ${p.isComplete(MINUTE_UNIT) ? 'done' : 'not started'}`, `Step 2  ${p.isComplete(BOARD_UNIT) ? 'done' : s.board.found.length ? `${s.board.found.length} ${s.board.found.length === 1 ? 'word' : 'words'} found` : 'not started'}`, `Step 3  an exploration${s.allPredicted ? ', predictions committed' : ''}`, 'Step 4  an exploration']
}

function Nav({ ctx }: { ctx: Ctx }) {
  return <StepNav ctx={ctx} tab="stream" screens={SCREENS} progressLines={progressLines} topLines={[MADE_UP_LANGUAGE_LINE]} />
}

function Stage({ ctx }: { ctx: Ctx }) {
  const s = useStore(ctx.store)
  const error = s.loadError ? <Note data-load-error>{s.loadError}</Note> : null
  return (
    <StepStage
      ctx={ctx}
      tab="stream"
      screens={SCREENS}
      running={(s) => (
        <>
          {error}
          {s.step === 1 ? <Step1Stage s={s} /> : s.step === 2 ? <Step2Stage s={s} /> : s.step === 3 ? <Step3Stage s={s} /> : <Step4Stage s={s} />}
        </>
      )}
      done={(s) => (
        <>
          {error}
          {s.step === 1 ? <Step1Stage s={s} onNext={() => ctx.openStep(2)} /> : s.step === 2 ? <Step2Stage s={s} onNext={() => ctx.openStep(3)} /> : null}
        </>
      )}
    />
  )
}

export const stream: PartModule<StreamStore> = {
  createStore: (seed, progress) => new StreamStore(seed, progress),
  Nav,
  Stage,
}
export { StreamStore }
