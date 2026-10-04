import { useMemo } from 'react'
import { palette } from '../../theme/theme'
import { fmt } from '../../components/format'
import { evidenceFor, hiddenOutputFor, makeScratch, predictionOf, inputLabels } from '../../sim/fish/brain'
import { KINDS } from '../../sim/fish/kinds'
import { dPrimeOf, moments } from '../../sim/fish/sdt'
import type { FishWorld } from '../../sim/fish/world'
import { CURVE_COLORS, KIND_COLORS, OUTCOME_WORDS } from './labels'

const AXIS = palette.textMuted
const MONO = 'var(--font-mono)'
const scratch = makeScratch()

/**
 * The feature-space panel: receptor A across, receptor B up. Lab 4's
 * decision-boundary plot, extended. The background is the fish's prediction
 * for every smell; the line is where the evidence equals the criterion now in
 * force, so moving the criterion slides it and moving a weight turns it.
 * Filled dots are recent encounters and hollow ones the test set, colored by
 * what the outcome was. They are the experimenter's.
 */
export function FeatureSpacePlot({
  world,
  showTest,
  showPrototypes,
  hoverUnit,
  hideShading,
  size = 300,
}: {
  world: FishWorld
  showTest: boolean
  showPrototypes: boolean
  /** A hidden unit whose own output tints the background instead of the prediction. */
  hoverUnit: number | null
  /** A hidden fish: the dots stay, the shading and the line are withheld. */
  hideShading: boolean
  size?: number
}) {
  const padL = 34
  const padB = 30
  const padT = 8
  const padR = 8
  const w = size - padL - padR
  const h = size - padT - padB
  const x = (v: number) => padL + v * w
  const y = (v: number) => padT + (1 - v) * h
  const N = 26
  const criterion = world.effectiveCriterion
  const b = world.brain
  const unit = hoverUnit !== null && hoverUnit < b.circuit.interneurons.length ? hoverUnit : null

  const { cells, segments } = useMemo(() => {
    const cells: { i: number; j: number; v: number }[] = []
    const segments: [number, number, number, number][] = []
    if (hideShading) return { cells, segments }
    // Values on the lattice corners, for the line; on the centers, for the shading.
    const corner: number[][] = []
    for (let i = 0; i <= N; i++) {
      corner.push([])
      for (let j = 0; j <= N; j++) corner[i].push(evidenceFor(b.circuit, b.receptors, i / N, j / N, scratch) - criterion)
    }
    for (let i = 0; i < N; i++)
      for (let j = 0; j < N; j++) {
        const cx = (i + 0.5) / N
        const cy = (j + 0.5) / N
        const v =
          unit !== null
            ? hiddenOutputFor(b.circuit, b.receptors, unit, cx, cy, scratch)
            : predictionOf(evidenceFor(b.circuit, b.receptors, cx, cy, scratch))
        cells.push({ i, j, v })
        // Marching squares: where the evidence crosses the criterion along this cell's edges.
        const a = corner[i][j]
        const bb = corner[i + 1][j]
        const c = corner[i + 1][j + 1]
        const d = corner[i][j + 1]
        const pts: [number, number][] = []
        const cross = (p: number, q: number, x0: number, y0: number, x1: number, y1: number) => {
          if (p >= 0 === q >= 0) return
          const t = p / (p - q)
          pts.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t])
        }
        cross(a, bb, i, j, i + 1, j)
        cross(bb, c, i + 1, j, i + 1, j + 1)
        cross(c, d, i + 1, j + 1, i, j + 1)
        cross(d, a, i, j + 1, i, j)
        for (let k = 0; k + 1 < pts.length; k += 2) segments.push([pts[k][0] / N, pts[k][1] / N, pts[k + 1][0] / N, pts[k + 1][1] / N])
      }
    return { cells, segments }
    // world.version changes whenever a weight, the network's shape or a test set does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world, world.version, criterion, unit, hideShading])

  const ring = world.ring
  const pending = world.pending ?? world.last
  const proto = showPrototypes ? world.prototypes() : null
  const cw = w / N
  const ch = h / N
  return (
    <svg width="100%" viewBox={`0 0 ${size} ${size}`} style={{ display: 'block', background: 'var(--bg)', borderRadius: 8 }} role="img" aria-label="feature space">
      {cells.map((c) => (
        <rect
          key={c.i * N + c.j}
          x={x(c.i / N)}
          y={y((c.j + 1) / N)}
          width={cw + 0.5}
          height={ch + 0.5}
          fill={unit !== null ? '#b388ff' : c.v >= 0.5 ? KIND_COLORS.happens : KIND_COLORS.doesNot}
          opacity={unit !== null ? 0.06 + 0.5 * c.v : 0.1 + 0.3 * Math.abs(c.v - 0.5) * 2}
        />
      ))}
      <rect x={x(0)} y={y(1)} width={w} height={h} fill="none" stroke={palette.border} />
      {showTest &&
        world.tests.map((t, ti) =>
          Array.from({ length: t.x1.length }, (_, i) => (
            <circle
              key={`t${ti}-${i}`}
              cx={x(t.x1[i])}
              cy={y(t.x2[i])}
              r={2.6}
              fill="none"
              stroke={t.happens[i] ? '#9cc8ff' : '#ffd08a'}
              strokeWidth={1.1}
              opacity={0.9}
            />
          )),
        )}
      {Array.from({ length: ring.count }, (_, i) => (
        <circle
          key={`r${i}`}
          cx={x(ring.x1[i])}
          cy={y(ring.x2[i])}
          r={2.4}
          fill={ring.happens[i] ? KIND_COLORS.happens : KIND_COLORS.doesNot}
          stroke={palette.bg}
          strokeWidth={0.5}
        />
      ))}
      {segments.map((s, i) => (
        <line key={`s${i}`} x1={x(s[0])} y1={y(s[1])} x2={x(s[2])} y2={y(s[3])} stroke="#ffffff" strokeWidth={2} strokeLinecap="round" />
      ))}
      {proto &&
        ([
          ['happens', proto.happens],
          ['doesNot', proto.doesNot],
        ] as const).map(([side, p]) => (
          <g key={side} stroke={side === 'happens' ? '#cfe4ff' : '#ffe2b3'} strokeWidth={3.2} strokeLinecap="round">
            <line x1={x(p[0]) - 8} y1={y(p[1]) - 8} x2={x(p[0]) + 8} y2={y(p[1]) + 8} />
            <line x1={x(p[0]) - 8} y1={y(p[1]) + 8} x2={x(p[0]) + 8} y2={y(p[1]) - 8} />
          </g>
        ))}
      {pending && <circle cx={x(pending.x1)} cy={y(pending.x2)} r={7} fill="none" stroke="#ffffff" strokeWidth={2} />}
      {[0, 0.5, 1].map((v) => (
        <g key={v}>
          <text x={x(v)} y={size - padB + 11} textAnchor="middle" fontSize={8.5} fill={AXIS} fontFamily={MONO}>{v}</text>
          <text x={padL - 4} y={y(v) + 3} textAnchor="end" fontSize={8.5} fill={AXIS} fontFamily={MONO}>{v}</text>
        </g>
      ))}
      <text x={x(0.5)} y={size - 5} textAnchor="middle" fontSize={9} fill={AXIS}>receptor A (x₁) →</text>
      <text x={10} y={y(0.5)} textAnchor="middle" fontSize={9} fill={AXIS} transform={`rotate(-90 10 ${y(0.5)})`}>receptor B (x₂) →</text>
    </svg>
  )
}

