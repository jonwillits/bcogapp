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
  /** Part 3 runs a rule this animal does not have, and the panel says so. */
  tierFour?: boolean
  /** Which Learning-tab sections this scenario uses. */
  show: { trace: boolean; discount: boolean; credit: boolean; twoEquations: boolean }
}

export interface LearningScenario extends Scenario {
  learning: LearningSpec
}

const NEUTRAL = {
  salt: { name: 'salt', color: '#e8f1ff' },
  almond: { name: 'almond odor', color: '#ff9f6b' },
} as const

function channels(...specs: { name: string; color: string; pursuitDrives?: boolean }[]): ChannelSpec[] {
  return specs.map((s, i) => ({ channel: i, name: s.name, color: s.color, pursuitDrives: s.pursuitDrives }))
}

/** The teacher counts a cue as present at half its ceiling. */
const PRESENT = 0.5

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
      settings: { factor: 'coincidence' },
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
]

export function learningScenarioByKey(key: string): LearningScenario {
  const s = LEARNING_SCENARIOS.find((sc) => sc.key === key)
  if (!s) throw new Error(`no scenario ${key}`)
  return s
}
