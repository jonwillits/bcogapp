import type { Rng } from '../../random'

/**
 * Part 4's corpus (spec §8.1; decision 14): Elman's (1991) grammar with
 * Elman's (1990) categories of nouns and verbs, as a probabilistic
 * generator and a parser that lists the legal next tokens after any prefix.
 *
 * From Elman (1991), p. 203: number agreement between a subject and its
 * verb, including when a relative clause comes between them; three classes
 * of verb (an object required, optional, or impossible); relative clauses
 * introduced by *who*, which can nest. From Elman (1990), pp. 195–200: nouns
 * in categories (humans; animals, large and small; things that break;
 * things that can be eaten; other things), and verbs whose subjects and
 * objects respect the categories (only animate nouns eat; only food is
 * eaten; only breakables are broken).
 *
 * The vocabulary is the build's, drawn from both papers' word lists, for
 * Jon to approve on the stimulus review sheet: 14 common nouns in singular
 * and plural, John and Mary, 10 verbs in singular and plural, who, and the
 * end mark. The generator's settings are stated here and in the as-built
 * notes. A relative clause attaches only to an animate noun; nesting runs
 * to MAX_DEPTH levels. One corpus is generated once from a fixed seed, so
 * every student's models are the same.
 */

export type Category = 'human' | 'animalLarge' | 'animalSmall' | 'breakable' | 'food' | 'other'
export type VerbClass = 'transitive' | 'optional' | 'intransitive'

export interface NounSpec {
  singular: string
  plural: string | null
  category: Category
}

export interface VerbSpec {
  singular: string
  plural: string
  cls: VerbClass
  /** Which categories can be its subject. */
  subjects: Category[]
  /** Which categories can be its object, for transitive and optional verbs. */
  objects: Category[]
}

const ANIMATE: Category[] = ['human', 'animalLarge', 'animalSmall']
const ALL: Category[] = ['human', 'animalLarge', 'animalSmall', 'breakable', 'food', 'other']

export const NOUNS: NounSpec[] = [
  { singular: 'boy', plural: 'boys', category: 'human' },
  { singular: 'girl', plural: 'girls', category: 'human' },
  { singular: 'man', plural: 'men', category: 'human' },
  { singular: 'woman', plural: 'women', category: 'human' },
  { singular: 'John', plural: null, category: 'human' },
  { singular: 'Mary', plural: null, category: 'human' },
  { singular: 'dog', plural: 'dogs', category: 'animalLarge' },
  { singular: 'cat', plural: 'cats', category: 'animalLarge' },
  { singular: 'lion', plural: 'lions', category: 'animalLarge' },
  { singular: 'mouse', plural: 'mice', category: 'animalSmall' },
  { singular: 'bird', plural: 'birds', category: 'animalSmall' },
  { singular: 'glass', plural: 'glasses', category: 'breakable' },
  { singular: 'plate', plural: 'plates', category: 'breakable' },
  { singular: 'cookie', plural: 'cookies', category: 'food' },
  { singular: 'sandwich', plural: 'sandwiches', category: 'food' },
  { singular: 'rock', plural: 'rocks', category: 'other' },
]

export const VERBS: VerbSpec[] = [
  { singular: 'chases', plural: 'chase', cls: 'transitive', subjects: ANIMATE, objects: ANIMATE },
  { singular: 'feeds', plural: 'feed', cls: 'transitive', subjects: ['human'], objects: ANIMATE },
  { singular: 'eats', plural: 'eat', cls: 'optional', subjects: ANIMATE, objects: ['food'] },
  { singular: 'sees', plural: 'see', cls: 'optional', subjects: ANIMATE, objects: ALL },
  { singular: 'hears', plural: 'hear', cls: 'optional', subjects: ANIMATE, objects: ANIMATE },
  { singular: 'breaks', plural: 'break', cls: 'transitive', subjects: ['human', 'animalLarge'], objects: ['breakable'] },
  { singular: 'carries', plural: 'carry', cls: 'transitive', subjects: ['human', 'animalLarge'], objects: ['breakable', 'food', 'other'] },
  { singular: 'walks', plural: 'walk', cls: 'intransitive', subjects: ANIMATE, objects: [] },
  { singular: 'lives', plural: 'live', cls: 'intransitive', subjects: ANIMATE, objects: [] },
  { singular: 'sleeps', plural: 'sleep', cls: 'intransitive', subjects: ANIMATE, objects: [] },
]

