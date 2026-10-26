import { arc, type ArcPieces } from '../../../sim/memory/words/arc'
import { matches } from '../../../sim/memory/words/matcher'
import { subcategoryOf, wordsOf, SET_SIZE, type WordSet } from '../../../sim/memory/words/sets'
import { referenceById } from '../../../sim/memory/references'
import { Content, FixedLines, GroupLabel, Note, ReferencePanel } from '../ui'
import { RESTARTED_LINE } from '../lines'
import { StudyStore, type StudyResult } from './studyStore'

/**
 * Part 2's reveal (spec §6.3), rendered only once both units are complete.
 * This is the one file of Part 2 that names what the two conditions were:
 * the scrambled list and the organized list, and clustering.
 */

export const CONDITION_LABEL: Record<StudyResult['unit'], string> = { first: 'the scrambled list', second: 'the organized list' }

/** Six colors, one per subcategory, in the order the set lists them. */
export const SUBCATEGORY_COLORS = ['#f0a94b', '#4f9cff', '#34d399', '#f87171', '#b388ff', '#ffd08a']

export function subcategoryIndex(set: WordSet, word: string): number {
  let i = 0
  for (const c of set.categories)
    for (const s of c.subcategories) {
      if (s.words.includes(word)) return i
      i++
    }
  return -1
}

/** Score a unit: each typed word matched to the set's words (intrusions dropped, a word typed twice counted once), and the clustering pieces by subcategory. */
export function scoreUnit(r: StudyResult): { set: WordSet; matched: (string | null)[]; recalled: number; pieces: ArcPieces } {
  const set = StudyStore.setOf(r)
  const words = wordsOf(set)
  const matched = r.typed.map((t) => words.find((w) => matches(t, w)) ?? null)
  const order = matched.filter((w): w is string => w !== null)
  const pieces = arc(order, (w) => subcategoryOf(set, w))
  return { set, matched, recalled: pieces.N, pieces }
}

const f2 = (v: number) => v.toFixed(2)

/** The formula with the student's numbers in it, in the manner of Lab 7's By hand box. */
export function arcLines(p: ArcPieces): string[] {
  const sumSq = p.counts.reduce((s, c) => s + c.n * c.n, 0)
  return [
    `N (words recalled)        ${String(p.N).padStart(6)}`,
    `k (subcategories present) ${String(p.k).padStart(6)}`,
    `R (same-subcategory pairs)${String(p.R).padStart(6)}`,
    `E(R) = Σ nₖ² / N − 1 = ${sumSq} / ${p.N} − 1 = ${f2(p.E).padStart(6)}`,
    `maxR = N − k = ${p.N} − ${p.k} = ${String(p.maxR).padStart(6)}`,
    `ARC = (R − E(R)) / (maxR − E(R)) = (${p.R} − ${f2(p.E)}) / (${p.maxR} − ${f2(p.E)}) = ${p.arc === null ? '     —' : f2(p.arc).padStart(6)}`,
  ]
}

export function ColoredOutput({ set, matched, typed }: { set: WordSet; matched: (string | null)[]; typed: string[] }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }} data-colored-output>
      {typed.map((t, i) => {
        const w = matched[i]
        const k = w ? subcategoryIndex(set, w) : -1
        return (
          <span key={i} data-subcategory={k} style={{ padding: '2px 8px', borderRadius: 999, fontSize: 12, border: `1px solid ${k >= 0 ? SUBCATEGORY_COLORS[k] : 'var(--border)'}`, color: k >= 0 ? SUBCATEGORY_COLORS[k] : 'var(--text-muted)', textDecoration: k >= 0 ? undefined : 'line-through' }}>
            {t}
          </span>
        )
      })}
    </div>
  )
}

export function Legend({ set }: { set: WordSet }) {
  let i = 0
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, fontSize: 11 }}>
      {set.categories.flatMap((c) =>
        c.subcategories.map((s) => {
          const k = i++
          return (
            <span key={s.label} style={{ color: SUBCATEGORY_COLORS[k] }}>
              ■ {c.label}: {s.label}
            </span>
          )
        }),
      )}
    </div>
  )
}

export function Reveal({ scrambled, organized }: { scrambled: StudyResult; organized: StudyResult }) {
  const s = scoreUnit(scrambled)
  const o = scoreUnit(organized)
  const restarted = scrambled.restarted || organized.restarted
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }} data-reveal="study">
      <GroupLabel>Words recalled</GroupLabel>
      <FixedLines
        lines={[`${'the scrambled list'.padEnd(22)}${String(s.recalled).padStart(3)} of ${SET_SIZE}`, `${'the organized list'.padEnd(22)}${String(o.recalled).padStart(3)} of ${SET_SIZE}`]}
        testId="recalled"
      />
      <Note>The first set was the scrambled list: the 24 words in a grid, in an order set by your seed, with no labels. The second was the organized list: the same kind of set laid out as a tree, with its labels. Only the 24 words count; the labels were never scored.</Note>
      <GroupLabel>Clustering: the adjusted ratio of clustering, by subcategory</GroupLabel>
      <Note>ARC counts how often one word you typed was followed by another from the same subcategory, against what chance would give. 1 is perfect clustering and 0 is the level expected by chance.</Note>
      <FixedLines lines={[`${'the scrambled list'.padEnd(22)}ARC ${s.pieces.arc === null ? '    —' : f2(s.pieces.arc).padStart(5)}`, `${'the organized list'.padEnd(22)}ARC ${o.pieces.arc === null ? '    —' : f2(o.pieces.arc).padStart(5)}`]} testId="arc" />
      <GroupLabel>By hand: the scrambled list</GroupLabel>
      <FixedLines lines={arcLines(s.pieces)} testId="arc-scrambled" />
      <GroupLabel>By hand: the organized list</GroupLabel>
      <FixedLines lines={arcLines(o.pieces)} testId="arc-organized" />
      {(s.pieces.arc === null || o.pieces.arc === null) && <Note>A dash means the score is undefined: with fewer than two subcategories recalled, or every word from one, there is no clustering to measure.</Note>}
      <GroupLabel>Your output, colored by subcategory</GroupLabel>
      <Note>The scrambled list. A word with a line through it matched no word of the set.</Note>
      <ColoredOutput set={s.set} matched={s.matched} typed={scrambled.typed} />
      <Legend set={s.set} />
      <Note>The organized list.</Note>
      <ColoredOutput set={o.set} matched={o.matched} typed={organized.typed} />
      <Legend set={o.set} />
      {restarted && <Content>{RESTARTED_LINE}</Content>}
      <ReferencePanel reference={referenceById('bower1969')} />
      <ReferencePanel reference={referenceById('roenker1971')} />
    </div>
  )
}

/** The rows the report asks for, for My results, all parts. */
export function resultRows(scrambled: StudyResult, organized: StudyResult): string[] {
  const s = scoreUnit(scrambled)
  const o = scoreUnit(organized)
  const a = (p: ArcPieces) => (p.arc === null ? '    —' : f2(p.arc).padStart(5))
  return [`${'Scrambled list, words recalled'.padEnd(34)}${String(s.recalled).padStart(3)} of ${SET_SIZE}`, `${'Organized list, words recalled'.padEnd(34)}${String(o.recalled).padStart(3)} of ${SET_SIZE}`, `${'Scrambled list, ARC'.padEnd(34)}${a(s.pieces)}`, `${'Organized list, ARC'.padEnd(34)}${a(o.pieces)}`]
}
