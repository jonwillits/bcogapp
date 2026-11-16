import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { parseWav } from './wav'
import { spectrogram, classifierPatch, PATCH_BANDS, PATCH_FRAMES, fft } from './spectrogram'

/**
 * The spectrogram puts a tone's energy in the right bin at the right time,
 * the two views differ in window as the spec says, and the classifier's
 * patch is the spectrogram's own output pooled into 40 bands by 10 frames.
 */
const PUB = join(__dirname, '..', '..', '..', '..', 'public', 'm13', 'audio')

function tone(hz: number, seconds: number, sr = 16000, from = 0): Float32Array {
  const y = new Float32Array(Math.round(seconds * sr))
  for (let i = Math.round(from * sr); i < y.length; i++) y[i] = 0.5 * Math.sin((2 * Math.PI * hz * i) / sr)
  return y
}

describe('the spectrogram', () => {
  it('the FFT of an impulse is flat, and of a cosine is two spikes', () => {
    const re = new Float64Array(64)
    const im = new Float64Array(64)
    re[0] = 1
    fft(re, im)
    for (let i = 0; i < 64; i++) expect(Math.hypot(re[i], im[i])).toBeCloseTo(1, 9)
    const re2 = new Float64Array(64)
    const im2 = new Float64Array(64)
    for (let i = 0; i < 64; i++) re2[i] = Math.cos((2 * Math.PI * 4 * i) / 64)
    fft(re2, im2)
    expect(Math.hypot(re2[4], im2[4])).toBeCloseTo(32, 6)
    expect(Math.hypot(re2[5], im2[5])).toBeCloseTo(0, 6)
  })
  it('a 1 kHz tone peaks in the 1 kHz bin in both views, and a tone that starts at 0.2 s is absent before it', () => {
    const y = tone(1000, 0.4, 16000, 0.2)
    for (const view of ['wide', 'narrow'] as const) {
      const s = spectrogram(y, 16000, view)
      const late = Math.floor(0.3 / s.hopS)
      let best = 0
      for (let b = 1; b < s.bins; b++) if (s.db[late * s.bins + b] > s.db[late * s.bins + best]) best = b
      expect(Math.abs(best * s.binHz - 1000), view).toBeLessThanOrEqual(s.binHz)
      const early = Math.floor(0.05 / s.hopS)
      expect(s.db[early * s.bins + best]).toBeLessThan(-60)
    }
    expect(spectrogram(y, 16000, 'narrow').binHz).toBeLessThan(spectrogram(y, 16000, 'wide').binHz)
  })
  it('the classifier’s patch is 40 bands by 10 frames in 0 to 1, with the tone’s band brightest', () => {
    const y = tone(1000, 0.3, 16000, 0.05)
    const p = classifierPatch(y, 16000, 0.05)
    expect(p.length).toBe(PATCH_BANDS * PATCH_FRAMES)
    for (const v of p) expect(v >= 0 && v <= 1).toBe(true)
    // Frame 5 (30 ms after the burst) has the tone; band 8 covers 1000 to 1125 Hz.
    const frame = 5
    let best = 0
    for (let b = 0; b < PATCH_BANDS; b++) if (p[frame * PATCH_BANDS + b] > p[frame * PATCH_BANDS + best]) best = b
    expect(best).toBe(8)
    expect(p[frame * PATCH_BANDS + best]).toBe(1)
  })
  it('reads a shipped WAV and computes its patch, once the sounds are shipped', () => {
    const f = join(PUB, 'syllables', 'bee.wav')
    if (!existsSync(f)) return
    const b = readFileSync(f)
    const w = parseWav(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength))
    expect(w.sampleRate).toBe(16000)
    expect(w.samples.length).toBeGreaterThan(1600)
    const p = classifierPatch(w.samples, w.sampleRate, 0.03)
    expect(Math.max(...p)).toBe(1)
  })
})
