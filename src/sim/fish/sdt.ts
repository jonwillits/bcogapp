/**
 * Signal detection arithmetic (§7.1.4): the four outcomes, d′ two ways, the
 * criterion's position, and what a criterion earns.
 */

export interface Counts {
  hits: number
  misses: number
  falseAlarms: number
  correctRejections: number
}

export function emptyCounts(): Counts {
  return { hits: 0, misses: 0, falseAlarms: 0, correctRejections: 0 }
}

/** Score one decision: was the thing there, and did the fish respond as if it were. */
export function tally(c: Counts, present: boolean, judgedPresent: boolean): void {
  if (present) judgedPresent ? c.hits++ : c.misses++
  else judgedPresent ? c.falseAlarms++ : c.correctRejections++
}

export function hitRate(c: Counts): number {
  const n = c.hits + c.misses
  return n ? c.hits / n : 0
}

export function falseAlarmRate(c: Counts): number {
  const n = c.falseAlarms + c.correctRejections
  return n ? c.falseAlarms / n : 0
}

export function percentCorrect(c: Counts): number {
  const n = c.hits + c.misses + c.falseAlarms + c.correctRejections
  return n ? (100 * (c.hits + c.correctRejections)) / n : 0
}

/**
 * The inverse of the standard normal's cumulative distribution: the z-score
 * below which a share `p` of the distribution lies. Acklam's rational
 * approximation, good to about 1e-9, which is far more than a count out of
 * fifty can use.
 */
export function zOf(p: number): number {
  if (p <= 0) return -Infinity
  if (p >= 1) return Infinity
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239]
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1]
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783]
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416]
  const lo = 0.02425
  if (p < lo) {
    const q = Math.sqrt(-2 * Math.log(p))
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
  }
  if (p > 1 - lo) {
    const q = Math.sqrt(-2 * Math.log(1 - p))
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
  }
  const q = p - 0.5
  const r = q * q
  return (
    ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) /
    (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
  )
}

/**
 * A rate of exactly 0 or 1 has no z-score. The usual repair: treat it as half
 * a response short of the end, 1/(2N) or 1 − 1/(2N).
 */
export function usableRate(count: number, n: number): number {
  if (n <= 0) return 0.5
  const r = count / n
  if (r <= 0) return 1 / (2 * n)
  if (r >= 1) return 1 - 1 / (2 * n)
  return r
}

export interface ByHand {
  hitRate: number
  falseAlarmRate: number
  /** d′ from the two rates: z(hit rate) − z(false-alarm rate). */
  dPrime: number
  /** Where the criterion sits: 0 neutral, negative liberal, positive conservative. −[z(H) + z(F)]/2. */
  criterion: number
  percentCorrect: number
}

export function byHand(c: Counts): ByHand {
  const h = usableRate(c.hits, c.hits + c.misses)
  const f = usableRate(c.falseAlarms, c.falseAlarms + c.correctRejections)
  return {
    hitRate: hitRate(c),
    falseAlarmRate: falseAlarmRate(c),
    dPrime: zOf(h) - zOf(f),
    criterion: -(zOf(h) + zOf(f)) / 2,
    percentCorrect: percentCorrect(c),
  }
}

export function describeCriterion(c: number): string {
  if (c < -0.1) return 'liberal'
  if (c > 0.1) return 'conservative'
  return 'neutral'
}

/**
 * d′ from the two distributions of evidence: the distance between their
 * means, in units of their pooled spread. Moving a criterion cannot change
 * it, because no evidence value moves.
 */
export function dPrimeOf(present: readonly number[], absent: readonly number[]): number {
  const a = moments(present)
  const b = moments(absent)
  const pooled = Math.sqrt((a.variance + b.variance) / 2)
  return pooled > 0 ? (a.mean - b.mean) / pooled : 0
}

export function moments(v: readonly number[]): { mean: number; variance: number } {
  if (v.length === 0) return { mean: 0, variance: 0 }
  let m = 0
  for (const x of v) m += x
  m /= v.length
  let s = 0
  for (const x of v) s += (x - m) * (x - m)
  return { mean: m, variance: v.length > 1 ? s / (v.length - 1) : 0 }
}

/** What each of the four outcomes is worth. */
export interface Stakes {
  hit: number
  miss: number
  falseAlarm: number
  correctRejection: number
}

export interface StakesPreset {
  id: 'fish' | 'reading'
  label: string
  stakes: Stakes
  says: string
}

export const STAKES_PRESETS: readonly StakesPreset[] = [
  {
    id: 'fish',
    label: 'The fish’s stakes',
    stakes: { hit: 0, miss: -20, falseAlarm: 0, correctRejection: 1 },
    says: 'A correct rejection is a mouthful of food. A false alarm loses that mouthful. A miss is a strike.',
  },
  {
    id: 'reading',
    label: 'The reading’s example',
    stakes: { hit: 0, miss: -1, falseAlarm: -15, correctRejection: 0 },
    says: 'The worked example of §7.1.4: a false alarm loses 15 and a miss loses 1.',
  },
]

/** Energy per 100 encounters, for these counts and these stakes. */
export function energyPer100(c: Counts, s: Stakes): number {
  const n = c.hits + c.misses + c.falseAlarms + c.correctRejections
  if (!n) return 0
  return (100 * (c.hits * s.hit + c.misses * s.miss + c.falseAlarms * s.falseAlarm + c.correctRejections * s.correctRejection)) / n
}
