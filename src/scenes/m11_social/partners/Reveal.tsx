import { Panel } from '../../../components/Panel'
import type { ProgressStore } from '../../../sim/social/progress/store'
import { unitOfMatch, PART1_PARTNERS } from '../../../sim/social/parts'
import { RULES, ruleById } from '../../../sim/social/game/rules'
import { bestTotal, informativeRounds } from '../../../sim/social/game/best'
import { referenceById } from '../../../sim/social/references'
import { BEST_TOTAL_LINE, PREDICTING_PLAYING_LINE, RESTARTED_LINE } from '../lines'
import { Btn, Content, DotPlot, FixedLines, GroupLabel, Note, ReferencePanel, RIGHT_STYLE, StagePanel, row } from '../ui'
import { DIAGNOSIS_UNIT, planPart1, type DiagnosisResult, type MatchResult } from './partnersStore'
import { PartnerDisc, recordLines } from './screens'

/**
 * Part 1's reveal (spec §5.5), rendered only once the diagnosis is
 * committed. This is the one file in `partners/` whose strings may name a
 * partner's rule. Everything before it is silent (`partners.test.tsx`).
 */

export interface PartnerRow {
  letter: string
  rule: string
  diagnosis: string
  right: boolean
  rounds: number
  points: number
  partnerPoints: number
  correct: number
  share: number
  best: number
  shareOfBest: number
  restarts: number
}

export function revealData(progress: ProgressStore, seed: number): { rows: PartnerRow[]; matches: MatchResult[] } | null {
  if (!progress.isComplete(DIAGNOSIS_UNIT)) return null
  const plan = planPart1(seed)
  const diagnosis = progress.result(DIAGNOSIS_UNIT) as DiagnosisResult
  const matches: MatchResult[] = []
  const rows: PartnerRow[] = []
  for (let i = 0; i < PART1_PARTNERS; i++) {
    if (!progress.isComplete(unitOfMatch(i))) return null
    const m = progress.result(unitOfMatch(i)) as MatchResult
    matches.push(m)
    const rule = ruleById(plan.rules[i])
    const correct = m.rounds.filter((r) => r.predicted === r.partner).length
    const points = m.rounds.reduce((a, r) => a + r.studentPoints, 0)
    const best = bestTotal(rule, m.rounds.length).total
    rows.push({
      letter: m.letter,
      rule: rule.label,
      diagnosis: ruleById(diagnosis.choices[i]).label,
      right: diagnosis.choices[i] === rule.id,
      rounds: m.rounds.length,
      points,
      partnerPoints: m.rounds.reduce((a, r) => a + r.partnerPoints, 0),
      correct,
      share: correct / m.rounds.length,
      best,
      shareOfBest: points / best,
      restarts: m.restarts,
    })
  }
  return { rows, matches }
}

/** The rows the report asks for: one per partner. */
export function resultRows(rows: PartnerRow[]): string[] {
  const head = `${'partner'.padEnd(9)}${'rounds'.padStart(7)}${'me'.padStart(5)}${'it'.padStart(5)}${'right'.padStart(7)}${'share'.padStart(7)}${'best'.padStart(6)}${'of best'.padStart(9)}`
  return [head, ...rows.map((r) => `${r.letter.padEnd(9)}${String(r.rounds).padStart(7)}${String(r.points).padStart(5)}${String(r.partnerPoints).padStart(5)}${String(r.correct).padStart(7)}${r.share.toFixed(2).padStart(7)}${String(r.best).padStart(6)}${r.shareOfBest.toFixed(2).padStart(9)}`)]
}