/** One hidden unit's own output over the smell space, small: the Playground's best feature. */
export function Thumbnail({ world, unit, size = 40 }: { world: FishWorld; unit: number; size?: number }) {
  const N = 9
  const b = world.brain
  const cells = useMemo(() => {
    const out: number[] = []
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) out.push(hiddenOutputFor(b.circuit, b.receptors, unit, (i + 0.5) / N, (j + 0.5) / N, scratch))
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world, world.version, unit])
  const c = size / N
  return (
    <g>
      <rect width={size} height={size} fill={palette.bg} />
      {cells.map((v, k) => (
        <rect key={k} x={Math.floor(k / N) * c} y={size - ((k % N) + 1) * c} width={c + 0.4} height={c + 0.4} fill="#b388ff" opacity={0.08 + 0.85 * v} />
      ))}
      <rect width={size} height={size} fill="none" stroke={palette.border} />
    </g>
  )
}

/**
 * The hidden-activity space: every recent encounter at its position in the
 * activity of two hidden units, with the output unit's line. §7.2.6's
 * geometric reading: the layer remaps the smells until one line will do.
 */
export function HiddenSpacePlot({ world, a, b, hide, size = 300 }: { world: FishWorld; a: number; b: number; hide: boolean; size?: number }) {
  const padL = 34
  const padB = 30
  const padT = 8
  const padR = 8
  const w = size - padL - padR
  const h = size - padT - padB
  const lo = -0.08
  const hi = 1.08
  const x = (v: number) => padL + ((v - lo) / (hi - lo)) * w
  const y = (v: number) => padT + (1 - (v - lo) / (hi - lo)) * h
  const br = world.brain
  const ring = world.ring
  const hidden = br.circuit.interneurons
  const out = br.circuit.output!
  const at = (x1: number, x2: number): [number, number] => [
    hiddenOutputFor(br.circuit, br.receptors, a, x1, x2, scratch),
    hiddenOutputFor(br.circuit, br.receptors, b, x1, x2, scratch),
  ]
  // The output's line exists in this plane only when these two units are all it reads.
  let line: [number, number, number, number] | null = null
  if (hidden.length === 2 && !hide) {
    const [wa, wb] = [out.weights[a], out.weights[b]]
    const k = world.effectiveCriterion - out.baseline
    if (Math.abs(wb) > 1e-9) line = [lo, (k - wa * lo) / wb, hi, (k - wa * hi) / wb]
    else if (Math.abs(wa) > 1e-9) line = [k / wa, lo, k / wa, hi]
  }
  const kinds = [...world.mix.happens, ...world.mix.doesNot].filter((id) => KINDS[id].typical)
  // Kinds the hidden layer puts on one point share a marker, with their names listed: that they coincide is the observation.
  const markers: { p: [number, number]; happens: boolean; labels: string[] }[] = []
  for (const id of kinds) {
    const k = KINDS[id]
    const p = at(k.typical![0], k.typical![1])
    const near = markers.find((m) => m.happens === k.happens && Math.hypot(m.p[0] - p[0], m.p[1] - p[1]) < 0.08)
    if (near) near.labels.push(k.label)
    else markers.push({ p, happens: k.happens, labels: [k.label] })
  }
  return (
    <svg width="100%" viewBox={`0 0 ${size} ${size}`} style={{ display: 'block', background: 'var(--bg)', borderRadius: 8 }} role="img" aria-label="hidden-activity space">
      <defs>
        <clipPath id="hs-clip">
          <rect x={padL} y={padT} width={w} height={h} />
        </clipPath>
      </defs>
      <rect x={x(0)} y={y(1)} width={x(1) - x(0)} height={y(0) - y(1)} fill="none" stroke={palette.border} />
      {Array.from({ length: ring.count }, (_, i) => {
        const p = at(ring.x1[i], ring.x2[i])
        return <circle key={i} cx={x(p[0])} cy={y(p[1])} r={2.4} fill={ring.happens[i] ? KIND_COLORS.happens : KIND_COLORS.doesNot} opacity={0.75} />
      })}
      {line && <line x1={x(line[0])} y1={y(line[1])} x2={x(line[2])} y2={y(line[3])} stroke="#ffffff" strokeWidth={2} clipPath="url(#hs-clip)" />}
      {markers.map((m) => (
        <g key={m.labels.join('+')}>
          <circle cx={x(m.p[0])} cy={y(m.p[1])} r={6.5} fill={m.happens ? KIND_COLORS.happens : palette.bg} stroke={m.happens ? '#cfe4ff' : KIND_COLORS.doesNot} strokeWidth={2} />
          {m.labels.map((label, i) => (
            <text
              key={label}
              x={x(m.p[0]) + (m.p[0] > 0.6 ? -9 : 9)}
              y={y(m.p[1]) + (m.p[1] > 0.6 ? 12 + 10 * i : -8 - 10 * (m.labels.length - 1 - i))}
              textAnchor={m.p[0] > 0.6 ? 'end' : 'start'}
              fontSize={8.5}
              fill={palette.text}
            >
              {label}
            </text>
          ))}
        </g>
      ))}
      {[0, 1].map((v) => (
        <g key={v}>
          <text x={x(v)} y={size - padB + 11} textAnchor="middle" fontSize={8.5} fill={AXIS} fontFamily={MONO}>{v}</text>
          <text x={padL - 4} y={y(v) + 3} textAnchor="end" fontSize={8.5} fill={AXIS} fontFamily={MONO}>{v}</text>
        </g>
      ))}
      <text x={x(0.5)} y={size - 5} textAnchor="middle" fontSize={9} fill={AXIS}>output of hidden unit {a + 1} →</text>
      <text x={10} y={y(0.5)} textAnchor="middle" fontSize={9} fill={AXIS} transform={`rotate(-90 10 ${y(0.5)})`}>output of hidden unit {b + 1} →</text>
    </svg>
  )
}

