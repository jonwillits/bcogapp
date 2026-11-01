import { Panel } from '../../../components/Panel'
import type { ProgressStore } from '../../../sim/social/progress/store'
import { planSets, scoreSet, measures, type SetScore } from '../../../sim/social/groups/sets'
import { referenceById } from '../../../sim/social/references'
import { RESTARTED_LINE } from '../lines'
import { Content, DotPlot, FixedLines, GroupLabel, Note, ReferencePanel, RIGHT_STYLE, StagePanel, row } from '../ui'
import { ClassPanel } from '../ClassPanel'
import { SETS_UNIT, type SetsResult } from './groupsStore'

/**
 * Part 5's reveal (spec §9.3), rendered only once the unit is complete.
 * This is the one file in `groups/` whose strings may name what the part
 * tested: the labels, the boundary, stereotypes as categories (§11.2.13).
 */

export interface RevealData {
  labeled: SetScore
  unlabeled: SetScore
  names: [string, string]
  measures: ReturnType<typeof measures>
  restarts: number
}

export function revealData(progress: ProgressStore, seed: number): RevealData | null {
  if (!progress.isComplete(SETS_UNIT)) return null
  const r = progress.result(SETS_UNIT) as SetsResult
  const plan = planSets(seed, r.materials)
  const labeledSet = plan.sets.find((s) => s.which === 'labeled')!
  const unlabeledSet = plan.sets.find((s) => s.which === 'unlabeled')!
  const labeled = scoreSet(labeledSet, r.judgments)
  const unlabeled = scoreSet(unlabeledSet, r.judgments)
  return { labeled, unlabeled, names: plan.names, measures: measures(labeled, unlabeled), restarts: r.restarts }
}

const f1 = (x: number) => x.toFixed(1)

export function resultRows(d: RevealData): string[] {
  const L = d.labeled
  const U = d.unlabeled
  return [
    `${''.padEnd(40)}${'labeled'.padStart(9)}${'unlabeled'.padStart(11)}`,
    `${'Difference at the boundary, judged (px)'.padEnd(40)}${f1(L.boundary.judged).padStart(9)}${f1(U.boundary.judged).padStart(11)}`,
    `${'Difference at the boundary, true (px)'.padEnd(40)}${f1(L.boundary.truth).padStart(9)}${f1(U.boundary.truth).padStart(11)}`,
    `${'Boundary, judged as a share of true'.padEnd(40)}${d.measures.boundary.labeled.toFixed(2).padStart(9)}${d.measures.boundary.unlabeled.toFixed(2).padStart(11)}`,
    `${'Other neighboring differences, judged (px)'.padEnd(40)}${f1(L.others.judged).padStart(9)}${f1(U.others.judged).padStart(11)}`,
    `${'Other neighboring differences, true (px)'.padEnd(40)}${f1(L.others.truth).padStart(9)}${f1(U.others.truth).padStart(11)}`,
    `${'Spread within the shorter four, judged (px)'.padEnd(40)}${f1(L.spread.shorter.judged).padStart(9)}${f1(U.spread.shorter.judged).padStart(11)}`,
    `${'Spread within the taller four, judged (px)'.padEnd(40)}${f1(L.spread.taller.judged).padStart(9)}${f1(U.spread.taller.judged).padStart(11)}`,
    `${'Spread within each four, true (px)'.padEnd(40)}${f1(L.spread.shorter.truth).padStart(9)}${f1(U.spread.shorter.truth).padStart(11)}`,
    `${'Spread, judged as a share of true'.padEnd(40)}${d.measures.spread.labeled.toFixed(2).padStart(9)}${d.measures.spread.unlabeled.toFixed(2).padStart(11)}`,
  ]
}

export function GroupsReveal({ progress, seed }: { progress: ProgressStore; seed: number }) {
  const d = revealData(progress, seed)
  if (!d) return null
  const pts = (s: SetScore, color: string) => s.truth.map((t, k) => ({ x: t, y: s.judged[k], color }))
  const max = Math.max(...d.labeled.truth, ...d.unlabeled.truth, ...d.labeled.judged, ...d.unlabeled.judged) * 1.1
  return (
    <StagePanel wide testId="reveal">
      <div style={{ fontSize: 14, fontWeight: 600 }}>Part 5 — My results</div>
      <Note>
        One group came with names, <strong>{d.names[0]}</strong> for its four shortest members and <strong>{d.names[1]}</strong> for its four tallest; the other came with none. The question is whether the names widened the judged difference between the two groups at the boundary, the step between the tallest {d.names[0]} and the shortest {d.names[1]}, against the same step in the group with no names, and whether they narrowed the spread of judged heights within each group of four.
      </Note>
      <GroupLabel>Judged height against true height, both groups</GroupLabel>
      <DotPlot points={[...pts(d.labeled, 'var(--sensor)'), ...pts(d.unlabeled, 'var(--accent)')]} xLabel="true height, px" yLabel="judged height, px" xMax={max} yMax={max} width={360} height={220} legend={[{ label: 'with names', color: 'var(--sensor)' }, { label: 'without names', color: 'var(--accent)' }]} />
      <GroupLabel>The difference at the boundary and the spread within groups, as aligned rows</GroupLabel>
      <FixedLines lines={resultRows(d)} testId="groups-rows" />
      <FixedLines lines={[row('Boundary widened by the names (labeled minus unlabeled, as shares)', d.measures.boundary.labeled - d.measures.boundary.unlabeled, 70), row('Spread within groups, labeled minus unlabeled, as shares', d.measures.spread.labeled - d.measures.spread.unlabeled, 70)]} testId="groups-effect" />
      <Content>One student’s judgments are noisy. Tajfel and Wilkes found the difference between classes widened more reliably than the spread within them narrowed; this is to be confirmed from the source.</Content>
      <ReferencePanel reference={referenceById('tajfel1963')} />
      <ClassPanel entryId="groups-boundary" own={[d.measures.boundary.labeled, d.measures.boundary.unlabeled]} xLabel="labeled: boundary, share of true" yLabel="unlabeled: the same" equalLine />
      <ClassPanel entryId="groups-spread" own={[d.measures.spread.labeled, d.measures.spread.unlabeled]} xLabel="labeled: spread within groups, share of true" yLabel="unlabeled: the same" equalLine />
      <GroupLabel>The connection</GroupLabel>
      <Note style={{ color: 'var(--text)' }}>A stereotype is a set of beliefs about the typical members of a social group, applied to an individual because of the group the individual belongs to, and stereotypes work like the categories of Module 7. The reading says they typically exaggerate differences between groups and underestimate the variation within them, and that the risk lies in applying a category where it does not fit (§11.2.13). The names here were labels on an invented animal and nothing more; whatever they did to your judgments, they did by labeling alone.</Note>
      {d.restarts > 0 && <Content>{RESTARTED_LINE}</Content>}
    </StagePanel>
  )
}

export function GroupsRight({ progress, seed }: { progress: ProgressStore; seed: number }) {
  const d = revealData(progress, seed)
  if (!d) return null
  return (
    <Panel title="My results" style={RIGHT_STYLE}>
      <FixedLines lines={resultRows(d)} testId="results-rows" />
    </Panel>
  )
}

export function CompactResults({ progress, seed }: { progress: ProgressStore; seed: number }) {
  const d = revealData(progress, seed)
  if (!d) return null
  return <FixedLines lines={resultRows(d)} />
}
