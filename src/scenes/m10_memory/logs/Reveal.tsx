import { Panel } from '../../../components/Panel'
import { makeClearing, type Clearing } from '../../../sim/memory/logs/clearings'
import { PAIR_KINDS, TEST_NIGHTS, describeFeatures, pairKind } from '../../../sim/memory/logs/features'
import { ANSWERS, ANSWER_LABEL, confusionTable, truths, type ConfusionTable } from '../../../sim/memory/logs/question'
import { tallies, tallyLines } from '../../../sim/memory/logs/night'
import { resultLine, shareOf, weekSummary, type KindSummary, type Part4Predictions, type Part4WeekResult, type WeekSummary } from '../../../sim/memory/logs/results'
import { Content, FixedLines, GroupLabel, Note, RIGHT_STYLE } from '../ui'
import { COUNTERBALANCE_LINE, RESTARTED_LINE } from '../lines'
import { ClearingOverhead, OVERHEAD_LEGEND } from './Overhead'

/**
 * Part 4's reveal (spec §8.7): only after the end-of-week question is
 * committed. In this order: the comparison of the share of when-errors
 * after look-alike pairs against after different pairs, with the first
 * prediction; the week's trend, night by night, with the second prediction
 * and the counterbalancing line; each night with its features line, its
 * fixed lines and an overhead replay; the end-of-week question against what
 * was true; and the result line for the class.
 */

const pct = (v: number | null) => (v === null ? '—' : `${Math.round(100 * v)}%`)
const W = 44

function kindLines(k: KindSummary): string[] {
  const name = k.kind === 'after a look-alike pair' ? 'After a look-alike pair' : 'After a different pair'
  return [
    `${`${name} (nights ${k.nights.join(' and ')})`.padEnd(W)}${`${k.errors} of ${k.decisions}`.padStart(8)}${pct(k.share).padStart(6)}`,
    `${'   over digs alone'.padEnd(W)}${`${k.digErrors} of ${k.digDecisions}`.padStart(8)}${pct(k.digShare).padStart(6)}`,
    `${'   a forager with no memory for nights, over digs'.padEnd(W)}${''.padStart(8)}${pct(k.baseline).padStart(6)}`,
  ]
}

/** What happened, in the prediction's words. */
export function pairOutcome(s: WeekSummary): string {
  const a = s.byKind['after a look-alike pair'].share
  const d = s.byKind['after a different pair'].share
  if (a === null || d === null) return 'too few decisions to say'
  return a > d + 1e-9 ? 'more mistakes' : a < d - 1e-9 ? 'fewer mistakes' : 'about as many'
}

export function trendOutcome(s: WeekSummary): string {
  const half = (ns: number[]) => {
    const sc = ns.map((n) => s.nights[n - 1])
    return shareOf(sc.reduce((x, y) => x + y.errors, 0), sc.reduce((x, y) => x + y.decisions, 0))
  }
  const early = half([3, 4])
  const late = half([5, 6])
  if (early === null || late === null) return 'too few decisions to say'
  return late < early - 1e-9 ? 'fewer' : late > early + 1e-9 ? 'more' : 'about the same'
}

export function ConfusionGrid({ table, title }: { table: ConfusionTable; title: string }) {
  const cell = (r: string, c: string, v: number, hot: boolean) => (
    <td key={`${r}-${c}`} style={{ border: '1px solid var(--border)', padding: '3px 6px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 11.5, background: hot ? 'rgba(248,113,113,0.25)' : r === c ? 'rgba(52,211,153,0.15)' : undefined }} data-cell={`${r}/${c}`}>
      {v}
    </td>
  )
  const short = (a: string) => ANSWER_LABEL[a as keyof typeof ANSWER_LABEL].replace('Emptied ', '').replace('Not emptied in the last three nights', 'not in three nights')
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }} data-confusion-table={title}>
      <Note>{title}: rows are what was true after night 6, columns what you marked. The red cells are marks of one night for another.</Note>
      <table style={{ borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'left', padding: '2px 6px' }}>true ↓ marked →</th>
            {ANSWERS.map((a) => (
              <th key={a} style={{ fontSize: 10, color: 'var(--text-muted)', padding: '2px 6px', fontWeight: 500 }}>
                {short(a)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ANSWERS.map((r) => (
            <tr key={r}>
              <td style={{ fontSize: 10.5, color: 'var(--text-muted)', padding: '2px 6px' }}>{short(r)}</td>
              {ANSWERS.map((c) => cell(r, c, table.cells[r][c], r !== 'never' && c !== 'never' && r !== c))}
            </tr>
          ))}
        </tbody>
      </table>
      <FixedLines lines={[`${'Marks of one night for another'.padEnd(34)}${`${table.confusions} of ${table.couldBeConfused}`.padStart(8)}`, `${'Logs marked right'.padEnd(34)}${`${table.right} of ${table.logs}`.padStart(8)}`]} />
    </div>
  )
}

function NightReveal({ result, clearing, s, night }: { result: Part4WeekResult; clearing: Clearing; s: WeekSummary; night: number }) {
  const r = result.records[night - 1]
  const w = s.nights[night - 1]
  const kind = pairKind(result.plan.order, night)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }} data-night-reveal={night}>
      <GroupLabel>
        Night {night}
        {kind ? `, ${kind}` : ''}
      </GroupLabel>
      <Note>Tonight: {describeFeatures(r.features)}.</Note>
      <FixedLines lines={[...tallyLines(tallies(r)), ...(night >= 3 ? [`${'When-decisions'.padEnd(46)}${String(w.decisions).padStart(4)}`, `${'When-errors'.padEnd(46)}${String(w.errors).padStart(4)}`] : []), `${'Pauses (count, seconds)'.padEnd(46)}${`${r.pauses.count}, ${Math.round(r.pauses.seconds)}`.padStart(4)}`]} testId={`tallies-${night}`} />
      <ClearingOverhead clearing={clearing} record={r} size={260} label={`night ${night} replay`} />
    </div>
  )
}

