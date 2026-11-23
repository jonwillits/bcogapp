import { useCallback, useRef } from 'react'
import { Btn, Content, DataTable, FixedLines, LoadingLine, Note, Para, Section, StagePanel, useWidth } from '../ui'
import { MAIN_TABS } from '../params'
import { Spectrogram } from '../Spectrogram'
import { LinePlot } from '../plots'
import { ReferencePanel } from '../ReferencePanel'
import { useAudioCursor } from '../hooks'
import { reference } from '../../../sim/language/references'
import { crossing, discrimination, labelingCurves, predictedCurve, LABELS as ABX_LABELS, PAIRS, STEPS } from '../../../sim/language/sounds/abx'
import { MEASURED_LINE, ONE_LISTENER_LINE, RESTARTED_LINE } from '../lines'
import { SIX_ORDER, type Six } from './assets'
import type { AbxResult, LabelingResult, LabelsResult, SoundsStore } from './store'

/**
 * Part 1's reveals (spec §5.2, §5.3): Step 2's, after the commit of the
 * six labels (the table of labels, then the named spectrograms in a 3 × 2
 * grid: Jon, 2026-11-16 and 2026-11-18), and Step 3's, after both blocks,
 * in numbered sections, each saying what its rows, lines and marks are and
 * none saying what to conclude. Each reveal has two modes: `full`, on the
 * step itself, with the explanation and the references; `results`, on the
 * All Results tab, the numbered sections with their one-sentence
 * descriptions and nothing more (Jon, 2026-11-18). Step 3's series is the
 * first 9 of the shipped 14 (abx.ts). This is the one Part 1 file that may
 * name a transition, a rise or a fall, a category or a boundary
 * (`naming.test.ts`).
 */
export type RevealMode = 'full' | 'results'

/** Step 2's finished stage: the done line, then the sections. */
const STEP2_DONE_LINE = `This step is done. Below, you will see your labels beside the right ones, then the six syllables, named, in the order you saw them. On each spectrogram are the tracks of its first two formants, measured from the sound. The table is also on the ${MAIN_TABS.results} tab at the top of this panel. The button to move on, “Go on to Step 3”, is at the end.`

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
          {dir.from === null || dir.to === null ? 'The second formant could not be measured in this syllable.' : `The second formant ${dir.word} into the vowel: ${dir.from} Hz at 10 milliseconds after the release and ${dir.to} Hz at 100 milliseconds, as measured by Praat, a speech-analysis program.`}
        </Para>
      )}
    </div>
  )
}

