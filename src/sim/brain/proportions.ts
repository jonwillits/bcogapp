/**
 * The six regions of the chapter's own figure, and the proportions it draws
 * each of seven vertebrates with.
 *
 * SOURCE — copied verbatim, numbers and colors, from
 *   course_creation/figures/06_vertebrate_neural_architecture/make_figures.py
 *   function `f_one_plan_many_brains`
 * which renders `#f-one-plan-many-brains` in the Module 6 reading. The scene
 * draws from these constants so that the model on screen and the figure in
 * the chapter cannot drift apart; `proportions.test.ts` pins them to a pasted
 * copy of the source, so a change to either side shows up as a failure.
 *
 * The numbers are schematic. The figure says so ("the parts are the same; the
 * proportions are not") and so does every proportions view in the scene.
 * They are not measurements, and no question may ask a student to read one.
 */

export type RegionId =
  | 'forebrainRoof'
  | 'basalGanglia'
  | 'thalamusHypothalamus'
  | 'midbrainRoof'
  | 'cerebellum'
  | 'hindbrain'

export interface Region {
  id: RegionId
  /** The figure's label, verbatim. */
  label: string
  /** The figure's fill, verbatim. */
  color: string
}

/** In the figure's order, front of the brain first. */
export const REGIONS: readonly Region[] = [
  { id: 'forebrainRoof', label: 'forebrain roof', color: '#13294B' },
  { id: 'basalGanglia', label: 'basal ganglia', color: '#4f6a91' },
  { id: 'thalamusHypothalamus', label: 'thalamus and hypothalamus', color: '#8aa0bd' },
  { id: 'midbrainRoof', label: 'midbrain roof', color: '#FF5F05' },
  { id: 'cerebellum', label: 'cerebellum', color: '#f7b98a' },
  { id: 'hindbrain', label: 'hindbrain', color: '#c9ced6' },
] as const

export type FigureSpecies = 'lamprey' | 'shark' | 'bony fish' | 'frog' | 'lizard' | 'bird' | 'mammal'

export interface ProportionRow {
  species: FigureSpecies
  /** One entry per region, in REGIONS order. Zero means the region is absent. */
  parts: readonly [number, number, number, number, number, number]
}

/** The figure's rows, in the figure's order. */
export const PROPORTIONS: readonly ProportionRow[] = [
  { species: 'lamprey', parts: [14, 8, 10, 20, 0, 48] },
  { species: 'shark', parts: [16, 8, 9, 18, 18, 31] },
  { species: 'bony fish', parts: [14, 8, 9, 26, 16, 27] },
  { species: 'frog', parts: [22, 9, 10, 20, 6, 33] },
  { species: 'lizard', parts: [26, 10, 10, 18, 8, 28] },
  { species: 'bird', parts: [44, 10, 8, 10, 14, 14] },
  { species: 'mammal', parts: [52, 8, 8, 6, 16, 10] },
] as const

/** The line every proportions view prints. */
export const SCHEMATIC_LINE =
  'Proportions are schematic, drawn to show that the parts are the same and the proportions are not. They are not measurements.'

/** The figure's own closing line. */
export const FIGURE_LINE = 'the parts are the same; the proportions are not'

export function proportionsFor(species: FigureSpecies): ProportionRow {
  const row = PROPORTIONS.find((r) => r.species === species)
  if (!row) throw new Error(`no proportions row for ${species}`)
  return row
}

/** Each region's share of the whole, 0 to 1, in REGIONS order. */
export function shares(row: ProportionRow): number[] {
  const total = row.parts.reduce((a, b) => a + b, 0)
  return row.parts.map((p) => p / total)
}
