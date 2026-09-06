/**
 * The three ways a signal can cross a body, per the spec's §3.5 and the
 * reading's §3.1.7 and §3.2.4. Only *spikes* run the membrane model; the other
 * two are the comparison cases the chapter argues from, and they need only be
 * right in their scaling.
 *
 * | signal | travel time | what arrives |
 * | diffusing chemical | d²/2D — quadratic in distance | everything, everywhere, slowly cleared |
 * | graded electrical | d/v — fast, linear | exp(−d/λ) of what left: gone by a centimetre |
 * | spikes | d/v — linear | all of it, at any distance |
 */

export type SignalType = 'chemical' | 'graded' | 'spikes'

export const SIGNAL_TYPES: { value: SignalType; label: string }[] = [
  { value: 'chemical', label: 'Diffusing chemical' },
  { value: 'graded', label: 'Graded electrical' },
  { value: 'spikes', label: 'Spikes' },
]

/** Diffusion coefficient of a small molecule in cytoplasm, m²/s. */
export const DIFFUSION_M2_PER_S = 5e-10
/** Length constant of a passive fibre, m: how far a graded signal gets. */
export const LENGTH_CONSTANT_M = 1e-3
/**
 * How fast a graded signal spreads, m/s. A passive cable has no true velocity
 * — the signal is a spreading blur — but the delay to a point grows roughly
 * in proportion to distance over the range where anything arrives at all.
 */
export const GRADED_SPEED_M_PER_S = 10

/** The body sizes the World tab's slider snaps to, in metres. */
export const BODY_SIZES_M = [1e-6, 1e-4, 1e-3, 1e-1, 1] as const
export const DEFAULT_BODY_SIZE_M = 1e-4

/** Travel time in seconds for a signal of this type across `d` metres. */
export function travelTimeS(type: SignalType, d: number, spikeVelocity: number): number {
  switch (type) {
    case 'chemical':
      return (d * d) / (2 * DIFFUSION_M2_PER_S)
    case 'graded':
      return d / GRADED_SPEED_M_PER_S
    case 'spikes':
      return spikeVelocity > 0 ? d / spikeVelocity : Infinity
  }
}

/** Fraction of the signal that reaches the far end. */
export function arrivingFraction(type: SignalType, d: number): number {
  switch (type) {
    case 'chemical':
      return 1
    case 'graded':
      return Math.exp(-d / LENGTH_CONSTANT_M)
    case 'spikes':
      return 1
  }
}

/** A distance in metres, named in the unit a person would use for it. */
export function formatDistance(d: number): string {
  if (d < 1e-3) return `${trim(d * 1e6)} µm`
  if (d < 1) return `${trim(d * 1e3)} mm`
  return `${trim(d)} m`
}

/** A time in seconds, named in the unit a person would use for it. */
export function formatTime(s: number): string {
  if (!Number.isFinite(s)) return 'never'
  if (s < 1e-3) return `${trim(s * 1e6)} µs`
  if (s < 1) return `${trim(s * 1e3)} ms`
  if (s < 60) return `${trim(s)} s`
  if (s < 3600) return `${trim(s / 60)} min`
  if (s < 86400) return `${trim(s / 3600)} h`
  if (s < 86400 * 365) return `${trim(s / 86400)} days`
  return `${trim(s / (86400 * 365))} years`
}

function trim(x: number): string {
  const fixed = x >= 100 ? x.toFixed(0) : x >= 10 ? x.toFixed(1) : x.toFixed(2)
  return fixed.includes('.') ? fixed.replace(/\.?0+$/, '') : fixed
}
