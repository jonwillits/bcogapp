import { useEffect, useState } from 'react'
import type { ProgressStore } from '../../sim/language/progress/store'
import { Note, useStore } from './ui'
import { DoneStage, StepNav, StepStage } from './steps'
import { HEADPHONES_LINE } from './lines'
import type { PartContext, PartModule } from './contract'
import { WordsStore, WORDS_UNIT, type WordsResult } from './words/store'
import { SCREENS, STEP_TITLES } from './words/screens'
import { Step12Stage } from './words/Step12'
import { Step3Stage } from './words/Step3'
import { WordsReveal } from './words/Reveal'
import { loadObjects, loadWordFiles, type ObjectFile, type WordFile } from './words/assets'
import { registerStepResults } from './results'

/**
 * Part 3's screens (spec §7): the navigation panel is navigation only (Jon,
 * 2026-11-16, LAB_COMMON_FEATURES §1); the main panel carries the
 * instruction screen and then the trials, the test, or the models with
 * their prediction and settings, and, once the test is done, the reveal of
 * Steps 1 and 2 under the finished-step header (Jon, 2026-11-18). The unit
 * registers its results for the All Results tab, where the words' spellings
 * and the objects are loaded on demand.
 */

type Ctx = PartContext<WordsStore>

/** The gathered results need the words' spellings and the objects' ids, loaded here on demand. */
function GatheredResults({ progress }: { progress: ProgressStore }) {
  const [files, setFiles] = useState<{ words: WordFile[]; objects: ObjectFile[] } | null>(null)
  const r = progress.result(WORDS_UNIT) as WordsResult | undefined
  useEffect(() => {
    if (!r) return
    void Promise.all([loadWordFiles(), loadObjects()]).then(([w, o]) => setFiles({ words: w.filter((x) => x.set === r.materials), objects: o.filter((x) => x.set === r.materials) }))
  }, [r])
  if (!r) return <Note>Part 3’s experiment is not finished yet.</Note>
  if (!files) return <Note data-loading>Loading the words and objects.</Note>
  return <WordsReveal seed={progress.seed} result={r} words={files.words} objects={files.objects} />
}
registerStepResults([{ part: 3, tab: 'words', step: 2, title: `Steps 1 and 2 — ${STEP_TITLES[1].replace(/^Step \d — /, '')}, and ${STEP_TITLES[2].replace(/^Step \d — /, '').toLowerCase()}`, done: (p: ProgressStore) => p.isComplete(WORDS_UNIT), render: (p: ProgressStore) => <GatheredResults progress={p} /> }])

function progressLines(s: WordsStore): string[] {
  const p = s.progress
  const done = p.isComplete(WORDS_UNIT)
  return [`Step 1  ${done ? 'done' : s.stateOf(1) === 'running' && s.phase === 'learning' ? `trial ${Math.min(s.i + 1, 60)} of 60` : s.stateOf(1) === 'running' ? 'done' : 'not started'}`, `Step 2  ${done ? 'done' : s.phase === 'test' ? `trial ${Math.min(s.i + 1, 12)} of 12` : 'not started'}`, `Step 3  an exploration${s.predicted() ? ', prediction committed' : ''}`]
}

function Nav({ ctx }: { ctx: Ctx }) {
  return <StepNav ctx={ctx} tab="words" screens={SCREENS} progressLines={progressLines} topLines={[HEADPHONES_LINE]} />
}

function Stage({ ctx }: { ctx: Ctx }) {
  const s = useStore(ctx.store)
  const error = s.loadError ? <Note data-load-error>{s.loadError}</Note> : null
  return (
    <StepStage
      ctx={ctx}
      tab="words"
      screens={SCREENS}
      running={(s) => (
        <>
          {error}
          {s.step === 3 ? <Step3Stage s={s} /> : <Step12Stage s={s} />}
        </>
      )}
      done={(s) => {
        const r = s.result()
        return (
          <DoneStage ctx={ctx} tab="words" screens={SCREENS}>
            {error}
            {r && s.loadedOk ? <WordsReveal seed={s.seed} result={r} words={s.words} objects={s.objects} /> : r ? <Note data-loading>Loading the words and objects.</Note> : null}
          </DoneStage>
        )
      }}
    />
  )
}

export const words: PartModule<WordsStore> = {
  createStore: (seed, progress) => new WordsStore(seed, progress),
  Nav,
  Stage,
}
export { WordsStore }
