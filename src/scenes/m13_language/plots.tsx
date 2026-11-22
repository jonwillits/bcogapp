import type { ReactNode } from 'react'

/**
 * The plots of this lab: lines over an ordered axis (labeling curves,
 * discrimination, learners against listening, agreement by depth), bars
 * (next-token distributions), a scatter of labeled points (vowels, the
 * principal plane), and a dendrogram (the count model's tree of clusters).
 * SVG, dependency-free, every axis labeled with what it counts and in what
 * units.
 */

export interface Series {
  label: string
  color: string
  points: [number, number][]
  dashed?: boolean
  /** Filled band: [x, lo, hi] per point. */
  band?: [number, number, number][]
}

/**
 * A line plot. By default the key sits inside the plot area at the top left
 * and a horizontal line's label at its right end inside the area; with
 * `legend="left"` the key stands in a column to the left of the y axis, and
 * with `hLineLabels="right"` the lines' labels stand to the right of where
 * the plot area stops (Jon, 2026-11-21: Part 2's Step 3 plot, where six
 * lines with their bands covered the key and the adults' labels); a
 * vertical mark's label sits at the top of the area, or at the bottom with
 * `markLabels="bottom"` where the lines crowd the top. `fluid` lets the
 * picture shrink with its container, keeping its proportions.
 */
