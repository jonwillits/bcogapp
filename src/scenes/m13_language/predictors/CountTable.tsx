import { Fragment } from 'react'
import { GroupLabel, Note } from '../ui'
import { correlation, embedding, type CountModel } from '../../../sim/language/predictors/counts'
import { SIMILARITY_TEXT } from './texts'

/**
 * Step 2's table of counts as a heat map (Jon, 2026-11-17): every word a row
 * and a column, the number printed in each cell, a warm background whose
 * strength grows with the square root of the count so that the few huge
 * counts do not wash out the rest, a word column that stays put while the
 * number columns scroll sideways, and a header row that stays put while the
 * rows scroll down. Not built from FixedLines; the scroll container has
 * `flexShrink: 0` so a capped column cannot squeeze it to nothing.
 *
 * Under the table, the similarity demo: ten words' lists as strips of heat
 * cells and the 10 × 10 matrix of their correlations, the one similarity
 * measure the step uses (Jon, 2026-11-20: two people, two small animals,
 * two foods, four verbs). The column labels sit at the right of their
 * cells, over the numbers (Jon, 2026-11-20).
 */

/** The share of the scale a count fills: the square root of its share of the largest count. */
export const heatShare = (v: number, max: number) => (max > 0 && v > 0 ? Math.sqrt(Math.min(1, v / max)) : 0)
/** A heat cell's background at a share of the scale: transparent at 0, a warm color growing to full strength. */
export const heatColor = (t: number) => (t > 0 ? `rgba(255, 128, 40, ${(0.08 + 0.9 * t).toFixed(3)})` : 'transparent')
/** The text color over a heat cell: dark over a strong cell, the usual color otherwise. */
export const heatText = (t: number) => (t > 0.6 ? '#0b111c' : 'var(--text)')
/** A correlation's background: warm above 0, blue below, stronger with its size. */
export const correlationColor = (r: number) => (r >= 0 ? `rgba(255, 128, 40, ${(0.9 * Math.min(1, r)).toFixed(3)})` : `rgba(80, 150, 255, ${(0.9 * Math.min(1, -r)).toFixed(3)})`)

/** The largest count in either table of a model. */
export function tableMax(m: CountModel): number {
  let max = 0
  for (let i = 0; i < m.vocab.length; i++) {
    for (let j = 0; j < m.vocab.length; j++) {
      if (m.before[i][j] > max) max = m.before[i][j]
      if (m.after[i][j] > max) max = m.after[i][j]
    }
  }
  return max
}

const CELL_W = 40
const HEAD_W = 80
const HEAD_H = 76
const STICKY_BG = 'var(--surface)'
const MONO = 'var(--font-mono)'

