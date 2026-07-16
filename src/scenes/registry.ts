import { lazy, type ComponentType } from 'react'

/** How a scene is meant to be used (see APP_DESIGN "the two modes"). */
export type SceneMode = 'demo' | 'lab' | 'both'

/** Build status of a scene, mirroring the LAB_IDEAS legend. */
export type SceneStatus = 'idea' | 'spec' | 'building' | 'done'

/**
 * A course module. The canonical list and titles come from
 * `intro_to_bcs/README.md` — the app never invents module names
 * (see APP_DEVELOPMENT_PROCESS.md "How the app maps to the course").
 * Module 0 (Course Overview) is omitted: it has no demos.
 */
export interface CourseModule {
  module: number
  title: string
}

export const MODULES: CourseModule[] = [
  { module: 1, title: 'Mind and Brain' },
  { module: 2, title: 'Comparative Approaches' },
  { module: 3, title: 'Neurons and Neural Communication' },
  { module: 4, title: 'Neural Circuits, Affect, & Valence' },
  { module: 5, title: 'Learning and Plasticity' },
  { module: 6, title: 'Vertebrate Neural Architecture' },
  { module: 7, title: 'Pattern Recognition' },
  { module: 8, title: 'Perception and Action' },
  { module: 9, title: 'Spatial Cognition' },
  { module: 10, title: 'Memory, Imagination, and Generative Models' },
  { module: 11, title: 'Social Cognition' },
  { module: 12, title: 'Planning and Decision-making' },
  { module: 13, title: 'Language' },
  { module: 14, title: 'Symbolic Cognition' },
  { module: 15, title: 'Culture and Cognition' },
]

/**
 * Where a scene's lab text comes from. The **course repo is the single source
 * of truth** — the app fetches the handout markdown at runtime rather than
 * keeping a copy, so editing `intro_to_bcs` updates the app with no redeploy.
 * If the fetch fails (offline first-visit, file moved/renamed), the lab pane
 * degrades to an "info not available" message plus a link to `sourceUrl`.
 */
export interface LabSource {
  /** Raw markdown URL; also the base for resolving relative links/images. */
  rawUrl: string
  /** Human-viewable handout on GitHub (used by the fallback + a footer link). */
  sourceUrl: string
  /** The report doc students fill in and submit. */
  reportUrl?: string
  reportLabel?: string
}

/**
 * One interactive scene the app can open. Each scene folder
 * (src/scenes/mNN_<slug>/) exports a component registered below.
 */
export interface SceneManifest {
  /** Hash route, e.g. 'm01-vehicles' → opened at #/m01-vehicles */
  route: string
  /** Module number, matching MODULES / the intro_to_bcs folder. */
  module: number
  title: string
  /** One-line description shown on the scene-picker card. */
  blurb: string
  mode: SceneMode
  status: SceneStatus
  /** The React component that renders the scene. */
  Component: ComponentType
  /** Lab instructions shown in the in-app lab pane, if this scene has a lab. */
  lab?: LabSource
}

const INTRO_RAW =
  'https://raw.githubusercontent.com/jonwillits/intro_to_bcs/master'
const INTRO_BLOB = 'https://github.com/jonwillits/intro_to_bcs/blob/master'

// Scenes are lazy-loaded so Three.js/r3f stay out of the home-screen bundle
// and only load when a scene is opened.
const VehiclesScene = lazy(() => import('./m01_vehicles/VehiclesScene'))

/**
 * Registered, runnable scenes. Order here is the order shown within a module.
 */
export const scenes: SceneManifest[] = [
  {
    route: 'm01-vehicles',
    module: 1,
    title: 'Braitenberg Vehicles',
    blurb:
      'Wire two sensors to two motors and watch approach/avoid behavior emerge. The first stage of the evolving-creature engine.',
    mode: 'both',
    status: 'building',
    Component: VehiclesScene,
    lab: {
      rawUrl: `${INTRO_RAW}/mind_and_brain/levels_of_analysis_lab/vehicles_lab.md`,
      sourceUrl: `${INTRO_BLOB}/mind_and_brain/levels_of_analysis_lab/vehicles_lab.md`,
      reportUrl: `${INTRO_BLOB}/mind_and_brain/levels_of_analysis_lab/vehicles_lab_report.docx`,
      reportLabel: 'Lab 1 report (.docx)',
    },
  },
]

/**
 * Planned demos, shown as muted cards under their module. A module may have
 * several. Source: docs/LAB_IDEAS.md. Remove an entry once its scene is built
 * and registered in `scenes` above.
 */
export interface PlannedScene {
  module: number
  title: string
  idea: string
}

export const plannedScenes: PlannedScene[] = [
  {
    module: 3,
    title: 'Neuron Simulation',
    idea: 'Ion gates, neurotransmitter release and binding, action potentials, with live voltage plots.',
  },
  {
    module: 4,
    title: 'Logic-Gate Circuits',
    idea: 'The creature as an early bilaterian, approaching or avoiding stimuli via logical functions and real neural circuits.',
  },
  {
    module: 5,
    title: 'Fish That Learn',
    idea: 'The creature becomes an early vertebrate: neural adaptation, Hebbian, error-driven, and reinforcement learning.',
  },
  {
    module: 6,
    title: 'Brain Flythrough',
    idea: 'Camera flythrough of labeled vertebrate brain structures.',
  },
  {
    module: 7,
    title: 'Classifier Playground',
    idea: 'Harder pattern recognition: XOR and circle-surround, hidden layers vs. feature selection, train/test generalization.',
  },
  {
    module: 11,
    title: "Prisoner's Dilemma",
    idea: 'Iterated prisoner’s dilemma against selectable strategies (tit-for-tat and friends), with a running score.',
  },
  {
    module: 13,
    title: 'The Structure of Language',
    idea: 'Acoustics → phonetics → morphemes → words → phrases → sentences; syntax vs. semantics.',
  },
  {
    module: 14,
    title: 'Symbols vs. Statistics',
    idea: 'Transition probabilities vs. rules: FSA / push-down automata / Turing machines, then SRNs and transformers.',
  },
]
