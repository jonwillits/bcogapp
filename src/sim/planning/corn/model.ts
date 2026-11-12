import type { Rng } from '../../random'

/**
 * Part 4 — Two Trays (spec §8.1): a tray holds 48 corn plants. Each plant's
 * height is the tray's mean height, plus a genetic value from its seed, plus
 * an environmental value from its patch of soil. **Heritability** within a
 * tray is the variance of the genetic values divided by the variance of the
 * heights (§12.3.5), computed from the genetic values the model assigns and
 * stores; a breeder would have to estimate it. Nothing here is a person.
 */

export const PLANTS = 48
export type SeedKind = 'varied' | 'uniform'
export type SoilKind = 'even' | 'patchy'
export type Nutrients = 'complete' | 'deficient' | 'nitratesRestored'

export const MODEL = {
  /** The spread of genetic values in a varied stock, centimeters: the sum of many small effects. */
  geneticSd: 12,
  /** How many small effects make a genetic value. */
  effects: 20,
  /** The spread of patch effects in patchy soil, centimeters. */
  patchSd: 12,
  /** The small spread of growth that is neither seed nor patch, centimeters. */
  growthSd: 0.5,
  /** The tray's mean height under each nutrient solution, centimeters. */
  meanHeight: { complete: 180, deficient: 110, nitratesRestored: 150 } as Record<Nutrients, number>,
  /** The genetic value of each uniform line, centimeters above or below the mean. */
  lines: [8, -8],
} as const

export interface Plant {
  /** The genetic value's contribution to this plant's height in this soil. In poor soil it is capped (`potential` is the uncapped value). */
  genetic: number
  /** The genetic value from the seed, before any limit of the soil. */
  potential: number
  environment: number
  growth: number
  height: number
}

export interface Tray {
  seed: SeedKind
  soil: SoilKind
  nutrients: Nutrients
  plants: Plant[]
}

export function variance(xs: readonly number[]): number {
  const m = xs.reduce((a, b) => a + b, 0) / xs.length
  return xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length
}

export const mean = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length

/** A genetic value from a varied stock: the sum of many small effects drawn independently. */
export function variedGenetic(rng: Rng): number {
  let g = 0
  const each = MODEL.geneticSd / Math.sqrt(MODEL.effects)
  for (let i = 0; i < MODEL.effects; i++) g += each * rng.normal()
  return g
}

/** The genetic values of one tray's seed. */
export function drawGenetics(seed: SeedKind, rng: Rng, line = 0): number[] {
  if (seed === 'uniform') return new Array<number>(PLANTS).fill(MODEL.lines[line])
  return Array.from({ length: PLANTS }, () => variedGenetic(rng))
}

/** Grow a tray from given genetic values, in a soil, under a nutrient solution; `cap` limits how tall any plant can grow (poor soil). */
export function grow(genetics: readonly number[], soil: SoilKind, nutrients: Nutrients, rng: Rng, cap: number | null = null, options: { seed?: SeedKind; patchSd?: number } = {}): Tray {
  const plants = genetics.map((potential) => {
    // Poor soil limits how tall any plant can grow: a genetic value above the cap adds no more than the cap.
    const genetic = cap === null ? potential : Math.min(potential, cap)
    const environment = soil === 'patchy' ? (options.patchSd ?? MODEL.patchSd) * rng.normal() : 0
    const growth = MODEL.growthSd * rng.normal()
    const height = MODEL.meanHeight[nutrients] + genetic + environment + growth
    return { genetic, potential, environment, growth, height }
  })
  return { seed: options.seed ?? (new Set(genetics).size === 1 ? 'uniform' : 'varied'), soil, nutrients, plants }
}

export interface TrayStats {
  varianceGenetic: number
  varianceHeight: number
  /** var(genetic) / var(height); 0 when the heights do not vary. */
  heritability: number
  meanHeight: number
}

export function trayStats(t: Tray): TrayStats {
  const vg = variance(t.plants.map((p) => p.genetic))
  const vh = variance(t.plants.map((p) => p.height))
  return { varianceGenetic: vg, varianceHeight: vh, heritability: vh === 0 ? 0 : Math.min(1, vg / vh), meanHeight: mean(t.plants.map((p) => p.height)) }
}

