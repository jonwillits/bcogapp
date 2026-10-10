/**
 * The two kinds of noise, generated in the browser from the run seed so that
 * no noisy image is shipped through a second round of compression. The
 * photo networks were trained with `training/m08/noise.py`, and
 * `noise.test.ts` pins this generator's statistics to that one's.
 *
 * Noise A, salt and pepper: each pixel, independently with probability p,
 * is replaced by 0 or 1 with equal odds. Noise B, uniform: every pixel has
 * a draw from U(−w, w) added, and the result is clipped to [0, 1]. Geirhos
 * et al. (2018) trained on the first and tested on the second; the two
 * look similar to a person.
 */
import type { Rng } from '../random'

export type NoiseKind = 'clean' | 'A' | 'B'
export const NOISE_LABEL: Record<NoiseKind, string> = { clean: 'clean', A: 'noise A', B: 'noise B' }

export function saltAndPepper(img: Float32Array, p: number, rng: Rng): Float32Array {
  const out = new Float32Array(img.length)
  for (let i = 0; i < img.length; i++) {
    if (rng.next() < p) out[i] = rng.next() < 0.5 ? 0 : 1
    else out[i] = img[i]
  }
  return out
}

export function uniformNoise(img: Float32Array, w: number, rng: Rng): Float32Array {
  const out = new Float32Array(img.length)
  for (let i = 0; i < img.length; i++) {
    const v = img[i] + rng.range(-w, w)
    out[i] = v < 0 ? 0 : v > 1 ? 1 : v
  }
  return out
}

export function addNoise(img: Float32Array, kind: NoiseKind, strength: number, rng: Rng): Float32Array {
  if (kind === 'A') return saltAndPepper(img, strength, rng)
  if (kind === 'B') return uniformNoise(img, strength, rng)
  return img.slice()
}

/** The default strengths, set during the walk-through with the developer control (spec §6.4). */
export const DEFAULT_NOISE = { A: 0.2, B: 0.35 }
export const NOISE_A_RANGE = { min: 0, max: 0.6, step: 0.01 }
export const NOISE_B_RANGE = { min: 0, max: 0.9, step: 0.01 }
