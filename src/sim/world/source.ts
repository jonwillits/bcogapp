/**
 * A stimulus source (a "heat source" / light in the classic Braitenberg setup).
 *
 * Position is fully 3D: sources can sit on the arena floor or up on the rim
 * outside it, and `y` is the height of the orb itself. Intensity falls off with
 * **true 3D distance** as strength / (1 + d²), so a source up on the rim is
 * genuinely weaker than the same source on the floor — a creature can drive at
 * it and never reach it. That is the honest consequence of giving sources a
 * height, and it's the point: height costs signal.
 */
export interface Source {
  id: number
  x: number
  y: number
  z: number
  strength: number
}

/** Total stimulus intensity sensed at a point, summed over all sources. */
export function sensedIntensity(
  x: number,
  y: number,
  z: number,
  sources: readonly Source[],
): number {
  let sum = 0
  for (const s of sources) {
    const dx = x - s.x
    const dy = y - s.y
    const dz = z - s.z
    sum += s.strength / (1 + dx * dx + dy * dy + dz * dz)
  }
  return sum
}
