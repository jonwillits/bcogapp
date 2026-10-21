import { makeRng } from '../../sim/random'
import { DEFAULT_TEST, type TestSettings } from '../../sim/rodent/lab'
import { RATS, runTest, trainingRoutePath, type RatId, type RunResult, type Strategy, type PathPoint } from '../../sim/rodent/rats'

/**
 * Part 2's state (spec §8): one rat, one apparatus, one room, a set of
 * changes; a run of trials shown as paths, with Skip ahead to the result;
 * a counter of tests; a diagnosis menu per hidden rat; Commit my
 * diagnoses; then a Reveal per rat. No rat's strategy is rendered before
 * the commit (`reveal.test.tsx`).
 */

/** The rats the scene shows: H and five hidden ones. R6 (damage to the striatum) stays in the sim and its test and is not shown (Jon's walk, 2026-10-20: Part 2 is long enough with five; spec §13's first cut). */
export const SHOWN: RatId[] = RATS.filter((r) => r.id !== 'R6').map((r) => r.id)
export const HIDDEN: RatId[] = RATS.filter((r) => r.hidden && r.id !== 'R6').map((r) => r.id)
/** The on-screen labels R1 to R5 are dealt to the hidden programs by the seed, so the order of the buttons says nothing (Jon's walk, 2026-10-20). */
export function labelsFor(seed: number): Record<RatId, string> {
  const rng = makeRng(seed ^ 0x5a6e1d)
  const labels = HIDDEN.map((_, i) => `R${i + 1}`)
  for (let i = labels.length - 1; i > 0; i--) {
    const j = rng.int(i + 1)
    ;[labels[i], labels[j]] = [labels[j], labels[i]]
  }
  const out = { H: 'H' } as Record<RatId, string>
  HIDDEN.forEach((id, i) => (out[id] = labels[i]))
  out.R6 = 'R6'
  return out
}

export class RatsStore {
  readonly seed: number
  /** The label each rat wears on screen this seed. */
  readonly labels: Record<RatId, string>
  rat: RatId = 'H'
  settings: TestSettings = { ...DEFAULT_TEST }
  testsRun = 0
  result: RunResult | null = null
  /** The trial now being drawn, and the clock along its path. */
  trialIndex = 0
  clock = 0
  playing = false
  /** The radiating paths' training run, drawn before the test. */
  showingTraining = false
  diagnoses: Partial<Record<RatId, Strategy>> = {}
  committed = false
  readonly revealed = new Set<RatId>()
  /** Begin pressed: the orienting panel over the view is gone. */
  started = false
  version = 0
  private listeners = new Set<() => void>()

  constructor(seed: number) {
    this.seed = seed
    this.labels = labelsFor(seed)
  }

  /** The rats in the order their labels read, H first. */
  get order(): RatId[] {
    return [...SHOWN].sort((a, b) => (a === 'H' ? -1 : b === 'H' ? 1 : this.labels[a].localeCompare(this.labels[b])))
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  begin(): void {
    this.started = true
    this.version++
    for (const fn of this.listeners) fn()
  }

  changed(): void {
    this.version++
    for (const fn of this.listeners) fn()
  }

  setRat(id: RatId): void {
    this.rat = id
    this.result = null
    this.playing = false
    this.changed()
  }

  set<K extends keyof TestSettings>(k: K, v: TestSettings[K]): void {
    this.settings = { ...this.settings, [k]: v }
    this.result = null
    this.playing = false
    this.changed()
  }

  /** Run the test: the result is computed at once and the trials play out as paths. */
  run(): void {
    this.testsRun++
    const rat = RATS.find((r) => r.id === this.rat)!
    this.result = runTest(rat, this.settings, this.seed + this.testsRun * 101)
    this.trialIndex = 0
    this.clock = 0
    this.showingTraining = this.settings.apparatus === 'paths'
    this.playing = true
    this.changed()
  }

  skipToResult(): void {
    if (!this.result) return
    this.trialIndex = this.result.trials.length
    this.playing = false
    this.showingTraining = false
    this.changed()
  }

  get currentPath(): PathPoint[] | null {
    if (!this.result) return null
    if (this.showingTraining) return trainingRoutePath()
    const t = this.result.trials[this.trialIndex]
    return t ? t.path : null
  }

  get pastPaths(): PathPoint[][] {
    if (!this.result) return []
    return this.result.trials.slice(0, Math.min(this.trialIndex, this.result.trials.length)).map((t) => t.path)
  }

  /** The frame loop: play the current trial's path at 1×. */
  tick(dt: number): void {
    if (!this.playing || !this.result) return
    this.clock += dt
    const path = this.currentPath
    const end = path && path.length ? path[path.length - 1].t + 0.6 : 0
    if (this.clock >= end) {
      this.clock = 0
      if (this.showingTraining) this.showingTraining = false
      else this.trialIndex++
      if (this.trialIndex >= this.result.trials.length) this.playing = false
      this.changed()
    }
  }

  /** The result lines, shown once the run has played out or been skipped to. */
  get resultReady(): boolean {
    return !!this.result && this.trialIndex >= this.result.trials.length
  }

  diagnose(id: RatId, s: Strategy): void {
    if (this.committed) return
    this.diagnoses = { ...this.diagnoses, [id]: s }
    this.changed()
  }

  get canCommit(): boolean {
    return !this.committed && HIDDEN.every((id) => this.diagnoses[id])
  }

  commit(): void {
    if (!this.canCommit) return
    this.committed = true
    this.changed()
  }

  reveal(id: RatId): void {
    if (!this.committed) return
    this.revealed.add(id)
    this.changed()
  }
}
