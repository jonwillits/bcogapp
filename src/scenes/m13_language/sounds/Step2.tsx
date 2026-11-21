import { useCallback } from 'react'
import { Btn, Choice, Content, LoadingLine, Note, StagePanel } from '../ui'
import { loadingText } from '../loading'
import { PauseButton } from '../steps'
import { Spectrogram } from '../Spectrogram'
import { useAudioCursor } from '../hooks'
import { MADE_OFFLINE_LINE } from '../lines'
import { STEP2_PANEL } from './texts'
import { SIX_ORDER, type Six } from './assets'
import type { SoundsStore } from './store'

/**
 * Step 2's stage (spec §5.2): six spectrograms in a row without labels, in
 * the seeded order, each with Play and the two label buttons, and Commit my
 * labels once all six are labeled. Nothing names a syllable before the
 * commit; the reveal is in `Reveal.tsx`.
 */
function Card({ s, k, n }: { s: SoundsStore; k: Six; n: number }) {
  const key = `six:${k}`
  const clip = s.clip(key)
  const read = useCallback(() => s.cursorIn(key), [s, key])
  const cursor = useAudioCursor(read, s.playing?.key === key)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }} data-six-card={n}>
      <Spectrogram samples={clip?.samples ?? null} sampleRate={clip?.sampleRate ?? 16000} view="wide" width={236} height={170} cursorS={cursor} noWaveform testId={`six-${n}`} />
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <Note>Sound {n}</Note>
        <Btn small onClick={() => s.play(key)} disabled={!clip}>
          Play
        </Btn>
        <Choice value={s.labels[k] ?? null} options={[{ id: 'b', label: 'b' }, { id: 'd', label: 'd' }]} onChange={(v) => s.setLabel(k, v as 'b' | 'd')} />
      </div>
    </div>
  )
}

export function Step2Stage({ s }: { s: SoundsStore }) {
  const labeled = SIX_ORDER.filter((k) => s.labels[k]).length
  return (
    <StagePanel wide testId="sounds-2">
      <div style={{ fontSize: 14, fontWeight: 600 }}>Six syllables: label each b or d</div>
      {STEP2_PANEL.map((p) => (
        <Note key={p.slice(0, 16)} style={{ color: 'var(--text)' }}>
          {p}
        </Note>
      ))}
      {!s.isLoaded(2) && <LoadingLine text={loadingText('the sounds', s.loadProgress)} testId="sounds-2" />}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        {s.sixOrder.map((k, i) => (
          <Card key={k} s={s} k={k} n={i + 1} />
        ))}
      </div>
      <Content>{MADE_OFFLINE_LINE}</Content>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <Btn primary onClick={() => s.commitLabels()} disabled={!s.allLabeled}>
          Commit my labels
        </Btn>
        <Note data-labeled-count>{`${labeled} of 6 labeled.`}</Note>
        <PauseButton s={s} />
      </div>
    </StagePanel>
  )
}
