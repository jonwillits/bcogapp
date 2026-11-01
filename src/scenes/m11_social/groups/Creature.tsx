import type { CreatureKind } from '../../../sim/social/groups/sets'

/**
 * The invented animal of Part 5 (spec §9.1, decision 15): two kinds drawn
 * from a few shapes, with no face, resembling no real species and no ape
 * or other primate. A stilt: a narrow oval body on two long legs with a
 * crest. A bulb: a round body on a short stalk with three leaf-like fins.
 * Its trait is its height, drawn to the pixel from the baseline.
 */

export function Creature({ kind, hue, height, x = 60, baseline = 280 }: { kind: CreatureKind; hue: number; height: number; x?: number; baseline?: number }) {
  const fill = `hsl(${hue} 55% 55%)`
  const dark = `hsl(${hue} 50% 35%)`
  const top = baseline - height
  if (kind === 'stilt') {
    const bodyH = height * 0.42
    const legH = height * 0.5
    const crestH = height * 0.08
    return (
      <g data-creature="stilt" data-height={Math.round(height)}>
        <line x1={x - 7} y1={baseline} x2={x - 4} y2={baseline - legH} stroke={dark} strokeWidth={4} strokeLinecap="round" />
        <line x1={x + 7} y1={baseline} x2={x + 4} y2={baseline - legH} stroke={dark} strokeWidth={4} strokeLinecap="round" />
        <ellipse cx={x} cy={baseline - legH - bodyH / 2} rx={height * 0.12} ry={bodyH / 2} fill={fill} stroke={dark} strokeWidth={2} />
        <path d={`M${x - 8},${top + crestH} Q${x},${top - 2} ${x + 8},${top + crestH}`} fill="none" stroke={dark} strokeWidth={3} strokeLinecap="round" />
      </g>
    )
  }
  const stalkH = height * 0.22
  const r = height * 0.33
  const cy = baseline - stalkH - r
  return (
    <g data-creature="bulb" data-height={Math.round(height)}>
      <line x1={x} y1={baseline} x2={x} y2={baseline - stalkH} stroke={dark} strokeWidth={5} strokeLinecap="round" />
      <circle cx={x} cy={cy} r={r} fill={fill} stroke={dark} strokeWidth={2} />
      {[-0.9, 0, 0.9].map((a, i) => (
        <path key={i} d={`M${x + r * 0.5 * Math.sin(a)},${cy - r * 0.5 * Math.cos(a)} Q${x + (r + height * 0.12) * Math.sin(a) * 1.3},${cy - (r + height * 0.12) * Math.cos(a)} ${x + r * 0.95 * Math.sin(a) + (a === 0 ? 0 : Math.sign(a) * 4)},${top + (a === 0 ? 0 : height * 0.06)}`} fill={dark} opacity={0.85} />
      ))}
    </g>
  )
}

/** The judgment bar: a vertical bar beside the creature, on its own offset baseline so that the two cannot be aligned by eye. */
export function JudgmentBar({ height, x = 200, baseline = 280, offset = 0 }: { height: number; x?: number; baseline?: number; offset?: number }) {
  const b = baseline + offset
  return (
    <g data-bar={Math.round(height)}>
      <rect x={x - 10} y={b - height} width={20} height={height} fill="#4f9cff" opacity={0.85} rx={3} />
      <line x1={x - 24} y1={b} x2={x + 24} y2={b} stroke="var(--border)" strokeWidth={2} />
    </g>
  )
}
