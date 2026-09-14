import { singleInterneuron, type Circuit } from './circuit'
import { CEILING_AT, type ChannelBiology } from './worm'

/**
 * The seven scenarios of the spec's §6. A scenario sets which sources are in
 * the dish, what the sensory channels are called, which panel sections open,
 * the target function if there is one, which controls are locked, and what
 * the world does to the animal when it reaches something.
 *
 * **The consequences live here, in the world, and not on the channel.** A
 * channel is a number. Whether reaching a food-odour source nourishes the
 * animal or poisons it is a fact about the dish the scenario built — which
 * is exactly what the closer changes, and exactly §4.1.8's point that
 * nothing arrives labeled.
 */

export interface ChannelSpec extends ChannelBiology {
  /** What the scenario calls this cue. */
  name: string
  /** Colour of its field in the dish. Bright: the dark theme swallows anything less. */
  color: string
}

export interface SourceSpec {
  channel: number
  x: number
  z: number
  strength: number
  scale: number
  lifetime: number | null
  /** Where it reappears once eaten or dissipated. */
  respawn: 'anywhere' | 'far-side' | 'none'
  /** A fixed feature no plume may appear inside — decaying matter, a strip of copper. */
  keepPlumesOut?: boolean
}

export type Outcome = 'nourish' | 'harm' | 'ignore'

export interface TargetFunction {
  name: string
  /** The chapter's sentence for it. */
  sentence: string
  /** Act on each of the four rows, in `TRUTH_ROWS` order. */
  act: readonly boolean[]
  /** What acting is, in this world. */
  verb: 'feed' | 'flee' | 'advance'
}

export interface Locks {
  weights: boolean[]
  baseline: boolean
  threshold: boolean
  route: boolean
  activation: boolean
}

export interface Scenario {
  key: string
  part: 1 | 2 | 3 | 'closer'
  title: string
  /** One paragraph for the panel: what this dish is, and what to do in it. */
  blurb: string
  channels: ChannelSpec[]
  sources: SourceSpec[]
  circuit: Circuit
  /** Copy the interneuron's numbers from this scenario if it is the one loaded. */
  keepWiringFrom?: string
  locks: Locks
  target?: TargetFunction
  /** Which Circuit-tab sections open when this scenario loads. */
  open: { circuit: boolean; arithmetic: boolean; target: boolean; boundary: boolean }
  /** What reaching a source of `channel` does, given every channel's concentration there. */
  onReach: (channel: number, c: readonly number[]) => Outcome
  /** Harm per second at a point, if any — a shadow, a vibration, a burn. */
  hazard?: (c: readonly number[]) => number
  /** A speed factor at a point — decaying matter is thick going. */
  linger?: (c: readonly number[]) => number
  /** The trade-off's copper strip runs along z = 0; crossings are counted. */
  countCrossings?: boolean
  start?: { x: number; z: number }
}

export const CHANNELS = {
  food: { name: 'food odor', color: '#ffd166', pursuitDrives: true },
  copper: { name: 'copper', color: '#5ee6d6' },
  cool: { name: 'cool water', color: '#4f9cff' },
  shadow: { name: 'shadow', color: '#b388ff' },
  vibration: { name: 'vibration', color: '#ff6fae' },
  predator: { name: 'predator scent', color: '#f87171' },
  co2: { name: 'carbon dioxide', color: '#d7e0ea', hungerSilences: true },
} as const

function channels(
  ...specs: { name: string; color: string; pursuitDrives?: boolean; hungerSilences?: boolean }[]
): ChannelSpec[] {
  return specs.map((s, i) => ({
    channel: i,
    name: s.name,
    color: s.color,
    pursuitDrives: s.pursuitDrives,
    hungerSilences: s.hungerSilences,
  }))
}

const lock = (n: number, on: boolean): Locks => ({
  weights: Array.from({ length: n }, () => on),
  baseline: on,
  threshold: on,
  route: on,
  activation: on,
})

/**
 * A food plume: strong enough to be found across the dish, gone in
 * thirty-five seconds. Its centre reads exactly the sensory cell's ceiling,
 * so in Part 1, Part 3 and the closer the whole dish is below the ceiling
 * for an animal whose gain is halved — which is what makes a halved gain and
 * a halved weight the same animal at the shipped concentration.
 */
const food = (x: number, z: number, strength = CEILING_AT): SourceSpec => ({
  channel: 0,
  x,
  z,
  strength,
  scale: 1.8,
  lifetime: 35,
  respawn: 'anywhere',
})

/**
 * Part 2's plumes and regions are stronger, so that "present" — the cell at
 * its ceiling — holds over a patch the animal can stand in, and the truth
 * table's row and the dish agree. At strength 8 a source is at the ceiling
 * out to one scale length from its centre.
 */
