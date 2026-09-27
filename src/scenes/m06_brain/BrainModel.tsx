import { useState } from 'react'
import { brainGeometry, type Marker } from '../../sim/brain/geometry'
import { STRUCTURES, labelIn, type SpeciesModel, type StructureId } from '../../sim/brain/structures'
import type { RegionId } from '../../sim/brain/proportions'

/**
 * The stylized brain, drawn from one parameter set. Every region is filled
 * with the chapter figure's color and also labeled, since color is never the
 * only cue. The forebrain roof's figure color is a navy that vanishes on this
 * dark theme, so every region carries a light outline; the fills themselves
 * are pinned to the figure and are not changed.
 */

/** Outline for every region, chosen against the dark theme, not the figure. */
const OUTLINE = '#c9d2df'

const REGION_STRUCTURE: Record<RegionId, StructureId> = {
  forebrainRoof: 'pallium',
  basalGanglia: 'basalGanglia',
  thalamusHypothalamus: 'thalamus',
  midbrainRoof: 'tectum',
  cerebellum: 'cerebellum',
  hindbrain: 'hindbrain',
}

export interface BrainModelProps {
  species: SpeciesModel
  selected?: StructureId | null
  onSelect?: (s: StructureId) => void
  /** Structures drawn as removed (hatched and dimmed). */
  removed?: StructureId[]
  /** A structure drawn with a stimulation ring. */
  stimulated?: StructureId | null
  /** Where along the tectum a stimulation lands, 0 to 1, for the ring. */
  stimulatedPoint?: number
  /** Print the structure labels around the model. */
  labels?: boolean
  /** A caption under the model. */
  caption?: string
  width?: number | string
}

