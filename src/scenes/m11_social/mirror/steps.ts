import { HUMAN_RESULT_LINE, MODEL_CELLS_LINE } from '../lines'

/**
 * The four steps of Part 6 (spec §10.3): before learning; the other
 * macaque copies you; the other macaque grasps at random (the contingency
 * control, cuttable); the other macaque does the opposite. Every step asks
 * a prediction before it runs. Explorations, with Go to, Go back and Redo.
 */

export type Step = 1 | 2 | 3 | 4

export interface Prediction {
  key: string
  question: string
  choices: string[]
}

export interface StepSpec {
  step: Step
  title: string
  reread: string
  willDo: string[]
  minutes: number
  content: string[]
  predictions: Prediction[]
}

const RESPONSES = ['a precision grip seen', 'a whole-hand grasp seen', 'both', 'neither']

export const STEPS: StepSpec[] = [
  {
    step: 1,
    title: 'Step 1 — Before learning',
    reread: 'Reread §11.3.5 of the reading: what a mirror neuron is, and where the first ones were recorded.',
    willDo: [
      'You are the macaque seated at the low table, seen from behind and above your right shoulder. In front of you are a raisin-sized piece of food, for a precision grip, and a fruit-sized one, for a whole-hand grasp. Across the table sits a second macaque with its own pieces. “Precision grip” (the P key) and “Whole-hand grasp” (the W key) make you reach for, grasp and eat the matching piece; each grasp takes about a second and a half.',
      'Two of your premotor cells are on the right: a precision cell and a whole-hand cell, in the area of premotor cortex where the first mirror neurons were recorded, F5. Each fires when you perform its grasp, through a fixed motor input that does not learn. Each also has four visual inputs, whose weights start at zero and learn by Lab 5’s Prediction setting: a precision grip and a whole-hand grasp seen from your own view (your own hand), and the two seen from across the table (the other macaque’s hand). You see your own hand on about three grasps in ten; you are looking at the food or the other macaque on the rest.',
      'The recording panel shows each cell’s firing over the last 30 seconds with every grasp marked by who made it and which kind, the 4 × 2 table of visual weights, and the current step’s test. “Run the test” is a fixed sequence: you do nothing while the other macaque performs 10 precision grips and 10 whole-hand grasps in a seeded order, learning off, and the panel reports each cell’s mean firing to each kind, seen from across the table.',
      'In this step the other macaque does nothing. First, predict whether either cell will fire when you watch the other macaque’s grasp before any learning. Then perform a few grasps of each kind, and press “Run the test”.',
    ],
    minutes: 2,
    content: [MODEL_CELLS_LINE],
    predictions: [{ key: 'p6-s1', question: 'Before any learning, will a cell fire when you watch the other macaque grasp?', choices: ['yes', 'no'] }],
  },
  {
    step: 2,
    title: 'Step 2 — The other macaque copies you',
    reread: 'Reread §11.3.5 of the reading: the associative account, on which seeing an action while doing it links the two.',
    willDo: [
      'The other macaque now copies your grasp a moment after you begin it. Perform 40 grasps, by the keys or with “Run 40 grasps”, which performs 20 of each kind in a seeded order. Then press “Run the test”.',
      'First, predict what the precision cell will respond to, seen from across the table, after the 40 copied grasps.',
    ],
    minutes: 3,
    content: [],
    predictions: [{ key: 'p6-s2', question: 'After the other macaque copies 40 of your grasps, what will the precision cell fire to, seen from across the table?', choices: RESPONSES }],
  },
  {
    step: 3,
    title: 'Step 3 — The other macaque grasps at random',
    reread: 'Reread §11.3.5 of the reading, and the associative account’s need for contingency, not only contiguity (Cook et al., 2014).',
    willDo: [
      '“Reset the cells” sets every visual weight back to zero. The other macaque now grasps as often as you do, either kind, at moments of its own that have nothing to do with yours. Perform 40 grasps, by the keys or with “Run 40 grasps”. Then press “Run the test”.',
      'First, predict how strong the mirror response will be after 40 grasps with a partner that grasps at random, compared with Step 2’s.',
    ],
    minutes: 2,
    content: [],
    predictions: [{ key: 'p6-s3', question: 'With the other macaque grasping at random, as often as you, how strong will the mirror response be after 40 grasps?', choices: ['as strong as after copying', 'weaker', 'none at all'] }],
  },
  {
    step: 4,
    title: 'Step 4 — The other macaque does the opposite',
    reread: 'Reread §11.3.5 of the reading: the training that reversed the usual mirror response in people.',
    willDo: [
      'The cells start again from where Step 2 left them, with their mirror responses. Now the other macaque answers each of your grasps with the other grasp: a whole-hand grasp when you make a precision grip, a precision grip when you make a whole-hand grasp. Perform 40 grasps, by the keys or with “Run 40 grasps”. Then press “Run the test”.',
      'First, predict what the precision cell will fire to after the 40 opposite grasps.',
    ],
    minutes: 3,
    content: [HUMAN_RESULT_LINE],
    predictions: [{ key: 'p6-s4', question: 'After 40 grasps each answered by the opposite grasp, what will the precision cell fire to, seen from across the table?', choices: RESPONSES }],
  },
]

export const stepSpec = (s: Step): StepSpec => STEPS[s - 1]
