/**
 * The Specimens tab's data: the manifest the gallery reads, and the true-size
 * arithmetic (spec §5).
 *
 * The specimens are data, not code. `public/m06/specimens/manifest.json`
 * lists whatever photographs were sourced, with their crop boxes, scale bars,
 * credits and licences, and the game runs on whatever it lists. True size
 * comes from each original's own scale bar, measured once in pixels by
 * `scripts/m06-specimens.py`; a specimen without a usable bar has no size
 * and is drawn greyed with *size not recorded*, never at a guessed size.
 */
import type { Rng } from '../random'
import { makeRng } from '../random'
import type { BranchId } from './tree'

export type ViewKind = 'side' | 'above' | 'below'

export interface SpecimenView {
  view: ViewKind
  /** Crop box in the original, [x0, y0, x1, y1], tightened to the specimen. */
  box: [number, number, number, number]
  /** The cutout's size in original pixels. */
  sizePx: [number, number]
  /** The derived grayscale cutout, relative to the specimens folder. Opaque name. */
  derived: string
}

export interface ScaleBar {
  cm: number
  /** Measured length of the bar in the original, pixels. */
  px: number
  region?: number[]
  dark?: boolean
}

export interface Specimen {
  id: string
  /** The common name used in the matching list. */
  name: string
  scientificName: string
  treeGroup: BranchId | null
  /** The original file, unaltered. */
  file: string
  stage: 'blue' | 'white'
  views: SpecimenView[]
  scaleBar: ScaleBar | null
  credit: string
  licence: string
  source: string
}

export interface Manifest {
  note: string
  specimens: Specimen[]
}

export const VIEW_LABEL: Record<ViewKind, string> = { side: 'from the side', above: 'from above', below: 'from below' }

/** Centimeters per original pixel, or null without a usable bar. */
export function cmPerPx(s: Specimen): number | null {
  if (!s.scaleBar || !s.scaleBar.px || s.scaleBar.px <= 0 || !(s.scaleBar.cm > 0)) return null
  return s.scaleBar.cm / s.scaleBar.px
}

/** A view's true extent in centimeters, [width, height], or null. */
export function trueSizeCm(s: Specimen, v: SpecimenView): [number, number] | null {
  const k = cmPerPx(s)
  if (k === null) return null
  return [v.sizePx[0] * k, v.sizePx[1] * k]
}

/**
 * How large to draw a view at a given zoom, in screen pixels. `pxPerCm` is
 * the zoom; the drawn size divided by it is the true size in centimeters,
 * whatever the zoom. Null when the size is not recorded.
 */
export function drawnSizePx(s: Specimen, v: SpecimenView, pxPerCm: number): [number, number] | null {
  const cm = trueSizeCm(s, v)
  if (!cm) return null
  return [cm[0] * pxPerCm, cm[1] * pxPerCm]
}

/** The view the game shows first: from the side where there is one. */
export function defaultView(s: Specimen): SpecimenView {
  return s.views.find((v) => v.view === 'side') ?? s.views[0]
}

/** The gallery's order, shuffled by the run seed and fixed by it. */
export function shuffledOrder(specimens: Specimen[], seed: number): Specimen[] {
  const rng: Rng = makeRng(seed ^ 0x6b1a1)
  const out = [...specimens]
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng.int(i + 1)
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** The matching list: exactly the common names of the specimens present, alphabetical. */
export function matchingList(specimens: Specimen[]): string[] {
  return [...new Set(specimens.map((s) => s.name))].sort((a, b) => a.localeCompare(b))
}

/** The student's guesses: specimen id → the name chosen. */
export type Guesses = Record<string, string | undefined>

export function allNamed(specimens: Specimen[], g: Guesses): boolean {
  return specimens.every((s) => !!g[s.id])
}

export interface Match {
  specimen: Specimen
  guess: string | undefined
  correct: boolean
}

export function score(specimens: Specimen[], g: Guesses): Match[] {
  return specimens.map((s) => ({ specimen: s, guess: g[s.id], correct: g[s.id] === s.name }))
}

/** The only interpretation the true-scale view offers. */
export const TRUE_SCALE_LINE = 'Size and folding evolved more than once. §6.3.5.'
export const SIZE_NOT_RECORDED = 'size not recorded'
