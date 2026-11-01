import type { ProgressStore } from '../../../sim/social/progress/store'
import type { UnitId } from '../../../sim/social/parts'
import { planSets, PRESENTATION_SECONDS, type Judgment, type Plan, type PlannedSet } from '../../../sim/social/groups/sets'
import type { PartStore } from '../contract'

/**
 * Part 5's state (spec §9): one unit, the two sets, from the first
 * presentation to the last judgment; then the reveal. Each member of a set
 * is shown four times at two seconds each in a seeded order, then judged
 * twice with a free bar that starts away from the creature's height and
 * offset from its baseline. No score is rendered before the last judgment
 * (`groups.test.tsx`), and no string before the reveal names what the part
 * tests (`naming.test.ts`).
 */

export type GroupsState = 'intro' | 'present' | 'between' | 'judge' | 'revealed'
export const SETS_UNIT: UnitId = 'p5-sets'

export interface SetsResult {
  materials: number
  judgments: Judgment[]
  restarts: number
}

export interface Timers {
  set(fn: () => void, ms: number): unknown
  clear(id: unknown): void
}

const REAL_TIMERS: Timers = { set: (fn, ms) => setTimeout(fn, ms), clear: (id) => clearTimeout(id as ReturnType<typeof setTimeout>) }

export class GroupsStore implements PartStore {
  readonly seed: number
  readonly progress: ProgressStore
  plan: Plan
  state: GroupsState = 'intro'
  /** Which of the two sets, in the order run. */
  set = 0
  /** The presentation index within the set, or the judgment index. */
  index = 0
  /** The bar's current height during a judgment, pixels. */
  bar = 0
  judgments: Judgment[] = []
  version = 0
  private readonly timers: Timers
  private timer: unknown = null
  private listeners = new Set<() => void>()

  constructor(seed: number, progress: ProgressStore, timers: Timers = REAL_TIMERS) {
    this.seed = seed
    this.progress = progress
    this.timers = timers
    this.plan = planSets(seed, progress.materialsSlot(SETS_UNIT))
    if (progress.isComplete(SETS_UNIT)) {
      const r = progress.result(SETS_UNIT) as SetsResult
      this.plan = planSets(seed, r.materials)
      this.judgments = r.judgments
      this.state = 'revealed'
    }
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private changed(): void {
    this.version++
    for (const fn of this.listeners) fn()
  }

  get current(): PlannedSet {
    return this.plan.sets[this.set]
  }

  get done(): boolean {
    return this.progress.isComplete(SETS_UNIT)
  }

  begin(): void {
    if (this.state !== 'intro') return
    this.progress.begin(SETS_UNIT)
    this.plan = planSets(this.seed, this.progress.materialsSlot(SETS_UNIT))
    this.set = 0
    this.judgments = []
    this.startPresentation()
  }

  private startPresentation(): void {
    this.state = 'present'
    this.index = 0
    this.changed()
    this.schedulePresentation()
  }

  private schedulePresentation(): void {
    this.timer = this.timers.set(() => this.nextPresentation(), PRESENTATION_SECONDS * 1000)
  }

  /** The member now shown, or null between members. */
  get shownMember(): number | null {
    if (this.state !== 'present') return null
    return this.current.presentation[this.index] ?? null
  }

  private nextPresentation(): void {
    this.index++
    if (this.index >= this.current.presentation.length) {
      this.state = 'judge'
      this.index = 0
      this.bar = this.barStartFor(0)
      this.changed()
      return
    }
    this.changed()
    this.schedulePresentation()
  }

  private barStartFor(j: number): number {
    const s = this.current
    const member = s.members[s.judgments[j]]
    return Math.round(member.height * s.barStarts[j].share)
  }

  get judgedMember(): number | null {
    if (this.state !== 'judge') return null
    return this.current.judgments[this.index] ?? null
  }

  get barOffset(): number {
    return this.state === 'judge' ? this.current.barStarts[this.index].offset : 0
  }

  setBar(h: number): void {
    this.bar = Math.max(10, Math.min(260, Math.round(h)))
    this.changed()
  }

  /** Set the bar: the judgment is recorded; the next member, the next set, or the end. */
  commitJudgment(): void {
    if (this.state !== 'judge') return
    const s = this.current
    this.judgments.push({ which: s.which, member: s.judgments[this.index], judged: this.bar })
    this.index++
    if (this.index < s.judgments.length) {
      this.bar = this.barStartFor(this.index)
      this.changed()
      return
    }
    if (this.set === 0) {
      this.set = 1
      this.state = 'between'
      this.changed()
      return
    }
    const result: SetsResult = { materials: this.progress.materialsSlot(SETS_UNIT), judgments: this.judgments, restarts: this.progress.restarts(SETS_UNIT) }
    this.progress.complete(SETS_UNIT, result)
    this.state = 'revealed'
    this.changed()
  }

  beginSecondSet(): void {
    if (this.state !== 'between') return
    this.startPresentation()
  }

  dispose(): void {
    if (this.timer) this.timers.clear(this.timer)
  }
}