export const WHO = 'who'
export const END = '.'

/** The generator's settings, chosen once (spec §8.1). */
export const SETTINGS = {
  /** The probability that an animate noun is followed by a relative clause, at depth 0; it halves with each level of nesting. */
  relativeClause: 0.3,
  /** The deepest nesting of relative clauses. */
  maxDepth: 3,
  /** The probability that a relative clause is a subject-relative (who chases the dog) rather than an object-relative (who the dog chases). */
  subjectRelative: 0.5,
  /** The probability that an optional-object verb takes its object. */
  optionalObject: 0.5,
  /** The probability that a noun is plural, where it has a plural. */
  plural: 0.5,
  /** The seed of the one corpus every student sees. */
  corpusSeed: 1991,
  corpusSentences: 10000,
}

export type Number_ = 'sg' | 'pl'

export interface Token {
  text: string
  kind: 'noun' | 'verb' | 'who' | 'end'
}

/** Every token in the vocabulary, in the order the screens list them: nouns, verbs, who, the end mark. */
export const VOCABULARY: string[] = [...NOUNS.flatMap((n) => (n.plural ? [n.singular, n.plural] : [n.singular])), ...VERBS.flatMap((v) => [v.singular, v.plural]), WHO, END]

export function nounOf(text: string): { spec: NounSpec; number: Number_ } | null {
  for (const n of NOUNS) {
    if (n.singular === text) return { spec: n, number: 'sg' }
    if (n.plural === text) return { spec: n, number: 'pl' }
  }
  return null
}

export function verbOf(text: string): { spec: VerbSpec; number: Number_ } | null {
  for (const v of VERBS) {
    if (v.singular === text) return { spec: v, number: 'sg' }
    if (v.plural === text) return { spec: v, number: 'pl' }
  }
  return null
}

export function kindOf(text: string): Token['kind'] | null {
  if (text === WHO) return 'who'
  if (text === END) return 'end'
  if (nounOf(text)) return 'noun'
  if (verbOf(text)) return 'verb'
  return null
}

// ------------------------------------------------------------- generation

interface NP {
  tokens: string[]
  category: Category
  number: Number_
}

function pick<T>(rng: Rng, xs: readonly T[]): T {
  return xs[rng.int(xs.length)]
}

function nounPhrase(rng: Rng, allowed: Category[], depth: number, settings = SETTINGS): NP {
  const choices = NOUNS.filter((n) => allowed.includes(n.category))
  const spec = pick(rng, choices)
  const number: Number_ = spec.plural && rng.next() < settings.plural ? 'pl' : 'sg'
  const tokens = [number === 'pl' ? spec.plural! : spec.singular]
  const np: NP = { tokens, category: spec.category, number }
  const animate = ANIMATE.includes(spec.category)
  if (animate && depth < settings.maxDepth && rng.next() < settings.relativeClause / 2 ** depth) {
    np.tokens = [...tokens, WHO, ...relativeClause(rng, np, depth + 1, settings)]
  }
  return np
}

/** The relative clause after *who*: either the head is its subject (who chases the dog) or its object (who the dog chases). */
function relativeClause(rng: Rng, head: NP, depth: number, settings = SETTINGS): string[] {
  const asSubject = rng.next() < settings.subjectRelative
  if (asSubject) {
    const verbs = VERBS.filter((v) => v.subjects.includes(head.category))
    const v = pick(rng, verbs)
    const out = [head.number === 'pl' ? v.plural : v.singular]
    if (v.cls === 'transitive' || (v.cls === 'optional' && rng.next() < settings.optionalObject)) out.push(...nounPhrase(rng, v.objects, depth, settings).tokens)
    return out
  }
  // Object-relative: the head is the object, so the verb must take an object of the head's category, and a subject comes first.
  const verbs = VERBS.filter((v) => v.cls !== 'intransitive' && v.objects.includes(head.category))
  const v = pick(rng, verbs)
  const subj = nounPhrase(rng, v.subjects, depth, settings)
  return [...subj.tokens, subj.number === 'pl' ? v.plural : v.singular]
}

