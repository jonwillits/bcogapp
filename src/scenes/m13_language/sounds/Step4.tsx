import { useCallback, useRef, type ReactNode } from 'react'
import { Btn, Choice, Content, DataTable, FixedLines, GroupLabel, LoadingLine, Note, Para, StagePanel, useWidth, type Column } from '../ui'
import { loadingText } from '../loading'
import { LinePlot } from '../plots'
import { Spectrogram } from '../Spectrogram'
import { useAudioCursor } from '../hooks'
import { SYNTHETIC_TEST_LINE, MADE_OFFLINE_LINE } from '../lines'
import { LABELS, PASSES, meanAndSd, meanBand, T_95_DF9 } from '../../../sim/language/sounds/classifier'
import { labelingCurves, STEPS } from '../../../sim/language/sounds/abx'
import { STEP4_PANEL } from './texts'
import { tokenSamples } from './assets'
import { Schematic } from './Schematic'
import { MANY_NETWORKS, PREDICTIONS, RUN2_KEYS, type PredictionKey, type RunState, type SoundsStore } from './store'

/**
 * Step 4's screens (spec §5.4): the network's panel with its drawing and
 * one training syllable, three runs each with its prediction(s) committed
 * first, in the center panel one under another (Jon, 2026-11-16: the left
 * column is navigation only), the curve of held-out accuracy by pass, the
 * confusion table, run 1's 10 networks with their mean and its band (Jon,
 * 2026-11-19), run 2's two networks side by side and its 10 of each (Jon,
 * 2026-11-20), and run 3's labeling
 * curve on the 9 sounds of Step 3. Nothing here uses a word from Step 3's
 * held-back list until Step 3 is done.
 */
const COLORS: Record<string, string> = { b: 'var(--accent)', d: 'var(--sensor)', g: 'var(--actuator)' }
const pct = (v: number) => `${v.toFixed(1)}%`

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

/** One run's block in the center: its prediction(s), then its button(s), then its results. */
function Run({ k, children }: { k: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 10 }} data-run-block={k}>
      {children}
    </div>
  )
}

function Loading({ s }: { s: SoundsStore }) {
  const ready = s.tokens !== null && s.continuumPatches !== null
  if (ready) return null
  const p = s.loadProgress
  // The sounds first (the token file and the continuum), then the 540 patches, counted as a bar (Jon, 2026-11-20).
  if (p && p.what === 'syllable') return <LoadingLine text={loadingText('the training syllables', p)} done={p.done} total={p.total} testId="sounds-4" />
  return <LoadingLine text={loadingText('the sounds', p)} testId="sounds-4" />
}

function Run1Controls({ s }: { s: SoundsStore }) {
  const ready = s.tokens !== null && s.continuumPatches !== null
  const busy = s.anyTraining
  return (
    <>
      <GroupLabel>Run 1</GroupLabel>
      <Prediction s={s} k="run1" />
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <Btn primary onClick={() => s.train1()} disabled={!ready || !s.predicted('run1') || busy}>
          {s.run1.state === 'done' ? 'Train again' : 'Train'}
        </Btn>
        {s.run1.state === 'done' && (
          <Btn onClick={() => s.train1Many()} disabled={!ready || busy}>
            {`Train ${MANY_NETWORKS} networks`}
          </Btn>
        )}
      </div>
    </>
  )
}

function Run2Controls({ s }: { s: SoundsStore }) {
  const ready = s.tokens !== null && s.continuumPatches !== null
  return (
    <>
      <GroupLabel>Run 2</GroupLabel>
      {RUN2_KEYS.map((k) => (
        <Prediction key={k} s={s} k={k} />
      ))}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <Btn primary onClick={() => s.trainBoth()} disabled={!ready || !s.run2Predicted || s.anyTraining}>
          Train both
        </Btn>
        {s.run2.state === 'done' && (
          <Btn onClick={() => s.train2Many()} disabled={!ready || s.anyTraining}>
            {`Train ${MANY_NETWORKS} of each`}
          </Btn>
        )}
      </div>
      {!s.run2Predicted && <Note>“Train both” is available once all three predictions are committed.</Note>}
    </>
  )
}

