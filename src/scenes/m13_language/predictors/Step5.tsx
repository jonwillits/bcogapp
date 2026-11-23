import { useEffect, useMemo } from 'react'
import { Btn, Content, DataTable, FixedLines, GroupLabel, Note, StagePanel, useRef, useWidth, type Column } from '../ui'
import { BarChart, LinePlot, Scatter } from '../plots'
import { TRAINED_BEFORE_LINE } from '../lines'
import { VOCABULARY, nounOf, verbOf, kindOf } from '../../../sim/language/predictors/grammar'
import { embedding, principalPlane } from '../../../sim/language/predictors/counts'
import type { SeqModel } from '../../../sim/language/predictors/runtime/seqNet'
import { STEP5_PANEL } from './texts'
import { CountNote, PromptPalette, chartColumns } from './Step4'
import { SENTENCES_PER_UPDATE, type PredictorsStore } from './store'
import type { Scores } from '../../../sim/language/predictors/scoring'

/**
 * Step 5's screens (spec §8.6; Jon, 2026-11-17: everything in the center;
 * Jon, 2026-11-19: the prediction from counts beside the two networks
 * everywhere; Jon, 2026-11-20: the models in the order count model,
 * recurrent network, transformer everywhere; the prompt built from the
 * palette as in Step 4, or drawn by Change the prompt; the count model
 * follows the slider, counting the sentences the networks had been trained on at each
 * snapshot; its held-out accuracy and agreement in the snapshots tables;
 * the networks' planes from their output weights). The snapshot slider and
 * Change the prompt above the panels; at each snapshot three distributions
 * for the current prompt, agreement by depth with three lines and its
 * tables, and three planes: the count model's lists of counts, and each
 * network's output weights.
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

/** For token t, the row of a network's output matrix: the numbers the network multiplies its final state by to score that token. */
function outputVector(m: SeqModel, t: number): Float64Array {
  const w = m.weights.get('out.weight')!
  const width = m.desc.tensors['out.weight'].shape[1]
  return Float64Array.from(w.subarray(t * width, t * width + width))
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

/** One predictor's row of every snapshot (Jon, 2026-11-20): the three scores on the held-out and the training sentences, then agreement by depth on the probes. */
type SnapshotRow = { updates: number; scores?: { heldOut: Scores; training: Scores }; agreementByDepth: Record<string, number> }
function SnapshotsTable({ title, snapshots, testId }: { title: string; snapshots: SnapshotRow[]; testId: string }) {
  const sets = [['heldOut', 'held-out'], ['training', 'training']] as const
  const columns: Column[] = [{ key: 'updates', label: 'updates', mono: true }, ...sets.flatMap(([k, label]) => [{ key: `${k}.agreement`, label: `${label}: agreement`, mono: true }, { key: `${k}.kind`, label: `${label}: right kind`, mono: true }, { key: `${k}.exact`, label: `${label}: exact`, mono: true }]), ...DEPTHS.map((d) => ({ key: `d${d}`, label: `probes, depth ${d}`, mono: true }))]
  const rows = snapshots.map((sn) => ({
    updates: sn.updates.toLocaleString(),
    ...Object.fromEntries(sets.flatMap(([k]) => (['agreement', 'kind', 'exact'] as const).map((m) => [`${k}.${m}`, sn.scores ? pct(sn.scores[k][m]) : '—']))),
    ...Object.fromEntries(DEPTHS.map((d) => [`d${d}`, pct(sn.agreementByDepth[String(d)])])),
  }))
  return <DataTable columns={columns} rows={rows} rowHeader topHeader={title} testId={testId} />
}

/** The prompt line (Jon, 2026-11-20): CURRENT PROMPT, then the prompt as it is. */
function CurrentPrompt({ prompt }: { prompt: string[] }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap', marginTop: 8 }} data-current-prompt={prompt.join(' ')}>
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Current prompt:</span>
      <span style={{ fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{prompt.length ? `“${prompt.join(' ')}”` : '(empty: press a token below)'}</span>
    </div>
  )
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
  const updates = s.snapshotUpdates[s.snapshotIndex]
  const prompt = s.prompt5
  const out = models && prompt.length ? s.outputs(prompt, models) : null
  const cs = useMemo(() => s.countStateAt(updates), [s, updates])
  const count = s.countPrediction(prompt, cs.ngram)
  const agree = useMemo(() => (models ? s.agreementByDepth(models) : null), [models, s])
  const countPlane = useMemo(() => principalPlane(WORDS.map((w) => embedding(cs.model, VOCABULARY.indexOf(w)))), [cs])
  const srnPlane = useMemo(() => (models ? principalPlane(WORDS.map((w) => outputVector(models.srn, VOCABULARY.indexOf(w)))) : null), [models])
  const plane = useMemo(() => (models ? principalPlane(WORDS.map((w) => outputVector(models.transformer, VOCABULARY.indexOf(w)))) : null), [models])
  /** The count model's row of every snapshot, computed here: the networks' rows were measured when they were trained. */
  const countSnapshots = useMemo((): SnapshotRow[] => s.snapshotUpdates.map((u) => { const c = s.countStateAt(u); return { updates: u, scores: c.scores, agreementByDepth: Object.fromEntries(DEPTHS.map((d) => [String(d), c.agreement[d]])) } }), [s])
  const top = (probs: ArrayLike<number>) =>
    VOCABULARY.map((t, j) => ({ label: t, value: probs[j], color: kindOf(t) === 'verb' ? (verbOf(t)!.number === 'pl' ? 'var(--actuator)' : 'var(--sensor)') : 'var(--accent)' }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 12)
  const desc = s.descs
  const allowed = new Set(s.allowedNextOf(prompt))
  const parse = s.parseOf(prompt)
  const agreeColumns: Column[] = [
    { key: 'depth', label: 'relative clauses', mono: true },
    { key: 'counts', label: 'the prediction from counts', mono: true },
    { key: 'srn', label: 'the recurrent network', mono: true },
    { key: 'transformer', label: 'the transformer', mono: true },
  ]
  const all = s.training.length
  // The two forms are kept near one length, and the box is three lines tall, so nothing under it moves as the slider moves (Jon, 2026-11-20).
  const seenLine = cs.sentences < all ? `The count model at this snapshot: counts over the first ${cs.sentences.toLocaleString()} training sentences, the ones the networks had been trained on after ${updates.toLocaleString()} updates, at ${SENTENCES_PER_UPDATE} sentences per update.` : `The count model at this snapshot: counts over all ${all.toLocaleString()} training sentences, which the networks had been trained on by ${Math.ceil(all / SENTENCES_PER_UPDATE).toLocaleString()} updates. Later passes change nothing in a count, so from here on the count model is the same at every snapshot.`
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
        {models && agree && (
          <div data-snapshot={updates} style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
            <CurrentPrompt prompt={prompt} />
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }} data-prompt>
              {prompt.length > 0 && !parse.ok && <Note data-not-allowed>not a sentence the grammar allows</Note>}
              <Btn small onClick={() => s.removeLast5()} disabled={!prompt.length}>
                Remove the last token
              </Btn>
              <Btn small onClick={() => s.clearPrompt5()} disabled={!prompt.length}>
                Clear the prompt
              </Btn>
            </div>
            <PromptPalette tokens={s.palette} allowed={allowed} complete={parse.complete} promptAllowed={parse.ok} onAdd={(t) => s.addToken5(t)} />
            <Note data-count-seen style={{ minHeight: `${3 * 1.45}em` }}>
              {seenLine}
            </Note>
            {out && count && (
              <>
                <GroupLabel>The next token after the current prompt, at this snapshot</GroupLabel>
                <Note>The twelve most probable tokens from each predictor; plural verb forms green, singular orange, other tokens blue.</Note>
                <div style={{ display: 'flex', gap: GAP, flexWrap: 'wrap', alignItems: 'flex-start' }} data-distributions>
                  <div style={{ width: chartW, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }} data-distribution="counts">
                    <GroupLabel>The prediction from counts</GroupLabel>
                    <BarChart bars={top(count.probs)} width={chartW} max={1} format={(v) => v.toFixed(3)} rowH={12} testId="snap-counts" />
                    <CountNote c={count} />
                  </div>
                  <div style={{ width: chartW, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }} data-distribution="srn">
                    <GroupLabel>The recurrent network</GroupLabel>
                    <BarChart bars={top(out.srn.probs[out.srn.probs.length - 1])} width={chartW} max={1} format={(v) => v.toFixed(3)} rowH={12} testId="snap-srn" />
                  </div>
                  <div style={{ width: chartW, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }} data-distribution="transformer">
                    <GroupLabel>The transformer</GroupLabel>
                    <BarChart bars={top(out.transformer.probs[out.transformer.probs.length - 1])} width={chartW} max={1} format={(v) => v.toFixed(3)} rowH={12} testId="snap-transformer" />
                  </div>
                </div>
              </>
            )}
            <GroupLabel>Agreement by depth</GroupLabel>
            <LinePlot
              series={[
                { label: 'the prediction from counts', color: 'var(--actuator)', dashed: true, points: cs.agreement.map((v, d) => [d, 100 * v] as [number, number]) },
                { label: 'the recurrent network', color: 'var(--sensor)', points: agree.srn.map((v, d) => [d, 100 * v] as [number, number]) },
                { label: 'the transformer', color: 'var(--accent)', points: agree.transformer.map((v, d) => [d, 100 * v] as [number, number]) },
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
            <Note data-count-line>The dashed line is the prediction from counts over the sentences counted at this snapshot, by Step 3’s rule: from the two words before the verb, or from the one word before when those two never occurred together. From the third snapshot on, the dashed line is the same: the count model is finished after one pass through the training sentences, while the networks go on for about seventy.</Note>
            <DataTable columns={agreeColumns} rows={DEPTHS.map((d) => ({ depth: String(d), counts: pct(cs.agreement[d]), srn: pct(agree.srn[d]), transformer: pct(agree.transformer[d]) }))} rowHeader testId="agreement-table" footer={`At this snapshot, after ${updates.toLocaleString()} updates; the share of 50 probes at each depth.`} />
            {desc && (
              <>
                <GroupLabel>Every snapshot: three scores on the held-out and the training sentences, and agreement by depth on the probes</GroupLabel>
                <div style={{ display: 'flex', gap: GAP, flexWrap: 'wrap', alignItems: 'flex-start' }} data-all-snapshots>
                  <SnapshotsTable title="The count model" snapshots={countSnapshots} testId="all-snapshots-counts" />
                  <SnapshotsTable title="The recurrent network" snapshots={desc.srn.snapshots} testId="all-snapshots-srn" />
                  <SnapshotsTable title="The transformer" snapshots={desc.transformer.snapshots} testId="all-snapshots-transformer" />
                </div>
                <Note>{`The three scores are computed on the ${s.heldOut.length.toLocaleString()} held-out sentences, which no model learned from, and on the ${s.training.length.toLocaleString()} training sentences. Every token after a sentence’s first is predicted from the tokens before it. Agreement: over the verbs, the share for which the most probable verb form is in the number the subject requires. Right kind: the share for which the most probable token is of a kind the grammar allows there: a noun, a verb, ‹who› or the end mark. Exact: the share for which the most probable token is the very token that comes next. At most positions the grammar leaves many tokens equally possible, so no predictor can push the exact score far past 40%. The networks’ scores were measured when they were trained; the count model’s are computed here, by the same rule, from the sentences counted at each snapshot. The last four columns are the share of the 50 probes at each depth, as in the plot above. The grammar is small, so ${pct(0.635)} of the held-out sentences also occur among the training sentences; that holds for every predictor alike.`}</Note>
              </>
            )}
            <GroupLabel>Three planes: the count model’s numbers for each token, and the two networks’ at this snapshot</GroupLabel>
            <Note>Each plane shows the nouns and verbs as points, by a projection of one set of numbers onto its two directions of greatest difference. The first plane projects the count model’s lists of counts from Step 2, over the sentences counted at this snapshot. The second and third project each network’s output weights: for each token, the numbers the network multiplies its final state by to score that token as the next one, 64 for the recurrent network and 32 for the transformer. A token scores high when the network’s final state matches its weights, so the weights stand for the contexts the token comes after, as the count model’s list of the words before it does. Nouns blue, verbs orange. The directions are each plane’s own, so only the groupings compare across planes, not the positions.</Note>
            <div style={{ display: 'flex', gap: GAP, flexWrap: 'wrap', alignItems: 'flex-start' }} data-planes>
              <Plane title="The count model’s lists of counts" plane={countPlane} width={planeW} testId="count-plane" />
              {srnPlane && <Plane title="The recurrent network’s output weights" plane={srnPlane} width={planeW} testId="srn-outputs" />}
              {plane && <Plane title="The transformer’s output weights" plane={plane} width={planeW} testId="transformer-outputs" />}
            </div>
          </div>
        )}
      </div>
    </StagePanel>
  )
}
