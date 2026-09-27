/**
 * The named structures of the vertebrate brain plan, and the species
 * parameter sets that draw them.
 *
 * Every vertebrate brain in the scene is one model: the same pieces, drawn by
 * the same rules, differing only in the parameters listed here (which pieces
 * are present, their proportions from `proportions.ts`, and the pallium's
 * layer count). Nothing is a separately authored mesh. That is Jon's call of
 * 2026-09-27 — stylized and consistent across species — and the point of it
 * is that a difference on screen is a difference in the parameters.
 *
 * Each description is quoted or closely paraphrased from the claim it cites
 * (`§6.1.8-C4` and so on are ids in the chapter's claim index), and says
 * nothing more. The hippocampus and the thalamus are named, not spent: each
 * says where it is and which module takes it up. No structure decides, wants,
 * knows or notices anything; the chapter's verbs are the scene's.
 */
import type { FigureSpecies, RegionId } from './proportions'

export type StructureId =
  | 'spinalCord'
  | 'hindbrain'
  | 'reticularFormation'
  | 'norepinephrineCluster'
  | 'cerebellum'
  | 'tectum'
  | 'periaqueductalGray'
  | 'dopamineClusters'
  | 'serotoninClusters'
  | 'hypothalamus'
  | 'thalamus'
  | 'basalGanglia'
  | 'amygdala'
  | 'pallium'
  | 'hippocampus'

export interface Structure {
  id: StructureId
  /** The name printed in a non-mammal. */
  label: string
  /** The name printed in a mammal, where the chapter's convention differs. */
  mammalLabel?: string
  /** Which of the figure's six regions it sits in, or `null` for the spinal cord. */
  region: RegionId | null
  /** One line, from the claims cited. */
  description: string
  claims: string[]
  /** Where the description stops on purpose. */
  namedNotSpent?: string
}

export const STRUCTURES: readonly Structure[] = [
  {
    id: 'spinalCord',
    label: 'spinal cord',
    region: null,
    description:
      'A cord of neural tissue running along the back. It carries signals between the brain and the body, and runs some movements on its own.',
    claims: ['§6.1.8-C4'],
  },
  {
    id: 'hindbrain',
    label: 'hindbrain',
    region: 'hindbrain',
    description:
      'The rearmost division, continuous with the spinal cord. It controls the jobs that keep an animal alive: breathing, heart rate, blood pressure and swallowing.',
    claims: ['§6.1.8-C6', '§6.3.1-C6'],
  },
  {
    id: 'reticularFormation',
    label: 'reticular formation',
    region: 'hindbrain',
    description:
      'A loose network of cells running the length of the brainstem. It sets how awake an animal is, and takes it in and out of sleep.',
    claims: ['§6.3.1-C8'],
  },
  {
    id: 'norepinephrineCluster',
    label: 'norepinephrine cluster',
    region: 'hindbrain',
    description:
      'One small cluster of cells in the hindbrain, the source of most of the norepinephrine in a vertebrate brain. Its fibers reach nearly the whole brain: the arousal dial of Module 4 is turned from here.',
    claims: ['§6.3.1-C10', '§6.3.1-C11'],
  },
  {
    id: 'cerebellum',
    label: 'cerebellum',
    region: 'cerebellum',
    description:
      'A large structure attached to the back of the hindbrain. In jawed vertebrates it adjusts movements by learning from their errors.',
    claims: ['§6.1.8-C18'],
  },
  {
    id: 'tectum',
    label: 'tectum',
    mammalLabel: 'tectum (superior colliculus)',
    region: 'midbrainRoof',
    description:
      'The roof of the midbrain. It holds maps of the space around the animal, built from what the eyes report and, in many animals, from hearing and touch, in register with one another. What it does with a position is turn the animal toward it: the eyes, the head, and in a fish the whole body.',
    claims: ['§6.1.8-C8', '§6.3.2-C2', '§6.3.2-C3', '§6.3.2-C4'],
  },
  {
    id: 'periaqueductalGray',
    label: 'periaqueductal gray',
    region: 'midbrainRoof',
    description:
      'In the midbrain. It does for defense what the tectum does for orienting: it organizes whole defensive responses, freezing, fleeing, and the analgesia that comes with either.',
    claims: ['§6.3.2-C15', '§6.3.2-C16'],
  },
  {
    id: 'dopamineClusters',
    label: 'dopamine clusters',
    region: 'midbrainRoof',
    description:
      'Two clusters of dopamine neurons in the midbrain. Their fibers run forward into the striatum and the pallium.',
    claims: ['§6.3.2-C10'],
  },
  {
    id: 'serotoninClusters',
    label: 'serotonin clusters',
    region: 'midbrainRoof',
    description:
      'A series of clusters of serotonin neurons along the midline of the brainstem, extending back into the hindbrain.',
    claims: ['§6.3.2-C11'],
  },
  {
    id: 'hypothalamus',
    label: 'hypothalamus',
    region: 'thalamusHypothalamus',
    description:
      'At the base of the forebrain. It keeps the body’s internal conditions, such as temperature, water balance, blood sugar and salt, near their set points, and drives the animal to act when they drift.',
    claims: ['§6.1.8-C12', '§6.3.3-C2'],
  },
  {
    id: 'thalamus',
    label: 'thalamus',
    region: 'thalamusHypothalamus',
    description:
      'Above the hypothalamus, in the middle of the forebrain. It relays signals from the senses into the roof of the forebrain, and carries signals back out.',
    claims: ['§6.1.8-C13'],
    namedNotSpent: 'What it does to the signals it passes is a question for later modules.',
  },
  {
    id: 'basalGanglia',
    label: 'basal ganglia',
    region: 'basalGanglia',
    description:
      'A group of connected clusters of neurons deep in the forebrain. They determine which of the actions being proposed at a given moment is released, and which are held back. The striatum is their input stage: it receives signals from almost the whole pallium and from the thalamus, with the dopamine fibers arriving among them.',
    claims: ['§6.1.8-C14', '§6.3.3-C9'],
  },
  {
    id: 'amygdala',
    label: 'amygdala',
    region: 'forebrainRoof',
    description:
      'A cluster of nuclei at the front and base of the forebrain. It evaluates what matters, quickly, before much else has happened.',
    claims: ['§6.3.3-C11'],
  },
  {
    id: 'pallium',
    label: 'pallium',
    mammalLabel: 'pallium (neocortex)',
    region: 'forebrainRoof',
    description:
      'The roof of the forebrain: a sheet of neurons that receives signals relayed from the senses and sends commands down to the brainstem and spinal cord. In a lamprey it is thin, with three layers. In mammals it grew into the six-layered neocortex, which makes up most of the mammalian brain by mass.',
    claims: ['§6.1.8-C15', '§6.1.8-C16', '§6.1.8-C17'],
  },
  {
    id: 'hippocampus',
    label: 'hippocampus',
    region: 'forebrainRoof',
    description: 'An old region of the pallium, curled along its medial edge.',
    claims: ['§6.3.4-C11'],
    namedNotSpent: 'What it does is the subject of Modules 9 and 10.',
  },
] as const

