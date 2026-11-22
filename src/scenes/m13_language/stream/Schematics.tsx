/**
 * Part 2, Step 3's drawings of two of the three learners, shown with their
 * descriptions before anything runs (Jon, 2026-11-21: explain the learners
 * first, with a figure each where one can be drawn, as Part 4 does for its
 * networks). The simple recurrent network reuses Part 4's drawing with 12
 * syllables (`predictors/Schematics.tsx`). Inline SVG, the lab's colors,
 * scaled to the column's width. The numbers in the drawings are examples
 * chosen to show the mechanism, not measurements; the stretch of syllables
 * is three of the language's words in a row.
 */
const TEXT = 'var(--text)'
const MUTED = 'var(--text-muted)'
const BORDER = 'var(--border)'
const ACCENT = 'var(--accent)'
const SENSOR = 'var(--sensor)'
const svgStyle = { display: 'block', width: '100%', maxWidth: 440, background: 'var(--bg)', borderRadius: 8 } as const

/** Three words of the language in a row: bupada, dutaba, patubi. */
const STRETCH = ['bu', 'pa', 'da', 'du', 'ta', 'ba', 'pa', 'tu', 'bi'] as const
/** Each transition's height in the dips drawing: high inside a word, low across the two boundaries (after da and after ba). */
const TP_HEIGHTS = [0.9, 0.85, 0.3, 0.9, 0.85, 0.3, 0.9, 0.85] as const

function Tiles({ y, x, step, w, h }: { y: number; x: number; step: number; w: number; h: number }) {
  return (
    <g>
      {STRETCH.map((s, i) => (
        <g key={i}>
          <rect x={x + i * step} y={y} width={w} height={h} rx={3} fill="none" stroke={BORDER} />
          <text x={x + i * step + w / 2} y={y + h / 2 + 3.5} fontSize={9.5} textAnchor="middle" fill={TEXT} fontFamily="var(--font-mono)">
            {s}
          </text>
        </g>
      ))}
    </g>
  )
}

/**
 * Cut at the dips: the stretch of syllables as tiles, the transitional
 * probability from each to the next as a bar between them, and a cut where
 * a bar is lower than both of its neighbors.
 */
export function DipsSchematic() {
  const W = 360
  const H = 150
  const x = 12
  const step = 38
  const w = 28
  const yTile = 78
  const h = 22
  const base = 70
  const tall = 44
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="cut at the dips: nine syllables in a row, the transitional probability from each syllable to the next drawn as a bar between them, and a cut at each bar lower than both of its neighbors" style={svgStyle} data-schematic="dips">
      <text x={W / 2} y={14} fontSize={9.5} textAnchor="middle" fill={TEXT}>
        the transitional probability from each syllable to the next, as a bar
      </text>
      {TP_HEIGHTS.map((p, i) => {
        const cx = x + i * step + w + (step - w) / 2
        const dip = i > 0 && i < TP_HEIGHTS.length - 1 && p < TP_HEIGHTS[i - 1] && p < TP_HEIGHTS[i + 1]
        return (
          <g key={i}>
            <rect x={cx - 3} y={base - tall * p} width={6} height={tall * p} fill={dip ? SENSOR : ACCENT} opacity={dip ? 1 : 0.85} />
            {dip && (
              <g>
                <line x1={cx} y1={base - tall - 4} x2={cx} y2={yTile + h + 10} stroke={SENSOR} strokeWidth={1.2} strokeDasharray="3 3" />
                <text x={cx} y={yTile + h + 22} fontSize={9} textAnchor="middle" fill={SENSOR}>
                  cut
                </text>
              </g>
            )}
          </g>
        )
      })}
      <Tiles y={yTile} x={x} step={step} w={w} h={h} />
      <text x={W / 2} y={H - 8} fontSize={9} textAnchor="middle" fill={MUTED}>
        a cut wherever a bar is lower than both of its neighbors: a dip
      </text>
    </svg>
  )
}

/** PARSER's store of units in the drawing: the 12 syllables at weight 1, then units it has made, at example weights. */
const UNITS = [
  { name: 'pa, tu, bi, bu, … (the 12 syllables)', weight: 1 },
  { name: 'patubi', weight: 2.6 },
  { name: 'bupada', weight: 2.1 },
  { name: 'dutaba', weight: 1.7 },
  { name: 'tuti', weight: 0.6 },
  { name: 'dadu', weight: 0.3 },
] as const
/** The pieces the stretch is taken in: how many units each covers. */
const PIECES = [3, 2, 1, 3] as const

/**
 * PARSER: the stretch of syllables taken in pieces of 1, 2, or 3 units,
 * and the store of units with their weights, with the weight of 1 marked
 * at which a unit comes to shape what a piece is.
 */
export function ParserSchematic() {
  const W = 360
  const H = 196
  const x = 12
  const step = 36
  const w = 26
  const yTile = 24
  const h = 20
  const yRows = 100
  const pitch = 14
  const barX = 196
  const barMax = 150
  const scale = barMax / 3
  const threshold = barX + scale
  let at = 0
  const brackets = PIECES.map((n) => {
    const from = at
    at += n
    return { from, to: at - 1, n }
  })
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="PARSER: nine syllables taken in pieces of three, two, one and three units, with a bracket under each piece; under them, the store of units, each with a weight drawn as a bar, the twelve syllables at a weight of one, three words above one, and two pieces across word boundaries below it" style={svgStyle} data-schematic="parser">
      <text x={W / 2} y={13} fontSize={9.5} textAnchor="middle" fill={TEXT}>
        the stream, taken in pieces of 1, 2, or 3 units
      </text>
      <Tiles y={yTile} x={x} step={step} w={w} h={h} />
      {brackets.map((b, k) => {
        const x0 = x + b.from * step
        const x1 = x + b.to * step + w
        const y = yTile + h + 5
        return (
          <g key={k}>
            <path d={`M ${x0} ${y} L ${x0} ${y + 5} L ${x1} ${y + 5} L ${x1} ${y}`} fill="none" stroke={ACCENT} strokeWidth={1.2} />
            <text x={(x0 + x1) / 2} y={y + 16} fontSize={8.5} textAnchor="middle" fill={ACCENT}>
              {`${b.n} ${b.n === 1 ? 'unit' : 'units'}`}
            </text>
          </g>
        )
      })}
      <text x={x} y={yRows - 12} fontSize={9.5} fill={TEXT}>
        the store of units, each with a weight (an example)
      </text>
      {UNITS.map((u, i) => {
        const y = yRows + i * pitch
        const strong = u.weight >= 1
        return (
          <g key={u.name}>
            <text x={barX - 6} y={y + 7} fontSize={8.5} textAnchor="end" fill={strong ? TEXT : MUTED} fontFamily="var(--font-mono)">
              {u.name}
            </text>
            <rect x={barX} y={y} width={u.weight * scale} height={9} rx={1.5} fill={strong ? ACCENT : MUTED} opacity={strong ? 0.85 : 0.6} />
            <text x={barX + u.weight * scale + 4} y={y + 7.5} fontSize={8} fill={MUTED} fontFamily="var(--font-mono)">
              {u.weight.toFixed(1)}
            </text>
          </g>
        )
      })}
      <line x1={threshold} y1={yRows - 4} x2={threshold} y2={yRows + UNITS.length * pitch} stroke={SENSOR} strokeDasharray="3 3" />
      <text x={threshold + 3} y={yRows + UNITS.length * pitch + 9} fontSize={8} fill={SENSOR}>
        weight 1: from here a unit shapes the pieces
      </text>
    </svg>
  )
}
