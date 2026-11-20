import { useRef } from 'react'
import { useWidth } from '../ui'
import { HIDDEN, INPUTS, LABELS } from '../../../sim/language/sounds/classifier'
import { PATCH_BANDS, PATCH_FRAMES } from '../../../sim/language/audio/spectrogram'

/**
 * The network as a drawing (Jon, 2026-11-19): the input patch as a grid of
 * PATCH_BANDS bands by PATCH_FRAMES frames with its two axes named, fully
 * connected to HIDDEN hidden units in a column, connected to the three
 * outputs b, d, g. The counts are printed over each layer. Only a few of
 * the 4,800 input connections are drawn, from a handful of cells, so that
 * the picture stays legible; every hidden-to-output connection is drawn.
 * Inline SVG, sized to its container and capped at 560 px.
 */
const CAP = 560
/** The input cells whose connections are drawn: a row near the top, the middle and the bottom of the patch, at a frame in the middle. */
const SAMPLE_BANDS = [3, 13, 20, 27, 37]
const SAMPLE_FRAME = 6

export function Schematic() {
  const ref = useRef<HTMLDivElement>(null)
  const room = useWidth(ref, CAP)
  const w = Math.max(280, Math.min(CAP, room))
  const h = Math.round(w * 0.6)
  const top = 30
  const bottom = h - 40
  const gridH = bottom - top
  // Columns: the grid at the left, the hidden units past the middle, the outputs at the right.
  const gridX = 58
  const gridW = Math.round(w * 0.22)
  const cellW = gridW / PATCH_FRAMES
  const cellH = gridH / PATCH_BANDS
  const hiddenX = Math.round(w * 0.62)
  const outX = w - 44
  const r = Math.max(4, Math.min(8, gridH / (HIDDEN * 3)))
  const hiddenY = (j: number) => top + ((j + 0.5) / HIDDEN) * gridH
  const outY = (k: number) => top + ((k + 0.5) / LABELS.length) * gridH
  const cellCenter = (band: number, frame: number): [number, number] => [gridX + (frame + 0.5) * cellW, bottom - (band + 0.5) * cellH]
  return (
    <div ref={ref} style={{ width: '100%', minWidth: 0 }}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`the network: ${INPUTS} inputs, ${HIDDEN} hidden units, ${LABELS.length} outputs`} style={{ display: 'block', background: 'var(--bg)', borderRadius: 8 }} data-schematic>
        {/* The input patch: a grid of bands by frames. */}
        <rect x={gridX} y={top} width={gridW} height={gridH} fill="none" stroke="var(--sensor)" strokeWidth={1} />
        {Array.from({ length: PATCH_FRAMES - 1 }, (_, i) => (
          <line key={'f' + i} x1={gridX + (i + 1) * cellW} y1={top} x2={gridX + (i + 1) * cellW} y2={bottom} stroke="var(--border)" strokeWidth={0.6} />
        ))}
        {Array.from({ length: PATCH_BANDS - 1 }, (_, i) => (
          <line key={'b' + i} x1={gridX} y1={top + (i + 1) * cellH} x2={gridX + gridW} y2={top + (i + 1) * cellH} stroke="var(--border)" strokeWidth={0.6} />
        ))}
        {SAMPLE_BANDS.map((band) => {
          const [cx, cy] = cellCenter(band, SAMPLE_FRAME)
          return <rect key={'s' + band} x={cx - cellW / 2} y={cy - cellH / 2} width={cellW} height={cellH} fill="var(--sensor)" />
        })}
        <text x={gridX + gridW / 2} y={top - 14} fontSize={10} textAnchor="middle" fill="var(--text)">
          {`${INPUTS} inputs`}
        </text>
        <text x={gridX + gridW / 2} y={top - 3} fontSize={9} textAnchor="middle" fill="var(--text-muted)">
          the patch
        </text>
        <text x={gridX - 6} y={(top + bottom) / 2} fontSize={9} textAnchor="middle" fill="var(--text-muted)" transform={`rotate(-90 ${gridX - 6} ${(top + bottom) / 2})`}>
          {`${PATCH_BANDS} frequency bands, 0 to 5,000 Hz`}
        </text>
        <text x={gridX + gridW / 2} y={bottom + 12} fontSize={9} textAnchor="middle" fill="var(--text-muted)">
          {`${PATCH_FRAMES} frames of 10 ms`}
        </text>
        {/* Some of the input connections: from the marked cells to every hidden unit. */}
        {SAMPLE_BANDS.flatMap((band) => {
          const [cx, cy] = cellCenter(band, SAMPLE_FRAME)
          return Array.from({ length: HIDDEN }, (_, j) => <line key={`i${band}-${j}`} x1={cx} y1={cy} x2={hiddenX - r} y2={hiddenY(j)} stroke="var(--text-muted)" strokeWidth={0.5} opacity={0.35} />)
        })}
        {/* Every hidden-to-output connection. */}
        {Array.from({ length: HIDDEN }, (_, j) => LABELS.map((l, k) => <line key={`h${j}-${l}`} x1={hiddenX + r} y1={hiddenY(j)} x2={outX - r - 1} y2={outY(k)} stroke="var(--text-muted)" strokeWidth={0.6} opacity={0.5} />))}
        {/* The hidden units. */}
        {Array.from({ length: HIDDEN }, (_, j) => (
          <circle key={'h' + j} cx={hiddenX} cy={hiddenY(j)} r={r} fill="var(--bg)" stroke="var(--accent)" strokeWidth={1.4} />
        ))}
        <text x={hiddenX} y={top - 14} fontSize={10} textAnchor="middle" fill="var(--text)">
          {`${HIDDEN} hidden units`}
        </text>
        {/* The outputs. */}
        {LABELS.map((l, k) => (
          <g key={l}>
            <circle cx={outX} cy={outY(k)} r={r + 1} fill="var(--bg)" stroke="var(--actuator)" strokeWidth={1.4} />
            <text x={outX + r + 6} y={outY(k) + 3.5} fontSize={11} fill="var(--text)" fontFamily="var(--font-mono)">
              {l}
            </text>
          </g>
        ))}
        <text x={outX} y={top - 14} fontSize={10} textAnchor="middle" fill="var(--text)">
          {`${LABELS.length} outputs`}
        </text>
        <text x={w / 2} y={h - 8} fontSize={9} textAnchor="middle" fill="var(--text-muted)">
          every input connects to every hidden unit; every hidden unit to every output
        </text>
      </svg>
    </div>
  )
}
