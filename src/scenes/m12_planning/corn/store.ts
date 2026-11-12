import { makeRng, type Rng } from '../../../sim/random'
import type { ProgressStore } from '../../../sim/planning/progress/store'
import { fourTrays, trayStats, lewontinFirst, lewontinSecond, twins, TWIN_PRESET, poorAndRich, seasons, type Tray, type FourTrays, type Nutrients, type TwinShares, type TwinResults, type TrayStats } from '../../../sim/planning/corn/model'
import type { PartStore } from '../contract'

/**
 * Part 4's state (spec §8): four steps, every one an exploration, each with
 * a prediction committed before its first result. Growing a tray takes
 * about five seconds of animation, during which the plants rise to their
 * heights; the numbers appear when the growing ends.
 */

export type Step = 1 | 2 | 3 | 4
export type StepState = 'intro' | 'running'

export const GROW_SECONDS = 5

export const PREDICTIONS = {
  s1: { key: 'p4-s1', question: 'Four trays will grow at once: a varied stock and one uniform line, each in even soil and in patchy soil. In which trays will the heritability within the tray be near 1?', choices: ['the varied stock in even soil only', 'both trays of varied stock', 'both trays in even soil', 'all four'] },
  s2first: { key: 'p4-s2-first', question: 'Two uniform lines, different from each other, in the same even soil. Within each tray, will the heritability be high? And is the difference between the trays genetic?', choices: ['high within; difference genetic', 'high within; difference environmental', 'zero within; difference genetic', 'zero within; difference environmental'] },
  s2second: { key: 'p4-s2-second', question: 'One varied stock, grown in two trays, one in the complete nutrient solution and one with half the nitrates and no zinc. Within each tray, will the heritability be high? And is the difference between the trays genetic?', choices: ['high within; difference genetic', 'high within; difference environmental', 'zero within; difference genetic', 'zero within; difference environmental'] },
  s3: { key: 'p4-s3', question: 'If identical twins are treated more alike than fraternal twins, will the twin estimate of heritability be too high, too low, or right?', choices: ['too high', 'too low', 'right'] },
  s4: { key: 'p4-s4', question: 'The same varied stock in a poor soil that limits how tall any plant can grow, and in a rich soil that does not. In which soil will heritability be higher?', choices: ['the poor soil', 'the rich soil', 'the same in both'] },
} as const

export type PredictionKey = keyof typeof PREDICTIONS

export class CornStore implements PartStore {
  readonly seed: number
  readonly progress: ProgressStore
  step: Step = 1
  version = 0
  private listeners = new Set<() => void>()
  private opened = new Set<Step>()
  private rng: Rng
  drafts: Partial<Record<PredictionKey, string>> = {}

  // Step 1: the four combinations, grown at once (Jon, 2026-11-11).
  trays: FourTrays | null = null
  /** Growing: 0 to 1 over GROW_SECONDS. */
  growing: number | null = null
  private growTimer: ReturnType<typeof setInterval> | null = null
  private growStart = 0

  // Step 2
  first: [Tray, Tray] | null = null
  second: [Tray, Tray] | null = null
  secondNutrients: Nutrients = 'deficient'

  // Step 3
  shares: TwinShares = { ...TWIN_PRESET }
  twinResults: TwinResults | null = null

  // Step 4
  poorRich: [Tray, Tray] | null = null
  seasonsRun: ReturnType<typeof seasons> | null = null