/** Step 2's stage once the six labels are committed: the done line and the button that comes next, then the table of labels, the named spectrograms in a 3 × 2 grid, the context section, and voice timing. */
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
        <LabelsTable result={result} />
        <Section n={2} title="The six syllables, with their measured formant tracks">
          <Para>Each spectrogram is now labeled with its syllable, in the order you saw them. The red mark is the release: the moment the closure of the lips or tongue opens and the consonant gives way to the vowel. The orange line is the track of the second formant and the green line the track of the first. Each track was measured from the sound at 5 millisecond steps over the first 100 milliseconds after the release. A formant transition is the movement of a formant from the consonant into the vowel.</Para>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(3, ${card}px)`, gap: 10 }} data-six-grid>
            {result.order.map((k, i) => (
              <SixReveal key={k} s={s} k={k} n={i + 1} width={card} />
            ))}
          </div>
          <Content>{MEASURED_LINE}</Content>
        </Section>
        <Section n={3} title="The same consonant in different contexts">
          <Para>The reading says that no acoustic property marks a speech sound in every context, and that the same consonant sounds a little different before different vowels (§13.2.2). The three “b” syllables begin with the same consonant, and so do the three “d” syllables. Compare the second formant’s track in the three “b” syllables, and then in the three “d” syllables: the same consonant, but a different track before each vowel. This shaping of a consonant’s sound by the vowel that follows it is called coarticulation.</Para>
        </Section>
        <Section n={4} title="Voice timing, an optional screen">
          <Para>Press “Show voice timing” to see two more syllables from the same voice, “tot” and “dot”. On each, the voice-onset time is marked: the time from the consonant’s release to the start of voicing, when the vocal folds begin to vibrate. The reading’s figure of larynx timing shows the same measure (§13.3.1).</Para>
          <div>
            <Btn onClick={() => s.toggleVot()}>{s.showVot ? 'Hide voice timing' : 'Show voice timing'}</Btn>
          </div>
          {s.showVot && <VotScreen s={s} width={Math.max(220, Math.floor((room - 10) / 2))} />}
        </Section>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8, paddingTop: 10, borderTop: '1px solid var(--border)' }} data-next-row>
        <Note data-next>When you are ready to move on, press “Go on to Step 3” here or in the navigation panel.</Note>
        <div>
          <Btn primary onClick={onNext}>
            Go on to Step 3
          </Btn>
        </div>
      </div>
    </StagePanel>
  )
}

/** Step 2's results, section 1: the table of the student's labels beside the right ones. On the step and on the All Results tab. */
export function LabelsTable({ result }: { result: LabelsResult }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }} data-reveal="labels">
      {result.restarts > 0 && <Content>{RESTARTED_LINE}</Content>}
      <Section n={1} title="Your labels beside the right ones">
        <Para>One row per sound, in the order the six were shown: the syllable, your label, the right label, and 1 where they agree or 0 where they differ. The last line is your count correct out of 6.</Para>
        <DataTable
          testId="labels-table"
          columns={[
            { key: 'trial', label: 'Sound number', mono: true },
            { key: 'sound', label: 'Syllable', mono: true, align: 'left' },
            { key: 'yours', label: 'Your label', mono: true, align: 'center' },
            { key: 'right', label: 'Right label', mono: true, align: 'center' },
            { key: 'agree', label: 'Agree', mono: true, align: 'center' },
          ]}
          rows={result.order.map((k, i) => ({ trial: i + 1, sound: k, yours: result.labels[k], right: k[0], agree: result.labels[k] === k[0] ? 1 : 0 }))}
          footer={`Correct: ${result.correct} of 6`}
        />
      </Section>
    </div>
  )
}

function VotScreen({ s, width }: { s: SoundsStore; width: number }) {
  const vot = s.tts?.vot
  if (!vot) return <LoadingLine text="Loading the sounds." testId="vot" />
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} data-vot>
      <div style={{ display: 'flex', flexWrap: 'nowrap', gap: 10 }}>
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
              <Note>{`“${k}”: voicing begins ${v.votMs} milliseconds after the release.`}</Note>
            </div>
          </div>
        )
      })}
      </div>
      <Para>In “tot”, the vocal folds start vibrating tens of milliseconds after the release; in “dot”, almost at once. The reading’s figure (§13.3.1) draws the same timing difference.</Para>
    </div>
  )
}

export function Step3Reveal({ labeling, abx, mode = 'full' }: { labeling: LabelingResult; abx: AbxResult; mode?: RevealMode }) {
  const full = mode === 'full'
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
  const box = useRef<HTMLDivElement>(null)
  const room = useWidth(box, 900)
  // The two plots of sections 1 and 2 side by side when each gets at least 420 px; one under the other otherwise (Jon, 2026-11-18: the reveals take the main panel's width).
  const twoUp = room >= 860
  const plotW = twoUp ? Math.floor((room - 16) / 2) : Math.min(640, room)
  const plotH = Math.round(plotW * 0.48)
  return (
    <div ref={box} style={{ display: 'flex', flexDirection: 'column', gap: 12 }} data-reveal="step3" data-plots={twoUp ? 'two-up' : 'stacked'}>
      {(labeling.restarts > 0 || abx.restarts > 0) && <Content>{RESTARTED_LINE}</Content>}
      <div style={{ display: 'flex', flexDirection: twoUp ? 'row' : 'column', gap: 16, alignItems: 'flex-start' }}>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Section n={1} title="Your labeling curves">
        <Para>{`The ${STEPS} sounds differ only in where the second formant starts. At sound 1, the second formant starts 840 Hz below the vowel’s second formant and rises into it. From one sound to the next, the start moves up by 120 Hz, so at sound ${STEPS} it starts 120 Hz above the vowel’s. Each line is one label: for each sound, the percentage of its 6 presentations on which you gave that label.`}</Para>
        <LinePlot series={ABX_LABELS.map((l) => ({ label: `labeled ${l}`, color: COLORS[l], points: steps.map((st) => [st, 100 * curves[l][st - 1]] as [number, number]) }))} width={plotW} height={plotH} xLabel={`sound, 1 to ${STEPS} (second-formant start from 1,320 to 2,280 Hz)`} yLabel="percent of 6 presentations" xMin={1} xMax={STEPS} xTicks={tick} testId="labeling-curves" />
      </Section>
      </div>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Section n={2} title="Your discrimination">
        <Para>Each point is one pair of sounds two steps apart, plotted at the pair’s middle sound. In block 2, each pair came up on 4 trials of three sounds, called triads. The point is the percentage of those 4 on which you matched the third sound to the right one of the first two. Chance, 50%, is marked. This is the measure the reading’s figure of categorical perception shows (§13.2.2).</Para>
        <LinePlot series={[{ label: 'told apart (your answers)', color: 'var(--accent)', points: disc.map((d) => [d.middle, 100 * d.correct] as [number, number]) }, { label: 'predicted from your labels alone', color: 'var(--text-muted)', dashed: true, points: pred.map((p) => [p.middle, 100 * p.predicted] as [number, number]) }]} width={plotW} height={plotH} xLabel="middle sound of a pair two steps apart" yLabel="percent of 4 triads correct" xMin={1} xMax={STEPS} xTicks={tick} hLines={[{ y: 50, label: 'chance, 50%' }]} testId="discrimination" />
      </Section>
      </div>
      </div>
      <Section n={3} title="Discrimination predicted from your labels alone">
        <Para>One row per pair of sounds two steps apart: the percentage you told apart, the percentage predicted from your labels alone, and the gap between them. The last line is the mean gap over the pairs.</Para>
        {full && (
          <>
            <Para>The dashed line in section 2 is what your discrimination would be if you heard no difference between two sounds beyond the labels you give them. It is computed by the method of the 1957 paper the reading’s figure comes from (pp. 362–363). For a pair of sounds A and B, call p the shares of A’s six labels and p′ the shares of B’s:</Para>
            <FixedLines lines={['predicted percent correct = 50% + 25% × [ (p_b − p′_b)² + (p_d − p′_d)² ]']} testId="formula" />
            <Para>Two sounds you always labeled the same give 50%, chance. Two sounds you never labeled the same give 100%. The paper worked the value out for each of the two orders in which a pair can be played and averaged the two; the formula is that average. It rests on the assumption that a listener hears each sound as one of the two labels and judges the triad from the labels alone.</Para>
          </>
        )}
        <DataTable
          testId="predicted-table"
          columns={[
            { key: 'pair', label: 'Sounds', mono: true, align: 'left' },
            { key: 'told', label: 'Told apart', mono: true },
            { key: 'pred', label: 'Predicted from your labels', mono: true },
            { key: 'gap', label: 'Gap, in points', mono: true },
          ]}
          rows={PAIRS.map(([a, b], i) => ({ pair: `${a} and ${b}`, told: `${Math.round(100 * disc[i].correct)}%`, pred: `${Math.round(100 * pred[i].predicted)}%`, gap: `${gap[i] >= 0 ? '+' : '−'}${Math.abs(Math.round(gap[i]))}` }))}
          footer={<span data-lines="mean-gap">{`Your mean gap, told apart minus predicted, over the ${nPairs} pairs: ${meanGap >= 0 ? '+' : '−'}${Math.abs(meanGap).toFixed(1)} points`}</span>}
        />
      </Section>
      <Section n={4} title="Where your boundary fell">
        <Para>A phoneme boundary is the point on the series of 9 sounds where your labels change from one consonant to the other: the sound at which the “b” curve and the “d” curve cross. Between two neighboring sounds, the crossing is placed on a straight line drawn from one sound’s value to the next.</Para>
        <FixedLines lines={[`“b” to “d”: ${bd === null ? 'the “b” and “d” curves do not cross' : `between sounds ${Math.floor(bd)} and ${Math.ceil(bd)}, at about ${bd.toFixed(1)}`}`]} testId="boundaries" />
      </Section>
      {full && (
        <>
      <Section n={5} title="The reference listener">
        <Para>{`The reading’s figure of categorical perception shows one listener from the 1957 experiment, over 14 sounds; in this step you heard the first ${STEPS} of them. Here are that listener’s labeling curves and discrimination over those ${STEPS}, drawn from the same figure, for you to compare with yours above. The 1957 series went on to a third consonant, “g”, and at sound ${STEPS} this listener heard “g” 17% of the time. In the paper’s words (p. 362), stimuli 1 and 3, both heard as “b”, were told apart 55% of the time, and stimuli 3 and 5, heard as “b” and “d”, 100% of the time.`}</Para>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <LinePlot series={[{ label: 'b', color: COLORS.b, points: steps.map((st) => [st, refB[st - 1]] as [number, number]) }, { label: 'd', color: COLORS.d, points: steps.map((st) => [st, refD[st - 1]] as [number, number]) }, { label: 'g', color: COLORS.g, points: steps.map((st) => [st, refG[st - 1]] as [number, number]) }]} width={Math.max(300, Math.floor((plotW - 10) / 2))} height={Math.round(Math.max(300, Math.floor((plotW - 10) / 2)) * 0.55)} xLabel={`sound, 1 to ${STEPS}`} yLabel="percent labeled" xMin={1} xMax={STEPS} xTicks={tick} testId="ref-labels" />
          <LinePlot series={[{ label: 'told apart', color: 'var(--accent)', points: refObt.slice(0, nPairs).map((v, i) => [i + 2, v] as [number, number]) }, { label: 'predicted', color: 'var(--text-muted)', dashed: true, points: refPred.slice(0, nPairs).map((v, i) => [i + 2, v] as [number, number]) }]} width={Math.max(300, Math.floor((plotW - 10) / 2))} height={Math.round(Math.max(300, Math.floor((plotW - 10) / 2)) * 0.55)} xLabel="middle sound of a pair" yLabel="percent correct" xMin={1} xMax={STEPS} xTicks={tick} hLines={[{ y: 50, label: 'chance' }]} testId="ref-disc" />
        </div>
        <Content>{ONE_LISTENER_LINE}</Content>
        <ReferencePanel reference={reference('liberman-pairs')} />
      </Section>
      <Section n={6} title="What the 1957 paper found about prediction">
        <Para>The paper’s authors compared each listener’s discrimination, as measured, with the discrimination predicted from the labels. They reported that the predicted peaks fell in the right places, but that the listeners discriminated better than the labels alone predict (p. 366). The pattern is called categorical perception: along a series of sounds that changes in even steps, labeling changes sharply, and discrimination is best at the boundary between categories and poorer, though not absent, within a category (§13.2.2).</Para>
        <ReferencePanel reference={reference('liberman-prediction')} />
      </Section>
        </>
      )}
    </div>
  )
}

export { SIX_ORDER }
