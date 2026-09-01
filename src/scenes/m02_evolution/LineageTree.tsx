import { useMemo } from 'react'
import { markCss } from '../../sim/creature/genome'
import type { Lineage } from '../../sim/world/continuousWorld'
import { palette } from '../../theme/theme'

/**
 * The ancestry of the population in front of you, with founders labelled.
 *
 * Hidden behind a Reveal control wherever it appears, because the whole of Part
 * 3 depends on a student committing to an answer before they are allowed to
 * look. Once revealed it is the thing that settles Q13: two populations sharing
 * a recent ancestor is a homology, two arriving at the same behaviour from
 * different roots is an analogy, and nothing in the behaviour alone can tell
 * them apart.
 *
 * Real time runs left to right, which is what a phylogeny actually looks like
 * and is only possible now that there are no generations to number. It also
 * shows something generation columns could not: a lineage that reproduces fast
 * is visibly bushier than one that does not, because its branches are packed
 * closer together in time rather than marching in lockstep down a grid.
 *
 * Lines are drawn in each creature's **mark** — the neutral trait — not its body
 * colour. Body colour is the wiring, and the tree's whole job is to show
 * ancestry independently of it.
 */
export function LineageTree({
  lineage,
  memberIds,
  highlight,
  span,
  width = 250,
  height = 190,
  label,
}: {
  lineage: readonly Lineage[]
  memberIds: readonly number[]
  /** Draw these ids and their ancestors brighter — used by the individual panel. */
  highlight?: readonly number[]
  /** Simulated seconds the run covers, for the time axis. */
  span: number
  width?: number
  height?: number
  label?: string
}) {
  const layout = useMemo(() => {
    const byId = new Map(lineage.map((n) => [n.id, n]))

    // Vertical position by descent: walk the roots depth-first so siblings stay
    // adjacent and the tree crosses itself no more than the ancestry does.
    const children = new Map<number | null, Lineage[]>()
    for (const n of lineage) {
      const list = children.get(n.parentId) ?? []
      list.push(n)
      children.set(n.parentId, list)
    }
    for (const list of children.values()) list.sort((a, b) => a.bornAt - b.bornAt)

    /**
     * Vertical position, laid out as a dendrogram rather than by walk order.
     *
     * Only the tips — creatures with no surviving descendants in this pruned
     * tree — get their own row; every ancestor sits at the mean of its
     * children. A plain depth-first ordering gives each node a distinct row and
     * draws a long diagonal staircase, in which a lineage is impossible to
     * follow. Putting a parent between its offspring is what makes the shape a
     * student is being asked to read — where lines converge — actually visible.
     */
    const pos = new Map<number, number>()
    const tips: Lineage[] = []
    const collectTips = (node: Lineage) => {
      const kids = children.get(node.id) ?? []
      if (kids.length === 0) tips.push(node)
      else for (const k of kids) collectTips(k)
    }
    const roots = children.get(null) ?? []
    for (const root of roots) collectTips(root)
    tips.forEach((t, i) => pos.set(t.id, tips.length === 1 ? 0.5 : i / (tips.length - 1)))

    const place = (node: Lineage): number => {
      const kids = children.get(node.id) ?? []
      if (kids.length === 0) return pos.get(node.id) ?? 0.5
      const ys = kids.map(place)
      const y = ys.reduce((a, b) => a + b, 0) / ys.length
      pos.set(node.id, y)
      return y
    }
    for (const root of roots) place(root)

    const lit = new Set<number>()
    if (highlight) {
      for (const id of highlight) {
        let c: number | null = id
        while (c !== null && !lit.has(c)) {
          lit.add(c)
          c = byId.get(c)?.parentId ?? null
        }
      }
    }
    return { byId, pos, lit }
  }, [lineage, highlight])

  const padX = 8
  const padY = 10
  const x = (t: number) => padX + (t / Math.max(1, span)) * (width - padX * 2)
  const y = (id: number) => padY + (layout.pos.get(id) ?? 0.5) * (height - padY * 2)

  const members = new Set(memberIds)

  return (
    <div>
      {label && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>
          {label}
        </div>
      )}
      <svg
        width="100%"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Ancestry of the current population"
      >
        {lineage.map((n) => {
          const bright = !layout.lit.size || layout.lit.has(n.id)
          const end = n.diedAt ?? span
          const parent = n.parentId === null ? null : layout.byId.get(n.parentId)
          return (
            <g key={`e${n.id}`}>
              {/* The life itself: born here, died there. */}
              <line
                x1={x(n.bornAt)}
                y1={y(n.id)}
                x2={x(end)}
                y2={y(n.id)}
                stroke={markCss(n.mark)}
                strokeWidth={bright ? 1.5 : 0.6}
                opacity={bright ? 0.8 : 0.14}
              />
              {/* The link to its parent, at the moment of birth. */}
              {parent && (
                <line
                  x1={x(n.bornAt)}
                  y1={y(parent.id)}
                  x2={x(n.bornAt)}
                  y2={y(n.id)}
                  stroke={markCss(n.mark)}
                  strokeWidth={bright ? 0.9 : 0.4}
                  opacity={bright ? 0.5 : 0.1}
                />
              )}
            </g>
          )
        })}
        {lineage
          .filter((n) => n.parentId === null || members.has(n.id))
          .map((n) => (
            <circle
              key={`n${n.id}`}
              cx={x(n.parentId === null ? n.bornAt : (n.diedAt ?? span))}
              cy={y(n.id)}
              r={n.parentId === null ? 3 : 2.4}
              fill={markCss(n.mark)}
              stroke={n.parentId === null ? palette.text : 'none'}
              strokeWidth={0.8}
              opacity={!layout.lit.size || layout.lit.has(n.id) ? 1 : 0.25}
            />
          ))}
        <text x={padX} y={height - 1} fontSize={8} fill={palette.textMuted}>
          founders
        </text>
        <text
          x={width - padX}
          y={height - 1}
          fontSize={8}
          fill={palette.textMuted}
          textAnchor="end"
        >
          {Math.round(span / 60)} minutes later
        </text>
      </svg>
    </div>
  )
}

