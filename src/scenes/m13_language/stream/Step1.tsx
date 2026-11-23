import { useCallback } from 'react'
import { Btn, Content, FixedLines, LoadingLine, Note, StagePanel, Countdown } from '../ui'
import { loadingText } from '../loading'
import { useAudioCursor, useBlockGuard } from '../hooks'
import { MADE_OFFLINE_LINE, MADE_UP_LANGUAGE_LINE } from '../lines'
import { MinuteReveal } from './Reveal'
import { MAIN_TABS } from '../params'
import type { StreamStore } from './store'

/**
 * Step 1's stage (spec §6.1): Play the minute, the large timer and the
 * line saying what is happening now, and nothing else while the minute
 * plays (Jon, 2026-11-20: no spectrogram, so that the student listens),
 * then the question and the commit, and after the commit the answer beside
 * the number of words and the button that comes next (Jon, 2026-11-18).
 * The two replays, with the words marked, are at the end of Step 2 (Jon,
 * 2026-11-21), so that nothing here names a word before the search. The
 * playback stops and starts again if the page is hidden.
 */
export function Step1Stage({ s, onNext }: { s: StreamStore; onNext?: () => void }) {
  const read = useCallback(() => s.cursor(), [s])
  // Read on every frame while the minute plays, so that the timer moves.
  useAudioCursor(read, s.playback !== null)
  const stop = useCallback((reason: string) => s.stopMinute(reason), [s])
  useBlockGuard(s.replay === 'first' && s.playback !== null, stop)
  const done = s.minuteResult()
  const playing = s.playback !== null
  const left = playing ? s.secondsLeft() : 0
  const total = s.assembled?.durationS ?? 60
  const now = playing ? 'Listen. The language is playing.' : s.minuteStopped ? 'The playback stopped.' : done ? 'Your answer is committed.' : s.minutePlayed ? 'The minute is over. Answer the question below.' : 'Press “Play the minute” to begin.'
  return (
    <StagePanel wide testId="stream-1">
      <div style={{ fontSize: 14, fontWeight: 600 }}>A minute of the language</div>
      {!s.isLoaded(1) && <LoadingLine text={loadingText('the sounds', s.loadProgress)} testId="stream-1" />}
      <div data-now style={{ fontSize: 20, fontWeight: 600, minHeight: 30 }}>
        {now}
      </div>
      {playing && <Countdown left={left} total={Math.round(total)} big />}
      {s.minuteStopped && (
        <div data-minute-stopped>
          <Note>{s.minuteStopped} The same minute plays again from the start when you press “Play the minute”.</Note>
        </div>
      )}
      {!done && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <Btn primary onClick={() => s.playMinute('first')} disabled={!s.isLoaded(1) || playing || s.minutePlayed}>
            Play the minute
          </Btn>
          <Note>While the minute plays, only the timer is on the screen. Listen.</Note>
        </div>
      )}
      {!done && s.minutePlayed && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 10, border: '1px solid var(--border)', borderRadius: 8 }} data-answer-form>
          <label style={{ fontSize: 12.5 }}>
            How many different words do you think the language has?{' '}
            <select value={s.guessDraft ?? ''} onChange={(e) => s.setGuess(Number(e.target.value))} aria-label="How many different words" style={{ marginLeft: 6 }}>
              <option value="">choose</option>
              {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label style={{ fontSize: 12.5, display: 'flex', flexDirection: 'column', gap: 4 }}>
            Any words you think you heard, typed as they sound (optional):
            <textarea value={s.typedDraft} onChange={(e) => s.setTyped(e.target.value)} rows={2} style={{ fontFamily: 'var(--font-mono)', fontSize: 12, background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 6, padding: 6 }} />
          </label>
          <div>
            <Btn primary onClick={() => s.commitAnswer()} disabled={s.guessDraft === null}>
              Commit my answer
            </Btn>
          </div>
        </div>
      )}
      <Content>{MADE_UP_LANGUAGE_LINE}</Content>
      <Content>{MADE_OFFLINE_LINE}</Content>
      {done && <FixedLines lines={[`Your answer: ${done.guess} ${done.guess === 1 ? 'word' : 'words'}.`]} mono={false} />}
      {done && onNext && <Note>{`This step is done. Its results are below, with their explanation, and on the ${MAIN_TABS.results} tab at the top of this panel. The button to move on is at the end.`}</Note>}
      {done && <MinuteReveal result={done} />}
      {done && onNext && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8, paddingTop: 10, borderTop: '1px solid var(--border)' }} data-next-row>
          <Note data-next>When you are ready to move on, press “Go on to Step 2” here or in the navigation panel.</Note>
          <div>
            <Btn primary onClick={onNext}>
              Go on to Step 2
            </Btn>
          </div>
        </div>
      )}
    </StagePanel>
  )
}
