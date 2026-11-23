import type { ReactNode } from 'react'
import { Btn, Content, DataTable, FixedLines, GroupLabel, Note, StagePanel, useRef, useWidth } from '../ui'
import { Dendrogram, Scatter } from '../plots'
import { ONE_CORPUS_LINE } from '../lines'
import { VOCABULARY, nounOf, verbOf } from '../../../sim/language/predictors/grammar'
import { clusterTree, embedding, nearest, principalPlane } from '../../../sim/language/predictors/counts'
import { reference } from '../../../sim/language/references'
import { ReferencePanel } from '../ReferencePanel'
import { CountTable, HeatLegend, SimilarityDemo, tableMax } from './CountTable'
import { STEP2_PANEL, TABLE_NOTE, VIEWS_TEXT } from './texts'
import { WindowFigure } from './WindowFigure'
import { PREDICTIONS, type PredictorsStore } from './store'

/**
 * Step 2's screens (spec §8.3; Jon, 2026-11-17: everything in the center).
 * In order down the panel: the prediction (which word lies closest to cat),
 * Count; the one table of counts as a heat map, filling as the count runs
 * (a token's row is what came before it, its column what came after it:
 * Jon, 2026-11-19, in place of two tables that were each other's transpose);
 * the similarity demo; the words as points on a plane; the nearest neighbors
 * of a word chosen from a menu (Jon, 2026-11-20); the tree of clusters as a dendrogram.
 * One similarity measure throughout: correlation. The window and the
 * two-list rule are fixed (store.ts says why); the settings were cut. The
 * texts are Jon's (2026-11-21), with the window figure between the two
 * opening paragraphs (`WindowFigure.tsx`).
 */
export function Step2Controls({ s }: { s: PredictorsStore }) {
  const committed = s.predicted('nearest')
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} data-step2-controls>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: 8, border: '1px solid var(--border)', borderRadius: 8, maxWidth: 520 }} data-predict="nearest">
        <GroupLabel>Predict first</GroupLabel>
        <Note>{PREDICTIONS.nearest.question}</Note>
        {committed ? (
          <FixedLines lines={[`Committed: ${committed}`]} mono={false} />
        ) : (
          <>
            <select value={s.drafts.nearest ?? ''} onChange={(e) => s.draft('nearest', e.target.value)} aria-label="Which word will lie closest to cat" style={{ alignSelf: 'flex-start' }}>
              <option value="">choose a noun</option>
              {s.nounChoices.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
            <div>
              <Btn primary onClick={() => s.commit('nearest')} disabled={!s.drafts.nearest}>
                Commit my prediction
              </Btn>
            </div>
          </>
        )}
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <Btn primary onClick={() => void s.count()} disabled={!committed || s.counting !== null}>
          Count
        </Btn>
        {s.counting && <Note data-counting>{`Counting: ${s.counting.done.toLocaleString()} of the ${s.tokens.length.toLocaleString()} tokens in the ${s.training.length.toLocaleString()} training sentences.`}</Note>}
      </div>
    </div>
  )
}