/**
 * The learning curve: percent wrong on recent training encounters and on
 * each test set, against encounters.
 */
export function LearningCurve({ world, width = 300, height = 150 }: { world: FishWorld; width?: number; height?: number }) {
  const padL = 30
  const padB = 22
  const padT = 8
  const padR = 8
  const pts = world.curve
  const xMax = Math.max(100, world.encounters)
  const x = (v: number) => padL + (v / xMax) * (width - padL - padR)
  const y = (v: number) => padT + (1 - v / 100) * (height - padT - padB)
  const line = (get: (p: (typeof pts)[number]) => number) => pts.map((p) => `${x(p.encounter).toFixed(1)},${y(get(p)).toFixed(1)}`).join(' ')
  const series = [
    { label: 'recent training encounters', color: CURVE_COLORS[0], points: line((p) => p.train), now: pts.length ? pts[pts.length - 1].train : null },
    ...world.tests.map((t, i) => ({
      label: t.label,
      color: CURVE_COLORS[1 + (i % 2)],
      points: line((p) => p.test[i] ?? 0),
      now: 100 - world.testAccuracy(t),
    })),
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <svg width="100%" viewBox={`0 0 ${width} ${height}`} style={{ display: 'block', background: 'var(--bg)', borderRadius: 8 }} role="img" aria-label="learning curve">
        {[0, 25, 50, 75, 100].map((v) => (
          <g key={v}>
            <line x1={padL} x2={width - padR} y1={y(v)} y2={y(v)} stroke={palette.border} strokeDasharray={v === 50 ? '3 3' : undefined} opacity={v === 0 || v === 50 ? 1 : 0.4} />
            <text x={padL - 4} y={y(v) + 3} textAnchor="end" fontSize={8} fill={AXIS} fontFamily={MONO}>{v}</text>
          </g>
        ))}
        {series.map((s) => (
          <polyline key={s.label} points={s.points} fill="none" stroke={s.color} strokeWidth={1.6} strokeLinejoin="round" />
        ))}
        <text x={padL} y={height - 5} fontSize={8} fill={AXIS} fontFamily={MONO}>0</text>
        <text x={width - padR} y={height - 5} textAnchor="end" fontSize={8} fill={AXIS} fontFamily={MONO}>{xMax} encounters</text>
        <text x={padL + 3} y={padT + 8} fontSize={8} fill={AXIS}>↑ percent wrong</text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 10.5, color: 'var(--text-muted)' }}>
        {series.map((s) => (
          <span key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 12, height: 3, background: s.color, display: 'inline-block' }} />
            <span style={{ flex: 1 }}>percent wrong, {s.label}</span>
            <span style={{ fontFamily: MONO, color: 'var(--text)' }}>{s.now === null ? '—' : `${s.now.toFixed(1)}%`}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

/**
 * The evidence panel, the chapter's `f-sdt` made live: one histogram of the
 * output's evidence on test encounters where the outcome happened, one where
 * it did not, and the criterion as a vertical line. Moving the criterion
 * slides the line and leaves both histograms, and d′, exactly still.
 */
export function EvidencePlot({ world, width = 320, height = 190 }: { world: FishWorld; width?: number; height?: number }) {
  const padL = 10
  const padR = 10
  const padT = 22
  const padB = 24
  const set = world.tests[0]
  const criterion = world.effectiveCriterion
  const data = useMemo(() => {
    const ev = world.testEvidence(set)
    const present: number[] = []
    const absent: number[] = []
    for (let i = 0; i < ev.length; i++) (set.happens[i] ? present : absent).push(ev[i])
    return { present, absent }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world, world.version, set])
  const all = [...data.present, ...data.absent]
  const mP = moments(data.present)
  const mA = moments(data.absent)
  const spread = Math.sqrt((mP.variance + mA.variance) / 2) || 0.5
  const centre = (mP.mean + mA.mean) / 2
  const half = Math.max(2 * spread + Math.abs(mP.mean - mA.mean) / 2 + spread, Math.abs(criterion - centre) + 0.3 * spread, 0.4)
  const lo = centre - half
  const hi = centre + half
  const BINS = 36
  const bin = (v: number) => Math.max(0, Math.min(BINS - 1, Math.floor(((v - lo) / (hi - lo)) * BINS)))
  const hist = (vals: number[]) => {
    const out = new Array<number>(BINS).fill(0)
    for (const v of vals) out[bin(v)]++
    return out
  }
  const hP = hist(data.present)
  const hA = hist(data.absent)
  const top = Math.max(1, ...hP, ...hA)
  const x = (v: number) => padL + ((v - lo) / (hi - lo)) * (width - padL - padR)
  const y = (n: number) => padT + (1 - n / top) * (height - padT - padB)
  const bw = (width - padL - padR) / BINS
  const words = OUTCOME_WORDS[world.route]
  const d = all.length ? dPrimeOf(data.present, data.absent) : 0
  const cx = Math.max(padL, Math.min(width - padR, x(criterion)))
  const bars = (h: number[], color: string, shadeRight: boolean) =>
    h.map((n, k) => {
      const left = lo + (k / BINS) * (hi - lo)
      const right = left + (hi - lo) / BINS
      const beyond = shadeRight && right > criterion
      return n === 0 ? null : (
        <rect key={k} x={padL + k * bw} y={y(n)} width={bw - 0.6} height={y(0) - y(n)} fill={color} opacity={beyond ? 0.85 : 0.3} />
      )
    })
  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} style={{ display: 'block', background: 'var(--bg)', borderRadius: 8 }} role="img" aria-label="evidence">
      {bars(hA, KIND_COLORS.doesNot, true)}
      {bars(hP, KIND_COLORS.happens, true)}
      <line x1={padL} x2={width - padR} y1={y(0)} y2={y(0)} stroke={palette.border} />
      {[
        [mA.mean, KIND_COLORS.doesNot],
        [mP.mean, KIND_COLORS.happens],
      ].map(([m, c], i) => (
        <line key={i} x1={x(m as number)} x2={x(m as number)} y1={padT - 4} y2={y(0)} stroke={c as string} strokeDasharray="2 3" opacity={0.9} />
      ))}
      <line x1={x(mA.mean)} x2={x(mP.mean)} y1={padT - 6} y2={padT - 6} stroke={palette.text} strokeWidth={1.2} />
      <text x={(x(mA.mean) + x(mP.mean)) / 2} y={padT - 10} textAnchor="middle" fontSize={10} fill={palette.text} fontFamily={MONO}>
        d′ = {d.toFixed(2)}
      </text>
      <line x1={cx} x2={cx} y1={padT - 2} y2={height - padB + 4} stroke="#ffffff" strokeWidth={2} />
      <text x={cx} y={height - padB + 13} textAnchor="middle" fontSize={9} fill="#ffffff">criterion {fmt(criterion)}</text>
      <text x={padL} y={height - 3} fontSize={8.5} fill={KIND_COLORS.doesNot}>{words.doesNot}</text>
      <text x={width - padR} y={height - 3} textAnchor="end" fontSize={8.5} fill={KIND_COLORS.happens}>{words.happens}</text>
      <text x={width / 2} y={height - 3} textAnchor="middle" fontSize={8.5} fill={AXIS}>evidence →</text>
    </svg>
  )
}

