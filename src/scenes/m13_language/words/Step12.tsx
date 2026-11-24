import { Btn, FixedLines, LoadingLine, Note, StagePanel } from '../ui'
import { loadingText } from '../loading'
import { objectUrl } from './assets'
import type { WordsStore } from './store'
import { PauseButton } from '../steps'

/**
 * Steps 1 and 2's stage (spec §7.2): two objects (four on the test) in
 * shuffled positions, the word played once as they appear, Hear it again,
 * one click, the choice shown for about 200 ms, then a gap with no objects
 * before the next trial (Jon, 2026-11-23: a word right after the click
 * felt caused by the click), the trial count, and no feedback. The title
 * does not change on a choice, and the no-feedback and made-offline lines
 * are on the instruction screen only (Jon, 2026-11-23). Nothing names a
 * word or an object.
 */
export function Step12Stage({ s }: { s: WordsStore }) {
  const t = s.currentTrial
  if (!s.loadedOk)
    return (
      <StagePanel wide testId="words-trials">
        {s.loadError ? <Note data-loading>{s.loadError}</Note> : <LoadingLine text={loadingText('the words and objects', s.loadProgress)} testId="words-trials" />}
      </StagePanel>
    )
  if (!t)
    return (
      <StagePanel wide testId="words-trials">
        <Note>The test is done. Its results are below.</Note>
      </StagePanel>
    )
  const test = s.phase === 'test'
  return (
    <StagePanel wide testId={test ? 'words-test' : 'words-learning'}>
      <div style={{ fontSize: 14, fontWeight: 600 }}>{test ? 'The test' : 'Words and objects'}</div>
      <div data-now style={{ fontSize: 20, fontWeight: 600, minHeight: 30 }}>
        Click the object the word names.
      </div>
      <FixedLines lines={[s.trialLabel]} testId="trial-label" />
      <div style={{ display: 'flex', gap: 14, justifyContent: 'center', padding: '10px 0', minHeight: 130 }} data-objects data-between={s.between || undefined}>
        {!s.between && t.objects.map((o) => (
          <button key={o} type="button" onClick={() => s.choose(o)} disabled={s.chosenNow !== null} aria-label={`object ${t.objects.indexOf(o) + 1}`} data-object={s.objects[o]?.id} style={{ width: 110, height: 110, padding: 4, borderRadius: 12, border: `3px solid ${s.chosenNow === o ? 'var(--accent)' : 'var(--border)'}`, background: 'var(--surface-2)', cursor: s.chosenNow === null ? 'pointer' : 'default' }}>
            <img src={objectUrl(s.objects[o].id)} alt="" width={96} height={96} draggable={false} />
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <Btn onClick={() => s.hearAgain()} disabled={s.chosenNow !== null || s.between}>
          Hear it again
        </Btn>
        <Note>The word played once when the objects appeared.</Note>
        <PauseButton s={s} />
      </div>
    </StagePanel>
  )
}
