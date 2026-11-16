/**
 * The spectrogram the lab draws and the input its classifier receives, from
 * one piece of code (spec §3): a short-time Fourier transform over a Hann
 * window, in decibels, with two settings.
 *
 *   wide bands    a 5 ms window, which resolves time (the bursts and the
 *                 formants) and blurs the harmonics: the wideband view
 *   narrow bands  a 25 ms window, which resolves frequency and shows the
 *                 harmonics as thin lines: the narrowband view
 *
 * Nothing here depends on the browser: the tests and the classifier's
 * probe run it in Node on the shipped files through `wav.ts`.
 */

export type View = 'wide' | 'narrow'

export const WINDOW_S: Record<View, number> = { wide: 0.005, narrow: 0.025 }
export const HOP_S = 0.001
export const FLOOR_DB = -70

export interface Spectrogram {
  view: View
  sampleRate: number
  /** Seconds between frames. */
  hopS: number
  /** Hertz between bins. */
  binHz: number
  frames: number
  bins: number
  /** frames × bins, row-major, in decibels relative to the loudest point (0), floored at FLOOR_DB. */
  db: Float32Array
}

function nextPow2(n: number): number {
  let p = 1
  while (p < n) p <<= 1
  return p
}

/** An in-place radix-2 FFT on interleaved real and imaginary arrays. */
export function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      let t = re[i]
      re[i] = re[j]
      re[j] = t
      t = im[i]
      im[i] = im[j]
      im[j] = t
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len
    const wr = Math.cos(ang)
    const wi = Math.sin(ang)
    for (let i = 0; i < n; i += len) {
      let cr = 1
      let ci = 0
      for (let k = 0; k < len / 2; k++) {
        const a = i + k
        const b = a + len / 2
        const tr = re[b] * cr - im[b] * ci
        const ti = re[b] * ci + im[b] * cr
        re[b] = re[a] - tr
        im[b] = im[a] - ti
        re[a] += tr
        im[a] += ti
        const ncr = cr * wr - ci * wi
        ci = cr * wi + ci * wr
        cr = ncr
      }
    }
  }
}

/**
 * The spectrogram of a sound. `hopS` is the time between frames (1 ms for
 * drawing, 10 ms for the classifier's input), `maxHz` the top of the range
 * kept.
 */
export function spectrogram(samples: Float32Array, sampleRate: number, view: View, hopS: number = HOP_S, maxHz: number = 5000): Spectrogram {
  const win = Math.round(WINDOW_S[view] * sampleRate)
  const nfft = Math.max(256, nextPow2(win) * 2)
  const hop = Math.max(1, Math.round(hopS * sampleRate))
  const binHz = sampleRate / nfft
  const bins = Math.min(nfft / 2, Math.floor(maxHz / binHz) + 1)
  const frames = Math.max(1, Math.floor((samples.length - win) / hop) + 1)
  const hann = new Float64Array(win)
  for (let i = 0; i < win; i++) hann[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (win - 1))
  const re = new Float64Array(nfft)
  const im = new Float64Array(nfft)
  const db = new Float32Array(frames * bins)
  let max = -Infinity
  for (let f = 0; f < frames; f++) {
    re.fill(0)
    im.fill(0)
    const start = f * hop
    for (let i = 0; i < win; i++) re[i] = (samples[start + i] ?? 0) * hann[i]
    fft(re, im)
    for (let b = 0; b < bins; b++) {
      const p = re[b] * re[b] + im[b] * im[b]
      const d = 10 * Math.log10(p + 1e-12)
      db[f * bins + b] = d
      if (d > max) max = d
    }
  }
  for (let i = 0; i < db.length; i++) db[i] = Math.max(FLOOR_DB, db[i] - max)
  return { view, sampleRate, hopS: hop / sampleRate, binHz, frames, bins, db }
}

/** The classifier's input (spec §5.4): about 40 bands by 10 frames of 10 ms, starting 20 ms before the release. */
export const PATCH_BANDS = 40
export const PATCH_FRAMES = 10
export const PATCH_FRAME_S = 0.01
export const PATCH_BEFORE_BURST_S = 0.02
export const PATCH_MAX_HZ = 5000

/**
 * The network's input for one token: the wide-band spectrogram at 10 ms
 * frames, from 20 ms before the burst, 10 frames long, with the bins up to
 * 5 kHz pooled into 40 bands by averaging, and each value scaled from
 * decibels to 0 (the floor, 60 dB down) to 1 (the loudest point in the
 * patch). Length PATCH_BANDS × PATCH_FRAMES, frame-major.
 */
export function classifierPatch(samples: Float32Array, sampleRate: number, burstS: number): Float32Array {
  const start = Math.max(0, Math.round((burstS - PATCH_BEFORE_BURST_S) * sampleRate))
  const length = Math.round((PATCH_FRAMES * PATCH_FRAME_S + WINDOW_S.wide) * sampleRate)
  const seg = new Float32Array(length)
  seg.set(samples.subarray(start, Math.min(samples.length, start + length)))
  const sg = spectrogram(seg, sampleRate, 'wide', PATCH_FRAME_S, PATCH_MAX_HZ)
  const out = new Float32Array(PATCH_BANDS * PATCH_FRAMES)
  const perBand = sg.bins / PATCH_BANDS
  let max = -Infinity
  for (let f = 0; f < PATCH_FRAMES; f++) {
    const frame = Math.min(f, sg.frames - 1)
    for (let b = 0; b < PATCH_BANDS; b++) {
      const lo = Math.floor(b * perBand)
      const hi = Math.max(lo + 1, Math.floor((b + 1) * perBand))
      let s = 0
      for (let k = lo; k < hi; k++) s += sg.db[frame * sg.bins + k]
      const v = s / (hi - lo)
      out[f * PATCH_BANDS + b] = v
      if (v > max) max = v
    }
  }
  const RANGE_DB = 60
  for (let i = 0; i < out.length; i++) out[i] = Math.min(1, Math.max(0, (out[i] - max + RANGE_DB) / RANGE_DB))
  return out
}