/** Energy per 100 encounters against the criterion, one point per press of *Score this criterion*. */
export function EnergyPlot({ points, width = 320, height = 130 }: { points: { criterion: number; energy: number }[]; width?: number; height?: number }) {
  const padL = 38
  const padR = 8
  const padT = 8
  const padB = 22
  const xs = points.map((p) => p.criterion)
  const ys = points.map((p) => p.energy)
  const xLo = Math.min(-1, ...xs)
  const xHi = Math.max(1, ...xs)
  const yLo = Math.min(0, ...ys)
  const yHi = Math.max(1, ...ys)
  const x = (v: number) => padL + ((v - xLo) / (xHi - xLo)) * (width - padL - padR)
  const y = (v: number) => padT + (1 - (v - yLo) / (yHi - yLo || 1)) * (height - padT - padB)
  const best = points.length ? points.reduce((a, b) => (b.energy > a.energy ? b : a)) : null
  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} style={{ display: 'block', background: 'var(--bg)', borderRadius: 8 }} role="img" aria-label="energy against criterion">
      <line x1={padL} x2={width - padR} y1={y(0)} y2={y(0)} stroke={palette.border} />
      <line x1={x(0)} x2={x(0)} y1={padT} y2={height - padB} stroke={palette.border} strokeDasharray="3 3" />
      {points.map((p, i) => (
        <circle key={i} cx={x(p.criterion)} cy={y(p.energy)} r={p === best ? 5 : 3.5} fill={p === best ? '#ffffff' : palette.accent} stroke={palette.bg} />
      ))}
      {[yLo, yHi].map((v) => (
        <text key={v} x={padL - 4} y={y(v) + 3} textAnchor="end" fontSize={8} fill={AXIS} fontFamily={MONO}>{v.toFixed(0)}</text>
      ))}
      {[xLo, 0, xHi].map((v) => (
        <text key={v} x={x(v)} y={height - padB + 10} textAnchor="middle" fontSize={8} fill={AXIS} fontFamily={MONO}>{fmt(v)}</text>
      ))}
      <text x={x(xLo)} y={height - 3} fontSize={8} fill={AXIS}>← liberal</text>
      <text x={width / 2} y={height - 3} textAnchor="middle" fontSize={8} fill={AXIS}>criterion</text>
      <text x={width - padR} y={height - 3} textAnchor="end" fontSize={8} fill={AXIS}>conservative →</text>
      {points.length === 0 && (
        <text x={width / 2} y={height / 2} textAnchor="middle" fontSize={10} fill={AXIS}>No criterion scored yet.</text>
      )}
    </svg>
  )
}

