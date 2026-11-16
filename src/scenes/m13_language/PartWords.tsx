import { Panel } from '../../components/Panel'
import { FixedLines, Note, RIGHT_STYLE, PART_TITLES, StagePanel, useStore } from './ui'
import { StepLeft, StepStage } from './steps'
import type { PartContext, PartModule } from './contract'
import { WordsStore } from './words/store'
import { SCREENS, STEP_TITLES } from './words/screens'

/**
 * Part Words's screens: the left column runs the step, the stage carries the
 * instruction screen and then what the step shows, the right column carries
 * the step's results once they exist and a line saying what is missing
 * before that.
 */

type Ctx = PartContext<WordsStore>

function progressLines(s: WordsStore): string[] {
  return s.steps.map((st) => `Step ${st}  ${s.stateOf(st) === 'done' ? 'done' : s.stateOf(st) === 'running' ? 'under way' : 'not started'}`)
}

function Left({ ctx }: { ctx: Ctx }) {
  return <StepLeft ctx={ctx} tab="words" screens={SCREENS} progressLines={progressLines} />
}

function Stage({ ctx }: { ctx: Ctx }) {
  return (
    <StepStage
      ctx={ctx}
      tab="words"
      screens={SCREENS}
      running={(s) => (
        <StagePanel testId={`words-${s.step}`}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{STEP_TITLES[s.step]}</div>
        </StagePanel>
      )}
    />
  )
}

function Right({ ctx }: { ctx: Ctx }) {
  const s = useStore(ctx.store)
  useStore(ctx.progress)
  return (
    <Panel title={`${PART_TITLES.words}: results`} style={RIGHT_STYLE}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Note>{STEP_TITLES[s.step]}</Note>
        <FixedLines lines={progressLines(s)} testId="results-progress" />
        <Note data-results-pending>The results of this step appear here once it is done. Nothing about what the step measures is shown before then.</Note>
      </div>
    </Panel>
  )
}

export const words: PartModule<WordsStore> = {
  createStore: (seed, progress) => new WordsStore(seed, progress),
  Left,
  Stage,
  Right,
}
export { WordsStore }
