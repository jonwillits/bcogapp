import { makeRng, type Rng } from '../random'
import { runDay, type DayResult } from './day'
import { NEED_TABLE, type Cue, type Need } from './range/needs'
import type { Hominin, HomininKind } from './hominins/types'
import { Adapted } from './hominins/adapted'
import { LearnedValue } from './hominins/learnedValue'
import { Copier } from './hominins/copier'
import { Planner, ShallowPlanner, type ShallowVariant } from './hominins/planners'

/**
 * The days before the lab (spec §7.4.2). Each hidden hominin lives a seeded
 * history of days in the same range. The carcass need arrives on most days
 * and the marrow need on most of the rest; on the few days of termites or
 * tubers, the elder leaves camp before the others wake, so there is nothing
 * to copy, and what she finds is used up before anyone else arrives, while
 * the hidden hominins see her at work later in the day. So every step of the
 * termite and tuber chains has happened in each hominin's sight, and no
 * hidden hominin has ever been rewarded for carrying a probe or a digging
 * stick. `history.test.ts` checks both on the printed counts.
 */

export const HISTORY: { days: number; mix: Record<Need, number> } = {
  days: 500,
  /** The chance of each need's day. The usual needs are about 70% carcasses and 30% marrow between them. */
  mix: { carcass: 0.62, marrow: 0.26, termites: 0.06, tubers: 0.06 },
}

export interface HistoryCounts {
  kind: HomininKind
  days: number
  deviations: number
  /** Rewards by need. */
  ate: Record<Need, number>
  /** The elder's acts seen, by kind. */
  sawElder: Record<string, number>
  /** Its own acts, by kind. */
  own: Record<string, number>
  /** How often it ended the day at each need's place holding what the need takes. */
  readyFor: Record<Need, number>
}

export interface Band {
  seed: number
  hominins: { adapted: Adapted; learnedValue: LearnedValue; copier: Copier; shallowA: ShallowPlanner; shallowB: ShallowPlanner; planner: Planner }
  counts: HistoryCounts[]
  dayKinds: Need[]
}

function drawNeed(rng: Rng): Need {
  const u = rng.next()
  let acc = 0
  for (const n of ['carcass', 'marrow', 'termites', 'tubers'] as Need[]) {
    acc += HISTORY.mix[n]
    if (u < acc) return n
  }
  return 'carcass'
}

export function newBand(seed: number): Band['hominins'] {
  const rng = makeRng(seed ^ 0x9e3779b9)
  return {
    adapted: new Adapted(),
    learnedValue: new LearnedValue(rng.fork()),
    copier: new Copier(rng.fork()),
    shallowA: new ShallowPlanner(rng.fork(), 'A'),
    shallowB: new ShallowPlanner(rng.fork(), 'B'),
    planner: new Planner(rng.fork()),
  }
}

function emptyCounts(kind: HomininKind): HistoryCounts {
  const z = () => ({ carcass: 0, marrow: 0, termites: 0, tubers: 0 })
  return { kind, days: 0, deviations: 0, ate: z(), sawElder: {}, own: {}, readyFor: z() }
}

/**
 * The history, lived a few days at a time, so that a screen can pay for it in
 * slices (`APP_DESIGN.md`: nothing synchronous over about 300 ms sits on a
 * click path). `step(n)` lives up to n more days; `liveHistory` below runs it
 * to the end at once, and `history.test.ts` checks that the two agree.
 */
export class HistoryRun {
  readonly seed: number
  readonly days: number
  readonly hominins: Band['hominins']
  readonly counts: HistoryCounts[]
  readonly dayKinds: Need[] = []
  private readonly list: Hominin[]
  private readonly rng: Rng
  private lived = 0

  constructor(seed: number, days = HISTORY.days) {
    this.seed = seed
    this.days = days
    this.hominins = newBand(seed)
    this.list = [this.hominins.adapted, this.hominins.learnedValue, this.hominins.copier, this.hominins.shallowA, this.hominins.shallowB, this.hominins.planner]
    this.counts = this.list.map((h) => emptyCounts(h.kind))
    this.rng = makeRng(seed)
  }

