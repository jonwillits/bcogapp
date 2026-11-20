import type { Category, VerbClass } from '../../../sim/language/predictors/grammar'

/**
 * Part 4's panel texts: the grammar's symbols and rules, the count model's
 * explanation, the one similarity measure, what counts cannot do, the two
 * networks, and the snapshots. Every chapter term defined as the chapter
 * defines it, with its section (spec §4.4). The vocabulary's groups and the
 * verbs' subjects and objects are built on the screen from grammar.ts, so
 * that they cannot go stale (Jon, 2026-11-17).
 */

/** The nouns' groups in plain words, as Step 1 lists the vocabulary. */
export const GROUP_NAMES: Record<Category, string> = {
  human: 'people',
  animalLarge: 'large animals',
  animalSmall: 'small animals',
  breakable: 'things that break',
  food: 'food',
  other: 'other things',
}

/** The verbs' three classes in plain words. */
export const CLASS_NAMES: Record<VerbClass, string> = {
  transitive: 'needs an object',
  optional: 'may have an object or not',
  intransitive: 'never has an object',
}

const EVERY_GROUP: Category[] = ['human', 'animalLarge', 'animalSmall', 'breakable', 'food', 'other']

/** A set of groups in plain words: every group is “anything”; both animal groups together are “animals”; otherwise the groups' names, joined. */
export function groupsInWords(cats: readonly Category[]): string {
  if (EVERY_GROUP.every((c) => cats.includes(c))) return 'anything'
  const set = new Set(cats)
  const parts: string[] = []
  if (set.has('human')) parts.push(GROUP_NAMES.human)
  if (set.has('animalLarge') && set.has('animalSmall')) parts.push('animals')
  else if (set.has('animalLarge')) parts.push(GROUP_NAMES.animalLarge)
  else if (set.has('animalSmall')) parts.push(GROUP_NAMES.animalSmall)
  for (const c of ['breakable', 'food', 'other'] as const) if (set.has(c)) parts.push(GROUP_NAMES[c])
  if (parts.length <= 1) return parts.join('')
  return `${parts.slice(0, -1).join(', ')} or ${parts[parts.length - 1]}`
}

/** The grammar as rewrite rules, each with its reading in plain words. The rule is printed in a monospace block; the reading beside it. */
export const REWRITE_RULES: { rule: string; reading: string }[] = [
  { rule: 'S  → NP VP .', reading: 'a sentence is a noun phrase, then a verb phrase, then the end mark' },
  { rule: 'NP → N  |  N who RC', reading: 'a noun phrase is a noun alone, or a noun followed by who and a relative clause' },
  { rule: 'VP → V  |  V NP', reading: 'a verb phrase is a verb alone, or a verb and the noun phrase that is its object' },
  { rule: 'RC → VP  |  NP V', reading: 'a relative clause is a verb phrase, so the noun before who is its subject (boy who chases dogs), or a noun phrase and a verb, so the noun before who is its object (boy who dogs chase)' },
]

/** Every symbol in the rules, defined. */
export const GRAMMAR_SYMBOLS: { symbol: string; meaning: string }[] = [
  { symbol: '→', meaning: 'read “is made of”: the symbol on the left is made of the symbols on the right, in that order' },
  { symbol: '|', meaning: 'read “or”: one of the choices is taken' },
  { symbol: 'S', meaning: 'a sentence' },
  { symbol: 'NP', meaning: 'a noun phrase: a noun, with a relative clause attached to it or not' },
  { symbol: 'VP', meaning: 'a verb phrase: a verb, with its object or not' },
  { symbol: 'N', meaning: 'one noun from the vocabulary, a person, an animal or a thing, in its singular or its plural form' },
  { symbol: 'V', meaning: 'one verb from the vocabulary, in its singular or its plural form' },
  { symbol: 'RC', meaning: 'a relative clause: what follows who and says more about the noun before it' },
  { symbol: '.', meaning: 'the end mark, the token that ends every sentence' },
]

/** The rules the rewrite rules leave out, in plain sentences. */
export const GRAMMAR_RULES = [
  'N and V agree in number: a singular noun takes the singular verb form (boy walks) and a plural noun the plural form (boys walk). The V of the sentence’s verb phrase agrees with the N that begins the sentence’s noun phrase, even when a relative clause comes between them (boys who Mary chases walk). In RC → VP, the verb agrees with the noun before who; in RC → NP V, it agrees with the noun inside the clause.',
  'Which verbs take an object, and which nouns may be a verb’s subject or its object, are in the list of verbs above. A verb that needs an object always takes VP → V NP; a verb that never has one always takes VP → V; a verb that may have one takes either, and the object’s noun is drawn from the groups the list names.',
  'The subject of a sentence is always a person or an animal, and only a person or an animal can be followed by who. A relative clause can contain another, up to three deep. There is no article: no the or a.',
]

export const STEP2_PANEL = [
  'The model moves a window along the corpus, one word at a time, counted as one long stream with the end marks in it. For the word at the window’s end and each earlier word inside the window, it adds to the count of that pair: the window size minus the distance plus one, so that a neighbor adds the most and a word at the window’s far edge adds one.',
  'Each token’s list of counts is its embedding (§13.2.10): a list of numbers learned from the token’s contexts, so that tokens used alike have similar lists. The list is the token’s row of the table, its counts of the tokens before it, followed by its column, its counts of the tokens after it: 104 numbers in all, as the original program joined a word’s row and its column. The window is 4 tokens wide.',
]

