import type { Rng } from '../../random'
import { expectedValue, gamble, mixed, reject, sure, type Option } from './options'
import { answer, finished, indifference, startBisection, type Bisection } from './bisection'

/**
 * Part 1, Step 1 — Gambles (spec §5.2): about 30 choices in five kinds. A.
 * Four pairs, each in a gain and a loss version, separated by at least five
 * other items. B. Two certainty equivalents by bisection. C. Mixed gambles by
 * bisection, giving the loss ratio. D. The framing problem, in one version
 * only, in the middle third. E. An anchor, which opens the step. The order
 * and the sides are set by the seed. Every amount here is hypothetical.
 */

export type PairId = 1 | 2 | 3 | 4
export type Version = 'gain' | 'loss'

export interface PairItem {
  kind: 'pair'
  pair: PairId
  version: Version
  options: [Option, Option]
  /** Which option the published share counts: the sure option for pairs 1 and 2, the more probable option for pairs 3 and 4. */
  counted: 0 | 1
  countedLabel: string
  /** The source of the published share for this version. */
  source: { citation: string; where: string; share: number; n: number }
}

const KT79 = 'Kahneman and Tversky (1979)'
const TK81 = 'Tversky and Kahneman (1981)'

/**
 * The four pairs. Pair 1 is Kahneman and Tversky's (1979) Problem 3 and 3′,
 * in Israeli pounds there and the same numbers in dollars here; pair 2 is
 * Tversky and Kahneman's (1981) Problem 3; pairs 3 and 4 are Problems 7/7′
 * and 8/8′ of 1979, which Ruggeri et al. (2020) replicated (as items 5 and 9
 * in every country, and 6 and 10 in 84% of countries). Checked against
 * kahneman_1979 Table I, p. 268, and tversky_1981 p. 454 on 2026-11-08.
 */
export const PAIRS: Record<PairId, Record<Version, Omit<PairItem, 'kind' | 'pair' | 'version'>>> = {
  1: {
    gain: { options: [sure(3000), gamble(4000, 0.8)], counted: 0, countedLabel: 'the sure gain', source: { citation: KT79, where: 'Table I, Problem 3, p. 268', share: 0.8, n: 95 } },
    loss: { options: [sure(-3000), gamble(-4000, 0.8)], counted: 0, countedLabel: 'the sure loss', source: { citation: KT79, where: 'Table I, Problem 3′, p. 268', share: 0.08, n: 95 } },
  },
  2: {
    gain: { options: [sure(240), gamble(1000, 0.25)], counted: 0, countedLabel: 'the sure gain', source: { citation: TK81, where: 'Problem 3, p. 454', share: 0.84, n: 150 } },
    loss: { options: [sure(-750), gamble(-1000, 0.75)], counted: 0, countedLabel: 'the sure loss', source: { citation: TK81, where: 'Problem 3, p. 454', share: 0.13, n: 150 } },
  },
  3: {
    gain: { options: [gamble(3000, 0.9), gamble(6000, 0.45)], counted: 0, countedLabel: 'the more probable gain', source: { citation: KT79, where: 'Table I, Problem 7, p. 268', share: 0.86, n: 66 } },
    loss: { options: [gamble(-3000, 0.9), gamble(-6000, 0.45)], counted: 0, countedLabel: 'the more probable loss', source: { citation: KT79, where: 'Table I, Problem 7′, p. 268', share: 0.08, n: 66 } },
  },
  4: {
    gain: { options: [gamble(3000, 0.002), gamble(6000, 0.001)], counted: 0, countedLabel: 'the more probable gain', source: { citation: KT79, where: 'Table I, Problem 8, p. 268', share: 0.27, n: 66 } },
    loss: { options: [gamble(-3000, 0.002), gamble(-6000, 0.001)], counted: 0, countedLabel: 'the more probable loss', source: { citation: KT79, where: 'Table I, Problem 8′, p. 268', share: 0.7, n: 66 } },
  },
}

