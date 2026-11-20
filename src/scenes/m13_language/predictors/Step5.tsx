import { useEffect, useMemo } from 'react'
import { Btn, Content, DataTable, FixedLines, GroupLabel, Note, StagePanel, useRef, useWidth, type Column } from '../ui'
import { BarChart, LinePlot, Scatter } from '../plots'
import { TRAINED_BEFORE_LINE } from '../lines'
import { VOCABULARY, nounOf, verbOf, kindOf } from '../../../sim/language/predictors/grammar'
import { embedding, principalPlane } from '../../../sim/language/predictors/counts'
import type { SeqModel } from '../../../sim/language/predictors/runtime/seqNet'
import { STEP5_PANEL } from './texts'
import { CountNote, chartColumns } from './Step4'
import type { PredictorsStore } from './store'

/**
 * Step 5's screens (spec §8.6; Jon, 2026-11-17: everything in the center;
 * Jon, 2026-11-19: the prediction from counts beside the two networks
 * everywhere). The snapshot slider and Change the prompt above the panels;
 * at each snapshot three distributions for one fixed prompt (the two
 * networks and the counts), agreement by depth with three lines and its
 * tables, and three planes: the transformer's input embeddings, the
 * recurrent network's input weights, and the count model's points.
 */
const GAP = 16
const DEPTHS = [0, 1, 2, 3]
/** The nouns and verbs, the tokens the planes show. */
const WORDS = VOCABULARY.filter((t) => nounOf(t) || verbOf(t))
const pct = (x: number) => `${Math.round(100 * x)}%`

export function Step5Controls({ s }: { s: PredictorsStore }) {
  const n = s.snapshotUpdates.length
  return (
    <div style={{ display: 'flex', gap: GAP, alignItems: 'flex-end', flexWrap: 'wrap' }} data-step5-controls>
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

/** For token t, the 64 numbers its input sends to the hidden layer: column t of the input-to-hidden matrix. */
function srnInputVector(m: SeqModel, t: number): Float64Array {
  const wih = m.weights.get('w_ih.weight')!
  const H = m.desc.hidden
  const inDim = m.desc.tensors['w_ih.weight'].shape[1]
  const v = new Float64Array(H)
  for (let j = 0; j < H; j++) v[j] = wih[j * inDim + t]
  return v
}

/** One of the three planes: its header, then the nouns and verbs as points. */
function Plane({ title, plane, width, testId }: { title: string; plane: [number, number][]; width: number; testId: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width, minWidth: 0 }} data-plane={testId}>
      <GroupLabel>{title}</GroupLabel>
      <Scatter width={width} height={260} xLabel="first direction" yLabel="second direction" testId={testId} points={WORDS.map((w, i) => ({ x: plane[i][0], y: plane[i][1], label: w, color: nounOf(w) ? 'var(--accent)' : 'var(--sensor)' }))} />
    </div>
  )
}

/** One network's row of every snapshot: held-out accuracy and agreement by depth, as measured when it was trained. */
function SnapshotsTable({ title, snapshots, testId }: { title: string; snapshots: { updates: number; heldOutAccuracy: number; agreementByDepth: Record<string, number> }[]; testId: string }) {
  const columns: Column[] = [{ key: 'updates', label: 'updates', mono: true }, { key: 'acc', label: 'held-out accuracy', mono: true }, ...DEPTHS.map((d) => ({ key: `d${d}`, label: `depth ${d}`, mono: true }))]
  const rows = snapshots.map((sn) => ({ updates: sn.updates.toLocaleString(), acc: pct(sn.heldOutAccuracy), ...Object.fromEntries(DEPTHS.map((d) => [`d${d}`, pct(sn.agreementByDepth[String(d)])])) }))
  return <DataTable columns={columns} rows={rows} rowHeader topHeader={title} testId={testId} />
}

