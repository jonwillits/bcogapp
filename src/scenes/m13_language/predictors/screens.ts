import { ONE_CORPUS_LINE, TRAINED_BEFORE_LINE } from '../lines'
import { EXPLORATION_SITTING_LINE, type StepScreen } from '../steps'

/**
 * Part 4's instruction screens (spec §8, §4.4): five explorations, each
 * with its predictions committed before its first result. The chapter's
 * terms are defined where they are used, as the chapter defines them.
 */

export type Step = 1 | 2 | 3 | 4 | 5

export const STEP_TITLES: Record<Step, string> = {
  1: 'Step 1 — The corpus',
  2: 'Step 2 — A count model',
  3: 'Step 3 — What counts cannot do',
  4: 'Step 4 — A simple recurrent network and a transformer',
  5: 'Step 5 — Watching it learn',
}

export const NEXT_LINE: Record<Step, string> = {
  1: 'When you have read the sentences you want to read, press “Go on to Step 2” on the left.',
  2: 'When you have seen the views you want to see, press “Go on to Step 3” on the left.',
  3: 'When you have seen the three screens, press “Go on to Step 4” on the left.',
  4: 'When you have tried the prompts you want to try, press “Go on to Step 5” on the left.',
  5: 'This is the lab’s last step. When you have seen the snapshots you want to see, the lab is done: every part’s results are on the Open tab, under “My results, all parts”.',
}

