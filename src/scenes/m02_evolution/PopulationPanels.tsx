import { Plot } from '../../components/Plot'
import { ValueReadout } from '../../components/ValueReadout'
import {
  crossing,
  meanWeight,
  hueToCss,
  type Genome,
} from '../../sim/creature/genome'
import { modalHue, type GenerationRecord } from '../../sim/world/evolutionWorld'
import { palette } from '../../theme/theme'

const CARD: React.CSSProperties = {
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  padding: '7px 8px',
}
const CAPTION: React.CSSProperties = {
  fontSize: 11.5,
  color: 'var(--text-muted)',
  lineHeight: 1.4,
  margin: '6px 0 0',
}

/**
 * Where the population sits in wiring space.
 *
 * The two axes are the ones Lab 1 taught, turned into numbers: *crossing* is how
 * much more the crossed connections carry than the straight ones, and *sign* is
 * whether the connections are excitatory or inhibitory on average. Lab 1's six
 * varieties sit at known corners of that plane, which is what makes a sweep
 * legible — the cloud visibly walks from one corner to another over a run,
 * rather than the student having to infer it from twenty-four wiring diagrams.
 *
 * Each dot is one individual, drawn in its own body colour, so the colour sweep
 * and the wiring sweep can be watched happening in the same picture.
 */
export function PopulationPlane({
  genomes,
  size = 250,
}: {
  genomes: readonly Genome[]
  size?: number
}) {
  const R = 6 // crossing runs −6…6 (four weights, each −3…3)
  const S = 3 // mean weight runs −3…3
  const x = (g: Genome) => ((crossing(g) + R) / (2 * R)) * size
  const y = (g: Genome) => size - ((meanWeight(g) + S) / (2 * S)) * size

  const corner = (label: string, cx: number, cy: number) => (
    <text
      x={cx}
      y={cy}
      fontSize={9}
      fill={palette.textMuted}
      fontFamily="var(--font-mono)"
      textAnchor="middle"
    >
      {label}
    </text>
  )

  return (
    <div style={CARD}>
      <svg
        width="100%"
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label="Population in wiring space"
      >
        <rect width={size} height={size} fill="transparent" />
        <line x1={size / 2} y1={0} x2={size / 2} y2={size} stroke={palette.border} />
        <line x1={0} y1={size / 2} x2={size} y2={size / 2} stroke={palette.border} />
        {/* Lab 1's varieties, at the corners they occupy. */}
        {corner('2b', size * 0.86, 18)}
        {corner('3b', size * 0.86, size - 8)}
        {corner('2a', size * 0.14, 18)}
        {corner('3a', size * 0.14, size - 8)}
        {corner('2c', size / 2 + 14, 18)}
        {corner('3c', size / 2 + 14, size - 8)}
        <text x={4} y={size / 2 - 5} fontSize={9} fill={palette.textMuted}>
          ipsilateral
        </text>
        <text
          x={size - 4}
          y={size / 2 - 5}
          fontSize={9}
          fill={palette.textMuted}
          textAnchor="end"
        >
          contralateral
        </text>
        {genomes.map((g, i) => (
          <circle
            key={i}
            cx={x(g)}
            cy={y(g)}
            r={4}
            fill={hueToCss(g.hue)}
            opacity={0.85}
            stroke="rgba(0,0,0,0.35)"
          />
        ))}
      </svg>
      <p style={CAPTION}>
        Each dot is one vehicle, in its own body colour. Left–right is whether
        its connections cross; up–down is whether they excite or inhibit.
      </p>
    </div>
  )
}

/** A small bar chart of one gene across the population. */
function GeneHistogram({
  label,
  values,
  min,
  max,
  bins = 16,
}: {
  label: string
  values: number[]
  min: number
  max: number
  bins?: number
}) {
  const counts = new Array<number>(bins).fill(0)
  for (const v of values) {
    const b = Math.min(bins - 1, Math.max(0, Math.floor(((v - min) / (max - min)) * bins)))
    counts[b]++
  }
  const peak = Math.max(1, ...counts)
  const W = 250
  const H = 34
  const bw = W / bins
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>
        {label}
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
        {counts.map((c, i) => (
          <rect
            key={i}
            x={i * bw + 0.5}
            y={H - (c / peak) * H}
            width={bw - 1}
            height={(c / peak) * H}
            fill={palette.accent}
            opacity={0.75}
          />
        ))}
        <line x1={W / 2} y1={0} x2={W / 2} y2={H} stroke={palette.border} />
      </svg>
    </div>
  )
}