export function PartnersReveal({ progress, seed, onContinue }: { progress: ProgressStore; seed: number; onContinue?: () => void }) {
  const data = revealData(progress, seed)
  if (!data) return null
  const { rows, matches } = data
  const plan = planPart1(seed)
  const rightCount = rows.filter((r) => r.right).length
  return (
    <StagePanel wide testId="reveal">
      <div style={{ fontSize: 14, fontWeight: 600 }}>Part 1 — My results</div>
      <GroupLabel>1. Each partner’s rule, beside your diagnosis</GroupLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }} data-reveal-rules>
        {rows.map((r) => (
          <div key={r.letter} style={{ display: 'flex', alignItems: 'center', gap: 8 }} data-reveal-rule={r.letter}>
            <PartnerDisc letter={r.letter} size={22} />
            <span style={{ fontSize: 12.5 }}>
              <strong>{r.rule}</strong>
              {' — '}
              <span style={{ color: r.right ? 'var(--actuator)' : 'var(--avoid)' }}>{r.right ? 'you said the same' : `you said ${r.diagnosis}`}</span>
            </span>
          </div>
        ))}
      </div>
      <FixedLines lines={[`${'Diagnoses right'.padEnd(20)}${String(rightCount).padStart(2)} of 6`]} />
      <Note>
        Each rule, in words: {RULES.map((r) => `${r.label}: ${r.description}`).join('. ')}.
      </Note>
      <GroupLabel>2. Rounds, points, predictions correct, the best possible total, and your share of it</GroupLabel>
      <FixedLines lines={resultRows(rows)} testId="reveal-table" />
      <Content>{BEST_TOTAL_LINE}</Content>
      <GroupLabel>3. Predicting against playing</GroupLabel>
      <DotPlot points={rows.map((r) => ({ x: r.share, y: r.shareOfBest, label: `Partner ${r.letter}: predicted ${r.share.toFixed(2)}, share of best ${r.shareOfBest.toFixed(2)}` }))} xLabel="share of predictions correct" yLabel="share of the best total" xMax={1.05} yMax={1.05} width={360} height={200} />
      <FixedLines lines={rows.map((r) => row(`Partner ${r.letter}`, `predicted ${r.share.toFixed(2)}, of best ${r.shareOfBest.toFixed(2)}`, 12))} mono />
      <Content>{PREDICTING_PLAYING_LINE}</Content>
      <ReferencePanel reference={referenceById('riemer2025')} />
      <GroupLabel>4. The record of every match, with the rounds on which the six rules could be told apart marked *</GroupLabel>
      <Note>A round is marked when, given the rounds before it, the six rules would not all have made the same move. On an unmarked round every rule plays alike, so that round told you nothing.</Note>
      {matches.map((m, i) => {
        const marks = informativeRounds(RULES, m.rounds.map((r) => ({ student: r.student, partner: r.partner })))
        return (
          <div key={m.letter} style={{ display: 'flex', flexDirection: 'column', gap: 4 }} data-reveal-record={m.letter}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <PartnerDisc letter={m.letter} size={22} />
              <span style={{ fontSize: 12.5 }}>{ruleById(plan.rules[i]).label}</span>
              <FixedLines lines={[`informative rounds ${String(marks.filter(Boolean).length).padStart(2)} of ${m.rounds.length}`]} />
            </div>
            <FixedLines lines={recordLines(m.rounds, marks)} />
            {m.notes && <Note style={{ whiteSpace: 'pre-wrap' }}>Your notes: {m.notes}</Note>}
          </div>
        )
      })}
      {rows.some((r) => r.restarts > 0) && <Content>{RESTARTED_LINE} (Partners {rows.filter((r) => r.restarts > 0).map((r) => r.letter).join(', ')}.)</Content>}
      {onContinue && (
        <div>
          <Btn primary onClick={onContinue}>
            Continue to Part 2
          </Btn>
        </div>
      )}
    </StagePanel>
  )
}

/** The right column after the reveal: the rows the report asks for. */
export function PartnersRight({ progress, seed }: { progress: ProgressStore; seed: number }) {
  const data = revealData(progress, seed)
  if (!data) return null
  return (
    <Panel title="My results" style={RIGHT_STYLE}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <FixedLines lines={resultRows(data.rows)} testId="results-rows" />
        <FixedLines lines={data.rows.map((r) => `${`Partner ${r.letter}`.padEnd(11)}${r.rule.padEnd(36)}${r.right ? 'right' : 'wrong'}`)} />
      </div>
    </Panel>
  )
}

export function CompactResults({ progress, seed }: { progress: ProgressStore; seed: number }) {
  const data = revealData(progress, seed)
  if (!data) return null
  return <FixedLines lines={resultRows(data.rows)} />
}
