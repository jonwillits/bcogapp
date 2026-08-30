import { useMemo } from 'react'
import { hueToCss } from '../../sim/creature/genome'
import type { LineageNode } from '../../sim/world/evolutionWorld'
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
 * Drawn as generation-by-generation columns rather than a conventional
 * dendrogram. A hundred-generation ancestry is long and thin, and what a
 * student needs to see is *where the lines converge* — the generation at which
 * everything alive today shares an ancestor. Columns put that on a readable
 * axis; a dendrogram would put it in a hairline near the root.
 */
export function LineageTree({
  lineage,
  memberIds,
  highlight,
  width = 250,
  height = 190,
  label,
}: {
  lineage: readonly LineageNode[]
  memberIds: readonly number[]
  /** Draw these ids and their ancestors brighter — used by the individual panel. */
  highlight?: readonly number[]
  width?: number
  height?: number
  label?: string
}) {
  const layout = useMemo(() => {
    const byId = new Map(lineage.map((n) => [n.id, n]))
    const generations = new Map<number, LineageNode[]>()
    for (const n of lineage) {
      const list = generations.get(n.generation) ?? []
      list.push(n)
      generations.set(n.generation, list)
    }
    const gens = [...generations.keys()].sort((a, b) => a - b)
    const maxGen = gens[gens.length - 1] ?? 0

    // Position within a generation: by descent, so sibling lines stay together
    // and the tree does not cross itself more than the ancestry actually does.
    const pos = new Map<number, number>()
    for (const g of gens) {
      const rows = generations
        .get(g)!
        .slice()
        .sort((a, b) => {
          const pa = a.parentId !== null ? (pos.get(a.parentId) ?? 0) : a.id
          const pb = b.parentId !== null ? (pos.get(b.parentId) ?? 0) : b.id
          return pa - pb || a.id - b.id
        })
      rows.forEach((n, i) => pos.set(n.id, rows.length === 1 ? 0.5 : i / (rows.length - 1)))
    }

    const lit = new Set<number>()
    if (highlight) {
      for (const id of highlight) {
        let cursor: number | null = id
        while (cursor !== null && !lit.has(cursor)) {
          lit.add(cursor)
          cursor = byId.get(cursor)?.parentId ?? null
        }
      }
    }

    return { byId, gens, maxGen, pos, lit }
  }, [lineage, highlight])

  const padX = 8
  const padY = 10
  const x = (g: number) =>
    padX + (layout.maxGen === 0 ? 0 : (g / layout.maxGen) * (width - padX * 2))
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
          if (n.parentId === null) return null
          const parent = layout.byId.get(n.parentId)
          if (!parent) return null
          const bright = !layout.lit.size || layout.lit.has(n.id)
          return (
            <line
              key={`e${n.id}`}
              x1={x(parent.generation)}
              y1={y(parent.id)}
              x2={x(n.generation)}
              y2={y(n.id)}
              stroke={hueToCss(n.hue)}
              strokeWidth={bright ? 1.4 : 0.6}
              opacity={bright ? 0.75 : 0.16}
            />
          )
        })}
        {lineage
          .filter((n) => n.generation === 0 || members.has(n.id))
          .map((n) => (
            <circle
              key={`n${n.id}`}
              cx={x(n.generation)}
              cy={y(n.id)}
              r={n.generation === 0 ? 3 : 2.4}
              fill={hueToCss(n.hue)}
              stroke={n.generation === 0 ? palette.text : 'none'}
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
          generation {layout.maxGen}
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
  fixtures: readonly { id: string; pool: string; lineage: LineageNode[]; memberIds: number[] }[]
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
        const merged = new Map<number, LineageNode>()
        for (const f of inPool) for (const n of f.lineage) merged.set(n.id, n)
        return (
          <div key={pool}>
            <LineageTree
              lineage={[...merged.values()]}
              memberIds={inPool.flatMap((f) => f.memberIds)}
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
        Two founder pools, and no line crosses between them. Line colour is the
        body colour of the individual it belongs to.
      </p>
    </div>
  )
}
