/**
 * Part 3's view design (spec §6.3): each scanned object was rendered every
 * 15° around its vertical axis at eye level and every 15° around a
 * horizontal axis at a fixed heading. Two views are learned, 0° and 75°
 * around the vertical axis. Test views come in three conditions matched
 * for distance from the nearest learned view, so that a difference
 * between conditions cannot come from distance:
 *
 *   between      15°, 30°, 45°, 60° around the vertical axis   distances 15, 30, 30, 15
 *   beyond       345°, 330°, 90°, 105°                          distances 15, 30, 15, 30
 *   at right angles   tipped 15°, 30°, 345°, 330° about the horizontal axis   distances 15, 30, 15, 30
 *
 * `views.test.ts` pins that the three multisets of distances are equal.
 */
import type { Rng } from '../random'
import { VIEWS_PER_CONDITION } from './config'

export type Condition = 'between' | 'beyond' | 'right-angles'
export const CONDITIONS: Condition[] = ['between', 'beyond', 'right-angles']
export const CONDITION_LABEL: Record<Condition, string> = { between: 'between', beyond: 'beyond', 'right-angles': 'at right angles' }

export const LEARNED_HEADINGS = [0, 75]
export const LEARNED_VIEWS = ['h000', 'h075']
/** The frames of the wobble shown in the study phase: ±10° around each learned view, in 5° steps. */
export const WOBBLE_FRAMES: Record<string, string[]> = {
  h000: ['w350', 'w355', 'h000', 'w005', 'w010'],
  h075: ['w065', 'w070', 'h075', 'w080', 'w085'],
}

export interface View {
  id: string
  heading: number
  pitch: number
}

/**
 * Views per condition: 4 gives 24 trials, with distances {15, 15, 30, 30}
 * in every condition; 3 gives 18, with {15, 30, 30}. Either is matched;
 * which one is used is `VIEWS_PER_CONDITION` in config.ts.
 */
export const TEST_VIEWS_BY_COUNT: Record<3 | 4, Record<Condition, View[]>> = {
  4: {
    between: [15, 30, 45, 60].map((h) => ({ id: `h${pad(h)}`, heading: h, pitch: 0 })),
    beyond: [345, 330, 90, 105].map((h) => ({ id: `h${pad(h)}`, heading: h, pitch: 0 })),
    'right-angles': [15, 30, 345, 330].map((p) => ({ id: `p${pad(p)}`, heading: 0, pitch: p })),
  },
  3: {
    between: [15, 30, 45].map((h) => ({ id: `h${pad(h)}`, heading: h, pitch: 0 })),
    beyond: [345, 330, 105].map((h) => ({ id: `h${pad(h)}`, heading: h, pitch: 0 })),
    'right-angles': [15, 30, 330].map((p) => ({ id: `p${pad(p)}`, heading: 0, pitch: p })),
  },
}
export const TEST_VIEWS: Record<Condition, View[]> = TEST_VIEWS_BY_COUNT[VIEWS_PER_CONDITION]

function pad(n: number): string {
  return String(n).padStart(3, '0')
}

/** Angular distance, in degrees, between two headings around one axis. */
export function angularDistance(a: number, b: number): number {
  const d = Math.abs(((a - b) % 360) + 360) % 360
  return Math.min(d, 360 - d)
}

/** Distance of a view from the nearest learned view, along its own axis. A tipped view is measured from the learned view at its heading. */
export function distanceFromLearned(v: View): number {
  if (v.pitch !== 0) return angularDistance(v.pitch, 0)
  return Math.min(...LEARNED_HEADINGS.map((h) => angularDistance(v.heading, h)))
}

export type ViewSet = 'shoes' | 'things'
export const SET_LABEL: Record<ViewSet, string> = { shoes: 'one shoe among shoes', things: 'one shoe among other things' }

export interface ScannedObject {
  id: string
  set: 'shoe' | 'other'
  title: string
}

export interface ViewTrial {
  /** Which object is shown. */
  object: string
  view: View
  condition: Condition
  /** Whether it is the target shoe. */
  target: boolean
}

/**
 * The trials of one set (24 with four views per condition, 18 with three):
 * for each condition, the target at each of its test views, and other
 * objects at the same views, one each, chosen and ordered by the seed. Half
 * target, half not, in every condition.
 */
export function viewTrials(target: string, others: string[], rng: Rng): ViewTrial[] {
  const trials: ViewTrial[] = []
  for (const condition of CONDITIONS) {
    const views = TEST_VIEWS[condition]
    const pool = shuffle(others, rng)
    views.forEach((view, i) => {
      trials.push({ object: target, view, condition, target: true })
      trials.push({ object: pool[i % pool.length], view, condition, target: false })
    })
  }
  return shuffle(trials, rng)
}

export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng.int(i + 1)
    const t = out[i]; out[i] = out[j]; out[j] = t
  }
  return out
}

/** Every rendered view around both axes, for the view-generalization curve: headings 0..345 and pitches 15..345. */
export function allViews(): { vertical: View[]; horizontal: View[] } {
  const vertical: View[] = []
  for (let h = 0; h < 360; h += 15) vertical.push({ id: `h${pad(h)}`, heading: h, pitch: 0 })
  const horizontal: View[] = [{ id: 'h000', heading: 0, pitch: 0 }]
  for (let p = 15; p < 360; p += 15) horizontal.push({ id: `p${pad(p)}`, heading: 0, pitch: p })
  return { vertical, horizontal }
}
