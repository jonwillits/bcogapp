import { useCallback, useRef } from 'react'
import type { ProgressStore } from '../../../sim/language/progress/store'
import { Btn, Content, FixedLines, GroupLabel, Note, Para, Section, StagePanel, useWidth } from '../ui'
import { Spectrogram } from '../Spectrogram'
import { LinePlot } from '../plots'
import { ReferencePanel } from '../ReferencePanel'
import { useAudioCursor } from '../hooks'
import { reference } from '../../../sim/language/references'
import { crossing, discrimination, labelingCurves, predictedCurve, LABELS as ABX_LABELS, PAIRS, STEPS } from '../../../sim/language/sounds/abx'
import { MEASURED_LINE, ONE_LISTENER_LINE, RESTARTED_LINE } from '../lines'
import { SIX_ORDER, type Six } from './assets'
import { LABELS_UNIT, LABELING_UNIT, ABX_UNIT, type AbxResult, type LabelingResult, type LabelsResult, type SoundsStore } from './store'

/**
 * Part 1's reveals (spec §5.2, §5.3): Step 2's, after the commit of the
 * six labels (the named spectrograms in the center, in a 3 × 2 grid, and
 * the table of labels on the right: Jon, 2026-11-16), and Step 3's, after
 * both blocks, in numbered sections, each saying what its rows, lines and
 * marks are and none saying what to conclude. Step 3's series is the first
 * 9 of the shipped 14 (abx.ts). This is the one Part 1 file that may name a
 * transition, a rise or a fall, a category or a boundary (`naming.test.ts`).
 */
/** Step 2's results in the center, after the commit (Jon, 2026-11-16: the spectrograms need the room; the table of labels stays on the right). */
const STEP2_DONE_LINE = 'Your labels beside the right ones are on the right. Below, the six syllables are named, in the order you saw them, with their measured formant tracks.'

const IPA: Record<Six, string> = { bee: '/bi/', bah: '/bɑ/', boo: '/bu/', dee: '/di/', dah: '/dɑ/', doo: '/du/' }
const COLORS: Record<string, string> = { b: 'var(--accent)', d: 'var(--sensor)', g: 'var(--actuator)' }

function direction(f2: (number | null)[], times: number[]): { word: string; from: number | null; to: number | null } {
  // From 10 ms after the burst to 100 ms, as the stimulus sheet says: the frame at the burst is noise.
  const at = (ms: number) => f2[times.findIndex((t) => Math.round(t * 1000) === ms)] ?? null
  const from = at(10)
  const to = at(100)
  if (from === null || to === null) return { word: 'could not be measured', from, to }
  const d = to - from
  return { word: d > 150 ? 'rises' : d < -150 ? 'falls' : 'stays nearly level', from, to }
}

function SixReveal({ s, k, n, width }: { s: SoundsStore; k: Six; n: number; width: number }) {
  const key = `six:${k}`
  const clip = s.clip(key)
  const read = useCallback(() => s.cursorIn(key), [s, key])
  const cursor = useAudioCursor(read, s.playing?.key === key)
  const info = s.tts?.six[k]
  const tracks = info
    ? [
        { label: 'second formant, measured', color: '#f0a94b', points: info.tracks.timesS.map((t, i) => [info.burstS + t, i === 0 || i === 1 ? null : info.tracks.f2[i]] as [number, number | null]) },
        { label: 'first formant, measured', color: '#34d399', points: info.tracks.timesS.map((t, i) => [info.burstS + t, i === 0 || i === 1 ? null : info.tracks.f1[i]] as [number, number | null]) },
      ]
    : undefined
  const dir = info ? direction(info.tracks.f2, info.tracks.timesS) : null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }} data-six-reveal={k}>
      <Spectrogram samples={clip?.samples ?? null} sampleRate={clip?.sampleRate ?? 16000} view="wide" width={width} height={Math.round(width * 0.72)} cursorS={cursor} tracks={tracks} marks={info ? [{ atS: info.burstS, label: 'release' }] : undefined} noWaveform testId={`six-reveal-${k}`} />
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <Btn small onClick={() => s.play(key)} disabled={!clip}>
          Play
        </Btn>
        <Note>
          Sound {n}: <b>{k}</b> {IPA[k]}
        </Note>
      </div>
      {dir && (
        <Para>
          {`The second formant ${dir.word} into the vowel: ${dir.from ?? '?'} Hz at 10 ms after the release and ${dir.to ?? '?'} Hz at 100 ms, by Praat’s measurement.`}
        </Para>
      )}
    </div>
  )
}

