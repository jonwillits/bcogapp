/**
 * The one source of randomness in the simulation.
 *
 * Module 2's lab is built end to end on "press Reset (same seed), change
 * exactly one switch, compare the two runs." That instruction is only honest if
 * *everything* random about a run — the founder draw, every mutation, where
 * lights are placed, where they respawn, and sensor noise — comes from a single
 * stream seeded by the run seed. If any one of them reached for `Math.random()`
 * the two runs would differ in ways the student did not change, and the whole
 * of Part 2 would silently produce nonsense rather than fail loudly.
 *
 * So: nothing in `sim/` may call `Math.random()`. A world takes an `Rng`, and
 * every draw goes through it.
 */

export interface Rng {
  /** Uniform in [0, 1). */
  next(): number
  /** Uniform in [min, max). */
  range(min: number, max: number): number
  /** Uniform integer in [0, n). */
  int(n: number): number
  /** Standard normal (mean 0, sd 1). */
  normal(): number
  /** A fresh independent stream, for sub-runs that must not disturb this one. */
  fork(): Rng
}

/**
 * mulberry32 — small, fast, and good enough for a teaching simulation. Chosen
 * over anything fancier because it is short enough to read, has no
 * dependencies, and is deterministic across browsers and Node, which is what
 * makes the headless acceptance tests mean anything about what a student sees.
 */
export function makeRng(seed: number): Rng {
  // Force to a 32-bit integer so the same seed behaves identically whether it
  // arrived as a float from a URL, a text field, or another generator.
  let a = seed >>> 0

  const next = (): number => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  // Box–Muller, both values used, so a normal draw costs one uniform on
  // average rather than two. The spare is per-Rng state, which keeps a stream
  // reproducible from its seed alone.
  let spare: number | null = null
  const normal = (): number => {
    if (spare !== null) {
      const v = spare
      spare = null
      return v
    }
    // `next()` can return exactly 0, and log(0) is −∞; nudging into (0, 1] is
    // the standard guard and biases nothing at this precision.
    const u = 1 - next()
    const v = next()
    const r = Math.sqrt(-2 * Math.log(u))
    const theta = 2 * Math.PI * v
    spare = r * Math.sin(theta)
    return r * Math.cos(theta)
  }

  return {
    next,
    normal,
    range: (min, max) => min + next() * (max - min),
    int: (n) => Math.floor(next() * n),
    fork: () => makeRng(Math.floor(next() * 0xffffffff)),
  }
}

/**
 * A seed for a fresh run. This is the *only* place a run's randomness is
 * allowed to be unreproducible, and it happens once, in the UI, before the
 * stream starts — the seed it produces is then shown to the student and is
 * what `Reset (same seed)` replays.
 */
export function randomSeed(): number {
  return Math.floor(Math.random() * 0xffffffff) >>> 0
}
