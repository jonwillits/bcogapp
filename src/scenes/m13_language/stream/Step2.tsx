import { useState } from 'react'
import { Btn, Content, FixedLines, GroupLabel, Note, StagePanel } from '../ui'
import { COUNTS_FROM_YOUR_STREAM_LINE } from '../lines'
import { SYLLABLES, type Syllable } from '../../../sim/language/stream/language'
import { coloring, neighbors, uncovered, ROW, TRAY_MAX, TRAY_MIN } from '../../../sim/language/stream/board'
import { Tile } from './Strip'
import type { StreamStore } from './store'

/**
 * Step 2's board (spec §6.2; decision 8): 300 tiles in rows of 20, a click
 * highlighting every instance of a syllable, a tray built by dragging tiles
 * from the board or the palette (or by clicking a palette tile, which does
 * the same), Check this word, Empty the tray, Show me the words behind an
 * in-page confirmation, and the counter of syllables not yet in a found
 * word. The panel of counts is in `Step2Panel`.
 */
export function Step2Stage({ s }: { s: StreamStore }) {
  const board = s.boardSyllables
  const colors = coloring(board, s.foundWords)
  const [over, setOver] = useState(false)
  const rows: number[][] = []
  for (let i = 0; i < board.length; i += ROW) rows.push(board.slice(i, i + ROW).map((_, k) => i + k))
  const drag = (s0: Syllable) => (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', s0)
    e.dataTransfer.effectAllowed = 'copy'
  }
  const ended = s.board.ended
  return (
    <StagePanel wide testId="stream-2">
      <div style={{ fontSize: 14, fontWeight: 600 }}>Find the words</div>
      <Note>The first 300 syllables of your stream, in the order they are spoken, 20 to a row. A row break means nothing. Click a tile to highlight its syllable everywhere; drag tiles into the tray to build a word.</Note>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }} data-board>
        {rows.map((row, r) => (
          <div key={r} style={{ display: 'flex', gap: 3 }} data-row={r}>
            {row.map((i) => (
              <Tile key={i} text={board[i]} word={colors[i]} highlighted={s.highlight === board[i]} onClick={() => s.clickTile(board[i])} draggable={!ended} onDragStart={drag(board[i])} />
            ))}
          </div>
        ))}
      </div>
      <FixedLines lines={[`Syllables not yet in a found word: ${String(uncovered(board, s.foundWords)).padStart(3)} of 300`]} testId="uncovered" />
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <Btn small onClick={() => s.clearHighlight()} disabled={s.highlight === null}>
          Clear the highlight
        </Btn>
        <Note>{s.highlight ? `Highlighted: every ${s.highlight} on the board.` : 'No syllable is highlighted.'}</Note>
      </div>
      <GroupLabel>The palette: the language’s 12 syllables</GroupLabel>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }} data-palette>
        {SYLLABLES.map((syl) => (
          <Tile key={syl} text={syl} draggable={!ended} onDragStart={drag(syl)} onClick={ended ? undefined : () => s.addToTray(syl)} title="Drag into the tray, or click to add" />
        ))}
      </div>
      <GroupLabel>The tray</GroupLabel>
      <div
        data-tray
        data-over={over || undefined}
        onDragOver={(e) => {
          if (ended || s.tray.length >= TRAY_MAX) return
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setOver(false)
          const syl = e.dataTransfer.getData('text/plain') as Syllable
          if ((SYLLABLES as readonly string[]).includes(syl)) s.addToTray(syl)
        }}
        style={{ minHeight: 40, display: 'flex', gap: 4, alignItems: 'center', padding: 6, border: `2px dashed ${over ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 8 }}
      >
        {s.tray.length === 0 && <Note>Drag {TRAY_MIN} to {TRAY_MAX} tiles here. Click a tile in the tray to take it out.</Note>}
        {s.tray.map((syl, i) => (
          <Tile key={i} text={syl} onClick={() => s.removeFromTray(i)} title="Click to take this tile out of the tray" />
        ))}
      </div>
      <FixedLines lines={[s.tray.length ? `These ${s.tray.length} syllable${s.tray.length === 1 ? '' : 's'} occur together, in this order, ${s.trayOccurrences} time${s.trayOccurrences === 1 ? '' : 's'} in the printed stream.` : 'The tray is empty.']} mono={false} testId="tray-count" />
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <Btn primary onClick={() => s.checkTray()} disabled={ended || s.tray.length < TRAY_MIN}>
          Check this word
        </Btn>
        <Btn onClick={() => s.emptyTray()} disabled={s.tray.length === 0}>
          Empty the tray
        </Btn>
        {s.lastCheck && <Note data-check-result>{s.lastCheck === 'word' ? 'This is one of the language’s words. Every instance of it on the board is now filled with its color.' : 'This is not one of the language’s words.'}</Note>}
      </div>
      <Content>{COUNTS_FROM_YOUR_STREAM_LINE}</Content>
      {!ended && !s.confirmingShow && (
        <div>
          <Btn onClick={() => s.askShow(true)}>Show me the words</Btn>
        </div>
      )}
      {!ended && s.confirmingShow && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 8, border: '1px solid var(--avoid)', borderRadius: 8 }} data-confirm-show>
          <Note>This ends the search: every word you have not found is shown and marked as shown on your results, and the board can no longer be checked. It cannot be undone.</Note>
          <div style={{ display: 'flex', gap: 6 }}>
            <Btn primary onClick={() => s.showWords()}>
              Show the words and end the search
            </Btn>
            <Btn onClick={() => s.askShow(false)}>Keep searching</Btn>
          </div>
        </div>
      )}
      {ended && <Note data-board-ended>The search is over. The results of this step are on the right.</Note>}
    </StagePanel>
  )
}

/** The right panel's block of counts for the highlighted syllable: what comes right after it and right before it; counts only until the first word is found, then the proportion too, headed with the term and its definition (decision 10). */
export function Step2Panel({ s }: { s: StreamStore }) {
  const h = s.highlight
  if (!h) return <Note data-no-highlight>Click a syllable on the board to see what comes right after it and right before it on the board, and how many times each does.</Note>
  const nb = neighbors(s.boardSyllables, h)
  const withTp = s.firstWordFound
  const line = (x: { syllable: string; count: number }) => `${x.syllable}  ${String(x.count).padStart(3)}${withTp ? `   ${(x.count / nb.occurrences).toFixed(2)}` : ''}`
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }} data-neighbors={h}>
      <Note>{`${h} occurs ${nb.occurrences} times on the board.`}</Note>
      {withTp && <Note data-tp-definition>The second column is the transitional probability from one syllable to the next: how often the second follows the first, divided by how often the first occurs (§13.2.3).</Note>}
      <GroupLabel>Comes right after {h}</GroupLabel>
      <FixedLines lines={[`syllable  count${withTp ? '   proportion' : ''}`, ...nb.after.map(line)]} testId="after" />
      <GroupLabel>Comes right before {h}</GroupLabel>
      <FixedLines lines={[`syllable  count${withTp ? '   proportion' : ''}`, ...nb.before.map(line)]} testId="before" />
      <GroupLabel>Words found</GroupLabel>
      <FixedLines lines={s.board.found.length ? s.board.found.map((f, i) => `${i + 1}. ${f.word}  after ${f.checksBefore} check${f.checksBefore === 1 ? '' : 's'}${f.how === 'shown' ? '  (shown)' : ''}`) : ['none yet']} testId="found" />
    </div>
  )
}
