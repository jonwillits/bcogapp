import { MAIN_TABS, stepParams } from '../params'
import { ONE_CORPUS_LINE, TRAINED_BEFORE_LINE } from '../lines'
import { EXPLORATION_SITTING_LINE, type StepScreen } from '../steps'

/**
 * Part 4's instruction screens (spec §8, §4.4): five explorations, each
 * with its predictions committed before its first result. The chapter's
 * terms are defined where they are used, as the chapter defines them. The
 * left column is navigation only; every control and every result a screen
 * names is in the main panel (Jon, 2026-11-16, LAB_COMMON_FEATURES §1).
 */

export type Step = 1 | 2 | 3 | 4 | 5

/** Steps 1 and 5 ask for no prediction, so their pausing line says nothing about predictions (Jon, 2026-11-17). */
export const NO_PREDICTION_SITTING_LINE = 'You can leave and come back at any time. Nothing in this step is saved.'

export const STEP_TITLES: Record<Step, string> = {
  1: 'Step 1 — The corpus',
  2: 'Step 2 — A count model',
  3: 'Step 3 — What counts cannot do',
  4: 'Step 4 — A simple recurrent network and a transformer',
  5: 'Step 5 — Watching it learn',
}

export const NEXT_LINE: Record<Step, string> = {
  1: 'When you have read the sentences you want to read, press “Go on to Step 2” at the end of the panel or in the navigation panel.',
  2: 'When you have seen the views you want to see, press “Go on to Step 3” at the end of the panel or in the navigation panel.',
  3: 'When you have seen the two screens, press “Go on to Step 4” at the end of the panel or in the navigation panel.',
  4: 'When you have tried the prompts you want to try and generated the sentences you want to see, press “Go on to Step 5” in the navigation panel.',
  5: `This is the lab’s last step. When you have seen the snapshots you want to see, the lab is done: every finished experiment’s results are on the ${MAIN_TABS.results} tab at the top of this panel.`,
}

