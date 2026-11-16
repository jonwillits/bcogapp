import { useCallback } from 'react'
import { Btn, Choice, Content, FixedLines, GroupLabel, Note, StagePanel } from '../ui'
import { Spectrogram } from '../Spectrogram'
import { Scatter } from '../plots'
import { useAudioCursor } from '../hooks'
import { SETTINGS_NOT_MEASUREMENTS_LINE, MADE_OFFLINE_LINE } from '../lines'
import { TOUR_TEXT, TOUR_TITLES } from './texts'
import { PREDICTIONS, TOUR, type SoundsStore } from './store'

/**
 * Step 1's screens (spec §5.1): the four-screen tour over one sound, then
 * Pitch (with its committed prediction), Voice, and Vowels. Every
 * frequency marked is a setting of the synthesizer.
 */

function Sound({ s, clipKey, label, view, frequencyLines, width = 500, height = 210 }: { s: SoundsStore; clipKey: string; label: string; view: 'wide' | 'narrow'; frequencyLines?: { hz: number; label: string }[]; width?: number; height?: number }) {
  const clip = s.clip(clipKey)
  const read = useCallback(() => s.cursorIn(clipKey), [s, clipKey])
  const cursor = useAudioCursor(read, s.playing?.key === clipKey)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }} data-sound={clipKey}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <Btn small onClick={() => s.play(clipKey)} disabled={!clip}>
          Play
        </Btn>
        <Note>{label}</Note>
      </div>
      <Spectrogram samples={clip?.samples ?? null} sampleRate={clip?.sampleRate ?? 16000} view={view} width={width} height={height} cursorS={cursor} frequencyLines={frequencyLines} testId={clipKey} />
    </div>
  )
}

function ViewSwitch({ s }: { s: SoundsStore }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <Choice value={s.view} options={[{ id: 'wide', label: 'Wide bands' }, { id: 'narrow', label: 'Narrow bands' }]} onChange={(v) => s.setView(v as 'wide' | 'narrow')} />
      <Note data-view-now>{s.view === 'wide' ? 'The wide-band view is showing.' : 'The narrow-band view is showing.'}</Note>
    </div>
  )
}

export function Step1Stage({ s }: { s: SoundsStore }) {
  const screen = s.tour
  const i = TOUR.indexOf(screen)
  const vowels = s.vowels
  const loaded = s.isLoaded(1)
  const f2 = (name: string) => (vowels ? vowels.sounds[name].formants.slice(0, 2).map((hz, k) => ({ hz, label: `F${k + 1} ${hz} Hz` })) : undefined)
  return (
    <StagePanel wide testId={`sounds-1-${screen}`}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <Choice value={screen} options={TOUR.map((t) => ({ id: t, label: TOUR_TITLES[t] }))} onChange={(t) => s.goTour(t as typeof screen)} />
      </div>
      <div style={{ fontSize: 14, fontWeight: 600 }}>
        {i < 4 ? `The tour, screen ${i + 1} of 4: ` : ''}
        {TOUR_TITLES[screen]}
      </div>
      {TOUR_TEXT[screen].map((p) => (
        <Note key={p.slice(0, 20)} style={{ color: 'var(--text)' }}>
          {p}
        </Note>
      ))}
      {!loaded && <Note data-loading>The sounds are loading.</Note>}
      {screen !== 'pitch' && screen !== 'voice' && screen !== 'vowels' && (
        <>
          <ViewSwitch s={s} />
          <Sound s={s} clipKey="vowel:ah_120" label="ah at 120 Hz" view={s.view} frequencyLines={screen === 'patterns' ? f2('ah_120') : undefined} />
        </>
      )}
      {screen === 'pitch' && <PitchScreen s={s} />}
      {screen === 'voice' && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Sound s={s} clipKey="vowel:ah_100" label="ah at 100 Hz, the earlier formants" view="narrow" frequencyLines={f2('ah_100')} width={360} height={200} />
          <Sound s={s} clipKey="vowel:ah_100_short" label="ah at 100 Hz, every formant raised by 15%" view="narrow" frequencyLines={f2('ah_100_short')} width={360} height={200} />
        </div>
      )}
      {screen === 'vowels' && vowels && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {(['ee_120', 'ah_120', 'oo_120'] as const).map((k) => (
            <Sound key={k} s={s} clipKey={`vowel:${k}`} label={`${k.slice(0, 2)} at 120 Hz`} view="wide" frequencyLines={f2(k)} width={240} height={180} />
          ))}
          <div>
            <GroupLabel>The vowel map</GroupLabel>
            <Scatter width={300} height={220} xLabel="second formant (Hz), increasing to the left" yLabel="first formant (Hz), increasing downward" flipX flipY testId="vowel-map" points={[{ x: vowels.vowels.ee[1], y: vowels.vowels.ee[0], label: 'ee, as in see' }, { x: vowels.vowels.ah[1], y: vowels.vowels.ah[0], label: 'ah, as in father' }, { x: vowels.vowels.oo[1], y: vowels.vowels.oo[0], label: 'oo, as in who' }]} />
            <Note>The plot has the orientation of the reading’s vowel map (§13.1.6): the axes are turned so that the first formant increases downward and the second increases leftward.</Note>
          </div>
        </div>
      )}
      <Content>{SETTINGS_NOT_MEASUREMENTS_LINE}</Content>
      {screen === 'time' && <Content>{MADE_OFFLINE_LINE}</Content>}
      <div style={{ display: 'flex', gap: 6 }}>
        <Btn onClick={() => s.tourBack()} disabled={i === 0}>
          Back
        </Btn>
        <Btn primary onClick={() => s.tourNext()} disabled={i === TOUR.length - 1}>
          Next
        </Btn>
      </div>
    </StagePanel>
  )
}

function PitchScreen({ s }: { s: SoundsStore }) {
  const committed = s.predicted('pitch')
  const vowels = s.vowels
  const f2 = (name: string) => (vowels ? vowels.sounds[name].formants.slice(0, 2).map((hz, k) => ({ hz, label: `F${k + 1} ${hz} Hz` })) : undefined)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} data-pitch-screen>
      {!committed && <Note data-awaiting-commit>The two spectrograms appear once your prediction is committed on the left.</Note>}
      {committed && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }} data-reveal="pitch">
          <Sound s={s} clipKey="vowel:ah_100" label="ah at 100 Hz" view="narrow" frequencyLines={f2('ah_100')} width={360} height={200} />
          <Sound s={s} clipKey="vowel:ah_200" label="ah at 200 Hz" view="narrow" frequencyLines={f2('ah_200')} width={360} height={200} />
          <FixedLines lines={[`Your prediction: ${committed}`, 'The dashed lines mark the first two formants at the synthesizer’s settings, the same in both.', 'Count the harmonics between 0 and 1,000 Hz in each picture: about ten at 100 Hz and about five at 200 Hz.']} mono={false} />
        </div>
      )}
    </div>
  )
}

/** The left column's controls for Step 1: the pitch prediction. */
export function Step1Controls({ s }: { s: SoundsStore }) {
  const p = PREDICTIONS.pitch
  const committed = s.predicted('pitch')
  if (s.tour !== 'pitch' && !committed) return <Note>The screens’ names at the top of the center panel go to any screen. The one prediction is asked on the “Pitch” screen.</Note>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: 8, border: '1px solid var(--border)', borderRadius: 8 }} data-predict="pitch">
      <GroupLabel>Predict first</GroupLabel>
      <Note>{p.question}</Note>
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
  )
}