function Run3Controls({ s }: { s: SoundsStore }) {
  const ready = s.tokens !== null && s.continuumPatches !== null
  const step3Done = s.isDone(3)
  return (
    <>
      <GroupLabel>Run 3</GroupLabel>
      <Prediction s={s} k={step3Done ? 'run3After' : 'run3'} />
      <div>
        <Btn onClick={() => s.run3Now()} disabled={!ready || !s.predicted('run3') || s.run1.state !== 'done'}>
          Run on the 9 sounds
        </Btn>
      </div>
      {s.run1.state !== 'done' && <Note>Run 3 uses the network from run 1, so run 1 comes first.</Note>}
    </>
  )
}

const LABEL_COLUMNS: Column[] = [{ key: 'row', label: '', mono: true, align: 'left' }, ...LABELS.map((l) => ({ key: l, label: l, mono: true, align: 'right' as const }))]

/** The confusion table as a table with both axes named (Jon, 2026-11-19): rows the right label, columns the network's, cells counts of test syllables. */
function Confusion({ matrix, testId, note }: { matrix: number[][]; testId: string; note: string }) {
  return (
    <>
      <Note>{note}</Note>
      <DataTable columns={LABEL_COLUMNS} rows={LABELS.map((l, i) => ({ row: l, b: matrix[i][0], d: matrix[i][1], g: matrix[i][2] }))} topHeader="the network’s label" leftHeader="the right label" rowHeader testId={testId} />
    </>
  )
}

function RunPanel({ title, run, note, width }: { title: string; run: RunState; note: string; width: number }) {
  if (run.state === 'idle') return null
  const curve = run.curve.map((v, i) => [i + 1, v] as [number, number])
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }} data-run={title}>
      <GroupLabel>{title}</GroupLabel>
      <Note>{note}</Note>
      <Note data-run-state>{run.state === 'training' ? `Training: pass ${run.pass} of ${PASSES}.` : `Training is done: ${pct(run.accuracy!)} of the ${run.testSize} test syllables labeled correctly after ${PASSES} passes over ${run.trainingSize} training syllables.`}</Note>
      {curve.length > 0 && <LinePlot series={[{ label: 'percentage correct on the test syllables', color: 'var(--accent)', points: curve }]} width={Math.min(420, width)} height={170} xLabel="pass through the training syllables" yLabel="percent correct" xMin={1} xMax={PASSES} xTicks={[1, 4, 8, 12].map((x) => ({ x, label: String(x) }))} hLines={[{ y: 33.3, label: 'chance, 33%' }]} testId={`curve-${title}`} />}
      {run.confusion && <Confusion matrix={run.confusion} testId={`confusion-${title}`} note="Each cell counts test syllables." />}
    </div>
  )
}

/**
 * The 10 networks' curves on one plot: each network a thin faint line, the
 * mean the main line, and a band for the 95% confidence interval of the
 * mean at each pass. Drawn here rather than by LinePlot, which gives every
 * series a legend row and dots.
 */
