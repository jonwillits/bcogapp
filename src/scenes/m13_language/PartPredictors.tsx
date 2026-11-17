import { Panel } from '../../components/Panel'
import { FixedLines, Note, RIGHT_STYLE, PART_TITLES, useStore } from './ui'
import { StepLeft, StepStage } from './steps'
import { ONE_CORPUS_LINE } from './lines'
import type { PartContext, PartModule } from './contract'
import { PredictorsStore } from './predictors/store'
import { SCREENS, STEP_TITLES } from './predictors/screens'
import { Step1Stage } from './predictors/Step1'
import { Step2Stage } from './predictors/Step2'
import { Step3Stage } from './predictors/Step3'
import { Step4Stage } from './predictors/Step4'
import { Step5Stage } from './predictors/Step5'

/**
 * Part 4's screens (spec §8; Jon, 2026-11-16 and 2026-11-17): the left
 * column is navigation only (the header, the step buttons, the progress
 * rows, Begin, Go on/back, Show the instructions again); the stage carries
 * everything a step shows or asks: its settings, predictions, the corpus,
 * the count model and its views, the predictors, and the snapshots; the
 * right column carries the progress rows and one line saying where the
 * step's content is.
 */

type Ctx = PartContext<PredictorsStore>

function progressLines(s: PredictorsStore): string[] {
  return [`Step 1  an exploration`, `Step 2  an exploration${s.predicted('nearest') ? ', prediction committed' : ''}`, `Step 3  an exploration${s.predicted('counts') ? ', prediction committed' : ''}`, `Step 4  an exploration${s.allPredicted4 ? ', predictions committed' : ''}`, `Step 5  an exploration`]
}

function Left({ ctx }: { ctx: Ctx }) {
  return <StepLeft ctx={ctx} tab="predictors" screens={SCREENS} progressLines={progressLines} topLines={[ONE_CORPUS_LINE]} />
}

function Stage({ ctx }: { ctx: Ctx }) {
  return <StepStage ctx={ctx} tab="predictors" screens={SCREENS} running={(s) => (s.step === 1 ? <Step1Stage s={s} /> : s.step === 2 ? <Step2Stage s={s} /> : s.step === 3 ? <Step3Stage s={s} /> : s.step === 4 ? <Step4Stage s={s} /> : <Step5Stage s={s} />)} />
}

/** What each running step shows in the center, as one true line for the right column. */
const WHERE: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: 'This column shows the steps’ progress only. The vocabulary, the grammar’s rules, “Show me sentences”, and the sentences are all in the center panel.',
  2: 'This column shows the steps’ progress only. The settings, the prediction, “Count”, the table of counts, the similarity demo, the plane, the nearest neighbors, and the tree are all in the center panel.',
  3: 'This column shows the steps’ progress only. The three screens’ names, the switch, the prediction, “Compute”, and the distributions are all in the center panel.',
  4: 'This column shows the steps’ progress only. The two predictions, the prompt and its palette, the distributions, the attention, “Temperature”, “Generate a sentence”, and the generated sentences are all in the center panel.',
  5: 'This column shows the steps’ progress only. The “Snapshot” slider, “Change the prompt”, and the three panels are all in the center panel.',
}

function Right({ ctx }: { ctx: Ctx }) {
  const s = useStore(ctx.store)
  useStore(ctx.progress)
  return (
    <Panel title={`${PART_TITLES.predictors}: ${STEP_TITLES[s.step].replace(/^Step \d — /, '')}`} style={RIGHT_STYLE}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <FixedLines lines={progressLines(s)} testId="results-progress" />
        {s.state !== 'intro' && <Note data-where>{WHERE[s.step]}</Note>}
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
