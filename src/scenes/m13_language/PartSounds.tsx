import { Panel } from '../../components/Panel'
import type { ProgressStore } from '../../sim/language/progress/store'
import { Content, FixedLines, Note, RIGHT_STYLE, PART_TITLES, useStore } from './ui'
import { StepLeft, StepStage } from './steps'
import { HEADPHONES_LINE } from './lines'
import type { PartContext, PartModule } from './contract'
import { SoundsStore, LABELS_UNIT, LABELING_UNIT, ABX_UNIT } from './sounds/store'
import { SCREENS, STEP_TITLES } from './sounds/screens'
import { TOUR_RIGHT, TOUR_TITLES } from './sounds/texts'
import { Step1Stage, Step1Controls } from './sounds/Step1'
import { Step2Stage } from './sounds/Step2'
import { Step3Stage } from './sounds/Step3'
import { Step4Stage, Step4Controls } from './sounds/Step4'
import { LabelsReveal, Step3Reveal, SoundsResults } from './sounds/Reveal'
import { registerResults } from './Part0'

/**
 * Part 1's screens (spec §5): the left column runs the step; the stage
 * carries the instruction screen and then the tour, the six spectrograms,
 * a block, or the network; the right column carries each step's
 * explanation and, once a unit is complete, its reveal.
 */

type Ctx = PartContext<SoundsStore>

registerResults(1, (progress: ProgressStore) => <SoundsResults progress={progress} />)

function progressLines(s: SoundsStore): string[] {
  const p = s.progress
  return [
    `Step 1  an exploration${s.predicted('pitch') ? ', prediction committed' : ''}`,
    `Step 2  ${p.isComplete(LABELS_UNIT) ? 'done' : s.stateOf(2) === 'running' ? `${Object.keys(s.labels).length} of 6 labeled` : 'not started'}`,
    `Step 3  ${p.isComplete(ABX_UNIT) ? 'both blocks done' : p.isComplete(LABELING_UNIT) ? 'block 1 of 2 done' : 'no block done'}`,
    `Step 4  an exploration${s.run1.state === 'done' ? ', run 1 done' : ''}`,
  ]
}

function Left({ ctx }: { ctx: Ctx }) {
  return <StepLeft ctx={ctx} tab="sounds" screens={SCREENS} progressLines={progressLines} topLines={[HEADPHONES_LINE]} controls={(s) => (s.step === 1 ? <Step1Controls s={s} /> : s.step === 4 ? <Step4Controls s={s} /> : s.step === 3 && s.block ? <Note>{s.block.kind === 'labeling' ? 'Block 1 of 2 is running over the view.' : 'Block 2 of 2 is running over the view.'}</Note> : null)} />
}

function Stage({ ctx }: { ctx: Ctx }) {
  return <StepStage ctx={ctx} tab="sounds" screens={SCREENS} running={(s) => (s.step === 1 ? <Step1Stage s={s} /> : s.step === 2 ? <Step2Stage s={s} /> : s.step === 3 ? <Step3Stage s={s} /> : <Step4Stage s={s} />)} />
}

function Right({ ctx }: { ctx: Ctx }) {
  const s = useStore(ctx.store)
  useStore(ctx.progress)
  const labels = s.labelsResult()
  const labeling = s.labelingResult()
  const abx = s.abxResult()
  return (
    <Panel title={`${PART_TITLES.sounds}: ${STEP_TITLES[s.step].replace(/^Step \d — /, '')}`} style={RIGHT_STYLE}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <FixedLines lines={progressLines(s)} testId="results-progress" />
        {s.loadError && <Note data-load-error>{s.loadError}</Note>}
        {s.step === 1 && s.state !== 'intro' && (
          <>
            <Note>{TOUR_TITLES[s.tour]}</Note>
            <Content>{TOUR_RIGHT[s.tour]}</Content>
          </>
        )}
        {s.step === 2 && (labels ? <LabelsReveal s={s} result={labels} /> : <Note data-results-pending>The results of this step appear here once your six labels are committed. Nothing about which sound is which is shown before then.</Note>)}
        {s.step === 3 && (labeling && abx ? <Step3Reveal labeling={labeling} abx={abx} /> : <Note data-results-pending>{labeling ? 'Block 1 is saved. The results of this step appear here once block 2 is done.' : 'The results of this step appear here once both blocks are done. Nothing about the sounds is shown before then.'}</Note>)}
        {s.step === 4 && s.state !== 'intro' && (
          <Note>{s.run1.state === 'done' ? `Run 1: ${s.run1.accuracy!.toFixed(1)}% correct on the held-out voices.` : 'The runs’ plots and tables appear in the center as each run trains.'}</Note>
        )}
        {s.step === 4 && s.run2.state === 'done' && <Note>{`Run 2, ${s.run2.which === 'voice' ? 'one voice' : 'one pitch'}: ${s.run2.accuracy!.toFixed(1)}% correct on the rest.`}</Note>}
      </div>
    </Panel>
  )
}

export const sounds: PartModule<SoundsStore> = {
  createStore: (seed, progress) => new SoundsStore(seed, progress),
  Left,
  Stage,
  Right,
  Results: SoundsResults,
}
export { SoundsStore }