export function structure(id: StructureId): Structure {
  const s = STRUCTURES.find((x) => x.id === id)
  if (!s) throw new Error(`no structure ${id}`)
  return s
}

/** The lamprey's cerebellum line, from §6.1.8-C19, C20 and C28. */
export const LAMPREY_CEREBELLUM_LINE =
  'No cerebellum in the form jawed vertebrates have. It arose with, or shortly before, the jawed fishes. Whether a small region here counts as a simple cerebellum is debated.'

/** The lamprey's amygdala line, from §6.3.3-C14. */
export const LAMPREY_AMYGDALA_LINE = 'Whether a lamprey has an amygdala-like region is not settled.'

/** §6.1.8-C25, the standing caution on every tour panel. */
export const FIRST_APPROXIMATION_LINE =
  'Each description is a first approximation. Every structure does more than one thing, and most of what an animal does involves several of them at once.'

/** How a species' pallium is built (§6.3.4, §6.3.5-C13). */
export type PalliumLayers = 3 | 6 | 'clustered' | null

/**
 * One species is one parameter set on the one model. `proportions` names the
 * figure row the regions are sized from; the rest are the presences and
 * counts the chapter states. `null` layers means the chapter does not give a
 * count for that animal, and the panel says so rather than inventing one.
 */
export interface SpeciesModel {
  id: FigureSpecies
  label: string
  proportions: FigureSpecies
  /** `absent` draws the dashed empty outline of `#f-lamprey-brain`. */
  cerebellum: 'present' | 'absent'
  /** `notSettled` draws the amygdala as a dashed outline (§6.3.3-C14). */
  amygdala: 'present' | 'notSettled'
  palliumLayers: PalliumLayers
  mammal: boolean
}

export const SPECIES: readonly SpeciesModel[] = [
  { id: 'lamprey', label: 'lamprey', proportions: 'lamprey', cerebellum: 'absent', amygdala: 'notSettled', palliumLayers: 3, mammal: false },
  { id: 'shark', label: 'shark', proportions: 'shark', cerebellum: 'present', amygdala: 'present', palliumLayers: null, mammal: false },
  { id: 'bony fish', label: 'bony fish', proportions: 'bony fish', cerebellum: 'present', amygdala: 'present', palliumLayers: null, mammal: false },
  { id: 'frog', label: 'frog', proportions: 'frog', cerebellum: 'present', amygdala: 'present', palliumLayers: null, mammal: false },
  { id: 'lizard', label: 'lizard', proportions: 'lizard', cerebellum: 'present', amygdala: 'present', palliumLayers: 3, mammal: false },
  { id: 'bird', label: 'bird', proportions: 'bird', cerebellum: 'present', amygdala: 'present', palliumLayers: 'clustered', mammal: false },
  { id: 'mammal', label: 'mammal', proportions: 'mammal', cerebellum: 'present', amygdala: 'present', palliumLayers: 6, mammal: true },
] as const

export function species(id: FigureSpecies): SpeciesModel {
  const s = SPECIES.find((x) => x.id === id)
  if (!s) throw new Error(`no species ${id}`)
  return s
}

/** The label a structure prints in a given species (§6.3.4's convention). */
export function labelIn(s: Structure, sp: SpeciesModel): string {
  return sp.mammal && s.mammalLabel ? s.mammalLabel : s.label
}

/** What the pallium panel says about a species' layers. */
export function layersLine(sp: SpeciesModel): string {
  switch (sp.palliumLayers) {
    case 3:
      return 'three layers'
    case 6:
      return 'six layers: the neocortex'
    case 'clustered':
      return 'organized in clusters rather than in layers'
    default:
      return 'layer count not stated in the chapter'
  }
}
