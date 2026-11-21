import { useCallback } from 'react'
import { Btn, Content, Note, Para } from '../ui'
import { ReferencePanel } from '../ReferencePanel'
import { reference } from '../../../sim/language/references'
import { useAudioCursor } from '../hooks'
import { LENGTHENED_DIFFERENTLY_LINE } from '../lines'
import { Strip, WordStrip } from './Strip'
import { REPLAYS_TEXT, SIX_WORDS_LINE } from './texts'
import { MINUTE_SYLLABLES, type StreamStore } from './store'

/**
 * The two replays of Step 1's minute (spec §6.1), at the end of Step 2 once
 * every word is found or shown (Jon, 2026-11-21; before that they came
 * after Step 1's commit and showed the words before the search). Each
 * replays the same minute with its spectrogram scrolling under a cursor:
 * the marked one with the word strip and the boundary lines, the other with
 * every word's last syllable lengthened. Under the buttons, the paragraphs
 * saying what each replay adds, and the original's lengthening experiment.
 */
export function MinuteReplays({ s }: { s: StreamStore }) {
  const read = useCallback(() => s.cursor(), [s])
  const cursor = useAudioCursor(read, s.playback !== null)
  const loaded = s.isLoaded(2)
  const replay = s.replay === 'marked' || s.replay === 'long' ? s.replay : null
  const playing = replay !== null && s.playback !== null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} data-replays>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Btn onClick={() => s.playMinute('marked')} disabled={!loaded || playing}>
          Play again, with the words marked
        </Btn>
        <Btn onClick={() => s.playMinute('long')} disabled={!loaded || playing}>
          Play again, with each word’s last syllable lengthened
        </Btn>
        {playing && (
          <Btn onClick={() => s.stopPlayback()}>
            Stop
          </Btn>
        )}
      </div>
      {!loaded && <Note data-loading>The sounds are loading.</Note>}
      {playing && (
        <div data-now style={{ fontSize: 16, fontWeight: 600 }}>
          {replay === 'marked' ? 'The same minute, with the words marked.' : 'The same minute, with each word’s last syllable lengthened.'}
        </div>
      )}
      {replay === 'marked' && s.assembled && <WordStrip stream={s.stream} n={MINUTE_SYLLABLES} marks={s.assembled.marks} cursorS={cursor} />}
      {replay && s.spectrograms && s.assembled && <Strip stream={s.stream} n={MINUTE_SYLLABLES} spectrograms={replay === 'long' ? s.spectrogramsLong! : s.spectrograms} cursorS={cursor} marks={s.assembled.marks} marked={replay === 'marked'} />}
      {REPLAYS_TEXT.map((p) => (
        <Para key={p.slice(0, 40)}>{p}</Para>
      ))}
      <Content>{SIX_WORDS_LINE}</Content>
      <Para>In the original study’s second experiment, the vowel of the last syllable was lengthened by 100 milliseconds in three of the six words, in a language with m and n in place of b and d. Scores against nonwords were 80% with the final syllable lengthened, 61% with the first syllable lengthened, and 65% with no lengthening (pp. 616–617).</Para>
      <Content>{LENGTHENED_DIFFERENTLY_LINE}</Content>
      <ReferencePanel reference={reference('saffran-lengthening')} />
    </div>
  )
}
