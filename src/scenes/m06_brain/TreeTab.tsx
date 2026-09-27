import { useMemo, useState, type ReactNode } from 'react'
import { BrainLayout } from './layout'
import { Panel } from '../../components/Panel'
import { TREE, CARDS, RULE_LINE, branches, emptyPlacements, togglePlacement, allPlaced, reveal, tipsUnder, type BranchId, type CardId, type Placements, type TreeNode, type CardVerdict } from '../../sim/brain/tree'
import { Btn, Claims, GroupLabel, Note, StageTitle, PANEL_STYLE, RIGHT_STYLE } from './ui'

/**
 * Part 1's third activity: placing gains on the tree. Every card is placed
 * freely, on as many branches as the student likes, and nothing is marked
 * until *Reveal the answer*. Before that press, no key information is
 * rendered anywhere on this tab; `reveal.test.ts` renders it and looks.
 */

export interface TreeState {
  placements: Placements
  revealed: boolean
}

export function TreeTab({ header, initial }: { header?: ReactNode; initial?: Partial<TreeState> }) {
  const [placements, setPlacements] = useState<Placements>(initial?.placements ?? emptyPlacements())
  const [revealed, setRevealed] = useState(initial?.revealed ?? false)
  const [cardId, setCardId] = useState<CardId>('tectum')
  const [refused, setRefused] = useState<string | null>(null)
  const verdicts = useMemo(() => (revealed ? reveal(placements) : null), [revealed, placements])

  const onBranch = (b: BranchId) => {
    if (revealed) return
    const r = togglePlacement(placements, cardId, b)
    setRefused(r.refused ?? null)
    setPlacements(r.placements)
  }

  return (
    <BrainLayout
      header={header}
      left={
      <Panel title="Tree" style={PANEL_STYLE}>
        <Note>
          <b>{RULE_LINE}</b> <Claims ids={['§6.1.8-C2']} />
        </Note>
        <GroupLabel>Cards — pick one, then click branches</GroupLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {CARDS.map((c, i) => {
            const n = placements[c.id].length
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setCardId(c.id)}
                aria-pressed={cardId === c.id}
                style={{
                  textAlign: 'left',
                  padding: '5px 8px',
                  fontSize: 12,
                  borderRadius: 'var(--radius-sm)',
                  border: `1px solid ${cardId === c.id ? 'var(--accent)' : 'var(--border)'}`,
                  background: cardId === c.id ? 'color-mix(in srgb, var(--accent) 22%, var(--surface))' : 'var(--surface-2)',
                  color: 'var(--text)',
                  cursor: 'pointer',
                  display: 'flex',
                  gap: 8,
                  alignItems: 'center',
                }}
              >
                <CardChip n={i + 1} />
                <span style={{ flex: 1 }}>{c.label}</span>
                <span style={{ fontSize: 10.5, color: n ? 'var(--text)' : 'var(--text-muted)' }}>{n ? `${n} placed` : 'not placed'}</span>
              </button>
            )
          })}
        </div>
        <Note>A card may go on more than one branch. Click a branch again to take it off. Nothing is marked until you reveal.</Note>
        {refused && <Note style={{ color: '#f87171' }}>{refused}</Note>}
        <div>
          <Btn primary disabled={revealed || !allPlaced(placements)} onClick={() => setRevealed(true)} title={allPlaced(placements) ? undefined : 'Place every card first'}>
            Reveal the answer
          </Btn>
        </div>
        {!allPlaced(placements) && !revealed && <Note>Reveal becomes available once every card has at least one placement.</Note>}
        {revealed && (
          <Btn small onClick={() => { setRevealed(false); setPlacements(emptyPlacements()) }}>
            Start over
          </Btn>
        )}
      </Panel>
      }
      stage={
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 900, margin: '0 auto' }}>
        <StageTitle sub="The tips are lineages, not the gallery’s specimens. The invertebrate is an outgroup: no card can go on its branch.">Where did each part arise?</StageTitle>
        <Cladogram placements={placements} verdicts={verdicts} onBranch={onBranch} activeCard={cardId} />
        <Note>Numbers on a branch are the cards you placed there{verdicts ? '; a ring marks the key, and a strike marks a placement the key does not have' : ''}.</Note>
      </div>
      }
      right={
      <Panel title={verdicts ? 'The answer' : 'Your placements'} style={RIGHT_STYLE}>
        {!verdicts &&
          CARDS.map((c, i) => (
            <div key={c.id} style={{ fontSize: 12, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <CardChip n={i + 1} />
              <span>
                <b>{c.label}:</b>{' '}
                {placements[c.id].length ? placements[c.id].map((b) => branches().find((x) => x.id === b)!.label).join('; ') : <span style={{ color: 'var(--text-muted)' }}>not placed</span>}
              </span>
            </div>
          ))}
        {verdicts && verdicts.map((v, i) => <VerdictCard key={v.card.id} v={v} n={i + 1} />)}
      </Panel>
      }
    />
  )
}