  constructor(seed: number, progress: ProgressStore) {
    this.seed = seed
    this.progress = progress
    this.rng = makeRng(seed ^ 0xc0e2)
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  changed(): void {
    this.version++
    for (const fn of this.listeners) fn()
  }

  open(step: Step): void {
    this.step = step
    this.changed()
  }

  get state(): StepState {
    return this.opened.has(this.step) ? 'running' : 'intro'
  }

  begin(): void {
    this.opened.add(this.step)
    this.changed()
  }

  reopen(): void {
    this.opened.delete(this.step)
    this.changed()
  }

  predicted(k: PredictionKey): string | null {
    return this.progress.prediction(PREDICTIONS[k].key)
  }

  draft(k: PredictionKey, c: string): void {
    this.drafts[k] = c
    this.changed()
  }

  commit(k: PredictionKey): void {
    const c = this.drafts[k]
    if (!c) return
    this.progress.commitPrediction(PREDICTIONS[k].key, c)
    this.changed()
  }

  // Step 1
  grow(): void {
    if (!this.predicted('s1')) return
    this.trays = fourTrays(this.rng)
    this.startGrowing()
  }
  private startGrowing(): void {
    this.growing = 0
    this.growStart = performance.now()
    if (this.growTimer) clearInterval(this.growTimer)
    this.growTimer = setInterval(() => {
      const t = (performance.now() - this.growStart) / 1000 / GROW_SECONDS
      this.growing = Math.min(1, t)
      if (t >= 1) {
        if (this.growTimer) clearInterval(this.growTimer)
        this.growTimer = null
        this.growing = null
      }
      this.changed()
    }, 50)
    this.changed()
  }
  get grownShare(): number {
    return this.growing === null ? 1 : this.growing
  }
  stats(t: Tray): TrayStats {
    return trayStats(t)
  }

  // Step 2
  growFirst(): void {
    if (!this.predicted('s2first')) return
    this.first = lewontinFirst(this.rng)
    this.startGrowing()
  }
  growSecond(): void {
    if (!this.predicted('s2second')) return
    this.secondNutrients = 'deficient'
    this.second = lewontinSecond(this.rng)
    this.startGrowing()
  }
  restore(what: 'nitrates' | 'zinc'): void {
    if (!this.second) return
    this.secondNutrients = what === 'nitrates' ? 'nitratesRestored' : 'complete'
    const genetics = this.second[0].plants.map((p) => p.potential)
    // The same seed values, regrown in the restored solution.
    this.second = [this.second[0], regrow(genetics, this.secondNutrients, this.rng)]
    this.startGrowing()
  }

  // Step 3
  setShare(which: 'genes' | 'shared' | 'rest' | 'identicalOnly', v: number): void {
    const s = { ...this.shares }
    v = Math.max(0, Math.min(1, v))
    if (which === 'identicalOnly') s.identicalOnly = v
    else {
      // The three shares sum to one: the other two rescale in proportion to where they stand.
      const others = (['genes', 'shared', 'rest'] as const).filter((k) => k !== which)
      const rest = 1 - v
      const sum = others.reduce((a, k) => a + s[k], 0)
      for (const k of others) s[k] = sum > 0 ? (s[k] / sum) * rest : rest / 2
      s[which] = v
    }
    this.shares = s
    this.twinResults = null
    this.changed()
  }
  preset(): void {
    this.shares = { ...TWIN_PRESET }
    this.twinResults = null
    this.changed()
  }
  runTwins(): void {
    if (!this.predicted('s3')) return
    this.twinResults = twins(this.shares, this.rng)
    this.changed()
  }

  // Step 4
  growPoorRich(): void {
    if (!this.predicted('s4')) return
    this.poorRich = poorAndRich(this.rng)
    this.startGrowing()
  }
  runSeasons(): void {
    this.seasonsRun = seasons(this.rng)
    this.changed()
  }
}

function regrow(genetics: number[], nutrients: Nutrients, rng: Rng): Tray {
  // Even soil, the same genetic values, the chosen solution: the second tray of Lewontin's second experiment after a restoration.
  const [, t] = lewontinSecondWith(genetics, nutrients, rng)
  return t
}

import { grow } from '../../../sim/planning/corn/model'
function lewontinSecondWith(genetics: number[], nutrients: Nutrients, rng: Rng): [Tray, Tray] {
  return [grow(genetics, 'even', 'complete', rng), grow(genetics, 'even', nutrients, rng)]
}
