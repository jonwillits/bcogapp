import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ProgressStore } from '../../../sim/social/progress/store'
import type { RawStorage } from '../../../sim/social/progress/storage'
import { RULES, ruleById, type Move } from '../../../sim/social/game/rules'
import { bestTotal } from '../../../sim/social/game/best'
import { unitOfMatch } from '../../../sim/social/parts'
import { PartnersStore, lengthFor, planPart1, LETTERS, MIN_ROUNDS, MAX_ROUNDS } from './partnersStore'
import { PartnersLeft, PartnersStage, PartnersRightBefore, PARTNERS_WILL_DO, DIAGNOSIS_WILL_DO } from './screens'
import { PartnersReveal, PartnersRight, revealData } from './Reveal'

/**
 * Part 1's acceptance tests (spec §13 items 1 and 4, §16): no partner's
 * move before the round's two choices are committed together; no rule
 * name, and no description before the diagnosis; each match is a unit that
 * restarts with the same partner and a new length; the reveal shows the
 * rules, the table and the best totals; the same seed reproduces the plan.
 */

function memoryStorage(): RawStorage & { text: string | null } {
  const box = { text: null as string | null, read: () => box.text, write: (t: string) => ((box.text = t), true) }
  return box
}

const ctxOf = (store: PartnersStore) => ({ store, progress: store.progress, header: null, seed: store.seed }) as never
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;|&quot;/g, "'").replace(/\s+/g, ' ')
const render = (store: PartnersStore) => ({ stage: renderToStaticMarkup(<PartnersStage ctx={ctxOf(store)} />), left: renderToStaticMarkup(<PartnersLeft ctx={ctxOf(store)} />), right: renderToStaticMarkup(<PartnersRightBefore store={store} />) })

const RULE_WORDS = /tit-for-tat|grudger|grim|win-stay|lose-shift|pavlov|always cooperate|always defect|suspicious|defect forever/i

function make(seed: number, box = memoryStorage()) {
  const progress = new ProgressStore(box, seed)
  return { store: new PartnersStore(seed, progress), progress, box }
}

/** Play a whole match with a scripted sequence of the student's moves, predicting C every round. */
function playMatch(store: PartnersStore, partner: number, mine: (k: number) => Move) {
  store.startMatch(partner)
  let k = 0
  while (store.state === 'match') {
    store.choosePredicted('C')
    store.chooseMine(mine(k++))
    store.commitRound()
  }
  expect(store.state).toBe('match-over')
  store.saveMatch()
}

describe('the plan', () => {
  it('the seed assigns the six rules to the six letters, one each, and a match is 15 to 17 rounds with a new length on a restart', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const plan = planPart1(seed)
      expect(new Set(plan.rules).size).toBe(6)
      for (let i = 0; i < 6; i++) {
        const n = lengthFor(seed, i, 0)
        expect(n).toBeGreaterThanOrEqual(MIN_ROUNDS)
        expect(n).toBeLessThanOrEqual(MAX_ROUNDS)
      }
    }
    expect(planPart1(7)).toEqual(planPart1(7))
    expect(planPart1(7).rules.join()).not.toBe(planPart1(8).rules.join())
    const lengths = new Set(Array.from({ length: 10 }, (_, r) => lengthFor(3, 0, r)))
    expect(lengths.size).toBeGreaterThan(1)
  })
})