/** Step 1: one tray from a seed and a soil, in the complete solution. */
export function oneTray(seed: SeedKind, soil: SoilKind, rng: Rng): Tray {
  return grow(drawGenetics(seed, rng), soil, 'complete', rng)
}

/** Step 1 as Jon asked for it (2026-11-11): the four combinations grown at once. The same 48 genetic values go into both varied-stock trays, so the two soils are compared on the same seed. */
export type FourTrays = Record<SeedKind, Record<SoilKind, Tray>>
export function fourTrays(rng: Rng): FourTrays {
  const varied = drawGenetics('varied', rng)
  const uniform = drawGenetics('uniform', rng)
  return {
    varied: { even: grow(varied, 'even', 'complete', rng), patchy: grow(varied, 'patchy', 'complete', rng) },
    uniform: { even: grow(uniform, 'even', 'complete', rng), patchy: grow(uniform, 'patchy', 'complete', rng) },
  }
}

/**
 * The earrings (spec §8.2, §12.3.5): 200 people, 100 of each sex, in a time
 * when only women wore earrings and in a time when anyone might. The
 * heritability of wearing one is computed from the same genes, the sex
 * chromosomes, in each: the variance of the group means over the variance of
 * wearing. It is a table of counts and two numbers, with no figures of people.
 */
export interface Earrings {
  time: string
  womenWearing: number
  menWearing: number
  of: number
  heritability: number
}

export function earrings(womenWearing: number, menWearing: number, of = 100): Earrings {
  const wearing = [...new Array<number>(womenWearing).fill(1), ...new Array<number>(of - womenWearing).fill(0), ...new Array<number>(menWearing).fill(1), ...new Array<number>(of - menWearing).fill(0)]
  const groupMean = [...new Array<number>(of).fill(womenWearing / of), ...new Array<number>(of).fill(menWearing / of)]
  const vh = variance(wearing)
  return { time: '', womenWearing, menWearing, of, heritability: vh === 0 ? 0 : variance(groupMean) / vh }
}

export const EARRINGS = {
  then: { ...earrings(100, 0), time: 'a time when only women wore earrings' },
  now: { ...earrings(50, 50), time: 'a time when anyone might' },
}

/**
 * Step 2: Lewontin's two experiments (spec §8.3; lewontin_1970 pp. 7–8). The
 * first: two uniform lines, different from each other, in the same even
 * soil. The second: seed from one varied stock in two trays, one in the
 * complete solution and one with half the nitrates and no zinc, each in even
 * soil; the same 48 genetic values go into both trays, so the difference
 * between the trays is from the nutrients by construction.
 */
export function lewontinFirst(rng: Rng): [Tray, Tray] {
  return [grow(drawGenetics('uniform', rng, 0), 'even', 'complete', rng), grow(drawGenetics('uniform', rng, 1), 'even', 'complete', rng)]
}

export function lewontinSecond(rng: Rng, nutrients: Nutrients = 'deficient'): [Tray, Tray] {
  const genetics = drawGenetics('varied', rng)
  return [grow(genetics, 'even', 'complete', rng), grow(genetics, 'even', nutrients, rng)]
}

/**
 * Step 3: twins (spec §8.4). A simulated population of 500 pairs of
 * identical twins and 500 pairs of fraternal twins, on one trait. Three
 * shares of the trait's variance come from genes, from the environment the
 * twins share, and from the rest; a fourth share is environment shared only
 * by identical twins. Identical twins share all their genes; fraternal twins
 * share half, on average, as the additive model has it.
 */
export const TWIN_PAIRS = 500

export interface TwinShares {
  genes: number
  shared: number
  rest: number
  /** Environment shared by identical twins only (“Identical twins treated more alike”). */
  identicalOnly: number
}

export interface TwinResults {
  identical: number
  fraternal: number
  /** Twice the difference, the standard estimate (§12.3.5). */
  estimate: number
  /** The true share from genes that the simulation used, of the total variance including the identical-only share. */
  trueShare: number
  /** Each pair's two trait values, in units of the trait's spread, for the scatter plots: identical pairs and fraternal pairs. */
  pairs: { identical: [number[], number[]]; fraternal: [number[], number[]] }
}

