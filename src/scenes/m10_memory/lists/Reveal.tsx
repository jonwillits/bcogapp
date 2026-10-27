import { Panel } from '../../../components/Panel'
import type { ProgressStore } from '../../../sim/memory/progress/store'
import { referenceById } from '../../../sim/memory/references'
import { listById, UNRELATED_LENGTH } from '../../../sim/memory/words/lists'
import { classifyAll, conditionOf, criticalRecalled, orderOfOutput, priorListIntrusions, serialPositionCurves, type Condition, type RecallRecord } from '../../../sim/memory/words/scoring'
import { ITEM_TYPES, ITEM_TYPE_LABEL, scoreRecognition, type ItemType, type RecognitionAnswer, type RecognitionItem, type TypeScore } from '../../../sim/memory/words/recognition'
import { READING_PRINTS_LINE, RESTARTED_LINE } from '../lines'
import { Content, FixedLines, GroupLabel, Note, ReferencePanel, RIGHT_STYLE, StagePanel, row, shownSummary, type ShownRecord } from '../ui'
import { RECOGNITION_UNIT, SLOT_COUNT, unitOfSlot, type ListResult, type RecognitionResult } from './listsStore'

/**
 * Part 1's reveal (spec §5.6), rendered only once the recognition test is
 * complete. This is the one file in `lists/` whose strings may name what
 * the part tested: the lists of associates, the critical words, the
 * intrusions. Everything before it is silent (`lists.test.tsx`).
 */

const CONDITION_LABEL: Record<Condition, string> = {
  immediate: 'typed at once',
  delayed: 'after counting',
}

/** Short names of the item types for the report rows, where the right panel has about 58 characters of monospace; the full names are in the note beneath. */
const SHORT_TYPE_LABEL: Record<ItemType, string> = {
  'associates-studied': 'studied, lists of associates',
  'unrelated-studied': 'studied, unrelated lists',
  'critical-studied': 'critical, studied lists',
  'critical-control': 'critical, control lists',
  new: 'new words',
}

/**
 * The recognition proportions as three aligned columns under a header line
 * (Jon, 2026-10-26: a gap after the label, the columns named above, no R
 * and K). The label is padded to `width`; the columns are 6, 10 and 6.
 */
export function recognitionLines(scores: TypeScore[], labelOf: (t: ItemType) => string, width: number): string[] {
  const head = `${''.padEnd(width)}${'old'.padStart(6)}${'remember'.padStart(10)}${'know'.padStart(6)}`
  return [head, ...scores.map((sc) => `${`${labelOf(sc.type)} (${sc.n})`.padEnd(width)}${sc.old.toFixed(2).padStart(6)}${sc.remember.toFixed(2).padStart(10)}${sc.know.toFixed(2).padStart(6)}`)]
}

/** The records as the scorer wants them, from what the units saved. */
export function recordsOf(results: ListResult[]): RecallRecord[] {
  return results.map((r) => ({ slot: r.slot, list: listById(r.listId), recall: r.recall, typed: r.typed, lostAssociates: r.lostAssociates }))
}

export function revealData(progress: ProgressStore): { results: ListResult[]; recognition: RecognitionResult } | null {
  if (!progress.isComplete(RECOGNITION_UNIT)) return null
  const results: ListResult[] = []
  for (let s = 0; s < SLOT_COUNT; s++) {
    if (!progress.isComplete(unitOfSlot(s))) return null
    results.push(progress.result(unitOfSlot(s)) as ListResult)
  }
  return { results, recognition: progress.result(RECOGNITION_UNIT) as RecognitionResult }
}

const KIND_MARK = { studied: 'studied', critical: 'critical word', earlier: 'from an earlier list', other: 'other' } as const

