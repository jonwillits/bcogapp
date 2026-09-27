/**
 * The one drawing rule for every brain in the scene: a side view, front at
 * the left, a tube that swells into its divisions. A species is a parameter
 * set (`structures.ts`) and its region widths come from the figure's
 * proportions (`proportions.ts`); nothing here is drawn per species by hand.
 *
 * Pure geometry, so a test can ask where a piece is and whether it is drawn
 * at all. The React component in the scene only paints what this returns.
 */
import { proportionsFor, shares, REGIONS, type RegionId } from './proportions'
import type { SpeciesModel } from './structures'
import type { StructureId } from './structures'

export interface Box {
  x: number
  y: number
  w: number
  h: number
}

export interface RegionShape {
  region: RegionId
  box: Box
  color: string
  label: string
  /** The lamprey's cerebellum: drawn as a dashed empty outline. */
  absent?: boolean
}

export interface Marker {
  structure: StructureId
  /** Center, for a dot or a small blob. */
  x: number
  y: number
  /** Radius of the drawn mark. */
  r: number
  /** Dotted along a length, for the reticular formation and the serotonin clusters. */
  along?: { x2: number; y2: number }
  dashed?: boolean
}

export interface BrainGeometry {
  width: number
  height: number
  /** The brain's front-to-back extent, for scale bars and labels. */
  brain: Box
  regions: RegionShape[]
  spinalCord: Box
  markers: Marker[]
  /** Where each named structure's label leader should start. */
  anchors: Record<StructureId, { x: number; y: number }>
}

const W = 520
const H = 300
const LEFT = 118
const LENGTH = 300
const MID_Y = 165

