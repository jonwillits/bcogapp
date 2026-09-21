import { singleInterneuron } from '../circuit'
import { CHANNELS, SINGLE_CUE_THRESHOLD, scenarioByKey, type ChannelSpec, type Scenario } from '../scenarios'
import { WEIGHT_CEILING, WEIGHT_FLOOR } from './rule'
import type { LearnerConfig, LearningSettings } from './learner'
import type { LearningDish } from './learningDish'

/**
 * The six scenarios of the Module 5 spec's §6. Each is a Lab 4 scenario —
 * the same type, the same dish, the same animal — with a `learning` block
 * saying how the learning layer is set when it loads, which of its controls
 * a student may move, and what the world does at a site.
 *
 * As in Lab 4, **the consequences live in the world and not on the
 * channel.** Four of the six change what reaching something does, and the
 * World tab prints the current answer so a student can check instead of
 * remembering.
 */

/** A place marked by one or more cues, and what touching it delivers. */
export interface SiteSpec {
  /** Channels of the cues that mark it. */
  cues: number[]
  payload: 'nourish' | 'harm' | 'nothing'
}

export interface LearningSpec {
  /** How the Learning tab is set when the scenario loads. */
  settings: Partial<LearningSettings>
  /** Which third factors the selector offers here. One entry means the selector is locked. */
  factors: LearningSettings['factor'][]
  /** Whether the two bound switches are held off here. They are `pairing`'s to explore. */
  boundsLocked?: boolean
  /** Which connections the rule may move, and which take part in the prediction. */
  config: LearnerConfig
  /** The channel whose cell reports food at the mouth — what a site's delivery arrives on. */
  outcomeChannel?: number
  /** Seconds between touching a site and its delivery, and whether the student may change it. */
  interval?: number
  intervalControl?: boolean
  /** Switches the student can flip, with their labels and starting positions. */
  flags?: Record<string, boolean>
  flagLabels?: Record<string, string>
  /** The phases a student steps the dish through, in order, where the scenario has them. */
  phases?: { label: string; does: string }[]
  /** The sites the dish should hold now, given its switches. */
  sites?: (w: LearningDish) => SiteSpec[]
  /** The target the scenario holds for an input, where it holds one. Nothing in the animal holds it. */
  teacher?: (x: readonly number[], w: LearningDish) => number | null
  /** What reaching each thing currently does, a line apiece, for the World tab. */
  worldDoes: (w: LearningDish) => string[]
  /**
   * A walled lane along x with a chain of zones in it: the animal starts at
   * one end, food waits at the other, and it is put back at the start after
   * every meal. Each zone is reported by a cell of its own.
   */
  lane?: LaneSpec
  /**
   * Cells that report where the animal is and which session this is. The
   * closer's three buttons act on these and on nothing else.
   */
  context?: { dishes: [number, number]; sessions: [number, number]; cue: number }
  /** Part 3 runs a rule this animal does not have, and the panel says so. */
  tierFour?: boolean
  /** Which Learning-tab sections this scenario uses. */
  show: { trace: boolean; discount: boolean; credit: boolean; twoEquations: boolean }
}

export interface LaneSpec {
  halfWidth: number
  startX: number
  foodX: number
  /** Stretches of floor, each reported by the cell at `cell`. */
  zones: { cell: number; from: number; to: number }[]
  /** A cell that comes on for a moment at some point in every trial and leads nowhere. */
  distractor?: { cell: number; seconds: number }
  /** The points of the chain, in order, for the Credit section: a name and the cell whose value stands for it. */
  chain: { name: string; cell: number }[]
}

export interface LearningScenario extends Scenario {
  learning: LearningSpec
}

const NEUTRAL = {
  salt: { name: 'salt', color: '#e8f1ff' },
  almond: { name: 'almond odor', color: '#ff9f6b' },
} as const

function channels(...specs: { name: string; color: string; pursuitDrives?: boolean; internal?: boolean }[]): ChannelSpec[] {
  return specs.map((s, i) => ({ channel: i, name: s.name, color: s.color, pursuitDrives: s.pursuitDrives, internal: s.internal }))
}

/** The teacher counts a cue as present at half its ceiling. */
const PRESENT = 0.5

