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
  { rule: 'NP → N  |  N who RC', reading: 'a noun phrase is a noun alone, or a noun followed by ‹who› and a relative clause' },
  { rule: 'VP → V  |  V NP', reading: 'a verb phrase is a verb alone, or a verb and the noun phrase that is its object' },
  { rule: 'RC → VP  |  NP V', reading: 'a relative clause is either a verb phrase, and then the noun before ‹who› is its subject (‹boy who chases dogs›), or a noun phrase and a verb, and then the noun before ‹who› is its object (‹boy who dogs chase›)' },
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
  { symbol: 'RC', meaning: 'a relative clause: what follows ‹who› and says more about the noun before it' },
  { symbol: '.', meaning: 'the end mark, the token that ends every sentence' },
]

/** The rules the rewrite rules leave out, in plain sentences. */
export const GRAMMAR_RULES = [
  'N and V agree in number: a singular noun takes the singular verb form (‹boy walks›) and a plural noun the plural form (‹boys walk›). The V of the sentence’s verb phrase agrees with the N that begins the sentence’s noun phrase, even when a relative clause comes between them (‹boys who Mary chases walk›). In RC → VP, the verb agrees with the noun before ‹who›; in RC → NP V, it agrees with the noun inside the clause.',
  'The table of verbs above shows which verbs take an object, and which nouns may be a verb’s subject or its object. A verb that needs an object always takes VP → V NP; a verb that never has one always takes VP → V; a verb that may have one takes either. The object’s noun comes from the groups the table names.',
  'The subject of a sentence is always a person or an animal, and only a person or an animal can be followed by ‹who›. A relative clause can contain another, up to three deep. There is no article: no ‹the› or ‹a›.',
]

/** Step 2's two paragraphs, Jon's words (2026-11-21); the window figure stands between them. */
export const STEP2_PANEL = [
  'The model moves a window, a few tokens wide, along the corpus one token at a time. The word at the right end of the window is the “target”: the word whose counts the model adds to at this move. Each other word in the window is one of the target’s co-occurrences. For each of them, the model adds to the count of that word with the target. The amount added depends on how close the two words are in the window: the window size, minus the distance between them, plus one. The window size here is 4, the number of tokens before the target.',
  'Each token’s list of counts is its embedding vector (§13.2.10): a list of numbers learned from the token’s contexts. Once the corpus is counted, tokens that appear in similar contexts have similar embeddings. The embedding is two lists joined end to end. The first is the token’s row of the matrix: its counts of the tokens before it. The second is the token’s column: its counts of the tokens after it. That is 104 numbers in all: 52 tokens before, and the same 52 after.',
]

/** The note under the table of counts, Jon's words (2026-11-21); the stage adds whether the count is still running. */
export const TABLE_NOTE = 'Each row is a token, and each column is a token. A cell is how often the row token came after the column token within the window, added up over the whole corpus; an occurrence counts for more when the two tokens were closer. So a token’s row, read across, is its counts of the tokens before it. Its column, read down, is its counts of the tokens after it. The table is wider than the panel: it scrolls sideways inside its own frame, and the column of row tokens stays put.'

/** The one similarity measure of Step 2, correlation (Jon, 2026-11-17: easier to explain than cosine), in Jon's words (2026-11-21), on the whole 104-number embedding. */
export const SIMILARITY_TEXT = [
  'How similar are two words’ embedding vectors? Each is the token’s row and column joined into one list of 104 numbers. The correlation of two such lists is a measure of how much the two words are used alike.',
  'You can also think of a correlation as the answer to a question: if you know the values in one vector, how well can you predict the values in the other? At +1.00 you can predict them perfectly. At 0.00 you cannot predict them at all. At −1.00, very rare in language statistics, you can again predict them perfectly, but backwards: one vector is high wherever the other is low.',
  'To compute the correlation, we first “normalize” each vector: we subtract the vector’s own mean from every count in it, and divide each result by the vector’s own standard deviation. Normalizing puts two vectors with different sizes or spreads on the same scale.',
  'Next, at each position, we multiply the two vectors’ values. When both values are on the same side of their means, both above or both below, the product is positive and adds to a positive correlation. When they are on opposite sides, one above and one below, the product is negative and adds to a negative correlation.',
  'Last, we average the products over all the positions. Because each vector was divided by its own standard deviation, the average falls between −1 and +1. The strips below show each vector as a row of colored cells; the color says how far each normalized value is above or below that vector’s mean.',
]