/** Lay out a species on the standard canvas. */
export function brainGeometry(sp: SpeciesModel): BrainGeometry {
  const row = proportionsFor(sp.proportions)
  const s = shares(row)
  const by = (id: RegionId) => s[REGIONS.findIndex((r) => r.id === id)]
  const colorOf = (id: RegionId) => REGIONS.find((r) => r.id === id)!.color
  const labelOf = (id: RegionId) => REGIONS.find((r) => r.id === id)!.label

  const roof = by('forebrainRoof')
  const bg = by('basalGanglia')
  const th = by('thalamusHypothalamus')
  const mid = by('midbrainRoof')
  const cb = by('cerebellum')
  const hind = by('hindbrain')

  // Widths along the axis: the forebrain's three regions stack vertically, so
  // its width is their combined share; the cerebellum sits on top of the
  // hindbrain rather than along the axis, so it takes no length.
  const axial = roof + bg + th + mid + hind
  const wF = (LENGTH * (roof + bg + th)) / axial
  const wM = (LENGTH * mid) / axial
  const wH = (LENGTH * hind) / axial

  // Heights: the forebrain grows with its roof; the brainstem is a tube.
  const hF = 70 + 160 * roof
  const hM = 48 + 60 * mid
  const hH = 44
  const cord = 14

  const xF = LEFT
  const xM = xF + wF
  const xH = xM + wM
  const xEnd = xH + wH

  const fTop = MID_Y - hF * 0.6
  const fBot = MID_Y + hF * 0.4
  const fSum = roof + bg + th
  const roofH = (hF * roof) / fSum
  const bgH = (hF * bg) / fSum
  const thH = (hF * th) / fSum

  const regions: RegionShape[] = [
    { region: 'forebrainRoof', box: { x: xF, y: fTop, w: wF, h: roofH }, color: colorOf('forebrainRoof'), label: labelOf('forebrainRoof') },
    { region: 'basalGanglia', box: { x: xF, y: fTop + roofH, w: wF, h: bgH }, color: colorOf('basalGanglia'), label: labelOf('basalGanglia') },
    { region: 'thalamusHypothalamus', box: { x: xF, y: fTop + roofH + bgH, w: wF, h: thH }, color: colorOf('thalamusHypothalamus'), label: labelOf('thalamusHypothalamus') },
    { region: 'midbrainRoof', box: { x: xM, y: MID_Y - hM * 0.55, w: wM, h: hM }, color: colorOf('midbrainRoof'), label: labelOf('midbrainRoof') },
    { region: 'hindbrain', box: { x: xH, y: MID_Y - hH * 0.5, w: wH, h: hH }, color: colorOf('hindbrain'), label: labelOf('hindbrain') },
  ]

  // The cerebellum: a lobe over the front of the hindbrain, sized by its share.
  const cbH = sp.cerebellum === 'absent' ? 34 : 18 + 190 * cb
  const cbW = sp.cerebellum === 'absent' ? Math.min(46, wH * 0.8) : Math.min(wH * 0.95, 30 + 220 * cb)
  regions.push({
    region: 'cerebellum',
    box: { x: xH + 2, y: MID_Y - hH * 0.5 - cbH + 6, w: cbW, h: cbH },
    color: colorOf('cerebellum'),
    label: labelOf('cerebellum'),
    absent: sp.cerebellum === 'absent',
  })

  const spinalCord: Box = { x: xEnd, y: MID_Y - cord / 2, w: W - xEnd - 6, h: cord }

  const midBox = regions[3].box
  const hindBox = regions[4].box
  const thBox = regions[2].box
  const bgBox = regions[1].box
  const roofBox = regions[0].box

  const markers: Marker[] = [
    { structure: 'norepinephrineCluster', x: hindBox.x + hindBox.w * 0.35, y: hindBox.y + hindBox.h * 0.55, r: 5 },
    { structure: 'dopamineClusters', x: midBox.x + midBox.w * 0.4, y: midBox.y + midBox.h * 0.78, r: 4 },
    { structure: 'periaqueductalGray', x: midBox.x + midBox.w * 0.55, y: midBox.y + midBox.h * 0.45, r: 7 },
    {
      structure: 'serotoninClusters',
      x: midBox.x + midBox.w * 0.75,
      y: midBox.y + midBox.h * 0.9,
      r: 3,
      along: { x2: hindBox.x + hindBox.w * 0.85, y2: hindBox.y + hindBox.h * 0.8 },
    },
    {
      structure: 'reticularFormation',
      x: midBox.x + midBox.w * 0.2,
      y: MID_Y + 4,
      r: 2,
      along: { x2: hindBox.x + hindBox.w * 0.95, y2: MID_Y + 4 },
    },
    { structure: 'amygdala', x: roofBox.x + wF * 0.14, y: thBox.y - 2, r: 9, dashed: sp.amygdala === 'notSettled' },
    { structure: 'hippocampus', x: roofBox.x + wF * 0.82, y: roofBox.y + roofBox.h * 0.55, r: 6 },
  ]

  const anchors: Record<StructureId, { x: number; y: number }> = {
    spinalCord: { x: spinalCord.x + spinalCord.w * 0.6, y: spinalCord.y + spinalCord.h / 2 },
    hindbrain: { x: hindBox.x + hindBox.w * 0.6, y: hindBox.y + hindBox.h * 0.85 },
    reticularFormation: { x: hindBox.x + hindBox.w * 0.5, y: MID_Y + 4 },
    norepinephrineCluster: markers[0],
    cerebellum: { x: regions[5].box.x + regions[5].box.w / 2, y: regions[5].box.y + 4 },
    tectum: { x: midBox.x + midBox.w / 2, y: midBox.y + 3 },
    periaqueductalGray: markers[2],
    dopamineClusters: markers[1],
    serotoninClusters: markers[3],
    hypothalamus: { x: thBox.x + thBox.w * 0.5, y: thBox.y + thBox.h * 0.8 },
    thalamus: { x: thBox.x + thBox.w * 0.55, y: thBox.y + thBox.h * 0.3 },
    basalGanglia: { x: bgBox.x + bgBox.w * 0.45, y: bgBox.y + bgBox.h / 2 },
    amygdala: markers[5],
    pallium: { x: roofBox.x + roofBox.w * 0.45, y: roofBox.y + 4 },
    hippocampus: markers[6],
  }

  return {
    width: W,
    height: H,
    brain: { x: xF, y: Math.min(fTop, regions[5].box.y), w: xEnd - xF, h: Math.max(fBot, hindBox.y + hindBox.h) - Math.min(fTop, regions[5].box.y) },
    regions,
    spinalCord,
    markers,
    anchors,
  }
}
