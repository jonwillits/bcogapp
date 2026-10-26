/**
 * Part 1's materials (spec §5.2, §5.3, and Jon's answer 5 of 2026-10-25).
 *
 * **Unrelated lists**: concrete nouns of one or two syllables, high in
 * frequency, chosen by hand from a pool built from two public sets of
 * norms (`training/m10/`): Brysbaert, Warriner and Kuperman's (2014)
 * concreteness ratings (every word here rates 4.5 or more of 5, and at
 * least 95% of raters knew it) and SUBTLEX-US word frequencies (every
 * word here occurs at least 5 times per million, most far more). No two
 * words in a list share a category or an obvious association; no word is
 * repeated across lists; no word is shared with Part 2's sets, Part 3's
 * item names or the lists of associates (`words.test.ts`). Six lists of
 * each length: four for the design and two reserves (§5.3).
 *
 * **Lists of associates**: six of the twenty-four lists in the appendix of
 * Roediger and McDermott (1995), printed page 814, transcribed word for
 * word from the page image (the pdf has no text layer there), in the
 * paper's presentation order. Not the *sleep* list, which the reading
 * prints; not *chair* or *window*, whose words are in a room; not *bread*,
 * *fruit*, *foot* or *soft*, whose words are things a dorm room holds.
 * Which three are studied and which three are controls is the seed's.
 */

export type ListKind = 'unrelated' | 'associates'

export interface StudyList {
  id: string
  kind: ListKind
  words: string[]
  /** The word every word of a list of associates is associated with, and which is never presented. */
  critical?: string
}

const list = (id: string, words: string[]): StudyList => ({ id, kind: 'unrelated', words })

/** Six short unrelated lists of ten words. */
export const UNRELATED_SHORT: StudyList[] = [
  list('s1', ['tent', 'badge', 'harbor', 'piano', 'locker', 'dentist', 'pumpkin', 'ladder', 'cigar', 'canyon']),
  list('s2', ['fence', 'trophy', 'tunnel', 'temple', 'robe', 'brick', 'pirate', 'kidney', 'rainbow', 'spoon']),
  list('s3', ['lobby', 'pole', 'parade', 'salt', 'puppet', 'shell', 'mule', 'glove', 'anchor', 'bubble']),
  list('s4', ['chess', 'flame', 'sack', 'pony', 'coin', 'hallway', 'lung', 'ribbon', 'wax', 'drum']),
  list('s5', ['medal', 'fog', 'cart', 'tattoo', 'altar', 'blouse', 'nickel', 'hose', 'jar', 'moose']),
  list('s6', ['receipt', 'crib', 'glue', 'chapel', 'straw', 'razor', 'dove', 'scar', 'wig', 'pier']),
]

/** Six long unrelated lists of twenty words. */
export const UNRELATED_LONG: StudyList[] = [
  list('l1', ['train', 'gold', 'radio', 'bear', 'sword', 'beach', 'button', 'dollar', 'egg', 'tower', 'rope', 'mask', 'flag', 'skull', 'throne', 'sponge', 'balloon', 'ink', 'hay', 'album']),
  list('l2', ['letter', 'stone', 'camel', 'bridge', 'knife', 'soup', 'bell', 'pocket', 'tongue', 'garage', 'wire', 'doll', 'cloud', 'lipstick', 'barrel', 'passport', 'pill', 'stamp', 'lawn', 'oak']),
  list('l3', ['ticket', 'moon', 'cat', 'hammer', 'glass', 'army', 'roof', 'cream', 'leather', 'village', 'diamond', 'jewel', 'nest', 'waist', 'pipe', 'canal', 'cocoa', 'limo', 'banner', 'tomb']),
  list('l4', ['star', 'wall', 'cowboy', 'meat', 'pool', 'bible', 'pigeon', 'tank', 'pot', 'shadow', 'dice', 'iron', 'yard', 'cane', 'clay', 'necklace', 'stage', 'butler', 'sleeve', 'wave']),
  list('l5', ['card', 'sun', 'dog', 'cabin', 'oil', 'princess', 'horn', 'armor', 'belt', 'wheat', 'dock', 'lighter', 'statue', 'mustard', 'tray', 'jungle', 'organ', 'doorbell', 'bolt', 'copper']),
  list('l6', ['page', 'mall', 'bull', 'flower', 'cab', 'liver', 'bomb', 'penny', 'storm', 'kitchen', 'rum', 'chip', 'cord', 'trunk', 'puzzle', 'gown', 'portrait', 'gutter', 'meter', 'cargo']),
]

/** Eight new words for the recognition test, of the same kind as the unrelated lists' words and on none of them. */
export const NEW_WORDS = ['tape', 'ring', 'hook', 'gate', 'dirt', 'mail', 'hood', 'tin']

/**
 * The six lists of associates, verbatim from Roediger and McDermott (1995),
 * Appendix, printed page 814 ("The Twenty-Four 15-Word Lists Used in
 * Experiment 2"), in the order printed there.
 */
export const ASSOCIATE_LISTS: StudyList[] = [
  { id: 'a-mountain', kind: 'associates', critical: 'mountain', words: ['hill', 'valley', 'climb', 'summit', 'top', 'molehill', 'peak', 'plain', 'glacier', 'goat', 'bike', 'climber', 'range', 'steep', 'ski'] },
  { id: 'a-needle', kind: 'associates', critical: 'needle', words: ['thread', 'pin', 'eye', 'sewing', 'sharp', 'point', 'prick', 'thimble', 'haystack', 'thorn', 'hurt', 'injection', 'syringe', 'cloth', 'knitting'] },
  { id: 'a-rough', kind: 'associates', critical: 'rough', words: ['smooth', 'bumpy', 'road', 'tough', 'sandpaper', 'jagged', 'ready', 'coarse', 'uneven', 'riders', 'rugged', 'sand', 'boards', 'ground', 'gravel'] },
  { id: 'a-sweet', kind: 'associates', critical: 'sweet', words: ['sour', 'candy', 'sugar', 'bitter', 'good', 'taste', 'tooth', 'nice', 'honey', 'soda', 'chocolate', 'heart', 'cake', 'tart', 'pie'] },
  { id: 'a-thief', kind: 'associates', critical: 'thief', words: ['steal', 'robber', 'crook', 'burglar', 'money', 'cop', 'bad', 'rob', 'jail', 'gun', 'villain', 'crime', 'bank', 'bandit', 'criminal'] },
  { id: 'a-spider', kind: 'associates', critical: 'spider', words: ['web', 'insect', 'bug', 'fright', 'fly', 'arachnid', 'crawl', 'tarantula', 'poison', 'bite', 'creepy', 'animal', 'ugly', 'feelers', 'small'] },
]

export const SHORT_LENGTH = 10
export const LONG_LENGTH = 20
export const ASSOCIATES_LENGTH = 15

export const ALL_STUDY_LISTS: StudyList[] = [...UNRELATED_SHORT, ...UNRELATED_LONG, ...ASSOCIATE_LISTS]

export function listById(id: string): StudyList {
  const l = ALL_STUDY_LISTS.find((x) => x.id === id)
  if (!l) throw new Error(`no list ${id}`)
  return l
}
