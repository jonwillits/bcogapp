import { useCallback } from 'react'
import { Btn, Choice, Content, FixedLines, GroupLabel, Note, StagePanel } from '../ui'
import { LinePlot } from '../plots'
import { Spectrogram } from '../Spectrogram'
import { useAudioCursor } from '../hooks'
import { SYNTHETIC_TEST_LINE, MADE_OFFLINE_LINE } from '../lines'
import { LABELS } from '../../../sim/language/sounds/classifier'
import { STEP4_PANEL } from './texts'
import { tokenSamples } from './assets'
import { PREDICTIONS, type PredictionKey, type RunState, type SoundsStore } from './store'

/**
 * Step 4's screens (spec §5.4): the network's panel, three runs each with
 * a prediction committed first, the curve of held-out accuracy by pass,
 * the confusion table, and run 3's labeling curve on the 14 sounds beside
 * the student's own from Step 3 when that is done. Nothing here uses a
 * word from Step 3's held-back list until Step 3 is done.
 */
const COLORS: Record<string, string> = { b: 'var(--accent)', d: 'var(--sensor)', g: 'var(--actuator)' }

function Prediction({ s, k }: { s: SoundsStore; k: PredictionKey }) {
  const p = PREDICTIONS[k]
  const committed = s.predicted(k)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: 8, border: '1px solid var(--border)', borderRadius: 8 }} data-predict={k}>
      <GroupLabel>Predict first</GroupLabel>
      <Note>{p.question}</Note>
      {committed ? (
        <FixedLines lines={[`Committed: ${committed}`]} mono={false} />
      ) : (
        <>
          <Choice value={s.drafts[k] ?? null} options={p.choices.map((c) => ({ id: c, label: c }))} onChange={(c) => s.draft(k, c)} />
          <div>
            <Btn primary onClick={() => s.commit(k)} disabled={!s.drafts[k]}>
              Commit my prediction
            </Btn>
          </div>
        </>
      )}
    </div>
  )
}

export function Step4Controls({ s }: { s: SoundsStore }) {
  const ready = s.tokens !== null && s.continuumPatches !== null
  const step3Done = s.isDone(3)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} data-step4-controls>
      {!ready && <Note data-loading>{s.tokens ? 'The 14 sounds are loading.' : `The 540 training syllables are loading: ${s.tokenProgress} prepared.`}</Note>}
      <GroupLabel>Run 1</GroupLabel>
      <Prediction s={s} k="run1" />
      <div style={{ display: 'flex', gap: 6 }}>
        <Btn primary onClick={() => s.train1()} disabled={!ready || !s.predicted('run1') || s.run1.state === 'training'}>
          {s.run1.state === 'done' ? 'Train again' : 'Train'}
        </Btn>
      </div>
      <GroupLabel>Run 2</GroupLabel>
      <Prediction s={s} k="run2" />
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <Btn onClick={() => s.train2('pitch')} disabled={!ready || !s.predicted('run2') || s.run2.state === 'training'}>
          Train on one pitch
        </Btn>
        <Btn onClick={() => s.train2('voice')} disabled={!ready || !s.predicted('run2') || s.run2.state === 'training'}>
          Train on one voice
        </Btn>
      </div>
      <GroupLabel>Run 3</GroupLabel>
      <Prediction s={s} k={step3Done ? 'run3After' : 'run3'} />
      <div>
        <Btn onClick={() => s.run3Now()} disabled={!ready || !s.predicted('run3') || s.run1.state !== 'done'}>
          Run on the 14 sounds
        </Btn>
      </div>
      {s.run1.state !== 'done' && <Note>Run 3 uses the network from run 1, so run 1 comes first.</Note>}
    </div>
  )
}

function RunPanel({ title, run, note }: { title: string; run: RunState; note: string }) {
  if (run.state === 'idle') return null
  const curve = run.curve.map((v, i) => [i + 1, v] as [number, number])
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }} data-run={title}>
      <GroupLabel>{title}</GroupLabel>
      <Note>{note}</Note>
      <Note data-run-state>{run.state === 'training' ? `Training: pass ${run.pass} of 12.` : `Training is done: ${run.accuracy!.toFixed(1)}% of the ${run.testSize} test syllables labeled correctly after 12 passes over ${run.trainingSize} training syllables.`}</Note>
      {curve.length > 0 && <LinePlot series={[{ label: 'percentage correct on the test syllables', color: 'var(--accent)', points: curve }]} width={420} height={170} xLabel="pass through the training syllables" yLabel="percent correct" xMin={1} xMax={12} xTicks={[1, 4, 8, 12].map((x) => ({ x, label: String(x) }))} hLines={[{ y: 33.3, label: 'chance, 33%' }]} testId={`curve-${title}`} />}
      {run.confusion && (
        <>
          <Note>The table: each row is the right label, each column the network’s label, and each cell counts test syllables.</Note>
          <FixedLines lines={['right \\ network   b    d    g', ...LABELS.map((l, i) => `${l.padEnd(16)}${run.confusion![i].map((v) => String(v).padStart(4)).join(' ')}`)]} testId={`confusion-${title}`} />
        </>
      )}
    </div>
  )
}