export const SCREENS: Record<Step, StepScreen> = {
  1: {
    step: 1,
    title: STEP_TITLES[1],
    kind: 'exploration',
    willDo: [
      'In this part you will look inside three kinds of program that each compute, for a text, how likely each word is to come next. Every program in this part learned from the same made-up corpus of sentences, and from nothing else.',
      'A corpus is a collection of texts. Each text contains a set of sentences that are composed of units called “tokens”. A token is just the word for the smallest unit or entity in the corpus. In our case, the tokens are mostly words, but also include the punctuation character “.”. In this step, we will show you the corpus: first the rules it was made by, then its sentences.',
      'Nothing is scored, and nothing is recorded in this step.',
    ],
    minutes: stepParams('predictors', 1).minutes,
    sitting: 'leave any time',
    sittingLine: NO_PREDICTION_SITTING_LINE,
    keys: ['“Show me sentences” prints 20 sentences from the corpus.', '“Go on to Step 2”, at the end of the panel, opens Step 2.'],
    content: [ONE_CORPUS_LINE],
    next: NEXT_LINE[1],
  },
  2: {
    step: 2,
    title: STEP_TITLES[2],
    kind: 'exploration',
    willDo: [
      'In this step we will build a “count model” of the corpus, of the kind described in §13.2.10 of the reading. The model counts which tokens co-occur with each other, in the form of a matrix. Each cell of the matrix shows how often each row token came after each column token in the window.',
      'The model moves a window along the corpus, one token at a time. For every pair of tokens inside the window, it adds to a count for that pair, and it adds more for two tokens that are closer together. Each token’s list of counts, one count for each other token before it and after it, is called its “embedding” vector: a list of numbers learned from the token’s contexts. Tokens that are used alike will have similar embedding vectors.',
      'Before the first count, choose a prediction from the menu above the “Count” button and press “Commit my prediction”: which word will lie closest to cat? Remember, make your prediction based on the rules of how the corpus was generated, not what you know about real languages.',
      'Then press “Count”. The table of counts fills as the model runs through the corpus, with every token as a row and as a column and the number printed in every cell; the color behind a number grows with the count. The table is wider than the panel, so it scrolls sideways inside its own frame while the column of row tokens stays put.',
      'Under the table, there are other elements, each with its explanation. There is a demo of how the similarity of two tokens is computed, as the correlation of their two embedding vectors, for four sample tokens. There is a figure of the tokens as points on a plane, from a projection of their vectors onto the two directions of greatest difference. For any token whose name you press, its five nearest neighbors appear with their correlations. And finally, a tree of clusters, which joins the most similar tokens first.',
    ],
    minutes: stepParams('predictors', 2).minutes,
    sitting: 'leave any time',
    sittingLine: EXPLORATION_SITTING_LINE,
    keys: ['“Commit my prediction” commits the one prediction, asked once.', '“Count” runs the model over the corpus.', 'Press a token’s name under the plane to see its five nearest neighbors.', '“Go on to Step 3”, at the end of the panel, opens Step 3.'],
    content: [ONE_CORPUS_LINE],
    next: NEXT_LINE[2],
  },
  3: {
    step: 3,
    title: STEP_TITLES[3],
    kind: 'exploration',
    willDo: [
      'As you saw in Step 2, representing tokens as vectors of co-occurrence counts does a good job of encoding their meaning group and some of their grammatical properties. In this step you will look at two things the counts of Step 2 do not capture, on two screens. Press a screen’s name at the top of the main panel to go to it.',
      'The first screen, “Prediction from counts”, shows a predictor built from the same corpus. It gives a probability to each possible next token from the one token before it, and from the two tokens before it. Each probability is a count divided by a count, and the panel prints the division. Three prompts stand side by side: girls; girls who chase boys; girls who boys chase. In the grammar, the next token after each of them is a plural verb form, because the subject of each is girls, or who, which opens one more clause. Before the predictions appear, choose a prediction above the “Compute” button and press “Commit my prediction”: after girls who boys chase, which kind of token will the counts make most probable? Then press “Compute”, and the predictions appear as bars under each prompt.',
      'The second screen, “One point per word”, shows the word chases in two sentences, and where its embedding lies in each. The same two sentences come back in Step 4.',
    ],
    minutes: stepParams('predictors', 3).minutes,
    sitting: 'leave any time',
    sittingLine: EXPLORATION_SITTING_LINE,
    keys: ['Press a screen’s name at the top of the main panel to go to it.', '“Commit my prediction” commits the one prediction; then “Compute” shows the predictions from counts.', '“Go on to Step 4”, at the end of the panel, opens Step 4.'],
    content: [ONE_CORPUS_LINE],
    next: NEXT_LINE[3],
  },
  4: {
    step: 4,
    title: STEP_TITLES[4],
    kind: 'exploration',
    willDo: [
      'In this step you will run two networks that were trained on the corpus before the lab was posted. Both were trained to predict the next token. A simple recurrent network (§13.2.9) takes one token at a time and feeds a copy of its own hidden layer back in with the next token, so that each of its predictions depends on the current token and on one summary of everything before it. A transformer (§13.2.12) computes, at each position, a weighted sum over every earlier position, with weights from comparing a query at the position with a key at each earlier one. That computation is called attention. The main panel shows a drawing of each network with its explanation under it, and a block under the drawings states each network’s size and training.',
      'Build a prompt by pressing tokens in the palette, which offers the whole vocabulary. The tokens the grammar allows next are outlined; any token can be pressed, and a prompt the grammar does not allow is marked as such. “Remove the last token” and “Clear the prompt” edit it.',
      'Before your first prompt, choose two predictions in the two boxes above the palette and press “Commit my predictions”. First, after boys who Mary chases, which verb form will each network give more probability to? Second, at a temperature of 2.0, will most of the sentences each network generates be ones the grammar allows?',
      'For any prompt, three bar charts side by side show the probability of every token as the next one, grouped as nouns, verbs, who, and the end mark: from the transformer, from the recurrent network, and from the counts of Step 3, from the two words before or, when those two never occurred together in the corpus, from the one word before. Under them, for the transformer, lines run from the last token back to each earlier token, one panel for each layer and each attention computation, with the thickness of each line set by its weight. At the bottom, beside the generated sentences, a slider, “Temperature”, runs from 0.2 to 2.0, and “Generate a sentence” samples one sentence from each network at that temperature: the first token from how often each token begins a sentence in the corpus, then one token at a time from the network, until the end mark or 32 tokens. The two sentences are printed side by side, each marked with whether the grammar allows it.',
    ],
    minutes: stepParams('predictors', 4).minutes,
    sitting: 'leave any time',
    sittingLine: EXPLORATION_SITTING_LINE,
    keys: ['Press a token in the palette to add it to the prompt; the outlined tokens are the ones the grammar allows next.', '“Remove the last token” and “Clear the prompt” edit the prompt.', '“Commit my predictions” commits the two predictions, asked once.', '“Temperature” is a slider; “Generate a sentence” samples one sentence from each network at that temperature.'],
    content: [ONE_CORPUS_LINE, TRAINED_BEFORE_LINE],
    next: NEXT_LINE[4],
  },
  5: {
    step: 5,
    title: STEP_TITLES[5],
    kind: 'exploration',
    willDo: [
      'In this step you will move through eight snapshots of the two networks of Step 4, saved during their training, from before any training to its end. A slider, “Snapshot”, at the top of the main panel moves through them, and the panel prints how many updates of the weights each snapshot had.',
      'At each snapshot you see three panels. The first shows three bar charts side by side: the probability of each token as the next one after one fixed prompt, from the transformer, from the recurrent network, and from the counts of Step 3. “Change the prompt”, beside the slider, replaces the prompt. The second shows agreement by depth: the share of a set of probe sentences on which a predictor gives more probability to the verb that agrees with its subject than to the one that does not, with 0, 1, 2, and 3 relative clauses between the subject and the verb. Its plot has three lines, one for each network at the snapshot and one for the prediction from counts, which does not change across snapshots because the count model is not trained. Under the plot, a table lists every snapshot’s held-out accuracy and agreement by depth, as measured when the networks were trained. The third panel shows three planes side by side: the transformer’s input embeddings, the recurrent network’s input weights, and the count model’s lists of counts from Step 2, each projected onto its own two directions of greatest difference.',
      'In every probe sentence, the noun just before the main verb differs in number from the subject. So a predictor that went by the nearest noun would get every probe wrong.',
    ],
    minutes: stepParams('predictors', 5).minutes,
    sitting: 'leave any time',
    sittingLine: NO_PREDICTION_SITTING_LINE,
    keys: ['“Snapshot” is a slider with eight positions.', '“Change the prompt” replaces the fixed prompt.', 'The prediction from counts is drawn in every chart and plot for comparison; it is the same at every snapshot.'],
    content: [TRAINED_BEFORE_LINE],
    next: NEXT_LINE[5],
  },
}