export function sentence(rng: Rng, settings = SETTINGS): string[] {
  const subj = nounPhrase(rng, ANIMATE, 0, settings)
  const verbs = VERBS.filter((v) => v.subjects.includes(subj.category))
  const v = pick(rng, verbs)
  const out = [...subj.tokens, subj.number === 'pl' ? v.plural : v.singular]
  if (v.cls === 'transitive' || (v.cls === 'optional' && rng.next() < settings.optionalObject)) out.push(...nounPhrase(rng, v.objects, 0, settings).tokens)
  out.push(END)
  return out
}

export function corpus(rng: Rng, n: number, settings = SETTINGS): string[][] {
  const out: string[][] = []
  for (let i = 0; i < n; i++) out.push(sentence(rng, settings))
  return out
}

// ------------------------------------------------------------------ parsing

/**
 * The parser: a stack machine that runs the generator's grammar backward,
 * and for any prefix lists the tokens the grammar allows next. A frame is
 * the main clause or one relative clause; each has a phase. It is used for
 * Step 4's palette, for marking prompts and generated sentences, and for the
 * probe sentences; it reads no model.
 */

interface NounRef {
  category: Category
  number: Number_
}

type MainPhase = 'subject' | 'verb' | 'afterVerb' | 'afterObject'
type RelPhase = 'start' | 'subjectSeen' | 'afterVerb' | 'afterObject'

type Frame =
  | { type: 'main'; phase: MainPhase; subject?: NounRef; verb?: VerbSpec; object?: NounRef; depth: 0 }
  | { type: 'rel'; phase: RelPhase; head: NounRef; subject?: NounRef; verb?: VerbSpec; object?: NounRef; depth: number }

export interface ParseState {
  stack: Frame[]
  ok: boolean
  complete: boolean
}

export function start(): ParseState {
  return { stack: [{ type: 'main', phase: 'subject', depth: 0 }], ok: true, complete: false }
}

const nounForms = (cats: readonly Category[]): string[] => NOUNS.filter((n) => cats.includes(n.category)).flatMap((n) => (n.plural ? [n.singular, n.plural] : [n.singular]))
const agree = (v: VerbSpec, n: NounRef) => (n.number === 'pl' ? v.plural : v.singular)
const animate = (n: NounRef) => ANIMATE.includes(n.category)

/** The tokens the top frame itself can take next, not counting what follows if it closes. */
function ownTokens(f: Frame, settings: typeof SETTINGS): string[] {
  const out: string[] = []
  if (f.type === 'main') {
    switch (f.phase) {
      case 'subject':
        out.push(...nounForms(ANIMATE))
        break
      case 'verb':
        for (const v of VERBS) if (v.subjects.includes(f.subject!.category)) out.push(agree(v, f.subject!))
        if (animate(f.subject!) && f.depth < settings.maxDepth) out.push(WHO)
        break
      case 'afterVerb':
        if (f.verb!.cls !== 'intransitive') out.push(...nounForms(f.verb!.objects))
        break
      case 'afterObject':
        if (animate(f.object!) && f.depth < settings.maxDepth) out.push(WHO)
        break
    }
  } else {
    switch (f.phase) {
      case 'start': {
        for (const v of VERBS) if (v.subjects.includes(f.head.category)) out.push(agree(v, f.head))
        const cats = new Set<Category>()
        for (const v of VERBS) if (v.cls !== 'intransitive' && v.objects.includes(f.head.category)) for (const c of v.subjects) cats.add(c)
        out.push(...nounForms([...cats]))
        break
      }
      case 'subjectSeen':
        for (const v of VERBS) if (v.cls !== 'intransitive' && v.subjects.includes(f.subject!.category) && v.objects.includes(f.head.category)) out.push(agree(v, f.subject!))
        if (animate(f.subject!) && f.depth < settings.maxDepth) out.push(WHO)
        break
      case 'afterVerb':
        if (f.verb!.cls !== 'intransitive') out.push(...nounForms(f.verb!.objects))
        break
      case 'afterObject':
        if (animate(f.object!) && f.depth < settings.maxDepth) out.push(WHO)
        break
    }
  }
  return out
}

