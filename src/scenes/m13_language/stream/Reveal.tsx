import type { ReactNode } from 'react'
import { Content, DataTable, FixedLines, Note, Para, Section } from '../ui'
import { ReferencePanel } from '../ReferencePanel'
import { reference } from '../../../sim/language/references'
import { streamFor, SYLLABLES, WORDS, wordAverageTp, type Stream } from '../../../sim/language/stream/language'
import { boardSyllables, tpTableOf, ROW } from '../../../sim/language/stream/board'
import { RESTARTED_LINE } from '../lines'
import { Tile } from './Strip'
import type { BoardResult, MinuteResult } from './store'

/**
 * Part 2's reveals (spec §6.1, §6.2): Step 1's after the commit (the
 * student's answer beside the number of words, and the typed words; Jon,
 * 2026-11-21: no word is named here, and the replays wait for Step 2), and
 * Step 2's results in numbered sections once the search has ended (the 300
 * syllables printed and divided into words, the two replays of the minute
 * with the lengthening experiment, the order the words were found in, the
 * table of transitional probabilities with the within-word cells shaded,
 * and each word's average beside the original's finding). None says what to
 * conclude. Each has two modes: `full` on the step, with the explanation,
 * the replays and the references; `results` on the All Results tab, the
 * sections with their one-sentence descriptions only (Jon, 2026-11-18).
 */
export type RevealMode = 'full' | 'results'

export function MinuteReveal({ result, mode = 'full' }: { result: MinuteResult; mode?: RevealMode }) {
  const full = mode === 'full'
  const typed = result.typed ? result.typed.split(/[\s,;]+/).filter(Boolean) : []
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }} data-reveal="minute">
      {result.restarts > 0 && <Content>{RESTARTED_LINE}</Content>}
      <Section n={1} title="Your answer beside the language">
        <FixedLines lines={[`You answered: ${result.guess} ${result.guess === 1 ? 'word' : 'words'}.`, 'The language has 6 words.', `Words you typed: ${typed.length ? typed.join(', ') : 'none'}.`]} mono={false} testId="answer-truth" />
        {full && <Note>Which syllables make up the words is for Step 2 to find. The minute can be heard again, with its words marked, once Step 2 is done.</Note>}
      </Section>
    </div>
  )
}

/** The first 300 syllables of the stream as tiles, 20 to a row, each word filled with its color: the step's result once the search has ended. */
export function PrintedStream({ stream }: { stream: Stream }) {
  const board = boardSyllables(stream)
  const rows: number[][] = []
  for (let i = 0; i < board.length; i += ROW) rows.push(board.slice(i, i + ROW).map((_, k) => i + k))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }} data-printed-stream>
      {rows.map((row, r) => (
        <div key={r} style={{ display: 'flex', gap: 3 }} data-row={r}>
          {row.map((i) => (
            <Tile key={i} text={board[i]} word={stream.words[stream.wordIndex[i]]} />
          ))}
        </div>
      ))}
    </div>
  )
}

