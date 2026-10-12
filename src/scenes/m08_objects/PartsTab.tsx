import { useMemo, useState, type ReactNode } from 'react'
import { Panel } from '../../components/Panel'
import { makeRng } from '../../sim/random'
import { DELETION_LEVEL, type TestMode } from '../../sim/objects/config'
import { ERASER_LABEL, erase, movePart, type EraserKind, type Joint, findJoints, resample } from '../../sim/objects/erasers'
import { scrambledMask } from '../../sim/objects/mask'
import { chw, classify, match, run, topK, type Model } from '../../sim/objects/net'
import { normalize, rasterize, SIZE, type Drawing } from '../../sim/objects/raster'
import { allAnswered, newTest, partsTrials, type PartsTrial, type TestState } from '../../sim/objects/trials'
import { DrawPad } from './DrawPad'
import { Glimpse } from './Glimpse'
import { ERASERS_LINE, GLIMPSE_LINE, LARGER_TEST_LINE, OUR_NETWORKS_LINE } from './lines'
import { useJson, useModel, type DisplayManifest, type Measurements, type MovedPair } from './data'
import { Btn, Choice, Content, FixedLines, GroupLabel, NameGrid, Note, ObjectsLayout, PANEL_STYLE, ResultTable, RIGHT_STYLE, StageTitle, StrokesView, pct, withArticle, GlimpseSummary, TrialNav, Intro } from './ui'

/**
 * Part 2, Parts (spec §6.2): contour deletion with the student first, the
 * erasers on the student's own drawing, one part moved, and the built set
 * of moved-part pairs. No network label for a trial set is computed or
 * rendered before *Commit my answers* (`reveal.test.tsx`).
 */
export const MOVED_PROMPTS: { category: string; what: string }[] = [
  { category: 'mushroom', what: 'the cap under the stem' },
  { category: 'ice cream', what: 'the scoop under the cone' },
  { category: 'coffee cup', what: 'the handle on top' },
]
export type StillAnswer = 'yes' | 'no' | 'only just'
export const PARTS_INTRO_LINES = [
  'Twelve line drawings, one at a time, each with half its ink erased. Name each one from the grid of 24; you can go back. Then commit.',
  'Six have their gaps in the middles of the lines, six at the corners and joins, mixed in one order and not announced.',
  'Then the drawing network names the same twelve, and its scores on a larger set sit beside yours.',
]
export const PARTS_TIME_LINE = 'The twelve take about three minutes. Do not press Begin until you are ready to go through to the end.'
export const MOVED_SCALE_LINE = 'Both versions are centered and scaled like every drawing the network receives, so a moved version that is taller or wider than the original is also drawn a little smaller.'
export const NO_JOINTS_LINE = 'This drawing has no joint: no corner, no stroke end near another stroke, no crossing. The gaps went mid-line instead.'
export type PartsStep = '1' | '2' | '3' | '4'
export const PARTS_STEPS: { id: PartsStep; label: string }[] = [
  { id: '1', label: 'Step 1 · Contour deletion' },
  { id: '2', label: 'Step 2 · Your drawing' },
  { id: '3', label: 'Step 3 · Move one part' },
  { id: '4', label: 'Step 4 · Built pairs' },
]
export const STILL_OPTIONS: { id: StillAnswer; label: string }[] = [{ id: 'yes', label: 'yes' }, { id: 'no', label: 'no' }, { id: 'only just', label: 'only just' }]

export interface PartsProps {
  seed: number
  mode: TestMode
  header?: ReactNode
  model?: Model
  display?: DisplayManifest
  moved?: { pairs: MovedPair[] }
  measurements?: Measurements
  initial?: { answers?: (string | null)[]; committed?: boolean; step?: PartsStep; begun?: boolean }
  /** The student's drawing from the Draw tab, loaded into Step 2's pad. */
  fromPart1?: Drawing
}