/** Whether the top frame may close now, so that the enclosing frame's tokens are allowed too. */
function closable(f: Frame): boolean {
  if (f.type === 'main') return f.phase === 'afterObject' || (f.phase === 'afterVerb' && f.verb!.cls !== 'transitive')
  return f.phase === 'afterObject' || (f.phase === 'afterVerb' && f.verb!.cls !== 'transitive')
}

/** The tokens allowed next from a state, as the grammar allows them. */
export function nextTokens(state: ParseState, settings = SETTINGS): string[] {
  if (!state.ok || state.complete) return []
  const out = new Set<string>()
  for (let k = state.stack.length - 1; k >= 0; k--) {
    const f = state.stack[k]
    for (const t of ownTokens(f, settings)) out.add(t)
    if (!closable(f)) break
    if (f.type === 'main') {
      out.add(END)
      break
    }
  }
  return [...out]
}

/** Advance the state by one token. A token the grammar does not allow sets `ok` false. */
export function step(state: ParseState, token: string, settings = SETTINGS): ParseState {
  if (!state.ok || state.complete) return { ...state, ok: false }
  const stack = state.stack.map((f) => ({ ...f })) as Frame[]
  // The frame that takes the token: the top, or an enclosing frame reached by closing closable frames.
  let k = stack.length - 1
  while (k >= 0) {
    const f = stack[k]
    if (ownTokens(f, settings).includes(token)) break
    if (f.type === 'main' && token === END && closable(f)) return { stack: [], ok: true, complete: true }
    if (!closable(f)) return { ...state, ok: false }
    k--
  }
  if (k < 0) return { ...state, ok: false }
  stack.length = k + 1
  const f = stack[k]
  const kind = kindOf(token)
  const ref = (t: string): NounRef => {
    const n = nounOf(t)!
    return { category: n.spec.category, number: n.number }
  }
  if (f.type === 'main') {
    if (f.phase === 'subject') {
      f.subject = ref(token)
      f.phase = 'verb'
    } else if (f.phase === 'verb') {
      if (token === WHO) stack.push({ type: 'rel', phase: 'start', head: f.subject!, depth: 1 })
      else {
        f.verb = verbOf(token)!.spec
        f.phase = 'afterVerb'
      }
    } else if (f.phase === 'afterVerb') {
      f.object = ref(token)
      f.phase = 'afterObject'
    } else if (f.phase === 'afterObject') {
      stack.push({ type: 'rel', phase: 'start', head: f.object!, depth: 1 })
    }
  } else {
    if (f.phase === 'start') {
      if (kind === 'verb') {
        f.verb = verbOf(token)!.spec
        f.phase = 'afterVerb'
      } else {
        f.subject = ref(token)
        f.phase = 'subjectSeen'
      }
    } else if (f.phase === 'subjectSeen') {
      if (token === WHO) stack.push({ type: 'rel', phase: 'start', head: f.subject!, depth: f.depth + 1 })
      else {
        // An object-relative clause is complete after its verb: it closes at once.
        f.verb = verbOf(token)!.spec
        stack.pop()
      }
    } else if (f.phase === 'afterVerb') {
      f.object = ref(token)
      f.phase = 'afterObject'
    } else if (f.phase === 'afterObject') {
      stack.push({ type: 'rel', phase: 'start', head: f.object!, depth: f.depth + 1 })
    }
  }
  return { stack, ok: true, complete: false }
}

/** Whether a whole token sequence is a sentence the grammar allows. */
export function accepts(tokens: readonly string[], settings = SETTINGS): boolean {
  let s = start()
  for (const t of tokens) {
    s = step(s, t, settings)
    if (!s.ok) return false
  }
  return s.complete
}
