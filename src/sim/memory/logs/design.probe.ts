import { it } from 'vitest'
import { makeRng, type Rng } from '../../random'
import { FastStore, SeparationStage, driftContext, freshContext, nightInput, SEPARATIONS, type Separation } from '../foragers/store'
import { featureVector, letterFeatures, letterOf, pairKind, type WeekOrder } from './features'

/**
 * A simulation of Part 4's design (spec §14, Part 4, revised 2026-10-27),
 * reported before the scene is rebuilt. Two parts, both at the level of
 * decisions rather than of a walking body:
 *
 * 1. The fast store on a week of six nights in each of the two orders,
 *    AABCCD and ABBBCD, at the three separation settings: its share of
 *    when-errors on each night from 3 to 6, so that the effect of a
 *    look-alike pair can be read by night position and by order (the two
 *    orders are not the same condition: with the pair at nights 4 and 5,
 *    night 4 itself looks like both nights being told apart).
 *
 * 2. Synthetic students whose errors fall with practice, plus an effect of
 *    look-alike nights of a chosen size: how often one student's comparison
 *    (share after a look-alike pair against share after a different pair)
 *    comes out in the predicted direction, under the week and under the two
 *    blocks of three it replaces, over 2,000 students per cell.
 *
 *   PROBE=1 PROBE_DIR=src/sim/memory/logs npx vitest run --disable-console-intercept -t "design:"
 */

const say = (s: string) => console.log(`m10 design · ${s}`)
const f2 = (x: number) => x.toFixed(2)
const pct = (x: number) => `${Math.round(100 * x)}%`

type Order = WeekOrder
const ORDERS: Order[] = ['AABCCD', 'ABBBCD']
const LOOSE = 7
const DIGS_PER_NIGHT = 4

/** Night n (3 to 6) follows a look-alike pair when nights n − 2 and n − 1 share a letter (`pairKind`). */
const followsAlike = (order: Order, night: number): boolean => pairKind(order, night) === 'after a look-alike pair'

