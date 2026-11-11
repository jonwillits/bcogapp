import { PEG_LABEL, stateGraph, type Arrangement, type Peg } from '../../../sim/planning/puzzles/hanoi'
import { childrenOf, N_NODES, stepOf, type Tree } from '../../../sim/planning/puzzles/trees'
import { Note } from '../ui'

/**
 * The drawings of Part 2: the pegs and disks, the state graph as the chapter
 * draws it, and a tree of hidden numbers. All are SVG, with every color and
 * mark named in the panel beside them. Checked by eye on both themes.
 */

const PEG_X = [60, 180, 300]

export function Pegs({ arrangement, lifted, onPeg, width = 360, interactive = true }: { arrangement: Arrangement; lifted?: Peg | null; onPeg?: (peg: Peg) => void; width?: number; interactive?: boolean }) {
  const n = arrangement.length
  const scale = width / 360
  const height = 170 * scale
  const diskW = (d: number) => (28 + d * 20) * scale
  const diskH = 14 * scale
  const base = 140 * scale
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`the tower: ${n} disks on three pegs`} data-pegs>
      <rect x={10 * scale} y={base} width={340 * scale} height={6 * scale} fill="var(--text-muted)" />
      {([0, 1, 2] as Peg[]).map((p) => {
        const x = PEG_X[p] * scale
        const stack = [...arrangement.keys()].filter((d) => arrangement[d] === p).sort((a, b) => b - a)
        return (
          <g key={p} onClick={interactive && onPeg ? () => onPeg(p) : undefined} style={{ cursor: interactive ? 'pointer' : 'default' }} data-peg={p}>
            <rect x={x - 60 * scale} y={20 * scale} width={120 * scale} height={base - 20 * scale} fill="transparent" />
            <rect x={x - 3 * scale} y={30 * scale} width={6 * scale} height={base - 30 * scale} fill="var(--border)" />
            {stack.map((d, i) => {
              const isLifted = lifted === p && i === stack.length - 1
              const y = isLifted ? 8 * scale : base - diskH * (i + 1)
              return <rect key={d} x={x - diskW(d) / 2} y={y} width={diskW(d)} height={diskH - 2} rx={4} fill={`hsl(${200 + d * 32}, 70%, ${isLifted ? 70 : 55}%)`} stroke="var(--bg)" data-disk={d} />
            })}
            <text x={x} y={height - 6} fontSize={11 * scale} textAnchor="middle" fill="var(--text-muted)">
              {PEG_LABEL[p]}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

/**
 * The state graph (spec §6.2; the chapter's `f-hanoi-states`): every
 * arrangement a node, joined to the arrangements one legal move away, the
 * shortest solution in a heavier line along one side, the student's path
 * drawn over it in order with every node visited marked and every long
 * pause ringed, and the halfway node marked for four disks.
 */
export function StateGraphView({ disks, path, pauses, highlight, width = 420, hovered, onHover, onPick }: { disks: number; path?: number[]; pauses?: number[]; highlight?: number[]; width?: number; /** The dot the pointer is over, ringed; `onHover` reports it, or null when the pointer leaves (the snapshot beside the map, Jon's walk, 2026-11-11). */ hovered?: number | null; onHover?: (id: number | null) => void; /** A dot clicked: the student picks that arrangement as the next start (Jon, 2026-11-11). */ onPick?: (id: number) => void }) {
  const g = stateGraph(disks)
  const height = width * 0.9
  const pad = 18
  const X = (x: number) => pad + x * (width - 2 * pad)
  const Y = (y: number) => pad + y * ((height - 2 * pad) / 0.866)
  const shortest = new Set<string>()
  for (let i = 1; i < g.shortest.length; i++) shortest.add(key(g.shortest[i - 1], g.shortest[i]))
  const visited = new Set(path ?? [])
  const pathEdges = new Map<string, number>()
  if (path) for (let i = 1; i < path.length; i++) pathEdges.set(key(path[i - 1], path[i]), (pathEdges.get(key(path[i - 1], path[i])) ?? 0) + 1)
  const r = Math.max(1.5, 5 - disks * 0.6)
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`the state graph of ${disks} disks: ${g.nodes.length} arrangements`} data-state-graph={disks} style={{ background: 'var(--bg)', borderRadius: 8, maxWidth: '100%' }} onMouseLeave={onHover ? () => onHover(null) : undefined}>
      {g.nodes.map((n) => n.neighbors.filter((m) => m > n.id).map((m) => {
        const o = g.nodes[m]
        const k = key(n.id, m)
        const onShortest = shortest.has(k)
        const onPath = pathEdges.get(k)
        return <line key={k} x1={X(n.x)} y1={Y(n.y)} x2={X(o.x)} y2={Y(o.y)} stroke={onPath ? 'var(--sensor)' : onShortest ? 'var(--accent)' : 'var(--border)'} strokeWidth={onPath ? 2.5 : onShortest ? 2.5 : 1} strokeOpacity={onPath ? 0.9 : 1} />
      }))}
      {g.nodes.map((n) => (
        <circle key={n.id} cx={X(n.x)} cy={Y(n.y)} r={visited.has(n.id) ? r + 1.5 : r} fill={visited.has(n.id) ? 'var(--sensor)' : highlight?.includes(n.id) ? 'var(--actuator)' : 'var(--text-muted)'} data-node={n.id} />
      ))}
      {pauses?.map((id, i) => (
        <circle key={`p${i}`} cx={X(g.nodes[id].x)} cy={Y(g.nodes[id].y)} r={r + 6} fill="none" stroke="var(--avoid)" strokeWidth={2} data-pause={id} />
      ))}
      {hovered !== null && hovered !== undefined && g.nodes[hovered] && <circle cx={X(g.nodes[hovered].x)} cy={Y(g.nodes[hovered].y)} r={r + 5} fill="none" stroke="var(--accent)" strokeWidth={2} data-hovered={hovered} />}
      {onHover && g.nodes.map((n) => <circle key={`h${n.id}`} cx={X(n.x)} cy={Y(n.y)} r={Math.max(r + 4, 6)} fill="transparent" onMouseEnter={() => onHover(n.id)} onClick={onPick ? () => onPick(n.id) : undefined} style={{ cursor: onPick ? 'pointer' : 'crosshair' }} />)}
      {g.halfway !== null && <circle cx={X(g.nodes[g.halfway].x)} cy={Y(g.nodes[g.halfway].y)} r={r + 4} fill="none" stroke="var(--actuator)" strokeWidth={1.5} strokeDasharray="3 2" data-halfway />}
      <text x={X(g.nodes[g.shortest[0]].x)} y={Y(g.nodes[g.shortest[0]].y) - 8} fontSize={10} textAnchor="middle" fill="var(--text)">
        start
      </text>
      <text x={X(g.nodes[g.shortest[g.shortest.length - 1]].x)} y={Y(g.nodes[g.shortest[g.shortest.length - 1]].y) + 14} fontSize={10} textAnchor="end" fill="var(--text)">
        goal
      </text>
    </svg>
  )
}

const key = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`)

export const GRAPH_LEGEND = 'Each dot is an arrangement of the disks, and each line joins two arrangements one legal move apart. The heavier line along one side is the shortest solution. Dots and lines in the second color are your own path, in the order you made your moves; a red ring marks a long pause; a dashed green ring marks the halfway node of the four-disk puzzle.'

/** A tree of hidden numbers (spec §6.4): the start at the top, two choices at each of three steps. Hidden nodes show a question mark; uncovered nodes their number; the chosen path is outlined. */
export function TreeView({ tree, known, chosen, revealAll, settled, onLook, onChoose, width = 440 }: { tree: Tree; known: (number | null)[]; chosen: number[]; revealAll: boolean; /** The path is taken: no node is clickable and no node carries a choosing label. */ settled?: boolean; onLook: (n: number) => void; onChoose: (n: number) => void; width?: number }) {
  const height = 300
  const pos = (n: number): { x: number; y: number } => {
    const step = stepOf(n)
    const count = step === 1 ? 2 : step === 2 ? 4 : 8
    const i = step === 1 ? n : step === 2 ? n - 2 : n - 6
    return { x: ((i + 0.5) / count) * width, y: 60 + (step - 1) * 95 }
  }
  const top = { x: width / 2, y: 20 }
  const edges: [{ x: number; y: number }, { x: number; y: number }][] = []
  for (const a of [0, 1]) edges.push([top, pos(a)])
  for (let n = 0; n < 6; n++) for (const c of childrenOf(n)) edges.push([pos(n), pos(c)])
  const onPath = (n: number) => chosen.includes(n)
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="a tree of hidden numbers with 14 nodes and 8 paths" data-tree style={{ background: 'var(--bg)', borderRadius: 8, maxWidth: '100%' }}>
      {edges.map(([a, b], i) => (
        <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--border)" />
      ))}
      <circle cx={top.x} cy={top.y} r={8} fill="var(--text-muted)" />
      <text x={top.x} y={top.y - 12} fontSize={10} textAnchor="middle" fill="var(--text-muted)">
        start
      </text>
      {Array.from({ length: N_NODES }, (_, n) => {
        const p = pos(n)
        const value = revealAll ? tree.values[n] : known[n]
        const shown = value !== null
        return (
          <g key={n} data-tree-node={n} data-known={shown ? value : undefined}>
            <circle cx={p.x} cy={p.y} r={18} fill={shown ? (value! < 0 ? 'var(--avoid)' : 'var(--actuator)') : 'var(--surface-2)'} stroke={onPath(n) ? 'var(--accent)' : 'var(--border)'} strokeWidth={onPath(n) ? 3 : 1} style={{ cursor: settled ? 'default' : 'pointer' }} onClick={settled ? undefined : () => (shown ? onChoose(n) : onLook(n))} />
            <text x={p.x} y={p.y + 4} fontSize={12} fontWeight={600} textAnchor="middle" fill={shown ? '#0b111c' : 'var(--text)'} style={{ pointerEvents: 'none' }}>
              {shown ? (value! > 0 ? `+${value}` : `−${Math.abs(value!)}`) : '?'}
            </text>
            {shown && !revealAll && !settled && (
              <text x={p.x} y={p.y + 30} fontSize={9} textAnchor="middle" fill="var(--text-muted)" style={{ cursor: 'pointer' }} onClick={() => onChoose(n)}>
                {onPath(n) ? 'on your path' : 'click to choose'}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

/** A made-up tree for the instruction screen (Jon, 2026-11-11): regular values only, three uncovered, a path chosen through one hidden node. It teaches the mechanics and nothing about the measure. */
const EXAMPLE_TREE: Tree = { kind: 'regular', values: [10, -5, 5, -5, 10, -10, 5, -10, 5, 10, -5, 5, 10, -5], lossNode: null }
const EXAMPLE_KNOWN: (number | null)[] = EXAMPLE_TREE.values.map((v, n) => ([0, 2, 3].includes(n) ? v : null))
export const EXAMPLE_CAPTION = 'An example. Three numbers have been uncovered, at a cost of 3 points: +10, +5 and −5. The path outlined runs through +10, +5 and a node still hidden. If that node turns out to be +5, the path is worth 20 points, and the tree earns 20 − 3 = 17 points.'

export function TreeExample() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }} data-tree-example>
      <TreeView tree={EXAMPLE_TREE} known={EXAMPLE_KNOWN} chosen={[0, 2, 6]} revealAll={false} settled onLook={() => {}} onChoose={() => {}} width={360} />
      <Note>{EXAMPLE_CAPTION}</Note>
    </div>
  )
}

export const TREE_LEGEND = 'A node with a question mark is hidden; clicking it uncovers its number for 1 point. An uncovered node is green for a gain and red for a loss. A node outlined in the accent color is on the path you are choosing. A hidden node can be chosen for a path without uncovering it: click it once to uncover, or build the path from uncovered nodes; a path may run through hidden nodes, whose numbers you learn when you take it.'

export function TreePathPicker({ chosen, known, onChoose }: { chosen: number[]; known: (number | null)[]; onChoose: (n: number) => void }) {
  // Hidden nodes can be chosen for the path through these small buttons, so that a path may run through a node never uncovered.
  const options = chosen.length === 0 ? [0, 1] : chosen.length === 1 ? childrenOf(chosen[0]) : chosen.length === 2 ? childrenOf(chosen[1]) : []
  if (!options.length) return null
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }} data-path-picker>
      <Note>Choose the next node of your path (step {chosen.length + 1}):</Note>
      {options.map((n) => (
        <button key={n} type="button" onClick={() => onChoose(n)} style={{ padding: '4px 9px', fontSize: 11.5, borderRadius: 999, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', cursor: 'pointer' }}>
          {known[n] === null ? `the ${n === options[0] ? 'left' : 'right'} node (hidden)` : `the ${n === options[0] ? 'left' : 'right'} node (${known[n]! > 0 ? '+' : ''}${known[n]})`}
        </button>
      ))}
    </div>
  )
}
