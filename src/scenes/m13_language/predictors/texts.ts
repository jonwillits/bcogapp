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
  { rule: 'NP → N  |  N who RC', reading: 'a noun phrase is a noun alone, or a noun followed by “who” and a relative clause' },
  { rule: 'VP → V  |  V NP', reading: 'a verb phrase is a verb alone, or a verb and the noun phrase that is its object' },
  { rule: 'RC → VP  |  NP V', reading: 'a relative clause is a verb phrase, so the noun before “who” is its subject (“boy who chases dogs”), or a noun phrase and a verb, so the noun before “who” is its object (“boy who dogs chase”)' },
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
  { symbol: 'RC', meaning: 'a relative clause: what follows “who” and says more about the noun before it' },
  { symbol: '.', meaning: 'the end mark, the token that ends every sentence' },
]

/** The rules the rewrite rules leave out, in plain sentences. */
export const GRAMMAR_RULES = [
  'N and V agree in number: a singular noun takes the singular verb form (“boy walks”) and a plural noun the plural form (“boys walk”). The V of the sentence’s verb phrase agrees with the N that begins the sentence’s noun phrase, even when a relative clause comes between them (“boys who Mary chases walk”). In RC → VP, the verb agrees with the noun before “who”; in RC → NP V, it agrees with the noun inside the clause.',
  'Which verbs take an object, and which nouns may be a verb’s subject or its object, are in the list of verbs above. A verb that needs an object always takes VP → V NP; a verb that never has one always takes VP → V; a verb that may have one takes either, and the object’s noun is drawn from the groups the list names.',
  'The subject of a sentence is always a person or an animal, and only a person or an animal can be followed by “who”. A relative clause can contain another, up to three deep. There is no article: no “the” or “a”.',
]

/** Step 2's two paragraphs, Jon's words (2026-11-21); the window figure stands between them. */
export const STEP2_PANEL = [
  'The model moves a multi-token window along the corpus, one token at a time. The word at the end of the window is the “target” word whose counts are being incremented. The rest of the words in the window are its co-occurrences. The count added to the matrix reflects how close the two words were in the window: the window size, minus the distance, plus one.',
  'Each token’s list of counts is its embedding vector (§13.2.10): a list of numbers learned from the token’s contexts. The end result will be that tokens that appear in similar contexts will have similar embeddings. The embedding is the token’s row of the matrix, its counts of the tokens before it, concatenated onto its column, its counts of the tokens after it. This is 104 numbers in all (52 total tokens, forward and backward).',
]

/** The note under the table of counts, Jon's words (2026-11-21); the stage adds whether the count is still running. */
export const TABLE_NOTE = 'Each row is a token and each column another token. A cell is how often the row token came after the column token within the window, summed over every co-occurrence in the corpus, weighted by distance within the window. So a token’s row, read across, is its counts of the tokens before it. Its column, read down, is its counts of the tokens after it. The table is wider than the panel: it scrolls sideways inside its own frame, and the column of row tokens stays put.'

/** The one similarity measure of Step 2, correlation (Jon, 2026-11-17: easier to explain than cosine), in Jon's words (2026-11-21), on the whole 104-number embedding. */
export const SIMILARITY_TEXT = [
  'How similar are two words’ embedding vectors? Take each token’s concatenated row and column vectors, and make them into one big 104-element embedding. The correlation of these two vectors shows us the extent to which the two words are used in the same way.',
  'Another way you can think of a correlation is “how well can I predict the values in one vector if I know the values in the other?” A correlation of +1.00 means you can predict perfectly. A correlation of 0.00 means you cannot predict it at all. A correlation of −1.00 (very rare in language statistics) also means you can perfectly predict one from the other, but in opposite directions.',
  'To compute the correlation, first each vector is “normalized”. This means each vector is centered on its own mean (the mean of the vector is subtracted from every count in it) and divided by its own standard deviation. Normalization makes it so that vectors that have different sizes or spreads are converted to be on the same scale.',
  'Next, the correlation is computed by multiplying the values of the two vectors individually at each position. At each position in the vector, if both values are in the same direction (both positive and above their vectors’ mean, or both negative and below their vectors’ mean), the product’s result will be positive, contributing to a positive correlation. If the values are in opposite directions (one above the mean, one below the mean) the resulting product will be negative, contributing to a negative correlation.',
  'Once these products are computed at each position, they are averaged together. Because each vector was already divided by its own standard deviation, the average falls between −1 and +1. The strips below show a color gradient of each vector indicating the extent to which each normalized value was above or below that vector’s mean.',
]

