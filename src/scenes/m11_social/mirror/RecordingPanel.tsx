import { VISUAL_INPUTS, type MirrorCells } from '../../../sim/social/mirror/cells'
import type { TestResult } from '../../../sim/social/mirror/schedule'
import { FixedLines, GroupLabel, Note } from '../ui'
import { TRACE_HZ, TRACE_SECONDS, type Mark, type TraceSample } from './store'

/**
 * The recording panel (spec §10.2): each cell's firing over the last 30
 * seconds with every grasp marked by who made it and which kind, the
 * 4 × 2 weight table as aligned rows, and the current step's test results.
 * All of it reads the cells; none of it writes.
 */

const f2 = (x: number) => x.toFixed(2)

export function Traces({ trace, marks, now }: { trace: TraceSample[]; marks: Mark[]; now: number }) {
  const w = 400
  const h = 120
  const n = TRACE_SECONDS * TRACE_HZ
  const X = (i: number) => (i / n) * w
  const Y = (v: number, row: 0 | 1) => row * (h / 2) + (h / 2 - 8) - v * (h / 2 - 16)
  const start = trace.length - n
  const path = (pick: (s: TraceSample) => number, row: 0 | 1) => trace.map((s, i) => `${i ? 'L' : 'M'}${X(i + Math.max(0, n - trace.length)).toFixed(1)},${Y(pick(s), row).toFixed(1)}`).join(' ')
  const t0 = now - TRACE_SECONDS
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block', background: 'var(--bg)', borderRadius: 8, maxWidth: '100%' }} role="img" aria-label="the two cells’ firing over the last 30 seconds" data-traces>
      <line x1={0} y1={h / 2} x2={w} y2={h / 2} stroke="var(--border)" />
      <path d={path((s) => s.precision, 0)} fill="none" stroke="#4f9cff" strokeWidth={1.5} data-trace="precision" />
      <path d={path((s) => s.wholeHand, 1)} fill="none" stroke="#f0a94b" strokeWidth={1.5} data-trace="wholeHand" />
      {marks
        .filter((m) => m.t >= t0)
        .map((m, i) => {
          const x = ((m.t - t0) / TRACE_SECONDS) * w
          const color = m.who === 'you' ? '#e7ecf3' : '#34d399'
          const y = m.grasp === 'precision' ? 6 : h / 2 + 6
          return <path key={i} d={m.grasp === 'precision' ? `M${x},${y} l-4,-6 l8,0 z` : `M${x - 4},${y - 6} h8 v6 h-8 z`} fill={color} data-mark={`${m.who}-${m.grasp}`} />
        })}
      <text x={4} y={12} fontSize={9} fill="#4f9cff">
        precision cell
      </text>
      <text x={4} y={h / 2 + 12} fontSize={9} fill="#f0a94b">
        whole-hand cell
      </text>
      <span style={{ display: 'none' }}>{start}</span>
    </svg>
  )
}

export function WeightTable({ cells }: { cells: MirrorCells }) {
  const t = cells.table()
  return <FixedLines lines={[`${''.padEnd(44)}${'precision'.padStart(10)}${'whole-hand'.padStart(12)}`, ...VISUAL_INPUTS.map((name, i) => `${name.padEnd(44)}${f2(t[i][0]).padStart(10)}${f2(t[i][1]).padStart(12)}`)]} testId="weights" />
}

export function TestLines({ result, rest }: { result: TestResult | null; rest: number }) {
  if (!result) return <Note>No test run yet in this step.</Note>
  return (
    <FixedLines
      lines={[`${'seen from across the table:'.padEnd(30)}${'precision grip'.padStart(16)}${'whole-hand grasp'.padStart(18)}`, `${'precision cell, mean firing'.padEnd(30)}${f2(result.precisionCell.toPrecision).padStart(16)}${f2(result.precisionCell.toWholeHand).padStart(18)}`, `${'whole-hand cell, mean firing'.padEnd(30)}${f2(result.wholeHandCell.toPrecision).padStart(16)}${f2(result.wholeHandCell.toWholeHand).padStart(18)}`, `${'a cell at rest'.padEnd(30)}${f2(rest).padStart(16)}`]}
      testId="test-result"
    />
  )
}

export function Legend() {
  return (
    <Note>
      Traces: the cells’ output, 0 to 1. Marks above each trace: a grasp, a triangle for a precision grip and a square for a whole-hand grasp, white for yours and green for the other macaque’s. <GroupLabel>Weights</GroupLabel>
    </Note>
  )
}
