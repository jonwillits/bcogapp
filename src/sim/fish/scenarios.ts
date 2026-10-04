import type { Activation } from '../bilaterian/unit'
import type { BuiltIn, HiddenMode } from './brain'
import type { KindId } from './kinds'

/**
 * The seven scenarios of the Module 7 lab. Each loads what the spec's §8
 * table says; this file is the readable source of truth for that table as
 * built.
 */

/** Where the verdict goes: §4.2.9's labeled line, locked per scenario. */
export type FishRoute = 'dart' | 'eat'

export const ROUTE_LABEL: Record<FishRoute, string> = {
  dart: 'dart to cover',
  eat: 'eat',
}

/** What a scenario lets the student change. Anything not listed is printed, not slid. */
export type Control =
  | 'weights'
  | 'baseline'
  | 'thresholds'
  | 'activation'
  | 'hiddenCount'
  | 'hiddenMode'
  | 'builtIns'
  | 'criterion'
  | 'chemistry'
  | 'stakes'
  | 'baseRate'
  | 'spread'
  | 'source'
  | 'poolSize'
  | 'learningOn'
  | 'rate'

/** Which things are in the stream: half the encounters from `happens`, half from `doesNot`, unless the base rate says otherwise. */
export interface Mix {
  label: string
  happens: KindId[]
  doesNot: KindId[]
}

export interface TestSetSpec {
  key: string
  label: string
  mix: Mix
  far: boolean
}

export interface FishScenario {
  key: string
  part: 1 | 2 | 3 | 4 | 5 | 'closer'
  /** The menu's letter, where two scenarios share a part. */
  letter: string
  title: string
  blurb: string
  route: FishRoute
  /** One mix per phase. Most scenarios have one phase. */
  phases: Mix[]
  spread: number
  source: 'stream' | 'pool'
  poolSize: number
  hidden: number
  hiddenMode: HiddenMode
  activation: Activation
  builtIns: BuiltIn[]
  rate: number
  /** Hand-set starting numbers, for a scenario that ships a wired fish. */
  preset?: { weights: number[]; baseline: number }
  unlocked: Control[]
  testSets: TestSetSpec[]
  testSize: number
  /** Scenario-specific controls on the World tab. */
  extras: ('phases' | 'downstream' | 'stay-around')[]
  /** Which sections of the right-hand panels start open. */
  open: string[]
}

const EEL_SUCKER: Mix = { label: 'eels and suckers', happens: ['eel'], doesNot: ['sucker'] }
const PIKE_CHUB: Mix = { label: 'pike and chub', happens: ['pike'], doesNot: ['chub'] }
const ALL_FOUR: Mix = { label: 'eels, suckers, pike and chub', happens: ['eel', 'pike'], doesNot: ['sucker', 'chub'] }
const FRUIT: Mix = { label: 'fallen fruit', happens: ['ripe-a', 'ripe-b'], doesNot: ['twig', 'rotting'] }
const ISLAND: Mix = { label: 'fruit of any ripeness', happens: ['fruit-right'], doesNot: ['fruit-wrong'] }

export const MIXES = { EEL_SUCKER, PIKE_CHUB, ALL_FOUR, FRUIT, ISLAND }

const NETWORK: Control[] = ['weights', 'baseline', 'thresholds', 'activation', 'hiddenCount', 'hiddenMode']
const LEARNING: Control[] = ['learningOn', 'rate']

/**
 * The healthy fish of Part 2: the weights a single unit arrives at when it
 * learns eel from sucker at this spread — 2.85 to 2.97, −1.47 to −1.77 and
 * −0.68 to −1.04 over six seeds of 5,000 encounters (`tune.probe.ts`) —
 * rounded, with the baseline set so the evidence is zero midway between the
 * typical eel and the typical sucker.
 */
export const HEALTHY_PRESET = { weights: [2.9, -1.6], baseline: -0.9 }