describe('commit, then reveal (§13, item 1)', () => {
  it('the instruction screen names no rule, no exact length, and no partner’s nature; it says about 16 rounds, varying from match to match', () => {
    const { store } = make(5)
    const { stage, left } = render(store)
    expect(stage).toMatch(/data-instruction/)
    for (const line of PARTNERS_WILL_DO) expect(line).not.toMatch(RULE_WORDS)
    expect(text(stage)).not.toMatch(RULE_WORDS)
    expect(text(left)).not.toMatch(RULE_WORDS)
    expect(text(stage)).toMatch(/about 16 rounds, but the exact number varies from match to match/)
    expect(text(stage)).not.toMatch(/\b1[57] rounds\b/)
  })
  it('during a match, no partner move for the round in hand is in the markup before the two choices are committed, and after the commit the round is shown', () => {
    const { store } = make(5)
    store.begin()
    store.startMatch(0)
    let m = render(store)
    expect(m.stage).toMatch(/data-choice="predicted"/)
    expect(m.stage).toMatch(/data-choice="mine"/)
    expect(m.stage).not.toMatch(/data-last-round|data-lit/)
    expect(text(m.stage)).not.toMatch(RULE_WORDS)
    store.choosePredicted('C')
    m = render(store)
    expect(m.stage).not.toMatch(/data-last-round/)
    expect(m.left).not.toMatch(/data-lit/)
    store.chooseMine('D')
    store.commitRound()
    m = render(store)
    expect(m.stage).toMatch(/Last round/)
    expect(m.left).toMatch(/data-lit="true"/)
    expect(store.rounds.length).toBe(1)
    expect(store.rounds[0].student).toBe('D')
    expect(text(m.stage)).not.toMatch(RULE_WORDS)
    expect(text(m.left)).not.toMatch(RULE_WORDS)
  })
  it('the partner’s move comes from its rule on the history before the round, whatever the student chooses this round', () => {
    const { store } = make(9)
    store.begin()
    store.startMatch(2)
    const rule = store.ruleOf(2)
    const history: { student: Move; partner: Move }[] = []
    let k = 0
    while (store.state === 'match') {
      const mine: Move = k % 3 === 0 ? 'D' : 'C'
      store.choosePredicted('D')
      store.chooseMine(mine)
      const before = store.rounds.length
      store.commitRound()
      expect(store.rounds.length).toBe(before + 1)
      const r = store.rounds[before]
      // Recompute from the rule and the history alone.
      const last = history[history.length - 1]
      const previous = last ? (`${last.partner}${last.student}` as 'CC' | 'CD' | 'DC' | 'DD') : null
      const want = previous === null ? rule.first : rule.after[previous]
      expect(r.partner).toBe(want === 1 ? 'C' : 'D')
      history.push({ student: r.student, partner: r.partner })
      k++
    }
    expect(store.rounds.length).toBe(store.length)
  })
  it('before the diagnosis is committed, no rule name is anywhere in Part 1; the diagnosis screen holds the six descriptions and no names', () => {
    const { store } = make(11)
    store.begin()
    for (let i = 0; i < 6; i++) playMatch(store, i, (k) => (k % 2 ? 'D' : 'C'))
    expect(store.state).toBe('diagnosis-intro')
    let m = render(store)
    expect(m.stage).toMatch(/data-instruction/)
    for (const line of DIAGNOSIS_WILL_DO) expect(line).not.toMatch(RULE_WORDS)
    expect(text(m.stage) + text(m.left) + text(m.right)).not.toMatch(RULE_WORDS)
    store.beginDiagnosis()
    m = render(store)
    expect(m.stage).toMatch(/data-stage="diagnosis"/)
    for (const r of RULES) expect(text(m.stage)).toContain(r.description.slice(0, 30))
    expect(text(m.stage) + text(m.left) + text(m.right)).not.toMatch(RULE_WORDS)
    expect(m.stage).toMatch(/Commit my diagnosis/)
    expect(m.stage).not.toMatch(/data-reveal/)
    for (let i = 0; i < 6; i++) store.diagnose(i, 'tft')
    store.commitDiagnosis()
    expect(store.state).toBe('revealed')
    const reveal = renderToStaticMarkup(<PartnersReveal progress={store.progress} seed={store.seed} />)
    expect(reveal).toMatch(/data-stage="reveal"/)
    for (const r of RULES) expect(reveal).toContain(r.label)
    expect(reveal).toMatch(/you said the same|you said/)
    expect(reveal).toMatch(/The best possible total is computed with the match’s length/)
    expect(reveal).toMatch(/Predicting a partner well and playing well against it are different/)
    expect(reveal).toMatch(/data-reveal-record="A"/)
    const right = renderToStaticMarkup(<PartnersRight progress={store.progress} seed={store.seed} />)
    expect(right).toMatch(/data-lines="results-rows"/)
  })
})

describe('units (§4.1)', () => {
  it('an interrupted match restarts with the same partner from round 1, with a new length, and the restart is counted; a finished match is saved and not played again', () => {
    const box = memoryStorage()
    const a = make(13, box)
    a.store.begin()
    a.store.startMatch(1)
    a.store.choosePredicted('C')
    a.store.chooseMine('C')
    a.store.commitRound()
    const firstLength = a.store.length
    // Reload: the match was in progress and is discarded.
    const b = make(13, box)
    expect(b.store.state).toBe('choose')
    expect(b.progress.restarts(unitOfMatch(1))).toBe(1)
    expect(b.store.matchDone(1)).toBe(false)
    b.store.startMatch(1)
    expect(b.store.rounds.length).toBe(0)
    expect(b.store.length).toBe(lengthFor(13, 1, 1))
    void firstLength
    playMatch(b.store, 1, () => 'C')
    expect(b.store.matchDone(1)).toBe(true)
    const c = make(13, box)
    expect(c.store.matchDone(1)).toBe(true)
    expect(c.store.result(1)!.restarts).toBe(1)
    c.store.startMatch(1)
    expect(c.store.state).toBe('choose')
  })
  it('the notes box is saved with the match, capped in length', () => {
    const { store } = make(2)
    store.begin()
    store.startMatch(0)
    store.setNotes('cooperates after I do '.repeat(200))
    expect(store.notes.length).toBe(1500)
    while (store.state === 'match') {
      store.choosePredicted('C')
      store.chooseMine('C')
      store.commitRound()
    }
    store.saveMatch()
    expect(store.result(0)!.notes.length).toBe(1500)
  })
})

describe('the reveal’s numbers', () => {
  it('the table has one row per partner with the best total from the dynamic program, and the share of predictions correct', () => {
    const { store } = make(21)
    store.begin()
    for (let i = 0; i < 6; i++) playMatch(store, i, () => 'C')
    store.beginDiagnosis()
    for (let i = 0; i < 6; i++) store.diagnose(i, planPart1(21).rules[i])
    store.commitDiagnosis()
    const data = revealData(store.progress, 21)!
    expect(data.rows.length).toBe(6)
    expect(data.rows.every((r) => r.right)).toBe(true)
    for (let i = 0; i < 6; i++) {
      const r = data.rows.find((x) => x.letter === LETTERS[i])!
      expect(r.best).toBe(bestTotal(ruleById(planPart1(21).rules[i]), r.rounds).total)
      expect(r.share).toBeGreaterThanOrEqual(0)
      expect(r.share).toBeLessThanOrEqual(1)
      expect(r.points).toBeLessThanOrEqual(r.best)
    }
    // Against always-cooperate the best total is 5 a round (defecting throughout), so cooperating throughout scores 3 of 5 of it.
    const allc = data.rows[planPart1(21).rules.indexOf('allc')]
    expect(allc.shareOfBest).toBeCloseTo(0.6, 9)
    expect(allc.share).toBe(1)
  })
})