export interface SeriesItem {
  kind: 'series'
  /** Which series: the certainty equivalent of a 50% chance of gaining $100; of losing $100; or the mixed gambles. */
  series: 'ceGain' | 'ceLoss' | 'mixed'
  /** The choice within the series, 0 to 5. */
  index: number
}

export interface FramingItem {
  kind: 'disease'
  /** 0: the published problem; 1: the reserve, used after an interrupted sitting that had already shown the first. */
  materials: 0 | 1
  version: 'saved' | 'lost'
}

export interface AnchorItem {
  kind: 'wheel'
  materials: 0 | 1
  /** Where the wheel stops: 10 or 65, by the seed. */
  anchor: 10 | 65
}

export type Item = PairItem | SeriesItem | FramingItem | AnchorItem

export const CE_AMOUNT = 100
export const MIXED_LOSS = 50
export const MIXED_MAX = 250

/** The fixed option of each series, and the varying one at amount x. */
export function seriesOptions(series: SeriesItem['series'], x: number): { fixed: Option; varying: Option; fixedFirst: boolean } {
  switch (series) {
    case 'ceGain':
      return { fixed: gamble(CE_AMOUNT, 0.5), varying: sure(x), fixedFirst: true }
    case 'ceLoss':
      return { fixed: gamble(-CE_AMOUNT, 0.5), varying: sure(-x), fixedFirst: true }
    case 'mixed':
      return { fixed: reject, varying: mixed(x, MIXED_LOSS), fixedFirst: false }
  }
}

/** A fresh bisection for a series. For a sure gain against the gamble, taking the sure amount means X was high enough, so X falls; for a sure loss, taking the sure loss means X was small enough, so X rises; accepting a mixed gamble means X was high enough, so X falls. */
export function startSeries(series: SeriesItem['series']): Bisection {
  switch (series) {
    case 'ceGain':
      return startBisection(0, CE_AMOUNT, true)
    case 'ceLoss':
      return startBisection(0, CE_AMOUNT, false)
    case 'mixed':
      return startBisection(0, MIXED_MAX, true)
  }
}

export const FRAMING = {
  /** Tversky and Kahneman (1981), Problem 1 and 2, p. 453, with the place name removed as in the reading (§12.2.5). */
  published: {
    intro: 'Imagine that the country is preparing for the outbreak of an unusual disease, which is expected to kill 600 people. Two alternative programs to combat the disease have been proposed. Assume that the exact scientific estimates of the consequences of the programs are as follows.',
    saved: ['If Program A is adopted, 200 people will be saved.', 'If Program B is adopted, there is a one-third probability that 600 people will be saved, and a two-thirds probability that no people will be saved.'],
    lost: ['If Program C is adopted, 400 people will die.', 'If Program D is adopted, there is a one-third probability that nobody will die, and a two-thirds probability that 600 people will die.'],
    question: 'Which of the two programs would you favor?',
    certain: 0,
  },
  /** A reserve of the same structure about a different danger, with other numbers. It has no published reference, and its panel says so. */
  reserve: {
    intro: 'Imagine that a region is preparing for a wildfire that is expected to destroy 300 homes. Two alternative plans to fight the fire have been proposed. Assume that the exact estimates of the consequences of the plans are as follows.',
    saved: ['If Plan A is adopted, 100 homes will be saved.', 'If Plan B is adopted, there is a one-third probability that 300 homes will be saved, and a two-thirds probability that no homes will be saved.'],
    lost: ['If Plan C is adopted, 200 homes will be destroyed.', 'If Plan D is adopted, there is a one-third probability that no homes will be destroyed, and a two-thirds probability that 300 homes will be destroyed.'],
    question: 'Which of the two plans would you favor?',
    certain: 0,
  },
} as const

export const ANCHOR = {
  /** Tversky and Kahneman (1974), p. 1128. */
  published: { quantity: 'the percentage of African countries in the United Nations', unit: 'percent' },
  /** A reserve with the same two anchors and no published reference. */
  reserve: { quantity: 'the percentage of the world’s people who live in Africa', unit: 'percent' },
  anchors: [10, 65] as const,
} as const

