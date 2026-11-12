import type { ReactNode } from 'react'
import type { Rng } from '../../sim/random'
import type { ProgressStore } from '../../sim/planning/progress/store'
import type { View } from '../m09_rat/AnimalCamera'
import type { Command } from '../../sim/rodent/body'
import type { Tab } from './ui'

/**
 * Lab 10's part module contract (`m10_memory/contract.ts`), carried to this
 * scene: what every part is given, and what every part supplies.
 * `PlanningScene` owns the shell: the header, the tabs, the canvas, the
 * three places a part can draw (the left panel, the stage over the view,
 * the right panel), the drive bar, and the frame loop. A part owns its
 * store and its screens, and nothing else; the parts never import one
 * another.
 */

/** What the student's keys ask of the driven hominin on one step: Lab 9's drive command, and the act key. */
export interface DriveCommand extends Command {
  /** Enter was pressed since the last step: make what the hands allow. */
  act: boolean
  /** J was pressed since the last step: the left hand picks up or puts down. */
  left?: boolean
  /** K was pressed since the last step: the right hand picks up or puts down. */
  right?: boolean
}

export interface PartStore {
  subscribe(fn: () => void): () => void
  version: number
  /** Called from the frame loop, DT at a time, while this part's tab shows and the part has something moving. */
  tick?(dt: number, cmd: DriveCommand): void
  /** Space, while driving: pause the student's day, or start it again. */
  togglePause?(): void
  /** Called once a frame after the steps, with the fraction of a step left over, so a drawn body can be placed between steps. */
  frame?(alpha: number): void
  /** The frame loop's clock, for drawing. */
  clock?(): number
}

export interface PartContext<S extends PartStore = PartStore> {
  seed: number
  progress: ProgressStore
  store: S
  /** Eye view or follow view, for Part 3. */
  view: View
  fov: number
  lowDetail: boolean
  /** A stream for drawing only, forked from the seed. */
  anim: Rng
  /** The scene's clock, seconds since the scene mounted. */
  clock: () => number
  /** The header panel, which the left column renders at its top. */
  header: ReactNode
  /** Opens another part's tab (Part 0's Begin goes to Part 1). */
  openTab: (tab: Tab) => void
}

export interface PartModule<S extends PartStore = PartStore> {
  createStore(seed: number, progress: ProgressStore): S
  /** The left column: the header first, then the part's controls. */
  Left: (p: { ctx: PartContext<S> }) => ReactNode
  /** What sits over the view, centered: an instruction screen, a choice, a puzzle, a results screen; null for nothing. */
  Stage: (p: { ctx: PartContext<S> }) => ReactNode
  /** The right column, or null. */
  Right: (p: { ctx: PartContext<S> }) => ReactNode
  /** Inside the 3D canvas (Part 3), or null for a blank view. */
  Canvas?: (p: { ctx: PartContext<S> }) => ReactNode
  /** Under the view (Part 3's drive bar), or nothing. */
  Bottom?: (p: { ctx: PartContext<S>; press: (k: 'forward' | 'back' | 'left' | 'right', down: boolean) => void; act: () => void; hand: (side: 0 | 1) => void }) => ReactNode
  /** The part's My results screen, for Part 0's gathering; null before the part has results. */
  Results?: (p: { progress: ProgressStore }) => ReactNode
}

export const DT = 0.02