/** One table of counts: rows are words, columns are words, a cell is how much the column word occurred before (or after, or either side of) the row word. */
export function CountTable({ m, which, max, testId }: { m: CountModel; which: 'before' | 'after' | 'sum'; max: number; testId: string }) {
  const V = m.vocab
  const cell = (i: number, j: number) => (which === 'before' ? m.before[i][j] : which === 'after' ? m.after[i][j] : m.before[i][j] + m.after[i][j])
  return (
    <div data-count-table={testId} style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 440, maxWidth: '100%', minWidth: 0, flexShrink: 0, border: '1px solid var(--border)', borderRadius: 8, background: STICKY_BG }}>
      <table style={{ borderCollapse: 'separate', borderSpacing: 0, fontFamily: MONO, fontSize: 10.5, lineHeight: 1.3, tableLayout: 'fixed', width: HEAD_W + V.length * CELL_W }}>
        <thead>
          <tr>
            <th style={{ position: 'sticky', top: 0, left: 0, zIndex: 3, background: STICKY_BG, width: HEAD_W, minWidth: HEAD_W, textAlign: 'left', padding: '2px 6px', fontWeight: 400, color: 'var(--text-muted)', verticalAlign: 'bottom', borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)' }}>row word</th>
            {V.map((w) => (
              <th key={w} style={{ position: 'sticky', top: 0, zIndex: 2, background: STICKY_BG, width: CELL_W, minWidth: CELL_W, height: HEAD_H, padding: '2px 0', fontWeight: 400, color: 'var(--text)', verticalAlign: 'bottom', borderBottom: '1px solid var(--border)' }}>
                <div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', margin: '0 3px 0 auto', whiteSpace: 'nowrap' }}>{w}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {V.map((r, i) => (
            <tr key={r}>
              <th scope="row" style={{ position: 'sticky', left: 0, zIndex: 1, background: STICKY_BG, textAlign: 'left', padding: '0 6px', fontWeight: 400, color: 'var(--text)', borderRight: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                {r}
              </th>
              {V.map((c, j) => {
                const v = cell(i, j)
                const t = heatShare(v, max)
                return (
                  <td key={c} style={{ width: CELL_W, minWidth: CELL_W, padding: '0 3px', textAlign: 'right', background: heatColor(t), color: v === 0 ? 'var(--text-muted)' : heatText(t), whiteSpace: 'nowrap' }}>
                    {Math.round(v)}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** What the colors mean: swatches from 0 to the largest count, and the scale's rule. */
export function HeatLegend({ max }: { max: number }) {
  const shares = [0, 0.04, 0.16, 0.36, 0.64, 1]
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }} data-heat-legend>
      <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Count:</span>
      {shares.map((f) => (
        <span key={f} style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
          <span style={{ width: 14, height: 12, background: heatColor(Math.sqrt(f)), border: '1px solid var(--border)', display: 'inline-block' }} />
          <span style={{ fontSize: 10.5, fontFamily: MONO, color: 'var(--text-muted)' }}>{Math.round(f * max).toLocaleString()}</span>
        </span>
      ))}
      <Note>{`The color grows with the square root of the count, from 0 to ${Math.round(max).toLocaleString()}, the largest count in the table, so the few huge counts do not wash out the rest.`}</Note>
    </div>
  )
}

/** The ten words of the similarity demo (Jon, 2026-11-20): two people, two small animals, two foods, two intransitive verbs, two transitive-or-optional verbs. */
export const DEMO_WORDS = ['boy', 'girl', 'mouse', 'bird', 'cookie', 'sandwich', 'walks', 'sleeps', 'chases', 'sees']

/** The similarity demo: each word's list of counts as a strip of heat cells, then the matrix of correlations. */
export function SimilarityDemo({ m, max, words = DEMO_WORDS }: { m: CountModel; max: number; words?: string[] }) {
  const V = m.vocab
  const lists = words.map((w) => embedding(m, V.indexOf(w)))
  const n = lists[0]?.length ?? 0
  const corr = lists.map((a) => lists.map((b) => correlation(a, b)))
  return (
    <div data-similarity-demo style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0, minWidth: 0 }}>
      <GroupLabel>How the similarity of two words is computed</GroupLabel>
      {SIMILARITY_TEXT.map((p) => (
        <Note key={p.slice(0, 12)} style={{ color: 'var(--text)' }}>
          {p}
        </Note>
      ))}
      <div style={{ display: 'grid', gridTemplateColumns: 'max-content minmax(0, 1fr)', gap: '4px 8px', alignItems: 'center' }} data-demo-strips>
        {words.map((w, k) => (
          <Fragment key={w}>
            <span style={{ fontFamily: MONO, fontSize: 11 }}>{w}</span>
            <svg width="100%" height={14} viewBox={`0 0 ${Math.max(1, n)} 1`} preserveAspectRatio="none" shapeRendering="crispEdges" style={{ display: 'block', background: 'var(--bg)', border: '1px solid var(--border)' }} data-strip={w}>
              {Array.from(lists[k]).map((v, i) => {
                const t = heatShare(v, max)
                return t > 0 ? <rect key={i} x={i} y={0} width={1} height={1} fill={heatColor(t)} /> : null
              })}
              {m.separate && <line x1={V.length} y1={0} x2={V.length} y2={1} stroke="var(--text)" strokeWidth={1} vectorEffect="non-scaling-stroke" />}
            </svg>
          </Fragment>
        ))}
      </div>
      <Note>{`Each strip is one word’s whole list of ${n} counts, one cell per count, in the order of the table’s columns${m.separate ? ': the counts of the words before, then, after the mark, the counts of the words after' : ''}, in the table’s colors, shrunk to fit the width.`}</Note>
      <table data-demo-matrix style={{ borderCollapse: 'separate', borderSpacing: 0, fontFamily: MONO, fontSize: 11, alignSelf: 'flex-start' }}>
        <thead>
          <tr>
            <th />
            {words.map((w) => (
              <th key={w} style={{ padding: '2px 8px', fontWeight: 400, color: 'var(--text-muted)', textAlign: 'right' }}>
                {w}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {words.map((w, a) => (
            <tr key={w}>
              <th scope="row" style={{ textAlign: 'right', padding: '2px 8px', fontWeight: 400, color: 'var(--text-muted)' }}>
                {w}
              </th>
              {words.map((u, b) => {
                const r = corr[a][b]
                return (
                  <td key={u} style={{ padding: '2px 8px', textAlign: 'right', background: correlationColor(r), color: Math.abs(r) > 0.6 ? '#0b111c' : 'var(--text)', border: '1px solid var(--border)' }} data-corr={`${w} ${u}`}>
                    {r.toFixed(2)}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <Note>The matrix: the correlation of each pair of lists, to two decimals. A warm cell is above 0 and a blue cell below, the darker the stronger; the diagonal is each word with itself, 1.00.</Note>
    </div>
  )
}
