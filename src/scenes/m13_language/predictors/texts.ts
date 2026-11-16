/**
 * Part 4's panel texts: the grammar's rules in plain sentences, the count
 * model's explanation, what counts cannot do, the two networks, and the
 * snapshots. Every chapter term defined as the chapter defines it, with
 * its section (spec §4.4).
 */
export const GRAMMAR_RULES = [
  'Every sentence has a subject noun, then a verb, then sometimes an object noun, then the end mark. The nouns are in six groups: people (boy, girl, man, woman, and the names John and Mary), large animals (dog, cat, lion), small animals (mouse, bird), things that break (glass, plate), food (cookie, sandwich), and other things (rock).',
  'A singular subject takes the singular form of the verb (boy walks) and a plural subject the plural form (boys walk), even when a relative clause comes between the subject and its verb (boys who Mary chases walk).',
  'Some verbs need an object: chases, feeds, breaks, carries. Some may have one or not: eats, sees, hears. Some cannot have one: walks, lives, sleeps.',
  'Which nouns go with which verbs: only people and animals chase, feed, eat, see, hear, walk, live, and sleep; only people feed; only people and large animals break and carry; only food is eaten; only things that break are broken; only people and animals are chased, fed, and heard.',
  'A relative clause begins with who after a person or animal, and says more about that noun. Either the noun is the clause’s subject (boy who chases dogs) or its object (boy who dogs chase). A relative clause can contain another, up to three deep.',
]

export const STEP2_PANEL = [
  'The model moves a window along the corpus, one word at a time, counted as one long stream with the end marks in it. For the word at the window’s end and each earlier word inside the window, it adds to the count of that pair: the window size minus the distance plus one, so that a neighbor adds the most and a word at the window’s far edge adds one.',
  'Each word’s list of counts, one for each other word, is its embedding (§13.2.10): a list of numbers learned from the word’s contexts, so that words used alike have similar lists. With “Count words before and after separately” on, the list of words that came before and the list of words that came after are joined into one list twice as long, as the original program did; off, the two are added together.',
]

export const VIEWS_TEXT = {
  plane: 'The plane: each word’s list of counts is a point in a space with one dimension per count. The plane shows only the two directions in which the words’ lists differ most (the first two principal components), after each list is scaled to the same length, so distances on the plane are a flattened picture of distances in the full space.',
  tree: 'The tree: words are joined into clusters by average linkage on cosine similarity. The two words whose lists point in the most similar directions join first; a cluster joins the cluster whose members are, on average, most similar to its own. The height of a join is one minus that average similarity.',
  neighbors: 'The nearest neighbors: for the clicked word, the five words whose lists have the highest cosine similarity with its list. A cosine similarity of 1 means two lists point in exactly the same direction; 0 means they share nothing.',
}

export const STEP3_ORDER = [
  'Two sentences with the same three words in different orders: dog chases cat and cat chases dog. Under each is what it adds to the count table, with the window set to span the sentence.',
  'With “Count words before and after separately” off, the two sentences add exactly the same counts: a pair of words is counted the same whichever comes first, so the counts cannot tell who chased whom. With the setting on, the counts differ: dog is counted before chases in one sentence and after it in the other. What the setting keeps is which of two words came first; what it loses is everything about order beyond that, and anything more than the window apart.',
]

export const STEP3_PREDICT = [
  'The predictor gives a probability to each possible next word in two ways. From the one word before: the count of that word followed by the candidate, divided by the count of that word followed by anything. From the two words before: the count of those two words followed by the candidate, divided by the count of those two words followed by anything. The panel prints the division behind each number.',
]

export const STEP3_ONE_POINT = [
  'In the count model, a word has one list of counts, one point, whatever sentence it is in. Here is chases in two sentences, boys who Mary chases walk and Mary chases boys, and the same point for both. In Step 4, the transformer computes a different list of numbers for chases in each of these sentences.',
]

export const STEP4_MODELS = [
  'Both networks were trained to predict the next token on this corpus, before the lab was posted. A token here is a whole word or the end mark; a language model is a model trained to predict the next token in a text from the tokens before it (§13.2.12).',
  'The simple recurrent network (§13.2.9) takes one token at a time, coded as one of 52 inputs. Its hidden layer of 64 units computes a weighted sum of the token’s code and of its own activity at the token before, and squashes it; its output layer turns the hidden activity into a score for each token, and the scores into probabilities. Everything before the current token is compressed into the one hidden state.',
  'The transformer (§13.2.12) has 2 layers, each with 2 attention computations side by side, a model width of 32 numbers per position, and room for 32 tokens. Each token begins as an embedding, a list of 32 numbers learned in training, with its position added. At each layer, each position compares a query computed from its own numbers with a key computed from each earlier position; the better the match, the more weight that earlier position gets, and the position’s new numbers are a weighted sum of information from the earlier positions. No position attends to a later one. After the last layer, the numbers at the final position are turned into a score for each token and the scores into probabilities.',
]

export const STEP5_PANEL = [
  'Eight snapshots of each network were saved during training: before any update, and after 50, 200, 500, 1,000, 3,000, 10,000, and 20,000 updates of the weights. An update is one step of learning on a batch of 32 sentences. The slider moves through them.',
  'Agreement by depth: for a set of probe sentences cut off just before the main verb, with 0, 1, 2, or 3 relative clauses between the subject and the verb, the share on which the network gives more probability to the verb form that agrees with the subject than to the form that does not. In every probe, the noun just before the verb differs in number from the subject, so a network that went by the nearest noun would get every probe wrong. There are 50 probes at each depth.',
  'The reading reports a network trained to predict the next word whose representation of nesting degraded after about three levels (§13.2.8). The depth panel shows how each network here does at each depth, at each snapshot.',
]