function ManyPlot({ curves, width }: { curves: number[][]; width: number }) {
  const height = 190
  const pad = { l: 44, r: 12, t: 12, b: 34 }
  const X = (x: number) => pad.l + ((x - 1) / (PASSES - 1)) * (width - pad.l - pad.r)
  const Y = (y: number) => height - pad.b - (y / 100) * (height - pad.t - pad.b)
  const band = meanBand(curves, T_95_DF9)
  const mean = band.map((b) => [b.pass, b.mean] as [number, number])
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="percent correct against pass, for 10 networks and their mean" style={{ display: 'block', background: 'var(--bg)', borderRadius: 8 }} data-plot="curve-many">
      {[0, 50, 100].map((y) => (
        <g key={y}>
          <line x1={pad.l} y1={Y(y)} x2={width - pad.r} y2={Y(y)} stroke="var(--border)" />
          <text x={pad.l - 4} y={Y(y) + 3} fontSize={9} textAnchor="end" fill="var(--text-muted)">
            {y}
          </text>
        </g>
      ))}
      <line x1={pad.l} y1={Y(33.3)} x2={width - pad.r} y2={Y(33.3)} stroke="var(--text-muted)" strokeDasharray="3 3" />
      <text x={width - pad.r - 2} y={Y(33.3) - 3} fontSize={9} textAnchor="end" fill="var(--text-muted)">
        chance, 33%
      </text>
      {[1, 4, 8, 12].map((x) => (
        <text key={x} x={X(x)} y={height - pad.b + 12} fontSize={9} textAnchor="middle" fill="var(--text-muted)">
          {x}
        </text>
      ))}
      {band.length > 1 && <polygon points={[...band.map((b) => `${X(b.pass)},${Y(b.hi)}`), ...band.slice().reverse().map((b) => `${X(b.pass)},${Y(b.lo)}`)].join(' ')} fill="var(--accent)" opacity={0.18} data-band />}
      {curves.map((c, i) => (
        <polyline key={i} points={c.map((v, p) => `${X(p + 1)},${Y(v)}`).join(' ')} fill="none" stroke="var(--accent)" strokeWidth={1} opacity={0.3} data-network={i + 1} />
      ))}
      {mean.length > 0 && <polyline points={mean.map((p) => `${X(p[0])},${Y(p[1])}`).join(' ')} fill="none" stroke="var(--accent)" strokeWidth={2.2} data-mean />}
      {mean.map((p) => (
        <circle key={p[0]} cx={X(p[0])} cy={Y(p[1])} r={2.8} fill="var(--accent)">
          <title>{`mean: ${p[1].toFixed(1)} at pass ${p[0]}`}</title>
        </circle>
      ))}
      <text x={(pad.l + width - pad.r) / 2} y={height - 4} fontSize={10} textAnchor="middle" fill="var(--text-muted)">
        pass through the training syllables
      </text>
      <text x={10} y={(pad.t + height - pad.b) / 2} fontSize={10} textAnchor="middle" fill="var(--text-muted)" transform={`rotate(-90 10 ${(pad.t + height - pad.b) / 2})`}>
        percent correct
      </text>
      <line x1={pad.l + 8} y1={pad.t + 8} x2={pad.l + 22} y2={pad.t + 8} stroke="var(--accent)" strokeWidth={2.2} />
      <text x={pad.l + 26} y={pad.t + 11} fontSize={9} fill="var(--text-muted)">
        mean of the 10 networks, with its 95% confidence interval
      </text>
      <line x1={pad.l + 8} y1={pad.t + 20} x2={pad.l + 22} y2={pad.t + 20} stroke="var(--accent)" strokeWidth={1} opacity={0.5} />
      <text x={pad.l + 26} y={pad.t + 23} fontSize={9} fill="var(--text-muted)">
        one network
      </text>
    </svg>
  )
}

/** The mean of the final percentages with its 95% confidence interval, as the plot's band computes it at the last pass. */
function finalLine(finals: number[]): string {
  const { mean, sd } = meanAndSd(finals)
  const half = (T_95_DF9 * sd) / Math.sqrt(finals.length)
  return `mean ${pct(mean)}, standard deviation ${sd.toFixed(1)}, 95% confidence interval ${pct(mean - half)} to ${pct(mean + half)}, lowest ${pct(Math.min(...finals))}, highest ${pct(Math.max(...finals))}`
}

/**
 * MANY_NETWORKS networks of one kind: the progress line, the plot, its
 * explanation, the table of final accuracies, and the summed confusion
 * table. Run 1 has one of these; run 2 has two side by side (Jon,
 * 2026-11-20). `progress` is the line that says where the training is.
 */
function ManyPanel({ title, nets, finished, progress, note, testSize, after, width, testId }: { title: string; nets: RunState[]; finished: boolean; progress: string; note: string; testSize: number; after?: ReactNode; width: number; testId: string }) {
  const curves = nets.map((n) => n.curve).filter((c) => c.length > 0)
  const done = nets.filter((n) => n.state === 'done')
  const finals = done.map((n) => n.accuracy!)
  const summed = LABELS.map((_, i) => LABELS.map((_, j) => done.reduce((a, n) => a + (n.confusion?.[i][j] ?? 0), 0)))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }} data-run={title}>
      <GroupLabel>{title}</GroupLabel>
      <Note>{note}</Note>
      <Note data-many-state>{progress}</Note>
      {curves.length > 0 && <ManyPlot curves={curves} width={Math.min(480, width)} />}
      <Note>{`The thick line is the mean over the ${MANY_NETWORKS} networks at each pass; each thin line is one network. The band is the 95% confidence interval of the mean over the ${MANY_NETWORKS} networks: the mean plus or minus ${T_95_DF9} times the standard deviation divided by the square root of ${MANY_NETWORKS}, where ${T_95_DF9} is Student’s t for 9 degrees of freedom.`}</Note>
      {done.length > 0 && (
        <>
          <Note>{`The percentage correct on the ${testSize} test syllables after the last pass, network by network.`}</Note>
          <DataTable columns={[{ key: 'k', label: 'network', mono: true, align: 'right' }, { key: 'acc', label: 'percent correct', mono: true, align: 'right' }]} rows={done.map((n, i) => ({ k: i + 1, acc: pct(n.accuracy!) }))} footer={finished ? finalLine(finals) : undefined} testId={`many-accuracies-${testId}`} />
        </>
      )}
      {finished && <Confusion matrix={summed} testId={`confusion-${title}`} note={`Summed over the ${MANY_NETWORKS} networks’ labels of the ${testSize} test syllables: each cell counts syllables over all ${MANY_NETWORKS} networks, ${testSize * MANY_NETWORKS} in all.`} />}
      {after}
    </div>
  )
}