  get done(): boolean {
    return this.lived >= this.days
  }

  /** Days lived so far. */
  get progress(): number {
    return this.lived
  }

  /** Live up to `n` more days; returns whether the history is complete. */
  step(n: number): boolean {
    for (let k = 0; k < n && this.lived < this.days; k++) {
      const need = drawNeed(this.rng)
      this.dayKinds.push(need)
      const usual = need === 'carcass' || need === 'marrow'
      const result = runDay({ cue: NEED_TABLE[need].cue, needPresent: usual, elder: usual ? 'atCamp' : 'away' }, this.list, this.rng)
      tally(this.counts, result, need)
      this.lived++
    }
    return this.done
  }

  band(): Band {
    if (!this.done) throw new Error('the history is not complete')
    const counts = this.counts.map((c) => ({ ...c }))
    counts[3].kind = 'shallow'
    counts[4].kind = 'shallow'
    return { seed: this.seed, hominins: this.hominins, counts, dayKinds: this.dayKinds }
  }
}

/** Live the history at once: the six hominins (the Shallow planner in both variants) through the same days with the same elder. */
export function liveHistory(seed: number, days = HISTORY.days): Band {
  const run = new HistoryRun(seed, days)
  run.step(days)
  return run.band()
}

function tally(counts: HistoryCounts[], result: DayResult, need: Need): void {
  const elderActs = result.elder.segments.map((s) => (s.kind === 'make' ? `make ${s.what}` : s.kind === 'pickUp' ? `pick up ${s.item}` : s.kind === 'wait' ? `wait at ${s.place}` : null)).filter((x): x is string => x !== null)
  if (result.elder.ate) elderActs.push(`eat ${need}`)
  result.hominins.forEach((hd, i) => {
    const c = counts[i]
    c.days++
    if (hd.deviated) c.deviations++
    if (hd.ate) c.ate[need]++
    for (const a of elderActs) c.sawElder[a] = (c.sawElder[a] ?? 0) + 1
    for (const s of hd.segments) {
      const k = s.kind === 'make' ? `make ${s.what}` : s.kind === 'pickUp' ? `pick up ${s.item}` : s.kind === 'wait' ? `wait at ${s.place}` : null
      if (k) c.own[k] = (c.own[k] ?? 0) + 1
    }
    for (const n of ['carcass', 'marrow', 'termites', 'tubers'] as Need[]) {
      const spec = NEED_TABLE[n]
      if (hd.final.place === spec.place && hd.final.hands.includes(spec.takes)) c.readyFor[n]++
    }
  })
}

/** The five hidden hominins for a run, fresh copies from the end of the history, with the Shallow planner in one variant. */
export function bandForRun(band: Band, variant: ShallowVariant, rng: Rng): Hominin[] {
  const h = band.hominins
  const shallow = variant === 'A' ? h.shallowA : h.shallowB
  // Each copy gets a stream forked from the run's, in a fixed order, so the same run seed gives the same run whichever variant is in it.
  return [h.adapted, h.learnedValue, h.copier, shallow, h.planner].map((x) => x.clone(rng.fork()))
}

export const RUN_ORDER: readonly HomininKind[] = ['adapted', 'learnedValue', 'copier', 'shallow', 'planner']

export function printCounts(c: HistoryCounts, label: string = c.kind): string[] {
  const lines = [`${label}: ${c.days} days, ${c.deviations} deviations; ate carcass ${c.ate.carcass}, marrow ${c.ate.marrow}, termites ${c.ate.termites}, tubers ${c.ate.tubers}`]
  lines.push(`  ready for: carcass ${c.readyFor.carcass}, marrow ${c.readyFor.marrow}, termites ${c.readyFor.termites}, tubers ${c.readyFor.tubers}`)
  lines.push(`  own acts: ${Object.entries(c.own).map(([k, v]) => `${k} ${v}`).join(', ')}`)
  lines.push(`  saw the elder: ${Object.entries(c.sawElder).map(([k, v]) => `${k} ${v}`).join(', ')}`)
  return lines
}

export type { Cue }
