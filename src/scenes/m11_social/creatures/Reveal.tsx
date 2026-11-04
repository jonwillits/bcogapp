import { Panel } from '../../../components/Panel'
import { referenceById } from '../../../sim/social/references'
import type { RoundScores } from '../../../sim/social/creatures/scoring'
import { ClassPanel } from '../ClassPanel'
import { APPLYING_LINE, BEST_ASSIGNMENT_LINE, ONE_STUDENT_LINE, ORDER_LINE } from '../lines'
import { Content, FixedLines, GroupLabel, Note, ReferencePanel, RIGHT_STYLE, StagePanel, useStore } from '../ui'
import { PREDICTIONS } from './later'
import type { CreaturesStore } from './store'

/**
 * Part 5's reveal (PART5_REDESIGN_2026-11-04.md §7): the table of both
 * rounds' scores, the plot, the order line, the pending class and
 * reference panels, and the connection, which is the first place
 * *stereotype* appears in the part. Rendered only once both rounds are
 * complete and the predictions committed.
 */

const f2 = (x: number) => x.toFixed(2)
const pct = (x: number) => `${Math.round(100 * x)}%`

export function resultRows(r1: RoundScores, r2: RoundScores): string[] {
  const row = (label: string, a: number, b: number, fmt: (x: number) => string, change: (d: number) => string) => `${label.padEnd(40)}${fmt(a).padStart(9)}${fmt(b).padStart(9)}${change(b - a).padStart(10)}`
  const dPct = (d: number) => `${d >= 0 ? '+' : '−'}${Math.round(100 * Math.abs(d))}%`
  const dNum = (d: number) => `${d >= 0 ? '+' : '−'}${f2(Math.abs(d))}`
  return [
    `${''.padEnd(40)}${'Round 1'.padStart(9)}${'Round 2'.padStart(9)}${'change'.padStart(10)}`,
    row('Hit rate (old members called Seen before)', r1.hitRate, r2.hitRate, pct, dPct),
    row('False alarms to a changed detail', r1.falseAlarmRateChanged, r2.falseAlarmRateChanged, pct, dPct),
    row('False alarms to a new member of a group', r1.falseAlarmRateNew, r2.falseAlarmRateNew, pct, dPct),
    row('d′ for individuals', r1.dPrime, r2.dPrime, f2, dNum),
    row('Sorting accuracy', r1.sortingAccuracy, r2.sortingAccuracy, pct, dPct),
  ]
}

/** Paired bars: four measures, each with Round 1 beside Round 2. */
function PairedBars({ r1, r2 }: { r1: RoundScores; r2: RoundScores }) {
  const measures: { label: string; a: number; b: number }[] = [
    { label: 'hits', a: r1.hitRate, b: r2.hitRate },
    { label: 'false alarms, changed', a: r1.falseAlarmRateChanged, b: r2.falseAlarmRateChanged },
    { label: 'false alarms, new', a: r1.falseAlarmRateNew, b: r2.falseAlarmRateNew },
    { label: 'sorting', a: r1.sortingAccuracy, b: r2.sortingAccuracy },
  ]
  const width = 420
  const height = 200
  const pad = { l: 36, r: 10, t: 10, b: 40 }
  const slot = (width - pad.l - pad.r) / measures.length
  const bar = slot * 0.3
  const Y = (v: number) => height - pad.b - v * (height - pad.t - pad.b)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }} data-bars>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block', background: 'var(--bg)', borderRadius: 8, maxWidth: '100%' }} role="img" aria-label="the three memory rates and the sorting accuracy, Round 1 beside Round 2">
        <line x1={pad.l} y1={Y(0)} x2={width - pad.r} y2={Y(0)} stroke="var(--border)" />
        <line x1={pad.l} y1={Y(1)} x2={pad.l} y2={Y(0)} stroke="var(--border)" />
        {[0, 0.5, 1].map((v) => (
          <text key={v} x={pad.l - 4} y={Y(v) + 3} fontSize={9} textAnchor="end" fill="var(--text-muted)">
            {pct(v)}
          </text>
        ))}
        {measures.map((m, i) => {
          const x0 = pad.l + i * slot + slot * 0.18
          return (
            <g key={m.label} data-measure={m.label}>
              <rect x={x0} y={Y(m.a)} width={bar} height={Y(0) - Y(m.a)} fill="var(--sensor)" rx={2} />
              <rect x={x0 + bar + 4} y={Y(m.b)} width={bar} height={Y(0) - Y(m.b)} fill="var(--accent)" rx={2} />
              <text x={x0 + bar + 2} y={height - pad.b + 12} fontSize={9} textAnchor="middle" fill="var(--text-muted)">
                {m.label}
              </text>
            </g>
          )
        })}
      </svg>
      <div style={{ display: 'flex', gap: 12, fontSize: 10.5, color: 'var(--text-muted)' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 10, height: 10, background: 'var(--sensor)', display: 'inline-block', borderRadius: 2 }} /> Round 1
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 10, height: 10, background: 'var(--accent)', display: 'inline-block', borderRadius: 2 }} /> Round 2
        </span>
      </div>
    </div>
  )
}

