/**
 * Step 4's two drawings (Jon, 2026-11-19): the simple recurrent network and
 * the transformer, each as inline SVG with no library, in the lab's CSS
 * colors, legible at about 360 px wide and scaled to the column it sits in.
 * Each drawing is a picture of the shape of the computation, not of the
 * numbers: the units, the layers, the arrows between them, and the labels
 * that name the sizes. In the recurrent network's drawing each layer is in
 * a box with one arrow to the next, and the hidden and output units are
 * filled to suggest a pattern of activity (Jon, 2026-11-21).
 */

import type { ReactNode } from 'react'

const TEXT = 'var(--text)'
const MUTED = 'var(--text-muted)'
const BORDER = 'var(--border)'
const ACCENT = 'var(--accent)'
const SENSOR = 'var(--sensor)'
const ACTUATOR = 'var(--actuator)'

const svgStyle = { display: 'block', width: '100%', maxWidth: 440, background: 'var(--bg)', borderRadius: 8 } as const

/**
 * A row of unit circles, with a gap and an ellipsis to say the row goes on.
 * `activity` fills each unit with the layer's color at that opacity, to
 * suggest a pattern of activity (Jon, 2026-11-21); without it the units
 * are outlines.
 */
function Units({ y, x0, x1, n, r, color, activity }: { y: number; x0: number; x1: number; n: number; r: number; color: string; activity?: readonly number[] }) {
  const left = Math.floor(n / 2)
  const right = n - left
  const step = (x1 - x0) / (n + 1)
  const xs: number[] = []
  for (let i = 0; i < left; i++) xs.push(x0 + step * i)
  for (let i = 0; i < right; i++) xs.push(x1 - step * (right - 1 - i))
  const gap = (xs[left - 1] + xs[left]) / 2
  return (
    <g>
      {xs.map((x, i) => (
        <circle key={i} cx={x} cy={y} r={r} fill={activity ? color : 'none'} fillOpacity={activity ? activity[i] : undefined} stroke={color} strokeWidth={1.2} />
      ))}
      <text x={gap} y={y + 3} fontSize={10} textAnchor="middle" fill={MUTED}>
        …
      </text>
    </g>
  )
}

/** An arrow head pointing up at (x, y). */
const headUp = (x: number, y: number, color: string) => <path d={`M ${x - 3.5} ${y + 6} L ${x} ${y} L ${x + 3.5} ${y + 6}`} fill="none" stroke={color} strokeWidth={1.2} />

/** A made-up pattern of activity over the hidden units drawn: some high, some low, no order to it. */
const HIDDEN_ACTIVITY = [0.85, 0.15, 0.55, 0.3, 0.95, 0.1, 0.4, 0.7, 0.2, 0.6, 0.05, 0.9, 0.35, 0.5] as const
/** A made-up pattern over the output units drawn: one token probable, a few less so, the rest near 0. */
const OUTPUT_ACTIVITY = [0.08, 0.05, 0.9, 0.12, 0.04, 0.35, 0.06, 0.1, 0.55, 0.05, 0.15, 0.07] as const

/**
 * The simple recurrent network: 52 input units, one for each token, with
 * one on; a hidden layer of 64 units; 52 output units, one probability for
 * each token; and the hidden layer's activity at the token before fed back
 * into the hidden layer. Each layer sits in a box, one arrow runs from a
 * layer to the next, and the hidden and output units are filled to
 * suggest a pattern of activity (Jon, 2026-11-21; before, three lines
 * stood in for the weights and every unit was an outline).
 */