/**
 * The network, drawn the way the Playground draws one: receptors on the
 * left, hidden units in the middle each showing its own output over the
 * smell space, the output unit, the routing switch, the verdict. Green is
 * excitatory, red inhibitory, thickness is strength — Lab 4's convention.
 *
 * With `hide`, the structure is drawn and every number and thumbnail is
 * withheld, for the four fish of Part 2.
 */
export function NetworkDiagram({
  world,
  hide,
  hoverUnit,
  onHover,
  routeLabel,
}: {
  world: FishWorld
  hide: boolean
  hoverUnit: number | null
  onHover: (unit: number | null) => void
  routeLabel: string
}) {
  const b = world.brain
  const c = b.circuit
  const out = c.output!
  const labels = inputLabels(b.receptors)
  const n = labels.length
  const shown = Math.min(c.interneurons.length, 8)
  const more = c.interneurons.length - shown
  const W = 340
  const T = 40
  const rows = Math.max(n, shown, 3)
  const H = Math.max(230, 44 + rows * 58)
  const IN_X = 50
  const HID_X = 150
  const OUT_X = shown > 0 ? 276 : 226
  const rowY = (i: number, count: number) => 22 + ((i + 0.5) * (H - 34)) / Math.max(1, count)
  const OUT_Y = Math.min(H / 2 - 6, H - 96)
  const stroke = (w: number) => (w >= 0 ? '#34d399' : '#f87171')
  const thick = (w: number) => (hide ? 1.4 : 0.6 + Math.min(6, Math.abs(w) * 1.1))
  const e = world.pending ?? world.last
  const live = !hide && e !== null
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', background: 'var(--bg)', borderRadius: 8 }} role="img" aria-label="network">
      {/* connections */}
      {shown > 0
        ? c.interneurons.slice(0, shown).map((u, j) => (
            <g key={`h${j}`}>
              {u.weights.map((w, i) => (
                <line key={i} x1={IN_X + 14} y1={rowY(i, n)} x2={HID_X} y2={rowY(j, shown) } stroke={hide ? AXIS : stroke(w)} strokeWidth={thick(w)} opacity={hide ? 0.5 : Math.abs(w) < 0.05 ? 0.15 : 0.8} />
              ))}
              <line x1={HID_X + T} y1={rowY(j, shown)} x2={OUT_X - 16} y2={OUT_Y} stroke={hide ? AXIS : stroke(out.weights[j])} strokeWidth={thick(out.weights[j])} opacity={hide ? 0.5 : Math.abs(out.weights[j]) < 0.05 ? 0.15 : 0.8} />
            </g>
          ))
        : out.weights.map((w, i) => (
            <line key={i} x1={IN_X + 14} y1={rowY(i, n)} x2={OUT_X - 16} y2={OUT_Y} stroke={hide ? AXIS : stroke(w)} strokeWidth={thick(w)} opacity={hide ? 0.5 : Math.abs(w) < 0.05 ? 0.2 : 0.85} />
          ))}
      {/* receptors: A and B round, a built-in receptor square */}
      {labels.map((label, i) => {
        const builtIn = !(b.receptors.raw && i < 2)
        const yy = rowY(i, n)
        return (
          <g key={label}>
            {builtIn ? (
              <rect x={IN_X - 13} y={yy - 13} width={26} height={26} rx={3} fill={palette.surface2} stroke="#ffd166" strokeWidth={2} strokeDasharray="4 2" />
            ) : (
              <circle cx={IN_X} cy={yy} r={14} fill={palette.surface2} stroke={palette.sensor} strokeWidth={2} />
            )}
            <text x={IN_X} y={yy + 3.5} textAnchor="middle" fontSize={10} fill={palette.text} fontFamily={MONO}>
              {live ? (b.x[i] ?? 0).toFixed(2) : builtIn ? '' : i === 0 ? 'A' : 'B'}
            </text>
            <text x={IN_X} y={yy - 18} textAnchor="middle" fontSize={8.5} fill={builtIn ? '#ffd166' : AXIS}>
              {builtIn ? `${label} (built in)` : label}
            </text>
          </g>
        )
      })}
      {/* hidden units, each with its thumbnail */}
      {c.interneurons.slice(0, shown).map((_, j) => {
        const yy = rowY(j, shown)
        return (
          <g
            key={`u${j}`}
            transform={`translate(${HID_X}, ${yy - T / 2})`}
            onMouseEnter={() => onHover(j)}
            onMouseLeave={() => onHover(null)}
            style={{ cursor: 'pointer' }}
          >
            {hide ? <rect width={T} height={T} fill={palette.surface2} stroke={palette.border} /> : <Thumbnail world={world} unit={j} size={T} />}
            <rect width={T} height={T} fill="none" stroke={hoverUnit === j ? '#ffffff' : '#b388ff'} strokeWidth={hoverUnit === j ? 2.5 : 1.5} />
            <text x={-4} y={-3} fontSize={8} fill={AXIS}>{j + 1}</text>
            {live && (
              <text x={T / 2} y={T + 10} textAnchor="middle" fontSize={8.5} fill={palette.text} fontFamily={MONO}>{(b.h[j] ?? 0).toFixed(2)}</text>
            )}
          </g>
        )
      })}
      {more > 0 && (
        <text x={HID_X + T / 2} y={H - 3} textAnchor="middle" fontSize={9} fill={palette.text}>
          and {more} more
        </text>
      )}
      {c.interneurons.length > 0 && (
        <text x={HID_X + T / 2} y={12} textAnchor="middle" fontSize={9} fill="#b388ff">hidden layer</text>
      )}
      {/* output unit */}
      <circle cx={OUT_X} cy={OUT_Y} r={16} fill={palette.surface2} stroke={palette.accent} strokeWidth={2.5} />
      <text x={OUT_X} y={OUT_Y + 3.5} textAnchor="middle" fontSize={10} fill={palette.text} fontFamily={MONO}>
        {live ? e!.evidence.toFixed(2) : 'out'}
      </text>
      <text x={OUT_X} y={OUT_Y - 21} textAnchor="middle" fontSize={8.5} fill={AXIS}>output unit{live ? ': evidence' : ''}</text>
      {/* routing switch and verdict */}
      <line x1={OUT_X} y1={OUT_Y + 16} x2={OUT_X} y2={H - 44} stroke={AXIS} strokeWidth={1.5} />
      <rect x={OUT_X - 44} y={H - 44} width={88} height={18} rx={9} fill={palette.surface2} stroke={AXIS} />
      <text x={OUT_X} y={H - 31.5} textAnchor="middle" fontSize={8.5} fill={palette.text}>routing switch (locked)</text>
      <text x={OUT_X} y={H - 12} textAnchor="middle" fontSize={10} fill={e && e.verdict ? palette.accent : AXIS} fontWeight={600}>
        → {routeLabel}
        {e ? (e.verdict ? ': yes' : ': no') : ''}
      </text>
    </svg>
  )
}
