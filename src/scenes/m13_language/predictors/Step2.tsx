import type { ReactNode } from 'react'
import { Btn, Choice, Content, DataTable, FixedLines, GroupLabel, Note, StagePanel, useRef, useWidth } from '../ui'
import { Dendrogram, Scatter } from '../plots'
import { ONE_CORPUS_LINE } from '../lines'
import { VOCABULARY, nounOf, verbOf } from '../../../sim/language/predictors/grammar'
import { clusterTree, embedding, nearest, principalPlane } from '../../../sim/language/predictors/counts'
import { reference } from '../../../sim/language/references'
import { ReferencePanel } from '../ReferencePanel'
import { CountTable, HeatLegend, SimilarityDemo, tableMax } from './CountTable'
import { STEP2_PANEL, VIEWS_TEXT } from './texts'
import { PREDICTIONS, type PredictorsStore } from './store'

/**
 * Step 2's screens (spec §8.3; Jon, 2026-11-17: everything in the center).
 * In order down the panel: the prediction (which word lies closest to cat),
 * Count; the one table of counts as a heat map, filling as the count runs
 * (a token's row is what came before it, its column what came after it:
 * Jon, 2026-11-19, in place of two tables that were each other's transpose);
 * the similarity demo; the words as points on a plane; the nearest neighbors
 * of a word whose name is pressed; the tree of clusters as a dendrogram.
 * One similarity measure throughout: correlation. The window and the
 * two-list rule are fixed (store.ts says why); the settings were cut.
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
        {s.counting && <Note data-counting>{`Counting: ${s.counting.done.toLocaleString()} of ${s.tokens.length.toLocaleString()} tokens.`}</Note>}
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
      {STEP2_PANEL.map((p) => (
        <Note key={p.slice(0, 12)} style={{ color: 'var(--text)' }}>
          {p}
        </Note>
      ))}
      <Step2Controls s={s} />
      {!committed && <Note data-awaiting-commit>The table of counts, the demo, the plane, the tree, and the nearest neighbors appear once your prediction above is committed and “Count” has run.</Note>}
      {m && (
        <>
          <GroupLabel>The table of counts, every token</GroupLabel>
          <Note>{`Each row is a token and each column another token. A cell is how often the row token came after the column token within the window, added up over the corpus with the window’s weights. So a token’s row is its counts of the tokens before it, and its column, read down, is its counts of the tokens after it. The table is wider than the panel: it scrolls sideways inside its own frame, and the column of row tokens stays put. ${s.counting ? 'The table is filling as the window moves along the corpus.' : 'The window has run through the whole corpus.'}`}</Note>
          <HeatLegend max={max} />
          <CountTable m={m} which="before" max={max} testId="counts" />
          {done && <SimilarityDemo m={m} max={max} />}
        </>
      )}
      {done && plane && (
        <div data-reveal="counts" style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
          <GroupLabel>The words as points on a plane</GroupLabel>
          <Note>{VIEWS_TEXT.plane} Nouns blue, verbs orange.</Note>
          <FitWidth max={640}>{(w) => <Scatter width={w} height={Math.round(w * 0.58)} xLabel="first direction of greatest difference" yLabel="second direction" testId="plane" points={words.map((w, i) => ({ x: plane[i][0], y: plane[i][1], label: VOCABULARY[w], color: nounOf(VOCABULARY[w]) ? 'var(--accent)' : 'var(--sensor)' }))} />}</FitWidth>
          <GroupLabel>The nearest neighbors</GroupLabel>
          <Note>Press a word’s name to see its five nearest neighbors.</Note>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }} data-word-buttons>
            <Choice value={s.clicked} options={words.map((w) => ({ id: VOCABULARY[w], label: VOCABULARY[w] }))} onChange={(w) => s.click(w)} />
          </div>
          {near && (
            <>
              <GroupLabel>{`The five nearest neighbors of ${s.clicked}`}</GroupLabel>
              <Note>{VIEWS_TEXT.neighbors}</Note>
              <DataTable testId="neighbors" columns={[{ key: 'rank', label: 'Rank', mono: true }, { key: 'word', label: 'Token', mono: true, align: 'left' }, { key: 'r', label: 'Correlation', mono: true }]} rows={near.map((n, i) => ({ rank: i + 1, word: VOCABULARY[n.word], r: n.similarity.toFixed(3) }))} />
            </>
          )}
          {committed && near && s.clicked === 'cat' && <Note data-nearest-cat>{`Your prediction for the word closest to cat: ${committed}. The nearest by this count: ${VOCABULARY[near[0].word]}.`}</Note>}
          {committed && s.clicked !== 'cat' && <Note>Press cat to see its nearest neighbor beside your prediction.</Note>}
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
