/** Small math helpers shared across the sim layer. Pure, browser-free. */

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v
}

/** Wrap an angle to (-π, π]. */
export function wrapAngle(a: number): number {
  const twoPi = Math.PI * 2
  let r = a % twoPi
  if (r <= -Math.PI) r += twoPi
  if (r > Math.PI) r -= twoPi
  return r
}

export interface Vec2 {
  x: number
  z: number
}

export function dist2(ax: number, az: number, bx: number, bz: number): number {
  const dx = ax - bx
  const dz = az - bz
  return dx * dx + dz * dz
}
