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
  5: `This is the last step of the lab. When you have seen the snapshots you want to see, the lab is done: every finished experiment’s results are on the ${MAIN_TABS.results} tab at the top of this panel.`,
}

export const SCREENS: Record<Step, StepScreen> = {
  1: {
    step: 1,
    title: STEP_TITLES[1],
    kind: 'exploration',
    willDo: [
      'In this part you will look inside three kinds of program. Each one computes, from the text so far, how likely each word is to come next. Every program in this part learned from the same made-up corpus of sentences, and from nothing else.',
      'A corpus is a collection of texts. Each text is a set of sentences, and each sentence is made of units called “tokens”. A token is the smallest unit in the corpus. Here the tokens are mostly words; the one other token is the period “.”, which we call the end mark here. In this step we show you the corpus: first the rules that made it, then its sentences.',
      'Nothing is scored, and nothing is recorded in this step.',
    ],
    minutes: stepParams('predictors', 1).minutes,
    sitting: 'leave any time',
    sittingLine: NO_PREDICTION_SITTING_LINE,
    keys: ['Press “Show me sentences” to print 20 sentences from the corpus.', 'Press “Go on to Step 2”, at the end of the panel, to open Step 2.'],
    content: [ONE_CORPUS_LINE],
    next: NEXT_LINE[1],
  },
  2: {
    step: 2,
    title: STEP_TITLES[2],
    kind: 'exploration',
    willDo: [
      'In this step you will see how much of a word’s meaning can be learned from the words that occur near it. In §13.2.10 of the reading, we call this “distributional semantics”. You will see it by building a “count model” of the corpus. The model counts how often each token occurs near each other token, and stores the counts in a co-occurrence matrix. Each cell of the matrix is how often the row token came after the column token, within a window a few tokens wide.',
      'The model moves a window, a few tokens wide, along the corpus, one token at a time. The last token in the window is the target. For each earlier token in the window, the model adds to the count of that token with the target, and adds more the closer the two are. Each token’s list of counts is called its “embedding” vector: one count for each other token before it, and one for each other token after it. An embedding vector is a list of numbers learned from the token’s contexts. Tokens that are used alike have similar embedding vectors.',
      'Before you press “Count”, choose a prediction from the menu above the “Count” button, then press “Commit my prediction”. The question: which word’s embedding vector will be most similar to the embedding vector for ‹cat›? Base your prediction on the rules that made the corpus, not on what you know about real languages or objects.',
      'Then press “Count”. The table of counts fills in as the model runs through the corpus. Every token is a row and a column, and each cell holds the count for its pair. The color behind a number grows with the count, so you can see at a glance where the counts are large and where they are small. The table is wider than the panel: it scrolls sideways inside its own frame, and the column of row tokens stays put.',
      'Under the table you will see four more things, each with its explanation. First, a demonstration of how the similarity of two tokens is computed, as the correlation of their two embedding vectors, for ten sample tokens. Second, the tokens as points on a plane, from a projection of their vectors onto the two directions in which they differ most. Third, a menu: for the token you choose in it, its five nearest neighbors with their correlations. Last, a tree of clusters, which joins the most similar tokens first.',
    ],
    minutes: stepParams('predictors', 2).minutes,
    sitting: 'leave any time',
    sittingLine: EXPLORATION_SITTING_LINE,
    keys: ['Press “Commit my prediction” to commit the one prediction, asked once.', 'Press “Count” to run the model over the corpus.', 'The menu under the plane, “Nearest neighbors of”, shows the five nearest neighbors of the token chosen in it.', 'Press “Go on to Step 3”, at the end of the panel, to open Step 3.'],
    content: [ONE_CORPUS_LINE],
    next: NEXT_LINE[2],
  },
  3: {
    step: 3,
    title: STEP_TITLES[3],
    kind: 'exploration',
    willDo: [
      'In Step 2 you saw that a token’s vector of co-occurrence counts says a good deal about which group of meanings it belongs to, and something about its grammar. In this step you will look, on two screens, at two things those counts leave out. Press a screen’s name at the top of the main panel to go to it.',
      'The first screen, “Prediction from counts”, shows a predictor built from the same corpus. It computes a probability for each possible next token in two ways: from the one token before, and from the two tokens before. Each probability is one count divided by another, and the panel prints the division. Three prompts stand side by side: ‹girls›; ‹girls who chase boys›; ‹girls who dogs chase›. In the grammar, the verb that comes next after each of them is a plural form, because the subject of each is ‹girls›, or ‹who›, which opens one more clause. Before the predictions appear, choose a prediction above the “Compute” button and press “Commit my prediction”. The question: after ‹girls who dogs chase›, which kind of token will the counts make most probable? Then press “Compute”, and the predictions appear as bars under each prompt.',
      'The second screen, “One point per word”, shows the word ‹chases› in two sentences, and that its embedding is the same one list in both. You will see the same two sentences again in Step 4.',
    ],
    minutes: stepParams('predictors', 3).minutes,
    sitting: 'leave any time',
    sittingLine: EXPLORATION_SITTING_LINE,
    keys: ['Press a screen’s name at the top of the main panel to go to it.', 'Press “Commit my prediction” to commit the one prediction; then press “Compute” to see the predictions from counts.', 'Press “Go on to Step 4”, at the end of the panel, to open Step 4.'],
    content: [ONE_CORPUS_LINE],
    next: NEXT_LINE[3],
  },
  4: {
    step: 4,
    title: STEP_TITLES[4],
    kind: 'exploration',
    willDo: [
      'In this step you will run two neural networks that were trained on the corpus before the lab was posted. Both were trained to predict the next token in the corpus.',
      'A simple recurrent network (§13.2.9) takes one token at a time, and is trained to predict the next token in the sequence. It does this using the current input token, and a copy of its own hidden layer from the token before. The latter is the network’s representation of the entire sequence it has been given so far.',
      'A transformer (§13.2.12) works on every position of the prompt at once. At each position, it computes a weighted sum over all the earlier positions. The weight of an earlier position comes from comparing a “query” computed at the current position with a “key” computed at the earlier one. That computation is called “attention”. In the main panel you will see a drawing of each network, with its explanation under it.',
      'Build a prompt by pressing tokens in the palette, which shows the whole vocabulary. The tokens the grammar allows next are outlined. You can press any token; a prompt the grammar does not allow is marked “not a sentence the grammar allows”. Press “Remove the last token” or “Clear the prompt” to edit the prompt.',
      'Before your first prompt, choose a prediction in the box above the palette, and press “Commit my prediction”. You are predicting which verb form, singular or plural, each network will give more probability to after the prompt ‹boys who Mary chases›.',
      'For any prompt, you see three bar charts side by side. They are all the probability that each token is the next one, computed from three different models. First, from the counts of Step 3; second, from the simple recurrent network; and third, from the transformer. In each chart, the tokens are grouped as nouns, verbs, ‹who›, and the end mark. Under the charts, for the transformer, lines run from the last token back to each earlier token. There is one panel for each layer and each attention computation, and the thickness of a line is set by its weight.',
      'At the bottom, beside the generated sentences, is a slider labeled “Temperature”. Temperature is a setting for generating sentences. At each position, a model computes a probability for every token that could come next. If the most probable token were always taken, a model would produce the same sentence again and again. Instead, the next token is drawn at random, each token with a chance set by its probability.',
      'Temperature sets how strongly the draw favors the more probable tokens. At a temperature of 0, the most probable token is drawn every time. At 1, each token is drawn with exactly its probability. At a temperature of infinity, every token is equally likely, whatever its probability. Here you can set the temperature from 0.2 to 2.0 before you generate a sentence. The sentences you generate are printed in two columns, one for each network, each sentence marked with whether the grammar allows it.',
    ],
    minutes: stepParams('predictors', 4).minutes,
    sitting: 'leave any time',
    sittingLine: EXPLORATION_SITTING_LINE,
    keys: ['Press a token in the palette to add it to the prompt; the outlined tokens are the ones the grammar allows next.', 'Press “Remove the last token” or “Clear the prompt” to edit the prompt.', 'Press “Commit my prediction” to commit the one prediction, asked once.', '“Temperature” is a slider. Press “Generate a sentence” to draw one sentence from each network at that temperature.'],
    content: [ONE_CORPUS_LINE, TRAINED_BEFORE_LINE],
    next: NEXT_LINE[4],
  },
  5: {
    step: 5,
    title: STEP_TITLES[5],
    kind: 'exploration',
    willDo: [
      'In this step you will look at eight snapshots of the two networks of Step 4, saved during their training, from before any training to its end. Move the slider “Snapshot” at the top of the main panel to go from one snapshot to the next. Beside the slider you see how many updates of the weights the networks had had by that snapshot.',
      'At each snapshot you see three panels. The first shows three bar charts side by side: the probability of each token as the next one after the current prompt, from the counts of Step 3, from the recurrent network, and from the transformer. The prompt starts as the beginning of a held-out sentence. Press “Change the prompt”, beside the slider, for the beginning of another held-out sentence; with the palette of tokens under the prompt you can build any prompt you like, as in Step 4. The count model follows the slider too: at each snapshot it has counted only the sentences the networks had been trained on by then, 32 per update, which is every training sentence from the third snapshot on. The second panel shows agreement by depth. A probe sentence has 0, 1, 2, or 3 relative clauses between its subject and its verb; agreement is the share of probes on which a predictor gives more probability to the verb form that agrees with the subject than to the form that does not. The plot has three lines, one for each predictor at the snapshot. Under the plot, three tables list, for the count model and for each network, three scores at every snapshot on the held-out sentences and on the training sentences (agreement, the right kind of token, the exact token), and agreement by depth. The third panel shows three planes side by side: the count model’s lists of counts from Step 2, and each network’s output weights, each projected onto its own two directions of greatest difference.',
      'In every probe sentence, the noun just before the main verb differs in number from the subject. So a predictor that went by the nearest noun would get every probe wrong.',
    ],
    minutes: stepParams('predictors', 5).minutes,
    sitting: 'leave any time',
    sittingLine: NO_PREDICTION_SITTING_LINE,
    keys: ['“Snapshot” is a slider with eight positions.', 'Press “Change the prompt” for a new prompt, the beginning of another held-out sentence.', 'The tokens under the prompt are buttons: press one to add it to the prompt. Press “Remove the last token” or “Clear the prompt” to edit it.', 'The prediction from counts is drawn in every chart and plot for comparison, from the sentences counted at the snapshot.'],
    content: [TRAINED_BEFORE_LINE],
    next: NEXT_LINE[5],
  },
}
