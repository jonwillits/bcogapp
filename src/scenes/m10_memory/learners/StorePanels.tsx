import type { StoredNight, Retrieval } from '../../../sim/memory/foragers/store'
import { ANSWERS, type ConfusionTable } from '../../../sim/memory/logs/mapQuestion'
import type { Truth } from '../../../sim/memory/logs/refill'
import { FixedLines, GroupLabel, Note } from '../ui'

/**
 * The store's panels (spec §9.3): each stored night as its sparse code, a
 * small grid of dots, with the logs emptied that night; the similarity
 * matrix between the stored nights, shaded; the retrieval bar chart for a
 * cue; and the confusion table, which Part 4's reveal also draws.
 */

/** A code as a grid of dots: bright where the unit is active (at or above half), dark where not. */
export function CodeGrid({ code, label, emptied }: { code: number[]; label: string; emptied: number[] }) {
  const n = code.length
  const cols = n <= 8 ? n : n <= 60 ? 12 : 24
  const rows = Math.ceil(n / cols)
  const cell = n <= 8 ? 14 : n <= 60 ? 9 : 6
  const w = cols * cell
  const h = rows * cell
  const active = code.filter((v) => v >= 0.5).length
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }} data-code={label}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block', background: 'var(--bg)', borderRadius: 4 }} role="img" aria-label={`${label}: its code`}>
        {code.map((v, i) => (
          <rect key={i} x={(i % cols) * cell + 0.5} y={Math.floor(i / cols) * cell + 0.5} width={cell - 1} height={cell - 1} fill={v >= 0.5 ? 'var(--accent)' : 'var(--surface-2)'} opacity={v >= 0.5 ? 0.4 + 0.6 * v : 1} />
        ))}
      </svg>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, whiteSpace: 'pre' }}>{`${label.padEnd(8)}${String(active).padStart(3)} of ${String(n).padStart(3)} active`}</div>
      <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>emptied: {emptied.length ? `logs ${emptied.map((i) => i + 1).join(', ')}` : 'none'}</div>
    </div>
  )
}

export function StoredNights({ nights }: { nights: StoredNight[] }) {
  if (!nights.length) return <Note>Nothing stored yet.</Note>
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }} data-stored-nights={nights.length}>
      {nights.map((n, i) => (
        <CodeGrid key={i} code={n.code} label={n.label} emptied={n.content.map((v, k) => (v >= 0.5 ? k : -1)).filter((k) => k >= 0)} />
      ))}
    </div>
  )
}

/** The similarity between every pair of stored nights, shaded, with the number in each cell. */
export function SimilarityMatrix({ matrix, labels }: { matrix: number[][]; labels: string[] }) {
  const n = matrix.length
  if (!n) return null
  const cell = 44
  const pad = 54
  const size = pad + n * cell
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block', background: 'var(--bg)', borderRadius: 8 }} role="img" aria-label="similarity between the stored nights" data-similarity>
      {matrix.map((row, i) =>
        row.map((v, j) => (
          <g key={`${i}-${j}`}>
            <rect x={pad + j * cell} y={pad + i * cell} width={cell - 1} height={cell - 1} fill="var(--accent)" opacity={0.08 + 0.85 * Math.max(0, v)} />
            <text x={pad + j * cell + cell / 2} y={pad + i * cell + cell / 2 + 4} textAnchor="middle" fontSize={10} fontFamily="var(--font-mono)" fill="var(--text)">
              {v.toFixed(2)}
            </text>
          </g>
        )),
      )}
      {labels.map((l, i) => (
        <g key={l}>
          <text x={pad - 4} y={pad + i * cell + cell / 2 + 4} textAnchor="end" fontSize={9.5} fill="var(--text-muted)">
            {l}
          </text>
          <text x={pad + i * cell + cell / 2} y={pad - 6} textAnchor="middle" fontSize={9.5} fill="var(--text-muted)">
            {l}
          </text>
        </g>
      ))}
    </svg>
  )
}

