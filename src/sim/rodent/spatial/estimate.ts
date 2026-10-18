/**
 * The running estimate of position: the running sum of §9.2.2, kept in the
 * frame the head-direction ring supplies. Each step adds the sensed step
 * along the ring's heading. Nothing in it shows how far it has drifted; an
 * uncertainty grows with distance run and shrinks at each correction, and
 * sets how far a landmark fix pulls it (averaging, §9.2.3).
 */

/** How fast the uncertainty (a variance, m²) grows per meter run. */
export const DRIFT_PER_METER = 0.004
/** The uncertainty a fresh fix leaves behind, m². */
export const FIX_FLOOR = 0.0004

export class Estimate {
  x = 0
  y = 0
  /** Variance of the position, m², isotropic. Starts wide: the first fix places it. */
  variance = 1

  set(x: number, y: number, variance = FIX_FLOOR): void {
    this.x = x
    this.y = y
    this.variance = variance
  }

  /** Add one step: the sensed speed (signed; backward is negative) along the heading the ring supplies. */
  step(dt: number, heading: number, speed: number): void {
    const d = speed * dt
    this.x += d * Math.cos(heading)
    this.y += d * Math.sin(heading)
    this.variance += DRIFT_PER_METER * Math.abs(d)
  }

  /**
   * Averaging: a fix at (fx, fy) with its own variance pulls the estimate
   * by the share its reliability earns (cue combination, §9.2.3). A fix of
   * zero variance replaces the estimate outright (resetting).
   */
  fix(fx: number, fy: number, fixVariance: number): void {
    const k = this.variance / (this.variance + fixVariance)
    this.x += k * (fx - this.x)
    this.y += k * (fy - this.y)
    this.variance = Math.max(FIX_FLOOR, (1 - k) * this.variance)
  }

  /** Resetting along one axis: the coordinate across a wall the rat has touched (§6.1). */
  resetAlong(ux: number, uy: number, px: number, py: number): void {
    // Move the estimate along the unit direction (ux, uy) until it lies on the line through (px, py) perpendicular to it.
    const t = (px - this.x) * ux + (py - this.y) * uy
    this.x += t * ux
    this.y += t * uy
    this.variance = Math.max(FIX_FLOOR, this.variance * 0.5)
  }
}