export const SCREENS: Record<Step, StepScreen> = {
  1: {
    step: 1,
    title: STEP_TITLES[1],
    kind: 'exploration',
    willDo: [
      'In this part you will look inside three kinds of program that each compute, for a text, how likely each word is to come next. Every program in this part learned from the same made-up corpus of sentences, and from nothing else. A corpus is a collection of texts. This step shows the corpus.',
      'Press “Show me sentences” to print 20 sentences from the corpus, each on its own line. Press it again for 20 more. A generator makes the sentences from a small grammar, with a vocabulary of about 50 tokens: nouns, each in a singular and a plural form; two names; verbs, each in a singular and a plural form; the word who; and a mark for the end of a sentence. A token is one item of the vocabulary. Here every token is a whole word or the end mark.',
      'The panel on the right lists the grammar’s rules in plain sentences: which nouns go with which verbs, how a subject and its verb agree in number, which verbs take an object, and how who begins a relative clause. A relative clause is a clause inside a sentence that says more about a noun, as in boys who Mary chases.',
      'Nothing is scored, and nothing is recorded in this step.',
    ],
    minutes: 2,
    sitting: 'leave any time',
    sittingLine: EXPLORATION_SITTING_LINE,
    keys: ['“Show me sentences” prints 20 sentences from the corpus.'],
    content: [ONE_CORPUS_LINE],
    next: NEXT_LINE[1],
  },
  2: {
    step: 2,
    title: STEP_TITLES[2],
    kind: 'exploration',
    willDo: [
      'In this step you will build a count model of the corpus, of the kind described in §13.2.10 of the reading. The model moves a window along the corpus, one word at a time. For every pair of words inside the window, it adds to a count for that pair, and it adds more for two words that are closer together. Each word’s list of counts, one count for each other word, is its embedding: a list of numbers learned from the word’s contexts, so that words used alike have similar lists.',
      'There are two settings on the left. “Window size” runs from 1 to 8 words. “Count words before and after separately” is on by default: with it on, a word’s counts of the words before it and of the words after it are two separate lists, as in the original program; with it off, the two are added together.',
      'Before the first count, choose a prediction from the menu on the left and press “Commit my prediction”: which word will lie closest to cat? Then press “Count”. The table of counts fills as the model runs through the corpus, shown for ten chosen words.',
      'Three views appear on the right, each with its explanation: the words as points on a plane, from a projection of their lists onto the two directions of greatest difference; a tree of clusters, which joins the most similar words first; and, for any word you click, its five nearest neighbors with their similarities.',
    ],
    minutes: 5,
    sitting: 'leave any time',
    sittingLine: EXPLORATION_SITTING_LINE,
    keys: ['“Window size” is a slider from 1 to 8.', '“Count words before and after separately” is a switch.', '“Commit my prediction” commits the one prediction, asked once.', '“Count” runs the model over the corpus; it can be run again after a change of settings.', 'Click a word in any view to see its five nearest neighbors.'],
    content: [ONE_CORPUS_LINE],
    next: NEXT_LINE[2],
  },
  3: {
    step: 3,
    title: STEP_TITLES[3],
    kind: 'exploration',
    willDo: [
      'In this step you will look at two things the counts of Step 2 do not capture, on three screens. The names at the top of the panel go to any of them.',
      'The first screen, “Order”, shows dog chases cat and cat chases dog side by side, each with what it adds to the count table. Try the switch “Count words before and after separately” on and off, and watch whether the two sentences add the same counts.',
      'The second screen, “Prediction from counts”, shows a predictor built from the same corpus. It gives a probability to each possible next word from the one word before it, and from the two words before it. Each probability is a count divided by a count, and the panel writes the division out. Before the two distributions appear, choose a prediction on the left and press “Commit my prediction”: after boys who the dog chases, will the counts give more probability to the plural verb or to the singular verb? Then press “Compute”, and the two distributions appear as bars, one for every word.',
      'The third screen, “One point per word”, shows the word chases in two sentences, and where its embedding lies in each. The same two sentences come back in Step 4.',
    ],
    minutes: 5,
    sitting: 'leave any time',
    sittingLine: EXPLORATION_SITTING_LINE,
    keys: ['Click a screen’s name at the top of the panel to go to it.', '“Count words before and after separately” is the switch from Step 2.', '“Commit my prediction” commits the one prediction; then “Compute” shows the two distributions.'],
    content: [ONE_CORPUS_LINE],
    next: NEXT_LINE[3],
  },
  4: {
    step: 4,
    title: STEP_TITLES[4],
    kind: 'exploration',
    willDo: [
      'In this step you will run two networks that were trained on the corpus before the lab was posted. Both were trained to predict the next token. A simple recurrent network (§13.2.9) takes one token at a time and feeds a copy of its own hidden layer back in with the next token, so that each of its predictions depends on the current token and on one summary of everything before it. A transformer (§13.2.12) computes, at each position, a weighted sum over every earlier position, with weights from comparing a query at the position with a key at each earlier one. That computation is called attention. The panel on the right states each network’s size and training.',
      'Build a prompt by clicking tokens from the palette, which offers only the tokens the grammar allows next. “Allow any token” opens the whole vocabulary, and a prompt the grammar does not allow is marked as such. “Remove the last token” and “Clear the prompt” edit it.',
      'Before your first prompt, choose two predictions on the left and press “Commit my predictions”. First, after boys who Mary chases, which verb form will each network give more probability to? Second, at a temperature of 2.0, will most generated sentences be ones the grammar allows?',
      'For any prompt, two bar charts show each network’s probability for every token as the next one, grouped as nouns, verbs, who, and the end mark. Under them, for the transformer, lines run from the last token back to each earlier token, one panel for each layer and each attention computation, with the thickness of each line set by its weight. A slider, “Temperature”, runs from 0.2 to 2.0, and “Generate a sentence” samples one token at a time from the transformer until the end mark or 32 tokens. Each generated sentence is marked with whether the grammar allows it.',
    ],
    minutes: 6,
    sitting: 'leave any time',
    sittingLine: EXPLORATION_SITTING_LINE,
    keys: ['Click a token in the palette to add it to the prompt; “Allow any token” opens the whole vocabulary.', '“Remove the last token” and “Clear the prompt” edit the prompt.', '“Commit my predictions” commits the two predictions, asked once.', '“Temperature” is a slider; “Generate a sentence” samples one sentence from the transformer.'],
    content: [ONE_CORPUS_LINE, TRAINED_BEFORE_LINE],
    next: NEXT_LINE[4],
  },
  5: {
    step: 5,
    title: STEP_TITLES[5],
    kind: 'exploration',
    willDo: [
      'In this step you will move through eight snapshots of the two networks of Step 4, saved during their training, from before any training to its end. A slider, “Snapshot”, moves through them, and the panel prints how many updates of the weights each snapshot had.',
      'At each snapshot you see three panels. The first shows the two networks’ probabilities for the next token after one fixed prompt, which “Change the prompt” replaces. The second shows agreement by depth: the share of a set of probe sentences on which each network gives more probability to the verb that agrees with its subject than to the one that does not, with 0, 1, 2, and 3 relative clauses between the subject and the verb. The third shows the transformer’s input embeddings as points on a plane, beside the count model’s points from Step 2.',
      'In every probe sentence, the noun just before the main verb differs in number from the subject. So a network that went by the nearest noun would get every probe wrong.',
    ],
    minutes: 4,
    sitting: 'leave any time',
    sittingLine: EXPLORATION_SITTING_LINE,
    keys: ['“Snapshot” is a slider with eight positions.', '“Change the prompt” replaces the fixed prompt.'],
    content: [TRAINED_BEFORE_LINE],
    next: NEXT_LINE[5],
  },
}