export function LinePlot({ series, width = 420, height = 200, xLabel, yLabel, xMin, xMax, yMin = 0, yMax = 100, xTicks, yTicks, marks, hLines, logX, legend = 'inside', legendWidth = 196, hLineLabels = 'inside', rightWidth = 152, markLabels = 'top', fluid, testId }: { series: Series[]; width?: number; height?: number; xLabel: string; yLabel: string; xMin?: number; xMax?: number; yMin?: number; yMax?: number; xTicks?: { x: number; label: string }[]; yTicks?: number[]; marks?: { x: number; label: string; color?: string }[]; hLines?: { y: number; label: string; color?: string }[]; logX?: boolean; legend?: 'inside' | 'left'; legendWidth?: number; hLineLabels?: 'inside' | 'right'; rightWidth?: number; markLabels?: 'top' | 'bottom'; fluid?: boolean; testId?: string }) {
  const legendW = legend === 'left' ? legendWidth : 0
  const rightW = hLineLabels === 'right' ? rightWidth : 0
  const pad = { l: 44 + legendW, r: 12 + rightW, t: 12, b: 34 }
  const xs = series.flatMap((s) => s.points.map((p) => p[0]))
  const lo = xMin ?? Math.min(...xs)
  const hi = xMax ?? Math.max(...xs)
  const tx = (x: number) => (logX ? Math.log(x) : x)
  const X = (x: number) => pad.l + ((tx(x) - tx(lo)) / (tx(hi) - tx(lo) || 1)) * (width - pad.l - pad.r)
  const Y = (y: number) => height - pad.b - ((y - yMin) / (yMax - yMin || 1)) * (height - pad.t - pad.b)
  const yt = yTicks ?? [yMin, (yMin + yMax) / 2, yMax]
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${yLabel} against ${xLabel}`} style={{ display: 'block', background: 'var(--bg)', borderRadius: 8, ...(fluid ? { width: '100%', maxWidth: width, height: 'auto' } : {}) }} data-plot={testId ?? 'line'} data-legend={legend}>
      {yt.map((y) => (
        <g key={y}>
          <line x1={pad.l} y1={Y(y)} x2={width - pad.r} y2={Y(y)} stroke="var(--border)" />
          <text x={pad.l - 4} y={Y(y) + 3} fontSize={9} textAnchor="end" fill="var(--text-muted)">
            {y}
          </text>
        </g>
      ))}
      {hLines?.map((h) => (
        <g key={h.label}>
          <line x1={pad.l} y1={Y(h.y)} x2={width - pad.r} y2={Y(h.y)} stroke={h.color ?? 'var(--text-muted)'} strokeDasharray="3 3" />
          {hLineLabels === 'right' ? (
            <text x={width - pad.r + 5} y={Y(h.y) + 3} fontSize={9} fill={h.color ?? 'var(--text-muted)'}>
              {h.label}
            </text>
          ) : (
            <text x={width - pad.r - 2} y={Y(h.y) - 3} fontSize={9} textAnchor="end" fill={h.color ?? 'var(--text-muted)'}>
              {h.label}
            </text>
          )}
        </g>
      ))}
      {(xTicks ?? []).map((t) => (
        <text key={t.label} x={X(t.x)} y={height - pad.b + 12} fontSize={9} textAnchor="middle" fill="var(--text-muted)">
          {t.label}
        </text>
      ))}
      {marks?.map((m) => (
        <g key={m.label}>
          <line x1={X(m.x)} y1={pad.t} x2={X(m.x)} y2={height - pad.b} stroke={m.color ?? 'var(--sensor)'} strokeDasharray="3 3" />
          <text x={X(m.x) + 3} y={markLabels === 'bottom' ? height - pad.b - 5 : pad.t + 10} fontSize={9} fill={m.color ?? 'var(--sensor)'}>
            {m.label}
          </text>
        </g>
      ))}
      {series.map((s) => (
        <g key={s.label} data-series={s.label}>
          {s.band && <polygon points={[...s.band.map((b) => `${X(b[0])},${Y(b[2])}`), ...s.band.slice().reverse().map((b) => `${X(b[0])},${Y(b[1])}`)].join(' ')} fill={s.color} opacity={0.15} />}
          <polyline points={s.points.map((p) => `${X(p[0])},${Y(p[1])}`).join(' ')} fill="none" stroke={s.color} strokeWidth={2} strokeDasharray={s.dashed ? '5 4' : undefined} />
          {s.points.map((p, i) => (
            <circle key={i} cx={X(p[0])} cy={Y(p[1])} r={2.8} fill={s.color}>
              <title>{`${s.label}: ${p[1].toFixed(1)} at ${p[0]}`}</title>
            </circle>
          ))}
        </g>
      ))}
      <text x={(pad.l + width - pad.r) / 2} y={height - 4} fontSize={10} textAnchor="middle" fill="var(--text-muted)">
        {xLabel}
      </text>
      <text x={legendW + 10} y={(pad.t + height - pad.b) / 2} fontSize={10} textAnchor="middle" fill="var(--text-muted)" transform={`rotate(-90 ${legendW + 10} ${(pad.t + height - pad.b) / 2})`}>
        {yLabel}
      </text>
      {series.map((s, i) =>
        legend === 'left' ? (
          <g key={'k' + s.label} data-key={s.label}>
            <line x1={6} y1={pad.t + 8 + i * 14} x2={22} y2={pad.t + 8 + i * 14} stroke={s.color} strokeWidth={2} strokeDasharray={s.dashed ? '5 4' : undefined} />
            <text x={26} y={pad.t + 11 + i * 14} fontSize={9} fill="var(--text)">
              {s.label}
            </text>
          </g>
        ) : (
          <g key={'k' + s.label} data-key={s.label}>
            <line x1={pad.l + 8} y1={pad.t + 8 + i * 12} x2={pad.l + 22} y2={pad.t + 8 + i * 12} stroke={s.color} strokeWidth={2} strokeDasharray={s.dashed ? '5 4' : undefined} />
            <text x={pad.l + 26} y={pad.t + 11 + i * 12} fontSize={9} fill="var(--text-muted)">
              {s.label}
            </text>
          </g>
        ),
      )}
    </svg>
  )
}

export interface Bar {
  label: string
  value: number
  color?: string
  group?: string
}

/** Horizontal bars with the number printed, for distributions over tokens and shares. */
export function BarChart({ bars, width = 400, max, format = (v) => v.toFixed(2), rowH = 14, testId }: { bars: Bar[]; width?: number; max?: number; format?: (v: number) => string; rowH?: number; testId?: string }) {
  const m = max ?? Math.max(1e-9, ...bars.map((b) => b.value))
  const labelW = 90
  const valueW = 44
  const barW = width - labelW - valueW - 8
  // Tight rows (under 12 px) leave the first label's top above the picture, so give it room (Jon, 2026-11-21: Part 2, Step 4's histograms).
  const top = rowH < 12 ? 5 : 0
  return (
    <svg width={width} height={bars.length * rowH + 4 + top} viewBox={`0 0 ${width} ${bars.length * rowH + 4 + top}`} style={{ display: 'block' }} data-bars={testId ?? true}>
      {bars.map((b, i) => (
        <g key={b.label + i} data-bar={b.label}>
          <text x={labelW - 4} y={top + i * rowH + rowH - 3} fontSize={10} textAnchor="end" fill="var(--text)">
            {b.label}
          </text>
          <rect x={labelW} y={top + i * rowH + 2} width={Math.max(0, (b.value / m) * barW)} height={rowH - 4} fill={b.color ?? 'var(--accent)'} />
          <text x={labelW + barW + 4} y={top + i * rowH + rowH - 3} fontSize={10} fill="var(--text-muted)" fontFamily="var(--font-mono)">
            {format(b.value)}
          </text>
        </g>
      ))}
    </svg>
  )
}

// ------------------------------------------------------------ label placement

/** A label's box on a plot, in pixels. */
export interface Box {
  x0: number
  y0: number
  x1: number
  y1: number
}
/** A label's estimated size at font size 10: about 5.5 px per character, 12 px tall. */
const LABEL_CHAR_W = 5.5
const LABEL_H = 12
const overlapArea = (a: Box, b: Box) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0))
const inside = (b: Box, r: Box) => b.x0 >= r.x0 && b.x1 <= r.x1 && b.y0 >= r.y0 && b.y1 <= r.y1
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

export interface PlacedLabel {
  /** The text's anchor point. */
  x: number
  y: number
  anchor: 'start' | 'end' | 'middle'
  /** The label could not be placed clear of the others: draw a thin line from the point to it. */
  leader: boolean
  box: Box
}

/**
 * Place labels so that none sits on top of another (Jon, 2026-11-17: on the
 * plane many labels were right on top of each other). The candidates for
 * each label, in order: right of the point, left, above, below, then the
 * same four farther out, twice. The first candidate that overlaps no label
 * placed so far and stays inside `room` is taken; with few points the first
 * candidate always fits, so a sparse plot looks as it did. If none fits, the
 * least-overlapping candidate is taken and `leader` is set.
 */
export function placeLabels(points: { px: number; py: number; label: string }[], room: Box): PlacedLabel[] {
  const placed: Box[] = []
  return points.map((p) => {
    const w = Math.max(LABEL_CHAR_W, p.label.length * LABEL_CHAR_W)
    const h = LABEL_H
    const cands: { box: Box; x: number; y: number; anchor: PlacedLabel['anchor'] }[] = []
    for (const d of [7, 18, 30]) {
      cands.push({ box: { x0: p.px + d, x1: p.px + d + w, y0: p.py - h / 2, y1: p.py + h / 2 }, x: p.px + d, y: p.py + 3.5, anchor: 'start' })
      cands.push({ box: { x0: p.px - d - w, x1: p.px - d, y0: p.py - h / 2, y1: p.py + h / 2 }, x: p.px - d, y: p.py + 3.5, anchor: 'end' })
      cands.push({ box: { x0: p.px - w / 2, x1: p.px + w / 2, y0: p.py - d + 1 - h, y1: p.py - d + 1 }, x: p.px, y: p.py - d - 2, anchor: 'middle' })
      cands.push({ box: { x0: p.px - w / 2, x1: p.px + w / 2, y0: p.py + d - 1, y1: p.py + d - 1 + h }, x: p.px, y: p.py + d - 4 + h, anchor: 'middle' })
    }
    const cost = (b: Box) => placed.reduce((s, q) => s + overlapArea(b, q), 0) + (inside(b, room) ? 0 : 1e6)
    let best = cands[0]
    let bestCost = Infinity
    for (const c of cands) {
      const k = cost(c.box)
      if (k < bestCost) {
        bestCost = k
        best = c
      }
      if (k === 0) break
    }
    placed.push(best.box)
    return { x: best.x, y: best.y, anchor: best.anchor, leader: bestCost > 0, box: best.box }
  })
}

/** Labeled points on a plane. The domain is padded by a tenth on each side, and labels are placed clear of one another and inside the plot (`placeLabels`); a label that cannot be placed clear gets a thin leader line from its point. */
export function Scatter({ points, width = 320, height = 240, xLabel, yLabel, flipX, flipY, testId, children }: { points: { x: number; y: number; label: string; color?: string }[]; width?: number; height?: number; xLabel: string; yLabel: string; flipX?: boolean; flipY?: boolean; testId?: string; children?: ReactNode }) {
  const pad = { l: 40, r: 12, t: 12, b: 30 }
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  const span = (a: number, b: number) => (b - a || 1) * 0.12
  const lo = Math.min(...xs) - span(Math.min(...xs), Math.max(...xs))
  const hi = Math.max(...xs) + span(Math.min(...xs), Math.max(...xs))
  const ylo = Math.min(...ys) - span(Math.min(...ys), Math.max(...ys))
  const yhi = Math.max(...ys) + span(Math.min(...ys), Math.max(...ys))
  const X = (x: number) => {
    const u = (x - lo) / (hi - lo || 1)
    return pad.l + (flipX ? 1 - u : u) * (width - pad.l - pad.r)
  }
  const Y = (y: number) => {
    const u = (y - ylo) / (yhi - ylo || 1)
    return height - pad.b - (flipY ? 1 - u : u) * (height - pad.t - pad.b)
  }
  // Labels may use the plot and the left pad past the rotated axis label, down to the tick line.
  const room: Box = { x0: 16, y0: 1, x1: width - 1, y1: height - pad.b + 6 }
  const placed = placeLabels(points.map((p) => ({ px: X(p.x), py: Y(p.y), label: p.label })), room)
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${yLabel} against ${xLabel}`} style={{ display: 'block', background: 'var(--bg)', borderRadius: 8 }} data-plot={testId ?? 'scatter'}>
      {points.map((p, i) => {
        const l = placed[i]
        const px = X(p.x)
        const py = Y(p.y)
        return (
          <g key={p.label} data-point={p.label}>
            <circle cx={px} cy={py} r={4} fill={p.color ?? 'var(--accent)'} />
            {l.leader && <line x1={px} y1={py} x2={clamp(px, l.box.x0, l.box.x1)} y2={clamp(py, l.box.y0, l.box.y1)} stroke="var(--text-muted)" strokeWidth={0.6} data-leader={p.label} />}
            <text x={l.x} y={l.y} fontSize={10} textAnchor={l.anchor} fill="var(--text)">
              {p.label}
            </text>
          </g>
        )
      })}
      {children}
      <text x={(pad.l + width - pad.r) / 2} y={height - 4} fontSize={10} textAnchor="middle" fill="var(--text-muted)">
        {xLabel}
      </text>
      <text x={10} y={(pad.t + height - pad.b) / 2} fontSize={10} textAnchor="middle" fill="var(--text-muted)" transform={`rotate(-90 10 ${(pad.t + height - pad.b) / 2})`}>
        {yLabel}
      </text>
      <text x={pad.l} y={height - pad.b + 12} fontSize={9} fill="var(--text-muted)">
        {(flipX ? Math.max(...xs) : Math.min(...xs)).toFixed(0)}
      </text>
      <text x={width - pad.r} y={height - pad.b + 12} fontSize={9} textAnchor="end" fill="var(--text-muted)">
        {(flipX ? Math.min(...xs) : Math.max(...xs)).toFixed(0)}
      </text>
    </svg>
  )
}

