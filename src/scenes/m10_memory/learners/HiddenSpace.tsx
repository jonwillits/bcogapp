import { THINGS, type Thing } from '../../../sim/memory/foragers/world'
import type { SeasonPoint, Snapshot } from './store'

/**
 * The hidden-activity space of the slow learner (spec §9.4), in the
 * manner of Lab 7's: the eight things placed by their hidden activity,
 * projected to the two directions along which the final snapshot's eight
 * representations vary most, so that every snapshot is drawn on the same
 * axes and the things can be watched separating. And the plot of the old
 * things' properties still right against training on the new season.
 */

/** The two principal directions of a set of vectors, by power iteration with deflation. */
export function principalAxes(vectors: number[][]): { mean: number[]; axes: [number[], number[]] } {
  const n = vectors.length
  const d = vectors[0]?.length ?? 0
  const mean = Array.from({ length: d }, (_, i) => vectors.reduce((a, v) => a + v[i], 0) / Math.max(1, n))
  const centered = vectors.map((v) => v.map((x, i) => x - mean[i]))
  const cov = Array.from({ length: d }, (_, i) => Array.from({ length: d }, (_, j) => centered.reduce((a, v) => a + v[i] * v[j], 0) / Math.max(1, n - 1)))
  const axes: number[][] = []
  for (let k = 0; k < 2; k++) {
    let v: number[] = Array.from({ length: d }, (_, i) => (i === k ? 1 : 0.1))
    for (let it = 0; it < 100; it++) {
      let w = cov.map((row) => row.reduce((a, c, j) => a + c * v[j], 0))
      for (const a of axes) {
        const dot = w.reduce((s, x, i) => s + x * a[i], 0)
        w = w.map((x, i) => x - dot * a[i])
      }
      const len = Math.hypot(...w) || 1
      v = w.map((x) => x / len)
    }
    axes.push(v)
  }
  return { mean, axes: [axes[0], axes[1]] }
}

const SHORT: Record<Thing, string> = {
  'loose-bark log': 'loose log',
  'smooth log': 'smooth log',
  'seed grass': 'seed grass',
  'berry bush': 'berry bush',
  owl: 'owl',
  hawk: 'hawk',
  fox: 'fox',
  snake: 'snake',
  'acorn tree': 'acorn tree',
  weasel: 'weasel',
}

const COLOR: Record<string, string> = { 'loose-bark log': '#a0784a', 'smooth log': '#8a8f99', 'seed grass': '#7fbf5a', 'berry bush': '#c4573a', owl: '#9cc8ff', hawk: '#4f9cff', fox: '#f0a94b', snake: '#34d399', 'acorn tree': '#d4b26a', weasel: '#f87171' }

export function HiddenSnapshots({ snapshots }: { snapshots: Snapshot[] }) {
  if (!snapshots.length) return null
  const last = snapshots[snapshots.length - 1]
  const { mean, axes } = principalAxes(THINGS.map((t) => last.reps[t]))
  const project = (v: number[]) => axes.map((a) => a.reduce((s, x, i) => s + x * (v[i] - mean[i]), 0)) as [number, number]
  // One scale for every snapshot: the largest projected extent across all of them.
  let extent = 0.1
  for (const s of snapshots) for (const t of THINGS) for (const c of project(s.reps[t])) extent = Math.max(extent, Math.abs(c))
  const size = 150
  const X = (v: number) => size / 2 + (v / extent) * (size / 2 - 14)
  const Y = (v: number) => size / 2 - (v / extent) * (size / 2 - 14)
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }} data-snapshots={snapshots.length}>
      {snapshots.map((s) => (
        <svg key={s.pass} width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block', background: 'var(--bg)', borderRadius: 8 }} role="img" aria-label={`hidden-activity space after ${s.pass} passes`}>
          {THINGS.map((t) => {
            const [x, y] = project(s.reps[t])
            return (
              <g key={t}>
                <circle cx={X(x)} cy={Y(y)} r={3.5} fill={COLOR[t]} />
                <text x={X(x) + 5} y={Y(y) + 3} fontSize={8} fill="var(--text)">
                  {SHORT[t]}
                </text>
              </g>
            )
          })}
          <text x={5} y={size - 5} fontSize={9} fill="var(--text-muted)">
            after {s.pass} passes
          </text>
        </svg>
      ))}
    </div>
  )
}

/** Two lines against presentations of the new season: the old things' properties still right, replay off and replay on. */
export function SeasonPlot({ off, on, which }: { off: SeasonPoint[]; on: SeasonPoint[]; which: 'specific' | 'all' }) {
  const w = 320
  const h = 170
  const pad = { l: 36, r: 10, t: 10, b: 28 }
  const maxX = Math.max(1, ...off.map((p) => p.presentations), ...on.map((p) => p.presentations))
  const X = (x: number) => pad.l + (x / maxX) * (w - pad.l - pad.r)
  const Y = (y: number) => h - pad.b - y * (h - pad.t - pad.b)
  const path = (pts: SeasonPoint[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.presentations).toFixed(1)},${Y(p[which]).toFixed(1)}`).join(' ')
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block', background: 'var(--bg)', borderRadius: 8 }} role="img" aria-label="old properties still right against training on the new season" data-season-plot={which}>
      <line x1={pad.l} y1={Y(0)} x2={w - pad.r} y2={Y(0)} stroke="var(--border)" />
      <line x1={pad.l} y1={Y(1)} x2={pad.l} y2={Y(0)} stroke="var(--border)" />
      {[0, 0.5, 1].map((v) => (
        <text key={v} x={pad.l - 4} y={Y(v) + 3} fontSize={9} textAnchor="end" fill="var(--text-muted)">
          {v.toFixed(1)}
        </text>
      ))}
      {off.length > 1 && <path d={path(off)} fill="none" stroke="var(--avoid)" strokeWidth={1.8} data-line="off" />}
      {on.length > 1 && <path d={path(on)} fill="none" stroke="var(--actuator)" strokeWidth={1.8} data-line="on" />}
      <text x={(pad.l + w - pad.r) / 2} y={h - 8} fontSize={10} textAnchor="middle" fill="var(--text-muted)">
        presentations of the new season
      </text>
      <text x={pad.l + 6} y={pad.t + 10} fontSize={9} fill="var(--avoid)">
        replay off
      </text>
      <text x={pad.l + 6} y={pad.t + 22} fontSize={9} fill="var(--actuator)">
        replay on
      </text>
      <text x={w - pad.r} y={Y(0) + 12} fontSize={9} textAnchor="end" fill="var(--text-muted)">
        {maxX}
      </text>
    </svg>
  )
}
