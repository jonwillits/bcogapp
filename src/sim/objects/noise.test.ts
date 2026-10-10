import { describe, it, expect } from 'vitest'
import { makeRng } from '../random'
import { saltAndPepper, uniformNoise } from './noise'

/**
 * The TypeScript noise generator's statistics match the Python generator's
 * (spec §11). `training/m08/noise.py` printed, for a 160 × 160 image with
 * values in [0.2, 0.8]: noise A at p = 0.2 changes 0.197 of the pixels, and
 * 0.507 of the changed pixels are white; noise B at w = 0.35 adds a delta of
 * mean 0.001 and spread 0.199 (the spread of U(−0.35, 0.35) is 0.202
 * before clipping), with 0.053 of the pixels clipped to 0 or 1.
 */
const N = 160 * 160

function image(seed: number): Float32Array {
  const rng = makeRng(seed)
  const img = new Float32Array(N)
  for (let i = 0; i < N; i++) img[i] = rng.next() * 0.6 + 0.2
  return img
}

describe('noise A, salt and pepper', () => {
  it('changes a share p of the pixels, half of them to white, and leaves the rest exactly as they were', () => {
    const img = image(1)
    const noisy = saltAndPepper(img, 0.2, makeRng(2))
    let changed = 0, white = 0
    for (let i = 0; i < N; i++) {
      if (noisy[i] !== img[i]) { changed++; if (noisy[i] === 1) white++; else expect(noisy[i]).toBe(0) }
    }
    expect(changed / N).toBeGreaterThan(0.19)
    expect(changed / N).toBeLessThan(0.21)
    expect(white / changed).toBeGreaterThan(0.48)
    expect(white / changed).toBeLessThan(0.52)
  })

  it('at p = 0 changes nothing, and at p = 1 every pixel is black or white', () => {
    const img = image(3)
    expect(saltAndPepper(img, 0, makeRng(4))).toEqual(img)
    for (const v of saltAndPepper(img, 1, makeRng(5))) expect(v === 0 || v === 1).toBe(true)
  })
})

describe('noise B, uniform', () => {
  it('adds a delta of mean about 0 and spread about 0.2 at w = 0.35, never beyond ±w, clipping about 5% of pixels', () => {
    const img = image(6)
    const noisy = uniformNoise(img, 0.35, makeRng(7))
    let m = 0, s = 0, clipped = 0, maxAbs = 0
    for (let i = 0; i < N; i++) {
      const d = noisy[i] - img[i]
      m += d
      maxAbs = Math.max(maxAbs, Math.abs(d))
      if (noisy[i] === 0 || noisy[i] === 1) clipped++
    }
    m /= N
    for (let i = 0; i < N; i++) s += (noisy[i] - img[i] - m) ** 2
    s = Math.sqrt(s / N)
    expect(Math.abs(m)).toBeLessThan(0.01)
    expect(s).toBeGreaterThan(0.19)
    expect(s).toBeLessThan(0.21)
    expect(maxAbs).toBeLessThanOrEqual(0.35)
    expect(clipped / N).toBeGreaterThan(0.04)
    expect(clipped / N).toBeLessThan(0.07)
  })
})

describe('determinism', () => {
  it('the same seed gives the same noise, and a different seed different noise', () => {
    const img = image(8)
    expect(saltAndPepper(img, 0.2, makeRng(9))).toEqual(saltAndPepper(img, 0.2, makeRng(9)))
    expect(uniformNoise(img, 0.35, makeRng(9))).not.toEqual(uniformNoise(img, 0.35, makeRng(10)))
  })
})