/**
 * All four populations on one tree, with their founder pools.
 *
 * This is the view that answers Part 3. W and X visibly join before their
 * founders; Y and Z join each other and never join W or X. The colour of a line
 * is the body colour of the individual it belongs to, which is what makes the
 * coincidence visible in the same picture as the truth that contradicts it —
 * three lineages wearing one colour, and the two that actually share a root
 * wearing different ones.
 */
export function TrueHistory({
  fixtures,
  width = 250,
}: {
  fixtures: readonly {
    id: string
    pool: string
    lineage: Lineage[]
    memberIds: number[]
    duration: number
  }[]
  width?: number
}) {
  const pools = ['P', 'Q']
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {pools.map((pool) => {
        const inPool = fixtures.filter((f) => f.pool === pool)
        if (!inPool.length) return null
        // One tree per pool: populations from the same pool genuinely share a
        // root, and drawing them together is the claim being made.
        const merged = new Map<number, Lineage>()
        for (const f of inPool) for (const n of f.lineage) merged.set(n.id, n)
        return (
          <div key={pool}>
            <LineageTree
              lineage={[...merged.values()]}
              memberIds={inPool.flatMap((f) => f.memberIds)}
              span={Math.max(...inPool.map((f) => f.duration))}
              width={width}
              height={150}
              label={`Founder pool ${pool} — ${inPool.map((f) => f.id).join(' and ')}`}
            />
          </div>
        )
      })}
      <p
        style={{
          fontSize: 11.5,
          color: 'var(--text-muted)',
          lineHeight: 1.45,
          margin: 0,
        }}
      >
        Two founder pools, and no line crosses between them. Each line is one
        creature's life, from birth to death, drawn in its <b>mark</b> — the trait
        that does nothing — rather than its body colour, which is its wiring.
      </p>
    </div>
  )
}
