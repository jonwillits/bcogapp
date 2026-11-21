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
      'In this step we will show what can be learned about the meaning of words using “distributional semantics”, as described in §13.2.10 of the reading. We will do this by building a “count model” of the text corpus. The model counts which tokens co-occur with each other, and stores that data in a co-occurrence matrix. Each cell of the matrix shows how often each row token came after each column token in the window.',
      'The model moves a multi-token window along the corpus, one token at a time. For every pair of tokens inside the window, it increments the count in the matrix for that pair. It increments the count by more for two tokens that are closer together. Each token’s list of counts, one count for each other token before it and after it, is called its “embedding” vector. An embedding vector is a list of numbers learned from the token’s contexts. Tokens that are used alike will have similar embedding vectors.',
      'Before the model is created, choose a prediction from the menu above the “Count” button, and then press “Commit my prediction”. Your prediction: which word will lie closest to “cat”? Remember, make your prediction based on the rules of how the corpus was generated, not what you know about real languages.',
      'Then press “Count”. The table of counts will fill in as the model runs through the corpus, with every token as a row and as a column, and their co-occurrence number printed in every cell. The color behind a number grows with the count to help visualize where numbers are big and small. The table is wider than the panel, so it scrolls sideways inside its own frame while the column of row tokens stays put.',
      'Under the table, there are other elements, each with its explanation. There is a demo of how the similarity of two tokens is computed, as the correlation of their two embedding vectors, for ten sample tokens. There is a figure of the tokens as points on a plane, from a projection of their vectors onto the two directions of greatest difference. For any token chosen from a menu, its five nearest neighbors appear with their correlations. And finally, a tree of clusters, which joins the most similar tokens first.',
    ],
    minutes: stepParams('predictors', 2).minutes,
    sitting: 'leave any time',
    sittingLine: EXPLORATION_SITTING_LINE,
    keys: ['“Commit my prediction” commits the one prediction, asked once.', '“Count” runs the model over the corpus.', 'The menu under the plane, “Nearest neighbors of”, shows the five nearest neighbors of the token chosen in it.', '“Go on to Step 3”, at the end of the panel, opens Step 3.'],
    content: [ONE_CORPUS_LINE],
    next: NEXT_LINE[2],
  },
  3: {
    step: 3,
    title: STEP_TITLES[3],
    kind: 'exploration',
    willDo: [
      'As you saw in Step 2, representing tokens as vectors of co-occurrence counts does a good job of encoding their meaning group and some of their grammatical properties. In this step you will look at two things the counts of Step 2 do not capture, on two screens. Press a screen’s name at the top of the main panel to go to it.',
      'The first screen, “Prediction from counts”, shows a predictor built from the same corpus. It gives a probability to each possible next token from the one token before it, and from the two tokens before it. Each probability is a count divided by a count, and the panel prints the division. Three prompts stand side by side: “girls”; “girls who chase boys”; “girls who boys chase”. In the grammar, the next token after each of them is a plural verb form, because the subject of each is “girls”, or “who”, which opens one more clause. Before the predictions appear, choose a prediction above the “Compute” button and press “Commit my prediction”: after “girls who boys chase”, which kind of token will the counts make most probable? Then press “Compute”, and the predictions appear as bars under each prompt.',
      'The second screen, “One point per word”, shows the word “chases” in two sentences, and where its embedding lies in each. The same two sentences come back in Step 4.',
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
      'In this step you will run two neural networks that were trained on the corpus before the lab was posted. Both were trained to predict the next token in the corpus.',
      'A simple recurrent network (§13.2.9) takes one token at a time, and feeds a copy of its own hidden layer back in with the next token. This means that each of its predictions depends on the current token and on its own internal representation of everything that came before the current token.',
      'A transformer (§13.2.12) computes, at each position, a weighted sum over every earlier position, with weights from comparing a query at the position with a key at each earlier one. That computation is called “attention”. The main panel shows a drawing of each network with its explanation under it.',
      'Build a prompt by pressing tokens in the palette, which offers the whole vocabulary. The tokens the grammar allows next are outlined; any token can be pressed, and a prompt the grammar does not allow is marked as such. “Remove the last token” and “Clear the prompt” edit the prompt.',
      'Before your first prompt, choose a prediction in the box above the palette, and press “Commit my prediction”. You are predicting which verb form, singular or plural, each network will give more probability to after the prompt “boys who Mary chases”.',
      'For any prompt, three bar charts side by side show the probability of every token as the next one, grouped as nouns, verbs, “who”, and the end mark. The bar charts show this prediction from the count matrix of Step 3, from the simple recurrent network, and from the transformer. Under them, for the transformer, lines run from the last token back to each earlier token, one panel for each layer and each attention computation, with the thickness of each line set by its weight.',
      'At the bottom, beside the generated sentences, there is a slider labeled “Temperature”. Temperature is a parameter used when the models are being used to generate sentences. Each model generates a probability distribution for all possible tokens that could come next. If we always used the most probable word, these models would be very deterministic and repetitive. To create variability, we can instead choose a word from the probability distribution based on the probabilities.',
      'Temperature is a way of deciding how much to be biased towards the more probable outcomes. A temperature of 0 would always select the most probable word. A temperature of 1 would always select words according to their actual probabilities in the distribution. And a temperature of infinity would be equally likely to choose any word, ignoring probability altogether. Here, we allow you to manipulate the temperature setting from 0.2 to 2.0 when generating sentences. The sentences you generate are printed side by side, each marked with whether the grammar allows it.',
    ],
    minutes: stepParams('predictors', 4).minutes,
    sitting: 'leave any time',
    sittingLine: EXPLORATION_SITTING_LINE,
    keys: ['Press a token in the palette to add it to the prompt; the outlined tokens are the ones the grammar allows next.', '“Remove the last token” and “Clear the prompt” edit the prompt.', '“Commit my prediction” commits the one prediction, asked once.', '“Temperature” is a slider; “Generate a sentence” samples one sentence from each network at that temperature.'],
    content: [ONE_CORPUS_LINE, TRAINED_BEFORE_LINE],
    next: NEXT_LINE[4],
  },
  5: {
    step: 5,
    title: STEP_TITLES[5],
    kind: 'exploration',
    willDo: [
      'In this step you will move through eight snapshots of the two networks of Step 4, saved during their training, from before any training to its end. A slider, “Snapshot”, at the top of the main panel moves through them, and the panel prints how many updates of the weights each snapshot had.',
      'At each snapshot you see three panels. The first shows three bar charts side by side: the probability of each token as the next one after the current prompt, from the counts of Step 3, from the recurrent network, and from the transformer. The prompt starts as the beginning of a held-out sentence; “Change the prompt”, beside the slider, draws another, and the palette of tokens under the prompt builds any prompt you like, as in Step 4. The count model follows the slider too: at each snapshot it has counted the sentences the networks had seen by then, 32 per update, which is every training sentence from the third snapshot on. The second panel shows agreement by depth: the share of a set of probe sentences on which a predictor gives more probability to the verb that agrees with its subject than to the one that does not, with 0, 1, 2, and 3 relative clauses between the subject and the verb. Its plot has three lines, one for each predictor at the snapshot. Under the plot, three tables list, for the count model and for each network, three scores at every snapshot on the held-out sentences and on the training sentences (agreement, the right kind of token, the exact token) and agreement by depth. The third panel shows three planes side by side: the count model’s lists of counts from Step 2, and each network’s output weights, each projected onto its own two directions of greatest difference.',
      'In every probe sentence, the noun just before the main verb differs in number from the subject. So a predictor that went by the nearest noun would get every probe wrong.',
    ],
    minutes: stepParams('predictors', 5).minutes,
    sitting: 'leave any time',
    sittingLine: NO_PREDICTION_SITTING_LINE,
    keys: ['“Snapshot” is a slider with eight positions.', '“Change the prompt” draws a new prompt from a held-out sentence.', 'The tokens under the prompt are buttons: press one to add it to the prompt. “Remove the last token” and “Clear the prompt” edit it.', 'The prediction from counts is drawn in every chart and plot for comparison, from the sentences counted at the snapshot.'],
    content: [TRAINED_BEFORE_LINE],
    next: NEXT_LINE[5],
  },
}
