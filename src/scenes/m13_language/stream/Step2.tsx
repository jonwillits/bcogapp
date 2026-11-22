import { useState } from 'react'
import { Btn, Content, DataTable, FixedLines, GroupLabel, Note, StagePanel } from '../ui'
import { COUNTS_FROM_YOUR_STREAM_LINE } from '../lines'
import { SYLLABLES, syllablesOf, type Syllable } from '../../../sim/language/stream/language'
import { neighbors, uncovered, BOARD_SYLLABLES, TRAY_MAX, TRAY_MIN } from '../../../sim/language/stream/board'
import { Tile } from './Strip'
import type { StreamStore } from './store'
import { BoardReveal } from './Reveal'
import { MinuteReplays } from './Replays'
import { MAIN_TABS } from '../params'

/**
 * Step 2's search (spec §6.2; decision 8; Jon, 2026-11-21): the first 300
 * syllables of the stream are counted but not shown while the search runs,
 * since a printed stream of three-syllable words can be read off from its
 * first tile. The student searches on the palette of the 12 syllables and
 * the panel of counts beside it: a click on a palette tile highlights it
 * and the panel lists what comes right after it and right before it, and
 * how often; the tray is built by dragging palette tiles or by Add to the
 * tray; Check this word, Empty the tray, Show me the words behind an
 * in-page confirmation, the found words as colored tiles, and the counter
 * of syllables not yet in a found word. Once the search has ended the 300
 * syllables are printed, colored, as the first section of the results, the
 * two replays of Step 1's minute follow (`Replays.tsx`), then the rest of
 * the results and the button that comes next (Jon, 2026-11-18).
 */
