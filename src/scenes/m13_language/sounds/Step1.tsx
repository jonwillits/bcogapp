import { useCallback, useRef } from 'react'
import { Btn, Choice, Content, FixedLines, GroupLabel, LoadingLine, Note, StagePanel, useWidth } from '../ui'
import { loadingText } from '../loading'
import { Spectrogram } from '../Spectrogram'
import { Scatter } from '../plots'
import { useAudioCursor } from '../hooks'
import { SETTINGS_NOT_MEASUREMENTS_LINE, MADE_OFFLINE_LINE } from '../lines'
import { TOUR_RIGHT, TOUR_TEXT, TOUR_TITLES, VIEW_FIXED_LINE } from './texts'
import { PREDICTIONS, TOUR, type SoundsStore } from './store'

/**
 * Step 1's seven screens (spec §5.1; Jon, 2026-11-16): one progression,
 * chosen by the row of names or by Next and Back. On every screen the order
 * is the same, so that the picture stays put from screen to screen: the
 * title, the view row, the pictures with Play, and the text under them.
 * Screens 1 to 3 show the wide-band view only; the switch appears on screen
 * 4, where the two views are explained. The pitch prediction is on the
 * Pitch screen itself: the navigation panel is navigation only. Pitch and
 * Voice put their two pictures side by side. Each screen's side text, read
 * while looking at the picture, sits in a column to the right of the
 * pictures when the panel is wide enough, and under them when it is not
 * (Jon, 2026-11-18). The last screen carries Go to Step 2. Every frequency
 * marked is a setting of the synthesizer.
 */

/** The row of view buttons, or the fixed-view line, at one height so the picture under it does not move. */
const VIEW_ROW_HEIGHT = 30

function Sound({ s, clipKey, label, view, frequencyLines, width = 500, height = 210 }: { s: SoundsStore; clipKey: string; label: string; view: 'wide' | 'narrow'; frequencyLines?: { hz: number; label: string }[]; width?: number; height?: number }) {
  const clip = s.clip(clipKey)
  const read = useCallback(() => s.cursorIn(clipKey), [s, clipKey])
  const cursor = useAudioCursor(read, s.playing?.key === clipKey)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }} data-sound={clipKey}>
      <Spectrogram samples={clip?.samples ?? null} sampleRate={clip?.sampleRate ?? 16000} view={view} width={width} height={height} cursorS={cursor} frequencyLines={frequencyLines} testId={clipKey} />
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <Btn small onClick={() => s.play(clipKey)} disabled={!clip}>
          Play
        </Btn>
        <Note>{label}</Note>
      </div>
    </div>
  )
}

function ViewRow({ s, switchable }: { s: SoundsStore; switchable: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', minHeight: VIEW_ROW_HEIGHT }} data-view-row>
      {switchable && <Choice value={s.view} options={[{ id: 'wide', label: 'Wide bands' }, { id: 'narrow', label: 'Narrow bands' }]} onChange={(v) => s.setView(v as 'wide' | 'narrow')} />}
      <Note data-view-now>{switchable ? (s.view === 'wide' ? 'The wide-band view is showing.' : 'The narrow-band view is showing.') : VIEW_FIXED_LINE}</Note>
    </div>
  )
}

/** The screen's text under its pictures: the main paragraphs, then the side text under its own header, in the same column (Jon, 2026-11-19: never in a box of its own, which moved with the zoom). */
function Text({ screen }: { screen: (typeof TOUR)[number] }) {
  return (
    <>
      {TOUR_TEXT[screen].map((p) => (
        <Note key={p.slice(0, 20)} style={{ color: 'var(--text)' }}>
          {p}
        </Note>
      ))}
      <div data-tour-aside>
        <GroupLabel>{TOUR_TITLES[screen]}</GroupLabel>
        <Content>{TOUR_RIGHT[screen]}</Content>
      </div>
    </>
  )
}

