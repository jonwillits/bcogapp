import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Panel } from '../../components/Panel'
import { fmtSigned } from '../../components/format'
import { Toggle } from '../../components/controls'
import { makeRng, type Rng } from '../../sim/random'
import { emptyCounts, tally, type Counts } from '../../sim/fish/sdt'
import { READOUT_SKIP, READOUT_TARGET, STUDY_SECONDS, VIEWS_PER_CONDITION, type TestMode } from '../../sim/objects/config'
import { featuresWith, warmUp } from '../../sim/objects/inferClient'
import { scrambledMask } from '../../sim/objects/mask'
import { DEFAULT_READOUT_RATE, makeReadout, readoutEvidence, readoutLearn, readoutSays, type Readout } from '../../sim/objects/readout'
import { allAnswered, newTest, type TestState } from '../../sim/objects/trials'
import { allViews, CONDITIONS, CONDITION_LABEL, LEARNED_VIEWS, SET_LABEL, TEST_VIEWS, viewTrials, WOBBLE_FRAMES, type Condition, type ViewSet, type ViewTrial } from '../../sim/objects/views'
import { Glimpse } from './Glimpse'
import { Scorecard } from './Scorecard'
import { ByHandBox } from '../m07_fish/DecisionTab'
import { Section } from '../../components/Section'
import { GLIMPSE_LINE, OUR_NETWORKS_LINE, READOUT_LINE } from './lines'
import { loadGray, scannedPath, useJson, type ScannedManifest } from './data'
import { Btn, Choice, Content, FixedLines, GrayImage, GroupLabel, Note, ObjectsLayout, PANEL_STYLE, RIGHT_STYLE, StageTitle, GlimpseSummary, TrialNav } from './ui'

/**
 * Part 3, Views (spec §6.3): a study phase, the student's test on 24
 * views in three matched conditions, the scorecards, then one readout
 * unit on the frozen Standard network taking the same test, and the
 * view-generalization curve.
 */
const SIZE = 160
type Answer = 'same' | 'not'
const ANSWERS: { id: Answer; label: string }[] = [{ id: 'same', label: 'same shoe' }, { id: 'not', label: 'not the same shoe' }]
const FRAME_MS = 140
type Phase = 'intro' | 'study' | 'test' | 'done'
const N = 6 * VIEWS_PER_CONDITION
export const CONVERGED_LINE = 'Every training image is right now, so the prediction error is near zero and further steps change the weights very little.'
export const INTRO_LINES = [
  'You will learn one shoe from two views, each shown wobbling for ten seconds.',
  `Then ${N} pictures, one at a time: is it the same shoe, or not? Answer each; you can go back. Then commit.`,
  'Then a readout unit on a frozen photo network learns the same shoe from the same two views and takes the same test, and its scorecards sit beside yours.',
  'Do Set 1, one shoe among shoes, first. Copy its lines into your report, then go on to Set 2, one shoe among other things.',
]
export const SKIP_LABEL = `Skip ahead ${READOUT_SKIP} steps`

export interface ViewsProps {
  seed: number
  mode: TestMode
  header?: ReactNode
  manifest?: ScannedManifest
  initial?: { phase?: Phase; answers?: (Answer | null)[]; committed?: boolean; set?: ViewSet }
}