export function correlation(x: number[], y: number[]): number {
  const mx = mean(x)
  const my = mean(y)
  let sxy = 0
  let sxx = 0
  let syy = 0
  for (let i = 0; i < x.length; i++) {
    sxy += (x[i] - mx) * (y[i] - my)
    sxx += (x[i] - mx) ** 2
    syy += (y[i] - my) ** 2
  }
  return sxx === 0 || syy === 0 ? 0 : sxy / Math.sqrt(sxx * syy)
}

export function twins(shares: TwinShares, rng: Rng, pairs = TWIN_PAIRS): TwinResults {
  const sg = Math.sqrt(Math.max(0, shares.genes))
  const sc = Math.sqrt(Math.max(0, shares.shared))
  const se = Math.sqrt(Math.max(0, shares.rest))
  const sd = Math.sqrt(Math.max(0, shares.identicalOnly))
  const mz: [number[], number[]] = [[], []]
  const dz: [number[], number[]] = [[], []]
  for (let i = 0; i < pairs; i++) {
    const g = rng.normal()
    const c = rng.normal()
    const d = rng.normal()
    mz[0].push(sg * g + sc * c + sd * d + se * rng.normal())
    mz[1].push(sg * g + sc * c + sd * d + se * rng.normal())
    // Fraternal twins: each gets half the shared genetic draw and half its own, so their genetic values correlate 0.5.
    const gs = rng.normal()
    const c2 = rng.normal()
    dz[0].push(sg * (Math.SQRT1_2 * gs + Math.SQRT1_2 * rng.normal()) + sc * c2 + se * rng.normal())
    dz[1].push(sg * (Math.SQRT1_2 * gs + Math.SQRT1_2 * rng.normal()) + sc * c2 + se * rng.normal())
  }
  const identical = correlation(mz[0], mz[1])
  const fraternal = correlation(dz[0], dz[1])
  const total = shares.genes + shares.shared + shares.rest + shares.identicalOnly
  return { identical, fraternal, estimate: 2 * (identical - fraternal), trueShare: total === 0 ? 0 : shares.genes / total, pairs: { identical: mz, fraternal: dz } }
}

/** The preset that reproduces the chapter's figures: correlations of about 0.71 and 0.44 and an estimate of about 0.54 (§12.3.5). */
export const TWIN_PRESET: TwinShares = { genes: 0.54, shared: 0.17, rest: 0.29, identicalOnly: 0 }

/**
 * Step 4 (spec §8.5): the same varied stock in a poor soil that limits how
 * tall any plant can grow, and in a rich soil that does not; and six seasons
 * of improving soil, the stock resampled each season, the mean rising by
 * about a standard deviation of the first season's heights while the
 * heritability within each season stays high.
 */
/** In poor soil no plant's genes add more than this to its height, centimeters: the limit is below the stock's mean, so most plants grow to the limit. */
export const POOR_SOIL_CAP = -10
/** The spread of patches in Step 4's soils, centimeters, the same in the poor and the rich. */
export const STEP4_PATCH_SD = 8

export function poorAndRich(rng: Rng): [Tray, Tray] {
  const genetics = drawGenetics('varied', rng)
  return [grow(genetics, 'patchy', 'complete', rng, POOR_SOIL_CAP, { patchSd: STEP4_PATCH_SD, seed: 'varied' }), grow(genetics, 'patchy', 'complete', rng, null, { patchSd: STEP4_PATCH_SD, seed: 'varied' })]
}

export const SEASONS = 6

export function seasons(rng: Rng): { tray: Tray; stats: TrayStats; season: number; rise: number }[] {
  const first = grow(drawGenetics('varied', rng), 'even', 'complete', rng)
  const sd0 = Math.sqrt(trayStats(first).varianceHeight)
  const out: { tray: Tray; stats: TrayStats; season: number; rise: number }[] = []
  for (let s = 0; s < SEASONS; s++) {
    const rise = (sd0 * s) / (SEASONS - 1)
    const genetics = drawGenetics('varied', rng)
    const t = grow(genetics, 'even', 'complete', rng)
    const lifted: Tray = { ...t, plants: t.plants.map((p) => ({ ...p, environment: p.environment + rise, height: p.height + rise })) }
    out.push({ tray: lifted, stats: trayStats(lifted), season: s + 1, rise })
  }
  return out
}
