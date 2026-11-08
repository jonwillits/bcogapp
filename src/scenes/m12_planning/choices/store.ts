import { makeRng, type Rng } from '../../../sim/random'
import type { ProgressStore } from '../../../sim/planning/progress/store'
import type { UnitId } from '../../../sim/planning/parts'
import { answerSeries, emptyResponses, gambleResults, planGambles, seriesDone, type GambleResponses, type GambleResults, type Item, type Plan, type PairId, type Version } from '../../../sim/planning/choices/gambles'
import { answerTitration, delayResults, emptyDelayResponses, planDelays, titrationDone, type DelayPlan, type DelayResponses, type DelayResults } from '../../../sim/planning/choices/delays'
import { advance, startBlock, summarize, take, BLOCK_SECONDS, type BlockState, type BlockSummary, type DispenserId } from '../../../sim/planning/choices/dispensers'
import { drawReserves, feed, runRule, RULE_IDS, type Evening, type Patch, type RuleId } from '../../../sim/planning/choices/forager'
import type { PartStore } from '../contract'
import type { Step } from './screens'

/**
 * Part 1's state (spec §5): four steps, each opening on its instruction
 * screen and each independently accessible. Steps 1 and 2 are units that
 * resume (the responses so far are saved as the unit's partial after every
 * answer); Step 3 is two units, one per dispenser block, each restarted from
 * its start if interrupted; Step 4 is an exploration. A step's reveal is
 * rendered only from a completed unit's saved result.
 */

export type StepState = 'intro' | 'running' | 'done'

export const GAMBLES_UNIT: UnitId = 'p1-gambles'
export const DELAYS_UNIT: UnitId = 'p1-delays'
export const dispenserUnit = (i: 0 | 1): UnitId => (i === 0 ? 'p1-dispenser-0' : 'p1-dispenser-1')

/** What Step 1 saves while under way, and what it completes with. */
export interface GamblesPartial {
  responses: GambleResponses
  /** The index of the next item not yet answered. */
  next: number
  /** Which items have been shown (so an interruption after showing the framing problem or the wheel uses the reserve). */
  shownFraming: boolean
  shownAnchor: boolean
  framingMaterials: 0 | 1
  anchorMaterials: 0 | 1
  /** Seconds taken on each item. */
  seconds: number[]
  restarts: number
}

export interface GamblesResult {
  responses: GambleResponses
  results: GambleResults
  framingVersion: 'saved' | 'lost'
  framingMaterials: 0 | 1
  anchorMaterials: 0 | 1
  seconds: number[]
  restarts: number
}

export interface DelaysPartial {
  responses: DelayResponses
  next: number
  seconds: number[]
  restarts: number
}

export interface DelaysResult {
  responses: DelayResponses
  results: DelayResults
  seconds: number[]
  restarts: number
}

export interface DispenserResult extends BlockSummary {
  order: 0 | 1
}

export class ChoicesStore implements PartStore {
  readonly seed: number
  readonly progress: ProgressStore
  step: Step = 1
  version = 0
  private listeners = new Set<() => void>()
  /** Which step screens are open (past their instruction screen) in this session. */
  private opened = new Set<Step>()

  // Step 1
  readonly gamblePlan: Plan
  gambles: GamblesPartial
  gambleItemStart = 0
  /** The wheel: not spun, spinning, or stopped; and the higher/lower answer before the estimate. */
  wheel: 'ready' | 'spinning' | 'stopped' = 'ready'
  higher: boolean | null = null
  // Step 2
  readonly delayPlan: DelayPlan
  delays: DelaysPartial
  // Step 3
  readonly dispenserOrder: [DispenserId, DispenserId]
  block: BlockState | null = null
  blockIndex: 0 | 1 = 0
  blockWallStart = 0
  blockStopped: string | null = null
  private blockTimer: ReturnType<typeof setInterval> | null = null
  private blockRng: Rng
  // Step 4
  evenings: Evening[] = []
  pendingReserves: number | null = null
  rules: Record<RuleId, number> | null = null
  private foragerRng: Rng