export function Step2Stage({ s, onNext }: { s: StreamStore; onNext?: () => void }) {
  const board = s.boardSyllables
  const [over, setOver] = useState(false)
  const drag = (s0: Syllable) => (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', s0)
    e.dataTransfer.effectAllowed = 'copy'
  }
  const ended = s.board.ended
  const result = s.boardResult()
  const h = s.highlight
  return (
    <StagePanel wide testId="stream-2">
      <div style={{ fontSize: 14, fontWeight: 600 }}>Find the words</div>
      {result && onNext && <Note>{`This step is done. Its results are below, with their explanation, and on the ${MAIN_TABS.results} tab at the top of this panel. The button to move on is at the end.`}</Note>}
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }} data-board-layout>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: '1 1 420px', minWidth: 0 }} data-search>
          <Note>{ended ? `The search is over. The ${BOARD_SYLLABLES} syllables are printed below, divided into words. Click a syllable in the palette to see its counts.` : `The counts here come from the first ${BOARD_SYLLABLES} syllables of your stream, which are not shown. Click a syllable to see how often it occurs, which syllables come right after it, and which come right before it. Build a word in the tray and check it.`}</Note>
          <GroupLabel>The palette: the language’s 12 syllables</GroupLabel>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }} data-palette>
            {SYLLABLES.map((syl) => (
              <Tile key={syl} text={syl} highlighted={h === syl} onClick={() => s.clickSyllable(syl)} draggable={!ended} onDragStart={drag(syl)} title={ended ? 'Click to see its counts' : 'Click to see its counts; drag into the tray'} />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <Btn small onClick={() => s.clearHighlight()} disabled={h === null}>
              Clear the highlight
            </Btn>
            {!ended && (
              <Btn small onClick={() => s.addHighlightedToTray()} disabled={h === null || s.tray.length >= TRAY_MAX}>
                Add to the tray
              </Btn>
            )}
            <Note>{h ? `Highlighted: ${h}.` : 'No syllable is highlighted.'}</Note>
          </div>
          {!ended && (
            <>
              <GroupLabel>The tray</GroupLabel>
              <div
                data-tray
                data-over={over || undefined}
                onDragOver={(e) => {
                  if (s.tray.length >= TRAY_MAX) return
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
                {s.tray.length === 0 && <Note>Drag {TRAY_MIN} to {TRAY_MAX} tiles here, or highlight a syllable and press “Add to the tray”. To take a tile out, click it.</Note>}
                {s.tray.map((syl, i) => (
                  <Tile key={i} text={syl} onClick={() => s.removeFromTray(i)} title="Click to take this tile out of the tray" />
                ))}
              </div>
              <FixedLines lines={[s.tray.length ? `These ${s.tray.length} syllable${s.tray.length === 1 ? '' : 's'} occur together, in this order, ${s.trayOccurrences} time${s.trayOccurrences === 1 ? '' : 's'} in the ${BOARD_SYLLABLES} syllables.` : 'The tray is empty.']} mono={false} testId="tray-count" />
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                <Btn primary onClick={() => s.checkTray()} disabled={s.tray.length < TRAY_MIN}>
                  Check this word
                </Btn>
                <Btn onClick={() => s.emptyTray()} disabled={s.tray.length === 0}>
                  Empty the tray
                </Btn>
                {s.lastCheck && <Note data-check-result>{s.lastCheck === 'word' ? 'This is one of the language’s words. It is added to the words found, in a color of its own.' : 'This is not one of the language’s words.'}</Note>}
              </div>
            </>
          )}
          <GroupLabel>Words found</GroupLabel>
          {s.board.found.length ? (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }} data-found-words>
              {s.board.found.map((f) => (
                <div key={f.word} style={{ display: 'flex', gap: 2 }} data-found={f.how}>
                  {syllablesOf(f.word).map((syl, k) => (
                    <Tile key={k} text={syl} word={f.word} />
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <Note data-lines="found">none yet</Note>
          )}
          <FixedLines lines={[`Syllables not yet in a found word: ${String(uncovered(board, s.foundWords)).padStart(3)} of ${BOARD_SYLLABLES}`]} testId="uncovered" />
          <Content>{COUNTS_FROM_YOUR_STREAM_LINE}</Content>
          {!ended && !s.confirmingShow && (
            <div>
              <Btn onClick={() => s.askShow(true)}>Show me the words</Btn>
            </div>
          )}
          {!ended && s.confirmingShow && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 8, border: '1px solid var(--avoid)', borderRadius: 8 }} data-confirm-show>
              <Note>This ends the search: every word you have not found is shown, and marked as shown in your results, and you can check no more words. It cannot be undone.</Note>
              <div style={{ display: 'flex', gap: 6 }}>
                <Btn primary onClick={() => s.showWords()}>
                  Show the words and end the search
                </Btn>
                <Btn onClick={() => s.askShow(false)}>Keep searching</Btn>
              </div>
            </div>
          )}
          {ended && <Note data-board-ended>The search is over. The results of this step are below.</Note>}
        </div>
        <div style={{ flex: '0 1 280px', display: 'flex', flexDirection: 'column', gap: 6, padding: 8, border: '1px solid var(--border)', borderRadius: 8 }} data-counts-panel>
          <GroupLabel>Counts in the {BOARD_SYLLABLES} syllables</GroupLabel>
          <Step2Panel s={s} />
        </div>
      </div>
      {result && <BoardReveal seed={s.seed} result={result} replays={<MinuteReplays s={s} />} />}
      {result && onNext && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8, paddingTop: 10, borderTop: '1px solid var(--border)' }} data-next-row>
          <Note data-next>When you are ready to move on, press “Go on to Step 3” here or in the navigation panel.</Note>
          <div>
            <Btn primary onClick={onNext}>
              Go on to Step 3
            </Btn>
          </div>
        </div>
      )}
    </StagePanel>
  )
}

/** The panel of counts for the highlighted syllable: what comes right after it and right before it in the 300 syllables; counts only until the first word is found, then the proportion too, headed with the term and its definition (decision 10). */
export function Step2Panel({ s }: { s: StreamStore }) {
  const h = s.highlight
  if (!h) return <Note data-no-highlight>Click a syllable in the palette to see how many times it occurs in the first {BOARD_SYLLABLES} syllables of your stream, which syllables come right after it, and which come right before it, each with its own count.</Note>
  const nb = neighbors(s.boardSyllables, h)
  const withTp = s.firstWordFound
  const cols = [{ key: 'syllable', label: 'Syllable', mono: true, align: 'left' as const }, { key: 'count', label: 'Count', mono: true }, ...(withTp ? [{ key: 'tp', label: 'Proportion', mono: true }] : [])]
  const row = (x: { syllable: string; count: number }) => ({ syllable: x.syllable, count: x.count, tp: withTp ? (x.count / nb.occurrences).toFixed(2) : '' })
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }} data-neighbors={h}>
      <Note>{`${h} occurs ${nb.occurrences} times in the ${BOARD_SYLLABLES} syllables.`}</Note>
      {withTp && <Note data-tp-definition>The Proportion column is the transitional probability from one syllable to the next: how often the second follows the first, divided by how often the first occurs (§13.2.3).</Note>}
      <GroupLabel>Comes right after {h}</GroupLabel>
      <DataTable testId="after" columns={cols} rows={nb.after.map(row)} />
      <GroupLabel>Comes right before {h}</GroupLabel>
      <DataTable testId="before" columns={cols} rows={nb.before.map(row)} />
    </div>
  )
}
