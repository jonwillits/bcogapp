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
import { allViews, bothSetTrials, CONDITIONS, CONDITION_LABEL, LEARNED_VIEWS, SET_LABEL, TEST_VIEWS, WOBBLE_FRAMES, type Condition, type SetTrial, type ViewSet } from '../../sim/objects/views'
import { Glimpse } from './Glimpse'
import { Scorecard } from './Scorecard'
import { ByHandBox } from '../m07_fish/DecisionTab'
import { Section } from '../../components/Section'
import { GLIMPSE_LINE, OUR_NETWORKS_LINE, READOUT_LINE } from './lines'
import { loadGray, scannedPath, useJson, type ScannedManifest } from './data'
import { Btn, Choice, Content, FixedLines, GlimpseSummary, GrayImage, GroupLabel, Intro, Note, ObjectsLayout, PANEL_STYLE, RIGHT_STYLE, StageTitle, TrialNav } from './ui'

/**
 * Part 3, Views (spec §6.3), as one run (Jon, 2026-10-12): an introduction,
 * one study of the target shoe, 48 trials with both sets mixed in one
 * seeded order, one commit, six scorecards for the student, and two
 * readout units trained at once on the frozen Standard network, one with
 * the other shoes as its negatives and one with the other things, with
 * their six scorecards and two curves beside the student's.
 */
const SIZE = 160
type Answer = 'same' | 'not'
const ANSWERS: { id: Answer; label: string }[] = [{ id: 'same', label: 'same shoe' }, { id: 'not', label: 'not the same shoe' }]
const FRAME_MS = 140
type Phase = 'intro' | 'study' | 'test' | 'done'
const SETS: ViewSet[] = ['shoes', 'things']
export const N = 12 * VIEWS_PER_CONDITION
// A plain literal, so the close-out's control check can find it; `config.test.ts` holds it to READOUT_SKIP.
export const SKIP_LABEL = 'Skip ahead 50 steps'
export const CONVERGED_LINE = 'Every training image is right now, so the prediction error is near zero and further steps change the weights very little.'
export const INTRO_LINES = [
  'You will learn one shoe from two views, each shown wobbling for ten seconds.',
  `Then ${N} pictures, one at a time: is it the same shoe, or not? Half the pictures are of the target; the rest are other shoes or other things. Answer each; you can go back. Then commit.`,
  'Then two readout units on a frozen photo network learn the same shoe from the same two views, one against the other shoes and one against the other things, and take the same test. Their scorecards sit beside yours.',
]
export const FIVE_MINUTES_LINE = `The study and the ${N} pictures take about five minutes without a break. Do not press Begin until you are ready to go through to the end.`

export interface ViewsProps {
  seed: number
  mode: TestMode
  header?: ReactNode
  manifest?: ScannedManifest
  initial?: { phase?: Phase; answers?: (Answer | null)[]; committed?: boolean }
}

interface Readouts {
  units: Record<ViewSet, Readout>
  rng: Rng
  steps: number
}

