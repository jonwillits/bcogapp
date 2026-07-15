import { lazy, type ComponentType } from 'react'

/** How a scene is meant to be used (see APP_DESIGN "the two modes"). */
export type SceneMode = 'demo' | 'lab' | 'both'

/** Build status of a scene, mirroring the LAB_IDEAS legend. */
export type SceneStatus = 'idea' | 'spec' | 'building' | 'done'

/**
 * One interactive scene the app can open. Each scene folder
 * (src/scenes/mNN_<slug>/) exports a manifest that is registered below.
 */
export interface SceneManifest {
  /** Hash route, e.g. 'm01-vehicles' → opened at #/m01-vehicles */
  route: string
  /** Zero-padded module number matching the intro_to_bcs/ folder. */
  module: number
  title: string
  /** One-line description shown on the scene-picker card. */
  blurb: string
  mode: SceneMode
  status: SceneStatus
  /** The React component that renders the scene. */
  Component: ComponentType
}

// Scenes are lazy-loaded so Three.js/r3f stay out of the home-screen bundle
// and only load when a scene is opened.
const VehiclesScene = lazy(() => import('./m01_vehicles/VehiclesScene'))

/**
 * Registered, runnable scenes. Order here is the order shown in the picker.
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
  },
]

/**
 * The planned per-module roadmap, shown as muted cards on the home screen so
 * the scope is visible before the scenes exist. Source: docs/LAB_IDEAS.md.
 * A module "lights up" as a clickable card once a scene in `scenes` matches it.
 */
export interface PlannedModule {
  module: number
  title: string
  idea: string
}

export const plannedModules: PlannedModule[] = [
  { module: 1, title: 'Mind and Brain', idea: 'Braitenberg vehicles — sensor→motor wiring, emergent behavior' },
  { module: 3, title: 'Neurons', idea: '2D neuron: ion gates, action potentials, voltage plots' },
  { module: 4, title: 'Neural Circuits', idea: 'Logic-gate circuits in a nematode-like bilaterian' },
  { module: 5, title: 'Learning & Plasticity', idea: 'Fish that learns — Hebbian, error-driven, reinforcement' },
  { module: 6, title: 'Vertebrate Architecture', idea: 'Camera flythrough of labeled brain structures' },
  { module: 7, title: 'Pattern Recognition', idea: 'Classifier playground — XOR, circle-surround, hidden layers' },
  { module: 11, title: 'Social Cognition', idea: 'Iterated prisoner’s dilemma vs. selectable strategies' },
  { module: 13, title: 'Language', idea: 'Acoustics → phonetics → morphemes → syntax vs. semantics' },
  { module: 14, title: 'Symbolic Cognition', idea: 'Symbols vs. statistics — FSA / PDA / Turing, SRNs & transformers' },
]