export interface Plan {
  /** The items in order. Series items are consecutive; the anchor comes first. */
  items: Item[]
  /** Which side Option A is on for each item: 0 keeps the options' order, 1 swaps them. */
  swap: boolean[]
  framingVersion: 'saved' | 'lost'
  anchor: 10 | 65
}

export const MIN_SEPARATION = 5

/**
 * The order of the step, from the seed: the anchor first; the eight pair
 * items, the three series and the framing problem shuffled, with the two
 * versions of a pair at least five items apart and the framing problem in
 * the middle third; the sides of every item drawn.
 */
export function planGambles(rng: Rng, materials: { framing: 0 | 1; anchor: 0 | 1 } = { framing: 0, anchor: 0 }): Plan {
  const framingVersion: 'saved' | 'lost' = rng.next() < 0.5 ? 'saved' : 'lost'
  const anchor = ANCHOR.anchors[rng.int(2)]
  const pairItems: PairItem[] = ([1, 2, 3, 4] as PairId[]).flatMap((pair) => (['gain', 'loss'] as Version[]).map((version) => ({ kind: 'pair' as const, pair, version, ...PAIRS[pair][version] })))
  const blocks: Item[][] = [
    ...pairItems.map((p) => [p]),
    Array.from({ length: 6 }, (_, i): SeriesItem => ({ kind: 'series', series: 'ceGain', index: i })),
    Array.from({ length: 6 }, (_, i): SeriesItem => ({ kind: 'series', series: 'ceLoss', index: i })),
    Array.from({ length: 6 }, (_, i): SeriesItem => ({ kind: 'series', series: 'mixed', index: i })),
    [{ kind: 'disease', materials: materials.framing, version: framingVersion }],
  ]
  for (let attempt = 0; attempt < 10000; attempt++) {
    const order = shuffle(blocks, rng).flat()
    if (acceptable(order)) {
      const items: Item[] = [{ kind: 'wheel', materials: materials.anchor, anchor }, ...order]
      return { items, swap: items.map(() => rng.next() < 0.5), framingVersion, anchor }
    }
  }
  throw new Error('no acceptable order in 10,000 draws')
}

export function acceptable(order: Item[]): boolean {
  for (const pair of [1, 2, 3, 4] as PairId[]) {
    const g = order.findIndex((it) => it.kind === 'pair' && it.pair === pair && it.version === 'gain')
    const l = order.findIndex((it) => it.kind === 'pair' && it.pair === pair && it.version === 'loss')
    if (Math.abs(g - l) - 1 < MIN_SEPARATION) return false
  }
  const f = order.findIndex((it) => it.kind === 'disease')
  const n = order.length
  if (f < Math.floor(n / 3) || f > Math.ceil((2 * n) / 3)) return false
  return true
}

