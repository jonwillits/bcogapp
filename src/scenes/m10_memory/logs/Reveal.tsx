import { Panel } from '../../../components/Panel'
import { makeClearings, type Clearing } from '../../../sim/memory/logs/clearings'
import { BLOCK_LABEL, describeFeatures } from '../../../sim/memory/logs/features'
import { ANSWERS, ANSWER_LABEL, confusionTable, sumTables, truths, type ConfusionTable } from '../../../sim/memory/logs/mapQuestion'
import { NIGHT_S, tallies, tallyLines } from '../../../sim/memory/logs/night'
import type { Part4BlockResult, SecondBlockPrediction } from '../../../sim/memory/logs/results'
import { Content, FixedLines, GroupLabel, Note, RIGHT_STYLE, row } from '../ui'
import { RESTARTED_LINE } from '../lines'
import { ClearingOverhead, OVERHEAD_LEGEND } from './Overhead'

/**
 * Part 4's reveal (spec §8.7): only after both blocks are finished. Side by
 * side for the look-alike and distinct blocks: the per-night lines, the
 * map-question confusion tables, the committed prediction, and an overhead
 * replay of each night with the student's path and each dig by outcome.
 */

export function blockTables(b: Part4BlockResult, clearing: Clearing): { nights: ConfusionTable[]; block: ConfusionTable } {
  const nights = b.records.map((_, i) => confusionTable(truths(clearing, b.states[i + 1], i + 1), b.answers[i] ?? {}))
  return { nights, block: sumTables(nights) }
}

export function ConfusionGrid({ table, title }: { table: ConfusionTable; title: string }) {
  const cell = (r: string, c: string, v: number, hot: boolean) => (
    <td key={`${r}-${c}`} style={{ border: '1px solid var(--border)', padding: '3px 6px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 11.5, background: hot ? 'rgba(248,113,113,0.25)' : r === c ? 'rgba(52,211,153,0.15)' : undefined }} data-cell={`${r}/${c}`}>
      {v}
    </td>
  )
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }} data-confusion-table={title}>
      <Note>{title}: rows are what was true, columns what you marked. The red cells are confusions between nights.</Note>
      <table style={{ borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'left', padding: '2px 6px' }}>true ↓ marked →</th>
            {ANSWERS.map((a) => (
              <th key={a} style={{ fontSize: 10, color: 'var(--text-muted)', padding: '2px 6px', fontWeight: 500 }}>
                {ANSWER_LABEL[a].replace('Emptied ', '')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ANSWERS.map((r) => (
            <tr key={r}>
              <td style={{ fontSize: 10.5, color: 'var(--text-muted)', padding: '2px 6px' }}>{ANSWER_LABEL[r].replace('Emptied ', '')}</td>
              {ANSWERS.map((c) => cell(r, c, table.cells[r][c], r !== 'never' && c !== 'never' && r !== c))}
            </tr>
          ))}
        </tbody>
      </table>
      <FixedLines lines={[row('Confusions between nights', `${table.confusions} of ${table.couldBeConfused}`, 34), row('Logs marked right', `${table.right} of ${table.logs}`, 34)]} />
    </div>
  )
}

function BlockReveal({ b, clearing, which }: { b: Part4BlockResult; clearing: Clearing; which: string }) {
  const { nights, block } = blockTables(b, clearing)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }} data-block-reveal={b.plan.kind}>
      <GroupLabel>
        {which}: {BLOCK_LABEL[b.plan.kind]}, clearing {b.clearing}
      </GroupLabel>
      {b.restarted && <Content>{RESTARTED_LINE}</Content>}
      {b.records.map((r, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }} data-night-reveal={i + 1}>
          <Note>
            Night {i + 1}: {describeFeatures(r.features)}.
          </Note>
          <FixedLines lines={tallyLines(tallies(r))} testId={`tallies-${b.plan.kind}-${i + 1}`} />
          <ClearingOverhead clearing={clearing} record={r} size={260} label={`night ${i + 1} replay`} />
          <ConfusionGrid table={nights[i]} title={`Night ${i + 1}`} />
        </div>
      ))}
      <ConfusionGrid table={block} title="The whole block" />
      <FixedLines lines={[row('Beetles over the block', b.records.reduce((a, r) => a + r.beetles, 0), 34, 0), row('Beetles per minute', (b.records.reduce((a, r) => a + r.beetles, 0) / ((3 * NIGHT_S) / 60)), 34)]} />
    </div>
  )
}

export function LogsReveal({ first, second, prediction, seed }: { first: Part4BlockResult; second: Part4BlockResult; prediction: SecondBlockPrediction | null; seed: number }) {
  const clearings = makeClearings(seed)
  const t1 = blockTables(first, clearings[first.clearing]).block
  const t2 = blockTables(second, clearings[second.clearing]).block
  const share = (t: ConfusionTable) => (t.couldBeConfused ? t.confusions / t.couldBeConfused : 0)
  const outcome = share(t2) > share(t1) + 1e-9 ? 'more often' : share(t2) < share(t1) - 1e-9 ? 'less often' : 'about as often'
  const look = first.plan.kind === 'look-alike' ? first : second
  const dist = first.plan.kind === 'distinct' ? first : second
  return (
    <Panel title="My results — Part 4" style={{ ...RIGHT_STYLE, width: 520 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }} data-reveal="logs">
        <Note>{OVERHEAD_LEGEND}</Note>
        <GroupLabel>Confusions between nights, the two blocks</GroupLabel>
        <FixedLines
          lines={[
            row('Look-alike nights', `${blockTables(look, clearings[look.clearing]).block.confusions} of ${blockTables(look, clearings[look.clearing]).block.couldBeConfused}`, 34),
            row('Distinct nights', `${blockTables(dist, clearings[dist.clearing]).block.confusions} of ${blockTables(dist, clearings[dist.clearing]).block.couldBeConfused}`, 34),
          ]}
          testId="confusions-summary"
        />
        {prediction && (
          <FixedLines
            lines={[`Your prediction: in the second block you would confuse nights ${prediction}`, `What happened: ${outcome} (${(100 * share(t2)).toFixed(0)}% against ${(100 * share(t1)).toFixed(0)}% of the logs that could be confused)`]}
            mono={false}
            testId="prediction-answer"
          />
        )}
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 240px' }}>
            <BlockReveal b={first} clearing={clearings[first.clearing]} which="First block" />
          </div>
          <div style={{ flex: '1 1 240px' }}>
            <BlockReveal b={second} clearing={clearings[second.clearing]} which="Second block" />
          </div>
        </div>
      </div>
    </Panel>
  )
}