export function SrnSchematic() {
  const W = 360
  const H = 236
  const yIn = 196
  const yHid = 118
  const yOut = 40
  const x0 = 82
  const x1 = 218
  const mid = (x0 + x1) / 2
  const boxX = x0 - 14
  const boxW = x1 - x0 + 28
  const half = 13
  const box = (y: number, color: string) => <rect x={boxX} y={y - half} width={boxW} height={2 * half} rx={5} fill="none" stroke={color} strokeWidth={1} opacity={0.9} />
  const arrow = (yFrom: number, yTo: number) => (
    <g>
      <line x1={mid} y1={yFrom - half} x2={mid} y2={yTo + half} stroke={TEXT} strokeWidth={1.2} />
      {headUp(mid, yTo + half, TEXT)}
    </g>
  )
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="the simple recurrent network: an input layer, a hidden layer with its own activity at the token before fed back, and an output layer, each in a box, with one arrow from each layer to the next" style={svgStyle} data-schematic="srn">
      {/* one arrow from each layer to the next, standing for all the weights between them */}
      {arrow(yIn, yHid)}
      {arrow(yHid, yOut)}
      {/* the three layers, each in a box */}
      {box(yIn, SENSOR)}
      {box(yHid, ACCENT)}
      {box(yOut, ACTUATOR)}
      <Units y={yIn} x0={x0} x1={x1} n={12} r={5} color={SENSOR} />
      <Units y={yHid} x0={x0} x1={x1} n={14} r={5} color={ACCENT} activity={HIDDEN_ACTIVITY} />
      <Units y={yOut} x0={x0} x1={x1} n={12} r={5} color={ACTUATOR} activity={OUTPUT_ACTIVITY} />
      {/* the one input unit that is on */}
      <circle cx={x0 + ((x1 - x0) / 13) * 2} cy={yIn} r={5} fill={SENSOR} />
      {/* the loop: the hidden layer's activity at the token before, back into the hidden layer, from the box's right side */}
      <path d={`M ${boxX + boxW} ${yHid + 6} C ${x1 + 62} ${yHid + 40}, ${x1 + 62} ${yHid - 40}, ${boxX + boxW} ${yHid - 6}`} fill="none" stroke={ACCENT} strokeWidth={1.4} />
      <path d={`M ${boxX + boxW} ${yHid - 6} L ${boxX + boxW + 8} ${yHid - 13} M ${boxX + boxW} ${yHid - 6} L ${boxX + boxW + 9} ${yHid - 3}`} fill="none" stroke={ACCENT} strokeWidth={1.4} />
      <text x={x1 + 66} y={yHid - 8} fontSize={8.5} fill={ACCENT}>
        the hidden layer’s
      </text>
      <text x={x1 + 66} y={yHid + 3} fontSize={8.5} fill={ACCENT}>
        activity at the
      </text>
      <text x={x1 + 66} y={yHid + 14} fontSize={8.5} fill={ACCENT}>
        token before
      </text>
      {/* labels */}
      <text x={W / 2} y={14} fontSize={10} textAnchor="middle" fill={TEXT}>
        output: 52 units, the probability of each token as the next
      </text>
      <text x={boxX - 6} y={yHid + 3} fontSize={9.5} textAnchor="end" fill={TEXT}>
        hidden layer
      </text>
      <text x={boxX - 6} y={yHid + 14} fontSize={9} textAnchor="end" fill={MUTED}>
        64 units
      </text>
      <text x={W / 2} y={H - 18} fontSize={10} textAnchor="middle" fill={TEXT}>
        input: 52 units, one for each token
      </text>
      <text x={W / 2} y={H - 6} fontSize={9} textAnchor="middle" fill={MUTED}>
        the current token’s unit is on (filled); the rest are off
      </text>
    </svg>
  )
}

/**
 * The transformer: tokens in positions along the bottom, each with its
 * position added; two layers, each with two attention computations side by
 * side (arrows from a later position back to earlier ones only) and a
 * feed-forward block; the output read at the last position.
 */
