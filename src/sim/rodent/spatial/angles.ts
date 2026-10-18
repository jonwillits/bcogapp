/**
 * Angles on the circle, in radians. Headings are allocentric and increase
 * counterclockwise from the +x axis, as in every world in `sim/rodent/`.
 */

export const TAU = 2 * Math.PI

/** Into (−π, π]. */
export function wrap(a: number): number {
  let r = a % TAU
  if (r > Math.PI) r -= TAU
  else if (r <= -Math.PI) r += TAU
  return r
}

/** Into [0, 2π). */
export function wrapPositive(a: number): number {
  const r = a % TAU
  return r < 0 ? r + TAU : r
}

/** The signed difference b − a, in (−π, π]. */
export function angleDiff(a: number, b: number): number {
  return wrap(b - a)
}

export const deg = (rad: number) => (rad * 180) / Math.PI
export const rad = (d: number) => (d * Math.PI) / 180

/**
 * The circular mean of a set of weighted directions, and the length of the
 * mean vector in [0, 1]: 1 when every weight sits at one direction, 0 when
 * they cancel. The length is this scene's **index of directional tuning**
 * (spec §14): a cell's firing rate by heading, summed as a vector.
 */
export function meanVector(angles: readonly number[], weights: readonly number[]): { angle: number; length: number } {
  let x = 0
  let y = 0
  let total = 0
  for (let i = 0; i < angles.length; i++) {
    const w = weights[i]
    x += w * Math.cos(angles[i])
    y += w * Math.sin(angles[i])
    total += w
  }
  if (total <= 0) return { angle: 0, length: 0 }
  return { angle: Math.atan2(y, x), length: Math.sqrt(x * x + y * y) / total }
}