const PART2_PLUME = 8

/** The healthy single-cue wiring: one cell, weight 1, a low threshold, routed forward. */
export const SINGLE_CUE_THRESHOLD = 0.35

const nourishFood = (channel: number): Outcome => (channel === 0 ? 'nourish' : 'ignore')

/**
 * A cue counts as present where the sensory cell for it reads its ceiling —
 * an input of exactly 1, which is what the truth table's rows mean — so
 * that what the world does to the animal and what the table says agree.
 */
export const present = (c: number): boolean => c >= CEILING_AT

export const SCENARIOS: Scenario[] = [
  {
    key: 'labeled-line',
    part: 1,
    title: 'The labeled line',
    blurb:
      'One cue, one sensory cell, one switch. The switch decides whether the cell’s output reaches the forward group or the reverse group. Nothing else can be changed.',
    channels: channels(CHANNELS.food),
    sources: [food(4, 3)],
    circuit: singleInterneuron([1], 0, SINGLE_CUE_THRESHOLD, 'forward'),
    locks: { ...lock(1, true), route: false },
    open: { circuit: true, arithmetic: false, target: false, boundary: false },
    onReach: nourishFood,
    start: { x: -4, z: -3 },
  },
  {
    key: 'trade-off',
    part: 1,
    title: 'Food beyond copper',
    blurb:
      'Food odor on the far side of a strip of copper. Both weights are unlocked. Strengthen the food connection and more crossings happen; strengthen the copper connection and fewer do. Nothing here is a rule with a yes and a no in it.',
    channels: channels(CHANNELS.food, CHANNELS.copper),
    sources: [
      // The food is close enough to the strip, and its plume broad enough,
      // that its rise across the strip is real: the crossing is then a
      // contest between two graded quantities rather than a wall.
      { ...food(0, 4), scale: 3, respawn: 'far-side' },
      ...Array.from({ length: 27 }, (_, i) => ({
        channel: 1,
        x: -7.8 + i * 0.6,
        z: 0,
        strength: 0.7,
        scale: 0.5,
        lifetime: null,
        respawn: 'none' as const,
        keepPlumesOut: true,
      })),
    ],
    circuit: singleInterneuron([1, -1], 0, SINGLE_CUE_THRESHOLD, 'forward'),
    locks: { ...lock(2, true), weights: [false, false] },
    open: { circuit: true, arithmetic: true, target: false, boundary: false },
    onReach: nourishFood,
    hazard: (c) => (c[1] >= 0.55 ? 0.5 : 0),
    countCrossings: true,
    start: { x: 0, z: -4 },
  },
  {
    key: 'target-and',
    part: 2,
    title: 'AND',
    blurb:
      'Food odor and cool water. The target: feed when there is food odor AND the water is not too warm. Set the weights, the baseline and the threshold until every row of the table matches. Food eaten where the water is warm counts as harm.',
    channels: channels(CHANNELS.food, CHANNELS.cool),
    sources: [
      { channel: 1, x: 3.5, z: 3.5, strength: 8, scale: 3.6, lifetime: null, respawn: 'none' },
      food(4, 4, PART2_PLUME),
      food(-4, -2, PART2_PLUME),
      food(3, -5, PART2_PLUME),
    ],
    circuit: singleInterneuron([1, 0], 0, 0.5, 'forward'),
    locks: lock(2, false),
    target: {
      name: 'AND',
      sentence: 'feed when there is food odor AND the water is not too warm',
      act: [false, false, false, true],
      verb: 'feed',
    },
    open: { circuit: true, arithmetic: true, target: true, boundary: true },
    onReach: (channel, c) => (channel === 0 ? (present(c[1]) ? 'nourish' : 'harm') : 'ignore'),
    start: { x: -5, z: 4 },
  },
  {
    key: 'target-or',
    part: 2,
    title: 'OR',
    blurb:
      'Shadow and vibration. The target: flee when there is a shadow OR a vibration. Loaded from AND with the weights exactly as you left them: the lesson is that one number changes. Every second spent in a shadow or a vibration counts as harm.',
    channels: channels(CHANNELS.shadow, CHANNELS.vibration),
    sources: [
      { channel: 0, x: 4, z: 4, strength: 8, scale: 2.2, lifetime: 30, respawn: 'anywhere' },
      { channel: 0, x: -5, z: -3, strength: 8, scale: 2.2, lifetime: 30, respawn: 'anywhere' },
      { channel: 1, x: -3, z: 5, strength: 8, scale: 1.8, lifetime: 30, respawn: 'anywhere' },
      { channel: 1, x: 5, z: -5, strength: 8, scale: 1.8, lifetime: 30, respawn: 'anywhere' },
    ],
    circuit: singleInterneuron([1, 1], 0, 2, 'reverse'),
    keepWiringFrom: 'target-and',
    locks: lock(2, false),
    target: {
      name: 'OR',
      sentence: 'flee when there is a shadow OR a vibration',
      act: [false, true, true, true],
      verb: 'flee',
    },
    open: { circuit: true, arithmetic: true, target: true, boundary: true },
    onReach: () => 'ignore',
    hazard: (c) => (present(c[0]) || present(c[1]) ? 1 : 0),
    start: { x: 0, z: 0 },
  },
  {
    key: 'target-and-not',
    part: 2,
    title: 'AND NOT',
    blurb:
      'Food odor and the scent of something that eats us. The target: advance when there is food odor AND NOT predator scent. This one needs something the first two did not. Food eaten where the scent is present counts as harm.',
    channels: channels(CHANNELS.food, CHANNELS.predator),
    sources: [
      { channel: 1, x: 4, z: 4, strength: 8, scale: 2.2, lifetime: 50, respawn: 'anywhere' },
      { channel: 1, x: -5, z: -4, strength: 8, scale: 2.2, lifetime: 50, respawn: 'anywhere' },
      food(4, 4, PART2_PLUME),
      food(-4, 2, PART2_PLUME),
      food(2, -5, PART2_PLUME),
    ],
    circuit: singleInterneuron([1, 1], 0, 2, 'forward'),
    locks: lock(2, false),
    target: {
      name: 'AND NOT',
      sentence: 'advance when there is food odor AND NOT the scent of something that eats us',
      act: [false, false, true, false],
      verb: 'advance',
    },
    open: { circuit: true, arithmetic: true, target: true, boundary: true },
    onReach: (channel, c) => (channel === 0 ? (present(c[1]) ? 'harm' : 'nourish') : 'ignore'),
    start: { x: -1, z: -1 },
  },
  {
    key: 'diagnosis',
    part: 3,
    title: 'The diagnosis dish',
    blurb:
      'Food odor and carbon dioxide. A healthy animal reaches the food and keeps out of the carbon dioxide, which marks decaying matter and is thick going. Five animals, loaded one at a time into this dish.',
    channels: channels(CHANNELS.food, CHANNELS.co2),
    sources: [
      { channel: 1, x: -1.5, z: 3, strength: 6, scale: 1.2, lifetime: null, respawn: 'none', keepPlumesOut: true },
      { channel: 1, x: 3.5, z: -3, strength: 6, scale: 1.2, lifetime: null, respawn: 'none', keepPlumesOut: true },
      { channel: 1, x: -4.5, z: -4.5, strength: 6, scale: 1.2, lifetime: null, respawn: 'none', keepPlumesOut: true },
      food(5, 5),
      food(-5, -1),
      food(1, -6),
    ],
    circuit: singleInterneuron([1, -2.5], 0, SINGLE_CUE_THRESHOLD, 'forward', 'sigmoid'),
    locks: lock(2, true),
    open: { circuit: true, arithmetic: true, target: false, boundary: false },
    onReach: nourishFood,
    // Decaying matter is thick going, and thicker toward its middle: an
    // animal that backs into the edge of it tail-first can still get out,
    // and one that walks into the middle head-first cannot.
    linger: (c) => (c[1] > 1.8 ? 0.03 : c[1] > 1.0 ? 0.15 : 1),
    start: { x: -2, z: 0 },
  },
  {
    key: 'reversal',
    part: 'closer',
    title: 'The world changes',
    blurb:
      'The same dish, the same animal, the same weights. The food odor now emanates from a toxin. Watch the harm counter. Then fix it with the controls you have been using all hour — the routing switch on the diagram, or the sign of a weight — and ask what you just did that the animal cannot.',
    channels: channels(CHANNELS.food),
    sources: [food(5, 5), food(-5, 3), food(0, -6)],
    circuit: singleInterneuron([1], 0, SINGLE_CUE_THRESHOLD, 'forward'),
    locks: lock(1, false),
    open: { circuit: true, arithmetic: true, target: false, boundary: false },
    onReach: (channel) => (channel === 0 ? 'harm' : 'ignore'),
    start: { x: -2, z: 0 },
  },
]

export function scenarioByKey(key: string): Scenario {
  const s = SCENARIOS.find((sc) => sc.key === key)
  if (!s) throw new Error(`no scenario ${key}`)
  return s
}

export const DIAGNOSIS = scenarioByKey('diagnosis')