function shuffled<T>(xs: readonly T[], rng: Rng): T[] {
  const out = [...xs]
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng.int(i + 1)
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

interface StoreWeek {
  /** Per night 3 to 6: when-errors over every log at stake (a log not reached counts as a decision without error). */
  shareAll: number[]
  /** Per night 3 to 6: when-errors over visited logs only (dug, or deliberately skipped as emptied last night). */
  shareVisited: number[]
  atStake: number[]
  beetles: number
}

/**
 * The store over one week: a forager that digs up to four logs a night among
 * those the store does not treat as emptied last night, as Part 5's Tonight
 * too does, with the context drifting as in `foragers.ts`.
 */
function runStoreWeek(order: Order, sep: Separation | null, seed: number): StoreWeek {
  const rng = makeRng(seed ^ 0xd51)
  const letters = letterFeatures(rng.fork())
  const store = sep ? new FastStore(new SeparationStage(sep, rng.fork())) : null
  const contextRng = rng.fork()
  const decideRng = rng.fork()
  const orderRng = rng.fork()
  let context = freshContext(contextRng)
  let last: (number | null)[] = new Array(LOOSE).fill(null)
  let lastInput: number[] | null = null
  const out: StoreWeek = { shareAll: [], shareVisited: [], atStake: [], beetles: 0 }
  for (let n = 1; n <= 6; n++) {
    if (n > 1) context = driftContext(context, contextRng)
    const input = nightInput(featureVector(letters[letterOf(order, n)]), context)
    let treated: boolean[] = new Array(LOOSE).fill(false)
    if (store && n > 1 && lastInput) {
      const r = store.retrieve(lastInput)
      treated = r.blended.map((b) => decideRng.next() < b)
    }
    const digs = shuffled(
      Array.from({ length: LOOSE }, (_, i) => i).filter((i) => !treated[i]),
      orderRng,
    ).slice(0, DIGS_PER_NIGHT)
    const emptied = new Array<boolean>(LOOSE).fill(false)
    for (const i of digs) if (last[i] !== n - 1) emptied[i] = true
    out.beetles += emptied.filter(Boolean).length
    if (n >= 3) {
      let stake = 0
      let visited = 0
      let err = 0
      for (let i = 0; i < LOOSE; i++) {
        if (last[i] === n - 1) {
          stake++
          if (digs.includes(i)) {
            visited++
            err++
          } else visited++ // skipped as emptied: a correct visit
        } else if (last[i] === n - 2) {
          stake++
          if (digs.includes(i)) visited++
          else if (treated[i]) {
            visited++
            err++
          }
        }
      }
      out.atStake.push(stake)
      out.shareAll.push(stake ? err / stake : 0)
      out.shareVisited.push(visited ? err / visited : 0)
    }
    store?.store(input, emptied.map((e) => (e ? 1 : 0)), `night ${n}`)
    lastInput = input
    last = last.map((l, i) => (emptied[i] ? n : l))
  }
  return out
}

const mean = (xs: readonly number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)

it('design: the store’s share of when-errors by night position, each order, each setting', () => {
  const seeds = Array.from({ length: 60 }, (_, i) => 3000 + i)
  say('A log skipped as emptied last night counts as a visit; a log not reached counts in "all" but not in "visited".')
  for (const sep of [...SEPARATIONS, null] as (Separation | null)[]) {
    for (const order of ORDERS) {
      const weeks = seeds.map((s) => runStoreWeek(order, sep, s))
      const byNight = [0, 1, 2, 3].map((k) => ({ all: mean(weeks.map((w) => w.shareAll[k])), vis: mean(weeks.map((w) => w.shareVisited[k])), stake: mean(weeks.map((w) => w.atStake[k])) }))
      const alikeNights = [3, 4, 5, 6].filter((n) => followsAlike(order, n))
      const differNights = [3, 4, 5, 6].filter((n) => !followsAlike(order, n))
      const kind = (ns: number[], key: 'all' | 'vis') => mean(ns.map((n) => byNight[n - 3][key]))
      say(
        `${sep ?? 'no store'} · ${order} · share (all) nights 3/4/5/6: ${byNight.map((b) => f2(b.all)).join(' / ')} · (visited): ${byNight.map((b) => f2(b.vis)).join(' / ')} · at stake: ${byNight.map((b) => b.stake.toFixed(1)).join(' / ')} · beetles/week ${mean(weeks.map((w) => w.beetles)).toFixed(1)}`,
      )
      say(
        `   after look-alike pair (nights ${alikeNights.join(',')}) all ${f2(kind(alikeNights, 'all'))} visited ${f2(kind(alikeNights, 'vis'))} · after different pair (nights ${differNights.join(',')}) all ${f2(kind(differNights, 'all'))} visited ${f2(kind(differNights, 'vis'))}`,
      )
    }
  }
})

/** A synthetic student's practice curve: the per-decision error probability on each night, 1 to 6. */
interface Curve {
  name: string
  start: [number, number]
  endRatio: [number, number]
}
const CURVES: Curve[] = [
  { name: 'steep (errors fall from about 0.60 to 0.25)', start: [0.5, 0.7], endRatio: [0.3, 0.5] },
  { name: 'mild (about 0.50 to 0.40)', start: [0.4, 0.6], endRatio: [0.7, 0.9] },
  { name: 'flat (about 0.45 throughout)', start: [0.35, 0.55], endRatio: [1, 1] },
]
const EFFECTS = [0, 0.04, 0.1, 0.2]
const STUDENTS = 2000

type Design = { name: string; alike: (night: number) => boolean; test: number[] }

const DESIGNS: Design[] = [
  { name: 'week AABCCD', alike: (n) => followsAlike('AABCCD', n), test: [3, 4, 5, 6] },
  { name: 'week ABBBCD', alike: (n) => followsAlike('ABBBCD', n), test: [3, 4, 5, 6] },
  // The two blocks of three the week replaces: nights 1 to 3 one block, 4 to 6 the other; its test nights are each
  // block's nights 2 and 3, and the look-alike block's nights are the ones with the effect.
  { name: 'blocks, look-alike first', alike: (n) => n <= 3, test: [2, 3, 5, 6] },
  { name: 'blocks, distinct first', alike: (n) => n >= 4, test: [2, 3, 5, 6] },
]

function simulateStudent(rng: Rng, curve: Curve, effect: number, design: Design): number | null {
  const e1 = rng.range(curve.start[0], curve.start[1])
  const e6 = e1 * rng.range(curve.endRatio[0], curve.endRatio[1])
  let errA = 0
  let decA = 0
  let errD = 0
  let decD = 0
  for (const n of design.test) {
    const base = e1 + ((e6 - e1) * (n - 1)) / 5
    const alike = design.alike(n)
    const p = Math.min(1, Math.max(0, base + (alike ? effect : 0)))
    const k = 4 + rng.int(3)
    let err = 0
    for (let i = 0; i < k; i++) if (rng.next() < p) err++
    if (alike) {
      errA += err
      decA += k
    } else {
      errD += err
      decD += k
    }
  }
  if (!decA || !decD) return null
  return errA / decA - errD / decD
}

it('design: how often one student’s comparison comes out in the predicted direction', () => {
  const rng = makeRng(0x5e51)
  say(`${STUDENTS} students per cell; 4 to 6 decisions a night; the share after look-alike pairs minus the share after different pairs.`)
  for (const curve of CURVES) {
    say(`practice curve: ${curve.name}`)
    for (const effect of EFFECTS) {
      const row: string[] = []
      for (const design of DESIGNS) {
        let up = 0
        let down = 0
        let tie = 0
        const diffs: number[] = []
        for (let s = 0; s < STUDENTS; s++) {
          const d = simulateStudent(rng, curve, effect, design)
          if (d === null) continue
          diffs.push(d)
          if (d > 1e-9) up++
          else if (d < -1e-9) down++
          else tie++
        }
        const n = up + down + tie
        row.push(`${design.name}: predicted ${pct(up / n)}, reversed ${pct(down / n)}, tie ${pct(tie / n)}, mean diff ${(mean(diffs) >= 0 ? '+' : '')}${f2(mean(diffs))}`)
      }
      say(`  effect ${f2(effect)} · ` + row.join(' · '))
    }
  }
})