export function ViewsTab({ seed, mode, header, manifest: given, initial }: ViewsProps) {
  const manifest = useJson<ScannedManifest>('scanned/manifest.json', given)
  const shoes = useMemo(() => manifest?.objects.filter((o) => o.set === 'shoe').map((o) => o.id) ?? [], [manifest])
  const things = useMemo(() => manifest?.objects.filter((o) => o.set === 'other').map((o) => o.id) ?? [], [manifest])
  const target = shoes.length ? shoes[makeRng(seed ^ 0x7e3).int(shoes.length)] : null
  const [set, setSet] = useState<ViewSet>(initial?.set ?? 'shoes')
  const others = useMemo(() => (set === 'shoes' ? shoes.filter((s) => s !== target) : things), [set, shoes, things, target])
  const trials = useMemo<ViewTrial[]>(() => (target && others.length ? viewTrials(target, others, makeRng(seed ^ (set === 'shoes' ? 0x11 : 0x22))) : []), [target, others, seed, set])
  const [phase, setPhase] = useState<Phase>(initial?.phase ?? 'intro')
  const [test, setTest] = useState<TestState<Answer>>(() => { const t = newTest<Answer>(N); if (initial?.answers) t.answers = initial.answers; t.committed = initial?.committed ?? false; return t })
  const [at, setAt] = useState(0)
  useEffect(() => { warmUp('photo_standard') }, [])

  // Images, loaded as pixels when needed.
  const [pixels, setPixels] = useState<Map<string, Float32Array>>(new Map())
  const want = useMemo(() => {
    const keys = new Set<string>()
    if (target) for (const lv of LEARNED_VIEWS) for (const f of WOBBLE_FRAMES[lv]) keys.add(`${target}/${f}`)
    for (const t of trials) keys.add(`${t.object}/${t.view.id}`)
    return [...keys]
  }, [target, trials])
  useEffect(() => {
    let live = true
    for (const k of want) {
      if (pixels.has(k)) continue
      const [o, v] = k.split('/')
      loadGray(scannedPath(o, v), SIZE).then((px) => { if (live) setPixels((m) => (m.has(k) ? m : new Map(m).set(k, px))) }).catch(() => {})
    }
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [want])

  // Study phase: a wobble of ±10° around each learned view, STUDY_SECONDS each.
  const [studyAt, setStudyAt] = useState({ view: 0, frame: 2, left: STUDY_SECONDS })
  useEffect(() => {
    if (phase !== 'study' || !target) return
    let frame = 2, dir = 1, view = 0, started = performance.now()
    const id = setInterval(() => {
      frame += dir
      if (frame >= 4 || frame <= 0) dir = -dir
      const elapsed = (performance.now() - started) / 1000
      if (elapsed >= STUDY_SECONDS && view === 0) { view = 1; started = performance.now() }
      const left = Math.max(0, STUDY_SECONDS - (performance.now() - started) / 1000)
      setStudyAt({ view, frame, left })
    }, FRAME_MS)
    return () => clearInterval(id)
  }, [phase, target])
  const studyKey = target ? `${target}/${WOBBLE_FRAMES[LEARNED_VIEWS[studyAt.view]][studyAt.frame]}` : ''
  const studyDone = studyAt.view === 1 && studyAt.left <= 0

  // The readout. Features come from the worker, computed once the tab opens.
  const trainKeys = useMemo(() => {
    if (!target) return []
    const keys: { key: string; a: 0 | 1 }[] = []
    for (const lv of LEARNED_VIEWS) for (const f of WOBBLE_FRAMES[lv]) { keys.push({ key: `${target}/${f}`, a: 1 }); for (const o of others) keys.push({ key: `${o}/${f}`, a: 0 }) }
    return keys
  }, [target, others])
  const curveKeys = useMemo(() => { const av = allViews(); return target ? [...av.vertical, ...av.horizontal].map((v) => `${target}/${v.id}`) : [] }, [target])
  const [features, setFeatures] = useState<Map<string, Float32Array>>(new Map())
  const featureKeys = useMemo(() => [...new Set([...trainKeys.map((k) => k.key), ...trials.map((t) => `${t.object}/${t.view.id}`), ...curveKeys])], [trainKeys, trials, curveKeys])
  const inFlight = useRef(new Set<string>())
  useEffect(() => {
    let live = true
    const run = async () => {
      for (const k of featureKeys) {
        if (!live) return
        if (features.has(k) || inFlight.current.has(k)) continue
        inFlight.current.add(k)
        try {
          const [o, v] = k.split('/')
          const px = await loadGray(scannedPath(o, v), SIZE)
          const f = await featuresWith('photo_standard', px)
          if (live) setFeatures((m) => new Map(m).set(k, f))
        } catch { /* a failed load is retried on the next change */ } finally { inFlight.current.delete(k) }
      }
    }
    void run()
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [featureKeys])
  const featuresReady = featureKeys.filter((k) => features.has(k)).length
  const trainReady = trainKeys.every((k) => features.has(k.key))
  const testReady = trials.every((t) => features.has(`${t.object}/${t.view.id}`))

  const unitRef = useRef<{ unit: Readout; rng: Rng; steps: number } | null>(null)
  const [, bump] = useState(0)
  const [learning, setLearning] = useState(false)
  const [lastPhi, setLastPhi] = useState<number | null>(null)
  const [rate, setRate] = useState(DEFAULT_READOUT_RATE)
  if (!unitRef.current || unitRef.current.rng === null) { const rng = makeRng(seed ^ 0x9e); unitRef.current = { unit: makeReadout(rng), rng, steps: 0 } }
  const startSet = (v: ViewSet) => { setSet(v); setPhase('intro'); setTest(newTest<Answer>(N)); setAt(0); resetReadout(); setLearning(false) }
  const resetReadout = () => { const rng = makeRng(seed ^ 0x9e); unitRef.current = { unit: makeReadout(rng), rng, steps: 0 }; setLastPhi(null); bump((x) => x + 1) }
  const skip = (n: number) => {
    const r = unitRef.current!
    if (!learning || !trainReady) return
    let phi = 0
    for (let i = 0; i < n; i++) { const ex = trainKeys[r.rng.int(trainKeys.length)]; phi = readoutLearn(r.unit, features.get(ex.key)!, ex.a, rate).phi; r.steps++ }
    setLastPhi(phi)
    bump((x) => x + 1)
  }
  const trainAcc = trainReady ? trainKeys.filter((k) => readoutSays(unitRef.current!.unit, features.get(k.key)!) === (k.a === 1)).length / trainKeys.length : null

  const studentCounts = (c: Condition): Counts => { const k = emptyCounts(); trials.forEach((t, i) => { if (t.condition === c && test.answers[i]) tally(k, t.target, test.answers[i] === 'same') }); return k }
  const readoutCounts = (c: Condition): Counts | null => {
    if (!test.committed || !testReady) return null
    const k = emptyCounts()
    for (const t of trials) if (t.condition === c) tally(k, t.target, readoutSays(unitRef.current!.unit, features.get(`${t.object}/${t.view.id}`)!))
    return k
  }
  const curve = useMemo(() => {
    if (!test.committed || !target) return null
    const av = allViews()
    const ev = (ids: { id: string }[]) => ids.map((v) => { const f = features.get(`${target}/${v.id}`); return f ? readoutEvidence(unitRef.current!.unit, f) : null })
    return { vertical: ev(av.vertical), horizontal: ev(av.horizontal), threshold: unitRef.current!.unit.threshold }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [test.committed, target, features, unitRef.current?.steps])

  const trial = trials[at]
  const trialKey = trial ? `${trial.object}/${trial.view.id}` : ''
  const mask = useMemo(() => { const px = pixels.get(trialKey); return px ? scrambledMask(px, SIZE, 16, makeRng(seed ^ (0x61 + at))) : null }, [pixels, trialKey, seed, at])

  const left = (
    <Panel title="Views" style={PANEL_STYLE}>
      <Note>Learn one shoe from two views, then say for each picture whether it is the same shoe. The views you are tested on lie between the learned views, beyond them, or at right angles to them, at matched distances.</Note>
      <GroupLabel>The set</GroupLabel>
      <Choice value={set} options={[{ id: 'shoes', label: `Set 1 · ${SET_LABEL.shoes}` }, { id: 'things', label: `Set 2 · ${SET_LABEL.things}` }]} onChange={(v) => startSet(v)} />
      <Note>Target: <span style={{ fontFamily: 'var(--font-mono)' }}>{target ?? '…'}</span>, chosen by the seed. The other objects are the seven other shoes, or the eight other things.</Note>
      <Note>Viewing: {mode}. The study, the test and the commit are on the stage.</Note>
      {mode === 'glimpse' && <Content>{GLIMPSE_LINE}</Content>}
      <GroupLabel>The readout</GroupLabel>
      <Content>{READOUT_LINE}</Content>
      <Note>One unit reads the Standard network’s penultimate layer (1,024 numbers) and learns by Lab 5’s Prediction rule, Δbᵢ = η · xᵢ · Φ with Φ = a − p: the target shoe’s learned views (a = 1) against the same views of the other objects (a = 0).</Note>
      <Note>Features ready: {featuresReady} of {featureKeys.length}.</Note>
      <Toggle label="Learning on" checked={learning} onChange={setLearning} />
      <label style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>learning rate η</span><span style={{ fontFamily: 'var(--font-mono)' }}>{rate.toFixed(3)}</span></span>
        <input type="range" min={0.005} max={0.2} step={0.005} value={rate} onChange={(e) => setRate(parseFloat(e.target.value))} />
      </label>
      <Btn onClick={() => skip(READOUT_SKIP)} disabled={!learning || !trainReady || !test.committed}>{SKIP_LABEL}</Btn>
      <Btn small onClick={resetReadout}>Start from new random weights</Btn>
      <FixedLines lines={[`steps so far:        ${String(unitRef.current.steps).padStart(5)}`, `training images:     ${String(trainKeys.length).padStart(5)}`, trainAcc === null ? null : `right on them:        ${Math.round(trainAcc * 100)}%${trainAcc >= READOUT_TARGET ? '  (at the target)' : ''}`]} />
      {trainAcc !== null && trainAcc >= 1 && unitRef.current.steps > 0 && <Note>{CONVERGED_LINE}</Note>}
      <GroupLabel>The unit’s numbers</GroupLabel>
      <FixedLines lines={[`baseline b₀:          ${fmtSigned(unitRef.current.unit.baseline)}`, `weight b₁ (unit 1):   ${fmtSigned(unitRef.current.unit.weights[0])}`, `weight b₂ (unit 2):   ${fmtSigned(unitRef.current.unit.weights[1])}`, `criterion θ:          ${fmtSigned(unitRef.current.unit.threshold)}`, `last prediction error Φ: ${lastPhi === null ? '' : fmtSigned(lastPhi)}`]} />
      <Note>1,024 weights in all; two are printed. The criterion is the unit’s threshold: evidence at or above it is <i>same shoe</i>. Learning never writes it.</Note>
      {!test.committed && <Note>The readout takes the test after you commit yours.</Note>}
      <Content>{OUR_NETWORKS_LINE}</Content>
    </Panel>
  )

  const stage = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <StageTitle sub={manifest ? `${SET_LABEL[set]} · 8 shoes and 8 other things, rendered every 15°` : 'Loading the scanned objects…'}>Part 3 — Views</StageTitle>
      {phase === 'intro' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 560 }} data-intro>
          <GroupLabel>{set === 'shoes' ? 'Set 1 · one shoe among shoes' : 'Set 2 · one shoe among other things'}</GroupLabel>
          {INTRO_LINES.map((l) => <Note key={l}>{l}</Note>)}
          <div><Btn primary onClick={() => setPhase('study')} disabled={!target}>Begin</Btn></div>
        </div>
      )}
      {phase === 'study' && target && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <GroupLabel>Study the shoe</GroupLabel>
          {studyDone ? (
            <div style={{ width: 320, height: 320, borderRadius: 6, border: '1px dashed var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 12 }}>study done</div>
          ) : (
            <GrayImage image={pixels.get(studyKey) ?? null} size={SIZE} display={320} alt="the target shoe, wobbling around a learned view" testId="study" />
          )}
          <FixedLines lines={[`learned view ${studyAt.view + 1} of 2: ${LEARNED_VIEWS[studyAt.view].replace('h', '')}°`, `seconds left: ${String(Math.ceil(studyAt.left)).padStart(2)}`]} />
          <div><Btn primary disabled={!studyDone} onClick={() => setPhase('test')}>Start the test</Btn></div>
        </div>
      )}
      {phase === 'test' && trial && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <GroupLabel>Your test</GroupLabel>
          <Glimpse mode={mode} trial={at} image={pixels.get(trialKey) ?? null} mask={mask} size={SIZE} display={320} onShown={(ms) => setTest((t) => ({ ...t, glimpses: [...t.glimpses, { trial: at, shownMs: ms }] }))}>
            <Choice value={test.answers[at]} options={ANSWERS} onChange={(v) => setTest((t) => ({ ...t, answers: t.answers.map((a, k) => (k === at ? v : a)) }))} />
          </Glimpse>
          <TrialNav at={at} n={N} answered={test.answers.filter((a) => a).length} onPrev={() => setAt((i) => Math.max(0, i - 1))} onNext={() => setAt((i) => Math.min(N - 1, i + 1))} onCommit={() => { setTest((t) => ({ ...t, committed: true })); setPhase('done') }} canCommit={allAnswered(test)} committed={test.committed} />
        </div>
      )}
      {test.committed && (
        <>
          <GroupLabel>Your scorecards, by condition</GroupLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 10 }}>
            {CONDITIONS.map((c) => <Scorecard key={c} counts={studentCounts(c)} title={CONDITION_LABEL[c]} who="you" />)}
          </div>
          <GroupLabel>The readout’s scorecards, on the same 24 trials</GroupLabel>
          {testReady ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 10 }} data-readout-scorecards>
              {CONDITIONS.map((c) => <Scorecard key={c} counts={readoutCounts(c)!} title={CONDITION_LABEL[c]} who="the readout" steps={unitRef.current!.steps} />)}
            </div>
          ) : (
            <Note>Computing the test images’ features…</Note>
          )}
          <GroupLabel>The view-generalization curve</GroupLabel>
          <Note>The readout’s evidence for the target at every rendered view: around the vertical axis (left) and the horizontal axis (right). The learned views are marked; the criterion is the dashed line. Above it the readout says <i>same shoe</i>.</Note>
          {curve && <CurvePlot curve={curve} />}
          {set === 'shoes' && <div><Btn primary onClick={() => startSet('things')}>Go on to Set 2: one shoe among other things</Btn></div>}
          <GroupLabel>The trials, revealed</GroupLabel>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, whiteSpace: 'pre', lineHeight: 1.5 }}>
            {trials.map((t, i) => `#${String(i + 1).padStart(2)}  ${CONDITION_LABEL[t.condition].padEnd(15)} ${t.view.id}  ${(t.target ? 'the target' : t.object).padEnd(12)}  you: ${(test.answers[i] ?? '').padEnd(4)}  readout: ${testReady ? (readoutSays(unitRef.current!.unit, features.get(`${t.object}/${t.view.id}`)!) ? 'same' : 'not') : '…'}`).join('\n')}
          </div>
        </>
      )}
    </div>
  )

  const right = (
    <Panel title="Signal detection" style={RIGHT_STYLE}>
      <Note>Per condition: four trials with the target and four with another object. <b>Hit</b>, <b>Miss</b>, <b>False alarm</b> and <b>Correct rejection</b> as in Lab 7; <b>d′</b> by hand from the two rates.</Note>
      <Note>Distances from the nearest learned view, every condition: 15°, 15°, 30°, 30°. Between: {TEST_VIEWS.between.map((v) => v.heading + '°').join(', ')}. Beyond: {TEST_VIEWS.beyond.map((v) => v.heading + '°').join(', ')}. At right angles: tipped {TEST_VIEWS['right-angles'].map((v) => (v.pitch > 180 ? v.pitch - 360 : v.pitch) + '°').join(', ')}.</Note>
      <Section title="By hand" defaultOpen={false}><ByHandBox /></Section>
      <GlimpseSummary records={test.glimpses} />
    </Panel>
  )

  return <ObjectsLayout header={header} left={left} stage={stage} right={right} />
}