/** Step 2's center panel once the six labels are committed: the named spectrograms in a 3 × 2 grid, the context section, voice timing, and the button that comes next. */
export function LabelsStage({ s, result, onNext }: { s: SoundsStore; result: LabelsResult; onNext: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const room = useWidth(ref, 720)
  const card = Math.max(180, Math.floor((room - 20) / 3))
  return (
    <StagePanel wide testId="sounds-2-done">
      <div style={{ fontSize: 14, fontWeight: 600 }}>Six syllables: the reveal</div>
      <Note style={{ color: 'var(--text)' }}>{STEP2_DONE_LINE}</Note>
      <div ref={ref} style={{ display: 'flex', flexDirection: 'column', gap: 12 }} data-reveal="labels-stage">
        {result.restarts > 0 && <Content>{RESTARTED_LINE}</Content>}
        <Section n={1} title="The six syllables, with their measured formant tracks">
          <Para>Each spectrogram is now labeled with its syllable, in the order you saw them. The orange line is the second formant’s track and the green line the first formant’s, measured from the sound over the first 100 ms after the release (the red mark), at 5 ms steps. A formant transition is the movement of a formant from the consonant into the vowel.</Para>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(3, ${card}px)`, gap: 10 }} data-six-grid>
            {result.order.map((k, i) => (
              <SixReveal key={k} s={s} k={k} n={i + 1} width={card} />
            ))}
          </div>
          <Content>{MEASURED_LINE}</Content>
        </Section>
        <Section n={3} title="The same consonant in different contexts">
          <Para>The reading says that no acoustic property marks a speech sound in every context, and that the same consonant sounds a little different before different vowels (§13.2.2). The three b syllables begin with the same consonant, and so do the three d syllables; the tracks above show what the second formant did in each, before each vowel. This is called coarticulation: a consonant’s sound is shaped by the vowel that follows it.</Para>
        </Section>
        <Section n={4} title="Voice timing, an optional screen">
          <Para>Press “Show voice timing” to see tot and dot, from the same voice, with the voice-onset time measured: the time from the consonant’s release to the start of voicing, which the reading’s figure of larynx timing illustrates (§13.3.1).</Para>
          <div>
            <Btn onClick={() => s.toggleVot()}>{s.showVot ? 'Hide voice timing' : 'Show voice timing'}</Btn>
          </div>
          {s.showVot && <VotScreen s={s} width={Math.max(220, Math.floor((room - 10) / 2))} />}
        </Section>
      </div>
      <Note data-next>When you are ready to move on, press “Go on to Step 3” here or on the left.</Note>
      <div>
        <Btn primary onClick={onNext}>
          Go on to Step 3
        </Btn>
      </div>
    </StagePanel>
  )
}

/** Step 2's right column once the labels are committed: the table of labels beside the right ones (section 2). */
export function LabelsReveal({ result }: { result: LabelsResult }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }} data-reveal="labels">
      {result.restarts > 0 && <Content>{RESTARTED_LINE}</Content>}
      <Section n={2} title="Your labels beside the right ones">
        <Para>One row per sound, in the order you saw them: your label, the right label, and whether they agree. The last line is your count correct out of 6. The six spectrograms, named and with their measured tracks, are in the center.</Para>
        <FixedLines lines={[...result.order.map((k, i) => `Sound ${i + 1}  ${k.padEnd(4)} your label ${result.labels[k]}   right label ${k[0]}   ${result.labels[k] === k[0] ? 'agree' : 'differ'}`), `Correct: ${result.correct} of 6`]} testId="labels-table" />
      </Section>
    </div>
  )
}

function VotScreen({ s, width }: { s: SoundsStore; width: number }) {
  const vot = s.tts?.vot
  if (!vot) return <Note data-loading>Loading.</Note>
  return (
    <div style={{ display: 'flex', flexWrap: 'nowrap', gap: 10 }} data-vot>
      {(['tot', 'dot'] as const).map((k) => {
        const v = vot[k]
        const clip = s.clip(`vot:${k}`)
        return (
          <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <Spectrogram samples={clip?.samples ?? null} sampleRate={16000} view="wide" width={width} height={Math.round(width * 0.55)} marks={[{ atS: v.burstS, label: 'release' }, { atS: v.voicingS, label: 'voicing', color: '#34d399' }]} noWaveform testId={`vot-${k}`} />
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Btn small onClick={() => s.play(`vot:${k}`)} disabled={!clip}>
                Play
              </Btn>
              <Note>{`${k}: voicing begins ${v.votMs} ms after the release.`}</Note>
            </div>
          </div>
        )
      })}
      <Para>In tot, the vocal folds start vibrating tens of milliseconds after the release; in dot, almost at once. The reading’s figure (§13.3.1) draws the same timing difference.</Para>
    </div>
  )
}

export function Step3Reveal({ labeling, abx }: { labeling: LabelingResult; abx: AbxResult }) {
  const curves = labelingCurves(labeling.trials, labeling.answers)
  const disc = discrimination(abx.trials, abx.answers)
  const pred = predictedCurve(curves)
  const bd = crossing(curves.b, curves.d)
  const ref = reference('liberman-listener')
  const refB = (ref.values![0].value as string).split(' ').map(Number)
  const refD = (ref.values![1].value as string).split(' ').map(Number)
  const refG = (ref.values![2].value as string).split(' ').map(Number)
  const refObt = (ref.values![3].value as string).split(' ').map(Number)
  const refPred = (ref.values![4].value as string).split(' ').map(Number)
  const gap = disc.map((d, i) => 100 * d.correct - 100 * pred[i].predicted)
  const meanGap = gap.reduce((a, b) => a + b, 0) / gap.length
  const steps = Array.from({ length: STEPS }, (_, i) => i + 1)
  const tick = [1, 3, 5, 7, 9].map((x) => ({ x, label: String(x) }))
  const nPairs = PAIRS.length
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }} data-reveal="step3">
      {(labeling.restarts > 0 || abx.restarts > 0) && <Content>{RESTARTED_LINE}</Content>}
      <Section n={1} title="Your labeling curves">
        <Para>{`The ${STEPS} sounds differ only in where the second formant starts: at sound 1 it starts 840 Hz below the vowel’s second formant and rises into it; at sound ${STEPS} it starts 120 Hz above it; between them the start moves up in steps of 120 Hz. Each line is one label: for each sound, the percentage of its 6 presentations you labeled b or d.`}</Para>
        <LinePlot series={ABX_LABELS.map((l) => ({ label: `labeled ${l}`, color: COLORS[l], points: steps.map((st) => [st, 100 * curves[l][st - 1]] as [number, number]) }))} width={440} height={200} xLabel={`sound, 1 to ${STEPS} (second-formant start from 1,320 to 2,280 Hz)`} yLabel="percent of 6 presentations" xMin={1} xMax={STEPS} xTicks={tick} testId="labeling-curves" />
      </Section>
      <Section n={2} title="Your discrimination">
        <Para>Each point is one pair of sounds two steps apart, plotted at the pair’s middle sound: the percentage of its 4 triads on which you said which sound the third one matched. Chance, 50%, is marked. This is the measure the reading’s figure of categorical perception plots (§13.2.2).</Para>
        <LinePlot series={[{ label: 'told apart (your answers)', color: 'var(--accent)', points: disc.map((d) => [d.middle, 100 * d.correct] as [number, number]) }, { label: 'predicted from your labels alone', color: 'var(--text-muted)', dashed: true, points: pred.map((p) => [p.middle, 100 * p.predicted] as [number, number]) }]} width={440} height={200} xLabel="middle sound of a pair two steps apart" yLabel="percent of 4 triads correct" xMin={1} xMax={STEPS} xTicks={tick} hLines={[{ y: 50, label: 'chance, 50%' }]} testId="discrimination" />
      </Section>
      <Section n={3} title="Discrimination predicted from your labels alone">
        <Para>The dashed line is what your discrimination would be if you could hear no difference between two sounds beyond the labels you give them. It is computed by the 1957 paper’s method (pp. 362–363). For a pair of sounds A and B, with p the shares of A’s six labels and p′ the shares of B’s:</Para>
        <FixedLines lines={['predicted percent correct = 50% + 25% × [ (p_b − p′_b)² + (p_d − p′_d)² ]']} testId="formula" />
        <Para>Two sounds you always labeled the same give 50%, chance. Two sounds you never labeled the same give 100%. The formula averages the paper’s two triad orders. It rests on the assumption that a listener hears each sound as one of the two labels and judges the triad from the labels alone.</Para>
        <FixedLines lines={PAIRS.map(([a, b], i) => `sounds ${String(a).padStart(2)} and ${String(b).padStart(2)}   told apart ${String(Math.round(100 * disc[i].correct)).padStart(3)}%   predicted ${String(Math.round(100 * pred[i].predicted)).padStart(3)}%   gap ${gap[i] >= 0 ? '+' : '−'}${String(Math.abs(Math.round(gap[i]))).padStart(3)}`)} testId="predicted-table" />
      </Section>
      <Section n={4} title="Where your boundary fell">
        <Para>A phoneme boundary is the point on the series where your labels change from one consonant to the next: the sound at which the two labeling curves cross. The crossing is read off by a straight line between neighboring sounds.</Para>
        <FixedLines lines={[`b to d: ${bd === null ? 'the b and d curves do not cross' : `between sounds ${Math.floor(bd)} and ${Math.ceil(bd)}, at about ${bd.toFixed(1)}`}`]} testId="boundaries" />
      </Section>
      <Section n={5} title="The reference listener">
        <Para>{`The reading’s figure of categorical perception shows one listener from the 1957 experiment, over 14 sounds; this step played the first ${STEPS} of them. Here are that listener’s labeling curves and discrimination over those ${STEPS}, drawn from the same figure, beside yours. The 1957 series went on to a third consonant, g, and at sound ${STEPS} this listener heard g 17% of the time. In words, from the paper (p. 362): stimuli 1 and 3, both heard as b, were told apart 55% of the time; stimuli 3 and 5, heard as b and d, 100% of the time.`}</Para>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <LinePlot series={[{ label: 'b', color: COLORS.b, points: steps.map((st) => [st, refB[st - 1]] as [number, number]) }, { label: 'd', color: COLORS.d, points: steps.map((st) => [st, refD[st - 1]] as [number, number]) }, { label: 'g', color: COLORS.g, points: steps.map((st) => [st, refG[st - 1]] as [number, number]) }]} width={300} height={170} xLabel={`sound, 1 to ${STEPS}`} yLabel="percent labeled" xMin={1} xMax={STEPS} xTicks={tick} testId="ref-labels" />
          <LinePlot series={[{ label: 'told apart', color: 'var(--accent)', points: refObt.slice(0, nPairs).map((v, i) => [i + 2, v] as [number, number]) }, { label: 'predicted', color: 'var(--text-muted)', dashed: true, points: refPred.slice(0, nPairs).map((v, i) => [i + 2, v] as [number, number]) }]} width={300} height={170} xLabel="middle sound of a pair" yLabel="percent correct" xMin={1} xMax={STEPS} xTicks={tick} hLines={[{ y: 50, label: 'chance' }]} testId="ref-disc" />
        </div>
        <Content>{ONE_LISTENER_LINE}</Content>
        <ReferencePanel reference={reference('liberman-pairs')} />
      </Section>
      <Section n={6} title="What the 1957 paper found about prediction">
        <Para>The paper’s authors compared each listener’s obtained discrimination with the discrimination predicted from the labels, and reported that the predicted peaks fell in the right places, but that the listeners discriminated better than the labels alone predict (p. 366). The pattern is called categorical perception: labeling that changes sharply along a continuum, with discrimination best at the boundary between categories and poorer within a category, though not absent there (§13.2.2).</Para>
        <FixedLines lines={[`Your mean gap, told apart minus predicted, over the ${nPairs} pairs: ${meanGap >= 0 ? '+' : '−'}${Math.abs(meanGap).toFixed(1)} points`]} testId="mean-gap" />
        <ReferencePanel reference={reference('liberman-prediction')} />
      </Section>
    </div>
  )
}

/** Part 1's gathered results, for the Open tab: the finished experiments' reveals from the saved results (the spectrograms need the sounds, so Step 2's shows its table only here). */
export function SoundsResults({ progress }: { progress: ProgressStore }) {
  const labels = progress.result(LABELS_UNIT) as LabelsResult | undefined
  const labeling = progress.result(LABELING_UNIT) as LabelingResult | undefined
  const abx = progress.result(ABX_UNIT) as AbxResult | undefined
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }} data-results="sounds">
      {labels && (
        <>
          <GroupLabel>Step 2: your six labels</GroupLabel>
          <FixedLines lines={[...labels.order.map((k, i) => `Sound ${i + 1}  ${k.padEnd(4)} your label ${labels.labels[k]}   right label ${k[0]}`), `Correct: ${labels.correct} of 6`]} />
        </>
      )}
      {labeling && abx && <Step3Reveal labeling={labeling} abx={abx} />}
      {!labels && !(labeling && abx) && <Note>No experiment of Part 1 is finished yet.</Note>}
    </div>
  )
}

export { SIX_ORDER }
