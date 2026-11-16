import { useEffect, useMemo, useRef } from 'react'
import { spectrogram, type Spectrogram as Sg, type View } from '../../sim/language/audio/spectrogram'

/**
 * The spectrogram component (spec §3): the short-time Fourier transform of
 * a shipped sound, drawn with a waveform above it, a cursor that moves with
 * playback, and overlays (formant tracks, boundaries, labels, highlights).
 * Two views, wide bands (the default) and narrow bands; the same code
 * (`sim/language/audio/spectrogram.ts`) computes the classifier's input.
 *
 * The color map runs from the theme's background through blue to white,
 * so that energy is bright on the dark theme (checked by eye on the walk).
 */

export interface Track {
  label: string
  color: string
  /** Points as [seconds, hertz]; a null hertz breaks the line. */
  points: [number, number | null][]
}

export interface Mark {
  atS: number
  label?: string
  color?: string
}

export interface Highlight {
  fromS: number
  toS: number
  color: string
  label?: string
}

export interface SpectrogramProps {
  samples: Float32Array | null
  sampleRate: number
  view: View
  width?: number
  height?: number
  maxHz?: number
  /** The cursor's position in seconds, or null. */
  cursorS?: number | null
  tracks?: Track[]
  marks?: Mark[]
  highlights?: Highlight[]
  /** Horizontal lines at these frequencies, labeled: the synthesizer's settings on Step 1. */
  frequencyLines?: { hz: number; label: string; color?: string }[]
  /** Hide the waveform strip. */
  noWaveform?: boolean
  testId?: string
}

const FLOOR = -70

function colorOf(db: number): [number, number, number] {
  // 0 at the floor, 1 at the loudest point.
  const t = Math.min(1, Math.max(0, (db - FLOOR) / -FLOOR))
  // background (11, 16, 32) → blue (79, 156, 255) → white.
  if (t < 0.6) {
    const u = t / 0.6
    return [11 + (79 - 11) * u, 16 + (156 - 16) * u, 32 + (255 - 32) * u]
  }
  const u = (t - 0.6) / 0.4
  return [79 + (255 - 79) * u, 156 + (255 - 156) * u, 255]
}