export function BrainModel({
  species,
  selected = null,
  onSelect,
  removed = [],
  stimulated = null,
  stimulatedPoint = 0.5,
  labels = true,
  caption,
  width = '100%',
}: BrainModelProps) {
  const g = brainGeometry(species)
  const [hover, setHover] = useState<StructureId | null>(null)
  const pick = (s: StructureId) => (onSelect ? () => onSelect(s) : undefined)
  const isSel = (s: StructureId) => selected === s
  const isRemoved = (s: StructureId) => removed.includes(s)
  const cursor = onSelect ? 'pointer' : 'default'

  const structureLabel = (id: StructureId) => labelIn(STRUCTURES.find((s) => s.id === id)!, species)

  const thBox = g.regions.find((r) => r.region === 'thalamusHypothalamus')!.box
  const ne = g.markers.find((m) => m.structure === 'norepinephrineCluster')!
  const tectum = g.regions.find((r) => r.region === 'midbrainRoof')!.box

  return (
    <figure style={{ margin: 0, width }}>
      <svg viewBox={`0 0 ${g.width} ${g.height}`} width="100%" role="img" aria-label={`the ${species.label} brain, schematic side view, front at the left`}>
        <defs>
          <pattern id="m06-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="#f87171" strokeWidth="2" />
          </pattern>
        </defs>

        {/* The norepinephrine cluster's reach, on hover: nearly the whole brain. */}
        {hover === 'norepinephrineCluster' && (
          <ellipse cx={g.brain.x + g.brain.w * 0.5} cy={g.brain.y + g.brain.h * 0.5} rx={g.brain.w * 0.55} ry={g.brain.h * 0.62} fill="#f0a94b" opacity={0.18} />
        )}

        {/* Spinal cord */}
        <rect
          x={g.spinalCord.x}
          y={g.spinalCord.y}
          width={g.spinalCord.w}
          height={g.spinalCord.h}
          rx={6}
          fill="#c9ced6"
          stroke={isSel('spinalCord') ? '#4f9cff' : OUTLINE}
          strokeWidth={isSel('spinalCord') ? 3 : 1.2}
          style={{ cursor }}
          onClick={pick('spinalCord')}
          onMouseEnter={() => setHover('spinalCord')}
          onMouseLeave={() => setHover(null)}
        >
          <title>spinal cord</title>
        </rect>

        {/* Regions */}
        {g.regions.map((r) => {
          const sid = REGION_STRUCTURE[r.region]
          const sel = isSel(sid) || (r.region === 'thalamusHypothalamus' && isSel('hypothalamus'))
          const gone = isRemoved(sid)
          return (
            <g key={r.region}>
              <rect
                x={r.box.x}
                y={r.box.y}
                width={r.box.w}
                height={r.box.h}
                rx={r.region === 'cerebellum' ? r.box.w / 2.2 : r.region === 'forebrainRoof' ? Math.min(28, r.box.h / 1.6) : r.region === 'thalamusHypothalamus' ? Math.min(20, r.box.h / 1.6) : 8}
                fill={r.absent ? 'none' : r.color}
                opacity={gone ? 0.35 : 1}
                stroke={sel ? '#4f9cff' : OUTLINE}
                strokeWidth={sel ? 3 : 1.2}
                strokeDasharray={r.absent ? '5 4' : undefined}
                style={{ cursor }}
                onClick={pick(sid)}
                onMouseEnter={() => setHover(sid)}
                onMouseLeave={() => setHover(null)}
              >
                <title>{r.absent ? 'no cerebellum of the jawed kind' : structureLabel(sid)}</title>
              </rect>
              {gone && <rect x={r.box.x} y={r.box.y} width={r.box.w} height={r.box.h} rx={8} fill="url(#m06-hatch)" pointerEvents="none" />}
              {/* Pallium layer strokes: three, six, or clusters. */}
              {r.region === 'forebrainRoof' && !gone && palliumLayers(species, r.box)}
            </g>
          )
        })}

        {/* The thalamus / hypothalamus split, a dotted line, with the hypothalamus clickable below it. */}
        <line x1={thBox.x + 4} y1={thBox.y + thBox.h * 0.5} x2={thBox.x + thBox.w - 4} y2={thBox.y + thBox.h * 0.5} stroke={OUTLINE} strokeDasharray="3 3" strokeWidth={1} pointerEvents="none" />
        <rect
          x={thBox.x}
          y={thBox.y + thBox.h * 0.5}
          width={thBox.w}
          height={thBox.h * 0.5}
          fill="transparent"
          stroke={isSel('hypothalamus') ? '#4f9cff' : 'none'}
          strokeWidth={2.5}
          style={{ cursor }}
          onClick={pick('hypothalamus')}
          onMouseEnter={() => setHover('hypothalamus')}
          onMouseLeave={() => setHover(null)}
        >
          <title>hypothalamus</title>
        </rect>

        {/* The striatum, marked as the basal ganglia's input stage. */}
        {(() => {
          const b = g.regions.find((r) => r.region === 'basalGanglia')!.box
          return (
            <rect x={b.x + b.w * 0.55} y={b.y + 2} width={b.w * 0.38} height={Math.max(2, b.h - 4)} rx={3} fill="none" stroke={OUTLINE} strokeDasharray="2 2" strokeWidth={0.8} pointerEvents="none">
              <title>striatum: the input stage</title>
            </rect>
          )
        })()}

        {/* Markers: the small structures. */}
        {g.markers.map((m) => (
          <MarkerShape key={m.structure} m={m} label={structureLabel(m.structure)} selected={isSel(m.structure)} removed={isRemoved(m.structure)} cursor={cursor} onClick={pick(m.structure)} onHover={setHover} />
        ))}

        {/* Stimulation ring */}
        {stimulated && stimulated !== 'tectum' && (() => {
          const a = g.anchors[stimulated]
          return <circle cx={a.x} cy={a.y} r={16} fill="none" stroke="#f0a94b" strokeWidth={3} strokeDasharray="4 3" pointerEvents="none" />
        })()}
        {stimulated === 'tectum' && (
          <circle cx={tectum.x + 8 + (tectum.w - 16) * stimulatedPoint} cy={tectum.y + 8} r={9} fill="none" stroke="#f0a94b" strokeWidth={3} pointerEvents="none" />
        )}

        {/* NE reach note */}
        {hover === 'norepinephrineCluster' && (
          <text x={ne.x} y={g.brain.y - 8} fontSize={10} fill="#f0a94b" textAnchor="middle">
            fibers reach nearly the whole brain
          </text>
        )}

        {labels && <Labels g={g} species={species} selected={selected} onPick={onSelect} />}

        <text x={g.width / 2} y={g.height - 4} fontSize={9.5} fill="#9aa6b8" textAnchor="middle">
          front of the brain at the left · schematic
        </text>
      </svg>
      {caption && <figcaption style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{caption}</figcaption>}
    </figure>
  )
}

