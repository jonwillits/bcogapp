import { StepNav, StepStage } from './steps'
import { ONE_CORPUS_LINE } from './lines'
import type { PartContext, PartModule } from './contract'
import { PredictorsStore } from './predictors/store'
import { SCREENS } from './predictors/screens'
import { Step1Stage } from './predictors/Step1'
import { Step2Stage } from './predictors/Step2'
import { Step3Stage } from './predictors/Step3'
import { Step4Stage } from './predictors/Step4'
import { Step5Stage } from './predictors/Step5'

/**
 * Part 4's screens (spec §8; Jon, 2026-11-16 to 2026-11-18): the navigation
 * panel is navigation only (the header, the step buttons, the progress
 * rows, Begin, Go on/back, Show the instructions again); the main panel
 * carries everything a step shows or asks: its settings, predictions, the
 * corpus, the count model and its views, the predictors, and the
 * snapshots. Nothing in Part 4 is saved, so it has no entry on the All
 * Results tab.
 */

type Ctx = PartContext<PredictorsStore>

function progressLines(s: PredictorsStore): string[] {
  return [`Step 1  an exploration`, `Step 2  an exploration${s.predicted('nearest') ? ', prediction committed' : ''}`, `Step 3  an exploration${s.predicted('counts') ? ', prediction committed' : ''}`, `Step 4  an exploration${s.allPredicted4 ? ', predictions committed' : ''}`, `Step 5  an exploration`]
}

function Nav({ ctx }: { ctx: Ctx }) {
  return <StepNav ctx={ctx} tab="predictors" screens={SCREENS} progressLines={progressLines} topLines={[ONE_CORPUS_LINE]} />
}

function Stage({ ctx }: { ctx: Ctx }) {
  return <StepStage ctx={ctx} tab="predictors" screens={SCREENS} running={(s) => (s.step === 1 ? <Step1Stage s={s} /> : s.step === 2 ? <Step2Stage s={s} /> : s.step === 3 ? <Step3Stage s={s} /> : s.step === 4 ? <Step4Stage s={s} /> : <Step5Stage s={s} />)} />
}

export const predictors: PartModule<PredictorsStore> = {
  createStore: (seed, progress) => new PredictorsStore(seed, progress),
  Nav,
  Stage,
}
export { PredictorsStore }