export function Step4Stage({ s }: { s: SoundsStore }) {
  const t = s.tts?.tokens.tokens
  const sampleIndex = t ? t.findIndex((x) => x.voice === 1 && x.consonant === 'd' && x.vowel === 'ah' && x.shift === 0) : -1
  const tokClip = s.clip('tokens')
  const read = useCallback(() => s.cursorIn(`token:${sampleIndex}`), [s, sampleIndex])
  const cursor = useAudioCursor(read, s.playing?.key === `token:${sampleIndex}`)
  const sample = tokClip && t && sampleIndex >= 0 ? tokenSamples(tokClip, t[sampleIndex]) : null
  return (
    <StagePanel wide testId="sounds-4">
      <div style={{ fontSize: 14, fontWeight: 600 }}>A classifier learns the labels</div>
      {STEP4_PANEL.map((p) => (
        <Note key={p.slice(0, 16)} style={{ color: 'var(--text)' }}>
          {p}
        </Note>
      ))}
      {sample && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div>
            <Note>One training syllable, dah in voice 1 at its own pitch. The box marks the patch the network receives: from 20 ms before the release to 80 ms after it, 0 to 5,000 Hz.</Note>
            <Btn small onClick={() => s.playToken(sampleIndex)}>
              Play
            </Btn>
          </div>
          <Spectrogram samples={sample} sampleRate={16000} view="wide" width={360} height={200} cursorS={cursor} highlights={[{ fromS: Math.max(0, t![sampleIndex].burstS - 0.02), toS: t![sampleIndex].burstS + 0.08, color: '#f0a94b', label: 'the patch' }]} testId="token-sample" />
        </div>
      )}
      <RunPanel title="Run 1: ten voices in, two held out" run={s.run1} note="Trained on voices 1 to 10 at all three pitches (450 syllables); tested on voices 11 and 12 (90 syllables) after every pass." />
      <RunPanel title={s.run2.which === 'voice' ? 'Run 2: one voice' : 'Run 2: one pitch'} run={s.run2} note={s.run2.which === 'voice' ? 'Trained on voice 1 at its three pitches (45 syllables); tested on the other eleven voices (495 syllables).' : 'Trained on every voice at its own pitch only (150 syllables); tested on every shifted syllable and the two held-out voices (390 syllables).'} />
      {s.run3.state === 'done' && s.run3.shares && <Run3 s={s} />}
      <Content>{MADE_OFFLINE_LINE}</Content>
    </StagePanel>
  )
}

function Run3({ s }: { s: SoundsStore }) {
  const shares = s.run3.shares!
  const series = LABELS.map((l, k) => ({ label: `share of output for ${l}`, color: COLORS[l], points: shares.map((sh, i) => [i + 1, 100 * sh[k]] as [number, number]) }))
  const top = shares.map((sh) => LABELS[sh.indexOf(Math.max(...sh))])
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }} data-run="run3">
      <GroupLabel>Run 3: the network from run 1 on the 14 sounds of Step 3</GroupLabel>
      <Note>For each of the 14 sounds, the three outputs are scaled to shares that sum to 100%. Each line is one label’s share, sound by sound. The most likely label at each sound is printed under the plot.</Note>
      <LinePlot series={series} width={460} height={200} xLabel="sound, 1 to 14" yLabel="share of the outputs (%)" xMin={1} xMax={14} xTicks={[1, 4, 7, 10, 14].map((x) => ({ x, label: String(x) }))} testId="run3-curve" />
      <FixedLines lines={['sound:  ' + Array.from({ length: 14 }, (_, i) => String(i + 1).padStart(3)).join(''), 'label:  ' + top.map((l) => l.padStart(3)).join('')]} testId="run3-labels" />
      <Content>{SYNTHETIC_TEST_LINE}</Content>
      {!s.isDone(3) && <Note data-missing="step3">Your own labels of these 14 sounds appear beside the network’s once Step 3 is done.</Note>}
    </div>
  )
}