function palliumLayers(sp: SpeciesModel, box: { x: number; y: number; w: number; h: number }) {
  if (sp.palliumLayers === 'clustered') {
    const dots = []
    const n = Math.max(3, Math.floor(box.w / 22))
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < 2; j++) {
        dots.push(<circle key={`${i}-${j}`} cx={box.x + 14 + (i * (box.w - 28)) / (n - 1)} cy={box.y + box.h * (0.3 + 0.4 * j)} r={Math.min(5, box.h / 6)} fill="none" stroke={OUTLINE} strokeWidth={0.8} pointerEvents="none" />)
      }
    }
    return <g>{dots}</g>
  }
  if (sp.palliumLayers === null) return null
  const n = sp.palliumLayers
  const lines = []
  for (let i = 1; i < n; i++) {
    const y = box.y + (box.h * i) / n
    lines.push(<line key={i} x1={box.x + 10} y1={y} x2={box.x + box.w - 10} y2={y} stroke={OUTLINE} strokeWidth={0.7} opacity={0.8} pointerEvents="none" />)
  }
  return <g>{lines}</g>
}

function MarkerShape({
  m,
  label,
  selected,
  removed,
  cursor,
  onClick,
  onHover,
}: {
  m: Marker
  label: string
  selected: boolean
  removed: boolean
  cursor: string
  onClick?: () => void
  onHover: (s: StructureId | null) => void
}) {
  const fill = removed ? 'url(#m06-hatch)' : m.structure === 'amygdala' ? '#a78bfa' : m.structure === 'hippocampus' ? '#5eead4' : m.structure === 'periaqueductalGray' ? '#9aa6b8' : m.structure === 'dopamineClusters' ? '#f472b6' : m.structure === 'norepinephrineCluster' ? '#f0a94b' : m.structure === 'serotoninClusters' ? '#c084fc' : '#e7ecf3'
  const stroke = selected ? '#4f9cff' : '#0e1420'
  const common = {
    style: { cursor },
    onClick,
    onMouseEnter: () => onHover(m.structure),
    onMouseLeave: () => onHover(null),
  }
  if (m.along) {
    // A row of dots along a line.
    const n = m.structure === 'reticularFormation' ? 14 : 4
    const dots = []
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1)
      dots.push(<circle key={i} cx={m.x + (m.along.x2 - m.x) * t} cy={m.y + (m.along.y2 - m.y) * t} r={m.r} fill={fill} stroke={stroke} strokeWidth={selected ? 1.5 : 0.5} />)
    }
    return (
      <g {...common}>
        <line x1={m.x} y1={m.y} x2={m.along.x2} y2={m.along.y2} stroke="transparent" strokeWidth={10} />
        {dots}
        <title>{label}</title>
      </g>
    )
  }
  if (m.structure === 'dopamineClusters') {
    return (
      <g {...common}>
        <circle cx={m.x - 5} cy={m.y} r={m.r} fill={fill} stroke={stroke} strokeWidth={selected ? 1.5 : 0.5} />
        <circle cx={m.x + 5} cy={m.y} r={m.r} fill={fill} stroke={stroke} strokeWidth={selected ? 1.5 : 0.5} />
        <title>{label}</title>
      </g>
    )
  }
  if (m.structure === 'hippocampus') {
    return (
      <g {...common}>
        <path d={`M ${m.x - 10} ${m.y - 8} q 14 0 12 14`} fill="none" stroke={removed ? '#f87171' : fill} strokeWidth={3} strokeLinecap="round" />
        <path d={`M ${m.x - 10} ${m.y - 8} q 14 0 12 14`} fill="none" stroke={selected ? '#4f9cff' : 'transparent'} strokeWidth={6} opacity={0.6} />
        <title>{label}</title>
      </g>
    )
  }
  return (
    <g {...common}>
      <ellipse cx={m.x} cy={m.y} rx={m.r} ry={m.r * 0.8} fill={m.dashed ? 'none' : fill} stroke={selected ? '#4f9cff' : m.dashed ? '#a78bfa' : stroke} strokeWidth={selected ? 2 : m.dashed ? 1.2 : 0.5} strokeDasharray={m.dashed ? '3 2' : undefined} />
      <title>{m.dashed ? `${label} — not settled` : label}</title>
    </g>
  )
}

