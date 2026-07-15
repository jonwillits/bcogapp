import { dist2 } from '../math'

/**
 * A stimulus source on the plane (a "light" in the classic Braitenberg setup).
 * `strength` scales how intensely a sensor responds; intensity falls off with
 * distance as strength / (1 + d²) so it stays finite at the source.
 */
export interface Source {
  id: number
  x: number
  z: number
  strength: number
}

/** Total stimulus intensity sensed at a point, summed over all sources. */
export function sensedIntensity(
  x: number,
  z: number,
  sources: readonly Source[],
): number {
  let sum = 0
  for (const src of sources) {
    sum += src.strength / (1 + dist2(x, z, src.x, src.z))
  }
  return sum
}