// ---------------------------------------------------------------- dendrogram

/** A node of a cluster tree: a leaf has one member and height 0; a join has two children and the height at which they joined. */
export interface TreeNode {
  members: number[]
  height: number
  children?: [TreeNode, TreeNode]
}

/**
 * A horizontal dendrogram (Jon, 2026-11-17: the clustering was not rendering
 * as a graph). The leaves are stacked at the left with their labels, in the
 * order of a depth-first walk of the tree so that no lines cross; the x axis
 * is the height of a join, from 0 at the leaves to the root's height, and
 * each join is drawn as a bracket: a line from each child to the join's x,
 * and a vertical line between them.
 */
export function Dendrogram({ tree, labels, leafColor, width = 520, rowH = 14, xLabel = '1 − correlation at the join', testId }: { tree: TreeNode; labels: string[]; leafColor?: (member: number) => string; width?: number; rowH?: number; xLabel?: string; testId?: string }) {
  const leaves: number[] = []
  const walk = (c: TreeNode) => {
    if (!c.children) leaves.push(c.members[0])
    else {
      walk(c.children[0])
      walk(c.children[1])
    }
  }
  walk(tree)
  const n = leaves.length
  const pad = { t: 8, b: 34, l: 6, r: 14 }
  const labelW = Math.max(0, ...leaves.map((m) => (labels[m] ?? '').length)) * 6.2 + 10
  const x0 = pad.l + labelW
  const plotW = Math.max(40, width - x0 - pad.r)
  const maxH = tree.height || 1e-9
  const X = (h: number) => x0 + (h / maxH) * plotW
  const rowOf = new Map<number, number>()
  leaves.forEach((m, i) => rowOf.set(m, i))
  const yOfRow = (i: number) => pad.t + i * rowH + rowH / 2
  const axisY = pad.t + n * rowH + 6
  const height = axisY + pad.b - 6
  const joins: ReactNode[] = []
  const place = (c: TreeNode): { x: number; y: number } => {
    if (!c.children) return { x: X(0), y: yOfRow(rowOf.get(c.members[0])!) }
    const a = place(c.children[0])
    const b = place(c.children[1])
    const x = X(c.height)
    joins.push(<path key={c.members.join('-')} d={`M ${a.x} ${a.y} H ${x} V ${b.y} H ${b.x}`} fill="none" stroke="var(--text-muted)" strokeWidth={1} data-join={c.height.toFixed(3)} />)
    return { x, y: (a.y + b.y) / 2 }
  }
  place(tree)
  const ticks = [0, maxH / 2, maxH]
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`a tree of clusters, joins placed by ${xLabel}`} style={{ display: 'block', background: 'var(--bg)', borderRadius: 8 }} data-plot={testId ?? 'tree'}>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={X(t)} y1={pad.t} x2={X(t)} y2={axisY} stroke="var(--border)" />
          <text x={X(t)} y={axisY + 12} fontSize={9} textAnchor="middle" fill="var(--text-muted)">
            {t.toFixed(2)}
          </text>
        </g>
      ))}
      <line x1={x0} y1={axisY} x2={x0 + plotW} y2={axisY} stroke="var(--text-muted)" />
      {joins}
      {leaves.map((m, i) => (
        <text key={m} x={x0 - 4} y={yOfRow(i) + 3.5} fontSize={10} textAnchor="end" fill={leafColor?.(m) ?? 'var(--text)'} data-leaf={labels[m]}>
          {labels[m]}
        </text>
      ))}
      <text x={x0 + plotW / 2} y={height - 4} fontSize={10} textAnchor="middle" fill="var(--text-muted)">
        {xLabel}
      </text>
    </svg>
  )
}
