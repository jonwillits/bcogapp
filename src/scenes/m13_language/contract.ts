import type { ReactNode } from 'react'
import type { Rng } from '../../sim/random'
import type { ProgressStore } from '../../sim/language/progress/store'
import type { Tab } from './ui'

/**
 * Lab 10's part module contract (`m10_memory/contract.ts`), carried to this
 * scene without the frame loop: nothing in Lab 13 moves in a 3D world
 * (decision 2). `LanguageScene` owns the shell: the header, the part tabs,
 * the navigation panel and the main panel with its two tabs (Jon,
 * 2026-11-18). A part owns its store and its screens, and nothing else; the
 * parts never import one another. A part's results for the All Results tab
 * are registered in `results.tsx`, step by step.
 */

export interface PartStore {
  subscribe(fn: () => void): () => void
  version: number
}

export interface PartContext<S extends PartStore = PartStore> {
  seed: number
  progress: ProgressStore
  store: S
  /** A stream for drawing only, forked from the seed. */
  anim: Rng
  /** The header panel, which the navigation panel renders at its top. */
  header: ReactNode
  /** Opens another part's tab, through the switch guard: a step with something under way asks first (Part 0's Begin goes to Part 1). */
  openTab: (tab: Tab) => void
  /** Opens another step of this part, through the same guard. */
  openStep: (step: number) => void
}

export interface PartModule<S extends PartStore = PartStore> {
  createStore(seed: number, progress: ProgressStore): S
  /** The navigation panel: the header first, then the part's step buttons and nothing else. */
  Nav: (p: { ctx: PartContext<S> }) => ReactNode
  /** The main panel's current-part tab: an instruction screen, a step, or a finished step's results with their explanation. */
  Stage: (p: { ctx: PartContext<S> }) => ReactNode
}