/** The one similarity measure of Step 2, defined in plain words (Jon, 2026-11-17: correlation, not cosine, because it is easier to explain). */
export const SIMILARITY_TEXT = [
  'How similar are two words? Take their two lists of counts, one count per column of the table, and compute the correlation of the two lists: how the two rise and fall together over the same positions. A correlation of 1 means the two lists rise and fall exactly in step, 0 means no relation, and −1 means exactly opposite.',
  'To compute it, each list is centered on its own mean (the mean of the list is subtracted from every count in it) and divided by its own spread, so that a frequent word and a rare word are compared on the same footing; then the products of the two centered, scaled lists are averaged, position by position. The four strips below show four words’ lists in the table’s colors, shrunk to fit; the matrix under them shows the correlation of every pair.',
]

export const VIEWS_TEXT = {
  plane: 'The plane: each word’s list of counts is a point in a space with one dimension per count. The plane shows only the two directions in which the words’ lists differ most (the first two principal components), after each list is scaled to the same length, so distances on the plane are a flattened picture of distances in the full space.',
  tree: 'The tree: words are joined into clusters by average linkage on correlation. The two words whose lists have the highest correlation join first; a cluster joins the cluster whose members have, on average, the highest correlation with its own. A join is drawn at a height of one minus that average correlation, so a low join is a close pair and a high join a distant one. Each noun is a leaf at the left; follow its line to the right to the join where it meets the rest. Leaf colors: people blue, animals orange, things green.',
  neighbors: 'The nearest neighbors: for the word whose name you pressed, the five words whose lists have the highest correlation with its list, computed as the demo above computes it. A correlation of 1 means two lists rise and fall exactly in step; 0 means no relation.',
}

/** Step 3's one screen of predictions (Jon, 2026-11-19): three prompts side by side, each with the prediction from the one word before and from the two words before. */
export const STEP3_PREDICT = [
  'The predictor gives a probability to each possible next token in two ways. From the one token before: the count of that token followed by the candidate, divided by the count of that token followed by anything. From the two tokens before: the count of those two followed by the candidate, divided by the count of those two followed by anything. The panel prints the division behind each number.',
  'Three prompts stand side by side. In the grammar, the next token after each of them is a plural verb form, because the subject of each is girls, or who, which opens one more clause. Under each prompt, the line says what the grammar allows next, then the two predictions from counts appear as bars, one for every token with a count.',
]

export const STEP3_ONE_POINT = [
  'In the count model, a token has one list of counts, one point, whatever sentence it is in. Here is chases in two sentences, boys who Mary chases walk and Mary chases boys, and the same point for both. The order of the tokens in a sentence is not in the list either: dog chases cat and cat chases dog add to the same rows and columns of the table. In Step 4, the transformer computes a different list of numbers for chases in each of these sentences.',
]

/** Step 4's text: [0] above the two drawings, full width; [1] under the recurrent network's drawing; [2] under the transformer's (Jon, 2026-11-19: each text grouped with its picture). */
export const STEP4_MODELS = [
  'Both networks were trained to predict the next token on this corpus, before the lab was posted. A token here is a whole word or the end mark; a language model is a model trained to predict the next token in a text from the tokens before it (§13.2.12). Each drawing below shows the shape of one network, with how it computes its probabilities under it. Beside the two networks, every chart in this step also shows the prediction from counts of Step 3, from the same corpus, for the same prompt.',
  'The simple recurrent network (§13.2.9) takes one token at a time, coded as one of 52 inputs: the current token’s input is on and the rest are off. Its hidden layer of 64 units computes a weighted sum of the token’s code and of its own activity at the token before, and squashes it; its output layer turns the hidden activity into a score for each token, and the scores into probabilities. Everything before the current token is compressed into the one hidden state.',
  'The transformer (§13.2.12) has 2 layers, each with 2 attention computations side by side, a model width of 32 numbers per position, and room for 32 tokens. Each token begins as an embedding, a list of 32 numbers learned in training, with its position added. At each layer, each position compares a query computed from its own numbers with a key computed from each earlier position; the better the match, the more weight that earlier position gets, and the position’s new numbers are a weighted sum of information from the earlier positions. No position attends to a later one. A feed-forward block then recomputes each position’s numbers on their own. After the last layer, the numbers at the final position are turned into a score for each token and the scores into probabilities.',
]

export const STEP5_PANEL = [
  'Eight snapshots of each network were saved during training: before any update, and after 50, 200, 500, 1,000, 3,000, 10,000, and 20,000 updates of the weights. An update is one step of learning on a batch of 32 sentences. The slider moves through them.',
  'At each snapshot, three charts show the probability of each token as the next one after one fixed prompt: from the transformer, from the recurrent network, and from the counts of Step 3, by the rule of that step: from the two words before, or from the one word before when the two never occurred together in the corpus.',
  'Agreement by depth: for a set of probe sentences cut off just before the main verb, with 0, 1, 2, or 3 relative clauses between the subject and the verb, the share on which a predictor gives more probability to the verb form that agrees with the subject than to the form that does not. In every probe, the noun just before the verb differs in number from the subject, so a predictor that went by the nearest noun would get every probe wrong. There are 50 probes at each depth. The plot has three lines: the two networks at the snapshot, and the prediction from counts, which is the same at every snapshot because the count model is not trained.',
  'The reading reports a network trained to predict the next word whose representation of nesting degraded after about three levels (§13.2.8). The depth panel shows how each network here does at each depth, at each snapshot.',
  'The three planes at the bottom are three sets of numbers for the same nouns and verbs, each projected onto its own two directions of greatest difference: the transformer’s input embeddings, the 32 numbers each token starts with; the recurrent network’s input weights, the 64 numbers a token’s input sends to the hidden layer; and the count model’s lists of counts from Step 2. The two networks’ numbers change as training goes on; the count model’s do not.',
]
