import { useState, type ReactNode } from 'react'
import { BrainLayout } from './layout'
import { Panel } from '../../components/Panel'
import { PROPORTIONS, REGIONS, SCHEMATIC_LINE, FIGURE_LINE, shares, type ProportionRow } from '../../sim/brain/proportions'
import { STRUCTURES, species, labelIn, layersLine, LAMPREY_CEREBELLUM_LINE, LAMPREY_AMYGDALA_LINE, FIRST_APPROXIMATION_LINE, type StructureId, type SpeciesModel } from '../../sim/brain/structures'
import { BrainModel } from './BrainModel'
import { Btn, Choice, Claims, GroupLabel, Note, StageTitle, PANEL_STYLE, RIGHT_STYLE } from './ui'

/**
 * Part 1's middle activity: the parts of a vertebrate brain. The lamprey
 * tour, lamprey beside mammal, the proportions bars from the chapter's own
 * figure, and the bird pallium. The one question the tab puts to a student —
 * what changed between the two brains — gets no answer on screen.
 */

type View = 'tour' | 'beside' | 'proportions' | 'birdPallium'

const LAMPREY = species('lamprey')
const MAMMAL = species('mammal')

export const WHAT_CHANGED_QUESTION = 'What changed between the two brains? Write your answer down before you go on; the scene does not give one.'

export function PlanTab({ header }: { header?: ReactNode }) {
  const [view, setView] = useState<View>('tour')
  const [selected, setSelected] = useState<StructureId | null>(null)
  const [inSpecies, setInSpecies] = useState<'lamprey' | 'mammal'>('lamprey')
  const [allSeven, setAllSeven] = useState(false)

  const pick = (sp: 'lamprey' | 'mammal') => (s: StructureId) => {
    setSelected(s)
    setInSpecies(sp)
  }

  return (
    <BrainLayout
      header={header}
      left={
      <Panel title="Plan" style={PANEL_STYLE}>
        <GroupLabel>View</GroupLabel>
        <Choice
          value={view}
          options={[
            { id: 'tour', label: 'The lamprey tour' },
            { id: 'beside', label: 'Lamprey beside mammal' },
            { id: 'proportions', label: 'Proportions' },
            { id: 'birdPallium', label: 'The bird pallium' },
          ]}
          onChange={setView}
        />
        <GroupLabel>Structures</GroupLabel>
        <Note>Click a structure on the model, or here. Each gives one line from the chapter and nothing more.</Note>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {STRUCTURES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSelected(s.id)}
              style={{
                padding: '3px 8px',
                fontSize: 11,
                borderRadius: 999,
                border: '1px solid var(--border)',
                background: selected === s.id ? 'var(--accent)' : 'var(--surface-2)',
                color: selected === s.id ? '#0b111c' : 'var(--text)',
                cursor: 'pointer',
              }}
            >
              {labelIn(s, inSpecies === 'mammal' ? MAMMAL : LAMPREY)}
            </button>
          ))}
        </div>
        <Note>
          <b>{FIRST_APPROXIMATION_LINE}</b>
        </Note>
      </Panel>
      }
      stage={
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 820, margin: '0 auto' }}>
        {view === 'tour' && (
          <>
            <StageTitle sub="Every structure is clickable. The dashed outline behind the midbrain is where a cerebellum sits in jawed vertebrates.">The lamprey</StageTitle>
            <BrainModel species={LAMPREY} selected={selected} onSelect={pick('lamprey')} />
          </>
        )}
        {view === 'beside' && (
          <>
            <StageTitle sub="Two parameter sets on the one model. The same structures are clickable in both.">Lamprey beside mammal</StageTitle>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <BrainModel species={LAMPREY} selected={inSpecies === 'lamprey' ? selected : null} onSelect={pick('lamprey')} caption="lamprey" />
              <BrainModel species={MAMMAL} selected={inSpecies === 'mammal' ? selected : null} onSelect={pick('mammal')} caption="mammal" />
            </div>
            <Note>
              <b>{WHAT_CHANGED_QUESTION}</b>
            </Note>
          </>
        )}
        {view === 'proportions' && (
          <>
            <StageTitle sub={SCHEMATIC_LINE}>Proportions</StageTitle>
            <ProportionBars rows={allSeven ? [...PROPORTIONS] : PROPORTIONS.filter((r) => r.species === 'lamprey' || r.species === 'mammal')} />
            <div>
              <Btn onClick={() => setAllSeven((v) => !v)}>{allSeven ? 'Show lamprey and mammal only' : 'Show all seven'}</Btn>
            </div>
            <Note>
              <b>{WHAT_CHANGED_QUESTION}</b>
            </Note>
          </>
        )}
        {view === 'birdPallium' && (
          <>
            <StageTitle sub="A schematic cross-section of the roof of the forebrain in each: clusters against six layers.">The bird pallium beside a mammal’s</StageTitle>
            <BirdPallium />
            <Note>
              Whether particular parts of a bird’s pallium correspond to particular parts of a mammal’s neocortex has been argued for decades. <Claims ids={['§6.3.5-C13', '§6.3.5-C14']} />
            </Note>
          </>
        )}
      </div>
      }
      right={
      <Panel title="Structure" style={RIGHT_STYLE}>
        {selected ? <StructureCard id={selected} sp={inSpecies === 'mammal' ? MAMMAL : LAMPREY} /> : <Note>Click a structure to read its one line.</Note>}
        <GroupLabel>The pallium’s layers</GroupLabel>
        <Note>
          lamprey: {layersLine(LAMPREY)} · mammal: {layersLine(MAMMAL)} · bird: {layersLine(species('bird'))}
        </Note>
        <Note>{FIRST_APPROXIMATION_LINE}</Note>
      </Panel>
      }
    />
  )
}