/** Each stored night's contribution to a retrieval, and the strength with which each log comes back as emptied. */
export function RetrievalBars({ retrieval, labels, logLabels, treated }: { retrieval: Retrieval; labels: string[]; logLabels: string[]; treated: boolean[] }) {
  const w = 300
  const barH = 14
  const rows = retrieval.contributions.length
  const h1 = rows * (barH + 4) + 8
  const cols = retrieval.blended.length
  const h2 = cols * (barH + 4) + 8
  const X = (v: number) => 110 + v * (w - 150)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} data-retrieval>
      <GroupLabel>Each stored night’s contribution</GroupLabel>
      <svg width={w} height={h1} viewBox={`0 0 ${w} ${h1}`} style={{ display: 'block', background: 'var(--bg)', borderRadius: 8 }} role="img" aria-label="each stored night's contribution to the retrieval">
        {retrieval.contributions.map((c, i) => (
          <g key={i}>
            <text x={104} y={4 + i * (barH + 4) + barH - 3} textAnchor="end" fontSize={10} fill="var(--text-muted)">
              {labels[i]}
            </text>
            <rect x={X(0)} y={4 + i * (barH + 4)} width={Math.max(0, X(c) - X(0))} height={barH} fill="var(--accent)" />
            <text x={X(c) + 4} y={4 + i * (barH + 4) + barH - 3} fontSize={10} fontFamily="var(--font-mono)" fill="var(--text)">
              {c.toFixed(2)}
            </text>
          </g>
        ))}
      </svg>
      <GroupLabel>Each log, as emptied last night</GroupLabel>
      <svg width={w} height={h2} viewBox={`0 0 ${w} ${h2}`} style={{ display: 'block', background: 'var(--bg)', borderRadius: 8 }} role="img" aria-label="the strength with which each log comes back as emptied last night">
        {retrieval.blended.map((b, i) => (
          <g key={i}>
            <text x={104} y={4 + i * (barH + 4) + barH - 3} textAnchor="end" fontSize={10} fill="var(--text-muted)">
              {logLabels[i]}
            </text>
            <rect x={X(0)} y={4 + i * (barH + 4)} width={Math.max(0, X(b) - X(0))} height={barH} fill={treated[i] ? 'var(--avoid)' : 'var(--sensor)'} opacity={0.9} />
            <text x={X(b) + 4} y={4 + i * (barH + 4) + barH - 3} fontSize={10} fontFamily="var(--font-mono)" fill="var(--text)">
              {b.toFixed(2)}
            </text>
          </g>
        ))}
        <line x1={X(0.5)} y1={2} x2={X(0.5)} y2={h2 - 2} stroke="var(--border)" strokeDasharray="3 3" />
      </svg>
      <Note>A red bar is a log the forager treated as emptied last night on this night; an amber bar one it did not. The dashed line is 0.5.</Note>
    </div>
  )
}

const TRUTH_SHORT: Record<Truth, string> = { tonight: 'tonight', 'last night': 'last night', 'two nights ago': 'two ago', never: 'never' }

/** The confusion table (spec §8.7): rows are what was true, columns what was marked; the confusions between nights are the night cells off the diagonal. */
export function ConfusionTableView({ table, title }: { table: ConfusionTable; title: string }) {
  const head = `${'true \\ marked'.padEnd(16)}${ANSWERS.map((a) => TRUTH_SHORT[a].padStart(10)).join('')}`
  const lines = [head, ...ANSWERS.map((r) => `${TRUTH_SHORT[r].padEnd(16)}${ANSWERS.map((c) => String(table.cells[r][c]).padStart(10)).join('')}`)]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }} data-confusion-table={title}>
      <GroupLabel>{title}</GroupLabel>
      <FixedLines lines={lines} />
      <FixedLines lines={[`${'Confusions between nights'.padEnd(30)}${String(table.confusions).padStart(3)} of ${String(table.couldBeConfused).padStart(3)}`, `${'Marks right'.padEnd(30)}${String(table.right).padStart(3)} of ${String(table.logs).padStart(3)}`]} />
    </div>
  )
}