/** Run 1's 10 networks. */
function Run1Many({ s, width }: { s: SoundsStore; width: number }) {
  const many = s.run1Many
  if (many.state === 'idle') return null
  const current = many.nets[many.nets.length - 1]
  const progress = many.state === 'training' ? `Network ${many.k} of ${MANY_NETWORKS}, pass ${current?.pass ?? 0} of ${PASSES}.` : `Training is done: ${MANY_NETWORKS} networks, ${PASSES} passes each.`
  return <ManyPanel title={`Run 1, ${MANY_NETWORKS} networks: ten voices in, two held out`} nets={many.nets} finished={many.state === 'done'} progress={progress} note={`${MANY_NETWORKS} networks, each from its own starting weights, trained one after another as run 1’s network was: on voices 1 to 10 at all three pitches (450 syllables), tested on voices 11 and 12 (90 syllables) after every pass.`} testSize={90} width={width} testId="run1" after={<Note>{`Run 3 uses the network from the single run 1 above, not one of these ${MANY_NETWORKS}.`}</Note>} />
}

/** Run 2's 10 of each (Jon, 2026-11-20): the one-pitch networks, then the one-voice networks, side by side when there is room, and a line under them with the two means. */
function Run2Many({ s, width }: { s: SoundsStore; width: number }) {
  const many = s.run2Many
  if (many.state === 'idle') return null
  const twoColumns = width >= 760
  const col = twoColumns ? Math.floor((width - 16) / 2) : width
  const doneLine = `Training is done: ${MANY_NETWORKS} networks, ${PASSES} passes each.`
  const training = (nets: RunState[], k: number) => `Network ${k} of ${MANY_NETWORKS}, pass ${nets[nets.length - 1]?.pass ?? 0} of ${PASSES}.`
  const pitchProgress = many.state === 'done' || many.k > MANY_NETWORKS ? doneLine : training(many.pitch, many.k)
  const voiceProgress = many.state === 'done' ? doneLine : many.k <= MANY_NETWORKS ? 'The one-voice networks are trained after the one-pitch networks.' : training(many.voice, many.k - MANY_NETWORKS)
  const colStyle = { flex: twoColumns ? '1 1 0' : undefined, minWidth: 0, width: twoColumns ? undefined : '100%' } as const
  return (
    <>
      <div style={{ display: 'flex', flexDirection: twoColumns ? 'row' : 'column', gap: twoColumns ? 16 : 8, alignItems: 'flex-start' }} data-run2-many>
        <div style={colStyle}>
          <ManyPanel title={`Run 2, ${MANY_NETWORKS} networks: one pitch`} nets={many.pitch} finished={many.pitch.length === MANY_NETWORKS && many.pitch.every((n) => n.state === 'done')} progress={pitchProgress} note={`${MANY_NETWORKS} networks, each from its own starting weights, trained one after another as the one-pitch network was: every voice at its own pitch only (150 syllables), tested on every shifted syllable and the two held-out voices (390 syllables) after every pass.`} testSize={390} width={col} testId="run2-pitch" />
        </div>
        <div style={colStyle}>
          <ManyPanel title={`Run 2, ${MANY_NETWORKS} networks: one voice`} nets={many.voice} finished={many.state === 'done'} progress={voiceProgress} note={`${MANY_NETWORKS} networks, each from its own starting weights, trained one after another as the one-voice network was: voice 1 at its three pitches (45 syllables), tested on the other eleven voices (495 syllables) after every pass.`} testSize={495} width={col} testId="run2-voice" />
        </div>
      </div>
      {many.state === 'done' && (
        <Note data-run2-many-summary style={{ color: 'var(--text)' }}>
          {`Over ${MANY_NETWORKS} networks of each kind: trained on one pitch, ${finalLine(many.pitch.map((n) => n.accuracy!))}; trained on one voice, ${finalLine(many.voice.map((n) => n.accuracy!))}.`}
        </Note>
      )}
    </>
  )
}

