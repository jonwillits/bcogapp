import type { Step } from './steps'

/**
 * The model, in one diagram (spec §9.1): three parts of one forager and
 * the list for tonight, with the part a step changes drawn in the accent
 * color. The tendency system: one weight per log, learned by Lab 5's rule,
 * storing no occasion. The fast store: each night after one exposure, as a
 * sparse code, with the logs emptied that night. The slow learner: a
 * network that comes to represent what is generally true of the things in
 * the range, from many interleaved experiences.
 */
export function Diagram({ step }: { step: Step }) {
  const hot = (part: 'tendency' | 'store' | 'slow' | 'list') => {
    if (step === 1) return part !== 'list'
    if (step === 2) return part === 'store'
    if (step === 3) return part === 'slow' || part === 'store'
    return part === 'store' || part === 'slow'
  }
  const box = (x: number, y: number, w: number, h: number, label: string, sub: string, on: boolean, id: string) => (
    <g data-diagram-part={id} data-hot={on ? true : undefined}>
      <rect x={x} y={y} width={w} height={h} rx={6} fill={on ? 'var(--accent)' : 'var(--surface-2)'} stroke={on ? 'var(--accent)' : 'var(--border)'} opacity={on ? 0.9 : 1} />
      <text x={x + w / 2} y={y + 15} textAnchor="middle" fontSize={10.5} fontWeight={600} fill={on ? '#0b111c' : 'var(--text)'}>
        {label}
      </text>
      <text x={x + w / 2} y={y + 29} textAnchor="middle" fontSize={8.5} fill={on ? '#0b111c' : 'var(--text-muted)'}>
        {sub}
      </text>
    </g>
  )
  return (
    <svg width={300} height={118} viewBox="0 0 300 118" role="img" aria-label="the model, in one diagram" style={{ display: 'block' }} data-diagram>
      {box(4, 6, 92, 40, 'The tendency', 'one weight per log', hot('tendency'), 'tendency')}
      {box(104, 6, 92, 40, 'The fast store', 'one night, one code', hot('store'), 'store')}
      {box(204, 6, 92, 40, 'The slow learner', 'what is generally true', hot('slow'), 'slow')}
      {box(104, 70, 92, 40, 'The list for tonight', 'logs dug tonight', hot('list'), 'list')}
      <line x1={50} y1={46} x2={140} y2={70} stroke="var(--border)" />
      <line x1={150} y1={46} x2={150} y2={70} stroke="var(--border)" />
      <line x1={250} y1={46} x2={160} y2={70} stroke="var(--border)" />
      <text x={150} y={62} textAnchor="middle" fontSize={8.5} fill="var(--text-muted)">
        which log to dig next
      </text>
      <text x={4} y={115} fontSize={8.5} fill="var(--text-muted)">
        the part this step changes is filled in
      </text>
    </svg>
  )
}
