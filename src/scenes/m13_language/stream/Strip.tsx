import { useEffect, useRef } from 'react'
import type { Spectrogram } from '../../../sim/language/audio/spectrogram'
import type { Stream, Syllable, Word } from '../../../sim/language/stream/language'
import { WORD_COLORS } from '../../../sim/language/stream/board'

/**
 * The scrolling spectrogram under a cursor (spec §6.1): a window of
 * WINDOW_S seconds of the stream, drawn from the twelve syllables' own
 * spectrograms in the student's order, with the moment being played at the
 * center. The cursor's position comes from the audio clock, read on every
 * frame by the caller. In the marked replay, thin lines mark word
 * boundaries, and the syllable strip above fills in as the sound plays,
 * each word in its own color with its own pattern.
 */
export const WINDOW_S = 4

const FLOOR = -70
function colorOf(db: number): [number, number, number] {
  const t = Math.min(1, Math.max(0, (db - FLOOR) / -FLOOR))
  if (t < 0.6) {
    const u = t / 0.6
    return [11 + 68 * u, 16 + 140 * u, 32 + 223 * u]
  }
  const u = (t - 0.6) / 0.4
  return [79 + 176 * u, 156 + 99 * u, 255]
}

export function pattern(p: (typeof WORD_COLORS)[Word]['pattern']): string {
  switch (p) {
    case 'stripes':
      return 'repeating-linear-gradient(45deg, rgba(0,0,0,0.35) 0 3px, transparent 3px 7px)'
    case 'dots':
      return 'radial-gradient(rgba(0,0,0,0.45) 1.5px, transparent 1.6px)'
    case 'rings':
      return 'radial-gradient(circle, transparent 2px, rgba(0,0,0,0.4) 2.5px, transparent 3.5px)'
    case 'checks':
      return 'repeating-conic-gradient(rgba(0,0,0,0.35) 0 25%, transparent 0 50%)'
    case 'waves':
      return 'repeating-linear-gradient(0deg, rgba(0,0,0,0.35) 0 2px, transparent 2px 6px)'
    default:
      return 'none'
  }
}

export function Tile({ text, word, highlighted, onClick, small, draggable, onDragStart, title }: { text: string; word?: Word | null; highlighted?: boolean; onClick?: () => void; small?: boolean; draggable?: boolean; onDragStart?: (e: React.DragEvent) => void; title?: string }) {
  const c = word ? WORD_COLORS[word] : null
  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => (e.key === 'Enter' || e.key === ' ' ? onClick() : undefined) : undefined}
      draggable={draggable}
      onDragStart={onDragStart}
      title={title}
      data-tile={text}
      data-word={word ?? undefined}
      data-highlighted={highlighted || undefined}
      style={{
        width: small ? 26 : 30,
        height: small ? 20 : 24,
        lineHeight: small ? '20px' : '24px',
        textAlign: 'center',
        fontSize: small ? 10 : 11,
        fontFamily: 'var(--font-mono)',
        borderRadius: 4,
        border: `2px solid ${highlighted ? '#ffffff' : 'var(--border)'}`,
        backgroundColor: c ? c.fill : 'var(--surface-2)',
        backgroundImage: c ? pattern(c.pattern) : undefined,
        backgroundSize: c && c.pattern === 'dots' ? '6px 6px' : c && c.pattern === 'rings' ? '9px 9px' : c && c.pattern === 'checks' ? '8px 8px' : undefined,
        color: c ? '#0b111c' : 'var(--text)',
        fontWeight: c ? 600 : 400,
        cursor: onClick || draggable ? 'pointer' : 'default',
        userSelect: 'text',
      }}
    >
      {text}
    </div>
  )
}

export function Strip({ stream, n, spectrograms, cursorS, marks, marked, width = 620, height = 150 }: { stream: Stream; n: number; spectrograms: Map<Syllable, Spectrogram>; cursorS: number | null; marks: { startS: number; endS: number }[]; marked: boolean; width?: number; height?: number }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const images = useRef<Map<Syllable, ImageData> | null>(null)
  const pxPerS = width / WINDOW_S
  useEffect(() => {
    // Each syllable's image once, at the strip's scale.
    const c = canvas.current
    if (!c) return
    const g = c.getContext('2d')
    if (!g) return
    const map = new Map<Syllable, ImageData>()
    for (const [s, sg] of spectrograms) {
      const w = Math.max(1, Math.round(sg.frames * sg.hopS * pxPerS))
      const img = g.createImageData(w, height)
      for (let x = 0; x < w; x++) {
        const f = Math.min(sg.frames - 1, Math.floor((x / w) * sg.frames))
        for (let y = 0; y < height; y++) {
          const hz = ((height - 1 - y) / height) * 5000
          const b = Math.min(sg.bins - 1, Math.floor(hz / sg.binHz))
          const [r, gg, bb] = colorOf(sg.db[f * sg.bins + b])
          const i = (y * w + x) * 4
          img.data[i] = r
          img.data[i + 1] = gg
          img.data[i + 2] = bb
          img.data[i + 3] = 255
        }
      }
      map.set(s, img)
    }
    images.current = map
  }, [spectrograms, height, pxPerS])
  useEffect(() => {
    const c = canvas.current
    const imgs = images.current
    if (!c || !imgs) return
    const g = c.getContext('2d')
    if (!g) return
    g.fillStyle = '#0b1020'
    g.fillRect(0, 0, width, height)
    const t = cursorS ?? 0
    const left = t - WINDOW_S / 2
    for (let i = 0; i < Math.min(n, marks.length); i++) {
      const m = marks[i]
      if (m.endS < left || m.startS > left + WINDOW_S) continue
      const img = imgs.get(stream.syllables[i])
      if (!img) continue
      const x = Math.round((m.startS - left) * pxPerS)
      g.putImageData(img, x, 0)
      if (marked && stream.position[i] === 0) {
        g.fillStyle = 'rgba(255,255,255,0.8)'
        g.fillRect(x, 0, 1, height)
      }
    }
    // The cursor at the center.
    g.fillStyle = '#ffffff'
    g.fillRect(Math.round(width / 2), 0, 2, height)
  }, [cursorS, n, marks, stream, width, height, pxPerS, marked])
  return <canvas ref={canvas} width={width} height={height} style={{ display: 'block', borderRadius: 8 }} data-strip={marked ? 'marked' : 'plain'} />
}

/** The syllable strip above the spectrogram in the marked replay: tiles fill in as the sound plays, each word in its color. */
export function WordStrip({ stream, n, marks, cursorS }: { stream: Stream; n: number; marks: { startS: number; endS: number }[]; cursorS: number | null }) {
  const t = cursorS ?? -1
  const heard = marks.findIndex((m) => m.startS > t)
  const upTo = heard < 0 ? n : heard
  const from = Math.max(0, upTo - 36)
  return (
    <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', minHeight: 24 }} data-word-strip>
      {stream.syllables.slice(from, upTo).map((s, k) => {
        const i = from + k
        return <Tile key={i} text={s} word={stream.words[stream.wordIndex[i]]} small />
      })}
    </div>
  )
}
