import type { CSSProperties } from 'react'
import { fmtSigned } from '../../../components/format'
import { Section } from '../../../components/Section'
import { describeCriterion } from '../../../sim/fish/sdt'
import { referenceById } from '../../../sim/memory/references'
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
 * every item as a table of checks and crosses with what the student said; Brewer and
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

const OUTCOME_PLURAL: Record<Outcome, string> = { hit: 'hits', miss: 'misses', falseAlarm: 'false alarms', correctRejection: 'correct rejections' }

export function ConfidenceLines({ score }: { score: ChecklistScore }) {
  const outcomes: Outcome[] = ['hit', 'miss', 'falseAlarm', 'correctRejection']
  return (
    <FixedLines
      testId="confidence"
      lines={[
        ...outcomes.map((o) => `${`Mean confidence, ${OUTCOME_PLURAL[o]}`.padEnd(42)}${conf(score.confidence[o])}`),
        `${'Mean confidence, items that fit'.padEnd(42)}${conf(score.fitting.meanConfidence)}`,
        `${'Mean confidence, items that do not fit'.padEnd(42)}${conf(score.unfitting.meanConfidence)}`,
      ]}
    />
  )
}

/** A green check or a red cross, with its meaning for a screen reader. */
function Mark({ yes, label }: { yes: boolean; label: string }) {
  return (
    <span aria-label={label} title={label} style={{ color: yes ? 'var(--actuator)' : 'var(--avoid)', fontWeight: 700, fontSize: 13 }} data-mark={yes ? 'yes' : 'no'}>
      {yes ? '✓' : '✗'}
    </span>
  )
}

/** Every item as a table (Jon, 2026-10-27): was it in the room, does it fit, what you said, how sure, and the outcome. */
export function ItemRows({ score }: { score: ChecklistScore }) {
  const th: CSSProperties = { fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textAlign: 'left', padding: '2px 6px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }
  const td: CSSProperties = { fontSize: 11.5, padding: '2px 6px', whiteSpace: 'nowrap', verticalAlign: 'middle' }
  const mid: CSSProperties = { ...td, textAlign: 'center' }
  return (
    <table style={{ borderCollapse: 'collapse', width: '100%' }} data-item-rows>
      <thead>
        <tr>
          <th style={th}>Item</th>
          <th style={{ ...th, textAlign: 'center' }}>In the room</th>
          <th style={{ ...th, textAlign: 'center' }}>Fits a dorm room</th>
          <th style={{ ...th, textAlign: 'center' }}>You said</th>
          <th style={{ ...th, textAlign: 'center' }}>How sure</th>
          <th style={th}>Outcome</th>
        </tr>
      </thead>
      <tbody>
        {score.rows.map((r) => {
          const present = r.type.startsWith('present')
          const fits = r.type.endsWith('-fitting')
          return (
            <tr key={r.id} data-item-row={r.id}>
              <td style={td}>{r.name.replace(/^an? /, '')}</td>
              <td style={mid}>
                <Mark yes={present} label={present ? 'in the room' : 'not in the room'} />
              </td>
              <td style={mid}>
                <Mark yes={fits} label={fits ? 'fits a dorm room' : 'does not fit a dorm room'} />
              </td>
              <td style={mid}>{r.inRoom ? 'in' : 'not in'}</td>
              <td style={mid}>{r.confidence}</td>
              <td style={td}>{OUTCOME_LABEL[r.outcome]}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
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
      <div style={{ height: 8 }} aria-hidden />
      <RoomScorecard score={score.unfitting} />
      <GroupLabel>Confidence</GroupLabel>
      <Note>Confidence was 1 {CONFIDENCE_LABELS[1]}, 2 {CONFIDENCE_LABELS[2]}, 3 {CONFIDENCE_LABELS[3]}, 4 {CONFIDENCE_LABELS[4]}.</Note>
      <ConfidenceLines score={score} />
      <GroupLabel>Every item</GroupLabel>
      <Note>Each item: whether it was in the room, whether it fits a dorm room, what you said, how sure you were, and the outcome. The room is open to orbit in the view, with each item in it labeled by name: drag to orbit, scroll to zoom.</Note>
      <ItemRows score={score} />
      <FixedLines lines={[`Room shown for ${result.roomSeconds.toFixed(1)} s by the clock`, `Arrangement ${result.arrangement}`]} />
      <Section title="By hand" defaultOpen={false} hint="Lab 7’s box: type four counts, get the rates, d′ and the criterion.">
        <ByHandBox initial={{ hits: 0, misses: 0, falseAlarms: 0, correctRejections: 0 }} note="Type the four counts from one of the scorecards above, or any four, to see how the rates, d′ and the criterion come out. z(·) is how many spreads from the middle of a bell curve a rate lies. A rate of exactly 0 or 1 has no z, so it is counted as half a response short of the end." />
      </Section>
      <ReferencePanel reference={referenceById('brewer1981')} />
    </div>
  )
}
