import type { StudyList } from './lists'

/**
 * Lenient matching of a typed word to a list word (spec §5.4): lower case,
 * trimmed, singular and plural treated alike, and one edit allowed for
 * words of five letters or more. Nothing here is scored or compared on
 * screen until Part 1 is finished; this is the arithmetic the reveal uses.
 */

export function normalize(typed: string): string {
  return typed.trim().toLowerCase().replace(/[^a-z'-]/g, '')
}

/** A plain singular form: dogs → dog, boxes → box, cherries → cherry, glass → glass. */
export function singular(w: string): string {
  if (w.length > 4 && w.endsWith('ies')) return w.slice(0, -3) + 'y'
  if (w.length > 4 && /(ses|xes|zes|ches|shes)$/.test(w)) return w.slice(0, -2)
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1)
  return w
}

/** Damerau–Levenshtein distance with adjacent transposition, capped at 2. */
export function editDistance(a: string, b: string): number {
  const m = a.length
  const n = b.length
  if (Math.abs(m - n) > 1) return 2
  const d: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0))
  for (let i = 0; i <= m; i++) d[i][0] = i
  for (let j = 0; j <= n; j++) d[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
    }
  }
  return Math.min(2, d[m][n])
}

export const EDIT_FROM_LENGTH = 5

/**
 * How well a typed word matches a list word: 2 for the same word, or its
 * singular or plural; 1 for one edit away (words of five letters or more
 * only); 0 for no match. An exact match anywhere outranks a one-edit
 * match anywhere, so that *rough* typed after the *rough* list is the
 * critical word and not the studied word *tough* (`matcher.test.ts`).
 */
export function matchStrength(typed: string, word: string): 0 | 1 | 2 {
  const t = normalize(typed)
  const w = word.toLowerCase()
  if (!t) return 0
  if (t === w) return 2
  const ts = singular(t)
  const ws = singular(w)
  if (ts === ws) return 2
  if (w.length < EDIT_FROM_LENGTH) return 0
  return editDistance(t, w) <= 1 || editDistance(ts, ws) <= 1 ? 1 : 0
}

/** Whether a typed word counts as the list word. */
export function matches(typed: string, word: string): boolean {
  return matchStrength(typed, word) > 0
}

export type EntryKind = 'studied' | 'critical' | 'earlier' | 'other'

export interface ClassifiedEntry {
  typed: string
  kind: EntryKind
  /** For a studied word: its 1-based position in this list. */
  position: number | null
  /** For a studied or earlier word: the word it matched. */
  word: string | null
  /** For an earlier-list word: which earlier list it came from, by index into `earlierLists`. */
  fromEarlier: number | null
  /** A second typing of a word already counted. */
  duplicate: boolean
}

/**
 * Classify every typed entry: a studied word from this list, the critical
 * word (on a list of associates), a word from an earlier list (a prior-list
 * intrusion; the most recent earlier list wins a tie), or other. A word
 * typed twice is counted once; the repeat is marked a duplicate.
 */
export function classify(typed: string[], list: StudyList, earlierLists: StudyList[], criticalWord: string | null = list.critical ?? null): ClassifiedEntry[] {
  const seen = new Set<string>()
  const best = (words: readonly string[], raw: string, strength: number): number => words.findIndex((w) => matchStrength(raw, w) === strength)
  return typed.map((raw) => {
    const t = normalize(raw)
    // An exact match (strength 2) anywhere outranks a one-edit match (1) anywhere; within a strength the order is this list, the critical word, the earlier lists, most recent first.
    for (const strength of [2, 1] as const) {
      const studiedAt = best(list.words, raw, strength)
      if (studiedAt >= 0) {
        const key = `s:${list.words[studiedAt]}`
        const duplicate = seen.has(key)
        seen.add(key)
        return { typed: raw, kind: 'studied', position: studiedAt + 1, word: list.words[studiedAt], fromEarlier: null, duplicate }
      }
      if (criticalWord && matchStrength(raw, criticalWord) === strength) {
        const duplicate = seen.has('c')
        seen.add('c')
        return { typed: raw, kind: 'critical', position: null, word: criticalWord, fromEarlier: null, duplicate }
      }
      for (let i = earlierLists.length - 1; i >= 0; i--) {
        const at = best(earlierLists[i].words, raw, strength)
        if (at >= 0) {
          const key = `e:${earlierLists[i].words[at]}`
          const duplicate = seen.has(key)
          seen.add(key)
          return { typed: raw, kind: 'earlier', position: null, word: earlierLists[i].words[at], fromEarlier: i, duplicate }
        }
      }
    }
    const duplicate = seen.has(`o:${t}`)
    seen.add(`o:${t}`)
    return { typed: raw, kind: 'other', position: null, word: null, fromEarlier: null, duplicate }
  })
}
