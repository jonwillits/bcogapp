import { SYLLABLES, WORDS, countPairs, syllablesOf, type Stream, type Syllable, type Word } from './language'

/**
 * Part 2, Step 2's board (spec §6.2; decision 8): the first 300 syllables
 * of the student's stream as tiles, 20 to a row, so that a row breaks at a
 * fixed width and never at a word boundary on purpose. Clicking a syllable
 * highlights every instance; the panel lists what comes right after it and
 * right before it, with counts only until the first word is found; a tray
 * of 2 to 4 tiles is checked against the six words, and a found word's
 * instances fill with the word's color. Nothing here reads the word list
 * except `checkTray`, which is the check itself, and the coloring of a
 * found word's instances.
 */
export const BOARD_SYLLABLES = 300
export const ROW = 20
export const TRAY_MIN = 2
export const TRAY_MAX = 4

/** Each word's fill on the tiles: six colors apart in hue and lightness, with no pattern over the letters (Jon, 2026-11-21: the patterns made the syllables hard to read). */
export const WORD_COLORS: Record<Word, { fill: string }> = {
  babupu: { fill: '#4f9cff' },
  bupada: { fill: '#f0a94b' },
  dutaba: { fill: '#34d399' },
  patubi: { fill: '#d64f9a' },
  pidabu: { fill: '#f0e68c' },
  tutibu: { fill: '#9aa6b8' },
}
export const HIGHLIGHT = '#ffffff'

export interface BoardState {
  /** The found words, in the order found, each with the number of checks before it and whether it was found or shown. */
  found: { word: Word; checksBefore: number; how: 'found' | 'shown' }[]
  checks: { tray: Syllable[]; result: 'word' | 'not a word'; at: number }[]
  clicks: { syllable: Syllable; at: number }[]
  /** Whether Show me the words ended the search. */
  ended: boolean
}

export function newBoard(): BoardState {
  return { found: [], checks: [], clicks: [], ended: false }
}

export function boardSyllables(stream: Stream): Syllable[] {
  return stream.syllables.slice(0, BOARD_SYLLABLES)
}

/** For a clicked syllable, what comes right after it on the board and how often, and what comes right before it. */
export function neighbors(board: readonly Syllable[], s: Syllable): { after: { syllable: Syllable; count: number }[]; before: { syllable: Syllable; count: number }[]; occurrences: number } {
  const after = new Map<Syllable, number>()
  const before = new Map<Syllable, number>()
  let occurrences = 0
  board.forEach((x, i) => {
    if (x !== s) return
    occurrences++
    if (i + 1 < board.length) after.set(board[i + 1], (after.get(board[i + 1]) ?? 0) + 1)
    if (i > 0) before.set(board[i - 1], (before.get(board[i - 1]) ?? 0) + 1)
  })
  const sorted = (m: Map<Syllable, number>) => [...m.entries()].map(([syllable, count]) => ({ syllable, count })).sort((a, b) => b.count - a.count || a.syllable.localeCompare(b.syllable))
  return { after: sorted(after), before: sorted(before), occurrences }
}

/** How many times the tray's syllables occur together, in that order, on the board. */
export function trayCount(board: readonly Syllable[], tray: readonly Syllable[]): number {
  if (tray.length === 0) return 0
  let n = 0
  for (let i = 0; i + tray.length <= board.length; i++) {
    let ok = true
    for (let k = 0; k < tray.length; k++) if (board[i + k] !== tray[k]) ok = false
    if (ok) n++
  }
  return n
}

export function isWord(tray: readonly Syllable[]): Word | null {
  const w = tray.join('')
  return (WORDS as readonly string[]).includes(w) ? (w as Word) : null
}

/** For each board position, the word whose found instance covers it, or null. */
export function coloring(board: readonly Syllable[], found: readonly Word[]): (Word | null)[] {
  const out: (Word | null)[] = board.map(() => null)
  for (const w of found) {
    const syl = syllablesOf(w)
    for (let i = 0; i + 3 <= board.length; i++) if (board[i] === syl[0] && board[i + 1] === syl[1] && board[i + 2] === syl[2]) out[i] = out[i + 1] = out[i + 2] = w
  }
  return out
}

/** The syllables not yet in a found word: the counter under the board. */
export function uncovered(board: readonly Syllable[], found: readonly Word[]): number {
  return coloring(board, found).filter((w) => w === null).length
}

/** The transitional-probability table over the whole stream, for the results screen, with the within-word cells marked. */
export function tpTableOf(stream: Stream): { table: number[][]; within: boolean[][] } {
  const c = countPairs(stream.syllables)
  const table = SYLLABLES.map((a) => SYLLABLES.map((b) => (c.single.get(a) ? (c.pair.get(a + ' ' + b) ?? 0) / c.single.get(a)! : 0)))
  const within = SYLLABLES.map((a) => SYLLABLES.map((b) => WORDS.some((w) => w.includes(a + b))))
  return { table, within }
}
