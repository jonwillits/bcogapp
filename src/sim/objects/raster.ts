/**
 * The rasterizer, shared line for line with `training/m08/raster.py`.
 *
 * A drawing is a list of strokes; a stroke is `[xs, ys]` in the 256 × 256
 * space Quick, Draw! uses. `normalize` is the dataset's own step, which the
 * scene calls *Center and scale the drawing first*: bounding box to the
 * origin, longer side to 255, centered. `rasterize` draws every segment as
 * a thick line into a SIZE × SIZE grayscale image, ink = 1, no
 * antialiasing: a pixel is ink when its center lies within RADIUS of the
 * segment. Every operation is plain double arithmetic in the same order in
 * both languages, so the two agree pixel for pixel (`raster.test.ts`).
 *
 * The network was trained on Python's rasters. A network trained on one
 * rasterizer and tested on another would be the very failure this lab is
 * about, committed by accident; this file is the guard against it.
 */

export type Stroke = [number[], number[]]
export type Drawing = Stroke[]

export const SIZE = 64
export const MARGIN = 4.0
export const SCALE = (SIZE - 2 * MARGIN) / 255.0
export const RADIUS = 1.1

export function bounds(strokes: Drawing): [number, number, number, number] {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const s of strokes) {
    for (const x of s[0]) { if (x < x0) x0 = x; if (x > x1) x1 = x }
    for (const y of s[1]) { if (y < y0) y0 = y; if (y > y1) y1 = y }
  }
  return [x0, y0, x1, y1]
}

/** Quick, Draw!'s own alignment: bounding box to the origin, longer side to 255, then centered in the 256 square. */
export function normalize(strokes: Drawing): Drawing {
  const [x0, y0, x1, y1] = bounds(strokes)
  const w = x1 - x0
  const h = y1 - y0
  const longer = Math.max(w, h)
  const k = longer > 0 ? 255.0 / longer : 1.0
  const ox = (255.0 - w * k) / 2.0
  const oy = (255.0 - h * k) / 2.0
  return strokes.map((s) => [s[0].map((x) => (x - x0) * k + ox), s[1].map((y) => (y - y0) * k + oy)])
}

/** Rotate about (cx, cy) by angleDeg, scale about it, then shift by (dx, dy), in the 256 space. */
export function transform(strokes: Drawing, opts: { dx?: number; dy?: number; angleDeg?: number; scale?: number; cx?: number; cy?: number } = {}): Drawing {
  const { dx = 0, dy = 0, angleDeg = 0, scale = 1, cx = 127.5, cy = 127.5 } = opts
  const a = (angleDeg * Math.PI) / 180.0
  const ca = Math.cos(a)
  const sa = Math.sin(a)
  return strokes.map((s) => {
    const xs: number[] = []
    const ys: number[] = []
    for (let i = 0; i < s[0].length; i++) {
      const rx = s[0][i] - cx
      const ry = s[1][i] - cy
      xs.push((rx * ca - ry * sa) * scale + cx + dx)
      ys.push((rx * sa + ry * ca) * scale + cy + dy)
    }
    return [xs, ys]
  })
}

/** A size × size image, row-major, 0 or 1. Pixel (i, j) has its center at (j + 0.5, i + 0.5). */
export function rasterize(strokes: Drawing, size = SIZE): Float32Array {
  const img = new Float32Array(size * size)
  const r2 = RADIUS * RADIUS
  for (const s of strokes) {
    const xs = s[0]
    const ys = s[1]
    const n = xs.length
    for (let k = 0; k < Math.max(n - 1, 1); k++) {
      const ax = xs[k] * SCALE + MARGIN
      const ay = ys[k] * SCALE + MARGIN
      const bx = xs[Math.min(k + 1, n - 1)] * SCALE + MARGIN
      const by = ys[Math.min(k + 1, n - 1)] * SCALE + MARGIN
      const loX = Math.max(0, Math.floor(Math.min(ax, bx) - RADIUS))
      const hiX = Math.min(size - 1, Math.floor(Math.max(ax, bx) + RADIUS))
      const loY = Math.max(0, Math.floor(Math.min(ay, by) - RADIUS))
      const hiY = Math.min(size - 1, Math.floor(Math.max(ay, by) + RADIUS))
      const dx = bx - ax
      const dy = by - ay
      const len2 = dx * dx + dy * dy
      for (let i = loY; i <= hiY; i++) {
        const py = i + 0.5
        for (let j = loX; j <= hiX; j++) {
          const px = j + 0.5
          let t = 0.0
          if (len2 > 0) {
            t = ((px - ax) * dx + (py - ay) * dy) / len2
            t = t < 0.0 ? 0.0 : t > 1.0 ? 1.0 : t
          }
          const qx = ax + t * dx
          const qy = ay + t * dy
          const ex = px - qx
          const ey = py - qy
          if (ex * ex + ey * ey <= r2) img[i * size + j] = 1.0
        }
      }
    }
  }
  return img
}

/** Total length of stroke, in the 256 space. */
export function strokeLength(strokes: Drawing): number {
  let total = 0
  for (const s of strokes) for (let k = 0; k < s[0].length - 1; k++) total += Math.sqrt(((s[0][k + 1] - s[0][k]) * (s[0][k + 1] - s[0][k])) + ((s[1][k + 1] - s[1][k]) * (s[1][k + 1] - s[1][k])))
  return total
}