/** Under the similarity demo's matrix, Jon's words (2026-11-21). */
export const MATRIX_NOTE = 'The correlations of each embedding vector with each other embedding vector can be constructed into a similarity matrix. We show a sample correlation matrix of 10 tokens. Each cell is color-coded to help convey similarity: warm above 0, blue below, the darker the stronger. Note that the diagonal cells always have a value of 1.00: this is the correlation of each token’s embedding with itself.'

/** The three views' texts, Jon's words (2026-11-21). */
export const VIEWS_TEXT = {
  plane: [
    'Each embedding can be thought of as a point in a 104-dimensional space. The similarity score reflects the proximity and distribution of the points. It can be nice to visualize this geometrically, but of course we can’t visualize a 104-dimensional space.',
    'There are techniques to take the 104-dimensional space and compress it to a smaller dimensional space we can visualize. “Principal Components Analysis” can be used to find the two dimensions in the bigger space that explain the most possible variance in that space, and plot the points on those two dimensions. This is the plane we show below, the values of the points on the first two principal components, which you can think of as the two directions in which the words’ embeddings differ the most. Nouns are shown in blue, verbs in orange.',
  ],
  tree: 'Next, we show what is called a “dendrogram tree”. This is a statistical technique that joins tokens into clusters by average linkage on correlation. The two words whose vectors have the highest correlation join first; other tokens and clusters are joined with the cluster whose members have, on average, the highest correlation with its own. A join is drawn at a height of one minus that average correlation, so a low join is a close pair and a high join a distant one. Each noun is a leaf at the left; follow its line to the right to the join where it meets the rest. Leaf colors: people blue, animals orange, things green.',
  neighbors: 'The nearest neighbors: for the word chosen in the menu, we show the five words whose embeddings have the highest correlation, computed as described above.',
}

/** Step 3's one screen of predictions (Jon, 2026-11-19): three prompts side by side, each with the prediction from the one word before and from the two words before. */
export const STEP3_PREDICT = [
  'The predictor gives a probability to each possible next token in two ways. From the one token before: the count of that token followed by the candidate, divided by the count of that token followed by anything. From the two tokens before: the count of those two followed by the candidate, divided by the count of those two followed by anything. The panel prints the division behind each number.',
  'Three prompts stand side by side, or one under another when the panel is narrow. In the grammar, the next token after each of them is a plural verb form, because the subject of each is “girls”, or “who”, which opens one more clause. Under each prompt, the line says what the grammar allows next, then the two predictions from counts appear as bars, one for every token with a count.',
]

export const STEP3_ONE_POINT = [
  'In the count model, a token has one list of counts, one point, whatever sentence it is in. Here is “chases” in two sentences, “boys who Mary chases walk” and “Mary chases boys”, and the same point for both. The order of the tokens in a sentence is not in the list either: “dog chases cat” and “cat chases dog” add to the same rows and columns of the table. In Step 4, the transformer computes a different list of numbers for “chases” in each of these sentences.',
]

/** Step 4's text above the two drawings, full width (Jon, 2026-11-19: each text grouped with its picture). */
export const STEP4_INTRO = 'Both networks were trained to predict the next token on this corpus, before the lab was posted. A token here is a whole word or the end mark; a language model is a model trained to predict the next token in a text from the tokens before it (§13.2.12). Each drawing below shows the shape of one network, with how it computes its probabilities under it. Beside the two networks, every chart in this step also shows the prediction from counts of Step 3, from the same corpus, for the same prompt.'

/** Under the recurrent network's drawing, Jon's words (2026-11-21). */
export const STEP4_SRN = [
  'The simple recurrent network (§13.2.9) takes the prompt one token at a time. Each token is coded on 52 input units, one unit for each token in the vocabulary. A unit is one number in the network. The current token’s unit is set to 1, and the other 51 units are set to 0.',
  'The input units feed a hidden layer of 64 units. Each hidden unit computes a weighted sum of two things: the input units, and the hidden layer’s own activity at the previous token. It then passes that sum through a nonlinear activation function, as in §4.2.3. The output layer turns the hidden layer’s activity into a score for every token in the vocabulary. The scores are then turned into probabilities for the next token.',
  'Each step uses the hidden layer’s activity from the step before. So the network’s only information about all the earlier tokens is in those 64 numbers. The transformer, by contrast, can use every earlier position directly.',
]