export function Step5Stage({ s }: { s: PredictorsStore }) {
  useEffect(() => {
    void s.ensureModels().then(() => s.ensureSnapshotLoaded())
  }, [s])
  const ref = useRef<HTMLDivElement>(null)
  const w = useWidth(ref, 960)
  const { width: chartW } = chartColumns(w)
  const planeW = w >= 900 ? Math.floor((w - 2 * GAP) / 3) : Math.min(w, 420)
  const models = s.snapshotModels()
  const out = models ? s.outputs(s.fixedPrompt, models) : null
  const count = s.countPrediction(s.fixedPrompt)
  const agree = useMemo(() => (models ? s.agreementByDepth(models) : null), [models, s])
  const countAgree = useMemo(() => s.countAgreementByDepth(), [s])
  const plane = useMemo(() => {
    if (!models) return null
    const emb = models.transformer.weights.get('tok.weight')!
    const d = models.transformer.desc.dModel
    return principalPlane(WORDS.map((w) => Float64Array.from(emb.subarray(VOCABULARY.indexOf(w) * d, VOCABULARY.indexOf(w) * d + d))))
  }, [models])
  const srnPlane = useMemo(() => (models ? principalPlane(WORDS.map((w) => srnInputVector(models.srn, VOCABULARY.indexOf(w)))) : null), [models])
  const countPlane = useMemo(() => {
    const m = s.ensureCounted()
    return principalPlane(WORDS.map((w) => embedding(m, VOCABULARY.indexOf(w))))
  }, [s])
  const updates = s.snapshotUpdates[s.snapshotIndex]
  const top = (probs: ArrayLike<number>) =>
    VOCABULARY.map((t, j) => ({ label: t, value: probs[j], color: kindOf(t) === 'verb' ? (verbOf(t)!.number === 'pl' ? 'var(--actuator)' : 'var(--sensor)') : 'var(--accent)' }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 12)
  const desc = s.descs
  const agreeColumns: Column[] = [
    { key: 'depth', label: 'relative clauses', mono: true },
    { key: 'transformer', label: 'the transformer', mono: true },
    { key: 'srn', label: 'the recurrent network', mono: true },
    { key: 'counts', label: 'the prediction from counts', mono: true },
  ]
  return (
    <StagePanel wide testId="predictors-5">
      <div ref={ref} style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0, width: '100%' }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>Watching it learn</div>
        {STEP5_PANEL.map((p) => (
          <Note key={p.slice(0, 12)} style={{ color: 'var(--text)' }}>
            {p}
          </Note>
        ))}
        <Content>{TRAINED_BEFORE_LINE}</Content>
        <Step5Controls s={s} />
        {!models && <Note data-loading>{s.loadError ?? 'The snapshot is loading.'}</Note>}
        {models && out && agree && count && (
          <div data-snapshot={updates} style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
            <GroupLabel>{`After ${updates.toLocaleString()} updates: the next token after “${s.fixedPrompt.join(' ')}”`}</GroupLabel>
            <Note>The twelve most probable tokens from each predictor; plural verb forms green, singular orange, other tokens blue. The prediction from counts is the same at every snapshot.</Note>
            <div style={{ display: 'flex', gap: GAP, flexWrap: 'wrap', alignItems: 'flex-start' }} data-distributions>
              <div style={{ width: chartW, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }} data-distribution="transformer">
                <GroupLabel>The transformer</GroupLabel>
                <BarChart bars={top(out.transformer.probs[out.transformer.probs.length - 1])} width={chartW} max={1} format={(v) => v.toFixed(3)} rowH={12} testId="snap-transformer" />
              </div>
              <div style={{ width: chartW, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }} data-distribution="srn">
                <GroupLabel>The recurrent network</GroupLabel>
                <BarChart bars={top(out.srn.probs[out.srn.probs.length - 1])} width={chartW} max={1} format={(v) => v.toFixed(3)} rowH={12} testId="snap-srn" />
              </div>
              <div style={{ width: chartW, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }} data-distribution="counts">
                <GroupLabel>The prediction from counts</GroupLabel>
                <BarChart bars={top(count.probs)} width={chartW} max={1} format={(v) => v.toFixed(3)} rowH={12} testId="snap-counts" />
                <CountNote c={count} />
              </div>
            </div>
            <GroupLabel>Agreement by depth</GroupLabel>
            <LinePlot
              series={[
                { label: 'the transformer', color: 'var(--accent)', points: agree.transformer.map((v, d) => [d, 100 * v] as [number, number]) },
                { label: 'the recurrent network', color: 'var(--sensor)', points: agree.srn.map((v, d) => [d, 100 * v] as [number, number]) },
                { label: 'the prediction from counts', color: 'var(--actuator)', dashed: true, points: countAgree.map((v, d) => [d, 100 * v] as [number, number]) },
              ]}
              width={Math.min(560, Math.max(320, w))}
              height={220}
              xLabel="relative clauses between the subject and its verb"
              yLabel="percent of 50 probes agreeing"
              xMin={0}
              xMax={3}
              xTicks={DEPTHS.map((x) => ({ x, label: String(x) }))}
              hLines={[{ y: 50, label: 'chance, 50%' }]}
              testId="agreement"
            />
            <Note data-count-line>The dashed line is the prediction from counts, from the two words before the verb or, when those two never occurred together, from the one word before. It is the same at every snapshot: the count model is not trained.</Note>
            <DataTable columns={agreeColumns} rows={DEPTHS.map((d) => ({ depth: String(d), transformer: pct(agree.transformer[d]), srn: pct(agree.srn[d]), counts: pct(countAgree[d]) }))} rowHeader testId="agreement-table" footer={`At this snapshot, after ${updates.toLocaleString()} updates; the share of 50 probes at each depth.`} />
            {desc && (
              <>
                <GroupLabel>Every snapshot: held-out accuracy and agreement by depth, as measured when the networks were trained</GroupLabel>
                <div style={{ display: 'flex', gap: GAP, flexWrap: 'wrap', alignItems: 'flex-start' }} data-all-snapshots>
                  <SnapshotsTable title="The transformer" snapshots={desc.transformer.snapshots} testId="all-snapshots-transformer" />
                  <SnapshotsTable title="The recurrent network" snapshots={desc.srn.snapshots} testId="all-snapshots-srn" />
                </div>
                <Note>{`Held-out accuracy is the share of next tokens the network gave the most probability to, on sentences not used in training. Agreement by depth is the share of the 50 probes at each depth, as above. The prediction from counts agrees on ${DEPTHS.map((d) => `${pct(countAgree[d])} at depth ${d}`).join(', ')}, at every snapshot.`}</Note>
              </>
            )}
            <GroupLabel>Three planes: the two networks’ numbers for each token at this snapshot, and the count model’s</GroupLabel>
            <Note>Each plane shows the nouns and verbs as points, by a projection of one set of numbers onto its two directions of greatest difference. The first plane projects the transformer’s input embeddings, the 32 numbers each token starts with. The second projects the recurrent network’s input weights, the 64 numbers a token’s input sends to the hidden layer. The third projects the count model’s lists of counts from Step 2, which are the same at every snapshot. Nouns blue, verbs orange. The directions are each plane’s own, so only the groupings compare across planes, not the positions.</Note>
            <div style={{ display: 'flex', gap: GAP, flexWrap: 'wrap', alignItems: 'flex-start' }} data-planes>
              {plane && <Plane title="The transformer’s input embeddings" plane={plane} width={planeW} testId="embeddings" />}
              {srnPlane && <Plane title="The recurrent network’s input weights" plane={srnPlane} width={planeW} testId="srn-inputs" />}
              <Plane title="The count model’s lists of counts" plane={countPlane} width={planeW} testId="count-plane" />
            </div>
          </div>
        )}
      </div>
    </StagePanel>
  )
}