function StructureCard({ id, sp }: { id: StructureId; sp: SpeciesModel }) {
  const s = STRUCTURES.find((x) => x.id === id)!
  const lampreyCerebellum = sp.id === 'lamprey' && id === 'cerebellum'
  const lampreyAmygdala = sp.id === 'lamprey' && id === 'amygdala'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ fontSize: 15, fontWeight: 700 }}>{labelIn(s, sp)}</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>in the {sp.label}</div>
      {lampreyCerebellum ? (
        <p style={{ margin: 0, fontSize: 13 }}>
          {LAMPREY_CEREBELLUM_LINE} <Claims ids={['§6.1.8-C19', '§6.1.8-C20', '§6.1.8-C28']} />
        </p>
      ) : (
        <p style={{ margin: 0, fontSize: 13 }}>
          {s.description} <Claims ids={s.claims} />
        </p>
      )}
      {lampreyAmygdala && (
        <p style={{ margin: 0, fontSize: 13 }}>
          {LAMPREY_AMYGDALA_LINE} <Claims ids={['§6.3.3-C14']} />
        </p>
      )}
      {s.namedNotSpent && (
        <p style={{ margin: 0, fontSize: 12.5, fontStyle: 'italic', color: 'var(--text-muted)' }}>{s.namedNotSpent}</p>
      )}
      {id === 'pallium' && <Note>In the {sp.label}: {layersLine(sp)}.</Note>}
    </div>
  )
}

