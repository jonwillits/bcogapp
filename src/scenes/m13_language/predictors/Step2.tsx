import { Btn, Choice, Content, FixedLines, GroupLabel, Note, StagePanel } from '../ui'
import { Scatter } from '../plots'
import { ONE_CORPUS_LINE } from '../lines'
import { VOCABULARY, nounOf, verbOf } from '../../../sim/language/predictors/grammar'
import { clusterTree, embedding, nearest, principalPlane, type Cluster } from '../../../sim/language/predictors/counts'
import { reference } from '../../../sim/language/references'
import { ReferencePanel } from '../ReferencePanel'
import { STEP2_PANEL, VIEWS_TEXT } from './texts'
import { PREDICTIONS, TEN_WORDS, type PredictorsStore } from './store'

/**
 * Step 2's screens (spec §8.3): the two settings, the prediction (which
 * word lies closest to cat), Count, the table of counts filling for ten
 * chosen words, and three views: the plane, the tree, and the nearest
 * neighbors of a clicked word.
 */
export function Step2Controls({ s }: { s: PredictorsStore }) {
  const committed = s.predicted('nearest')
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} data-step2-controls>
      <GroupLabel>Window size</GroupLabel>
      <input type="range" min={1} max={8} step={1} value={s.windowSize} onChange={(e) => s.setWindow(Number(e.target.value))} aria-label="Window size" style={{ width: '100%' }} />
      <FixedLines lines={[`${s.windowSize} word${s.windowSize === 1 ? '' : 's'}`]} />
      <label style={{ fontSize: 12, display: 'flex', gap: 6, alignItems: 'center' }}>
        <input type="checkbox" checked={s.separate} onChange={(e) => s.setSeparate(e.target.checked)} /> Count words before and after separately
      </label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: 8, border: '1px solid var(--border)', borderRadius: 8 }} data-predict="nearest">
        <GroupLabel>Predict first</GroupLabel>
        <Note>{PREDICTIONS.nearest.question}</Note>
        {committed ? (
          <FixedLines lines={[`Committed: ${committed}`]} mono={false} />
        ) : (
          <>
            <select value={s.drafts.nearest ?? ''} onChange={(e) => s.draft('nearest', e.target.value)} aria-label="Which word will lie closest to cat">
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
      <div>
        <Btn primary onClick={() => void s.count()} disabled={!committed || s.counting !== null}>
          Count
        </Btn>
      </div>
      {s.counting && <Note data-counting>{`Counting: ${s.counting.done.toLocaleString()} of ${s.tokens.length.toLocaleString()} tokens.`}</Note>}
    </div>
  )
}

function TreeView({ tree, labels, x = 0, depth = 0, maxH }: { tree: Cluster; labels: string[]; x?: number; depth?: number; maxH: number }) {
  // A simple text rendering of the dendrogram: nested lines, indented by depth, with the join height.
  const lines: string[] = []
  const walk = (c: Cluster, d: number) => {
    if (!c.children) {
      lines.push(`${'  '.repeat(d)}${labels[c.members[0]]}`)
      return
    }
    lines.push(`${'  '.repeat(d)}join at ${c.height.toFixed(2)}:`)
    walk(c.children[0], d + 1)
    walk(c.children[1], d + 1)
  }
  walk(tree, depth)
  void x
  void maxH
  return <FixedLines lines={lines} testId="tree" />
}

export function Step2Stage({ s }: { s: PredictorsStore }) {
  const m = s.model
  const ids = TEN_WORDS.map((w) => VOCABULARY.indexOf(w))
  const committed = s.predicted('nearest')
  const nouns = VOCABULARY.filter((t) => nounOf(t)).map((t) => VOCABULARY.indexOf(t))
  const words = nouns.concat(VOCABULARY.filter((t) => verbOf(t)).map((t) => VOCABULARY.indexOf(t)))
  const done = m && !s.counting
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
      {!committed && <Note data-awaiting-commit>The counts, the views, and the nearest neighbors appear once your prediction is committed on the left and “Count” has run.</Note>}
      {m && (
        <>
          <GroupLabel>The table of counts, for ten words</GroupLabel>
          <Note>{`Each row is a word and each column another word; a cell is how much the column word occurred ${s.separate ? 'before the row word (the first table) or after it (the second)' : 'within the window of the row word, before or after'}. ${s.counting ? 'The table is filling as the window moves along the corpus.' : 'The window has run through the whole corpus.'}`}</Note>
          <FixedLines lines={['        ' + TEN_WORDS.map((w) => w.padStart(7)).join(''), ...ids.map((r, i) => `${TEN_WORDS[i].padEnd(8)}${ids.map((c) => String(Math.round(m.before[r][c] + (s.separate ? 0 : m.after[r][c]))).padStart(7)).join('')}`)]} testId="counts-before" />
          {s.separate && <FixedLines lines={['after:  ' + TEN_WORDS.map((w) => w.padStart(7)).join(''), ...ids.map((r, i) => `${TEN_WORDS[i].padEnd(8)}${ids.map((c) => String(Math.round(m.after[r][c])).padStart(7)).join('')}`)]} testId="counts-after" />}
        </>
      )}
      {done && plane && (
        <div data-reveal="counts" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <GroupLabel>The words as points on a plane</GroupLabel>
          <Note>{VIEWS_TEXT.plane} Click a word in any view to see its five nearest neighbors.</Note>
          <Scatter width={620} height={360} xLabel="first direction of greatest difference" yLabel="second direction" testId="plane" points={words.map((w, i) => ({ x: plane[i][0], y: plane[i][1], label: VOCABULARY[w], color: nounOf(VOCABULARY[w]) ? 'var(--accent)' : 'var(--sensor)' }))} />
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }} data-word-buttons>
            <Choice value={s.clicked} options={words.map((w) => ({ id: VOCABULARY[w], label: VOCABULARY[w] }))} onChange={(w) => s.click(w)} />
          </div>
          {near && (
            <>
              <GroupLabel>{`The five nearest neighbors of ${s.clicked}`}</GroupLabel>
              <Note>{VIEWS_TEXT.neighbors}</Note>
              <FixedLines lines={near.map((n, i) => `${i + 1}. ${VOCABULARY[n.word].padEnd(10)} similarity ${n.similarity.toFixed(3)}`)} testId="neighbors" />
            </>
          )}
          {committed && near && s.clicked === 'cat' && <Note data-nearest-cat>{`Your prediction for the word closest to cat: ${committed}. The nearest by this count: ${VOCABULARY[near[0].word]}.`}</Note>}
          {committed && s.clicked !== 'cat' && <Note>Click cat to see its nearest neighbor beside your prediction.</Note>}
          <GroupLabel>A tree of clusters</GroupLabel>
          <Note>{VIEWS_TEXT.tree}</Note>
          {tree && <TreeView tree={tree} labels={nouns.map((w) => VOCABULARY[w])} maxH={tree.height} />}
          <ReferencePanel reference={reference('lund-1996')} />
        </div>
      )}
      <Content>{ONE_CORPUS_LINE}</Content>
    </StagePanel>
  )
}
