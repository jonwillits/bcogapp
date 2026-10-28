import type { ReactNode } from 'react'
import type { Rng } from '../../sim/random'
import type { Command } from '../../sim/rodent/body'
import type { ProgressStore } from '../../sim/memory/progress/store'
import type { View } from '../m09_rat/AnimalCamera'
import type { Tab } from './ui'

/**
 * What every part of the scene is given, and what every part supplies.
 * `MemoryScene` owns the shell: the header, the tabs, the canvas, the
 * three places a part can draw (the left panel, the stage over the view,
 * the right panel) and the frame loop. A part owns its store and its
 * screens, and nothing else; the parts never import one another.
 */

/** A store the shell can drive: Lab 9's subscribe/version, and a tick for the frame loop where a part moves. */
export interface PartStore {
  subscribe(fn: () => void): () => void
  version: number
  /** Called from the frame loop with the keys held, DT at a time, while this part's tab shows. */
  tick?(dt: number, cmd: NightCommand): void
  /** The space bar, or the Pause button: pauses or resumes what is running, where the part has something to pause. */
  pause?(): void
  /** The frame loop's clock, for drawing. */
  clock?(): number
}

export interface NightCommand extends Command {
  dig: boolean
}

export interface PartContext<S extends PartStore = PartStore> {
  seed: number
  progress: ProgressStore
  store: S
  view: View
  fov: number
  lowDetail: boolean
  /** A stream for drawing only, forked from the seed. */
  anim: Rng
  /** The scene's clock, seconds since the scene mounted. */
  clock: () => number
  /** The header panel, which the left column renders at its top. */
  header: ReactNode
  /** Opens another part's tab (Part 0's Begin goes straight to Part 1). */
  openTab: (tab: Tab) => void
}

export interface PartModule<S extends PartStore = PartStore> {
  createStore(seed: number, progress: ProgressStore): S
  /** The left column: the header first, then the part's controls. */
  Left: (p: { ctx: PartContext<S> }) => ReactNode
  /** What sits over the view, centered: an instruction screen, a word, a recall box, a checklist, a results screen; null for nothing. */
  Stage: (p: { ctx: PartContext<S> }) => ReactNode
  /** The right column, or null. */
  Right: (p: { ctx: PartContext<S> }) => ReactNode
  /** Inside the 3D canvas, or null for a blank view. */
  Canvas?: (p: { ctx: PartContext<S> }) => ReactNode
  /** The bottom bar under the view (the drive pad), or null. */
  Bottom?: (p: { ctx: PartContext<S> }) => ReactNode
  /** The part's My results screen, for Part 0's gathering; null before the part is finished. */
  Results?: (p: { ctx: PartContext<S> }) => ReactNode
}

export const DT = 0.02