export function Spectrogram({ samples, sampleRate, view, width = 520, height = 220, maxHz = 5000, cursorS = null, tracks, marks, highlights, frequencyLines, noWaveform, testId }: SpectrogramProps) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const sg: Sg | null = useMemo(() => (samples ? spectrogram(samples, sampleRate, view, 0.001, maxHz) : null), [samples, sampleRate, view, maxHz])
  const waveH = noWaveform ? 0 : 36
  const pad = { l: 44, r: 8, t: 6, b: 22 }
  const plotW = width - pad.l - pad.r
  const plotH = height - pad.t - pad.b - waveH
  const duration = samples ? samples.length / sampleRate : 1
  const X = (s: number) => pad.l + (s / duration) * plotW
  const Y = (hz: number) => pad.t + waveH + plotH - (hz / maxHz) * plotH

  useEffect(() => {
    const c = canvas.current
    if (!c) return
    const g = c.getContext('2d')
    if (!g) return
    g.fillStyle = '#0b1020'
    g.fillRect(0, 0, width, height)
    if (!sg || !samples) return
    // The spectrogram, one image column per frame.
    const img = g.createImageData(Math.max(1, Math.round(plotW)), Math.max(1, Math.round(plotH)))
    const cols = img.width
    const rows = img.height
    for (let x = 0; x < cols; x++) {
      const f = Math.min(sg.frames - 1, Math.floor((x / cols) * sg.frames))
      for (let y = 0; y < rows; y++) {
        const hz = ((rows - 1 - y) / rows) * maxHz
        const b = Math.min(sg.bins - 1, Math.floor(hz / sg.binHz))
        const [r, gg, bb] = colorOf(sg.db[f * sg.bins + b])
        const i = (y * cols + x) * 4
        img.data[i] = r
        img.data[i + 1] = gg
        img.data[i + 2] = bb
        img.data[i + 3] = 255
      }
    }
    g.putImageData(img, pad.l, pad.t + waveH)
    // The waveform.
    if (!noWaveform) {
      g.strokeStyle = '#9aa6b8'
      g.lineWidth = 1
      g.beginPath()
      const mid = pad.t + waveH / 2
      const step = Math.max(1, Math.floor(samples.length / plotW))
      for (let x = 0; x < plotW; x++) {
        const i = Math.floor((x / plotW) * samples.length)
        let lo = 1
        let hi = -1
        for (let k = i; k < Math.min(samples.length, i + step); k++) {
          if (samples[k] < lo) lo = samples[k]
          if (samples[k] > hi) hi = samples[k]
        }
        g.moveTo(pad.l + x, mid - hi * (waveH / 2 - 2))
        g.lineTo(pad.l + x, mid - lo * (waveH / 2 - 2))
      }
      g.stroke()
    }
    // Axes.
    g.fillStyle = '#9aa6b8'
    g.font = '10px system-ui'
    g.textAlign = 'right'
    for (let hz = 0; hz <= maxHz; hz += 1000) {
      g.fillText(`${hz}`, pad.l - 4, Y(hz) + 3)
      g.fillStyle = 'rgba(154,166,184,0.25)'
      g.fillRect(pad.l, Y(hz), plotW, 1)
      g.fillStyle = '#9aa6b8'
    }
    g.save()
    g.translate(10, pad.t + waveH + plotH / 2)
    g.rotate(-Math.PI / 2)
    g.textAlign = 'center'
    g.fillText('frequency (Hz)', 0, 0)
    g.restore()
    g.textAlign = 'center'
    const tick = duration > 2 ? 0.5 : duration > 0.8 ? 0.1 : 0.05
    for (let s = 0; s <= duration + 1e-9; s += tick) g.fillText(`${s.toFixed(tick < 0.1 ? 2 : 1)}`, X(s), height - 8)
    g.fillText('time (s)', pad.l + plotW / 2, height - 0)
  }, [sg, samples, width, height, maxHz, noWaveform, plotW, plotH, waveH, pad.l, pad.t, duration])

  return (
    <div style={{ position: 'relative', width, height }} data-spectrogram={testId ?? view} data-view={view}>
      <canvas ref={canvas} width={width} height={height} style={{ display: 'block', borderRadius: 8 }} />
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }}>
        {highlights?.map((h, i) => (
          <g key={i}>
            <rect x={X(h.fromS)} y={pad.t + waveH} width={X(h.toS) - X(h.fromS)} height={plotH} fill={h.color} opacity={0.22} />
            {h.label && (
              <text x={(X(h.fromS) + X(h.toS)) / 2} y={pad.t + waveH + 12} fontSize={10} textAnchor="middle" fill={h.color}>
                {h.label}
              </text>
            )}
          </g>
        ))}
        {frequencyLines?.map((f) => (
          <g key={f.label} data-frequency-line={f.label}>
            <line x1={pad.l} y1={Y(f.hz)} x2={width - pad.r} y2={Y(f.hz)} stroke={f.color ?? 'var(--sensor)'} strokeDasharray="4 3" />
            <text x={width - pad.r - 2} y={Y(f.hz) - 3} fontSize={10} textAnchor="end" fill={f.color ?? 'var(--sensor)'}>
              {f.label}
            </text>
          </g>
        ))}
        {tracks?.map((t) => {
          const segs: string[] = []
          let cur: string[] = []
          for (const [s, hz] of t.points) {
            if (hz === null) {
              if (cur.length) segs.push(cur.join(' '))
              cur = []
            } else cur.push(`${X(s)},${Y(hz)}`)
          }
          if (cur.length) segs.push(cur.join(' '))
          return (
            <g key={t.label} data-track={t.label}>
              {segs.map((p, i) => (
                <polyline key={i} points={p} fill="none" stroke={t.color} strokeWidth={2} />
              ))}
            </g>
          )
        })}
        {marks?.map((m, i) => (
          <g key={i} data-mark={m.label ?? i}>
            <line x1={X(m.atS)} y1={pad.t + waveH} x2={X(m.atS)} y2={pad.t + waveH + plotH} stroke={m.color ?? 'var(--avoid)'} strokeWidth={1.2} />
            {m.label && (
              <text x={X(m.atS) + 2} y={pad.t + waveH + 10} fontSize={9} fill={m.color ?? 'var(--avoid)'}>
                {m.label}
              </text>
            )}
          </g>
        ))}
        {cursorS !== null && cursorS >= 0 && cursorS <= duration && <line data-cursor x1={X(cursorS)} y1={pad.t} x2={X(cursorS)} y2={pad.t + waveH + plotH} stroke="#ffffff" strokeWidth={1.5} />}
      </svg>
    </div>
  )
}