function shuffle<T>(xs: T[], rng: Rng): T[] {
  const a = [...xs]
  for (let i = a.length - 1; i > 0; i--) {
    const j = rng.int(i + 1)
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** The responses to Step 1, as saved. */
export interface GambleResponses {
  /** For each pair item: which option index (in the pair's own order) was chosen. */
  pairs: Partial<Record<`${PairId}-${Version}`, 0 | 1>>
  series: { ceGain: Bisection; ceLoss: Bisection; mixed: Bisection }
  /** The framing choice: 0 the certain program, 1 the gamble; and which materials were shown. */
  framing: { choice: 0 | 1; version: 'saved' | 'lost'; materials: 0 | 1 } | null
  anchor: { anchor: 10 | 65; higher: boolean; estimate: number; materials: 0 | 1 } | null
}

export function emptyResponses(): GambleResponses {
  return { pairs: {}, series: { ceGain: startSeries('ceGain'), ceLoss: startSeries('ceLoss'), mixed: startSeries('mixed') }, framing: null, anchor: null }
}

/** Record one series choice. */
export function answerSeries(r: GambleResponses, series: SeriesItem['series'], tookVarying: boolean): GambleResponses {
  return { ...r, series: { ...r.series, [series]: answer(r.series[series], tookVarying) } }
}

export function seriesDone(r: GambleResponses, series: SeriesItem['series']): boolean {
  return finished(r.series[series])
}

/** The reveal's numbers (spec §5.2). */
export interface GambleResults {
  /** Every money choice: the two options' expected values, the chosen one, and whether it had the higher expected value. */
  choices: { label: string; evA: number; evB: number; chose: 0 | 1; higher: 0 | 1 | null; domain: 'gain' | 'loss' | 'mixed' }[]
  againstHigher: { gains: number; losses: number; mixed: number; of: number }
  certaintyEquivalents: { gain: number; loss: number }
  lossRatio: number
  framing: { version: 'saved' | 'lost'; choseCertain: boolean; materials: 0 | 1 } | null
  anchor: { anchor: 10 | 65; estimate: number; materials: 0 | 1 } | null
}

export function gambleResults(r: GambleResponses): GambleResults {
  const choices: GambleResults['choices'] = []
  const against = { gains: 0, losses: 0, mixed: 0, of: 0 }
  const note = (label: string, a: Option, b: Option, chose: 0 | 1, domain: 'gain' | 'loss' | 'mixed') => {
    const evA = expectedValue(a)
    const evB = expectedValue(b)
    const higher: 0 | 1 | null = Math.abs(evA - evB) < 1e-9 ? null : evA > evB ? 0 : 1
    choices.push({ label, evA, evB, chose, higher, domain })
    if (higher !== null) {
      against.of++
      if (chose !== higher) against[domain === 'gain' ? 'gains' : domain === 'loss' ? 'losses' : 'mixed']++
    }
  }
  for (const pair of [1, 2, 3, 4] as PairId[])
    for (const version of ['gain', 'loss'] as Version[]) {
      const chose = r.pairs[`${pair}-${version}`]
      if (chose === undefined) continue
      const p = PAIRS[pair][version]
      note(`Pair ${pair}, ${version} version`, p.options[0], p.options[1], chose, version)
    }
  for (const series of ['ceGain', 'ceLoss', 'mixed'] as const) {
    const b = r.series[series]
    // Replay the series to recover each offered amount.
    let s = startSeries(series)
    for (const took of b.took) {
      const { fixed, varying } = seriesOptions(series, s.x)
      note(`${series === 'ceGain' ? 'Sure amount against a 50% chance of $100' : series === 'ceLoss' ? 'Sure loss against a 50% chance of losing $100' : 'Accept or reject a mixed gamble'}, choice ${s.took.length + 1}`, fixed, varying, took ? 1 : 0, series === 'ceGain' ? 'gain' : series === 'ceLoss' ? 'loss' : 'mixed')
      s = answer(s, took)
    }
  }
  const ceGain = indifference(r.series.ceGain)
  const ceLoss = -indifference(r.series.ceLoss)
  const lossRatio = indifference(r.series.mixed) / MIXED_LOSS
  return {
    choices,
    againstHigher: against,
    certaintyEquivalents: { gain: ceGain, loss: ceLoss },
    lossRatio,
    framing: r.framing ? { version: r.framing.version, choseCertain: r.framing.choice === 0, materials: r.framing.materials } : null,
    anchor: r.anchor ? { anchor: r.anchor.anchor, estimate: r.anchor.estimate, materials: r.anchor.materials } : null,
  }
}

/** A scripted chooser for the tests: it takes the option with the higher utility under u. */
export function scriptedChooser(u: (amount: number) => number): (a: Option, b: Option) => 0 | 1 {
  const eu = (o: Option) => o.outcomes.reduce((s, x) => s + u(x.amount) * x.p, 0)
  return (a, b) => (eu(a) >= eu(b) ? 0 : 1)
}