export function ViewsTab({ seed, mode, header, manifest: given, initial }: ViewsProps) {
  const manifest = useJson<ScannedManifest>('scanned/manifest.json', given)
  const shoes = useMemo(() => manifest?.objects.filter((o) => o.set === 'shoe').map((o) => o.id) ?? [], [manifest])
  const things = useMemo(() => manifest?.objects.filter((o) => o.set === 'other').map((o) => o.id) ?? [], [manifest])
  const target = shoes.length ? shoes[makeRng(seed ^ 0x7e3).int(shoes.length)] : null
  const others = useMemo<Record<ViewSet, string[]>>(() => ({ shoes: shoes.filter((s) => s !== target), things }), [shoes, things, target])
  const trials = useMemo<SetTrial[]>(() => (target && others.shoes.length && others.things.length ? bothSetTrials(target, others.shoes, others.things, makeRng(seed ^ 0x33)) : []), [target, others, seed])
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

  // Study phase: a wobble of ±10° around each learned view, STUDY_SECONDS each; then the image goes.
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

  // The readouts. Features come from the worker, computed once the tab opens.
  const trainKeys = useMemo<Record<ViewSet, { key: string; a: 0 | 1 }[]>>(() => {
    const out: Record<ViewSet, { key: string; a: 0 | 1 }[]> = { shoes: [], things: [] }
    if (!target) return out
    for (const set of SETS) for (const lv of LEARNED_VIEWS) for (const f of WOBBLE_FRAMES[lv]) {
      out[set].push({ key: `${target}/${f}`, a: 1 })
      for (const o of others[set]) out[set].push({ key: `${o}/${f}`, a: 0 })
    }
    return out
  }, [target, others])
  const curveKeys = useMemo(() => { const av = allViews(); return target ? [...av.vertical, ...av.horizontal].map((v) => `${target}/${v.id}`) : [] }, [target])
  const [features, setFeatures] = useState<Map<string, Float32Array>>(new Map())
  const featureKeys = useMemo(() => [...new Set([...trainKeys.shoes.map((k) => k.key), ...trainKeys.things.map((k) => k.key), ...trials.map((t) => `${t.object}/${t.view.id}`), ...curveKeys])], [trainKeys, trials, curveKeys])
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
  const trainReady = SETS.every((set) => trainKeys[set].every((k) => features.has(k.key)))
  const testReady = trials.every((t) => features.has(`${t.object}/${t.view.id}`))

  const unitsRef = useRef<Readouts | null>(null)
  const [, bump] = useState(0)
  const [learning, setLearning] = useState(false)
  const [rate, setRate] = useState(DEFAULT_READOUT_RATE)
  const [lastPhi, setLastPhi] = useState<Record<ViewSet, number> | null>(null)
  const fresh = (): Readouts => { const rng = makeRng(seed ^ 0x9e); return { units: { shoes: makeReadout(rng), things: makeReadout(rng) }, rng, steps: 0 } }
  if (!unitsRef.current) unitsRef.current = fresh()
  const resetReadouts = () => { unitsRef.current = fresh(); setLastPhi(null); bump((x) => x + 1) }
  /** One press: each readout takes `n` steps on its own training set, drawn by the shared seeded stream. */
  const skip = (n: number) => {
    const r = unitsRef.current!
    if (!learning || !trainReady) return
    const phi: Record<ViewSet, number> = { shoes: 0, things: 0 }
    for (let i = 0; i < n; i++) {
      for (const set of SETS) {
        const ex = trainKeys[set][r.rng.int(trainKeys[set].length)]
        phi[set] = readoutLearn(r.units[set], features.get(ex.key)!, ex.a, rate).phi
      }
      r.steps++
    }
    setLastPhi(phi)
    bump((x) => x + 1)
  }
  const trainAcc = (set: ViewSet) => (trainReady ? trainKeys[set].filter((k) => readoutSays(unitsRef.current!.units[set], features.get(k.key)!) === (k.a === 1)).length / trainKeys[set].length : null)
  const converged = trainReady && unitsRef.current.steps > 0 && SETS.every((set) => (trainAcc(set) ?? 0) >= 1)

  const studentCounts = (set: ViewSet, c: Condition): Counts => { const k = emptyCounts(); trials.forEach((t, i) => { if (t.set === set && t.condition === c && test.answers[i]) tally(k, t.target, test.answers[i] === 'same') }); return k }
  const readoutCounts = (set: ViewSet, c: Condition): Counts | null => {
    if (!test.committed || !testReady) return null
    const k = emptyCounts()
    for (const t of trials) if (t.set === set && t.condition === c) tally(k, t.target, readoutSays(unitsRef.current!.units[set], features.get(`${t.object}/${t.view.id}`)!))
    return k
  }
  const curves = useMemo(() => {
    if (!test.committed || !target) return null
    const av = allViews()
    const ev = (set: ViewSet, ids: { id: string }[]) => ids.map((v) => { const f = features.get(`${target}/${v.id}`); return f ? readoutEvidence(unitsRef.current!.units[set], f) : null })
    return SETS.map((set) => ({ set, vertical: ev(set, av.vertical), horizontal: ev(set, av.horizontal), threshold: unitsRef.current!.units[set].threshold }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [test.committed, target, features, unitsRef.current?.steps])

  const trial = trials[at]
  const trialKey = trial ? `${trial.object}/${trial.view.id}` : ''
  const mask = useMemo(() => { const px = pixels.get(trialKey); return px ? scrambledMask(px, SIZE, 16, makeRng(seed ^ (0x61 + at))) : null }, [pixels, trialKey, seed, at])
  const r = unitsRef.current

  const left = (
    <Panel title="Views" style={PANEL_STYLE}>
      <Note>Learn one shoe from two views, then say for each picture whether it is the same shoe. The pictures lie between the learned views, beyond them, or at right angles to them, at matched distances, and the other objects are either the seven other shoes or eight other things.</Note>
      <Note>Target: <span style={{ fontFamily: 'var(--font-mono)' }}>{target ?? '…'}</span>, chosen by the seed. Viewing: {mode}. The study, the test and the commit are on the stage.</Note>
      {mode === 'glimpse' && <Content>{GLIMPSE_LINE}</Content>}
      <GroupLabel>The readouts</GroupLabel>
      <Content>{READOUT_LINE}</Content>
      <Note>Two units, each reading the Standard network’s penultimate layer (1,024 numbers) and learning by Lab 5’s Prediction rule, Δbᵢ = η · xᵢ · Φ with Φ = a − p: the target shoe’s learned views (a = 1) against the same views of the other shoes, or of the other things (a = 0).</Note>
      <Note>Features ready: {featuresReady} of {featureKeys.length}.</Note>
      <Toggle label="Learning on" checked={learning} onChange={setLearning} />
      <label style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>learning rate η</span><span style={{ fontFamily: 'var(--font-mono)' }}>{rate.toFixed(3)}</span></span>
        <input type="range" min={0.005} max={0.2} step={0.005} value={rate} onChange={(e) => setRate(parseFloat(e.target.value))} />
      </label>
      <Btn onClick={() => skip(READOUT_SKIP)} disabled={!learning || !trainReady || !test.committed}>{SKIP_LABEL}</Btn>
      <Btn small onClick={resetReadouts}>Start from new random weights</Btn>
      <FixedLines lines={[`steps so far:            ${String(r.steps).padStart(5)}`, `training images, shoes:  ${String(trainKeys.shoes.length).padStart(5)}`, `training images, things: ${String(trainKeys.things.length).padStart(5)}`, ...SETS.map((set) => { const a = trainAcc(set); return a === null ? null : `right on them, ${set.padEnd(7)} ${String(Math.round(a * 100)).padStart(4)}%${a >= READOUT_TARGET ? '  (at the target)' : ''}` })]} />
      {converged && <Note>{CONVERGED_LINE}</Note>}
      <GroupLabel>The units’ numbers</GroupLabel>
      {SETS.map((set) => (
        <FixedLines key={set} lines={[`${set === 'shoes' ? 'among shoes' : 'among things'}`, `  baseline b₀:        ${fmtSigned(r.units[set].baseline)}`, `  weight b₁ (unit 1): ${fmtSigned(r.units[set].weights[0])}`, `  criterion θ:        ${fmtSigned(r.units[set].threshold)}`, `  last prediction error Φ: ${lastPhi ? fmtSigned(lastPhi[set]) : ''}`]} />
      ))}
      <Note>1,024 weights in each; one is printed. The criterion is the unit’s threshold: evidence at or above it is <i>same shoe</i>. Learning never writes it.</Note>
      {!test.committed && <Note>The readouts take the test after you commit yours.</Note>}
      <Content>{OUR_NETWORKS_LINE}</Content>
    </Panel>
  )

  const grid = (who: 'you' | 'readout') => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }} data-readout-scorecards={who === 'readout' ? '' : undefined}>
      {SETS.map((set) => (
        <div key={set} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{SET_LABEL[set]}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 10 }}>
            {CONDITIONS.map((c) => (who === 'you' ? <Scorecard key={c} counts={studentCounts(set, c)} title={CONDITION_LABEL[c]} who="you" /> : <Scorecard key={c} counts={readoutCounts(set, c)!} title={CONDITION_LABEL[c]} who={`the readout among ${set}`} steps={r.steps} />))}
          </div>
        </div>
      ))}
    </div>
  )

  const stage = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <StageTitle sub={manifest ? `8 shoes and 8 other things, rendered every 15° · ${N} trials, both sets in one run` : 'Loading the scanned objects…'}>Part 3 — Views</StageTitle>
      {phase === 'intro' && <Intro title="What will happen" lines={INTRO_LINES} time={FIVE_MINUTES_LINE} onBegin={() => setPhase('study')} disabled={!target} />}
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
          <GroupLabel>Your scorecards, by set and condition</GroupLabel>
          {grid('you')}
          <GroupLabel>The readouts’ scorecards, on the same trials</GroupLabel>
          {testReady ? grid('readout') : <Note>Computing the test images’ features…</Note>}
          <GroupLabel>The view-generalization curves</GroupLabel>
          <Note>Each readout’s evidence for the target at every rendered view: around the vertical axis (left) and the horizontal axis (right). The learned views are marked; the criterion is the dashed line. Above it the readout says <i>same shoe</i>.</Note>
          {curves && curves.map((c) => <CurvePlot key={c.set} label={SET_LABEL[c.set]} curve={c} />)}
          <GroupLabel>The trials, revealed</GroupLabel>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, whiteSpace: 'pre', lineHeight: 1.5 }}>
            {trials.map((t, i) => `#${String(i + 1).padStart(2)}  ${t.set.padEnd(6)} ${CONDITION_LABEL[t.condition].padEnd(15)} ${t.view.id}  ${(t.target ? 'the target' : t.object).padEnd(12)}  you: ${(test.answers[i] ?? '').padEnd(4)}  readout: ${testReady ? (readoutSays(r.units[t.set], features.get(`${t.object}/${t.view.id}`)!) ? 'same' : 'not') : '…'}`).join('\n')}
          </div>
        </>
      )}
    </div>
  )

  const right = (
    <Panel title="Signal detection" style={RIGHT_STYLE}>
      <Note>Per set and condition: {VIEWS_PER_CONDITION} trials with the target and {VIEWS_PER_CONDITION} with another object. <b>Hit</b>, <b>Miss</b>, <b>False alarm</b> and <b>Correct rejection</b> as in Lab 7; <b>d′</b> by hand from the two rates.</Note>
      <Note>Distances from the nearest learned view, every condition: {TEST_VIEWS.between.map(distanceOf).sort((a, b) => a - b).join('°, ')}°. Between: {TEST_VIEWS.between.map((v) => v.heading + '°').join(', ')}. Beyond: {TEST_VIEWS.beyond.map((v) => v.heading + '°').join(', ')}. At right angles: tipped {TEST_VIEWS['right-angles'].map((v) => (v.pitch > 180 ? v.pitch - 360 : v.pitch) + '°').join(', ')}.</Note>
      <Section title="By hand" defaultOpen={false}><ByHandBox /></Section>
      <GlimpseSummary records={test.glimpses} />
    </Panel>
  )

  return <ObjectsLayout header={header} left={left} stage={stage} right={right} />
}

