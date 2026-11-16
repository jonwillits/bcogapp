import { Panel } from '../../components/Panel'
import { Content, FixedLines, RIGHT_STYLE, PART_TITLES, useStore } from './ui'
import { StepLeft, StepStage } from './steps'
import { ONE_CORPUS_LINE } from './lines'
import type { PartContext, PartModule } from './contract'
import { PredictorsStore } from './predictors/store'
import { SCREENS, STEP_TITLES } from './predictors/screens'
import { Step1Stage, Step1Panel } from './predictors/Step1'
import { Step2Stage, Step2Controls } from './predictors/Step2'
import { Step3Stage, Step3Controls } from './predictors/Step3'
import { Step4Stage, Step4Controls } from './predictors/Step4'
import { Step5Stage, Step5Controls } from './predictors/Step5'

/**
 * Part 4's screens (spec §8): the left column runs the step and holds its
 * predictions and settings; the stage carries the corpus, the count model,
 * the predictors, and the snapshots; the right column carries the
 * grammar's rules and each step's pointer.
 */

type Ctx = PartContext<PredictorsStore>

function progressLines(s: PredictorsStore): string[] {
  return [`Step 1  an exploration`, `Step 2  an exploration${s.predicted('nearest') ? ', prediction committed' : ''}`, `Step 3  an exploration${s.predicted('counts') ? ', prediction committed' : ''}`, `Step 4  an exploration${s.allPredicted4 ? ', predictions committed' : ''}`, `Step 5  an exploration`]
}

function Left({ ctx }: { ctx: Ctx }) {
  return <StepLeft ctx={ctx} tab="predictors" screens={SCREENS} progressLines={progressLines} topLines={[ONE_CORPUS_LINE]} controls={(s) => (s.step === 2 ? <Step2Controls s={s} /> : s.step === 3 ? <Step3Controls s={s} /> : s.step === 4 ? <Step4Controls s={s} /> : s.step === 5 ? <Step5Controls s={s} /> : null)} />
}

function Stage({ ctx }: { ctx: Ctx }) {
  return <StepStage ctx={ctx} tab="predictors" screens={SCREENS} running={(s) => (s.step === 1 ? <Step1Stage s={s} /> : s.step === 2 ? <Step2Stage s={s} /> : s.step === 3 ? <Step3Stage s={s} /> : s.step === 4 ? <Step4Stage s={s} /> : <Step5Stage s={s} />)} />
}

function Right({ ctx }: { ctx: Ctx }) {
  const s = useStore(ctx.store)
  useStore(ctx.progress)
  return (
    <Panel title={`${PART_TITLES.predictors}: ${STEP_TITLES[s.step].replace(/^Step \d — /, '')}`} style={RIGHT_STYLE}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <FixedLines lines={progressLines(s)} testId="results-progress" />
        {s.state !== 'intro' && s.step === 1 && <Step1Panel />}
        {s.state !== 'intro' && s.step === 2 && <Content>The settings and the prediction are on the left; the table of counts and the three views are in the center.</Content>}
        {s.state !== 'intro' && s.step === 3 && <Content>The three screens’ names are on the left; the switch and the prediction are there too.</Content>}
        {s.state !== 'intro' && s.step === 4 && <Content>The two predictions, the temperature, and “Generate a sentence” are on the left; the prompt, the distributions, and the attention are in the center.</Content>}
        {s.state !== 'intro' && s.step === 5 && <Content>The snapshot slider and “Change the prompt” are on the left; the three panels are in the center.</Content>}
      </div>
    </Panel>
  )
}

export const predictors: PartModule<PredictorsStore> = {
  createStore: (seed, progress) => new PredictorsStore(seed, progress),
  Left,
  Stage,
  Right,
}
export { PredictorsStore }