/** Under the similarity demo's matrix, Jon's words (2026-11-21). */
export const MATRIX_NOTE = 'The correlation of every embedding vector with every other makes a similarity matrix. Above is such a matrix for 10 tokens. Each cell is colored by its correlation: warm above 0, blue below, the darker the stronger. The diagonal cells are always 1.00: the correlation of each token’s embedding with itself.'

/** The three views' texts, Jon's words (2026-11-21). */
export const VIEWS_TEXT = {
  plane: [
    'You can think of each embedding as a point in a space with 104 dimensions. The similarity score goes with how near two points lie to each other. It would help to see the points, but no one can picture a space with 104 dimensions.',
    'There are ways to squeeze the 104 dimensions down to two that we can draw. One is “Principal Components Analysis”. It computes the two directions in the big space along which the points spread out the most, and places every point by its position along those two directions. The plane below shows the result: each word at its values on the first two principal components, the two directions in which the words’ embeddings differ the most. Nouns are blue, verbs orange.',
  ],
  tree: 'Next, a “dendrogram”: a tree that joins the nouns into clusters, the most similar first. The two nouns whose vectors have the highest correlation join first. After that, at each step, the two clusters whose members have the highest average correlation with one another join; a single noun counts as a cluster of one. Each join is drawn at a distance from the leaves of one minus that average correlation, so a join near the leaves is a close pair, and a join far from them a distant one. Each noun is a leaf at the left; follow its line to the right to the join where it meets the rest. Leaf colors: people blue, animals orange, things green.',
  neighbors: 'For the word you chose in the menu, these are the five words whose embeddings have the highest correlation with its embedding, computed as the demonstration above describes.',
}

/** Step 3's one screen of predictions (Jon, 2026-11-19): three prompts side by side, each with the prediction from the one word before and from the two words before. */
export const STEP3_PREDICT = [
  'The predictor computes a probability for each possible next token in two ways. From the one token before: the count of that token followed by the possible next token, divided by the count of that token followed by anything. From the two tokens before: the count of those two followed by the possible next token, divided by the count of those two followed by anything. Above each chart you see the division that made its numbers.',
  'Three prompts stand side by side, or one under another when the panel is narrow. In the grammar, the verb that comes next after each of them is a plural form, because the subject of each is ‹girls›, or ‹who›, which opens one more clause. Under each prompt, a line says what the grammar allows next. Then the two predictions from counts appear as bars, one bar for each of the twelve most probable tokens.',
]

export const STEP3_ONE_POINT = [
  'In the count model, a token has one list of counts, so it is one point on the plane, whatever sentence it is in. Here is ‹chases› in two sentences, ‹boys who Mary chases walk› and ‹Mary chases boys›. Its list is the same in both. The list also drops the order of the tokens in a sentence: ‹dog chases cat› and ‹cat chases dog› add to the same rows and columns of the table, though not to the same cells. In Step 4, the transformer computes a different list of numbers for ‹chases› in each of these two sentences.',
]

/** Step 4's text above the two drawings, full width (Jon, 2026-11-19: each text grouped with its picture). */
export const STEP4_INTRO = 'Both networks were trained on this corpus to predict the next token, before the lab was posted. A token here is a whole word or the end mark. A language model is a model trained to predict the next token in a text from the tokens before it (§13.2.12). Each drawing below shows the shape of one network. Under the drawing, a text says how that network computes its probabilities. Every chart in this step also shows, beside the two networks, the prediction from counts of Step 3, from the same corpus, for the same prompt.'

/** Under the recurrent network's drawing, Jon's words (2026-11-21). */
export const STEP4_SRN = [
  'The simple recurrent network (§13.2.9) takes the prompt one token at a time. Each token is coded on 52 input units, one unit for each token in the vocabulary. A unit is one number in the network. The current token’s unit is set to 1, and the other 51 units are set to 0.',
  'The input units feed a hidden layer of 64 units. Each hidden unit computes a weighted sum of two things: the input units, and the hidden layer’s own activity at the previous token. It then passes that sum through a nonlinear activation function, as in §4.2.3. The output layer turns the hidden layer’s activity into a score for every token in the vocabulary. The scores are then turned into probabilities for the next token.',
  'At each token, the network uses the hidden layer’s activity from the token before. So all that the network stores of the earlier tokens is those 64 numbers. The transformer, by contrast, uses every earlier position directly.',
]