export function Step1Stage({ s }: { s: SoundsStore }) {
  const screen = s.tour
  const i = TOUR.indexOf(screen)
  const vowels = s.vowels
  const loaded = s.isLoaded(1)
  const f2 = (name: string) => (vowels ? vowels.sounds[name].formants.slice(0, 2).map((hz, k) => ({ hz, label: `F${k + 1} ${hz} Hz` })) : undefined)
  const ref = useRef<HTMLDivElement>(null)
  // The pictures take the panel's whole width (Jon, 2026-11-19); the text sits under them.
  const room = useWidth(ref, 700)
  // Two pictures side by side on Pitch and Voice; three on Vowels, with the map under them.
  const two = Math.max(240, Math.floor((room - 10) / 2))
  // The three vowels share the whole width in a row when each gets at least 220 px; in a narrower room they stack at full width, legible over small (Jon, 2026-11-16: three in a row at 174 px were too small to read). The vowel map sits under them.
  const inRow = Math.floor((room - 20) / 3) >= 220
  const three = inRow ? Math.floor((room - 20) / 3) : Math.min(560, room)
  const one = Math.min(640, room)
  const single = screen === 'time' || screen === 'frequency' || screen === 'energy' || screen === 'patterns'
  return (
    <StagePanel wide testId={`sounds-1-${screen}`}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <Choice value={screen} options={TOUR.map((t) => ({ id: t, label: TOUR_TITLES[t] }))} onChange={(t) => s.goTour(t as typeof screen)} />
      </div>
      <div style={{ fontSize: 14, fontWeight: 600 }}>{`Screen ${i + 1} of ${TOUR.length}: ${TOUR_TITLES[screen]}`}</div>
      <div ref={ref} style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'stretch' }} data-tour-layout="stacked">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1, minWidth: 0 }} data-tour-body>
        {single && (
          <>
            <ViewRow s={s} switchable={screen === 'patterns'} />
            <Sound s={s} clipKey="vowel:ah_120" label="ah at 120 Hz" view={screen === 'patterns' ? s.view : 'wide'} frequencyLines={screen === 'patterns' ? f2('ah_120') : undefined} width={one} height={Math.round(one * 0.42)} />
            {!loaded && <LoadingLine text={loadingText('the sounds', s.loadProgress)} testId="sounds-1" />}
            <Text screen={screen} />
          </>
        )}
        {screen === 'pitch' && <PitchScreen s={s} width={two} />}
        {screen === 'voice' && (
          <>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'nowrap' }}>
              <Sound s={s} clipKey="vowel:ah_100" label="ah at 100 Hz, the earlier formants" view="narrow" frequencyLines={f2('ah_100')} width={two} height={Math.round(two * 0.6)} />
              <Sound s={s} clipKey="vowel:ah_100_short" label="ah at 100 Hz, every formant raised by 15%" view="narrow" frequencyLines={f2('ah_100_short')} width={two} height={Math.round(two * 0.6)} />
            </div>
            <Text screen={screen} />
          </>
        )}
        {screen === 'vowels' && vowels && (
          <>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'nowrap', flexDirection: inRow ? 'row' : 'column', alignItems: 'flex-start' }} data-vowels-layout={inRow ? 'three-in-a-row' : 'stacked'}>
              {(['ee_120', 'ah_120', 'oo_120'] as const).map((k) => (
                <Sound key={k} s={s} clipKey={`vowel:${k}`} label={`${k.slice(0, 2)} at 120 Hz`} view="wide" frequencyLines={f2(k)} width={three} height={Math.round(three * (inRow ? 0.8 : 0.42))} />
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <div>
                <GroupLabel>The vowel map</GroupLabel>
                <Scatter width={Math.min(360, room)} height={240} xLabel="second formant (Hz), increasing to the left" yLabel="first formant (Hz), increasing downward" flipX flipY testId="vowel-map" points={[{ x: vowels.vowels.ee[1], y: vowels.vowels.ee[0], label: 'ee, as in see' }, { x: vowels.vowels.ah[1], y: vowels.vowels.ah[0], label: 'ah, as in father' }, { x: vowels.vowels.oo[1], y: vowels.vowels.oo[0], label: 'oo, as in who' }]} />
                <Note>The plot has the orientation of the reading’s vowel map (§13.1.6): the axes are turned so that the first formant increases downward and the second increases leftward.</Note>
              </div>
            </div>
            <Text screen={screen} />
          </>
        )}
      </div>
      </div>
      <Content>{SETTINGS_NOT_MEASUREMENTS_LINE}</Content>
      {screen === 'time' && <Content>{MADE_OFFLINE_LINE}</Content>}
      <div style={{ display: 'flex', gap: 6 }}>
        <Btn onClick={() => s.tourBack()} disabled={i === 0}>
          Back
        </Btn>
        {i < TOUR.length - 1 ? (
          <Btn primary onClick={() => s.tourNext()}>
            Next
          </Btn>
        ) : (
          <Btn primary onClick={() => s.open(2)}>
            Go to Step 2
          </Btn>
        )}
      </div>
    </StagePanel>
  )
}

/** The pitch screen: the one prediction, in the center, then the two pictures side by side once it is committed. */
function PitchScreen({ s, width }: { s: SoundsStore; width: number }) {
  const p = PREDICTIONS.pitch
  const committed = s.predicted('pitch')
  const vowels = s.vowels
  const f2 = (name: string) => (vowels ? vowels.sounds[name].formants.slice(0, 2).map((hz, k) => ({ hz, label: `F${k + 1} ${hz} Hz` })) : undefined)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} data-pitch-screen>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: 8, border: '1px solid var(--border)', borderRadius: 8 }} data-predict="pitch">
        <GroupLabel>Predict first</GroupLabel>
        <Note style={{ color: 'var(--text)' }}>{p.question}</Note>
        {committed ? (
          <FixedLines lines={[`Committed: ${committed}`]} mono={false} />
        ) : (
          <>
            <Choice value={s.drafts.pitch ?? null} options={p.choices.map((c) => ({ id: c, label: c }))} onChange={(c) => s.draft('pitch', c)} />
            <div>
              <Btn primary onClick={() => s.commit('pitch')} disabled={!s.drafts.pitch}>
                Commit my prediction
              </Btn>
            </div>
          </>
        )}
      </div>
      {!committed && <Note data-awaiting-commit>The two spectrograms appear once your prediction is committed.</Note>}
      {committed && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} data-reveal="pitch">
          <div style={{ display: 'flex', gap: 10, flexWrap: 'nowrap' }}>
            <Sound s={s} clipKey="vowel:ah_100" label="ah at 100 Hz" view="narrow" frequencyLines={f2('ah_100')} width={width} height={Math.round(width * 0.6)} />
            <Sound s={s} clipKey="vowel:ah_200" label="ah at 200 Hz" view="narrow" frequencyLines={f2('ah_200')} width={width} height={Math.round(width * 0.6)} />
          </div>
          <FixedLines lines={[`Your prediction: ${committed}`, 'The dashed lines mark the first two formants at the synthesizer’s settings, the same in both.', 'Count the harmonics between 0 and 1,000 Hz in each picture: about ten at 100 Hz and about five at 200 Hz.']} mono={false} />
        </div>
      )}
      <Text screen="pitch" />
    </div>
  )
}