/** Per-gene distributions, under the plane. */
export function GeneHistograms({ genomes }: { genomes: readonly Genome[] }) {
  const g = (pick: (x: Genome) => number) => genomes.map(pick)
  return (
    <div style={{ ...CARD, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <GeneHistogram label="sensor L → actuator L" values={g((x) => x.wLL)} min={-3} max={3} />
      <GeneHistogram label="sensor L → actuator R" values={g((x) => x.wLR)} min={-3} max={3} />
      <GeneHistogram label="sensor R → actuator L" values={g((x) => x.wRL)} min={-3} max={3} />
      <GeneHistogram label="sensor R → actuator R" values={g((x) => x.wRR)} min={-3} max={3} />
      <GeneHistogram label="actuator bias" values={g((x) => x.bias)} min={0} max={1.5} />
    </div>
  )
}

/**
 * Mean and best energy per generation.
 *
 * Q2 asks a student to write down the average energy at generation 1 and at
 * generation 50, so the numbers are printed as well as plotted — the left-hand
 * end of a fifty-point line is not something anyone can read a value off.
 */
export function FitnessPanel({ history }: { history: readonly GenerationRecord[] }) {
  if (!history.length) {
    return (
      <div style={CARD}>
        <p style={{ ...CAPTION, margin: 0 }}>
          Energy is recorded at the end of each generation. Press play, or{' '}
          <b>Step generation</b>, and the first point appears here.
        </p>
      </div>
    )
  }
  const first = history[0]
  const last = history[history.length - 1]
  return (
    <div style={{ ...CARD, display: 'flex', flexDirection: 'column', gap: 7 }}>
      <Plot
        width={250}
        height={92}
        series={[
          { color: palette.accent, data: history.map((h) => h.meanEnergy) },
          { color: palette.sensor, data: history.map((h) => h.bestEnergy) },
        ]}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <ValueReadout label="Mean energy, generation 1" value={first?.meanEnergy ?? 0} />
        <ValueReadout
          label={`Mean energy, generation ${last?.generation ?? 0}`}
          value={last?.meanEnergy ?? 0}
        />
        <ValueReadout label="Best this generation" value={last?.bestEnergy ?? 0} />
      </div>
      <p style={{ ...CAPTION, margin: 0 }}>
        Brighter line is the best individual; the other is the population average.
      </p>
    </div>
  )
}

/**
 * The distribution of body colour.
 *
 * Given the same visual weight as the panels that matter, deliberately: Part 4
 * turns on a student having watched this converge and then being asked to
 * explain why *that* colour was favoured. The panel never says the gene does
 * nothing — that is Q16's job, after they have committed to an answer.
 */
export function ColourPanel({ genomes }: { genomes: readonly Genome[] }) {
  const hues = genomes.map((g) => g.hue)
  const { hue, concentration } = modalHue(hues)
  const bins = 36
  const counts = new Array<number>(bins).fill(0)
  for (const h of hues) counts[Math.min(bins - 1, Math.floor((h / 360) * bins))]++
  const peak = Math.max(1, ...counts)
  const W = 250
  const H = 46

  return (
    <div style={{ ...CARD, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <svg width="100%" viewBox={`0 0 ${W} ${H + 10}`} role="img" aria-label="Body colours">
        {counts.map((c, i) => (
          <rect
            key={i}
            x={(i * W) / bins + 0.5}
            y={H - (c / peak) * H}
            width={W / bins - 1}
            height={(c / peak) * H}
            fill={hueToCss((i / bins) * 360 + 5)}
          />
        ))}
        {/* A full hue strip beneath, so an empty chart still reads as a colour axis. */}
        {Array.from({ length: bins }, (_, i) => (
          <rect
            key={`s${i}`}
            x={(i * W) / bins}
            y={H + 3}
            width={W / bins}
            height={6}
            fill={hueToCss((i / bins) * 360 + 5)}
            opacity={0.35}
          />
        ))}
      </svg>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            width: 16,
            height: 16,
            borderRadius: 4,
            background: hueToCss(hue),
            flex: 'none',
            border: '1px solid var(--border)',
          }}
        />
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {Math.round(concentration * 100)}% of the population is this colour
        </span>
      </div>
    </div>
  )
}