const FLOOR = {
  marker: { name: 'the marker', color: '#b388ff', internal: true },
  turn: { name: 'the turn', color: '#5ee6d6', internal: true },
  approach: { name: 'the approach', color: '#ffd166', internal: true },
  hum: { name: 'a passing vibration', color: '#ff6fae', internal: true },
} as const

const CONTEXT = {
  dish: { name: 'dish one', color: '#7fb3ff', internal: true },
  otherDish: { name: 'dish two', color: '#c9a0ff', internal: true },
  session: { name: 'session one', color: '#9be7c0', internal: true },
  laterSession: { name: 'session two', color: '#f0c987', internal: true },
} as const

/**
 * A context connection can only become inhibitory. What an animal learns
 * about a place, in this model, is that something does not hold there; the
 * association itself is carried by the cue. That is a modeling choice, made
 * so that the three returns of §5.2.11 fall out of new learning about context
 * sitting on top of an association that survived, with no weight decaying
 * anywhere.
 */
const inhibitoryOnly = { plastic: true, min: WEIGHT_FLOOR, max: 0 }

const plastic = { plastic: true, min: WEIGHT_FLOOR, max: WEIGHT_CEILING }
const innate = { plastic: false, min: WEIGHT_FLOOR, max: WEIGHT_CEILING }

const unlocked = (n: number) => ({
  weights: Array.from({ length: n }, () => false),
  baseline: false,
  threshold: false,
  route: false,
  activation: false,
})

const reversal = scenarioByKey('reversal')

