import type { CSSProperties } from 'react'
import { fmtSigned } from '../../../components/format'
import { Section } from '../../../components/Section'
import { describeCriterion } from '../../../sim/fish/sdt'
import { referenceById } from '../../../sim/memory/references'
import { ITEM_TYPE_LABEL } from '../../../sim/memory/room/arrangements'
import { CONFIDENCE_LABELS, OUTCOME_LABEL, type ChecklistScore, type KindScore, type Outcome, type Part3Result } from '../../../sim/memory/room/checklist'
import { ByHandBox } from '../../m07_fish/DecisionTab'
import { SDT_NAMES } from '../../m07_fish/labels'
import { CORRECTION_LINE } from '../../m08_objects/lines'
import { RESTARTED_LINE } from '../lines'
import { Content, FixedLines, GroupLabel, Note, ReferencePanel } from '../ui'

/**
 * Part 3's reveal (spec §7.4), shown only after the checklist is complete:
 * Lab 7's four-outcome scorecard twice, once for the items that fit a dorm
 * room and once for those that do not, each with hit and false-alarm
 * rates, d′ and the criterion; mean confidence by outcome and by kind;
 * every item with what it was and what the student said; Brewer and
 * Treyens's result beside it, labeled with how their procedure differed;
 * and the room itself, free to orbit in the view, with each listed item
 * marked. The words that name the hypothesis (schema, typical, fitting,
 * consistent) live in this file and nowhere a student sees before the
 * commit.
 */

const KIND_TITLE = { fitting: 'Items that fit a dorm room (schema-consistent)', unfitting: 'Items that do not fit (schema-inconsistent)' } as const

export function RoomScorecard({ score }: { score: KindScore }) {
  const r = score.byHand
  const c = score.counts
  const cell: CSSProperties = { border: '1px solid var(--border)', padding: '4px 6px', fontSize: 11.5, textAlign: 'center' }
  const head: CSSProperties = { ...cell, color: 'var(--text-muted)', fontSize: 10 }
  const big: CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 14, display: 'block' }
  return (
    <div data-scorecard={score.kind} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ fontSize: 12 }}>
        <b>{KIND_TITLE[score.kind]}</b>
      </div>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <tbody>
          <tr>
            <td style={head} />
            <td style={head}>said in the room</td>
            <td style={head}>said not in the room</td>
          </tr>
          <tr>
            <td style={head}>was in the room</td>
            <td style={cell}>
              {SDT_NAMES.hit}
              <span style={big}>{c.hits}</span>
            </td>
            <td style={cell}>
              {SDT_NAMES.miss}
              <span style={big}>{c.misses}</span>
            </td>
          </tr>
          <tr>
            <td style={head}>was not in the room</td>
            <td style={cell}>
              {SDT_NAMES.falseAlarm}
              <span style={big}>{c.falseAlarms}</span>
            </td>
            <td style={cell}>
              {SDT_NAMES.correctRejection}
              <span style={big}>{c.correctRejections}</span>
            </td>
          </tr>
        </tbody>
      </table>
      <FixedLines lines={[`hit rate          ${r.hitRate.toFixed(2)}`, `false-alarm rate  ${r.falseAlarmRate.toFixed(2)}`, `d′                ${fmtSigned(r.dPrime)}`, `criterion         ${fmtSigned(r.criterion)} (${describeCriterion(r.criterion)})`]} />
      {score.repaired && <Note>{CORRECTION_LINE}</Note>}
    </div>
  )
}

const conf = (v: number | null) => (v === null ? '   —' : v.toFixed(2).padStart(4))

export function ConfidenceLines({ score }: { score: ChecklistScore }) {
  const outcomes: Outcome[] = ['hit', 'miss', 'falseAlarm', 'correctRejection']
  return (
    <FixedLines
      testId="confidence"
      lines={[
        ...outcomes.map((o) => `${`Mean confidence, ${OUTCOME_LABEL[o].toLowerCase()}s`.padEnd(42)}${conf(score.confidence[o])}`),
        `${'Mean confidence, items that fit'.padEnd(42)}${conf(score.fitting.meanConfidence)}`,
        `${'Mean confidence, items that do not fit'.padEnd(42)}${conf(score.unfitting.meanConfidence)}`,
      ]}
    />
  )
}

export function ItemRows({ score }: { score: ChecklistScore }) {
  return (
    <FixedLines testId="item-rows" lines={score.rows.map((r) => `${r.name.replace(/^an? /, '').padEnd(20)}${ITEM_TYPE_LABEL[r.type].padEnd(36)}${(r.inRoom ? 'in' : 'not').padEnd(5)}${String(r.confidence)}  ${OUTCOME_LABEL[r.outcome]}`)} />
  )
}

/** The whole reveal, for the right panel and for Part 0's gathering. */
export function RoomReveal({ result, score }: { result: Part3Result; score: ChecklistScore }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }} data-reveal="room">
      {result.restarted && <Content>{RESTARTED_LINE}</Content>}
      <Note>
        Half the things on the checklist were in the room and half were not. Half of each were typical of a dorm room and half were not: the kind of thing a schema for a dorm room would supply. The two scorecards below split the checklist that way.
      </Note>
      <GroupLabel>Scorecards</GroupLabel>
      <RoomScorecard score={score.fitting} />
      <RoomScorecard score={score.unfitting} />
      <GroupLabel>Confidence</GroupLabel>
      <Note>Confidence was 1 {CONFIDENCE_LABELS[1]}, 2 {CONFIDENCE_LABELS[2]}, 3 {CONFIDENCE_LABELS[3]}, 4 {CONFIDENCE_LABELS[4]}.</Note>
      <ConfidenceLines score={score} />
      <GroupLabel>Every item</GroupLabel>
      <Note>Name, what it was, what you said, how sure, and the outcome. The room is open to orbit in the view, with each item in it labeled: drag to orbit, scroll to zoom.</Note>
      <ItemRows score={score} />
      <FixedLines lines={[`Room shown for ${result.roomSeconds.toFixed(1)} s by the clock`, `Arrangement ${result.arrangement}`]} />
      <Section title="By hand" defaultOpen={false} hint="Lab 7’s box: type four counts, get the rates, d′ and the criterion.">
        <ByHandBox />
      </Section>
      <ReferencePanel reference={referenceById('brewer1981')} />
    </div>
  )
}
