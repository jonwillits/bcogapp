import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Panel } from '../../components/Panel'
import { makeRng } from '../../sim/random'
import { STAIRCASE, type TestMode } from '../../sim/objects/config'
import { classifyWith, warmUp } from '../../sim/objects/inferClient'
import { scrambledMask } from '../../sim/objects/mask'
import { MODEL_TITLE, PHOTO_NETS, type ModelName } from '../../sim/objects/models'
import { addNoise, NOISE_LABEL, type NoiseKind } from '../../sim/objects/noise'
import { allAnswered, newTest, nextLevel, noiseTrials, scoreAtLevel, settledLevel, type NoiseTrial, type TestState } from '../../sim/objects/trials'
import { Glimpse } from './Glimpse'
import { EYE_LINE, GLIMPSE_LINE, LARGER_TEST_LINE, OUR_NETWORKS_LINE } from './lines'
import { loadGray, photoPath, useJson, type Measurements, type PhotosManifest } from './data'
import { Content, FixedLines, GroupLabel, Intro, NameGrid, Note, ObjectsLayout, PANEL_STYLE, ResultTable, RIGHT_STYLE, StageTitle, pct, GlimpseSummary, TrialNav } from './ui'

/**
 * Part 4, Noise (spec §6.4): grayscale photographs clean, with noise A and
 * with noise B, the student first on a grid of the sixteen names; then all
 * three photo networks on the same trials. The noise is made here from the
 * seed, never shipped.
 */
const SIZE = 160
const CONDITIONS: NoiseKind[] = ['clean', 'A', 'B']
export const CHANCE = 1 / 16
export const NOISE_INTRO_LINES = [
  'Thirty-six grayscale photographs, one at a time, from sixteen categories. Name each one from the grid; you can go back. Then commit.',
  'Twelve are clean, twelve have noise A, and twelve have noise B, mixed in one order and not announced, so the pictures will look very different from one to the next. Noise A replaces a share of the pixels with black or white; noise B nudges every pixel by a random amount.',
  'The noise adapts to you: after a right answer the next picture with that noise is a little noisier, after a wrong one a little cleaner, so you end near the strength where you are half right. The networks then take the very same pictures.',
  'Then three networks, trained on three diets, name the same thirty-six, and a table sets their scores beside yours.',
]
export const NOISE_TIME_LINE = 'The thirty-six take about five minutes without a break. Do not press Begin until you are ready to go through to the end.'

export interface NoiseProps {
  seed: number
  mode: TestMode
  header?: ReactNode
  photos?: PhotosManifest
  measurements?: Measurements
  initial?: { answers?: (string | null)[]; committed?: boolean; begun?: boolean }
}

