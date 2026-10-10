import type { Rng } from '../random'

/**
 * The mask that follows a glimpse: the image's own patches, scrambled, so it
 * has the same tones and nothing to read. Generated in the browser from the
 * seed; never a third-party image.
 */
export function scrambledMask(img: Float32Array, size: number, patch: number, rng: Rng): Float32Array {
  const n = Math.floor(size / patch)
  const order = Array.from({ length: n * n }, (_, i) => i)
  for (let i = order.length - 1; i > 0; i--) { const j = rng.int(i + 1); const t = order[i]; order[i] = order[j]; order[j] = t }
  const out = new Float32Array(size * size)
  for (let k = 0; k < order.length; k++) {
    const src = order[k]
    const sy = Math.floor(src / n) * patch, sx = (src % n) * patch
    const dy = Math.floor(k / n) * patch, dx = (k % n) * patch
    const flip = rng.next() < 0.5
    for (let y = 0; y < patch; y++) for (let x = 0; x < patch; x++) {
      const v = img[(sy + y) * size + sx + x]
      out[(dy + y) * size + dx + (flip ? patch - 1 - x : x)] = v
    }
  }
  return out
}