/** A block that measures its own width so that a plot can take the panel's room, between a floor and a ceiling. */
function FitWidth({ max, min = 300, children }: { max: number; min?: number; children: (width: number) => ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const w = useWidth(ref, max)
  return (
    <div ref={ref} style={{ width: '100%', minWidth: 0 }}>
      {children(Math.max(min, Math.min(max, w)))}
    </div>
  )
}

/** A noun's leaf color on the tree: people blue, animals orange, things green. */
const leafColor = (w: string) => {
  const n = nounOf(w)
  if (!n) return 'var(--text)'
  return n.spec.category === 'human' ? 'var(--accent)' : n.spec.category === 'animalLarge' || n.spec.category === 'animalSmall' ? 'var(--sensor)' : 'var(--actuator)'
}

export function Step2Stage({ s }: { s: PredictorsStore }) {
  const m = s.model
  const committed = s.predicted('nearest')
  const nouns = VOCABULARY.filter((t) => nounOf(t)).map((t) => VOCABULARY.indexOf(t))
  const words = nouns.concat(VOCABULARY.filter((t) => verbOf(t)).map((t) => VOCABULARY.indexOf(t)))
  const done = m && !s.counting
  const max = m ? tableMax(m) : 0
  const plane = done ? principalPlane(words.map((w) => embedding(m, w))) : null
  const tree = done ? clusterTree(nouns.map((w) => embedding(m, w))) : null
  const clicked = s.clicked ? VOCABULARY.indexOf(s.clicked) : -1
  const near = done && clicked >= 0 ? nearest(m, clicked, 5) : null
  return (
    <StagePanel wide testId="predictors-2">
      <div style={{ fontSize: 14, fontWeight: 600 }}>A count model</div>
      <Note style={{ color: 'var(--text)' }}>{STEP2_PANEL[0]}</Note>
      <WindowFigure tokens={s.tokens} windowSize={s.windowSize} />
      <Note style={{ color: 'var(--text)' }}>{STEP2_PANEL[1]}</Note>
      <Step2Controls s={s} />
      {!committed && <Note data-awaiting-commit>The table of counts, the similarity demonstration, the plane, the nearest neighbors, and the tree appear once you have committed your prediction above and pressed “Count”.</Note>}
      {m && (
        <>
          <GroupLabel>The table of counts, every token</GroupLabel>
          <Note>{`${TABLE_NOTE} ${s.counting ? 'The table is filling as the window moves along the corpus.' : 'The count is finished: the window has moved through the whole corpus.'}`}</Note>
          <HeatLegend max={max} />
          <CountTable m={m} which="before" max={max} testId="counts" />
          {done && <SimilarityDemo m={m} max={max} />}
        </>
      )}
      {done && plane && (
        <div data-reveal="counts" style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
          <GroupLabel>The words as points on a plane</GroupLabel>
          {VIEWS_TEXT.plane.map((p) => (
            <Note key={p.slice(0, 20)}>{p}</Note>
          ))}
          <FitWidth max={640}>{(w) => <Scatter width={w} height={Math.round(w * 0.58)} xLabel="first direction of greatest difference" yLabel="second direction" testId="plane" points={words.map((w, i) => ({ x: plane[i][0], y: plane[i][1], label: VOCABULARY[w], color: nounOf(VOCABULARY[w]) ? 'var(--accent)' : 'var(--sensor)' }))} />}</FitWidth>
          <GroupLabel>The nearest neighbors</GroupLabel>
          <Note>Choose a word from the menu to see its five nearest neighbors.</Note>
          <select value={s.clicked ?? ''} onChange={(e) => e.target.value && s.click(e.target.value)} aria-label="Nearest neighbors of" style={{ alignSelf: 'flex-start' }} data-word-menu>
            <option value="">choose a word</option>
            {words.map((w) => (
              <option key={w} value={VOCABULARY[w]}>
                {VOCABULARY[w]}
              </option>
            ))}
          </select>
          {near && (
            <>
              <GroupLabel>{`The five nearest neighbors of “${s.clicked}”`}</GroupLabel>
              <Note>{VIEWS_TEXT.neighbors}</Note>
              <DataTable testId="neighbors" columns={[{ key: 'rank', label: 'Rank', mono: true }, { key: 'word', label: 'Token', mono: true, align: 'left' }, { key: 'r', label: 'Correlation', mono: true }]} rows={near.map((n, i) => ({ rank: i + 1, word: VOCABULARY[n.word], r: n.similarity.toFixed(3) }))} />
            </>
          )}
          {committed && near && s.clicked === 'cat' && <Note data-nearest-cat>{`Your prediction for the word closest to “cat”: ${committed}. The nearest by this count: “${VOCABULARY[near[0].word]}”.`}</Note>}
          {committed && s.clicked !== 'cat' && <Note>Choose “cat” to see its nearest neighbor beside your prediction.</Note>}
          <GroupLabel>A tree of clusters</GroupLabel>
          <Note>{VIEWS_TEXT.tree}</Note>
          {tree && <FitWidth max={560}>{(w) => <Dendrogram tree={tree} labels={nouns.map((n) => VOCABULARY[n])} leafColor={(i) => leafColor(VOCABULARY[nouns[i]])} width={w} testId="tree" />}</FitWidth>}
          <ReferencePanel reference={reference('lund-1996')} />
        </div>
      )}
      <Content>{ONE_CORPUS_LINE}</Content>
    </StagePanel>
  )
}
