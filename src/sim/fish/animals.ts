import { cloneCircuit, setWiring, type Circuit } from '../bilaterian/circuit'
import { buildNetwork } from './brain'
import { KINDS } from './kinds'
import { HEALTHY_PRESET } from './scenarios'
import { STAKES_PRESETS, type Stakes } from './sdt'
import { healthyChemistry, type Chemistry } from './world'
import { makeRng } from '../random'

/**
 * The five fish of Part 2. Each is the healthy fish with exactly one named
 * thing changed (`sdt.test.ts`).
 *
 * The thread of the whole lab is in this table: **sensitivity is
 * representation, and the criterion is chemistry.** F1 and F2 have the
 * healthy fish's weights and a different criterion, moved by a modulator. F3
 * has the healthy fish's chemistry and weights that point the wrong way. F4
 * has neither fault: its criterion is set for a different stream.
 */

export type FishId = 'healthy' | 'F1' | 'F2' | 'F3' | 'F4'

export interface FishAnimal {
  id: FishId
  label: string
  /** The one change, in a line. Shown on *Reveal*. */
  change: string
  /** Where the change lives. */
  where: 'none' | 'chemistry' | 'representation' | 'not broken'
  whereText: string
  /** What gives it away. Shown on *Reveal*. */
  gives: string
  circuit: Circuit
  chemistry: Chemistry
  /** Whether its numbers are hidden until *Reveal*. */
  hidden: boolean
  /** The stream this fish's criterion is right for, where that is not Part 2's. */
  ownStream?: { baseRate: number; stakes: Stakes; says: string }
}

/** The healthy fish's wiring: one unit, the weights of `HEALTHY_PRESET`, a neutral criterion. */
export function healthyCircuit(): Circuit {
  const c = buildNetwork({ raw: true, builtIns: [] }, 0, 'hand', false, 'sigmoid', makeRng(0))
  HEALTHY_PRESET.weights.forEach((value, input) => setWiring(c, { layer: 'output', weight: { input, value } }))
  setWiring(c, { layer: 'output', baseline: HEALTHY_PRESET.baseline })
  return c
}

/** Midway between the typical eel and the typical sucker: where a neutral fish's evidence is zero. */
export const MIDPOINT: readonly [number, number] = [
  (KINDS.eel.typical![0] + KINDS.sucker.typical![0]) / 2,
  (KINDS.eel.typical![1] + KINDS.sucker.typical![1]) / 2,
]

/**
 * F3's weights: the healthy fish's, turned to lean on receptor B, which
 * barely separates eel from sucker. Their length is the healthy fish's, and
 * the evidence is still zero at the midpoint, so nothing about how *much*
 * evidence the fish has, or where its criterion sits, has changed — only
 * which difference between the smells the weights attend to.
 */
export const F3_WEIGHTS = [0.3, -3.3]

function f3Circuit(): Circuit {
  const c = healthyCircuit()
  F3_WEIGHTS.forEach((value, input) => setWiring(c, { layer: 'output', weight: { input, value } }))
  setWiring(c, { layer: 'output', baseline: -(F3_WEIGHTS[0] * MIDPOINT[0] + F3_WEIGHTS[1] * MIDPOINT[1]) })
  return c
}

function f4Circuit(): Circuit {
  const c = healthyCircuit()
  setWiring(c, { layer: 'output', threshold: -0.9 })
  return c
}

export const FISH_ANIMALS: readonly FishAnimal[] = [
  {
    id: 'healthy',
    label: 'Healthy',
    change: 'Nothing.',
    where: 'none',
    whereText: '—',
    gives: '—',
    circuit: healthyCircuit(),
    chemistry: healthyChemistry(),
    hidden: false,
  },
  {
    id: 'F1',
    label: 'F1',
    change: 'Arousal and vigilance is at 3, where the healthy fish’s is at 1.',
    where: 'chemistry',
    whereText: 'Chemistry: its criterion is low.',
    gives: 'Many hits and many false alarms. d′ is the healthy fish’s.',
    circuit: healthyCircuit(),
    chemistry: { arousal: 3, satiety: 1 },
    hidden: true,
  },
  {
    id: 'F2',
    label: 'F2',
    change: 'Satiety and tone is at 0.1, where the healthy fish’s is at 1. It is hungry.',
    where: 'chemistry',
    whereText: 'Chemistry: its criterion to dart is high.',
    gives: 'Few false alarms and many misses. d′ is the healthy fish’s.',
    circuit: healthyCircuit(),
    chemistry: { arousal: 1, satiety: 0.1 },
    hidden: true,
  },
  {
    id: 'F3',
    label: 'F3',
    change: 'Its weights favor receptor B, the one that barely separates an eel from a sucker.',
    where: 'representation',
    whereText: 'Representation: its sensitivity is low.',
    gives: 'Misses and false alarms are both up. d′ is well below the healthy fish’s.',
    circuit: f3Circuit(),
    chemistry: healthyChemistry(),
    hidden: true,
  },
  {
    id: 'F4',
    label: 'F4',
    change: 'Its criterion is −0.9, where the healthy fish’s is 0: a liberal criterion.',
    where: 'not broken',
    whereText: 'Nowhere. It is not broken.',
    gives:
      'Many false alarms, like F1. But in the stream it comes from, where eels are common, it earns more energy than the healthy fish would.',
    circuit: f4Circuit(),
    chemistry: healthyChemistry(),
    hidden: true,
    ownStream: {
      baseRate: 0.8,
      stakes: { ...STAKES_PRESETS[0].stakes },
      says: 'In this fish’s stream an eel is upstream four times in five.',
    },
  },
]

export function fishById(id: FishId): FishAnimal {
  const a = FISH_ANIMALS.find((x) => x.id === id)
  if (!a) throw new Error(`no fish ${id}`)
  return { ...a, circuit: cloneCircuit(a.circuit), chemistry: { ...a.chemistry } }
}
