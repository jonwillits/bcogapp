import type { ProgressStore } from '../../sim/language/progress/store'
import { Note, useStore } from './ui'
import { DoneStage, StepNav, StepStage } from './steps'
import { HEADPHONES_LINE } from './lines'
import type { PartContext, PartModule } from './contract'
import { SoundsStore, LABELS_UNIT, LABELING_UNIT, ABX_UNIT, type AbxResult, type LabelingResult, type LabelsResult } from './sounds/store'
import { SCREENS, STEP_TITLES } from './sounds/screens'
import { Step1Stage } from './sounds/Step1'
import { Step2Stage } from './sounds/Step2'
import { Step3Stage } from './sounds/Step3'
import { Step4Stage } from './sounds/Step4'
import { LabelsStage, LabelsTable, Step3Reveal } from './sounds/Reveal'
import { registerStepResults } from './results'

/**
 * Part 1's screens (spec §5): the navigation panel moves between steps and
 * carries no step's content (Jon, 2026-11-16); the main panel carries the
 * instruction screen and then the seven screens with their side text, the
 * six spectrograms, a block, or the network with its predictions, and,
 * once a step is done, its results with their explanation (Jon,
 * 2026-11-18). Steps 2 and 3 register their results for the All Results
 * tab, from the saved progress alone.
 */

type Ctx = PartContext<SoundsStore>

registerStepResults([
  { part: 1, tab: 'sounds', step: 2, title: STEP_TITLES[2], done: (p: ProgressStore) => p.isComplete(LABELS_UNIT), render: (p: ProgressStore) => <LabelsTable result={p.result(LABELS_UNIT) as LabelsResult} /> },
  {
    part: 1,
    tab: 'sounds',
    step: 3,
    title: STEP_TITLES[3],
    done: (p: ProgressStore) => p.isComplete(LABELING_UNIT) && p.isComplete(ABX_UNIT),
    render: (p: ProgressStore) => <Step3Reveal labeling={p.result(LABELING_UNIT) as LabelingResult} abx={p.result(ABX_UNIT) as AbxResult} mode="results" />,
  },
])

function progressLines(s: SoundsStore): string[] {
  const p = s.progress
  return [
    `Step 1  an exploration${s.predicted('pitch') ? ', prediction committed' : ''}`,
    `Step 2  ${p.isComplete(LABELS_UNIT) ? 'done' : s.stateOf(2) === 'running' ? `${Object.keys(s.labels).length} of 6 labeled` : 'not started'}`,
    `Step 3  ${p.isComplete(ABX_UNIT) ? 'both blocks done' : p.isComplete(LABELING_UNIT) ? 'block 1 of 2 done' : 'no block done'}`,
    `Step 4  an exploration${s.run1.state === 'done' ? ', run 1 done' : ''}`,
  ]
}

function Nav({ ctx }: { ctx: Ctx }) {
  return <StepNav ctx={ctx} tab="sounds" screens={SCREENS} progressLines={progressLines} topLines={[HEADPHONES_LINE]} />
}

function Stage({ ctx }: { ctx: Ctx }) {
  const s = useStore(ctx.store)
  const error = s.loadError ? <Note data-load-error>{s.loadError}</Note> : null
  return (
    <StepStage
      ctx={ctx}
      tab="sounds"
      screens={SCREENS}
      running={(s) => (
        <>
          {error}
          {s.step === 1 ? <Step1Stage s={s} /> : s.step === 2 ? <Step2Stage s={s} /> : s.step === 3 ? <Step3Stage s={s} /> : <Step4Stage s={s} />}
        </>
      )}
      done={(s) => {
        const labels = s.step === 2 ? s.labelsResult() : null
        if (labels) return <LabelsStage s={s} result={labels} onNext={() => ctx.openStep(3)} />
        const labeling = s.labelingResult()
        const abx = s.abxResult()
        return (
          <DoneStage ctx={ctx} tab="sounds" screens={SCREENS}>
            {error}
            {s.step === 3 && labeling && abx && <Step3Reveal labeling={labeling} abx={abx} />}
          </DoneStage>
        )
      }}
    />
  )
}

export const sounds: PartModule<SoundsStore> = {
  createStore: (seed, progress) => new SoundsStore(seed, progress),
  Nav,
  Stage,
}
export { SoundsStore }