function distanceOf(v: { heading: number; pitch: number }): number {
  const d = (a: number, b: number) => { const x = Math.abs(((a - b) % 360) + 360) % 360; return Math.min(x, 360 - x) }
  return v.pitch !== 0 ? d(v.pitch, 0) : Math.min(d(v.heading, 0), d(v.heading, 75))
}

function CurvePlot({ curve, label }: { curve: { vertical: (number | null)[]; horizontal: (number | null)[]; threshold: number }; label: string }) {
  const W = 300, H = 150, padL = 32, padB = 22, padT = 8
  const all = [...curve.vertical, ...curve.horizontal].filter((v): v is number => v !== null)
  const lo = Math.min(-1, ...all), hi = Math.max(1, ...all)
  const y = (v: number) => padT + (1 - (v - lo) / (hi - lo)) * (H - padT - padB)
  const one = (vals: (number | null)[], title: string, marks: number[]) => (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${label}: ${title}`} data-curve={`${label}: ${title}`} style={{ background: 'var(--bg)', borderRadius: 8 }}>
      <text x={padL} y={10} fontSize={10} fill="var(--text)">{title}</text>
      <line x1={padL} x2={W - 6} y1={y(curve.threshold)} y2={y(curve.threshold)} stroke="var(--text-muted)" strokeDasharray="3 3" />
      {marks.map((m) => <line key={m} x1={padL + (m / 23) * (W - padL - 6)} x2={padL + (m / 23) * (W - padL - 6)} y1={padT} y2={H - padB} stroke="#ffd166" strokeWidth={1} />)}
      <polyline points={vals.map((v, i) => (v === null ? null : `${padL + (i / 23) * (W - padL - 6)},${y(v)}`)).filter(Boolean).join(' ')} fill="none" stroke="var(--accent)" strokeWidth={1.8} />
      {[0, 90, 180, 270, 345].map((d) => <text key={d} x={padL + (d / 15 / 23) * (W - padL - 6)} y={H - 6} fontSize={9} fill="var(--text-muted)" textAnchor="middle">{d}°</text>)}
      <text x={padL - 4} y={y(0) + 3} fontSize={9} fill="var(--text-muted)" textAnchor="end">0</text>
    </svg>
  )
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {one(curve.vertical, 'around the vertical axis (learned views marked)', [0, 5])}
        {one(curve.horizontal, 'around the horizontal axis (learned view at 0° marked)', [0])}
      </div>
    </div>
  )
}