/** Labels around the model with leader lines, spread along each edge from their anchors so leaders do not cross. */
function Labels({ g, species, selected, onPick }: { g: ReturnType<typeof brainGeometry>; species: SpeciesModel; selected: StructureId | null; onPick?: (s: StructureId) => void }) {
  const above: StructureId[] = ['pallium', 'hippocampus', 'tectum', 'cerebellum']
  const below: StructureId[] = ['amygdala', 'hypothalamus', 'periaqueductalGray', 'dopamineClusters', 'serotoninClusters', 'norepinephrineCluster', 'hindbrain', 'spinalCord']
  const left: StructureId[] = ['basalGanglia', 'thalamus', 'reticularFormation']
  const text = (id: StructureId) => labelIn(STRUCTURES.find((s) => s.id === id)!, species)
  const items: { id: StructureId; x: number; y: number; anchor: 'start' | 'middle' | 'end' }[] = []
  const spread = (ids: StructureId[], gap: number, minX: number) => {
    const sorted = [...ids].sort((a, b) => g.anchors[a].x - g.anchors[b].x)
    let prev = -Infinity
    return sorted.map((id) => {
      const x = Math.max(minX, g.anchors[id].x - 18, prev + gap)
      prev = x
      return { id, x }
    })
  }
  spread(above, 118, 40).forEach(({ id, x }) => items.push({ id, x: Math.min(x, g.width - 100), y: 22, anchor: 'start' }))
  spread(below, 62, 6).forEach(({ id, x }, i) => items.push({ id, x: Math.min(x, g.width - 60), y: g.height - 26 + (i % 2) * 11, anchor: 'start' }))
  left.forEach((id, i) => items.push({ id, x: 6, y: 120 + i * 14, anchor: 'start' }))
  return (
    <g fontSize={9.5} fill="#e7ecf3">
      {items.map(({ id, x, y, anchor }) => {
        const a = g.anchors[id]
        const sel = selected === id
        return (
          <g key={id} style={{ cursor: onPick ? 'pointer' : 'default' }} onClick={onPick ? () => onPick(id) : undefined}>
            <line x1={x + (anchor === 'start' ? 2 : 0)} y1={y - 3} x2={a.x} y2={a.y} stroke={sel ? '#4f9cff' : '#6b7a90'} strokeWidth={sel ? 1.2 : 0.6} />
            <text x={x} y={y} textAnchor={anchor} fill={sel ? '#4f9cff' : '#e7ecf3'} fontWeight={sel ? 700 : 400} style={{ paintOrder: 'stroke', stroke: '#0e1420', strokeWidth: 3 }}>
              {text(id)}
            </text>
          </g>
        )
      })}
    </g>
  )
}