/** Under the transformer's drawing, Jon's words (2026-11-21). */
export const STEP4_TRANSFORMER = [
  'The transformer (§13.2.12) has 2 layers. A layer is one round of computation that changes the numbers at every position in the prompt. The prompt can be at most 32 tokens long. In this corpus, a token is one word, or the mark that ends a sentence. Before the first layer, each token is replaced by its embedding: a list of 32 numbers learned in training. A second list, which stands for the token’s place in the prompt, is added to it.',
  'Each layer then does two things. The first is attention. For each position, the transformer computes a query from that position’s numbers. It also computes a key and a value from that position and from every earlier position. The more similar the query is to a position’s key, the larger the weight that position gets. The values are multiplied by their weights and added together. That sum is added to the position’s numbers. No position uses a later position, so the transformer never has the token it is trained to predict. Each layer does two attention computations side by side, and each can give its large weights to different earlier positions.',
  'The second thing each layer does is pass each position’s numbers through a small network of the kind in Module 7, called a feed-forward block. That network uses only that position’s own numbers.',
  'After the last layer, only the numbers at the prompt’s last position are used. They are turned into a score for every token in the vocabulary. The scores are then turned into probabilities for the next token, which add up to 1.',
]

/** The temperature line beside Generate a sentence: the instruction screen explains temperature in full (Jon, 2026-11-21: once, where it is seen first), and this line refers to it. */
export const TEMPERATURE_LINE = 'Temperature is explained on this step’s instruction screen (“Show the instructions again” in the navigation panel): the lower it is, the more the draw favors the most probable tokens. At 0.2 the most probable token is drawn almost every time, and the sentence comes out the same again and again; at 2.0 improbable tokens are drawn often, and many sentences break the grammar.'

export const STEP5_PANEL = [
  'Eight snapshots of each network were saved during training: before any update, and after 50, 200, 500, 1,000, 3,000, 10,000, and 20,000 updates of the weights. An update is one step of learning on a batch of 32 sentences. The slider moves through them.',
  'At each snapshot, three charts show the probability of each token as the next one after the current prompt: from the counts of Step 3, by the rule of that step (from the two words before, or from the one word before when the two never occurred together), from the recurrent network, and from the transformer. The prompt starts as the beginning of a held-out sentence; “Change the prompt” draws another, and the palette of tokens under it builds any prompt you like, as in Step 4.',
  'The count model follows the slider. One update is one step of learning on 32 sentences, so after 50 updates the networks had seen 1,600 of the 9,000 training sentences, and after 200 updates 6,400; the count model at those snapshots has counted only those sentences. By 500 updates the networks had seen every training sentence, and the count model has counted them all. The networks then go through the sentences again and again, about seventy times by the last snapshot; a second pass changes nothing in a count, so from the third snapshot on the count model is the same.',
  'Agreement by depth: for a set of probe sentences cut off just before the main verb, with 0, 1, 2, or 3 relative clauses between the subject and the verb, the share on which a predictor gives more probability to the verb form that agrees with the subject than to the form that does not. In every probe, the noun just before the verb differs in number from the subject, so a predictor that went by the nearest noun would get every probe wrong. There are 50 probes at each depth. The plot has three lines: the prediction from counts and the two networks, each at the snapshot. Under it, three tables give each predictor three scores at every snapshot, on the 1,000 held-out sentences, which no model learned from, and on the 9,000 training sentences. Agreement: over the verbs in the sentences, the share for which the predictor’s most probable verb form is in the number the subject requires. Right kind: over every token after a sentence’s first, the share for which the predictor’s most probable token is of a kind the grammar allows there, a noun, a verb, “who” or the end mark. Exact: the share for which the most probable token is the very token that comes next. No predictor can push the exact score far past 40%, because at most positions the grammar leaves many tokens equally possible, so the first two scores say more about what a predictor has learned.',
  'The reading reports a network trained to predict the next word whose representation of nesting degraded after about three levels (§13.2.8). The depth panel shows how each network here does at each depth, at each snapshot.',
  'The three planes at the bottom are three sets of numbers for the same nouns and verbs, each projected onto its own two directions of greatest difference: the count model’s lists of counts from Step 2, and each network’s output weights, the numbers its final state is read against to score each token as the next one, 64 for the recurrent network and 32 for the transformer. All three change with the slider: the count model’s through the first snapshots, the networks’ throughout.',
]