export function PartsTab({ seed, mode, header, model: givenModel, display: givenDisplay, moved: givenMoved, measurements: givenM, initial, fromPart1 }: PartsProps) {
  const model = useModel('drawing', givenModel)
  const display = useJson<DisplayManifest>('drawings/display.json', givenDisplay)
  const movedSet = useJson<{ pairs: MovedPair[] }>('drawings/moved.json', givenMoved)
  const measurements = useJson<Measurements>('measurements.json', givenM)
  const labels = model?.desc.labels ?? []
  // One step at a time: four steps stacked on one stage were confusing (Jon, 2026-10-12).
  const [step, setStep] = useState<PartsStep>(initial?.step ?? '1')

  // Step 1: the trials, from the seed.
  const trials = useMemo<PartsTrial[]>(() => (display ? partsTrials(display.drawings, makeRng(seed ^ 0x2a7)) : []), [display, seed])
  const erased = useMemo(() => trials.map((t) => erase(t.drawing.strokes, DELETION_LEVEL, t.eraser, t.drawing.joints as Joint[])), [trials])
  const masks = useMemo(() => erased.map((e, i) => scrambledMask(rasterize(e.strokes), SIZE, 8, makeRng(seed ^ (0x51 + i)))), [erased, seed])
  const [test, setTest] = useState<TestState<string>>(() => { const t = newTest<string>(trials.length || 12); if (initial?.answers) t.answers = initial.answers; t.committed = initial?.committed ?? false; return t })
  const [at, setAt] = useState(0)
  const [begun, setBegun] = useState(initial?.begun ?? initial?.committed ?? false)
  const answer = (i: number, v: string) => setTest((t) => ({ ...t, answers: t.answers.map((a, k) => (k === i ? v : a)) }))
  const commit = () => setTest((t) => ({ ...t, committed: true }))
  const logGlimpse = (i: number, ms: number) => setTest((t) => ({ ...t, glimpses: [...t.glimpses, { trial: i, shownMs: ms }] }))

  // Only after the commit does any network answer exist.
  const reveal = useMemo(() => {
    if (!test.committed || !model || !erased.length) return null
    return erased.map((e) => { const o = classify(model, rasterize(e.strokes)); return { label: labels[o.top], p: o.probs[o.top] } })
  }, [test.committed, model, erased, labels])

  // Step 2: the erasers on the student's own drawing.
  const [own, setOwn] = useState<Drawing>(fromPart1 ?? [])
  const [ownEraser, setOwnEraser] = useState<EraserKind>('mid')
  const [ownLevel, setOwnLevel] = useState(DELETION_LEVEL)
  const ownErased = useMemo(() => (own.length ? erase(normalize(own), ownLevel, ownEraser) : null), [own, ownEraser, ownLevel])
  const ownLabels = useMemo(() => {
    if (!model || !own.length || !ownErased) return null
    const a = classify(model, rasterize(normalize(own)))
    const b = classify(model, rasterize(ownErased.strokes))
    return { intact: topK(a.probs, 3).map((k) => `${labels[k.label].padEnd(12)} ${k.p.toFixed(2)}`), erased: topK(b.probs, 3).map((k) => `${labels[k.label].padEnd(12)} ${k.p.toFixed(2)}`) }
  }, [model, own, ownErased, labels])

  // Step 3: move one part.
  const [promptIdx, setPromptIdx] = useState(() => makeRng(seed ^ 0x3b2).int(MOVED_PROMPTS.length))
  const prompt = MOVED_PROMPTS[promptIdx]
  const [first, setFirst] = useState<Drawing>([])
  const [second, setSecond] = useState<Drawing>([])
  const [still, setStill] = useState<StillAnswer | null>(null)
  const [stillCommitted, setStillCommitted] = useState(false)
  const pairReveal = useMemo(() => {
    if (!stillCommitted || !model || !first.length || !second.length || !display) return null
    const ta = run(model, rasterize(normalize(first)))
    const tb = run(model, rasterize(normalize(second)))
    const last = model.desc.layers![model.desc.layers!.length - 1].pooled
    const pa = ta.get(model.desc.outputs.probs)!.data, pb = tb.get(model.desc.outputs.probs)!.data
    const ka = topK(pa, 1)[0], kb = topK(pb, 1)[0]
    const matchMoved = match(chw(ta.get(last)!), chw(tb.get(last)!))
    const two = display.drawings.filter((d) => d.category === prompt.category).slice(0, 2)
    const ordinary = two.length === 2 ? match(chw(run(model, rasterize(two[0].strokes)).get(last)!), chw(run(model, rasterize(two[1].strokes)).get(last)!)) : NaN
    return { a: `${labels[ka.label]} ${ka.p.toFixed(2)}`, b: `${labels[kb.label]} ${kb.p.toFixed(2)}`, matchMoved, ordinary }
  }, [stillCommitted, model, first, second, display, prompt, labels])

  // Step 4: the built set.
  const [builtAnswers, setBuiltAnswers] = useState<(StillAnswer | null)[]>(() => new Array<StillAnswer | null>(10).fill(null))
  const [builtCommitted, setBuiltCommitted] = useState(false)
  const builtReveal = useMemo(() => {
    if (!builtCommitted || !model || !movedSet || !display) return null
    const last = model.desc.layers![model.desc.layers!.length - 1].pooled
    return movedSet.pairs.map((p) => {
      const ta = run(model, rasterize(normalize(p.original)))
      const tb = run(model, rasterize(normalize(p.moved)))
      const ka = topK(ta.get(model.desc.outputs.probs)!.data, 1)[0], kb = topK(tb.get(model.desc.outputs.probs)!.data, 1)[0]
      const other = display.drawings.find((d) => d.id === p.otherId)
      const ordinary = other ? match(chw(ta.get(last)!), chw(run(model, rasterize(other.strokes)).get(last)!)) : NaN
      return { a: `${labels[ka.label]} ${ka.p.toFixed(2)}`, b: `${labels[kb.label]} ${kb.p.toFixed(2)}`, matchMoved: match(chw(ta.get(last)!), chw(tb.get(last)!)), ordinary }
    })
  }, [builtCommitted, model, movedSet, display, labels])

  const yourScore = (kind: EraserKind) => {
    const idx = trials.map((t, i) => (t.eraser === kind ? i : -1)).filter((i) => i >= 0)
    return idx.filter((i) => test.answers[i] === trials[i].drawing.category).length / Math.max(1, idx.length)
  }
  const netScore = (kind: EraserKind) => {
    if (!reveal) return 0
    const idx = trials.map((t, i) => (t.eraser === kind ? i : -1)).filter((i) => i >= 0)
    return idx.filter((i) => reveal[i].label === trials[i].drawing.category).length / Math.max(1, idx.length)
  }

  const trial = trials[at]
  const left = (
    <Panel title="Parts" style={PANEL_STYLE}>
      <Choice value={step} options={PARTS_STEPS} onChange={setStep} />
      {step === '1' && <>
      <Note>Twelve drawings, each with half its ink removed by one of two erasers. Name each one. The network takes the same twelve after you commit.</Note>
      <Note>Viewing: {mode}. The trials and the commit are on the stage.</Note>
      {mode === 'glimpse' && <Content>{GLIMPSE_LINE}</Content>}
      {test.committed && (
        <>
          <Note><b>Committed.</b> Your results and the network’s are on the right.</Note>
          <FixedLines lines={[`you, mid-line:       ${pct(yourScore('mid'))}`, `you, at the joints:  ${pct(yourScore('joints'))}`, reveal ? `network, mid-line:   ${pct(netScore('mid'))}` : null, reveal ? `network, joints:     ${pct(netScore('joints'))}` : null]} />
        </>
      )}
      <Content>{ERASERS_LINE}</Content>
      <Content>{OUR_NETWORKS_LINE}</Content>
      </>}
      {step === '2' && <>
      <Note>Your drawing from the Draw tab is on the pad; keep it, or clear it and draw something with parts. Apply either eraser and watch the labels.</Note>
      <Choice value={ownEraser} options={[{ id: 'mid', label: ERASER_LABEL.mid }, { id: 'joints', label: ERASER_LABEL.joints }]} onChange={setOwnEraser} />
      <label style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>share of ink removed</span><span style={{ fontFamily: 'var(--font-mono)' }}>{Math.round(ownLevel * 100)}%</span></span>
        <input type="range" min={0.2} max={0.8} step={0.05} value={ownLevel} onChange={(e) => setOwnLevel(parseFloat(e.target.value))} />
      </label>
      <Content>{ERASERS_LINE}</Content>
      </>}
      {step === '3' && <>
      <Choice value={String(promptIdx)} options={MOVED_PROMPTS.map((p, i) => ({ id: String(i), label: p.category }))} onChange={(v) => { setPromptIdx(Number(v)); setFirst([]); setSecond([]); setStill(null); setStillCommitted(false) }} />
      <Note>Draw {withArticle(prompt.category)} on the first pad, then the same {prompt.category} with one part moved on the second: {prompt.what}.</Note>
      <Note>Is the moved version still {withArticle(prompt.category)}?</Note>
      <Choice value={still} options={STILL_OPTIONS} onChange={(v) => setStill(v)} disabledIds={stillCommitted ? STILL_OPTIONS.map((o) => o.id) : []} />
      {!stillCommitted && <Btn primary disabled={!first.length || !second.length || !still} onClick={() => setStillCommitted(true)}>Commit my answer</Btn>}
      <Content>{OUR_NETWORKS_LINE}</Content>
      </>}
      {step === '4' && <>
      <Note>Ten display drawings, each with one group of strokes moved by hand. For each pair: is the moved version still the same object? Commit, and the network’s labels appear.</Note>
      {!builtCommitted && <Btn primary disabled={!movedSet || builtAnswers.slice(0, movedSet?.pairs.length ?? 10).some((a) => a === null)} onClick={() => setBuiltCommitted(true)}>Commit my answers for the ten pairs</Btn>}
      <Content>{OUR_NETWORKS_LINE}</Content>
      </>}
    </Panel>
  )

  const stage = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <StageTitle sub={display ? `${display.drawings.length} display drawings · ${labels.length || 24} categories · ${PARTS_STEPS.find((x) => x.id === step)!.label}` : 'Loading the display drawings…'}>Part 2 — Parts</StageTitle>
      {step === '1' && !begun && !test.committed && <Intro title="What will happen" lines={PARTS_INTRO_LINES} time={PARTS_TIME_LINE} onBegin={() => setBegun(true)} disabled={!trials.length} />}
      {step === '1' && begun && trial && !test.committed && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Glimpse mode={mode} trial={at} image={null} mask={masks[at]} size={SIZE} display={256} onShown={(ms) => logGlimpse(at, ms)} render={<StrokesView strokes={erased[at].strokes} display={256} testId={`trial-${at}`} />}>
            <NameGrid names={labels} value={test.answers[at]} onChange={(v) => answer(at, v)} columns={4} />
          </Glimpse>
          <TrialNav at={at} n={trials.length || 12} answered={test.answers.filter((a) => a !== null).length} onPrev={() => setAt((i) => Math.max(0, i - 1))} onNext={() => setAt((i) => Math.min(trials.length - 1, i + 1))} onCommit={commit} canCommit={trials.length > 0 && allAnswered(test)} committed={test.committed} />
        </div>
      )}
      {step === '1' && test.committed && reveal && (
        <>
          <GroupLabel>The twelve, revealed</GroupLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
            {trials.map((t, i) => (
              <div key={i} data-revealed-trial={i} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 6, fontSize: 11 }}>
                <StrokesView strokes={erased[i].strokes} display={136} />
                <div style={{ fontFamily: 'var(--font-mono)', whiteSpace: 'pre', marginTop: 4 }}>{`#${String(i + 1).padStart(2)} ${ERASER_LABEL[t.eraser]}\nit is:   ${t.drawing.category}\nyou:     ${test.answers[i]}\nnetwork: ${reveal[i].label} ${reveal[i].p.toFixed(2)}`}</div>
              </div>
            ))}
          </div>
          <div><Btn primary onClick={() => setStep('2')}>Go on to Step 2: your drawing</Btn></div>
        </>
      )}
      {step === '2' && <>
      <GroupLabel>Your drawing, erased</GroupLabel>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <DrawPad drawing={own} onChange={setOwn} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{ERASER_LABEL[ownEraser]}, {Math.round((ownErased?.removed ?? ownLevel) * 100)}% of the ink removed{ownErased ? `, ${findJoints(resample(normalize(own))).length} joints found` : ''}</div>
          {ownErased?.fellBack && <Note>{NO_JOINTS_LINE}</Note>}
          {ownErased ? <StrokesView strokes={ownErased.strokes} display={192} testId="own-erased" /> : <div style={{ width: 192, height: 192, borderRadius: 6, border: '1px dashed var(--border)' }} />}
          {ownLabels && (
            <div style={{ display: 'flex', gap: 12 }}>
              <div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>intact</div><FixedLines lines={ownLabels.intact} /></div>
              <div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>erased</div><FixedLines lines={ownLabels.erased} /></div>
            </div>
          )}
        </div>
      </div>
      <div><Btn primary onClick={() => setStep('3')}>Go on to Step 3: move one part</Btn></div>
      </>}
      {step === '3' && <>
      <GroupLabel>One part moved</GroupLabel>
      <Note>{MOVED_SCALE_LINE}</Note>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <DrawPad drawing={first} onChange={setFirst} prompt={withArticle(prompt.category)} />
        <DrawPad drawing={second} onChange={setSecond} prompt={`the same ${prompt.category}, ${prompt.what}`} />
        <div style={{ minWidth: 220 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>After you commit</div>
          <FixedLines lines={pairReveal ? [`original:  ${pairReveal.a}`, `moved:     ${pairReveal.b}`, `last layer, original vs moved:    ${pairReveal.matchMoved.toFixed(2)}`, `last layer, two ordinary ${prompt.category.padEnd(10)}: ${Number.isFinite(pairReveal.ordinary) ? pairReveal.ordinary.toFixed(2) : '—'}`] : [null, null, null, null]} />
        </div>
      </div>
      {stillCommitted && <div><Btn primary onClick={() => setStep('4')}>Go on to Step 4: the built pairs</Btn></div>}
      </>}
      {step === '4' && <>
      <GroupLabel>A built set of moved-part pairs</GroupLabel>
      <Note>{MOVED_SCALE_LINE}</Note>
      {movedSet && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))', gap: 8 }}>
          {movedSet.pairs.map((p, i) => (
            <div key={p.id} data-built-pair={p.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 6, fontSize: 11, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div><b>{p.category}</b> · {p.what}</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <StrokesView strokes={normalize(p.original)} display={150} />
                <StrokesView strokes={normalize(p.moved)} display={150} />
              </div>
              <Choice value={builtAnswers[i]} options={STILL_OPTIONS} onChange={(v) => setBuiltAnswers((a) => a.map((x, k) => (k === i ? v : x)))} disabledIds={builtCommitted ? STILL_OPTIONS.map((o) => o.id) : []} />
              {builtReveal && <FixedLines lines={[`original: ${builtReveal[i].a}`, `moved:    ${builtReveal[i].b}`, `match ${builtReveal[i].matchMoved.toFixed(2)}, ordinary pair ${builtReveal[i].ordinary.toFixed(2)}`]} />}
            </div>
          ))}
        </div>
      )}
      </>}
    </div>
  )

  const right = (
    <Panel title="The larger test" style={RIGHT_STYLE}>
      {test.committed ? (
        measurements ? (
          <>
            <Note>{LARGER_TEST_LINE} Here, {measurements.part2.erasers.largerN} held-out drawings per eraser, at three deletion levels; the share is of the total stroke length.</Note>
            <ResultTable head={['ink removed', ERASER_LABEL.mid, ERASER_LABEL.joints, 'gap']} rows={measurements.part2.erasers.levels.map((l) => [`${Math.round(l * 100)}%`, pct(measurements.part2.erasers.accuracy[`mid@${l}`]), pct(measurements.part2.erasers.accuracy[`joints@${l}`]), `${fmtPts(measurements.part2.erasers.gap[String(l)] * 100)} pts`])} />
            <Note>The gap is mid-line minus at the joints. For people, the reading reports recoverable drawings named and nonrecoverable ones failed almost completely (§8.2.4).</Note>
            <GroupLabel>The built moved-part set</GroupLabel>
            <Note>Over the ten pairs, the network’s label changed on {measurements.part2.moved.labelChanged} of {measurements.part2.moved.n} when the part moved.</Note>
          </>
        ) : (
          <Note>Loading the measurements…</Note>
        )
      ) : (
        <Note>The network’s results appear here after you commit.</Note>
      )}
      <GroupLabel>The erasers</GroupLabel>
      <Note>Joints are found on the strokes before anything is drawn: corners, stroke ends that lie near another stroke, and crossings. Mid-line gaps are centered on the middles of the runs between joints; joint gaps on the joints. Both grow until the same share of the total stroke length is gone, to within 2%.</Note>
      {trials.length > 0 && <Note>{joinJointCount(trials)}</Note>}
      <GlimpseSummary records={test.glimpses} />
    </Panel>
  )

  return <ObjectsLayout header={header} left={left} stage={stage} right={right} />
}

/** A signed count of points, with a real minus sign and no −0. */
export function fmtPts(v: number): string {
  const r = Math.round(v)
  return r < 0 ? `−${-r}` : `${r}`
}

function joinJointCount(trials: PartsTrial[]): string {
  const n = trials.reduce((a, t) => a + t.drawing.joints.length, 0)
  return `The twelve drawings have ${n} joints between them.`
}

export { findJoints, resample, movePart }
