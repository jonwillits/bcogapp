import { useEffect, useState } from 'react'
import { Panel } from '../../components/Panel'
import type { ProgressStore } from '../../sim/language/progress/store'
import { Content, FixedLines, Note, RIGHT_STYLE, PART_TITLES, useStore } from './ui'
import { StepLeft, StepStage } from './steps'
import { HEADPHONES_LINE } from './lines'
import type { PartContext, PartModule } from './contract'
import { WordsStore, WORDS_UNIT } from './words/store'
import { SCREENS, STEP_TITLES } from './words/screens'
import { Step12Stage } from './words/Step12'
import { Step3Stage } from './words/Step3'
import { WordsReveal, WordsResults } from './words/Reveal'
import { loadObjects, loadWordFiles, type ObjectFile, type WordFile } from './words/assets'
import { registerResults } from './Part0'

/**
 * Part 3's screens (spec §7): the left column is navigation only (Jon,
 * 2026-11-16, LAB_COMMON_FEATURES §1); the stage carries the instruction
 * screen and then the trials, the test, or the models with their
 * prediction and settings; the right column carries the reveal of Steps 1
 * and 2 once the test is done, and a line saying what is missing before
 * that.
 */

type Ctx = PartContext<WordsStore>

/** The gathered results need the words' spellings and the objects' ids, loaded here on demand. */
function GatheredResults({ progress }: { progress: ProgressStore }) {
  const [files, setFiles] = useState<{ words: WordFile[]; objects: ObjectFile[] } | null>(null)
  const r = progress.result(WORDS_UNIT) as { materials: 0 | 1 } | undefined
  useEffect(() => {
    if (!r) return
    void Promise.all([loadWordFiles(), loadObjects()]).then(([w, o]) => setFiles({ words: w.filter((x) => x.set === r.materials), objects: o.filter((x) => x.set === r.materials) }))
  }, [r])
  if (!r) return <Note>Part 3’s experiment is not finished yet.</Note>
  if (!files) return <Note data-loading>Loading the words and objects.</Note>
  return <WordsResults progress={progress} words={files.words} objects={files.objects} />
}
registerResults(3, (progress: ProgressStore) => <GatheredResults progress={progress} />)

function progressLines(s: WordsStore): string[] {
  const p = s.progress
  const done = p.isComplete(WORDS_UNIT)
  return [`Step 1  ${done ? 'done' : s.stateOf(1) === 'running' && s.phase === 'learning' ? `trial ${Math.min(s.i + 1, 60)} of 60` : s.stateOf(1) === 'running' ? 'done' : 'not started'}`, `Step 2  ${done ? 'done' : s.phase === 'test' ? `trial ${Math.min(s.i + 1, 12)} of 12` : 'not started'}`, `Step 3  an exploration${s.predicted() ? ', prediction committed' : ''}`]
}

function Left({ ctx }: { ctx: Ctx }) {
  return <StepLeft ctx={ctx} tab="words" screens={SCREENS} progressLines={progressLines} topLines={[HEADPHONES_LINE]} />
}

function Stage({ ctx }: { ctx: Ctx }) {
  return <StepStage ctx={ctx} tab="words" screens={SCREENS} running={(s) => (s.step === 3 ? <Step3Stage s={s} /> : <Step12Stage s={s} />)} />
}

function Right({ ctx }: { ctx: Ctx }) {
  const s = useStore(ctx.store)
  useStore(ctx.progress)
  const r = s.result()
  return (
    <Panel title={`${PART_TITLES.words}: ${STEP_TITLES[s.step].replace(/^Step \d — /, '')}`} style={RIGHT_STYLE}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <FixedLines lines={progressLines(s)} testId="results-progress" />
        {s.loadError && <Note data-load-error>{s.loadError}</Note>}
        {s.step !== 3 && (r && s.loadedOk ? <WordsReveal seed={s.seed} result={r} words={s.words} objects={s.objects} /> : r ? <Note data-loading>Loading the words and objects.</Note> : <Note data-results-pending>The results of Steps 1 and 2 appear here once the test is done. Nothing about which object a word names is shown before then.</Note>)}
        {s.step === 3 && s.state !== 'intro' && <Content>Your prediction, the key measure, the two models, the three rows, and the models’ settings are in the center.</Content>}
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