function CurvePlot({ curve }: { curve: { vertical: (number | null)[]; horizontal: (number | null)[]; threshold: number } }) {
  const W = 300, H = 150, padL = 32, padB = 22, padT = 8
  const all = [...curve.vertical, ...curve.horizontal].filter((v): v is number => v !== null)
  const lo = Math.min(-1, ...all), hi = Math.max(1, ...all)
  const y = (v: number) => padT + (1 - (v - lo) / (hi - lo)) * (H - padT - padB)
  const one = (vals: (number | null)[], title: string, marks: number[]) => (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title} data-curve={title} style={{ background: 'var(--bg)', borderRadius: 8 }}>
      <text x={padL} y={10} fontSize={10} fill="var(--text)">{title}</text>
      <line x1={padL} x2={W - 6} y1={y(curve.threshold)} y2={y(curve.threshold)} stroke="var(--text-muted)" strokeDasharray="3 3" />
      {marks.map((m) => <line key={m} x1={padL + (m / 23) * (W - padL - 6)} x2={padL + (m / 23) * (W - padL - 6)} y1={padT} y2={H - padB} stroke="#ffd166" strokeWidth={1} />)}
      <polyline points={vals.map((v, i) => (v === null ? null : `${padL + (i / 23) * (W - padL - 6)},${y(v)}`)).filter(Boolean).join(' ')} fill="none" stroke="var(--accent)" strokeWidth={1.8} />
      {[0, 90, 180, 270, 345].map((d) => <text key={d} x={padL + (d / 15 / 23) * (W - padL - 6)} y={H - 6} fontSize={9} fill="var(--text-muted)" textAnchor="middle">{d}°</text>)}
      <text x={padL - 4} y={y(0) + 3} fontSize={9} fill="var(--text-muted)" textAnchor="end">0</text>
    </svg>
  )
  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
      {one(curve.vertical, 'around the vertical axis (learned views marked)', [0, 5])}
      {one(curve.horizontal, 'around the horizontal axis (learned view at 0° marked)', [0])}
    </div>
  )
}