  constructor(seed: number, progress: ProgressStore) {
    this.seed = seed
    this.progress = progress
    const partial = progress.partial(GAMBLES_UNIT) as GamblesPartial | undefined
    const materials = { framing: partial?.shownFraming && partial.responses.framing === null ? 1 : partial?.framingMaterials ?? 0, anchor: partial?.shownAnchor && partial.responses.anchor === null ? 1 : partial?.anchorMaterials ?? 0 } as { framing: 0 | 1; anchor: 0 | 1 }
    this.gamblePlan = planGambles(makeRng(seed ^ 0x6a4b1e), materials)
    this.gambles = partial ? { ...partial, framingMaterials: materials.framing, anchorMaterials: materials.anchor, shownFraming: partial.responses.framing !== null, shownAnchor: partial.responses.anchor !== null } : { responses: emptyResponses(), next: 0, shownFraming: false, shownAnchor: false, framingMaterials: 0, anchorMaterials: 0, seconds: [], restarts: progress.restarts(GAMBLES_UNIT) }
    this.delayPlan = planDelays(makeRng(seed ^ 0x3d1a75))
    const dp = progress.partial(DELAYS_UNIT) as DelaysPartial | undefined
    this.delays = dp ?? { responses: emptyDelayResponses(), next: 0, seconds: [], restarts: progress.restarts(DELAYS_UNIT) }
    const order = makeRng(seed ^ 0xd15e).next() < 0.5
    this.dispenserOrder = order ? ['blue', 'orange'] : ['orange', 'blue']
    this.blockRng = makeRng(seed ^ 0xb10c)
    this.foragerRng = makeRng(seed ^ 0xf07a)
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  changed(): void {
    this.version++
    for (const fn of this.listeners) fn()
  }

  // ---------------------------------------------------------------- steps

  open(step: Step): void {
    this.stopBlockTimer()
    this.step = step
    this.changed()
  }

  stateOf(step: Step): StepState {
    switch (step) {
      case 1:
        return this.progress.isComplete(GAMBLES_UNIT) ? 'done' : this.opened.has(1) || this.gambles.next > 0 ? 'running' : 'intro'
      case 2:
        return this.progress.isComplete(DELAYS_UNIT) ? 'done' : this.opened.has(2) || this.delays.next > 0 ? 'running' : 'intro'
      case 3:
        return this.progress.isComplete(dispenserUnit(0)) && this.progress.isComplete(dispenserUnit(1)) ? 'done' : this.opened.has(3) ? 'running' : 'intro'
      case 4:
        return this.opened.has(4) ? 'running' : 'intro'
    }
  }

  get state(): StepState {
    return this.stateOf(this.step)
  }

  begin(): void {
    const step = this.step
    this.opened.add(step)
    if (step === 1 && !this.progress.isComplete(GAMBLES_UNIT)) {
      if (this.progress.status(GAMBLES_UNIT) !== 'in progress') this.progress.begin(GAMBLES_UNIT)
      this.gambleItemStart = performance.now()
    }
    if (step === 2 && !this.progress.isComplete(DELAYS_UNIT)) {
      if (this.progress.status(DELAYS_UNIT) !== 'in progress') this.progress.begin(DELAYS_UNIT)
      this.gambleItemStart = performance.now()
    }
    if (step === 3) this.nextBlock()
    if (step === 4 && this.evenings.length === 0) this.startEvenings()
    this.changed()
  }

  /** Back to the instruction screen of an exploration, or of a step not yet begun. */
  reopen(): void {
    this.opened.delete(this.step)
    this.stopBlockTimer()
    this.changed()
  }

  // ---------------------------------------------------------------- Step 1

  get currentItem(): Item | null {
    return this.gamblePlan.items[this.gambles.next] ?? null
  }

  private saveGambles(): void {
    this.progress.savePartial(GAMBLES_UNIT, this.gambles)
  }

  /** The item was shown: a reserve is used if the sitting is interrupted now. */
  noteShown(): void {
    const it = this.currentItem
    if (!it) return
    if (it.kind === 'disease' && !this.gambles.shownFraming) {
      this.gambles = { ...this.gambles, shownFraming: true }
      this.saveGambles()
    }
    if (it.kind === 'wheel' && !this.gambles.shownAnchor) {
      this.gambles = { ...this.gambles, shownAnchor: true }
      this.saveGambles()
    }
  }

  private advanceGambles(): void {
    const seconds = [...this.gambles.seconds, (performance.now() - this.gambleItemStart) / 1000]
    this.gambles = { ...this.gambles, next: this.gambles.next + 1, seconds }
    this.gambleItemStart = performance.now()
    if (this.gambles.next >= this.gamblePlan.items.length) {
      const result: GamblesResult = { responses: this.gambles.responses, results: gambleResults(this.gambles.responses), framingVersion: this.gamblePlan.framingVersion, framingMaterials: this.gambles.framingMaterials, anchorMaterials: this.gambles.anchorMaterials, seconds, restarts: this.gambles.restarts }
      this.progress.complete(GAMBLES_UNIT, result)
    } else this.saveGambles()
    this.changed()
  }

  /** A pair item or a series item answered: `side` is the card chosen, 0 for Option A. */
  chooseCard(side: 0 | 1): void {
    const it = this.currentItem
    if (!it || (it.kind !== 'pair' && it.kind !== 'series' && it.kind !== 'disease')) return
    const swapped = this.gamblePlan.swap[this.gambles.next]
    // The option index in the item's own order.
    const index = (swapped ? 1 - side : side) as 0 | 1
    const r = this.gambles.responses
    if (it.kind === 'pair') this.gambles = { ...this.gambles, responses: { ...r, pairs: { ...r.pairs, [`${it.pair}-${it.version}` as `${PairId}-${Version}`]: index } } }
    else if (it.kind === 'series') this.gambles = { ...this.gambles, responses: answerSeries(r, it.series, index === 1) }
    else this.gambles = { ...this.gambles, responses: { ...r, framing: { choice: index, version: it.version, materials: this.gambles.framingMaterials } } }
    this.advanceGambles()
  }

  /** The varying option of a series sits on the right in the item's own order (index 1). */
  seriesVaryingIndex(): 1 {
    return 1
  }

  spin(): void {
    if (this.wheel !== 'ready') return
    this.wheel = 'spinning'
    this.changed()
    setTimeout(() => {
      this.wheel = 'stopped'
      this.changed()
    }, 2600)
  }

  answerHigher(higher: boolean): void {
    this.higher = higher
    this.changed()
  }

  answerEstimate(estimate: number): void {
    const it = this.currentItem
    if (!it || it.kind !== 'wheel' || this.higher === null) return
    this.gambles = { ...this.gambles, responses: { ...this.gambles.responses, anchor: { anchor: it.anchor, higher: this.higher, estimate, materials: this.gambles.anchorMaterials } } }
    this.advanceGambles()
  }

  /** Whether a series is partway: its restart on resumption is handled by the plan replaying the series from where the bisection stands. */
  seriesProgress(series: 'ceGain' | 'ceLoss' | 'mixed'): number {
    return this.gambles.responses.series[series].took.length
  }

  gamblesDoneCount(): number {
    return this.gambles.next
  }

  get gamblesResult(): GamblesResult | null {
    return this.progress.isComplete(GAMBLES_UNIT) ? (this.progress.result(GAMBLES_UNIT) as GamblesResult) : null
  }

  // ---------------------------------------------------------------- Step 2

  get currentDelayItem() {
    return this.delayPlan.items[this.delays.next] ?? null
  }

  chooseDelayCard(side: 0 | 1): void {
    const it = this.currentDelayItem
    if (!it) return
    const swapped = this.delayPlan.swap[this.delays.next]
    // In the item's own order, Option A is the sooner amount.
    const index = (swapped ? 1 - side : side) as 0 | 1
    const r = this.delays.responses
    const seconds = [...this.delays.seconds, (performance.now() - this.gambleItemStart) / 1000]
    if (it.kind === 'titration') this.delays = { ...this.delays, responses: answerTitration(r, it.delay, index === 0), seconds }
    else this.delays = { ...this.delays, responses: { ...r, reversals: { ...r.reversals, [it.pair]: index === 1 } }, seconds }
    this.delays = { ...this.delays, next: this.delays.next + 1 }
    this.gambleItemStart = performance.now()
    if (this.delays.next >= this.delayPlan.items.length) {
      const result: DelaysResult = { responses: this.delays.responses, results: delayResults(this.delays.responses), seconds, restarts: this.delays.restarts }
      this.progress.complete(DELAYS_UNIT, result)
    } else this.progress.savePartial(DELAYS_UNIT, this.delays)
    this.changed()
  }

  get delaysResult(): DelaysResult | null {
    return this.progress.isComplete(DELAYS_UNIT) ? (this.progress.result(DELAYS_UNIT) as DelaysResult) : null
  }

  titrationStatus(delay: 'week' | 'month' | 'sixMonths' | 'year' | 'fiveYears'): boolean {
    return titrationDone(this.delays.responses, delay)
  }

  seriesStatus(series: 'ceGain' | 'ceLoss' | 'mixed'): boolean {
    return seriesDone(this.gambles.responses, series)
  }

  // ---------------------------------------------------------------- Step 3

  /** The next block not yet complete, started in real time. */
  nextBlock(): void {
    const i: 0 | 1 | null = !this.progress.isComplete(dispenserUnit(0)) ? 0 : !this.progress.isComplete(dispenserUnit(1)) ? 1 : null
    if (i === null) {
      this.block = null
      this.stopBlockTimer()
      return
    }
    this.blockIndex = i
    const unit = dispenserUnit(i)
    if (this.progress.status(unit) !== 'in progress') this.progress.begin(unit)
    this.block = startBlock(this.dispenserOrder[i], this.blockRng.fork(), this.progress.restarts(unit) + (this.blockStopped ? 1 : 0))
    this.blockWallStart = performance.now()
    this.blockStopped = null
    if (!this.blockTimer) this.blockTimer = setInterval(() => this.tickBlock(), 50)
    this.changed()
  }

  private elapsedNow(): number {
    return (performance.now() - this.blockWallStart) / 1000
  }

  private tickBlock(): void {
    if (!this.block) return
    this.block = advance(this.block, this.elapsedNow(), this.blockRng)
    if (this.block.phase === 'done') this.finishBlock()
    this.changed()
  }

  /** “Take 1 now”, or the key 1. */
  takeNow(): void {
    if (!this.block || this.block.phase !== 'trial') return
    this.block = take(this.block, this.elapsedNow())
    this.changed()
  }

  /** The page was hidden or lost focus: the block stops, does not count, and restarts on return (spec §5.4). */
  interruptBlock(why: string): void {
    if (!this.block || this.block.phase === 'done') return
    this.block = null
    this.blockStopped = why
    this.stopBlockTimer()
    this.changed()
  }

  /** Back from an interruption: the block starts again from its beginning. */
  restartBlock(): void {
    if (!this.blockStopped) return
    this.nextBlock()
  }

  private finishBlock(): void {
    if (!this.block) return
    const result: DispenserResult = { ...summarize(this.block), order: this.blockIndex }
    this.progress.complete(dispenserUnit(this.blockIndex), result)
    this.block = null
    this.stopBlockTimer()
    this.changed()
  }

  private stopBlockTimer(): void {
    if (this.blockTimer) clearInterval(this.blockTimer)
    this.blockTimer = null
  }

  blockSecondsLeft(): number {
    return this.block ? Math.max(0, BLOCK_SECONDS - this.block.elapsed) : BLOCK_SECONDS
  }

  dispenserResult(i: 0 | 1): DispenserResult | null {
    return this.progress.isComplete(dispenserUnit(i)) ? (this.progress.result(dispenserUnit(i)) as DispenserResult) : null
  }

  get bothBlocksDone(): boolean {
    return this.progress.isComplete(dispenserUnit(0)) && this.progress.isComplete(dispenserUnit(1))
  }

  // ---------------------------------------------------------------- Step 4

  startEvenings(): void {
    this.evenings = []
    this.rules = null
    this.pendingReserves = drawReserves(this.foragerRng)
    this.changed()
  }

  feedAt(patch: Patch): void {
    if (this.pendingReserves === null || this.evenings.length >= 12) return
    this.evenings = [...this.evenings, feed(this.pendingReserves, patch, this.foragerRng)]
    this.pendingReserves = this.evenings.length < 12 ? drawReserves(this.foragerRng) : null
    this.changed()
  }

  runRules(): void {
    const out = {} as Record<RuleId, number>
    for (const r of RULE_IDS) out[r] = runRule(r, 1000, this.foragerRng.fork())
    this.rules = out
    this.changed()
  }

  ownSurvival(): number | null {
    return this.evenings.length ? this.evenings.filter((e) => e.survived).length / this.evenings.length : null
  }

  /** Everything saved for Part 1, for the My results screen. */
  get finished(): { gambles: boolean; delays: boolean; dispensers: boolean } {
    return { gambles: this.progress.isComplete(GAMBLES_UNIT), delays: this.progress.isComplete(DELAYS_UNIT), dispensers: this.bothBlocksDone }
  }
}