/** A serial-position curve as a small SVG: proportion recalled by position, with the three bins as bars behind. */
function CurvePlot({ byPosition, bins, label }: { byPosition: number[]; bins: { first: number; middle: number; last: number }; label: string }) {
  const w = 300
  const h = 120
  const pad = { l: 30, r: 8, t: 8, b: 22 }
  const n = byPosition.length
  const X = (i: number) => pad.l + (i / Math.max(1, n - 1)) * (w - pad.l - pad.r)
  const Y = (v: number) => h - pad.b - v * (h - pad.t - pad.b)
  const path = byPosition.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ')
  const binRects = [
    { from: 0, to: 3, v: bins.first },
    { from: 3, to: n - 3, v: bins.middle },
    { from: n - 3, to: n, v: bins.last },
  ]
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block', background: 'var(--bg)', borderRadius: 8 }} role="img" aria-label={`serial-position curve: ${label}`} data-curve={label}>
      {binRects.map((b, i) => (
        <rect key={i} x={X(b.from) - (i === 0 ? 0 : 4)} y={Y(b.v)} width={Math.max(2, X(Math.max(b.from, b.to - 1)) - X(b.from) + 8)} height={Y(0) - Y(b.v)} fill="var(--accent)" opacity={0.18} />
      ))}
      <line x1={pad.l} y1={Y(0)} x2={w - pad.r} y2={Y(0)} stroke="var(--border)" />
      <line x1={pad.l} y1={Y(1)} x2={pad.l} y2={Y(0)} stroke="var(--border)" />
      <path d={path} fill="none" stroke="var(--sensor)" strokeWidth={1.5} />
      {byPosition.map((v, i) => (
        <circle key={i} cx={X(i)} cy={Y(v)} r={2.5} fill="var(--sensor)" />
      ))}
      <text x={pad.l - 4} y={Y(1) + 3} fontSize={9} textAnchor="end" fill="var(--text-muted)">1</text>
      <text x={pad.l - 4} y={Y(0) + 3} fontSize={9} textAnchor="end" fill="var(--text-muted)">0</text>
      <text x={X(0)} y={h - 8} fontSize={9} textAnchor="middle" fill="var(--text-muted)">1</text>
      <text x={X(n - 1)} y={h - 8} fontSize={9} textAnchor="middle" fill="var(--text-muted)">{n}</text>
      <text x={(pad.l + w - pad.r) / 2} y={h - 8} fontSize={9} textAnchor="middle" fill="var(--text-muted)">serial position</text>
    </svg>
  )
}

/** The compact rows the handout asks for: every number a student copies into the report. */
export function resultRows(results: ListResult[], recognition: RecognitionResult): string[] {
  const records = recordsOf(results)
  const curves = serialPositionCurves(records)
  const intr = priorListIntrusions(records)
  const crit = criticalRecalled(records)
  const scores = scoreRecognition(recognition.items, recognition.answers)
  const order = orderOfOutput(records)
  // The right panel holds about 58 monospace characters: labels to 37, values after a gap; the recognition table's labels to 35.
  const W = 38
  const rows: string[] = []
  for (const c of curves) rows.push(row(`${CONDITION_LABEL[c.condition]}: first/middle/last`, `${c.bins.first.toFixed(2)} ${c.bins.middle.toFixed(2)} ${c.bins.last.toFixed(2)}`, W))
  rows.push(row('words from earlier lists', String(intr.count), W))
  rows.push(row('critical words typed after their list', `${crit.filter((c) => c.recalled).length} of ${crit.length}`, W))
  rows.push(row('first typed word from the last three', `${order.proportion.toFixed(2)} of ${order.lists}`, W))
  rows.push(...recognitionLines(scores, (t) => SHORT_TYPE_LABEL[t], 36))
  return rows
}

export function CompactResults({ progress }: { progress: ProgressStore }) {
  const d = revealData(progress)
  if (!d) return <Note>Part 1 is not finished.</Note>
  return <FixedLines lines={resultRows(d.results, d.recognition)} testId="lists-results" />
}