export function NoiseTab({ seed, mode, header, photos: given, measurements: givenM, initial }: NoiseProps) {
  const photos = useJson<PhotosManifest>('photos/manifest.json', given)
  const measurements = useJson<Measurements>('measurements.json', givenM)
  const names = photos?.categories ?? []
  const trials = useMemo<NoiseTrial[]>(() => (photos ? noiseTrials(photos.images, makeRng(seed ^ 0x4d)) : []), [photos, seed])
  const [test, setTest] = useState<TestState<string>>(() => { const t = newTest<string>(36); if (initial?.answers) t.answers = initial.answers; t.committed = initial?.committed ?? false; return t })
  const [at, setAt] = useState(0)
  const [begun, setBegun] = useState(initial?.begun ?? initial?.committed ?? false)
  useEffect(() => { for (const n of PHOTO_NETS) warmUp(n) }, [])

  // The staircase: each trial's strength is fixed the first time it is shown, from the level its kind of noise has reached; a first answer moves that level.
  const [levels, setLevels] = useState<{ A: number; B: number }>({ A: STAIRCASE.A.start, B: STAIRCASE.B.start })
  const [strengths, setStrengths] = useState<(number | null)[]>(() => new Array<number | null>(36).fill(null))
  useEffect(() => {
    if (!begun || !trials.length) return
    const t = trials[at]
    if (!t || strengths[at] !== null) return
    const v = t.condition === 'clean' ? 0 : levels[t.condition]
    setStrengths((st) => st.map((x, i) => (i === at ? v : x)))
  }, [begun, at, trials, strengths, levels])
  const answer = (i: number, v: string) => {
    const first = test.answers[i] === null
    setTest((t) => ({ ...t, answers: t.answers.map((a, k) => (k === i ? v : a)) }))
    const tr = trials[i]
    if (first && tr && tr.condition !== 'clean') { const kind = tr.condition; setLevels((l) => ({ ...l, [kind]: nextLevel(kind, l[kind], v === tr.photo.category) })) }
  }
  const levelsShown = (kind: NoiseKind) => trials.map((t, i) => (t.condition === kind ? strengths[i] : null)).filter((x): x is number => x !== null)

  const [pixels, setPixels] = useState<Map<string, Float32Array>>(new Map())
  useEffect(() => {
    let live = true
    for (const t of trials) {
      if (pixels.has(t.photo.file)) continue
      loadGray(photoPath(t.photo.file), SIZE).then((px) => { if (live) setPixels((m) => (m.has(t.photo.file) ? m : new Map(m).set(t.photo.file, px))) }).catch(() => {})
    }
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trials])
  /** The image as shown: noise made from the seed and the trial index at the strength the staircase gave that trial, so the same seed and answers give the same images. */
  const shown = useMemo(() => {
    const out = new Map<number, Float32Array>()
    trials.forEach((t, i) => { const px = pixels.get(t.photo.file); const st = strengths[i]; if (px && st !== null) out.set(i, addNoise(px, t.condition, st, makeRng(seed ^ (0x700 + i)))) })
    return out
  }, [trials, pixels, strengths, seed])
  const mask = useMemo(() => { const img = shown.get(at); return img ? scrambledMask(img, SIZE, 16, makeRng(seed ^ (0x900 + at))) : null }, [shown, at, seed])

  // After the commit, the three networks answer the same 36 images, in the worker.
  const [netAnswers, setNetAnswers] = useState<Map<ModelName, (number | null)[]>>(new Map())
  useEffect(() => {
    if (!test.committed || shown.size < trials.length || !trials.length) return
    let live = true
    const go = async () => {
      for (const net of PHOTO_NETS) {
        const out: (number | null)[] = new Array(trials.length).fill(null)
        for (let i = 0; i < trials.length; i++) {
          if (!live) return
          const r = await classifyWith(net, shown.get(i)!)
          out[i] = r.top
          if (i % 6 === 5 || i === trials.length - 1) setNetAnswers((m) => new Map(m).set(net, [...out]))
        }
      }
    }
    void go()
    return () => { live = false }
  }, [test.committed, shown, trials])

  const score = (answers: (string | number | null)[], c: NoiseKind, asIndex: boolean) => {
    const idx = trials.map((t, i) => (t.condition === c ? i : -1)).filter((i) => i >= 0)
    const right = idx.filter((i) => (asIndex ? answers[i] === trials[i].photo.label : answers[i] === trials[i].photo.category)).length
    return idx.length ? right / idx.length : 0
  }
  const done = (net: ModelName) => (netAnswers.get(net) ?? []).filter((a) => a !== null).length
  const trial = trials[at]

  const left = (
    <Panel title="Noise" style={PANEL_STYLE}>
      <Note>Thirty-six grayscale photographs: twelve clean, twelve with noise A, twelve with noise B, in an order set by the seed. Name each from the sixteen categories. Then three networks, trained on three diets, take the same thirty-six.</Note>
      <GroupLabel>Your test</GroupLabel>
      <Note>Viewing: {mode}. The trials and the commit are on the stage.</Note>
      {mode === 'glimpse' && <Content>{GLIMPSE_LINE}</Content>}
      <FixedLines lines={[`noise A level now: ${levels.A.toFixed(2)} of pixels`, `noise B level now: ±${levels.B.toFixed(2)}`]} />
      <Note>Noise A replaces a share of the pixels with black or white. Noise B adds a random amount, up to its width, to every pixel. Both are made in this browser from the seed. The level of each adapts: one step harder after a right answer, one step easier after a wrong one (A starts at {STAIRCASE.A.start} and moves by {STAIRCASE.A.step}; B starts at {STAIRCASE.B.start} and moves by {STAIRCASE.B.step}).</Note>
      <GroupLabel>The three networks</GroupLabel>
      <Note><b>Standard</b> was trained on clean photographs; <b>Trained on noise A</b> on photographs with noise A at many strengths; <b>Trained on blurred and sharp</b> on each photograph sharp or blurred at random. All three in grayscale, on the same crops.</Note>
      <Content>{EYE_LINE}</Content>
      <Content>{OUR_NETWORKS_LINE}</Content>
    </Panel>
  )

  const stage = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <StageTitle sub={photos ? `${photos.images.length} photographs from Open Images, ${SIZE} × ${SIZE}, grayscale` : 'Loading the photographs…'}>Part 4 — Noise</StageTitle>
      {!begun && !test.committed && <Intro title="What will happen" lines={NOISE_INTRO_LINES} time={NOISE_TIME_LINE} onBegin={() => setBegun(true)} disabled={!trials.length} />}
      {begun && trial && !test.committed && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Glimpse mode={mode} trial={at} image={shown.get(at) ?? null} mask={mask} size={SIZE} display={320} onShown={(ms) => setTest((t) => ({ ...t, glimpses: [...t.glimpses, { trial: at, shownMs: ms }] }))}>
            <NameGrid names={names} value={test.answers[at]} onChange={(v) => answer(at, v)} columns={4} />
          </Glimpse>
          <TrialNav at={at} n={36} answered={test.answers.filter((a) => a !== null).length} onPrev={() => setAt((i) => Math.max(0, i - 1))} onNext={() => setAt((i) => Math.min(35, i + 1))} onCommit={() => setTest((t) => ({ ...t, committed: true }))} canCommit={trials.length > 0 && allAnswered(test)} committed={test.committed} />
        </div>
      )}
      {test.committed && (
        <>
          <GroupLabel>Percent correct on the thirty-six</GroupLabel>
          <ResultTable
            head={['', ...CONDITIONS.map((c) => NOISE_LABEL[c])]}
            rows={[
              ...PHOTO_NETS.map((n) => [MODEL_TITLE[n] + (done(n) < trials.length ? ` (${done(n)} of ${trials.length})` : ''), ...CONDITIONS.map((c) => (done(n) === trials.length ? pct(score(netAnswers.get(n)!, c, true)) : '…'))]),
              ['you', ...CONDITIONS.map((c) => pct(score(test.answers, c, false)))],
              ['chance (1 in 16)', ...CONDITIONS.map(() => pct(CHANCE))],
            ]}
          />
          <GroupLabel>Where your noise settled</GroupLabel>
          <FixedLines lines={(['A', 'B'] as const).map((k) => { const lv = settledLevel(levelsShown(k)); return `noise ${k}: your level over the last six trials ${lv === null ? '' : (k === 'A' ? '' : '±') + lv.toFixed(2)}   (from ${levelsShown(k).map((x) => x.toFixed(2)).join(' ')})` })} />
          {measurements && (
            <>
              <Note>On the larger test (800 held-out photographs), read off at your settled level:</Note>
              <ResultTable head={['', 'at your noise A level', 'at your noise B level']} rows={PHOTO_NETS.map((n) => { const net = measurements.part4.nets[n.replace('photo_', '')]; const a = settledLevel(levelsShown('A')); const b = settledLevel(levelsShown('B')); return [MODEL_TITLE[n], a === null ? '' : pct(scoreAtLevel(net.noiseA, a)), b === null ? '' : pct(scoreAtLevel(net.noiseB, b))] })} />
            </>
          )}
          <GroupLabel>The trials, revealed</GroupLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 8 }}>
            {trials.map((t, i) => (
              <div key={i} data-revealed-trial={i} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 6, fontSize: 10.5, fontFamily: 'var(--font-mono)', whiteSpace: 'pre' }}>
                {`#${String(i + 1).padStart(2)} ${NOISE_LABEL[t.condition].padEnd(7)} ${t.condition === 'clean' ? '      ' : 'at ' + (strengths[i] ?? 0).toFixed(2)} it is: ${t.photo.category}\nyou:      ${test.answers[i]}\n${PHOTO_NETS.map((n) => `${MODEL_TITLE[n].slice(0, 9).padEnd(9)} ${netAnswers.get(n)?.[i] != null ? names[netAnswers.get(n)![i]!] : '…'}`).join('\n')}`}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )

  const right = (
    <Panel title="The larger test" style={RIGHT_STYLE}>
      {test.committed ? (
        measurements ? (
          <>
            <Note>{LARGER_TEST_LINE} Here, {measurements.part4.testImages} held-out photographs per condition, at the staircases' starting strengths, noise A {measurements.part4.defaults.A} and noise B {measurements.part4.defaults.B}.</Note>
            <ResultTable head={['', 'clean', 'noise A', 'noise B']} rows={PHOTO_NETS.map((n) => [MODEL_TITLE[n], pct(measurements.part4.nets[n.replace('photo_', '')].clean), pct(measurements.part4.nets[n.replace('photo_', '')].atDefaults.A), pct(measurements.part4.nets[n.replace('photo_', '')].atDefaults.B)])} />
            <GroupLabel>Across strengths</GroupLabel>
            <ResultTable head={['noise A at', ...Object.keys(measurements.part4.nets.standard.noiseA)]} rows={PHOTO_NETS.map((n) => [MODEL_TITLE[n], ...Object.values(measurements.part4.nets[n.replace('photo_', '')].noiseA).map(pct)])} />
            <ResultTable head={['noise B at', ...Object.keys(measurements.part4.nets.standard.noiseB)]} rows={PHOTO_NETS.map((n) => [MODEL_TITLE[n], ...Object.values(measurements.part4.nets[n.replace('photo_', '')].noiseB).map(pct)])} />
            <Note>The reading’s networks: 80% against people’s 46% on the trained noise, then about 10% on the other kind (§8.2.4). Ours are above.</Note>
          </>
        ) : (
          <Note>Loading the measurements…</Note>
        )
      ) : (
        <Note>The networks’ results appear here after you commit.</Note>
      )}
      <GlimpseSummary records={test.glimpses} />
    </Panel>
  )

  return <ObjectsLayout header={header} left={left} stage={stage} right={right} />
}
