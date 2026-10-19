import { useEffect, useRef } from 'react'
import { N } from '../../sim/rodent/spatial/ring'
import type { FiringMaps } from '../../sim/rodent/firingMap'
import { deg } from '../../sim/rodent/spatial/angles'

/**
 * The instruments of Part 3's recording panel (spec §9): the two rings
 * with their bumps, head-direction polar plots, firing maps as heat
 * squares with the rat's true path faintly beneath, and the border cells.
 * All of it reads the session; none of it writes.
 */

/** Two rings drawn as circles of bars, each unit's rate as the bar's length, with the decoded bump marked. */
export function Rings({ lower, upper, lowerHeading, upperHeading, lowerStrength, upperStrength, size = 150 }: { lower: Float64Array; upper: Float64Array; lowerHeading: number; upperHeading: number; lowerStrength: number; upperStrength: number; size?: number }) {
  const ring = (rates: Float64Array, heading: number, strength: number, label: string) => {
    const c = size / 2
    const r0 = size * 0.26
    const bars: string[] = []
    for (let j = 0; j < N; j++) {
      const a = (2 * Math.PI * j) / N
      const len = size * 0.2 * Math.max(0.02, rates[j])
      bars.push(`M${(c + r0 * Math.cos(a)).toFixed(1)},${(c - r0 * Math.sin(a)).toFixed(1)}L${(c + (r0 + len) * Math.cos(a)).toFixed(1)},${(c - (r0 + len) * Math.sin(a)).toFixed(1)}`)
    }
    const hx = c + (r0 - 10) * Math.cos(heading)
    const hy = c - (r0 - 10) * Math.sin(heading)
    return (
      <svg key={label} width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block', background: 'var(--bg)', borderRadius: 8 }} role="img" aria-label={label} data-ring={label}>
        <circle cx={c} cy={c} r={r0} fill="none" stroke="var(--border)" />
        <path d={bars.join(' ')} stroke="var(--accent)" strokeWidth={2.2} strokeLinecap="round" fill="none" />
        {strength > 0.3 && <line x1={c} y1={c} x2={hx} y2={hy} stroke="var(--sensor)" strokeWidth={2} />}
        <text x={6} y={12} fontSize={10} fill="var(--text-muted)">
          {label}
        </text>
        <text x={size - 6} y={size - 6} fontSize={9} textAnchor="end" fill="var(--text-muted)">
          {strength > 0.3 ? `bump at ${((Math.round(deg(heading)) % 360) + 360) % 360}°` : 'no bump'}
        </text>
      </svg>
    )
  }
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {ring(lower, lowerHeading, lowerStrength, 'lower ring')}
      {ring(upper, upperHeading, upperStrength, 'upper ring')}
    </div>
  )
}

/** A head-direction cell's firing by heading: a polar plot, the lobe pointing where the cell prefers. */
export function PolarPlot({ rates, label, size = 72, preferred }: { rates: number[]; label: string; size?: number; preferred?: number }) {
  const c = size / 2
  const max = Math.max(1e-6, ...rates)
  const pts = rates.map((r, i) => {
    const a = ((i + 0.5) * 2 * Math.PI) / rates.length
    const rr = (r / max) * (c - 6)
    return `${(c + rr * Math.cos(a)).toFixed(1)},${(c - rr * Math.sin(a)).toFixed(1)}`
  })
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block', background: 'var(--bg)', borderRadius: 6 }} role="img" aria-label={label} data-polar={label}>
      <circle cx={c} cy={c} r={c - 6} fill="none" stroke="var(--border)" />
      <polygon points={pts.join(' ')} fill="rgba(79,156,255,0.45)" stroke="var(--accent)" strokeWidth={1} />
      {preferred !== undefined && <line x1={c} y1={c} x2={c + (c - 8) * Math.cos(preferred)} y2={c - (c - 8) * Math.sin(preferred)} stroke="var(--sensor)" strokeWidth={1} strokeDasharray="2 2" />}
      <text x={3} y={9} fontSize={8} fill="var(--text-muted)">
        {label}
      </text>
      <text x={size - 3} y={size - 3} fontSize={8} textAnchor="end" fill="var(--text-muted)">
        {`${max.toFixed(0)} Hz`}
      </text>
    </svg>
  )
}

/** Blue-black to yellow-white: a heat map's colors, legible on the dark theme. */
function heat(v: number): [number, number, number] {
  const t = Math.max(0, Math.min(1, v))
  const r = Math.round(255 * Math.min(1, t * 1.6))
  const g = Math.round(255 * Math.max(0, Math.min(1, (t - 0.25) * 1.5)))
  const b = Math.round(255 * (t < 0.5 ? 0.35 + t : Math.max(0, 1.4 - t * 1.4)))
  return [r, g, b]
}

/** A firing map as a heat square, the rat's true path faintly beneath where the rat has been. */
export function HeatMap({ map, nx, ny, size = 96, label, peakLabel = true }: { map: Float32Array; nx: number; ny: number; size?: number; label: string; peakLabel?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null)
  let peak = 0
  for (const v of map) if (Number.isFinite(v) && v > peak) peak = v
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const ctx = c.getContext('2d')
    if (!ctx) return
    const img = ctx.createImageData(nx, ny)
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const v = map[j * nx + i]
        // Canvas rows run top to bottom; the room's +y is north, drawn at the top.
        const k = 4 * ((ny - 1 - j) * nx + i)
        if (!Number.isFinite(v)) {
          img.data[k] = 14
          img.data[k + 1] = 20
          img.data[k + 2] = 32
          img.data[k + 3] = 255
          continue
        }
        const [r, g, b] = heat(peak > 0 ? v / peak : 0)
        img.data[k] = Math.max(r, 30)
        img.data[k + 1] = Math.max(g, 34)
        img.data[k + 2] = Math.max(b, 50)
        img.data[k + 3] = 255
      }
    }
    ctx.putImageData(img, 0, 0)
  }, [map, nx, ny, peak])
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }} data-heatmap={label}>
      <canvas ref={ref} width={nx} height={ny} style={{ width: size, height: (size * ny) / nx, imageRendering: 'pixelated', borderRadius: 4, border: '1px solid var(--border)' }} role="img" aria-label={label} />
      <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', whiteSpace: 'pre' }}>{`${label.padEnd(10)}${peakLabel ? `${peak.toFixed(0).padStart(3)} Hz` : ''}`}</div>
    </div>
  )
}

/** A row of a session's maps for a set of cell keys. */
export function MapRow({ maps, keys, labels, size }: { maps: FiringMaps; keys: string[]; labels: string[]; size?: number }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {keys.map((k, i) => (
        <HeatMap key={k} map={maps.rateMap(k)} nx={maps.nx} ny={maps.ny} label={labels[i]} size={size} />
      ))}
    </div>
  )
}
