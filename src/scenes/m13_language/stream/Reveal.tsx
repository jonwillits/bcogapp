import type { ProgressStore } from '../../../sim/language/progress/store'
import { Content, FixedLines, GroupLabel, Note, Para, Section } from '../ui'
import { ReferencePanel } from '../ReferencePanel'
import { reference } from '../../../sim/language/references'
import { streamFor, SYLLABLES, WORDS, wordAverageTp } from '../../../sim/language/stream/language'
import { tpTableOf } from '../../../sim/language/stream/board'
import { LENGTHENED_DIFFERENTLY_LINE, RESTARTED_LINE } from '../lines'
import { SIX_WORDS_LINE, STEP1_AFTER_COMMIT } from './texts'
import { Tile } from './Strip'
import { MINUTE_UNIT, BOARD_UNIT, type BoardResult, type MinuteResult } from './store'

/**
 * Part 2's reveals (spec §6.1, §6.2): Step 1's after the commit (the six
 * words beside the student's answer and typed words, the two replays'
 * lines, the lengthening experiment), and Step 2's results in numbered
 * sections (the order the words were found in, the table of transitional
 * probabilities with the within-word cells shaded, and each word's average
 * beside the original's finding). None says what to conclude.
 */
export function MinuteReveal({ result }: { result: MinuteResult }) {
  const typed = result.typed ? result.typed.split(/[\s,;]+/).filter(Boolean) : []
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }} data-reveal="minute">
      {result.restarts > 0 && <Content>{RESTARTED_LINE}</Content>}
      <Section n={1} title="Your answer beside the language">
        <FixedLines lines={[`You answered: ${result.guess} ${result.guess === 1 ? 'word' : 'words'}.`, 'The language has 6 words.', `Words you typed: ${typed.length ? typed.join(', ') : 'none'}.`]} mono={false} testId="answer-truth" />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }} data-six-words>
          {WORDS.map((w) => (
            <div key={w} style={{ display: 'flex', gap: 2 }}>
              {[w.slice(0, 2), w.slice(2, 4), w.slice(4, 6)].map((syl, k) => (
                <Tile key={k} text={syl} word={w} />
              ))}
            </div>
          ))}
        </div>
        <Note>Each word is shown as its three syllables in the word’s own color, the colors the board in Step 2 uses.</Note>
      </Section>
      <Section n={2} title="The two replays">
        {STEP1_AFTER_COMMIT.map((p) => (
          <Para key={p.slice(0, 12)}>{p}</Para>
        ))}
        <Content>{SIX_WORDS_LINE}</Content>
      </Section>
      <Section n={3} title="The original’s lengthening experiment">
        <Para>In the original study’s second experiment, the vowel of the last syllable was lengthened by 100 milliseconds in three of the six words, in a language with m and n in place of b and d. Scores against nonwords were 80% with the final syllable lengthened, 61% with the first syllable lengthened, and 65% with no lengthening (pp. 616–617).</Para>
        <Content>{LENGTHENED_DIFFERENTLY_LINE}</Content>
        <ReferencePanel reference={reference('saffran-lengthening')} />
      </Section>
    </div>
  )
}

export function BoardReveal({ seed, result }: { seed: number; result: BoardResult }) {
  const stream = streamFor(seed, 1512)
  const { table, within } = tpTableOf(stream)
  const avgs = WORDS.map((w) => ({ word: w, avg: wordAverageTp(table, w) })).sort((a, b) => b.avg - a.avg)
  const foundOrder = result.found.filter((f) => f.how === 'found').map((f) => f.word)
  const rank = avgs.map((a) => a.word)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }} data-reveal="board">
      <Section n={1} title="The six words, in the order you found them">
        <Para>One row per word: its place in your order, the number of checks you made before it, and whether you found it or it was shown by “Show me the words”.</Para>
        <FixedLines lines={result.found.map((f, i) => `${i + 1}. ${f.word.padEnd(7)} after ${String(f.checksBefore).padStart(2)} checks   ${f.how}`)} testId="found-order" />
        <Note>{`You made ${result.checks.length} checks and ${result.clicks.length} clicks on the board.`}</Note>
      </Section>
      <Section n={2} title="The table of transitional probabilities">
        <Para>Computed from your whole 21-minute stream of 4,536 syllables. Each row is a first syllable and each column the syllable after it; a cell is the count of that pair divided by the count of the first syllable. The shaded cells are pairs inside one of the six words.</Para>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', fontFamily: 'var(--font-mono)', fontSize: 10.5 }} data-tp-table>
            <thead>
              <tr>
                <th style={{ padding: 2 }}></th>
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
      <Section n={3} title="Each word’s average transitional probability inside it">
        <Para>For each word, the mean of its two transitions from the table, from highest to lowest. The original study’s authors split the six words this way and found that the three words with the highest average transitional probabilities were learned better than the three with the lowest, 79% against 72% (p. 614). Beside it, where each word fell in your own order of finding; shown words have no place.</Para>
        <FixedLines lines={avgs.map((a, i) => `${i + 1}. ${a.word.padEnd(7)} average ${a.avg.toFixed(2)}   your order: ${foundOrder.includes(a.word) ? `found ${foundOrder.indexOf(a.word) + 1}${['st', 'nd', 'rd'][foundOrder.indexOf(a.word)] ?? 'th'}` : 'shown'}`)} testId="word-averages" />
        <Note data-ranking>{foundOrder.length >= 2 ? `The three words highest by average transitional probability are ${rank.slice(0, 3).join(', ')}; of the words you found, ${foundOrder.filter((w) => rank.slice(0, 3).includes(w)).length} of your first ${Math.min(3, foundOrder.length)} were among them.` : 'You found fewer than two words, so there is no order of finding to compare.'}</Note>
        <ReferencePanel reference={reference('saffran-high-low')} />
      </Section>
    </div>
  )
}

export function StreamResults({ progress }: { progress: ProgressStore }) {
  const minute = progress.result(MINUTE_UNIT) as MinuteResult | undefined
  const board = progress.result(BOARD_UNIT) as BoardResult | undefined
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }} data-results="stream">
      {minute && (
        <>
          <GroupLabel>Step 1</GroupLabel>
          <MinuteReveal result={minute} />
        </>
      )}
      {board && (
        <>
          <GroupLabel>Step 2</GroupLabel>
          <BoardReveal seed={progress.seed} result={board} />
        </>
      )}
      {!minute && !board && <Note>No experiment of Part 2 is finished yet.</Note>}
    </div>
  )
}