export function BoardReveal({ seed, result, mode = 'full', replays }: { seed: number; result: BoardResult; mode?: RevealMode; replays?: ReactNode }) {
  const full = mode === 'full'
  const stream = streamFor(seed, 1512)
  const { table, within } = tpTableOf(stream)
  const avgs = WORDS.map((w) => ({ word: w, avg: wordAverageTp(table, w) })).sort((a, b) => b.avg - a.avg)
  const foundOrder = result.found.filter((f) => f.how === 'found').map((f) => f.word)
  const rank = avgs.map((a) => a.word)
  let n = 0
  const next = () => ++n
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }} data-reveal="board">
      <Section n={next()} title="The 300 syllables, divided into words">
        <Para>These are the syllables the counts came from, in the order they are spoken, 20 to a row; a row break means nothing. Each word is filled with its own color, whether you found it or it was shown. Click a syllable in the palette above to see its counts.</Para>
        <PrintedStream stream={stream} />
      </Section>
      {full && replays && (
        <Section n={next()} title="The minute of Step 1, again">
          {replays}
        </Section>
      )}
      <Section n={next()} title="The six words, in the order you found them">
        <Para>One row per word: its place in your order, how many words you checked before it, and whether you found it or it was shown by “Show me the words”.</Para>
        <DataTable testId="found-order" columns={[{ key: 'n', label: 'Order', mono: true }, { key: 'word', label: 'Word', mono: true, align: 'left' }, { key: 'checks', label: 'Checked before it', mono: true }, { key: 'how', label: 'Found or shown' }]} rows={result.found.map((f, i) => ({ n: i + 1, word: f.word, checks: f.checksBefore, how: f.how }))} />
        <Note>{`You checked ${result.checks.length} ${result.checks.length === 1 ? 'word' : 'words'} and clicked ${result.clicks.length} ${result.clicks.length === 1 ? 'syllable' : 'syllables'}.`}</Note>
      </Section>
      <Section n={next()} title="The table of transitional probabilities">
        <Para>These are computed from your whole 21-minute stream of 4,536 syllables. Each row is a first syllable and each column the syllable after it. A cell is the count of that pair divided by the count of the first syllable. The shaded cells are pairs inside one of the six words.</Para>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', fontFamily: 'var(--font-mono)', fontSize: 10.5 }} data-tp-table>
            <thead>
              <tr>
                <th style={{ padding: 2 }}></th>
                <th colSpan={SYLLABLES.length} style={{ padding: 2, color: 'var(--text-muted)', fontWeight: 400, fontFamily: 'inherit' }}>
                  the syllable after
                </th>
              </tr>
              <tr>
                <th style={{ padding: 2, color: 'var(--text-muted)', fontWeight: 400, textAlign: 'right' }}>first syllable</th>
                {SYLLABLES.map((b) => (
                  <th key={b} style={{ padding: 2, color: 'var(--text-muted)', fontWeight: 400 }}>
                    {b}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SYLLABLES.map((a, i) => (
                <tr key={a}>
                  <th style={{ padding: 2, color: 'var(--text-muted)', fontWeight: 400, textAlign: 'right' }}>{a}</th>
                  {SYLLABLES.map((b, j) => (
                    <td key={b} data-within={within[i][j] || undefined} style={{ padding: '2px 3px', textAlign: 'right', background: within[i][j] ? 'rgba(79,156,255,0.25)' : undefined, color: table[i][j] === 0 ? 'var(--text-muted)' : 'var(--text)' }}>
                      {table[i][j] === 0 ? '·' : table[i][j].toFixed(2)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
      <Section n={next()} title="Each word’s average transitional probability inside it">
        <Para>For each word, the mean of its two transitional probabilities from the table, from highest to lowest, and beside it where the word fell in the order you found them. A word that was shown has no place.</Para>
        {full && <Para>The original study’s authors split the six words this way and found that the three words with the highest average transitional probabilities were learned better than the three with the lowest, 79% against 72% (p. 614).</Para>}
        <DataTable testId="word-averages" columns={[{ key: 'rank', label: 'Rank', mono: true }, { key: 'word', label: 'Word', mono: true, align: 'left' }, { key: 'avg', label: 'Average transitional probability', mono: true }, { key: 'yours', label: 'Where you found it' }]} rows={avgs.map((a, i) => ({ rank: i + 1, word: a.word, avg: a.avg.toFixed(2), yours: foundOrder.includes(a.word) ? `found ${foundOrder.indexOf(a.word) + 1}${['st', 'nd', 'rd'][foundOrder.indexOf(a.word)] ?? 'th'}` : 'shown' }))} />
        <Note data-ranking>{foundOrder.length >= 2 ? `The three words with the highest average transitional probability are ${rank.slice(0, 3).join(', ')}. Of the first ${Math.min(3, foundOrder.length)} words you found, ${foundOrder.filter((w) => rank.slice(0, 3).includes(w)).length} ${foundOrder.filter((w) => rank.slice(0, 3).includes(w)).length === 1 ? 'was' : 'were'} among them.` : 'You found fewer than two words, so there is no order to compare.'}</Note>
        {full && <ReferencePanel reference={reference('saffran-high-low')} />}
      </Section>
    </div>
  )
}
