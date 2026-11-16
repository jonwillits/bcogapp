import { Btn, Content, FixedLines, Note, StagePanel } from '../ui'
import { MADE_OFFLINE_LINE, NO_FEEDBACK_LINE } from '../lines'
import { objectUrl } from './assets'
import type { WordsStore } from './store'

/**
 * Steps 1 and 2's stage (spec §7.2): five objects (four on the test) in
 * shuffled positions, the word played once as they appear, Hear it again,
 * one click, the choice shown for about 200 ms, the trial count, and no
 * feedback. Nothing names a word or an object.
 */
export function Step12Stage({ s }: { s: WordsStore }) {
  const t = s.currentTrial
  if (!s.loadedOk)
    return (
      <StagePanel wide testId="words-trials">
        <Note data-loading>{s.loadError ?? 'The words and objects are loading.'}</Note>
      </StagePanel>
    )
  if (!t)
    return (
      <StagePanel wide testId="words-trials">
        <Note>The test is done. Its results are on the right.</Note>
      </StagePanel>
    )
  const test = s.phase === 'test'
  return (
    <StagePanel wide testId={test ? 'words-test' : 'words-learning'}>
      <div style={{ fontSize: 14, fontWeight: 600 }}>{test ? 'The test' : 'Words and objects'}</div>
      <div data-now style={{ fontSize: 20, fontWeight: 600, minHeight: 30 }}>
        {s.chosenNow !== null ? 'Your choice.' : 'Click the object the word names.'}
      </div>
      <FixedLines lines={[s.trialLabel]} testId="trial-label" />
      <div style={{ display: 'flex', gap: 14, justifyContent: 'center', padding: '10px 0' }} data-objects>
        {t.objects.map((o) => (
          <button key={o} type="button" onClick={() => s.choose(o)} disabled={s.chosenNow !== null} aria-label={`object ${t.objects.indexOf(o) + 1}`} data-object={s.objects[o]?.id} style={{ width: 110, height: 110, padding: 4, borderRadius: 12, border: `3px solid ${s.chosenNow === o ? 'var(--accent)' : 'var(--border)'}`, background: 'var(--surface-2)', cursor: s.chosenNow === null ? 'pointer' : 'default' }}>
            <img src={objectUrl(s.objects[o].id)} alt="" width={96} height={96} draggable={false} />
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <Btn onClick={() => s.hearAgain()} disabled={s.chosenNow !== null}>
          Hear it again
        </Btn>
        <Note>The word played once when the objects appeared.</Note>
      </div>
      <Content>{NO_FEEDBACK_LINE}</Content>
      <Content>{MADE_OFFLINE_LINE}</Content>
    </StagePanel>
  )
}