export const FISH_SCENARIOS: readonly FishScenario[] = [
  {
    key: 'one-line',
    part: 1,
    letter: 'Part 1',
    title: 'One line will do',
    blurb: 'An eel and a harmless sucker, told apart by one unit drawing one line.',
    route: 'dart',
    phases: [EEL_SUCKER],
    spread: 0.06,
    source: 'stream',
    poolSize: 12,
    hidden: 0,
    hiddenMode: 'hand',
    activation: 'sigmoid',
    builtIns: [],
    rate: 0.2,
    unlocked: ['weights', 'baseline', 'criterion', 'spread', ...LEARNING],
    testSets: [{ key: 'test', label: 'test set', mix: EEL_SUCKER, far: false }],
    testSize: 200,
    extras: [],
    open: ['feature-space', 'curve'],
  },
  {
    key: 'diagnosis',
    part: 2,
    letter: 'Part 2',
    title: 'Jumpy or blind?',
    blurb: 'The same two animals, with smells that vary more. Where the line is drawn, and how far apart the two kinds lie.',
    route: 'dart',
    phases: [EEL_SUCKER],
    spread: 0.15,
    source: 'stream',
    poolSize: 12,
    hidden: 0,
    hiddenMode: 'hand',
    activation: 'sigmoid',
    builtIns: [],
    rate: 0.2,
    preset: HEALTHY_PRESET,
    unlocked: ['criterion', 'chemistry', 'stakes', 'baseRate'],
    testSets: [{ key: 'test', label: 'test set', mix: EEL_SUCKER, far: false }],
    testSize: 1000,
    extras: [],
    open: ['evidence', 'scorecard', 'stakes'],
  },
  {
    key: 'fruit',
    part: 3,
    letter: 'Part 3',
    title: 'Ripe or rotting',
    blurb: 'Either smell alone means ripe fruit. Both together mean rot. Neither means nothing to eat.',
    route: 'eat',
    phases: [FRUIT],
    spread: 0.06,
    source: 'stream',
    poolSize: 12,
    hidden: 0,
    hiddenMode: 'hand',
    activation: 'sigmoid',
    builtIns: [],
    rate: 0.2,
    unlocked: [...NETWORK, 'builtIns', 'criterion', 'spread', ...LEARNING],
    testSets: [{ key: 'test', label: 'test set', mix: FRUIT, far: false }],
    testSize: 200,
    extras: [],
    open: ['feature-space', 'hidden-space', 'curve'],
  },
  {
    key: 'island',
    part: 4,
    letter: 'Part 4',
    title: 'Built in, wired at random, or learned',
    blurb: 'A fruit is good to eat only when its smell is at just the right strength.',
    route: 'eat',
    phases: [ISLAND],
    spread: 0.06,
    source: 'stream',
    poolSize: 12,
    hidden: 0,
    hiddenMode: 'hand',
    activation: 'sigmoid',
    builtIns: [],
    rate: 0.2,
    unlocked: [...NETWORK, 'builtIns', 'criterion', ...LEARNING],
    testSets: [{ key: 'test', label: 'test set', mix: ISLAND, far: false }],
    testSize: 200,
    extras: [],
    open: ['feature-space', 'curve'],
  },
  {
    key: 'pool',
    part: 5,
    letter: 'Part 5a',
    title: 'The eels it has met',
    blurb: 'A small pool with a dozen residents, met again and again.',
    route: 'dart',
    phases: [EEL_SUCKER],
    spread: 0.15,
    source: 'pool',
    poolSize: 12,
    hidden: 8,
    hiddenMode: 'pass-back',
    activation: 'sigmoid',
    builtIns: [],
    rate: 0.2,
    unlocked: ['hiddenCount', 'spread', 'source', 'poolSize', ...LEARNING],
    testSets: [{ key: 'test', label: 'test set', mix: EEL_SUCKER, far: false }],
    testSize: 200,
    extras: [],
    open: ['feature-space', 'curve'],
  },
  {
    key: 'downstream',
    part: 5,
    letter: 'Part 5b',
    title: 'Downstream',
    blurb: 'A fish that grew up where eels and suckers pass close by, taken to where they are far off.',
    route: 'dart',
    phases: [EEL_SUCKER],
    spread: 0.06,
    source: 'stream',
    poolSize: 12,
    hidden: 0,
    hiddenMode: 'hand',
    activation: 'sigmoid',
    builtIns: [],
    rate: 0.2,
    unlocked: [...LEARNING],
    testSets: [
      { key: 'near', label: 'near test set', mix: EEL_SUCKER, far: false },
      { key: 'far', label: 'far test set', mix: EEL_SUCKER, far: true },
    ],
    testSize: 200,
    extras: ['downstream'],
    open: ['feature-space', 'curve'],
  },
  {
    key: 'new-predator',
    part: 'closer',
    letter: 'Closer',
    title: 'A new predator',
    blurb: 'A fish that has learned eels and suckers meets a pike and a chub.',
    route: 'dart',
    phases: [EEL_SUCKER, PIKE_CHUB, ALL_FOUR],
    spread: 0.06,
    source: 'stream',
    poolSize: 12,
    hidden: 6,
    hiddenMode: 'pass-back',
    activation: 'sigmoid',
    builtIns: [],
    rate: 0.2,
    unlocked: [...LEARNING],
    testSets: [
      { key: 'old', label: 'eel and sucker test set', mix: EEL_SUCKER, far: false },
      { key: 'new', label: 'pike and chub test set', mix: PIKE_CHUB, far: false },
    ],
    testSize: 200,
    extras: ['phases', 'stay-around'],
    open: ['feature-space', 'curve'],
  },
]

export function scenarioByKey(key: string): FishScenario {
  const s = FISH_SCENARIOS.find((x) => x.key === key)
  if (!s) throw new Error(`no fish scenario ${key}`)
  return s
}

/** What phase 3 of the closer is called on its button. */
export const EEL_RETURNS = 'An eel comes back'
