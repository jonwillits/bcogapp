import { Fragment } from 'react'
import { Note } from '../ui'
import { VOCABULARY, END } from '../../../sim/language/predictors/grammar'
import { heatColor, heatShare } from './CountTable'

/**
 * Step 2's picture of one step of the count (Jon, 2026-11-21): at the left,
 * a stretch of the corpus with the window around it, the target at the
 * window's right end, and over each earlier token what this step adds to
 * its count with the target (the window size minus the distance plus one,
 * as counts.ts counts); at the right, the matrix's rows and columns for
 * those tokens and one more, every cell 0 but the ones this step adds to,
 * in the target's row. The stretch is the first place in the corpus where
 * the window holds no end mark, so that the picture is one sentence's.
 */
export const WINDOW_FIGURE_CAPTION = 'Left: the window at one place in the corpus, 4 tokens wide, with its target at the right end; above each earlier token, what this step adds to the count of that token with the target: 4 for the neighbor, down to 1 at the window’s far edge. Right: the rows and columns of the matrix for those tokens and one more, with every cell 0 except the ones this step adds to, in the target’s row.'

const MONO = 'var(--font-mono)'

export function WindowFigure({ tokens, windowSize }: { tokens: readonly number[]; windowSize: number }) {
  const end = VOCABULARY.indexOf(END)
  let target = Math.min(windowSize, Math.max(0, tokens.length - 1))
  for (let i = windowSize; i < tokens.length; i++) {
    let ok = true
    for (let d = 0; d <= windowSize; d++) if (tokens[i - d] === end) ok = false
    if (ok) {
      target = i
      break
    }
  }
  if (tokens.length === 0) return null
  const from = Math.max(0, target - windowSize - 2)
  const to = Math.min(tokens.length, target + 3)
  const shown = Array.from({ length: to - from }, (_, k) => from + k)
  const weightOf = (i: number) => (i < target && target - i <= windowSize ? windowSize - (target - i) + 1 : 0)
  // What this step adds: by token, summed where a token occurs twice in the window.
  const added = new Map<number, number>()
  for (let i = target - windowSize; i < target; i++) if (i >= 0) added.set(tokens[i], (added.get(tokens[i]) ?? 0) + weightOf(i))
  const sample: number[] = [tokens[target]]
  for (let i = target - windowSize; i < target; i++) if (i >= 0 && !sample.includes(tokens[i])) sample.push(tokens[i])
  const other = shown.map((i) => tokens[i]).find((t) => !sample.includes(t))
  if (other !== undefined) sample.push(other)
  const maxAdded = Math.max(1, ...added.values())
  const tile = (strong: boolean) => ({ fontFamily: MONO, fontSize: 11.5, padding: '2px 6px', border: `1px solid ${strong ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 4, background: strong ? 'var(--surface-2)' : 'transparent', color: 'var(--text)', whiteSpace: 'nowrap' as const, display: 'inline-block' })
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }} data-window-figure>
      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }} data-window-strip>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>a stretch of the corpus, with the window</span>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4 }}>
            {shown.map((i) => {
              const w = weightOf(i)
              const inWindow = w > 0 || i === target
              const first = i === target - windowSize
              return (
                <Fragment key={i}>
                  {first && <span style={{ alignSelf: 'stretch', borderLeft: '2px solid var(--accent)', marginLeft: 2 }} />}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }} data-figure-token={VOCABULARY[tokens[i]]} data-adds={w || undefined} data-target={i === target || undefined}>
                    <span style={{ fontFamily: MONO, fontSize: 11, color: w ? 'var(--accent)' : 'transparent', fontWeight: 600 }}>{w ? `+${w}` : '+0'}</span>
                    <span style={tile(inWindow)}>{VOCABULARY[tokens[i]]}</span>
                    <span style={{ fontSize: 10, color: i === target ? 'var(--accent)' : 'transparent', fontWeight: 600 }}>target</span>
                  </div>
                  {i === target && <span style={{ alignSelf: 'stretch', borderLeft: '2px solid var(--accent)', marginRight: 2 }} />}
                </Fragment>
              )
            })}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }} data-window-matrix>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>the matrix: the row token came after the column token</span>
          <table style={{ borderCollapse: 'separate', borderSpacing: 0, fontFamily: MONO, fontSize: 11 }}>
            <thead>
              <tr>
                <th style={{ padding: '2px 6px', fontWeight: 400, color: 'var(--text-muted)', textAlign: 'right' }}>row \ column</th>
                {sample.map((t) => (
                  <th key={t} style={{ padding: '2px 6px', fontWeight: 400, color: 'var(--text-muted)', textAlign: 'right' }}>
                    {VOCABULARY[t]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sample.map((r) => (
                <tr key={r}>
                  <th scope="row" style={{ padding: '2px 6px', fontWeight: r === tokens[target] ? 600 : 400, color: r === tokens[target] ? 'var(--accent)' : 'var(--text-muted)', textAlign: 'right' }}>
                    {VOCABULARY[r]}
                  </th>
                  {sample.map((c) => {
                    const v = r === tokens[target] ? (added.get(c) ?? 0) : 0
                    const t = heatShare(v, maxAdded)
                    return (
                      <td key={c} style={{ padding: '2px 6px', textAlign: 'right', border: '1px solid var(--border)', background: heatColor(t), color: v ? '#0b111c' : 'var(--text-muted)' }} data-cell={`${VOCABULARY[r]} ${VOCABULARY[c]}`}>
                        {v ? `+${v}` : '0'}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <Note>{WINDOW_FIGURE_CAPTION}</Note>
    </div>
  )
}