/** Under the transformer's drawing, Jon's words (2026-11-21). */
export const STEP4_TRANSFORMER = [
  'The transformer (§13.2.12) has 2 layers. A layer is one round of computation that changes the numbers at every position in the prompt. The prompt can be at most 32 tokens long. In this corpus, a token is one word, or the end mark. Before the first layer, each token is replaced by its embedding, a list of 32 numbers learned in training. To that list the transformer adds a second list, which stands for the token’s place in the prompt.',
  'Each layer then does two things. The first is attention. For each position, the transformer computes a query from that position’s numbers. It also computes a key and a value at that position and at every earlier position. The more similar the query is to a position’s key, the larger the weight that position gets. The values are multiplied by their weights and added together. That sum is added to the position’s numbers. No position uses a later position, so the transformer is never given the token it is trained to predict. Each layer does two attention computations side by side, and each can give its large weights to different earlier positions.',
  'The second thing each layer does is pass each position’s numbers through a small network of the kind in Module 7, called a feed-forward block. That network uses only that position’s own numbers.',
  'After the last layer, only the numbers at the prompt’s last position are used. They are turned into a score for every token in the vocabulary. The scores are then turned into probabilities for the next token, which add up to 1.',
]

/** The temperature line beside Generate a sentence: the instruction screen explains temperature in full (Jon, 2026-11-21: once, where it is seen first), and this line refers to it. */
export const TEMPERATURE_LINE = 'Temperature is explained on this step’s instruction screen (“Show the instructions again” in the navigation panel). The lower the temperature, the more the draw favors the most probable tokens. At 0.2 the most probable token is drawn almost every time, and the sentence comes out the same again and again. At 2.0 improbable tokens are drawn often, and many sentences break the grammar.'

export const STEP5_PANEL = [
  'Eight snapshots of each network were saved during training: before any update, and after 50, 200, 500, 1,000, 3,000, 10,000, and 20,000 updates of the weights. An update is one round of learning on a batch of 32 sentences. Move the slider to go from one snapshot to another.',
  'At each snapshot, three charts show the probability of each token as the next one after the current prompt: from the counts of Step 3, from the recurrent network, and from the transformer. The prediction from counts follows Step 3’s rule: from the two words before, or from the one word before when those two never occurred together. The prompt starts as the beginning of a held-out sentence. Press “Change the prompt” for the beginning of another held-out sentence; with the palette of tokens under the prompt you can build any prompt you like, as in Step 4.',
  'The count model follows the slider. One update is one round of learning on 32 sentences, so after 50 updates the networks had been trained on 1,600 of the 9,000 training sentences, and after 200 updates on 6,400; at those snapshots the count model has counted only those sentences. By 500 updates the networks had been trained on every training sentence, and the count model has counted them all. The networks then go through the sentences again and again, about seventy times by the last snapshot. A second pass changes nothing in a count, so from the third snapshot on the count model is the same.',
  'Agreement by depth. A probe sentence is cut off just before its main verb, with 0, 1, 2, or 3 relative clauses between the subject and the verb; there are 50 probes at each depth. A predictor agrees on a probe when it gives more probability to the verb form that agrees with the subject than to the form that does not, and agreement at a depth is the share of its 50 probes on which the predictor agrees. In every probe, the noun just before the verb differs in number from the subject, so a predictor that went by the nearest noun would get every probe wrong. The plot has three lines, one each for the prediction from counts and the two networks, at the snapshot. Under it, three tables list, for each predictor, three scores at every snapshot, on the 1,000 held-out sentences, which no model learned from, and on the 9,000 training sentences. Agreement: over the verbs in the sentences, the share for which the predictor’s most probable verb form is in the number the subject requires. Right kind: over every token after a sentence’s first, the share for which the predictor’s most probable token is of a kind the grammar allows there: a noun, a verb, ‹who› or the end mark. Exact: the share for which the most probable token is the very token that comes next. No predictor can push the exact score far past 40%, because at most positions the grammar leaves many tokens equally possible; so the first two scores say more about what a predictor has learned.',
  'The reading reports a network trained to predict the next word; its representation of nesting degraded after about three levels (§13.2.8). The plot of agreement by depth shows how each network here does at each depth, at each snapshot.',
  'The three planes at the bottom show three sets of numbers for the same nouns and verbs, each set projected onto its own two directions of greatest difference. The first set is the count model’s lists of counts from Step 2. The other two are each network’s output weights: for each token, the numbers the network multiplies its final state by to score that token as the next one, 64 numbers for the recurrent network and 32 for the transformer. All three planes change with the slider: the count model’s through the first snapshots, the networks’ throughout.',
]