export function ListsReveal({ progress }: { progress: ProgressStore }) {
  const d = revealData(progress)
  if (!d) return null
  const { results, recognition } = d
  const records = recordsOf(results)
  const classified = classifyAll(records)
  const curves = serialPositionCurves(records)
  const intr = priorListIntrusions(records)
  const crit = criticalRecalled(records)
  const scores = scoreRecognition(recognition.items, recognition.answers)
  const order = orderOfOutput(records)
  const shown: ShownRecord[] = results.flatMap((r) => r.shown)
  const restarted = results.some((r) => r.restarts > 0)
  const lost = results.filter((r) => r.lostAssociates)
  return (
    <StagePanel wide testId="reveal">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }} data-reveal>
        <div style={{ fontSize: 14, fontWeight: 600 }}>Part 1 — My results</div>
        {restarted && <Content>{RESTARTED_LINE}</Content>}
        <GroupLabel>1. The lists, with what you typed beside each</GroupLabel>
        <Note>Studied words are marked; a word from an earlier list is marked with that list; a word never shown is marked other.</Note>
        {records.map((r, i) => {
          const cond = conditionOf(r)
          const kind = r.list.kind === 'associates' ? 'a list of associates, typed at once' : cond ? CONDITION_LABEL[cond] : r.lostAssociates ? 'a stand-in list, typed at once' : 'typed at once'
          return (
            <div key={r.slot} style={{ display: 'flex', flexDirection: 'column', gap: 4 }} data-list-reveal={r.slot}>
              <div style={{ fontSize: 12, fontWeight: 600 }}>{`List ${r.slot + 1} of ${SLOT_COUNT}: ${kind}`}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, whiteSpace: 'pre-wrap', color: 'var(--text-muted)' }}>{r.list.words.join('  ')}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {classified[i].length === 0 && <Note>nothing typed</Note>}
                {classified[i].map((e, k) => (
                  <span key={k} data-entry={e.kind} style={{ padding: '1px 7px', borderRadius: 999, fontSize: 11, border: '1px solid var(--border)', background: e.kind === 'studied' ? 'var(--surface-2)' : 'transparent', color: e.kind === 'studied' ? 'var(--text)' : e.kind === 'critical' ? 'var(--avoid)' : e.kind === 'earlier' ? 'var(--sensor)' : 'var(--text-muted)', textDecoration: e.duplicate ? 'line-through' : undefined }} title={e.kind === 'earlier' ? `from list ${records[e.fromEarlier!].slot + 1}` : KIND_MARK[e.kind]}>
                    {e.typed}
                    {e.kind === 'earlier' ? ` (list ${records[e.fromEarlier!].slot + 1})` : e.kind === 'critical' ? ' (critical word)' : e.kind === 'other' ? ' (other)' : ''}
                  </span>
                ))}
              </div>
            </div>
          )
        })}
        <GroupLabel>2. The serial-position curves</GroupLabel>
        <Note>{`Every list had ${UNRELATED_LENGTH} words. Each curve is the proportion of lists on which the word at that position was typed. One student’s curves are noisy, so the three bins (the first three positions, the middle, the last three) are the bars behind each curve. The rise at the first positions is primacy and the rise at the last is recency; the reading’s account has a delay filled with counting remove recency, since the last words are no longer in rehearsal, and spare primacy.`}</Note>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {curves.map((c) => (
            <div key={c.condition} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <Note>{`lists ${CONDITION_LABEL[c.condition]} (${c.lists} lists)`}</Note>
              <CurvePlot byPosition={c.byPosition} bins={c.bins} label={c.condition} />
            </div>
          ))}
        </div>
        <FixedLines lines={curves.map((c) => row(`lists ${CONDITION_LABEL[c.condition]}: bins`, `${c.bins.first.toFixed(2)} ${c.bins.middle.toFixed(2)} ${c.bins.last.toFixed(2)}`, 40))} testId="bins" />
        <ReferencePanel reference={referenceById('murdock1962')} />
        <ReferencePanel reference={referenceById('glanzer1966')} />
        <GroupLabel>3. Words from earlier lists</GroupLabel>
        <FixedLines lines={[row('words typed that were on an earlier list', String(intr.count), 48), ...intr.intrusions.map((x) => row(`  after list ${x.slot + 1}: ${x.typed}`, `from list ${x.fromSlot + 1}`, 48))]} testId="intrusions" />
        <Note>The reading calls this proactive interference: old learning making new learning harder to recall. A word from an earlier list is a word that was still in reach, and interference is the effect of other learning on recalling something.</Note>
        <GroupLabel>4. Three of the lists were made of associates</GroupLabel>
        <Note>Three lists were made entirely of associates of one word that was never shown, the critical word. Whether you typed it after the list, and whether you later called it old, is the result.</Note>
        <FixedLines lines={crit.map((c) => row(`list ${c.slot + 1}: the critical word was “${c.critical}”`, c.recalled ? 'typed' : 'not typed', 52))} testId="critical" />
        {lost.length > 0 && <Content>{`${lost.length === 1 ? 'One list of associates was' : `${lost.length} lists of associates were`} lost to a restart and replaced by an unrelated list, so this part has ${crit.length} of 3.`}</Content>}
        <Note>The recognition test: the proportion of each kind of word you called old, split by remember and know.</Note>
        <FixedLines lines={recognitionLines(scores, (t) => ITEM_TYPE_LABEL[t], 50)} testId="recognition-scores" />
        <Note>The researchers’ own definitions, from the source: “A remember experience is defined as one in which the subject can mentally relive the experience (perhaps by recalling its neighbors, what it made them think of, what they were doing when they heard the word, or physical characteristics associated with its presentation). A know judgment is made when subjects are confident that the item occurred on the list but are unable to reexperience (i.e., remember) its occurrence.”</Note>
        <ReferencePanel reference={referenceById('roediger1995-recall')} />
        <ReferencePanel reference={referenceById('roediger1995-table2')} />
        <ReferencePanel reference={referenceById('warning')} />
        <Content>{READING_PRINTS_LINE}</Content>
        <GroupLabel>5. The order of output</GroupLabel>
        <FixedLines lines={[row('lists typed at once whose first word was among the last three', `${order.proportion.toFixed(2)} of ${order.lists}`, 56)]} testId="order" />
        <GroupLabel>6. The presentation</GroupLabel>
        <Note>{shownSummary(shown) ?? 'No timing recorded.'}</Note>
        <RecognitionList items={recognition.items} answers={recognition.answers} />
      </div>
    </StagePanel>
  )
}