function CardChip({ n, tone = 'normal' }: { n: number; tone?: 'normal' | 'match' | 'miss' | 'notSettled' | 'key' }) {
  const bg = tone === 'match' ? '#34d399' : tone === 'miss' ? '#f87171' : tone === 'notSettled' ? '#f0a94b' : tone === 'key' ? 'transparent' : '#4f9cff'
  return (
    <span
      style={{
        display: 'inline-flex',
        width: 18,
        height: 18,
        borderRadius: 999,
        background: bg,
        color: tone === 'key' ? '#e7ecf3' : '#0b111c',
        border: `2px solid ${tone === 'key' ? '#e7ecf3' : 'transparent'}`,
        fontSize: 10.5,
        fontWeight: 700,
        alignItems: 'center',
        justifyContent: 'center',
        flex: '0 0 auto',
        textDecoration: tone === 'miss' ? 'line-through' : 'none',
      }}
    >
      {n}
    </span>
  )
}

function VerdictCard({ v, n }: { v: CardVerdict; n: number }) {
  const name = (b: BranchId) => branches().find((x) => x.id === b)!.label
  return (
    <div style={{ fontSize: 12, borderTop: '1px solid var(--border)', paddingTop: 6, display: 'flex', flexDirection: 'column', gap: 3 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <CardChip n={n} />
        <b>{v.card.label}</b>
      </div>
      <div>
        <span style={{ color: 'var(--text-muted)' }}>the key: </span>
        {v.card.key.map(name).join('; ')}
        {v.card.notSettled && <span style={{ color: '#f0a94b' }}> · not settled at {v.card.notSettled.map(name).join('; ')}</span>}
      </div>
      {v.placed.map((p) => (
        <div key={p.branch} style={{ color: p.mark === 'match' ? '#34d399' : p.mark === 'miss' ? '#f87171' : '#f0a94b' }}>
          {p.mark === 'match' ? '✓' : p.mark === 'miss' ? '✗' : '?'} you: {name(p.branch)}
          {p.mark === 'notSettled' ? ' — neither right nor wrong' : ''}
        </div>
      ))}
      {v.missed.length > 0 && <div style={{ color: '#f0a94b' }}>missing from your placements: {v.missed.map(name).join('; ')}</div>}
      {v.card.id === 'largeBrain' && (
        <div>
          You used <b>{v.origins.used}</b> separate origin{v.origins.used === 1 ? '' : 's'}; the key uses <b>{v.origins.key}</b>.
        </div>
      )}
      {v.card.revealLine && <div style={{ color: 'var(--text-muted)' }}>{v.card.revealLine}</div>}
      <Claims ids={v.card.claims} />
    </div>
  )
}

/** Node positions: tips spaced evenly down the right, internal nodes at the mean of their children, x by depth. */
interface Pos {
  id: BranchId
  node: TreeNode
  x: number
  y: number
  parent: { x: number; y: number } | null
  tip: boolean
}

function layoutTree(): Pos[] {
  const out: Pos[] = []
  const tips = branches().filter((b) => b.children.length === 0).length
  let tipIndex = 0
  const depthOf = (n: TreeNode): number => (n.children.length ? 1 + Math.max(...n.children.map(depthOf)) : 0)
  const maxDepth = depthOf(TREE)
  const X0 = 30
  const X1 = 620
  const walk = (n: TreeNode, depth: number, parent: { x: number; y: number } | null): { x: number; y: number } => {
    const x = X0 + ((X1 - X0) * depth) / maxDepth
    if (!n.children.length) {
      const y = 24 + (tipIndex++ * 400) / (tips - 1)
      out.push({ id: n.id, node: n, x: X1, y, parent, tip: true })
      return { x: X1, y }
    }
    const here = { x, y: 0 }
    const kids = n.children.map((c) => walk(c, depth + 1, here))
    here.y = kids.reduce((a, k) => a + k.y, 0) / kids.length
    if (parent !== null) out.push({ id: n.id, node: n, x, y: here.y, parent, tip: false })
    return here
  }
  walk(TREE, 0, null)
  return out
}

function Cladogram({ placements, verdicts, onBranch, activeCard }: { placements: Placements; verdicts: CardVerdict[] | null; onBranch: (b: BranchId) => void; activeCard: CardId }) {
  const pos = useMemo(layoutTree, [])
  const [hover, setHover] = useState<BranchId | null>(null)
  const cardIndex = (id: CardId) => CARDS.findIndex((c) => c.id === id) + 1
  return (
    <svg viewBox="0 0 780 450" width="100%" role="img" aria-label="a cladogram of the thirteen lineages">
      {pos.map((p) => {
        const px = p.parent!.x
        const py = p.parent!.y
        // Each branch: a vertical from the parent's y to this node's y at the parent's x, then a horizontal to the node.
        const placed = (Object.keys(placements) as CardId[]).filter((c) => placements[c].includes(p.id))
        const keyed = verdicts ? CARDS.filter((c) => c.key.includes(p.id) || c.notSettled?.includes(p.id)) : []
        const isHover = hover === p.id
        const isOut = p.id === 'outgroup'
        const midX = (px + p.x) / 2
        return (
          <g key={p.id} onMouseEnter={() => setHover(p.id)} onMouseLeave={() => setHover(null)} onClick={() => onBranch(p.id)} style={{ cursor: isOut ? 'not-allowed' : 'pointer' }}>
            <path d={`M ${px} ${py} V ${p.y} H ${p.x}`} fill="none" stroke="transparent" strokeWidth={16} />
            <path d={`M ${px} ${py} V ${p.y} H ${p.x}`} fill="none" stroke={isHover && !isOut ? '#4f9cff' : isOut ? '#4a5568' : '#9aa6b8'} strokeWidth={isHover ? 3 : 2} strokeDasharray={isOut ? '4 4' : undefined} />
            {p.tip && (
              <text x={p.x + 8} y={p.y + 4} fontSize={12} fill="#e7ecf3">
                {p.node.label}
              </text>
            )}
            {!p.tip && isHover && (
              <text x={midX} y={p.y - 14} fontSize={10.5} fill="#4f9cff" textAnchor="middle" style={{ paintOrder: 'stroke', stroke: '#0e1420', strokeWidth: 3 }}>
                {p.node.label}
              </text>
            )}
            {/* Placed cards as numbered chips along the horizontal part of the branch. */}
            {placed.map((c, i) => {
              const v = verdicts?.find((x) => x.card.id === c)
              const mark = v?.placed.find((x) => x.branch === p.id)?.mark
              const fill = !mark ? '#4f9cff' : mark === 'match' ? '#34d399' : mark === 'miss' ? '#f87171' : '#f0a94b'
              const cx = px + 14 + i * 20
              return (
                <g key={c}>
                  <circle cx={cx} cy={p.y - 12} r={8} fill={fill} />
                  <text x={cx} y={p.y - 8.5} fontSize={9.5} fontWeight={700} fill="#0b111c" textAnchor="middle">
                    {cardIndex(c)}
                  </text>
                  {mark === 'miss' && <line x1={cx - 7} y1={p.y - 5} x2={cx + 7} y2={p.y - 19} stroke="#0b111c" strokeWidth={1.5} />}
                </g>
              )
            })}
            {/* After the reveal: the key, as rings below the branch. Dashed where the chapter leaves it open. */}
            {keyed.map((c, i) => {
              const notSettled = !c.key.includes(p.id)
              const cx = px + 14 + i * 20
              return (
                <g key={c.id}>
                  <circle cx={cx} cy={p.y + 12} r={8} fill="none" stroke="#e7ecf3" strokeWidth={notSettled ? 1.2 : 2} strokeDasharray={notSettled ? '3 2' : undefined} />
                  <text x={cx} y={p.y + 15.5} fontSize={9.5} fontWeight={700} fill="#e7ecf3" textAnchor="middle">
                    {cardIndex(c.id)}
                  </text>
                </g>
              )
            })}
          </g>
        )
      })}
      <text x={30} y={440} fontSize={10.5} fill="#9aa6b8">
        placing: <tspan fill="#4f9cff" fontWeight={700}>{cardIndex(activeCard)}</tspan> {CARDS.find((c) => c.id === activeCard)!.label}
        {hover && hover !== 'outgroup' ? ` · this branch covers: ${tipsUnder(hover).join(', ')}` : ''}
      </text>
    </svg>
  )
}
