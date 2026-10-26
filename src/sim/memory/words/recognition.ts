import { makeRng, type Rng } from '../../random'
import { LONG_LENGTH, NEW_WORDS, SHORT_LENGTH, type StudyList } from './lists'
import type { Part1Plan } from './design'

/**
 * Part 1's recognition test (spec §5.5, with Jon's answer 5 of
 * 2026-10-25): 31 words in a seeded order, each judged Old or New, and
 * after Old, Remember or Know. There is no reveal until all 31 are
 * answered.
 */

export type ItemType = 'associates-studied' | 'unrelated-studied' | 'critical-studied' | 'critical-control' | 'new'

export const ITEM_TYPES: ItemType[] = ['associates-studied', 'unrelated-studied', 'critical-studied', 'critical-control', 'new']

export const ITEM_TYPE_LABEL: Record<ItemType, string> = {
  'associates-studied': 'studied words from the lists of associates',
  'unrelated-studied': 'studied words from the unrelated lists',
  'critical-studied': 'critical words of the studied lists',
  'critical-control': 'critical words of the control lists',
  new: 'new words',
}

export interface RecognitionItem {
  word: string
  type: ItemType
  /** The list the word came from, for studied words and critical words. */
  fromList: string | null
}

/** Roediger and McDermott took positions 1, 8 and 10 of each list for the test (printed p. 808). */
export const ASSOCIATE_POSITIONS = [1, 8, 10]
export const RECOGNITION_ITEMS = 31

function shuffled<T>(items: T[], rng: Rng): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng.int(i + 1)
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** The middle positions a studied unrelated word is taken from: 4 to 7 of a short list, 6 to 15 of a long one (1-based). */
export function middlePositions(list: StudyList): number[] {
  const n = list.words.length
  if (n === SHORT_LENGTH) return [4, 5, 6, 7]
  if (n === LONG_LENGTH) return Array.from({ length: 10 }, (_, i) => i + 6)
  return Array.from({ length: Math.max(1, n - 6) }, (_, i) => i + 4)
}

/**
 * Build the test from the plan and the lists actually studied (which can
 * differ from the plan where a restart replaced one): 9 words from the
 * studied lists of associates at positions 1, 8 and 10; 8 from the
 * unrelated lists, two from each of four chosen by the seed, from the
 * middle positions; the 3 critical words of the studied lists; the 3 of
 * the control lists; 8 new words.
 */
export function planRecognition(plan: Part1Plan, studiedLists: StudyList[] = plan.slots.map((s) => s.list)): RecognitionItem[] {
  const rng = makeRng(plan.seed ^ 0x7ec0)
  const items: RecognitionItem[] = []
  const associates = studiedLists.filter((l) => l.kind === 'associates')
  for (const l of associates) for (const p of ASSOCIATE_POSITIONS) items.push({ word: l.words[p - 1], type: 'associates-studied', fromList: l.id })
  const unrelated = shuffled(studiedLists.filter((l) => l.kind === 'unrelated'), rng).slice(0, 4)
  for (const l of unrelated) {
    const picks = shuffled(middlePositions(l), rng).slice(0, 2)
    for (const p of picks) items.push({ word: l.words[p - 1], type: 'unrelated-studied', fromList: l.id })
  }
  for (const l of associates) items.push({ word: l.critical!, type: 'critical-studied', fromList: l.id })
  // The controls: the three lists of associates not studied. Where a studied list was lost to a restart, it joins the controls.
  const studiedIds = new Set(associates.map((l) => l.id))
  const controls = [...plan.controls, ...plan.studied.filter((l) => !studiedIds.has(l.id))]
  for (const l of controls) items.push({ word: l.critical!, type: 'critical-control', fromList: l.id })
  for (const w of NEW_WORDS) items.push({ word: w, type: 'new', fromList: null })
  return shuffled(items, rng)
}

export type Judgment = 'remember' | 'know'

export interface RecognitionAnswer {
  old: boolean
  judgment: Judgment | null
}

export interface TypeScore {
  type: ItemType
  n: number
  /** The proportion called old. */
  old: number
  /** Of all items of the type, the proportion called old with a remember judgment, and with a know judgment. */
  remember: number
  know: number
  /** Old answers are hits for studied words and false alarms for the rest. */
  hits: number
  falseAlarms: number
}

export function scoreRecognition(items: RecognitionItem[], answers: (RecognitionAnswer | null)[]): TypeScore[] {
  return ITEM_TYPES.map((type) => {
    const idx = items.map((it, i) => (it.type === type ? i : -1)).filter((i) => i >= 0)
    const n = idx.length
    let old = 0
    let remember = 0
    let know = 0
    for (const i of idx) {
      const a = answers[i]
      if (!a || !a.old) continue
      old++
      if (a.judgment === 'remember') remember++
      else if (a.judgment === 'know') know++
    }
    const studied = type === 'associates-studied' || type === 'unrelated-studied'
    return { type, n, old: n ? old / n : 0, remember: n ? remember / n : 0, know: n ? know / n : 0, hits: studied ? old : 0, falseAlarms: studied ? 0 : old }
  })
}

export function allRecognitionAnswered(answers: (RecognitionAnswer | null)[]): boolean {
  return answers.every((a) => a !== null && (!a.old || a.judgment !== null))
}

/**
 * The remember and know definitions in the words Roediger and McDermott
 * (1995, printed p. 807) gave: the instruction screen prints both lines,
 * and a fixed line during the test carries the short form.
 */
export const REMEMBER_KNOW_LINES = {
  remember: 'Remember: you can mentally relive the word’s presentation, perhaps by recalling its neighbors, what it made you think of, what you were doing when you saw it, or something about how it looked.',
  know: 'Know: you are confident that the word was on a list but you cannot re-experience its presentation.',
  short: 'Remember means you can relive seeing the word. Know means you are sure it was there but cannot relive it.',
}