const PITCH_TITLE = 'Run 2: one pitch'
const VOICE_TITLE = 'Run 2: one voice'
const PITCH_NOTE = 'Trained on every voice at its own pitch only (150 syllables); tested on every shifted syllable and the two held-out voices (390 syllables).'
const VOICE_NOTE = 'Trained on voice 1 at its three pitches (45 syllables); tested on the other eleven voices (495 syllables).'

/** Run 2's two results side by side when there is room, else one under the other, and a line under them with the two final percentages and the three predictions. */
function Run2Results({ s, width }: { s: SoundsStore; width: number }) {
  if (s.run2pitch.state === 'idle' && s.run2voice.state === 'idle') return null
  const twoColumns = width >= 760
  const col = twoColumns ? Math.floor((width - 16) / 2) : width
  const bothDone = s.run2pitch.state === 'done' && s.run2voice.state === 'done'
  return (
    <>
      <div style={{ display: 'flex', flexDirection: twoColumns ? 'row' : 'column', gap: twoColumns ? 16 : 8, alignItems: 'flex-start' }} data-run2-results>
        <div style={{ flex: twoColumns ? '1 1 0' : undefined, minWidth: 0, width: twoColumns ? undefined : '100%' }}>
          <RunPanel title={PITCH_TITLE} run={s.run2pitch} note={PITCH_NOTE} width={col} />
        </div>
        <div style={{ flex: twoColumns ? '1 1 0' : undefined, minWidth: 0, width: twoColumns ? undefined : '100%' }}>
          {s.run2voice.state === 'idle' ? <Note>The one-voice network is trained after the one-pitch network.</Note> : <RunPanel title={VOICE_TITLE} run={s.run2voice} note={VOICE_NOTE} width={col} />}
        </div>
      </div>
      {bothDone && (
        <Note data-run2-summary style={{ color: 'var(--text)' }}>
          {`Trained on one pitch: ${pct(s.run2pitch.accuracy!)} of its test syllables labeled correctly. Trained on one voice: ${pct(s.run2voice.accuracy!)}. Your predictions: one pitch against run 1, ${s.predicted('run2pitch')}; one voice against run 1, ${s.predicted('run2voice')}; which labels more correctly, ${s.predicted('run2which')}.`}
        </Note>
      )}
    </>
  )
}

export function Step4Stage({ s }: { s: SoundsStore }) {
  const ref = useRef<HTMLDivElement>(null)
  const room = useWidth(ref, 720)
  const t = s.tts?.tokens.tokens
  const sampleIndex = t ? t.findIndex((x) => x.voice === 1 && x.consonant === 'd' && x.vowel === 'ah' && x.shift === 0) : -1
  const tokClip = s.clip('tokens')
  const read = useCallback(() => s.cursorIn(`token:${sampleIndex}`), [s, sampleIndex])
  const cursor = useAudioCursor(read, s.playing?.key === `token:${sampleIndex}`)
  const sample = tokClip && t && sampleIndex >= 0 ? tokenSamples(tokClip, t[sampleIndex]) : null
  const sampleW = Math.min(640, room)
  return (
    <StagePanel wide testId="sounds-4">
      <div ref={ref} style={{ width: '100%', height: 0 }} />
      <div style={{ fontSize: 14, fontWeight: 600 }}>A classifier learns the labels</div>
      {STEP4_PANEL.map((p) => (
        <Note key={p.slice(0, 16)} style={{ color: 'var(--text)' }}>
          {p}
        </Note>
      ))}
      <GroupLabel>The network, as a drawing</GroupLabel>
      <Schematic />
      <Note>Only some of the connections from the inputs are drawn, from five of the 400 cells; every one of the 36 connections from the hidden units to the outputs is drawn. The picture shows the network’s shape, not its weights.</Note>
      {sample && (
        <>
          <GroupLabel>One training syllable</GroupLabel>
          <Note>One training syllable, ‹dah› in voice 1 at its own pitch. The box marks the patch the network receives: from 20 milliseconds before the release to 80 milliseconds after it, 0 to 5,000 Hz.</Note>
          <div>
            <Btn small onClick={() => s.playToken(sampleIndex)}>
              Play
            </Btn>
          </div>
          <Spectrogram samples={sample} sampleRate={16000} view="wide" width={sampleW} height={Math.round(sampleW * 0.42)} cursorS={cursor} highlights={[{ fromS: Math.max(0, t![sampleIndex].burstS - 0.02), toS: t![sampleIndex].burstS + 0.08, color: '#f0a94b', label: 'the patch' }]} testId="token-sample" />
        </>
      )}
      <Loading s={s} />
      <Run k="run1">
        <Run1Controls s={s} />
        <RunPanel title="Run 1: ten voices in, two held out" run={s.run1} note="Trained on voices 1 to 10 at all three pitches (450 syllables); tested on voices 11 and 12 (90 syllables) after every pass." width={room} />
        <Run1Many s={s} width={room} />
      </Run>
      <Run k="run2">
        <Run2Controls s={s} />
        <Run2Results s={s} width={room} />
        <Run2Many s={s} width={room} />
      </Run>
      <Run k="run3">
        <Run3Controls s={s} />
        {s.run3.state === 'done' && s.run3.shares && <Run3 s={s} width={room} />}
      </Run>
      <Content>{MADE_OFFLINE_LINE}</Content>
    </StagePanel>
  )
}

