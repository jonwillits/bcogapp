import { describe, it, expect } from 'vitest'
import { planPart1 } from './design'
import { criticalRecalled, listLength, orderOfOutput, priorListIntrusions, serialPositionCurves, type RecallRecord } from './scoring'
import { planRecognition, scoreRecognition, allRecognitionAnswered, ITEM_TYPES, RECOGNITION_ITEMS, type RecognitionAnswer } from './recognition'
import { LONG_LENGTH, SHORT_LENGTH } from './lists'

/** A scripted subject: recalls the first three and the last three of every list, and types the critical word after every list of associates. */
function scripted(seed: number, extra: (i: number) => string[] = () => []): RecallRecord[] {
  const p = planPart1(seed)
  return p.slots.map((s, i) => {
    const w = s.list.words
    const typed = [...w.slice(-3), ...w.slice(0, 3)]
    if (s.list.kind === 'associates') typed.push(s.list.critical!)
    const r: RecallRecord = { slot: s.slot, list: s.list, recall: s.recall, typed }
    r.typed.push(...extra(i))
    return r
  })
}

describe('serial-position curves', () => {
  it('four conditions, two lists each, with the ends at 1 and the middle at 0 for the scripted subject', () => {
    const curves = serialPositionCurves(scripted(3))
    expect(curves.map((c) => c.condition)).toEqual(['short-immediate', 'short-delayed', 'long-immediate', 'long-delayed'])
    for (const c of curves) {
      expect(c.lists).toBe(2)
      const n = c.condition.startsWith('short') ? SHORT_LENGTH : LONG_LENGTH
      expect(c.byPosition.length).toBe(n)
      expect(c.byPosition.slice(0, 3)).toEqual([1, 1, 1])
      expect(c.byPosition.slice(-3)).toEqual([1, 1, 1])
      expect(c.byPosition.slice(3, -3).every((v) => v === 0)).toBe(true)
      expect(c.bins).toEqual({ first: 1, middle: 0, last: 1 })
    }
  })
  it('lists of associates are excluded from the curves', () => {
    const records = scripted(3).filter((r) => r.list.kind === 'associates')
    for (const c of serialPositionCurves(records)) expect(c.lists).toBe(0)
  })
})

describe('list length, intrusions, critical words, order of output', () => {
  it('list length compares immediate lists only: six words of ten against six of twenty', () => {
    const ll = listLength(scripted(4))
    expect(ll.short).toEqual({ lists: 2, proportion: 0.6, count: 6 })
    expect(ll.long).toEqual({ lists: 2, proportion: 0.3, count: 6 })
  })
  it('a word from an earlier list is a prior-list intrusion, with its source', () => {
    const records = scripted(5, (i) => (i === 4 ? [scripted(5)[1].list.words[5]] : []))
    const { count, intrusions } = priorListIntrusions(records)
    expect(count).toBe(1)
    expect(intrusions[0].slot).toBe(4)
    expect(intrusions[0].fromSlot).toBe(1)
  })
  it('the critical word typed after its list is recorded as recalled', () => {
    const cr = criticalRecalled(scripted(6))
    expect(cr.length).toBe(3)
    expect(cr.every((c) => c.recalled)).toBe(true)
    const none = criticalRecalled(scripted(6).map((r) => ({ ...r, typed: r.typed.filter((t) => t !== r.list.critical) })))
    expect(none.every((c) => !c.recalled)).toBe(true)
  })
  it('order of output: the scripted subject starts every immediate recall with a last-three word', () => {
    const o = orderOfOutput(scripted(7))
    expect(o.lists).toBe(4)
    expect(o.proportion).toBe(1)
  })
})

