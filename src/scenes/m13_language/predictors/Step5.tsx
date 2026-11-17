import { useEffect, useMemo } from 'react'
import { Btn, Content, FixedLines, GroupLabel, Note, StagePanel } from '../ui'
import { BarChart, LinePlot, Scatter } from '../plots'
import { TRAINED_BEFORE_LINE } from '../lines'
import { VOCABULARY, nounOf, verbOf, kindOf } from '../../../sim/language/predictors/grammar'
import { embedding, principalPlane } from '../../../sim/language/predictors/counts'
import { STEP5_PANEL } from './texts'
import type { PredictorsStore } from './store'

/**
 * Step 5's screens (spec §8.6; Jon, 2026-11-17: everything in the center).
 * The snapshot slider and Change the prompt above the panels; at each
 * snapshot the two networks' distributions for one fixed prompt, agreement
 * by depth, and the transformer's input embeddings on a plane beside the
 * count model's points.
 */
export function Step5Controls({ s }: { s: PredictorsStore }) {
  const n = s.snapshotUpdates.length
  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }} data-step5-controls>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: 260 }}>
        <GroupLabel>Snapshot</GroupLabel>
        <input type="range" min={0} max={n - 1} step={1} value={s.snapshotIndex} onChange={(e) => void s.setSnapshot(Number(e.target.value))} aria-label="Snapshot" style={{ width: '100%' }} />
        <FixedLines lines={[`after ${s.snapshotUpdates[s.snapshotIndex].toLocaleString()} updates`]} />
      </div>
      <div style={{ paddingBottom: 2 }}>
        <Btn onClick={() => s.changePrompt()}>Change the prompt</Btn>
      </div>
      {s.loadingSnapshot && <Note data-loading>Loading the snapshot.</Note>}
    </div>
  )
}

export function Step5Stage({ s }: { s: PredictorsStore }) {
  useEffect(() => {
    void s.ensureModels().then(() => s.ensureSnapshotLoaded())
  }, [s])
  const models = s.snapshotModels()
  const out = models ? s.outputs(s.fixedPrompt, models) : null
  const agree = useMemo(() => (models ? s.agreementByDepth(models) : null), [models, s])
  const words = VOCABULARY.filter((t) => nounOf(t) || verbOf(t))
  const plane = useMemo(() => {
    if (!models) return null
    const emb = models.transformer.weights.get('tok.weight')!
    const d = models.transformer.desc.dModel
    const vecs = words.map((w) => Float64Array.from(emb.subarray(VOCABULARY.indexOf(w) * d, VOCABULARY.indexOf(w) * d + d)))
    return principalPlane(vecs)
  }, [models, words])
  const countPlane = useMemo(() => (s.model && !s.counting ? principalPlane(words.map((w) => embedding(s.model!, VOCABULARY.indexOf(w)))) : null), [s.model, s.counting, words])
  const updates = s.snapshotUpdates[s.snapshotIndex]
  const top = (probs: Float64Array) =>
    VOCABULARY.map((t, j) => ({ label: t, value: probs[j], color: kindOf(t) === 'verb' ? (verbOf(t)!.number === 'pl' ? 'var(--actuator)' : 'var(--sensor)') : 'var(--accent)' }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 12)
  const desc = s.descs
  return (
    <StagePanel wide testId="predictors-5">
      <div style={{ fontSize: 14, fontWeight: 600 }}>Watching it learn</div>
      {STEP5_PANEL.map((p) => (
        <Note key={p.slice(0, 12)} style={{ color: 'var(--text)' }}>
          {p}
        </Note>
      ))}
      <Content>{TRAINED_BEFORE_LINE}</Content>
      <Step5Controls s={s} />
      {!models && <Note data-loading>{s.loadError ?? 'The snapshot is loading.'}</Note>}
      {models && out && agree && (
        <div data-snapshot={updates} style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
          <GroupLabel>{`After ${updates.toLocaleString()} updates: the next token after “${s.fixedPrompt.join(' ')}”`}</GroupLabel>
          <Note>The twelve most probable tokens for each network; plural verb forms green, singular orange, other tokens blue.</Note>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <Note>The transformer</Note>
              <BarChart bars={top(out.transformer.probs[out.transformer.probs.length - 1])} width={290} max={1} format={(v) => v.toFixed(3)} rowH={12} testId="snap-transformer" />
            </div>
            <div>
              <Note>The recurrent network</Note>
              <BarChart bars={top(out.srn.probs[out.srn.probs.length - 1])} width={290} max={1} format={(v) => v.toFixed(3)} rowH={12} testId="snap-srn" />
            </div>
          </div>
          <GroupLabel>Agreement by depth</GroupLabel>
          <LinePlot series={[{ label: 'the transformer', color: 'var(--accent)', points: agree.transformer.map((v, d) => [d, 100 * v] as [number, number]) }, { label: 'the recurrent network', color: 'var(--sensor)', points: agree.srn.map((v, d) => [d, 100 * v] as [number, number]) }]} width={420} height={200} xLabel="relative clauses between the subject and its verb" yLabel="percent of 50 probes agreeing" xMin={0} xMax={3} xTicks={[0, 1, 2, 3].map((x) => ({ x, label: String(x) }))} hLines={[{ y: 50, label: 'chance, 50%' }]} testId="agreement" />
          <FixedLines lines={['depth    transformer   recurrent network', ...[0, 1, 2, 3].map((d) => `  ${d}        ${String(Math.round(100 * agree.transformer[d])).padStart(3)}%           ${String(Math.round(100 * agree.srn[d])).padStart(3)}%`)]} testId="agreement-table" />
          {desc && (
            <>
              <GroupLabel>Every snapshot: held-out accuracy and agreement by depth, as measured when the networks were trained</GroupLabel>
              <FixedLines lines={['updates    transformer: acc  d0  d1  d2  d3     recurrent: acc  d0  d1  d2  d3', ...desc.transformer.snapshots.map((sn, i) => { const r = desc.srn.snapshots[i]; const f = (x: number) => String(Math.round(100 * x)).padStart(3); return `${String(sn.updates).padStart(7)}    ${f(sn.heldOutAccuracy)}% ${[0, 1, 2, 3].map((d) => f(sn.agreementByDepth[String(d)])).join(' ')}      ${f(r.heldOutAccuracy)}% ${[0, 1, 2, 3].map((d) => f(r.agreementByDepth[String(d)])).join(' ')}` })]} testId="all-snapshots" scroll />
            </>
          )}
          <GroupLabel>The transformer’s input embeddings, beside the count model’s points</GroupLabel>
          <Note>Left: each token’s embedding, the 32 numbers it starts with, projected onto its two directions of greatest difference at this snapshot. Right: the count model’s points from Step 2, by the same projection, if “Count” has run. Nouns blue, verbs orange.</Note>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {plane && <Scatter width={320} height={260} xLabel="first direction" yLabel="second direction" testId="embeddings" points={words.map((w, i) => ({ x: plane[i][0], y: plane[i][1], label: w, color: nounOf(w) ? 'var(--accent)' : 'var(--sensor)' }))} />}
            {countPlane ? <Scatter width={320} height={260} xLabel="first direction" yLabel="second direction" testId="count-plane" points={words.map((w, i) => ({ x: countPlane[i][0], y: countPlane[i][1], label: w, color: nounOf(w) ? 'var(--accent)' : 'var(--sensor)' }))} /> : <Note data-missing="count">The count model’s points appear here once “Count” has run in Step 2.</Note>}
          </div>
        </div>
      )}
    </StagePanel>
  )
}
