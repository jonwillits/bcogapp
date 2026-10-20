import { BLOCKS, HomingTrial, planBlock, runNavigators, type Block, type NavigatorResult, type TrialRecord, type View, replanTrip } from '../../sim/rodent/homing'
import type { Command } from '../../sim/rodent/body'

/**
 * Part 1's state (spec §7): one block at a time, each an orienting screen
 * with Begin, its trials, Commit my trials, then the reveal. Nothing about
 * where the nest truly is, or how far off the student ended, is computed
 * for display before the commit: `revealed(block)` is null until then, and
 * the panels render nothing from a record but the trial's count and
 * phase (`reveal.test.tsx`).
 */

export type BlockState = 'intro' | 'trials' | 'awaiting-commit' | 'revealed'

export interface BlockReveal {
  records: TrialRecord[]
  navigators: NavigatorResult[][]
}

/** The fade through black between trials, seconds. */
export const FADE = 1.2
/** The phase line on the return, drawn in the accent color so the change of goal is seen as well as read (Jon, 2026-10-20). */
export const RETURN_LINE = 'Find the nest'

export class HomeStore {
  readonly seed: number
  block: Block = 'practice'
  state: BlockState = 'intro'
  trialIndex = 0
  trial: HomingTrial | null = null
  /** Seconds of black still to show before the next trial starts. */
  fade = 0
  /** Completed records for the current block. */
  records: TrialRecord[] = []
  /** What each block showed after its commit. */
  readonly reveals = new Map<Block, BlockReveal>()
  /** The blocks finished, in order. */
  readonly done: Block[] = []
  view: View = 'eye'
  version = 0
  private plans: ReturnType<typeof planBlock> = []
  private listeners = new Set<() => void>()

  constructor(seed: number) {
    this.seed = seed
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private changed(): void {
    this.version++
    for (const fn of this.listeners) fn()
  }

  get spec() {
    return BLOCKS.find((b) => b.id === this.block)!
  }

  /** Any block may be opened (Jon, 2026-10-20: students may jump around and redo; the handout cautions against jumping ahead). */
  canOpen(_b: Block): boolean {
    return true
  }

  open(b: Block): void {
    if (!this.canOpen(b)) return
    this.block = b
    if (this.reveals.has(b)) {
      this.state = 'revealed'
      this.records = this.reveals.get(b)!.records
    } else {
      this.state = 'intro'
      this.records = []
    }
    this.trial = null
    this.trialIndex = 0
    this.changed()
  }

  begin(): void {
    if (this.state !== 'intro') return
    this.plans = planBlock(this.block, this.seed)
    this.records = []
    this.trialIndex = 0
    this.state = 'trials'
    this.startTrial()
    this.changed()
  }

  private startTrial(): void {
    const plan = this.plans[this.trialIndex]
    this.trial = new HomingTrial(plan, this.seed)
    this.trial.setView(this.view)
    this.fade = FADE
  }

  setView(v: View): void {
    this.view = v
    this.trial?.setView(v)
    this.changed()
  }

  /** The frame loop's step: the fade counts down, then the trial takes the keys. */
  step(dt: number, cmd: Command): void {
    if (this.state !== 'trials' || !this.trial) return
    if (this.fade > 0) {
      this.fade = Math.max(0, this.fade - dt)
      if (this.fade > 0) return
      this.changed()
    }
    const wasDone = this.trial.done
    this.trial.step(dt, cmd)
    if (!wasDone && this.trial.done) this.trialEnded()
  }

  here(): void {
    if (!this.trial || this.trial.done) return
    this.trial.here()
    if (this.trial.done) this.trialEnded()
  }

  /** Whether the trial now running can be restarted: not in the picture block, not during the startle. */
  get canRestart(): boolean {
    return this.state === 'trials' && !!this.trial && !this.trial.done && this.trial.plan.block !== 'picture' && this.trial.blackout <= 0
  }

  /** Restart trial (Jon, 2026-10-20): the trial starts again on a fresh trip of the same beetle count, and the record counts the restart. */
  restartTrial(): void {
    if (!this.canRestart || !this.trial) return
    const restarts = this.trial.record.restarts + 1
    const plan = replanTrip(this.plans[this.trialIndex], this.seed, restarts)
    this.plans[this.trialIndex] = plan
    this.trial = new HomingTrial(plan, this.seed, restarts)
    this.trial.setView(this.view)
    this.fade = FADE
    this.changed()
  }

  private trialEnded(): void {
    if (!this.trial) return
    this.records.push(this.trial.record)
    this.trialIndex++
    if (this.trialIndex < this.plans.length) this.startTrial()
    else {
      this.trial = null
      this.state = 'awaiting-commit'
    }
    this.changed()
  }

  commit(): void {
    if (this.state !== 'awaiting-commit') return
    const navigators = this.records.map((r) => runNavigators(r, this.seed))
    this.reveals.set(this.block, { records: this.records, navigators })
    if (!this.done.includes(this.block)) this.done.push(this.block)
    this.state = 'revealed'
    this.changed()
  }

  /** What the reveal shows, or null before the commit. */
  revealed(b: Block = this.block): BlockReveal | null {
    return this.reveals.get(b) ?? null
  }

  get nextBlock(): Block | null {
    const i = BLOCKS.findIndex((x) => x.id === this.block)
    return BLOCKS[i + 1]?.id ?? null
  }

  get prevBlock(): Block | null {
    const i = BLOCKS.findIndex((x) => x.id === this.block)
    return i > 0 ? BLOCKS[i - 1].id : null
  }

  /** Redo the block: its reveal is dropped and it opens on its orienting screen again. */
  redo(): void {
    this.reveals.delete(this.block)
    this.records = []
    this.trial = null
    this.trialIndex = 0
    this.state = 'intro'
    this.changed()
  }

  goOn(): void {
    const n = this.nextBlock
    if (n) this.open(n)
  }

  /** The status lines over the stage while a trial runs: one fact to a line; three lines on the way out, four on the return (Jon, 2026-10-20: no light line, and the button's name in quotes). */
  statusLines(): string[] {
    const t = this.trial
    if (!t) return []
    const n = this.plans.length
    const legs = t.plan.legs.length
    const lines = [
      `Trial ${this.trialIndex + 1} of ${n}`,
      legs ? `Beetles taken ${t.beetle} of ${legs}` : 'Set down somewhere else',
      t.blackout > 0 ? 'Startled' : t.phase === 'out' ? 'Walk to the beetle' : t.phase === 'return' ? RETURN_LINE : 'Trial over',
    ]
    if (t.phase === 'return' && t.blackout <= 0) lines.push('then press “Here is my nest”')
    return lines
  }
}
