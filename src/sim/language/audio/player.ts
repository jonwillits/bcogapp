/**
 * Playback on the Web Audio clock (spec §3, §14): every sound is scheduled
 * at a time on `AudioContext.currentTime`, and a highlight or a cursor is
 * synchronized to that clock, never to animation frames alone. Audio starts
 * only after a click (the context is made on the first play). Nothing here
 * records.
 */
export class Player {
  private ctx: AudioContext | null = null
  private sources: AudioBufferSourceNode[] = []
  private gain: GainNode | null = null

  ensure(): AudioContext | null {
    if (typeof window === 'undefined' || !('AudioContext' in window)) return null
    if (!this.ctx) {
      this.ctx = new AudioContext()
      this.gain = this.ctx.createGain()
      this.gain.gain.value = 0.9
      this.gain.connect(this.ctx.destination)
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    return this.ctx
  }

  get context(): AudioContext | null {
    return this.ctx
  }

  /** The audio clock, seconds; 0 without a context. */
  now(): number {
    return this.ctx?.currentTime ?? 0
  }

  /** Play a buffer at an audio-clock time (default: now plus a small margin). Returns the start and end times on the clock. */
  play(buffer: AudioBuffer, at?: number): { start: number; end: number } {
    const ctx = this.ensure()
    if (!ctx || !this.gain) return { start: 0, end: 0 }
    const start = at ?? ctx.currentTime + 0.05
    const src = ctx.createBufferSource()
    src.buffer = buffer
    src.connect(this.gain)
    src.start(start)
    this.sources.push(src)
    src.onended = () => {
      this.sources = this.sources.filter((s) => s !== src)
    }
    return { start, end: start + buffer.duration }
  }

  /** Play several buffers one after another, each at a given offset from the first start. */
  playSequence(items: { buffer: AudioBuffer; offsetS: number }[]): { start: number; end: number } {
    const ctx = this.ensure()
    if (!ctx) return { start: 0, end: 0 }
    const start = ctx.currentTime + 0.1
    let end = start
    for (const it of items) {
      const r = this.play(it.buffer, start + it.offsetS)
      end = Math.max(end, r.end)
    }
    return { start, end }
  }

  stop(): void {
    for (const s of this.sources) {
      try {
        s.stop()
      } catch {
        /* already stopped */
      }
    }
    this.sources = []
  }
}

/** One player for the scene. In development builds it is exposed for scripts/m13-timing.mjs, which reads its clock. */
export const player = new Player()
if (typeof window !== 'undefined' && (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV) (window as unknown as { __m13player?: Player }).__m13player = player
