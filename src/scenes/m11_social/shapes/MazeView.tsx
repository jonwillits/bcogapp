import { GOALS, type Cell } from '../../../sim/social/paths/maze'
import { layoutById, type AuthoredPath } from '../../../sim/social/paths/pool'

/**
 * The maze (spec §7.2): a grid with walls, the three goals labeled A, B
 * and C, the dot, and the trace of its path so far (a memory aid, as in
 * Baker et al.). Drawn from the layout and the path's cells; nothing of
 * the destination is drawn before the dot gets there.
 */

const S = 34

export function MazeView({ path, steps, trace = true, full = false }: { path: AuthoredPath; steps: number; trace?: boolean; full?: boolean }) {
  const layout = layoutById(path.layout)
  const W = layout.width * S
  const H = layout.height * S
  const X = (c: Cell) => c.x * S + S / 2
  const Y = (c: Cell) => (layout.height - 1 - c.y) * S + S / 2
  const upto = full ? path.cells.length - 1 : steps
  const dot = path.cells[Math.min(upto, path.cells.length - 1)]
  const traced = path.cells.slice(0, upto + 1)
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', background: 'var(--bg)', borderRadius: 8, maxWidth: '100%' }} role="img" aria-label="the maze" data-maze={path.id} data-steps={upto}>
      {Array.from({ length: layout.width + 1 }, (_, i) => (
        <line key={`v${i}`} x1={i * S} y1={0} x2={i * S} y2={H} stroke="#1e2738" />
      ))}
      {Array.from({ length: layout.height + 1 }, (_, i) => (
        <line key={`h${i}`} x1={0} y1={i * S} x2={W} y2={i * S} stroke="#1e2738" />
      ))}
      {layout.walls.map((w, i) => (
        <rect key={i} x={w.x * S} y={(layout.height - 1 - w.y) * S} width={S} height={S} fill="#9aa6b8" data-wall />
      ))}
      {GOALS.map((g) => (
        <text key={g} x={X(layout.goals[g])} y={Y(layout.goals[g]) + 6} textAnchor="middle" fontSize={18} fontWeight={700} fill="#f0a94b" data-goal={g}>
          {g}
        </text>
      ))}
      {trace && traced.length > 1 && <polyline points={traced.map((c) => `${X(c)},${Y(c)}`).join(' ')} fill="none" stroke="#4f9cff" strokeWidth={2} strokeDasharray="4 3" opacity={0.7} data-trace />}
      <circle cx={X(dot)} cy={Y(dot)} r={9} fill="#4f9cff" stroke="#e7ecf3" strokeWidth={2} data-dot />
    </svg>
  )
}