describe('the recognition test', () => {
  it('31 items of the five types in the counts of Jon’s answer 5, every word once, in a seeded order', () => {
    const p = planPart1(9)
    const items = planRecognition(p)
    expect(items.length).toBe(RECOGNITION_ITEMS)
    const count = (t: string) => items.filter((i) => i.type === t).length
    expect(count('associates-studied')).toBe(9)
    expect(count('unrelated-studied')).toBe(8)
    expect(count('critical-studied')).toBe(3)
    expect(count('critical-control')).toBe(3)
    expect(count('new')).toBe(8)
    expect(new Set(items.map((i) => i.word)).size).toBe(31)
    expect(JSON.stringify(planRecognition(p))).toBe(JSON.stringify(items))
    expect(items.map((i) => i.word)).not.toEqual(planRecognition(planPart1(10)).map((i) => i.word))
  })
  it('the studied associates are positions 1, 8 and 10; the unrelated words come from the middle of four lists, two each', () => {
    const p = planPart1(11)
    const items = planRecognition(p)
    for (const it of items.filter((i) => i.type === 'associates-studied')) {
      const l = p.studied.find((x) => x.id === it.fromList)!
      expect([l.words[0], l.words[7], l.words[9]]).toContain(it.word)
    }
    const unrelated = items.filter((i) => i.type === 'unrelated-studied')
    const lists = new Set(unrelated.map((i) => i.fromList))
    expect(lists.size).toBe(4)
    for (const it of unrelated) {
      const l = p.slots.find((s) => s.list.id === it.fromList)!.list
      const pos = l.words.indexOf(it.word) + 1
      if (l.words.length === SHORT_LENGTH) expect(pos).toBeGreaterThanOrEqual(4), expect(pos).toBeLessThanOrEqual(7)
      else expect(pos).toBeGreaterThanOrEqual(6), expect(pos).toBeLessThanOrEqual(15)
    }
    expect(items.filter((i) => i.type === 'critical-studied').map((i) => i.word).sort()).toEqual(p.studied.map((l) => l.critical!).sort())
    expect(items.filter((i) => i.type === 'critical-control').map((i) => i.word).sort()).toEqual(p.controls.map((l) => l.critical!).sort())
  })
  it('a studied list of associates lost to a restart moves to the controls', () => {
    const p = planPart1(12)
    const lost = p.slots.find((s) => s.list.kind === 'associates')!
    const studiedLists = p.slots.map((s) => (s.slot === lost.slot ? p.reserves.short[0] : s.list))
    const items = planRecognition(p, studiedLists)
    expect(items.filter((i) => i.type === 'associates-studied').length).toBe(6)
    expect(items.filter((i) => i.type === 'critical-studied').length).toBe(2)
    expect(items.filter((i) => i.type === 'critical-control').map((i) => i.word)).toContain(lost.list.critical)
    expect(items.filter((i) => i.type === 'critical-control').length).toBe(4)
    expect(items.length).toBe(RECOGNITION_ITEMS - 3)
  })
  it('scoring: the proportion called old by type, split by remember and know', () => {
    const items = planRecognition(planPart1(13))
    const answers: (RecognitionAnswer | null)[] = items.map((it, i) => {
      if (it.type === 'new') return { old: false, judgment: null }
      if (it.type === 'critical-studied') return { old: true, judgment: 'know' }
      return { old: true, judgment: i % 2 ? 'remember' : 'know' }
    })
    expect(allRecognitionAnswered(answers)).toBe(true)
    const s = scoreRecognition(items, answers)
    expect(s.map((x) => x.type)).toEqual(ITEM_TYPES)
    const by = (t: string) => s.find((x) => x.type === t)!
    expect(by('new').old).toBe(0)
    expect(by('new').falseAlarms).toBe(0)
    expect(by('critical-studied').old).toBe(1)
    expect(by('critical-studied').know).toBe(1)
    expect(by('critical-studied').remember).toBe(0)
    expect(by('critical-studied').falseAlarms).toBe(3)
    expect(by('associates-studied').old).toBe(1)
    expect(by('associates-studied').remember + by('associates-studied').know).toBeCloseTo(1, 10)
    expect(by('associates-studied').hits).toBe(9)
    answers[0] = null
    expect(allRecognitionAnswered(answers)).toBe(false)
    answers[0] = { old: true, judgment: null }
    expect(allRecognitionAnswered(answers)).toBe(false)
  })
})