export function CreaturesReveal({ store }: { store: CreaturesStore }) {
  const s = useStore(store)
  const sc = s.scores()
  if (!sc) return null
  const { round1: r1, round2: r2 } = sc
  const r0 = s.roundResult(0)!
  const rr = s.roundResult(1)!
  const predicted = PREDICTIONS.map((p) => `${p.question.slice(0, 44).padEnd(46)}${s.progress.prediction(p.key) ?? '—'}`)
  return (
    <StagePanel wide testId="reveal">
      <div style={{ fontSize: 14, fontWeight: 600 }}>Part 5 — My results</div>
      <Note style={{ color: 'var(--text)' }}>Round 1 asked you to remember individual members, and Round 2 asked you to learn two groups. Both rounds then tested the same things in the same order: whether you could tell the members you were shown from members with one detail changed and from new members of the same groups, and whether you could sort the members into the two groups. The groups were the same in both rounds: six shorter members and six taller ones, with a gap between. The marks on the members said nothing about their group.</Note>
      <GroupLabel>Your predictions</GroupLabel>
      <FixedLines lines={predicted} testId="predicted" />
      <GroupLabel>The five scores, Round 1 beside Round 2</GroupLabel>
      <FixedLines lines={resultRows(r1, r2)} testId="scores" />
      <Note>
        Round 1’s sorting used your own Kind 1 and Kind 2: {r1.kindOneIsTall ? 'Kind 1 is taken as the taller group' : 'Kind 1 is taken as the shorter group'}. You said {r0.answers.noticed === 'yes' ? 'yes' : 'no'} to having noticed the two kinds. In the showings, you answered right on {r1.trainingRight} of {r1.trainingTrials} in Round 1 and {r2.trainingRight} of {r2.trainingTrials} in Round 2.
      </Note>
      <Content>{BEST_ASSIGNMENT_LINE}</Content>
      <GroupLabel>The three memory rates and the sorting accuracy, as bars</GroupLabel>
      <PairedBars r1={r1} r2={r2} />
      <Content>{ORDER_LINE}</Content>
      <Content>{ONE_STUDENT_LINE}</Content>
      <ClassPanel entryId="creatures-memory" own={[r1.dPrime, r2.dPrime]} xLabel="Round 1: d′ for individuals" yLabel="Round 2: d′ for individuals" equalLine />
      <ClassPanel entryId="creatures-sorting" own={[r1.sortingAccuracy, r2.sortingAccuracy]} xLabel="Round 1: sorting accuracy" yLabel="Round 2: sorting accuracy" equalLine />
      <ReferencePanel reference={referenceById('creatures-sources')} />
      <GroupLabel>The connection</GroupLabel>
      <Note style={{ color: 'var(--text)' }}>A stereotype is a set of beliefs about the typical members of a social group, applied to an individual because of the group the individual belongs to, and the reading says stereotypes work like the categories of Module 7 (§11.2.13). Two things follow, and this part was built to show them. First, a category for people is learned the way other categories are: in Round 2 you learned two groups of an invented animal from showings with feedback, with nothing social about them. Second, how much a category shapes what is remembered about its members depends on whether categorizing was the goal: with the goal of telling individuals apart, attention spreads across the features that make each one unique; with the goal of learning the groups, it concentrates on what separates the groups, and memory for the individuals’ own details gives way (Nosofsky, 1986, for identification against categorization; Hamilton, Katz, and Leirer, 1980, for a memory goal against an impression goal).</Note>
      <Note style={{ color: 'var(--text)' }}>A third point is different from those two. Once a category exists, it is sometimes applied when the task does not call for it: Taylor and colleagues (1978) found that people listening to a discussion confused who had said what more often within a social category than across categories, with no instruction to categorize anyone. That is a category already learned being used; the first two points are about how one is learned and what the learning costs.</Note>
      <Content>{APPLYING_LINE}</Content>
      {(r0.restarts > 0 || rr.restarts > 0) && <Content>{`${r0.restarts > 0 ? 'Round 1' : 'Round 2'}${r0.restarts > 0 && rr.restarts > 0 ? ' and Round 2' : ''} was interrupted and run again with other members.${s.restartedAfterSurprise ? ' Round 1’s restart came after its two kinds had been named, so you already knew about the kinds when it ran again.' : ''}`}</Content>}
    </StagePanel>
  )
}

export function CreaturesRight({ store }: { store: CreaturesStore }) {
  const s = useStore(store)
  const sc = s.scores()
  if (!sc) return null
  return (
    <Panel title="My results" style={RIGHT_STYLE}>
      <FixedLines lines={resultRows(sc.round1, sc.round2)} testId="results-rows" />
    </Panel>
  )
}

export function CompactResults({ store }: { store: CreaturesStore }) {
  const sc = store.scores()
  if (!sc) return null
  return <FixedLines lines={resultRows(sc.round1, sc.round2)} />
}