export function LogsReveal({ result, predictions, seed }: { result: Part4WeekResult; predictions: Part4Predictions; seed: number }) {
  const clearing = makeClearing(seed)
  const s = weekSummary(result, clearing)
  const table = confusionTable(truths(clearing, result.states[result.records.length]), result.answers)
  const night6 = s.nights[5]
  const trendLines = TEST_NIGHTS.map((n) => {
    const w = s.nights[n - 1]
    const k = pairKind(result.plan.order, n)!
    return `${`Night ${n}`.padEnd(9)}${(k === 'after a look-alike pair' ? 'look-alike pair' : 'different pair').padEnd(17)}${`beetles ${s.beetles[n - 1]}`.padEnd(12)}${`errors ${w.errors} of ${w.decisions}`.padEnd(18)}${pct(shareOf(w.errors, w.decisions)).padStart(5)}`
  })
  return (
    <Panel title="My results — Part 4" style={{ ...RIGHT_STYLE, width: 520 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }} data-reveal="logs">
        {result.restarted && <Content>{RESTARTED_LINE}</Content>}
        <Note>
          From night 3 on, a <b>when-decision</b> is a visit to a log emptied last night or two nights ago: a dig at it, or passing within about 2 m of it. A <b>when-error</b> is a dig at a log emptied last night, or a log emptied two nights ago that you passed close by and never dug. The share of when-errors is errors over decisions, so that digging more does not look like confusing more.
        </Note>
        <GroupLabel>1. The comparison: nights after a look-alike pair against nights after a different pair</GroupLabel>
        <FixedLines lines={PAIR_KINDS.flatMap((k) => kindLines(s.byKind[k]))} testId="comparison" />
        <FixedLines lines={[`Your prediction: ${predictions.pairs ?? '—'}`, `What happened: ${pairOutcome(s)}`]} mono={false} testId="pairs-answer" />
        <GroupLabel>2. The week’s trend</GroupLabel>
        <FixedLines lines={[`${'Night'.padEnd(9)}${'kind'.padEnd(17)}${''.padEnd(12)}${'when-errors'.padEnd(18)}${'share'.padStart(5)}`, `${'Night 1'.padEnd(9)}${''.padEnd(17)}${`beetles ${s.beetles[0]}`.padEnd(12)}`, `${'Night 2'.padEnd(9)}${''.padEnd(17)}${`beetles ${s.beetles[1]}`.padEnd(12)}`, ...trendLines]} testId="trend" />
        <FixedLines lines={[`Your prediction: over the week your mistakes would become ${predictions.trend ?? '—'}`, `What happened, nights 5 and 6 against nights 3 and 4: ${trendOutcome(s)}`]} mono={false} testId="trend-answer" />
        <Content>{COUNTERBALANCE_LINE}</Content>
        <GroupLabel>3. Each night</GroupLabel>
        <Note>{OVERHEAD_LEGEND}</Note>
        <Note>Repeat digs at a log already emptied tonight are errors of working memory for one night, in the reading’s second sense of the term: the list of logs already searched. Digs at logs emptied last night are the cost of knowing only the usual fact, or of confusing last night with an earlier one; full logs passed close by that were emptied two nights ago are the cost of misremembering when. The refill rule makes the task one of what, where and when, which is what makes this memory episodic-like.</Note>
        {result.records.map((_, i) => (
          <NightReveal key={i} result={result} clearing={clearing} s={s} night={i + 1} />
        ))}
        <GroupLabel>4. The question at the end of the week, against what was true</GroupLabel>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          <ConfusionGrid table={table} title="Your marks" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <Note>What you did on night 6, log by log: the night each was emptied on, and whether you dug at it or passed it.</Note>
            <FixedLines
              lines={clearing.logs
                .filter((l) => l.kind === 'loose')
                .map((l) => {
                  const w = night6.logs.find((x) => x.log === l.id)
                  const e = result.states[5][l.id]
                  const when = e === null ? 'never emptied' : e === 6 ? 'emptied tonight' : e === 5 ? 'emptied last night' : e === 4 ? 'emptied two nights ago' : `emptied on night ${e}`
                  const did = w ? (w.dug ? 'dug' : w.passed ? 'passed' : 'not visited') : result.records[5].digs.some((d) => d.log === l.id) ? 'dug' : result.records[5].passedClose[l.id] ? 'passed' : 'not visited'
                  return `${`Log ${l.id + 1}`.padEnd(8)}${when.padEnd(24)}${did.padEnd(12)}${(result.answers[l.id] ? `marked: ${ANSWER_LABEL[result.answers[l.id]].toLowerCase()}` : '').padEnd(28)}`
                })}
              testId="night6-logs"
            />
          </div>
        </div>
        <GroupLabel>5. Your result line, for the class</GroupLabel>
        <FixedLines lines={[resultLine(s)]} testId="result-line" />
        <Note>The order of night features, the two shares, and the four nightly shares. Copy it into the report.</Note>
      </div>
    </Panel>
  )
}
