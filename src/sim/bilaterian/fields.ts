import type { Rng } from '../random'

/**
 * Diffusible cue fields, one scalar per channel.
 *
 * Four channels exist in the engine. A channel is a number and nothing else:
 * there is no flag on it saying whether the animal should approach or flee
 * what it carries. That is decided entirely by where the sensory cell for
 * that channel is wired, which is the chapter's §4.2.9 and the whole of
 * Lab 4's Part 1. Building an `isAttractant` here would quietly destroy it.
 *
 * A scenario names the channels and decides which sources are in the dish
 * (`scenarios.ts`); the engine only knows them by index.
 */
export const CHANNEL_COUNT = 4

export interface CueSource {
  id: number
  channel: number
  x: number
  z: number
  /** Concentration at the centre of the source. */
  strength: number
  /** Distance at which the field has fallen to half its centre value. */
  scale: number
  /**
   * Seconds the plume lasts before it dissipates and reappears elsewhere, or
   * null for a feature of the dish that stays put. Plumes that last for ever
   * let an animal that will not eat sit on one until the run ends.
   */
  lifetime: number | null
  /** Sim time this source appeared. */
  born: number
  /**
   * What reaching this particular source does, where the dish decides that
   * source by source instead of channel by channel. Still a rule of the dish
   * and not a property of the channel: the same cue can mark food in one
   * place and nothing in another.
   */
  carries?: 'nourish' | 'harm' | 'nothing' | 'ignore'
}

/** A field falls off with distance as 1 / (1 + (d / scale)²). */
export function fieldAt(s: CueSource, x: number, z: number): number {
  const dx = x - s.x
  const dz = z - s.z
  const q = (dx * dx + dz * dz) / (s.scale * s.scale)
  return s.strength / (1 + q)
}

/** Concentration of one channel at a point, summed over its sources. */
export function concentrationAt(
  channel: number,
  x: number,
  z: number,
  sources: readonly CueSource[],
): number {
  let sum = 0
  for (const s of sources) if (s.channel === channel) sum += fieldAt(s, x, z)
  return sum
}

/** Every channel's concentration at a point; `scaleOf` is the concentration control. */
export function concentrations(
  x: number,
  z: number,
  sources: readonly CueSource[],
  scaleOf: (s: CueSource) => number = () => 1,
): number[] {
  const out = new Array<number>(CHANNEL_COUNT).fill(0)
  for (const s of sources) out[s.channel] += fieldAt(s, x, z) * scaleOf(s)
  return out
}

/** A point in the dish at least `clear` from (ax, az), drawn from the run's stream. */
export function placeAwayFrom(
  rng: Rng,
  bounds: number,
  ax: number,
  az: number,
  clear: number,
): { x: number; z: number } {
  const margin = 1
  for (let tries = 0; tries < 40; tries++) {
    const x = rng.range(-bounds + margin, bounds - margin)
    const z = rng.range(-bounds + margin, bounds - margin)
    if (Math.hypot(x - ax, z - az) >= clear) return { x, z }
  }
  return { x: -ax * 0.8, z: -az * 0.8 }
}
