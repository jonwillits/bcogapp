import { MODEL_OF_PLANTS_LINE, MODELS_OWN_GENES_LINE, MODELS_MECHANISM_LINE } from '../lines'
import { PLANTS } from '../../../sim/planning/corn/model'

export type Step = 1 | 2 | 3 | 4

export const STEP_TITLES: Record<Step, string> = { 1: 'Step 1 — One tray', 2: 'Step 2 — Two trays', 3: 'Step 3 — Twins', 4: 'Step 4 — Soil that changes' }

export interface StepScreen {
  step: Step
  title: string
  willDo: string[]
  minutes: number
  content: string[]
}

export const SCREENS: Record<Step, StepScreen> = {
  1: {
    step: 1,
    title: STEP_TITLES[1],
    willDo: [
      `This part is an exploration of heritability with corn plants in a model. A tray holds ${PLANTS} plants, seen from the side, each plant drawn to its height, with a histogram of the heights under the tray. Nothing in this part measures people.`,
      'In the model, each plant’s height is the tray’s mean height, plus a genetic value from its seed, plus an environmental value from its patch of soil. The setting “Seed” chooses the seed: “varied stock”, in which each plant’s genetic value is the sum of many small effects drawn independently, so the plants differ in their genes; or “one uniform line”, in which every plant has the same genetic value. The setting “Soil” chooses the soil within the tray: “even”, in which every patch adds the same, or “patchy”, in which each patch adds a value drawn independently.',
      'Heritability, in the reading’s definition (§12.3.5), is the proportion of the variation in a trait, in a particular population and set of environments, that is associated with genetic variation among its members. Here it is computed within a tray as the variance of the plants’ genetic values divided by the variance of their heights. Variance is the average squared distance of the values from their mean.',
      'Before each “Grow”, choose a prediction of the heritability from the list on the left and press “Commit my prediction”. Then press “Grow”: the plants rise over about five seconds, and the panel prints the variance of the genetic values, the variance of the heights, and the heritability, as numbers and in a sentence. Change the settings and grow again as often as you like; the prediction is asked once.',
      'Under the tray, the earrings panel gives the reading’s example (§12.3.5) as a table of counts: a population of 200 people in a time when only women wore earrings, and in a time when anyone might, with the heritability of wearing one computed in each from the same genes.',
    ],
    minutes: 4,
    content: [MODEL_OF_PLANTS_LINE, MODELS_OWN_GENES_LINE],
  },
  2: {
    step: 2,
    title: STEP_TITLES[2],
    willDo: [
      'This step reproduces, in the model, the two experiments with corn that the reading describes (§12.3.6), after Lewontin (1970).',
      'The first experiment: two uniform lines, different from each other, grown in the same even soil, one line to a tray. The second experiment: seed from one varied stock, grown in two trays in even soil, one tray in a complete nutrient solution and one with half the nitrates and no zinc. The same genetic values go into both trays of the second experiment, so whatever difference appears between the trays comes from the nutrients.',
      'Before each experiment, choose a prediction from the list on the left: within each tray, is the heritability high, and is the difference between the trays genetic? Commit it with “Commit my prediction”, then press “Grow the first experiment” or “Grow the second experiment”. The panel prints each tray’s heritability and mean height, and the difference between the trays.',
      'After the second experiment, two buttons change the second tray’s solution: “Restore the nitrates” puts the nitrates back and leaves out the zinc, and “Restore the zinc” puts both back. Watch what happens to the difference between the trays each time.',
    ],
    minutes: 5,
    content: [MODEL_OF_PLANTS_LINE],
  },
  3: {
    step: 3,
    title: STEP_TITLES[3],
    willDo: [
      'This step simulates a twin study of one trait in a model population: 500 pairs of identical twins and 500 pairs of fraternal twins. A twin study compares how similar identical twins are with how similar fraternal twins are, on the assumption that the two kinds of twins share the environments that matter for the trait to the same degree (§12.3.5). The simulation is of a trait in a model, not of intelligence or of any group of people.',
      'Three sliders set the shares of the trait’s variance that come from genes, from the environment the twins share, and from the rest, which is everything a twin does not share with its twin; moving one rescales the other two so that the three sum to one. In the model, identical twins share all their genes, and fraternal twins share half, on average. A fourth slider, “Identical twins treated more alike”, adds environment that only identical twins share.',
      'Before the first run, choose a prediction from the list on the left and commit it. Then press “Run the twin study”. The panel prints the correlation within identical pairs and within fraternal pairs, the standard estimate of heritability, which is twice their difference, and the true share from genes that the simulation used. “The reading’s figures” sets the sliders to reproduce the correlations the reading reports, about 0.71 and 0.44, and the estimate of about 0.54.',
    ],
    minutes: 4,
    content: [MODEL_OF_PLANTS_LINE],
  },
  4: {
    step: 4,
    title: STEP_TITLES[4],
    willDo: [
      'This step has two panels. In the first, the same varied stock is grown in a poor soil that limits how tall any plant can grow, and in a rich soil that does not, each with patchy soil. Before growing, choose a prediction from the list on the left: in which soil will heritability be higher? Commit it, then press “Grow in poor and rich soil”. The panel prints the heritability within each tray.',
      'In the second panel, “Run six seasons” grows the same varied stock, resampled each season, over six seasons as the soil improves. The panel prints each season’s mean height and heritability, and the rise in the mean over the six seasons in units of the first season’s standard deviation of heights.',
    ],
    minutes: 2,
    content: [MODEL_OF_PLANTS_LINE, MODELS_MECHANISM_LINE],
  },
}

export const READY_LINE = 'Nothing is needed. You will answer in the app. The report is filled in from the results screens afterward.'
export const SITTING_LINE = 'You can leave and come back at any time. Your predictions stay committed; the trays are grown again when you return.'