export function TransformerSchematic() {
  const W = 360
  const H = 300
  const T = 4
  const xTok = (i: number) => 58 + i * 44
  const yTok = 258
  const layerH = 78
  const yLayer = (L: number) => 156 - L * (layerH + 10) // top of layer L's box
  const boxX = 34
  const boxW = 212
  const attnW = 92
  const attnH = 40
  const attn = (L: number, h: number) => {
    const bx = boxX + 8 + h * (attnW + 8)
    const by = yLayer(L) + 14
    const px = (i: number) => bx + 10 + (i * (attnW - 20)) / (T - 1)
    const py = by + attnH - 8
    const arcs: ReactNode[] = []
    for (let i = 1; i < T; i++)
      for (let j = 0; j < i; j++) {
        const lift = 6 + 7 * (i - j)
        arcs.push(<path key={`${i}-${j}`} d={`M ${px(i)} ${py} Q ${(px(i) + px(j)) / 2} ${py - lift} ${px(j)} ${py}`} fill="none" stroke={SENSOR} strokeWidth={i === T - 1 ? 1.2 : 0.7} opacity={i === T - 1 ? 0.95 : 0.5} />)
      }
    return (
      <g key={`${L}-${h}`}>
        <rect x={bx} y={by} width={attnW} height={attnH} rx={4} fill="none" stroke={BORDER} />
        <text x={bx + 4} y={by + 9} fontSize={7.5} fill={MUTED}>{`attention ${h + 1}`}</text>
        {arcs}
        {Array.from({ length: T }, (_, i) => (
          <circle key={i} cx={px(i)} cy={py} r={2.2} fill={TEXT} />
        ))}
        {/* the arrow head at the earliest position of the last position's arcs */}
        <path d={`M ${px(0) + 5} ${py - 4} L ${px(0)} ${py} L ${px(0) + 6} ${py - 0.5}`} fill="none" stroke={SENSOR} strokeWidth={1} />
      </g>
    )
  }
  const ff = (L: number) => {
    const by = yLayer(L) + 14 + attnH + 6
    return (
      <g key={`ff-${L}`}>
        <rect x={boxX + 8} y={by} width={boxW - 16} height={12} rx={3} fill="none" stroke={ACTUATOR} />
        <text x={boxX + boxW / 2} y={by + 9} fontSize={7.5} textAnchor="middle" fill={ACTUATOR}>
          feed-forward block, at every position
        </text>
      </g>
    )
  }
  const xLast = xTok(T - 1)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="the transformer: tokens with positions added, two layers of two attention computations and a feed-forward block, the output at the last position" style={svgStyle} data-schematic="transformer">
      {/* tokens along the bottom, each with its position added */}
      {Array.from({ length: T }, (_, i) => (
        <g key={i}>
          <rect x={xTok(i) - 16} y={yTok - 10} width={32} height={20} rx={4} fill="none" stroke={ACCENT} />
          <text x={xTok(i)} y={yTok + 3.5} fontSize={8.5} textAnchor="middle" fill={TEXT}>{`token ${i + 1}`}</text>
          <text x={xTok(i)} y={yTok + 24} fontSize={7.5} textAnchor="middle" fill={MUTED}>
            + position
          </text>
          <line x1={xTok(i)} y1={yTok - 10} x2={xTok(i)} y2={yLayer(0) + layerH} stroke={BORDER} />
          {headUp(xTok(i), yLayer(0) + layerH, BORDER)}
        </g>
      ))}
      <text x={xTok(T - 1) + 24} y={yTok + 3.5} fontSize={9} fill={MUTED}>
        … up to 32
      </text>
      {/* the two layers */}
      {[0, 1].map((L) => (
        <g key={L}>
          <rect x={boxX} y={yLayer(L)} width={boxW} height={layerH} rx={6} fill="none" stroke={BORDER} strokeDasharray="3 3" />
          <text x={boxX + 6} y={yLayer(L) + 10} fontSize={8} fill={TEXT}>{`layer ${L + 1}`}</text>
          {attn(L, 0)}
          {attn(L, 1)}
          {ff(L)}
        </g>
      ))}
      {/* between the layers, and from the last position up to the output */}
      {Array.from({ length: T }, (_, i) => (
        <g key={`b${i}`}>
          <line x1={xTok(i)} y1={yLayer(0)} x2={xTok(i)} y2={yLayer(1) + layerH} stroke={BORDER} />
          {headUp(xTok(i), yLayer(1) + layerH, BORDER)}
        </g>
      ))}
      <line x1={xLast} y1={yLayer(1)} x2={xLast} y2={30} stroke={ACTUATOR} strokeWidth={1.4} />
      {headUp(xLast, 30, ACTUATOR)}
      <rect x={xLast - 68} y={8} width={136} height={16} rx={4} fill="none" stroke={ACTUATOR} />
      <text x={xLast} y={19.5} fontSize={8.5} textAnchor="middle" fill={TEXT}>
        output at the last position
      </text>
      <text x={xLast + 74} y={19.5} fontSize={7.5} fill={MUTED}>
        probability of
      </text>
      <text x={xLast + 74} y={29} fontSize={7.5} fill={MUTED}>
        each token
      </text>
      {/* the sizes, at the right */}
      <text x={boxX + boxW + 10} y={yLayer(1) + 24} fontSize={8.5} fill={TEXT}>
        2 layers
      </text>
      <text x={boxX + boxW + 10} y={yLayer(1) + 38} fontSize={8.5} fill={TEXT}>
        2 attention
      </text>
      <text x={boxX + boxW + 10} y={yLayer(1) + 49} fontSize={8.5} fill={TEXT}>
        computations
      </text>
      <text x={boxX + boxW + 10} y={yLayer(1) + 60} fontSize={8.5} fill={TEXT}>
        per layer
      </text>
      <text x={boxX + boxW + 10} y={yLayer(0) + 30} fontSize={8.5} fill={TEXT}>
        32 numbers
      </text>
      <text x={boxX + boxW + 10} y={yLayer(0) + 41} fontSize={8.5} fill={TEXT}>
        per position
      </text>
      <text x={boxX + boxW + 10} y={yLayer(0) + 52} fontSize={8.5} fill={TEXT}>
        at every layer
      </text>
      <text x={boxX + boxW + 10} y={yLayer(0) + 70} fontSize={7.5} fill={SENSOR}>
        arrows: attention
      </text>
      <text x={boxX + boxW + 10} y={yLayer(0) + 79} fontSize={7.5} fill={SENSOR}>
        from a position back
      </text>
      <text x={boxX + boxW + 10} y={yLayer(0) + 88} fontSize={7.5} fill={SENSOR}>
        to earlier ones only
      </text>
    </svg>
  )
}
