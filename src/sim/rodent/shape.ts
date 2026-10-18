/**
 * The floor plan of an enclosure, as a boundary around a center: a
 * rectangle, a circle, or a shape part way from a square to a circle (the
 * six boxes of §9.3.5). Pure geometry, with no pose in it, so that the
 * spatial system may import it (`structure.test.ts`).
 */

export interface Shape {
  /** Extent along x and y for a rectangle; the diameter for a circle; the side for a morph. Meters. */
  width: number
  length: number
  /** 0 is the rectangle (or square); 1 is a circle of diameter `width`; between is the morph. */
  roundness: number
}

export const rect = (width: number, length: number): Shape => ({ width, length, roundness: 0 })
export const circle = (diameter: number): Shape => ({ width: diameter, length: diameter, roundness: 1 })
export const morph = (side: number, roundness: number): Shape => ({ width: side, length: side, roundness })

/** Distance from the center to the boundary along direction `phi`. */
export function radiusAt(s: Shape, phi: number): number {
  const c = Math.cos(phi)
  const sn = Math.sin(phi)
  const a = s.width / 2
  const b = s.length / 2
  const rectR = Math.min(Math.abs(c) > 1e-9 ? a / Math.abs(c) : Infinity, Math.abs(sn) > 1e-9 ? b / Math.abs(sn) : Infinity)
  if (s.roundness <= 0) return rectR
  const circR = Math.min(a, b)
  return (1 - s.roundness) * rectR + s.roundness * circR
}

/** Whether a point (relative to the center) lies inside the boundary brought in by `inset`. */
export function inside(s: Shape, x: number, y: number, inset = 0): boolean {
  const r = Math.sqrt(x * x + y * y)
  if (r < 1e-9) return true
  return r <= radiusAt(s, Math.atan2(y, x)) - inset
}

/**
 * How far from (px, py), relative to the center, along the unit direction
 * (ux, uy), the inset boundary lies. Negative when the point is already
 * outside along that direction. Bisection on `inside`.
 */
export function distanceToBoundary(s: Shape, px: number, py: number, ux: number, uy: number, inset = 0): number {
  const far = s.width + s.length
  if (!inside(s, px, py, inset)) {
    // Step back until inside, then bisect from there.
    let lo = -far
    let hi = 0
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2
      if (inside(s, px + mid * ux, py + mid * uy, inset)) lo = mid
      else hi = mid
    }
    return lo
  }
  let lo = 0
  let hi = far
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2
    if (inside(s, px + mid * ux, py + mid * uy, inset)) lo = mid
    else hi = mid
  }
  return lo
}

/** The outward normal of the boundary nearest a point just inside it, from the gradient of the radius function. */
export function outwardNormal(s: Shape, x: number, y: number): [number, number] {
  const phi = Math.atan2(y, x)
  const h = 1e-3
  const r0 = radiusAt(s, phi)
  const r1 = radiusAt(s, phi + h)
  const dr = (r1 - r0) / h
  // Boundary point p(φ) = r(φ)(cos φ, sin φ); tangent = r'(cos, sin) + r(−sin, cos); normal is the tangent turned −90°.
  const tx = dr * Math.cos(phi) - r0 * Math.sin(phi)
  const ty = dr * Math.sin(phi) + r0 * Math.cos(phi)
  const n = Math.sqrt(tx * tx + ty * ty) || 1
  return [ty / n, -tx / n]
}

/** A room's bounding box half-sizes. */
export function halfSizes(s: Shape): [number, number] {
  return [s.width / 2, s.length / 2]
}