/** The chapter figure's bars, redrawn from the same constants, each segment outlined against the dark theme. */
export function ProportionBars({ rows }: { rows: ProportionRow[] }) {
  const BX = 90
  const BW = 430
  const BH = 26
  const H = 40 + rows.length * 38 + 60
  return (
    <svg viewBox={`0 0 600 ${H}`} width="100%" role="img" aria-label="proportions of six regions in each brain, schematic">
      <text x={BX + BW / 2} y={18} fontSize={10.5} fill="#9aa6b8" textAnchor="middle">
        front of the brain at the left
      </text>
      {rows.map((row, i) => {
        const y = 30 + i * 38
        const s = shares(row)
        let x = BX
        return (
          <g key={row.species}>
            <text x={BX - 10} y={y + 18} fontSize={12} fill="#e7ecf3" textAnchor="end">
              {row.species}
            </text>
            {s.map((p, j) => {
              if (p === 0) return null
              const w = BW * p
              const el = <rect key={j} x={x} y={y} width={w} height={BH} fill={REGIONS[j].color} stroke="#c9d2df" strokeWidth={1} rx={2} />
              x += w
              return el
            })}
            <rect x={BX} y={y} width={BW} height={BH} fill="none" stroke="#c9d2df" strokeWidth={1.4} rx={6} />
            {row.parts[4] === 0 && (
              <text x={BX + BW + 8} y={y + 16} fontSize={10.5} fill="#9aa6b8">
                no cerebellum of the jawed kind
              </text>
            )}
          </g>
        )
      })}
      {REGIONS.map((r, j) => {
        const col = Math.floor(j / 3)
        const rowi = j % 3
        const lx = 60 + col * 260
        const ly = 30 + rows.length * 38 + 12 + rowi * 16
        return (
          <g key={r.id}>
            <rect x={lx} y={ly - 9} width={16} height={12} fill={r.color} stroke="#c9d2df" strokeWidth={1} rx={2} />
            <text x={lx + 22} y={ly} fontSize={10.5} fill="#9aa6b8">
              {r.label}
            </text>
          </g>
        )
      })}
      <text x={300} y={H - 6} fontSize={11} fill="#9aa6b8" textAnchor="middle" fontStyle="italic">
        {FIGURE_LINE}
      </text>
    </svg>
  )
}

/** Clusters against six layers: a schematic cross-section of the pallium in a bird and a mammal (§6.3.5-C13). */
function BirdPallium() {
  const dots: { x: number; y: number }[] = []
  const seeds = [
    [40, 30], [70, 24], [96, 44], [52, 62], [84, 70], [120, 30], [140, 60], [30, 92], [66, 100], [110, 96], [142, 104], [90, 128], [50, 132], [128, 136], [36, 160], [78, 162], [118, 168], [150, 150],
  ]
  for (const [x, y] of seeds) dots.push({ x, y })
  return (
    <svg viewBox="0 0 440 220" width="100%" role="img" aria-label="clusters in a bird's pallium beside six layers in a mammal's, schematic">
      <g>
        <rect x={20} y={12} width={170} height={180} rx={8} fill="#13294B" stroke="#c9d2df" />
        {dots.map((d, i) => (
          <ellipse key={i} cx={20 + d.x} cy={12 + d.y} rx={13} ry={10} fill="none" stroke="#c9d2df" strokeWidth={1.2} />
        ))}
        <text x={105} y={210} fontSize={12} fill="#e7ecf3" textAnchor="middle">
          bird: clusters
        </text>
      </g>
      <g>
        <rect x={250} y={12} width={170} height={180} rx={8} fill="#13294B" stroke="#c9d2df" />
        {[1, 2, 3, 4, 5].map((i) => (
          <line key={i} x1={250} y1={12 + (180 * i) / 6} x2={420} y2={12 + (180 * i) / 6} stroke="#c9d2df" strokeWidth={1} />
        ))}
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <text key={i} x={258} y={12 + (180 * i) / 6 - 10} fontSize={9.5} fill="#c9d2df">
            {i}
          </text>
        ))}
        <text x={335} y={210} fontSize={12} fill="#e7ecf3" textAnchor="middle">
          mammal: six layers (neocortex)
        </text>
      </g>
      <text x={220} y={100} fontSize={10} fill="#9aa6b8" textAnchor="middle">
        surface at the top
      </text>
    </svg>
  )
}
