/**
 * A bisection (spec §5.2 B, C; §5.3 A): six choices between a fixed option
 * and a varying amount X. X starts at the middle of its range and moves
 * halfway toward the unchosen side after each choice. The point of
 * indifference is the midpoint of the last interval. The six choices of one
 * series are consecutive, and the screen never says that they are a series.
 */

export const BISECTION_STEPS = 6

export interface Bisection {
  lo: number
  hi: number
  /** The amount offered now. */
  x: number
  /** Choices so far: true when the varying amount's side was chosen. */
  took: boolean[]
  /** Whether choosing the varying amount means X was too high (so X falls) or too low (so X rises). */
  tookMeansLower: boolean
}

export function startBisection(lo: number, hi: number, tookMeansLower: boolean): Bisection {
  return { lo, hi, x: (lo + hi) / 2, took: [], tookMeansLower }
}

/** One choice: the next offer, or the finished series. */
export function answer(b: Bisection, tookX: boolean): Bisection {
  const lower = tookX === b.tookMeansLower
  const next: Bisection = { ...b, took: [...b.took, tookX] }
  if (lower) next.hi = b.x
  else next.lo = b.x
  next.x = (next.lo + next.hi) / 2
  return next
}

export function finished(b: Bisection): boolean {
  return b.took.length >= BISECTION_STEPS
}

/** The point of indifference: the midpoint of the last interval. */
export function indifference(b: Bisection): number {
  return (b.lo + b.hi) / 2
}