export const LEARNING_SCENARIOS: LearningScenario[] = [
  {
    ...reversal,
    key: 'hand-over',
    part: 1,
    title: 'Hand the weights over',
    blurb:
      'Lab 4’s last dish: the food odor marks a toxin, and the animal’s one weight says approach. In Lab 4 you were the only thing in the room that could change that weight. Now a rule can. Watch the weight trace on the Circuit tab, and watch the harm counter.',
    learning: {
      settings: { factor: 'coincidence' },
      factors: ['coincidence'],
      boundsLocked: true,
      config: { limits: [plastic], predicts: [true] },
      worldDoes: () => ['food odor marks a toxin: eating there harms'],
      show: { trace: false, discount: false, credit: false, twoEquations: false },
    },
  },
  {
    key: 'pairing',
    part: 1,
    title: 'Salt, then food',
    blurb:
      'Places in the dish are marked by salt, which this animal ignores: its weight is 0. Touch one and food arrives there. The food-odor connection is innate and the rule cannot move it; the salt connection is the rule’s to change. Three controls: how long after the touch the food arrives, a second cue at every site, and the two bounds on the Learning tab.',
    channels: channels(CHANNELS.food, NEUTRAL.salt, NEUTRAL.almond),
    sources: [],
    circuit: singleInterneuron([1, 0, 0], 0, SINGLE_CUE_THRESHOLD, 'forward'),
    locks: { ...unlocked(3), weights: [true, false, false] },
    open: { circuit: true, arithmetic: true, target: false, boundary: false },
    onReach: () => 'ignore',
    start: { x: 0, z: 0 },
    learning: {
      settings: { factor: 'coincidence' },
      factors: ['coincidence'],
      config: { limits: [innate, plastic, plastic], predicts: [false, true, true] },
      outcomeChannel: 0,
      interval: 0,
      intervalControl: true,
      flags: { secondCue: false },
      flagLabels: { secondCue: 'A second cue, almond odor, at every site' },
      sites: (w) => Array.from({ length: 2 }, () => ({ cues: w.flags.secondCue ? [1, 2] : [1], payload: 'nourish' as const })),
      worldDoes: (w) => [
        w.flags.secondCue ? 'salt and almond odor mark the same places' : 'salt marks a place',
        w.interval > 0 ? `touching one brings food ${w.interval.toFixed(1)} s later` : 'touching one brings food at once',
        'the cues at a touched site dissolve after 1.5 s',
      ],
      show: { trace: false, discount: false, credit: false, twoEquations: false },
    },
  },
  {
    key: 'blocking',
    part: 2,
    title: 'Blocking',
    blurb:
      'Three phases, and you decide when each ends. First salt alone marks the food: run it until the salt weight stops climbing. Then almond odor is added at every site, with the food unchanged. Then almond odor alone, with nothing there. Run all three under one rule, write down both weights, press Reset, and run them again under the other.',
    channels: channels(CHANNELS.food, NEUTRAL.salt, NEUTRAL.almond),
    sources: [],
    circuit: singleInterneuron([1, 0, 0], 0, SINGLE_CUE_THRESHOLD, 'forward'),
    locks: { ...unlocked(3), weights: [true, false, false] },
    open: { circuit: true, arithmetic: false, target: false, boundary: false },
    onReach: () => 'ignore',
    start: { x: 0, z: 0 },
    learning: {
      settings: { factor: 'coincidence', traceWindow: 3 },
      factors: ['coincidence', 'prediction', 'teacher', 'verdict'],
      config: { limits: [innate, plastic, plastic], predicts: [false, true, true] },
      outcomeChannel: 0,
      phases: [
        { label: 'Phase 1 — salt alone', does: 'salt marks a place; touching one brings food at once' },
        { label: 'Phase 2 — salt and almond odor together', does: 'salt and almond odor mark the same places; touching one brings the same food' },
        { label: 'Phase 3 — almond odor alone', does: 'almond odor marks a place; touching one brings nothing' },
      ],
      sites: (w) => {
        const spec: SiteSpec = [
          { cues: [1], payload: 'nourish' as const },
          { cues: [1, 2], payload: 'nourish' as const },
          { cues: [2], payload: 'nothing' as const },
        ][w.phase]
        return [spec, spec]
      },
      teacher: (x, w) => (w.phase < 2 && Math.max(x[1], x[2]) >= PRESENT ? 1 : Math.max(x[1], x[2]) > 0 ? 0 : null),
      worldDoes: (w) => [w.scenario.learning.phases![w.phase].does],
      show: { trace: true, discount: true, credit: false, twoEquations: true },
    },
  },
  {
    key: 'four-signals',
    part: 2,
    title: 'Four signals, one problem',
    blurb:
      'One learning problem, held still while you change the rule. Two sites are marked by salt and two by almond odor; one kind holds food and the other holds nothing. Run each of the four settings from Reset, and record what each learns. Then flip which cue marks the food, mid-run, and record what each does about it.',
    channels: channels(CHANNELS.food, NEUTRAL.salt, NEUTRAL.almond),
    sources: [],
    circuit: singleInterneuron([1, 0, 0], 0, SINGLE_CUE_THRESHOLD, 'forward'),
    locks: { ...unlocked(3), weights: [true, false, false] },
    open: { circuit: true, arithmetic: false, target: false, boundary: false },
    onReach: () => 'ignore',
    start: { x: 0, z: 0 },
    learning: {
      settings: { factor: 'coincidence', traceWindow: 3 },
      factors: ['coincidence', 'prediction', 'teacher', 'verdict'],
      config: { limits: [innate, plastic, plastic], predicts: [false, true, true] },
      outcomeChannel: 0,
      flags: { almondMarksFood: false },
      flagLabels: { almondMarksFood: 'Almond odor marks the food (off: salt does)' },
      sites: (w) => {
        const good = w.flags.almondMarksFood ? 2 : 1
        return [1, 2, 1, 2].map((cue) => ({ cues: [cue], payload: cue === good ? ('nourish' as const) : ('nothing' as const) }))
      },
      teacher: (x, w) => {
        const good = w.flags.almondMarksFood ? 2 : 1
        if (x[good] >= PRESENT) return 1
        return x[1] > 0 || x[2] > 0 ? 0 : null
      },
      worldDoes: (w) =>
        w.flags.almondMarksFood
          ? ['almond odor marks food: touching one brings food at once', 'salt marks nothing: touching one brings nothing']
          : ['salt marks food: touching one brings food at once', 'almond odor marks nothing: touching one brings nothing'],
      show: { trace: true, discount: true, credit: false, twoEquations: false },
    },
  },
  {
    key: 'corridor',
    part: 3,
    title: 'The corridor',
    blurb:
      'A lane with a chain in it: a marker on the floor, then a turn, then the approach, then food. After every meal the animal is put back at the start. A vibration passes through at some point in each trial and leads nowhere. Open the Learning tab’s Credit section and watch what each point in the chain comes to be worth, trial by trial.',
    channels: channels({ ...CHANNELS.food, color: '#ffe9a8' }, FLOOR.marker, FLOOR.turn, FLOOR.approach, FLOOR.hum),
    sources: [{ channel: 0, x: 6.5, z: 0, strength: 8, scale: 3, lifetime: null, respawn: 'none' }],
    circuit: singleInterneuron([1, 0, 0, 0, 0], 0, SINGLE_CUE_THRESHOLD, 'forward'),
    locks: { ...unlocked(5), weights: [true, false, false, false, false] },
    open: { circuit: true, arithmetic: false, target: false, boundary: false },
    onReach: (channel) => (channel === 0 ? 'nourish' : 'ignore'),
    start: { x: -7, z: 0 },
    learning: {
      settings: { factor: 'verdict', traceWindow: 3 },
      factors: ['verdict'],
      boundsLocked: true,
      config: { limits: [innate, plastic, plastic, plastic, plastic], predicts: [false, true, true, true, true] },
      lane: {
        halfWidth: 1.3,
        startX: -7,
        foodX: 6.5,
        zones: [
          { cell: 1, from: -6, to: -3.5 },
          { cell: 2, from: -1.5, to: 1 },
          { cell: 3, from: 3, to: 5.5 },
        ],
        distractor: { cell: 4, seconds: 1.5 },
        chain: [
          { name: 'the marker', cell: 1 },
          { name: 'the turn', cell: 2 },
          { name: 'the approach', cell: 3 },
        ],
      },
      tierFour: true,
      worldDoes: () => [
        'food waits at the far end of the lane, and nourishes',
        'the marker, the turn and the approach are stretches of floor; none of them does anything',
        'a vibration passes once per trial, at no particular point, and leads nowhere',
        'after each meal the animal is put back at the start',
      ],
      show: { trace: true, discount: true, credit: true, twoEquations: false },
    },
  },
  {
    key: 'extinction',
    part: 'closer',
    title: 'Extinction',
    blurb:
      'Salt marks the food until its weight stops climbing. Then go to phase 2: salt marks nothing, and the response fades. Look at the salt weight when it has. Then try each of the three buttons, from the same extinguished animal: wait, move it to a second dish, or deliver one meal with no cue at all.',
    channels: channels(CHANNELS.food, NEUTRAL.salt, CONTEXT.dish, CONTEXT.otherDish, CONTEXT.session, CONTEXT.laterSession),
    sources: [],
    circuit: singleInterneuron([1, 0, 0, 0, 0, 0], 0, SINGLE_CUE_THRESHOLD, 'forward', 'sigmoid'),
    locks: { ...unlocked(6), weights: [true, false, false, false, false, false] },
    open: { circuit: true, arithmetic: false, target: false, boundary: false },
    onReach: () => 'ignore',
    start: { x: 0, z: 0 },
    learning: {
      settings: { factor: 'prediction' },
      factors: ['prediction'],
      boundsLocked: true,
      config: {
        limits: [innate, plastic, inhibitoryOnly, inhibitoryOnly, inhibitoryOnly, inhibitoryOnly],
        predicts: [false, true, true, true, true, true],
      },
      outcomeChannel: 0,
      context: { dishes: [2, 3], sessions: [4, 5], cue: 1 },
      phases: [
        { label: 'Phase 1 — acquisition', does: 'salt marks a place; touching one brings food at once' },
        { label: 'Phase 2 — extinction', does: 'salt marks a place; touching one brings nothing' },
      ],
      sites: (w) => {
        const spec: SiteSpec = { cues: [1], payload: w.phase === 0 ? 'nourish' : 'nothing' }
        return [spec, spec]
      },
      worldDoes: (w) => [
        w.scenario.learning.phases![w.phase].does,
        `the animal is in ${w.context.dish === 0 ? 'dish one' : 'dish two'}, in ${w.context.later ? 'session two, after a wait' : 'session one'}`,
      ],
      show: { trace: false, discount: false, credit: false, twoEquations: true },
    },
  },
]

export function learningScenarioByKey(key: string): LearningScenario {
  const s = LEARNING_SCENARIOS.find((sc) => sc.key === key)
  if (!s) throw new Error(`no scenario ${key}`)
  return s
}
