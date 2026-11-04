import { MARKINGS, PATCH_HUES, type Family, type Marking } from '../../../sim/social/creatures/materials'

/**
 * The invented animal of Part 5 (decision 15, carried from the first
 * Part 5): two families drawn from a few shapes, with no face, resembling
 * no real species and no primate. A stilt: a narrow oval body on two long
 * legs with a crest. A bulb: a round body on a short stalk with three
 * leaf-like fins. Its height is drawn to the pixel from the baseline, and
 * its two features (PART5_REDESIGN §2.3), a marking and a patch color, are
 * drawn on the body: the marking's shape in the patch's color.
 */

export function Creature({ family, hue, height, marking, patch, x = 60, baseline = 280 }: { family: Family; hue: number; height: number; marking?: Marking; patch?: number; x?: number; baseline?: number }) {
  const fill = `hsl(${hue} 55% 55%)`
  const dark = `hsl(${hue} 50% 35%)`
  const top = baseline - height
  const patchColor = patch === undefined ? undefined : `hsl(${PATCH_HUES[patch]} 85% 55%)`
  if (family === 'stilt') {
    const bodyH = height * 0.42
    const legH = height * 0.5
    const crestH = height * 0.08
    const cy = baseline - legH - bodyH / 2
    const rx = height * 0.12
    return (
      <g data-creature="stilt" data-height={Math.round(height)} data-marking={marking ?? ''} data-patch={patch ?? ''}>
        <line x1={x - 7} y1={baseline} x2={x - 4} y2={baseline - legH} stroke={dark} strokeWidth={4} strokeLinecap="round" />
        <line x1={x + 7} y1={baseline} x2={x + 4} y2={baseline - legH} stroke={dark} strokeWidth={4} strokeLinecap="round" />
        <ellipse cx={x} cy={cy} rx={rx} ry={bodyH / 2} fill={fill} stroke={dark} strokeWidth={2} />
        {marking && patchColor && <MarkingShape marking={marking} color={patchColor} cx={x} cy={cy} rx={rx * 0.8} ry={bodyH * 0.36} />}
        <path d={`M${x - 8},${top + crestH} Q${x},${top - 2} ${x + 8},${top + crestH}`} fill="none" stroke={dark} strokeWidth={3} strokeLinecap="round" />
      </g>
    )
  }
  const stalkH = height * 0.22
  const r = height * 0.33
  const cy = baseline - stalkH - r
  return (
    <g data-creature="bulb" data-height={Math.round(height)} data-marking={marking ?? ''} data-patch={patch ?? ''}>
      <line x1={x} y1={baseline} x2={x} y2={baseline - stalkH} stroke={dark} strokeWidth={5} strokeLinecap="round" />
      <circle cx={x} cy={cy} r={r} fill={fill} stroke={dark} strokeWidth={2} />
      {marking && patchColor && <MarkingShape marking={marking} color={patchColor} cx={x} cy={cy} rx={r * 0.62} ry={r * 0.62} />}
      {[-0.9, 0, 0.9].map((a, i) => (
        <path key={i} d={`M${x + r * 0.5 * Math.sin(a)},${cy - r * 0.5 * Math.cos(a)} Q${x + (r + height * 0.12) * Math.sin(a) * 1.3},${cy - (r + height * 0.12) * Math.cos(a)} ${x + r * 0.95 * Math.sin(a) + (a === 0 ? 0 : Math.sign(a) * 4)},${top + (a === 0 ? 0 : height * 0.06)}`} fill={dark} opacity={0.85} />
      ))}
    </g>
  )
}

/** A marking on the body, inside the box (cx ± rx, cy ± ry), in the patch's color. */
export function MarkingShape({ marking, color, cx, cy, rx, ry }: { marking: Marking; color: string; cx: number; cy: number; rx: number; ry: number }) {
  const w = Math.max(3, Math.min(rx, ry) * 0.3)
  switch (marking) {
    case 'spots':
      return (
        <g data-marking-shape="spots">
          {[[-0.5, -0.4], [0.5, -0.1], [-0.1, 0.55]].map(([a, b], i) => (
            <circle key={i} cx={cx + a * rx} cy={cy + b * ry} r={w * 0.9} fill={color} />
          ))}
        </g>
      )
    case 'stripes':
      return (
        <g data-marking-shape="stripes">
          {[-0.55, 0, 0.55].map((b, i) => (
            <line key={i} x1={cx - rx * 0.8} y1={cy + b * ry} x2={cx + rx * 0.8} y2={cy + b * ry} stroke={color} strokeWidth={w * 0.6} strokeLinecap="round" />
          ))}
        </g>
      )
    case 'ring':
      return <ellipse data-marking-shape="ring" cx={cx} cy={cy} rx={rx * 0.6} ry={ry * 0.6} fill="none" stroke={color} strokeWidth={w * 0.7} />
    case 'chevron':
      return <path data-marking-shape="chevron" d={`M${cx - rx * 0.7},${cy - ry * 0.35} L${cx},${cy + ry * 0.45} L${cx + rx * 0.7},${cy - ry * 0.35}`} fill="none" stroke={color} strokeWidth={w * 0.7} strokeLinecap="round" strokeLinejoin="round" />
    case 'band':
      return <rect data-marking-shape="band" x={cx - rx * 0.9} y={cy - ry * 0.22} width={rx * 1.8} height={ry * 0.44} fill={color} rx={2} />
    case 'dots':
      return (
        <g data-marking-shape="dots">
          {[-0.75, -0.25, 0.25, 0.75].map((a, i) => (
            <circle key={i} cx={cx + a * rx * 0.9} cy={cy} r={w * 0.45} fill={color} />
          ))}
        </g>
      )
  }
}

export { MARKINGS }