function Run3({ s, width }: { s: SoundsStore; width: number }) {
  const shares = s.run3.shares!
  const series = LABELS.map((l, k) => ({ label: `share of output for ${l}`, color: COLORS[l], points: shares.map((sh, i) => [i + 1, 100 * sh[k]] as [number, number]) }))
  const top = shares.map((sh) => LABELS[sh.indexOf(Math.max(...sh))])
  // Once Step 3 is done, the student's own label of each sound: the one given most often on its 6 trials of block 1, or b/d on a 3–3 tie (Jon, 2026-11-23).
  const labeling = s.isDone(3) ? s.labelingResult() : null
  const yours = labeling ? (() => { const c = labelingCurves(labeling.trials, labeling.answers); return Array.from({ length: STEPS }, (_, i) => (c.b[i] > 0.5 ? 'b' : c.b[i] < 0.5 ? 'd' : 'b/d')) })() : null
  const cells = (xs: string[]) => xs.map((l) => l.padStart(3)).join('')
  const lines = ['sound:  ' + cells(Array.from({ length: STEPS }, (_, i) => String(i + 1))), (yours ? 'network:' : 'label:  ') + cells(top), ...(yours ? ['yours:  ' + cells(yours)] : [])]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }} data-run="run3">
      <GroupLabel>{`The network from run 1 on the ${STEPS} sounds of Step 3`}</GroupLabel>
      <Note>{`For each of the ${STEPS} sounds, the three outputs are scaled to shares that sum to 100%. Each line is one label’s share, sound by sound. The most likely label at each sound is printed under the plot.`}</Note>
      <LinePlot series={series} width={Math.min(460, width)} height={200} xLabel={`sound, 1 to ${STEPS}`} yLabel="share of the outputs (%)" xMin={1} xMax={STEPS} xTicks={[1, 3, 5, 7, 9].map((x) => ({ x, label: String(x) }))} testId="run3-curve" />
      <FixedLines lines={lines} testId="run3-labels" />
      {yours && <Note data-yours="step3">{`The line “yours” is your own label of each sound from block 1 of Step 3: the label you gave most often on its 6 trials, or “b/d” where you gave each 3 times.`}</Note>}
      <Para>
        {`Before the lab was posted, ${MANY_NETWORKS} networks trained as in run 1 were run on these ${STEPS} sounds. Their most likely label was most often ‹g›, with ‹b› at sounds 1, 3, and 9, and the order differed from one network to the next: one network gave ‹b› to all ${STEPS}, another ‹g› to all ${STEPS}. Each of these sounds begins with a 10 millisecond burst of noise at the release. With that burst removed, most of the networks labeled sounds 1 to 4 ‹b› and sounds 5 to 8 ‹d›. The burst in these synthetic sounds is noise shaped by two formants only, so the patch the network receives from a synthetic sound has almost no energy above 2,500 Hz. The natural syllables’ bursts carry energy up to 5,000 Hz, and above 2,500 Hz is where the natural ‹b› and ‹d› bursts differ most.`}
      </Para>
      <Content>{SYNTHETIC_TEST_LINE}</Content>
      {!yours && <Note data-missing="step3">{`Once Step 3 is done, you will see your own labels of these ${STEPS} sounds beside the network’s.`}</Note>}
    </div>
  )
}
