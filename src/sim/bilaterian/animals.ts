import { cloneCircuit, setWiring, type Circuit } from './circuit'
import type { Levels } from './modulators'
import { DIAGNOSIS } from './scenarios'

/**
 * The five animals of the spec's §5.3, and the healthy default each is one
 * named change away from.
 *
 * **Never tune an animal by moving a second parameter to make its behaviour
 * look right.** Each is the healthy animal with exactly one thing changed,
 * and the one thing is the line that follows the spread. W4 has nothing
 * wrong with it, and `animals.test.ts` asserts that in the source rather
 * than on the panel.
 */

export type AnimalId = 'healthy' | 'W0' | 'W1' | 'W2' | 'W3' | 'W4'

export interface Animal {
  id: AnimalId
  circuit: Circuit
  /** Tonic modulator levels that differ from healthy. */
  modulators: Partial<Levels>
  /** The fault, shown after Reveal faults (W0's is shown from the start). */
  fault: string
  where: 'wiring' | 'chemistry' | 'neither'
  /** What is normal about it, and must be. */
  normal: string
  /** How it can be told from the others. */
  separates: string
}

export const HEALTHY_CIRCUIT: Circuit = DIAGNOSIS.circuit

function withWiring(edit: Parameters<typeof setWiring>[1]): Circuit {
  const c = cloneCircuit(HEALTHY_CIRCUIT)
  setWiring(c, edit)
  return c
}

export const ANIMALS: Animal[] = [
  {
    id: 'healthy',
    circuit: cloneCircuit(HEALTHY_CIRCUIT),
    modulators: {},
    fault: 'Nothing. The default every other animal is compared against.',
    where: 'neither',
    normal: 'Everything.',
    separates: '—',
  },
  {
    id: 'W0',
    circuit: withWiring({ route: 'reverse' }),
    modulators: {},
    fault:
      'A routing switch is flipped: the verdict reaches the reverse group instead of the forward group. The cells are fine, the weights are fine, and the whole verdict is inverted: the animal flees its food, and is drawn into the carbon dioxide a healthy animal avoids, where it crawls.',
    where: 'wiring',
    normal: 'Every weight, the baseline, the threshold, and all four modulator levels.',
    separates: 'Visible on the diagram, and the chemistry is entirely normal.',
  },
  {
    id: 'W1',
    circuit: withWiring({ weight: { input: 0, value: 0.5 } }),
    modulators: {},
    fault:
      'The weight from the food-odor cell to the interneuron is halved. Every reading the cell makes is fine; the interneuron hears half of it, at every concentration.',
    where: 'wiring',
    normal: 'The sensory cell, the switch, the threshold, and all four modulator levels.',
    separates:
      'Only against W3, and only at high cue concentration: a halved weight costs the same at every concentration, and a halved gain does not.',
  },
  {
    id: 'W2',
    circuit: cloneCircuit(HEALTHY_CIRCUIT),
    modulators: { arousal: 8 },
    fault:
      'Arousal and vigilance at maximum. The rule that triggers a reversal fires eight times as readily, so the animal reacts to everything and finishes nothing.',
    where: 'chemistry',
    normal: 'Every number on the wiring panel.',
    separates: 'Reversal rate high in every world you put it in.',
  },
  {
    id: 'W3',
    circuit: cloneCircuit(HEALTHY_CIRCUIT),
    modulators: { pursuit: 0.5 },
    fault:
      'Pursuit halved: the gain on the food-odor cell’s own output is half what it should be. Where a cue is weak that is indistinguishable from a halved weight. Where a cue is strong the cell saturates anyway, and the fault disappears.',
    where: 'chemistry',
    normal: 'Every number on the wiring panel.',
    separates: 'Identical to W1 at the shipped concentration; recovers at high concentration, where W1 does not.',
  },
  {
    id: 'W4',
    circuit: cloneCircuit(HEALTHY_CIRCUIT),
    modulators: { satiety: 0 },
    fault:
      'Nothing. A hungry animal, behaving correctly for its state. Its chemistry turns the carbon-dioxide cell down, so it stops avoiding a cue a fed animal avoids — because in its world carbon dioxide marks decaying matter that worthwhile things gather around. In this dish the gamble does not pay, and it spends its time in the thick going.',
    where: 'neither',
    normal: 'Every weight, every switch, every threshold, and every modulator except satiety.',
    separates: 'It goes where the others will not; the wiring says nothing about it.',
  },
]

export function animalById(id: AnimalId): Animal {
  return ANIMALS.find((a) => a.id === id)!
}