function RecognitionList({ items, answers }: { items: RecognitionItem[]; answers: RecognitionAnswer[] }) {
  return (
    <details>
      <summary style={{ fontSize: 11.5, cursor: 'pointer', color: 'var(--text-muted)' }}>Every word of the recognition test, with your answer</summary>
      <FixedLines lines={items.map((it, i) => row(`${it.word} (${ITEM_TYPE_LABEL[it.type]})`, answers[i].old ? `old, ${answers[i].judgment}` : 'new', 58))} testId="recognition-list" />
    </details>
  )
}

export function ListsRight({ progress }: { progress: ProgressStore }) {
  const d = revealData(progress)
  return (
    <Panel title="My results" style={RIGHT_STYLE}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {d ? (
          <>
            <Note>The rows the report asks for. Every number is also on the results screen over the view, with the lists and the curves.</Note>
            <FixedLines lines={resultRows(d.results, d.recognition)} testId="lists-results" />
            <Note>Kinds of word on the recognition test: {ITEM_TYPES.map((t) => ITEM_TYPE_LABEL[t]).join('; ')}.</Note>
          </>
        ) : (
          <Note>The results appear here once the whole part is finished: the lists, the curves, the words from earlier lists, and the last test.</Note>
        )}
      </div>
    </Panel>
  )
}
