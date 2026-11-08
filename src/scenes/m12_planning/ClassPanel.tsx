import { useState } from 'react'
import { cloudFor, PENDING_CLASS_LINE, REAL_CLASS_LINE, SIMULATED_CLASS_LINE, type ClassEntry } from '../../sim/planning/classes'
import { GroupLabel, Note, Content } from './ui'

/**
 * A simulated class on a reveal (spec §4.3, as Lab 11 built it): a cloud of
 * about 40 simulated students with the student's own result as one marked
 * point, every parameter from a data-file entry that names its source, the
 * table or figure, and the page; *Simulated class pending* where none does;
 * a label on the panel; and a slot for this term's real class, which
 * replaces the simulation when present, with a toggle back.
 *
 * A binary measure (chose the sure option, or not) is drawn as a column of
 * dots, one per simulated student, the share printed above; a continuous
 * measure as a column of dots along a vertical axis.
 */
export function ClassPanel({ entry, own, ownLabel = 'you', title }: { entry: ClassEntry; own: (number | null)[] | null; ownLabel?: string; title?: string }) {
  const [preferReal, setPreferReal] = useState(true)
  const cloud = cloudFor(entry, preferReal)
  const hasReal = entry.real !== null && entry.real.length > 0
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 10px', borderRadius: 8, border: '1px dashed var(--border)' }} data-class={entry.id} data-class-kind={cloud.kind}>
      <GroupLabel>{title ?? entry.panel}</GroupLabel>
      {cloud.kind === 'pending' ? (
        <>
          <Content>{PENDING_CLASS_LINE}</Content>
          <Note>It would plot: {entry.measures.join('; ')}.</Note>
          {own && <Note>Your own result: {entry.measures.map((m, i) => `${m}: ${own[i] === null ? 'not measured' : formatValue(own[i]!)}`).join('; ')}.</Note>}
        </>
      ) : (
        <>
          <Content>{cloud.kind === 'real' ? REAL_CLASS_LINE : SIMULATED_CLASS_LINE}</Content>
          <Columns points={cloud.points} measures={entry.measures} own={own} ownLabel={ownLabel} binary={entry.sources.every((s) => s === null || s.share !== undefined)} />
          {cloud.kind === 'simulated' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {cloud.sources.map((s, i) => (
                <Note key={i}>
                  {entry.measures[i]}: {s.source}, {s.where}; N = {s.n}. {s.draw} How the lab differed: {s.differed}
                </Note>
              ))}
            </div>
          )}
          {hasReal && (
            <label style={{ fontSize: 11.5, display: 'flex', gap: 6, alignItems: 'center' }}>
              <input type="checkbox" checked={!preferReal} onChange={(e) => setPreferReal(!e.target.checked)} /> Show the simulated class instead
            </label>
          )}
        </>
      )}
    </div>
  )
}

function formatValue(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(2)
}

/** One column per measure: for a binary measure, dots stacked by value with the share above; for a continuous one, dots along a vertical axis. The student's own point is marked. */
function Columns({ points, measures, own, ownLabel, binary }: { points: number[][]; measures: string[]; own: (number | null)[] | null; ownLabel: string; binary: boolean }) {
  const n = points.length
  const colW = 150
  const width = Math.max(300, colW * measures.length)
  const height = 150
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="the class, one dot per student" style={{ display: 'block', background: 'var(--bg)', borderRadius: 8, maxWidth: '100%' }}>
      {measures.map((m, i) => {
        const x0 = i * colW + 20
        if (binary) {
          const yes = points.filter((p) => p[i] === 1).length
          const share = yes / n
          const stack = (v: number) => points.filter((p) => p[i] === v).length
          return (
            <g key={m} data-column={i}>
              <text x={x0 + 55} y={14} fontSize={10} textAnchor="middle" fill="var(--text)">
                {`${Math.round(share * 100)}% of ${n}`}
              </text>
              {[1, 0].map((v, k) => {
                const count = stack(v)
                return Array.from({ length: count }, (_, j) => <circle key={`${v}-${j}`} cx={x0 + 25 + k * 60 + (j % 5) * 8} cy={height - 28 - Math.floor(j / 5) * 8} r={3} fill={v === 1 ? 'var(--accent)' : 'var(--text-muted)'} />)
              })}
              <text x={x0 + 25 + 16} y={height - 8} fontSize={9} textAnchor="middle" fill="var(--text-muted)">
                yes
              </text>
              <text x={x0 + 85 + 16} y={height - 8} fontSize={9} textAnchor="middle" fill="var(--text-muted)">
                no
              </text>
              {own && own[i] !== null && <text x={x0 + 25 + (own[i] === 1 ? 0 : 60) + 16} y={height - 60} fontSize={10} textAnchor="middle" fill="var(--sensor)" data-own>{`▼ ${ownLabel}`}</text>}
              <text x={x0 + 55} y={28} fontSize={8.5} textAnchor="middle" fill="var(--text-muted)">
                {m.length > 30 ? m.slice(0, 29) + '…' : m}
              </text>
            </g>
          )
        }
        const vals = points.map((p) => p[i])
        const lo = Math.min(...vals, own?.[i] ?? Infinity)
        const hi = Math.max(...vals, own?.[i] ?? -Infinity)
        const Y = (v: number) => height - 20 - ((v - lo) / Math.max(1e-9, hi - lo)) * (height - 40)
        return (
          <g key={m} data-column={i}>
            {vals.map((v, j) => (
              <circle key={j} cx={x0 + 40 + ((j * 37) % 50)} cy={Y(v)} r={3} fill="var(--accent)" />
            ))}
            {own && own[i] !== null && <circle cx={x0 + 65} cy={Y(own[i]!)} r={5} fill="var(--sensor)" data-own />}
            <text x={x0 + 10} y={Y(hi) + 3} fontSize={9} fill="var(--text-muted)">
              {formatValue(hi)}
            </text>
            <text x={x0 + 10} y={Y(lo) + 3} fontSize={9} fill="var(--text-muted)">
              {formatValue(lo)}
            </text>
            <text x={x0 + 65} y={height - 6} fontSize={8.5} textAnchor="middle" fill="var(--text-muted)">
              {m.length > 30 ? m.slice(0, 29) + '…' : m}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
