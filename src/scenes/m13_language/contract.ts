import type { ReactNode } from 'react'
import type { Rng } from '../../sim/random'
import type { ProgressStore } from '../../sim/language/progress/store'
import type { Tab } from './ui'

/**
 * Lab 10's part module contract (`m10_memory/contract.ts`), carried to this
 * scene without the frame loop: nothing in Lab 13 moves in a 3D world
 * (decision 2). `LanguageScene` owns the shell: the header, the tabs, the
 * three places a part can draw (the left panel, the stage over the view,
 * the right panel). A part owns its store and its screens, and nothing
 * else; the parts never import one another.
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
  /** The header panel, which the left column renders at its top. */
  header: ReactNode
  /** Opens another part's tab (Part 0's Begin goes to Part 1). */
  openTab: (tab: Tab) => void
}

export interface PartModule<S extends PartStore = PartStore> {
  createStore(seed: number, progress: ProgressStore): S
  /** The left column: the header first, then the part's controls. */
  Left: (p: { ctx: PartContext<S> }) => ReactNode
  /** What sits over the view, centered: an instruction screen, a spectrogram, a board, a results screen; null for nothing. */
  Stage: (p: { ctx: PartContext<S> }) => ReactNode
  /** The right column, or null. */
  Right: (p: { ctx: PartContext<S> }) => ReactNode
  /** The part's My results screen, for Part 0's gathering; null before the part has results. */
  Results?: (p: { progress: ProgressStore }) => ReactNode
}
