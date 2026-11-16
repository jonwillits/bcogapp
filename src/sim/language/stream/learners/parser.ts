import { makeRng, type Rng } from '../../../random'
import { SYLLABLES, type Syllable } from '../language'
import type { Scorer } from '../test'

/**
 * The third learner (spec §6.3, decision 12): PARSER (Perruchet and Vinter,
 * 1998, Journal of Memory and Language 39, 246–263). It is one store of
 * units with weights, the percept shaper (PS), which starts as the
 * syllables alone (p. 250). At each time step (Fig. 1, p. 251):
 *
 *   a  a seeded draw sets the size of the next percept, 1, 2 or 3 shaping
 *      units (p. 250). A shaping unit is a unit of PS with weight at or
 *      above the shaping threshold that matches the stream where the
 *      percept stands; when several match, the longest is taken (p. 252,
 *      note 2); a syllable itself, a primitive, stands where no such unit
 *      matches.
 *   f  a percept of one shaping unit: that unit gains the increment.
 *   b  a percept of 2 or 3 units that is already a unit of PS (then
 *      necessarily below the threshold, or it would have shaped perception
 *      itself):
 *   e    it gains the increment, and so does each of its components.
 *   c,d  otherwise the percept is created as a new unit at the starting
 *        weight, and each of its components gains the increment (Table 1,
 *        p. 252).
 *   g  forgetting: every unit loses the forgetting decrement; interference:
 *      every unit in which any syllable of the percept is embedded loses
 *      the interference decrement besides (p. 251). As Table 1 (p. 252)
 *      shows, the unit just created takes neither decrement on its own
 *      step, and the units that gained take forgetting but not
 *      interference. A unit whose weight reaches zero is removed (p. 251).
 *      The primitives are maintained in PS throughout (p. 253) at no less
 *      than their initial weight: after 44 syllables two of them were still
 *      "with their initial weights" (p. 252), and at the strict criterion
 *      "all the primitives are assigned a weight of 1" (Table 3, p. 253),
 *      which forgetting at every step would not allow. Table 1's row for
 *      pu (1 to 0.95) is the one line against that reading; the choice
 *      changes no percept, since a primitive shapes perception wherever
 *      nothing longer matches either way.
 *
 * The parameters, all from p. 251 except the threshold, which is on p. 252,
 * are the constants below. The paper calls their absolute values arbitrary
 * and their relations what matters (p. 252). Study 3 raised forgetting to
 * 0.08 for a four-word language (p. 257); this language is the six-word
 * one of Study 1, so the value of Study 1 is used.
 *
 * Speed. By the paper's loose criterion (p. 253: the six words are units
 * with the highest weights), this implementation over 100 streams of this
 * language reaches it at a mean of about 4,400 syllables when the
 * primitives count in the ranking and about 2,700 when only units of two
 * or more syllables do, as the paper's Tables 2 and 3 list them; the paper
 * reports a mean of 2,064 (range 735 to 4,479; p. 254). Every rule above
 * was checked against the text, Fig. 1 and Table 1, and no other reading
 * of a rule closed the gap (learners.probe.ts, "parser criterion"); the
 * parameters are not tuned to close it (spec §11, item 11).
 *
 * Two test rules. The spec's (§6.3): a string's score is its weight as a
 * unit of PS, or zero if it is not one; the string with the higher score
 * is chosen, and a tie is settled by the seeded stream (`scoreTest`). The
 * paper's (p. 256): the word is chosen if it is a unit of PS with weight
 * greater than 1, otherwise the choice is random; that rule looks at the
 * word alone, so it is not a `Scorer` but a recognition, `parserKnows`,
 * which `scoreTestByRecognition` applies. The build measured both
 * (learners.probe.ts, "parser rules"); which the lab follows, and why, is
 * in the as-built notes.
 *
 * PARSER reads only the syllables it takes in: never the word list, the
 * true boundaries, a table of probabilities, or the test foils (structural
 * test in `structure.test.ts`).
 */

/** The size of a percept, in shaping units: 1 to 3 (p. 250; Fig. 1, step a). */
export const PERCEPT_MIN_UNITS = 1
export const PERCEPT_MAX_UNITS = 3
/** The weight a created unit starts at, and the primitives' weight before training (p. 251). */
export const START_WEIGHT = 1
/** The increment to a unit that serves to shape perception, or to a percept already in PS (p. 251). */
export const GAIN = 0.5
/** The decrement every unit takes at each time step (p. 251). */
export const FORGETTING = 0.05
/** The further decrement to units in which a syllable of the current percept is embedded (p. 251). */
export const INTERFERENCE = 0.005
/** A unit shapes perception when its weight is at least this (p. 251, p. 252). */
export const SHAPING_THRESHOLD = 1
/** The paper's test rule chooses the word when it is a unit with weight greater than this (p. 256). */
export const TEST_THRESHOLD = 1

/** Floating-point sums of 0.05 and 0.005 land a hair above or below zero; a weight within this of zero is null (p. 251). */
const NULL_WEIGHT = 1e-9

export interface Unit {
  syllables: Syllable[]
  weight: number
}

export interface Parser {
  /** The percept shaper: every unit by its key (syllables joined by a space). */
  units: Map<string, Unit>
  /** Units by their first syllable, for the matching at a position. */
  byFirst: Map<Syllable, Set<string>>
  /** How many syllables of the stream it has taken in; the next percept starts here. */
  heard: number
  rng: Rng
}

export const keyOf = (s: readonly Syllable[]): string => s.join(' ')

/** A fresh PARSER whose store is the 12 syllables at the starting weight (p. 250, p. 251); the seed drives the percept sizes. */
export function makeParser(seed: number): Parser {
  const p: Parser = { units: new Map(), byFirst: new Map(), heard: 0, rng: makeRng(seed ^ 0x9a75e) }
  for (const s of SYLLABLES) add(p, [s], START_WEIGHT)
  return p
}

function add(p: Parser, syllables: readonly Syllable[], weight: number): Unit {
  const u: Unit = { syllables: [...syllables], weight }
  p.units.set(keyOf(syllables), u)
  let set = p.byFirst.get(syllables[0])
  if (!set) p.byFirst.set(syllables[0], (set = new Set()))
  set.add(keyOf(syllables))
  return u
}

function remove(p: Parser, key: string, u: Unit): void {
  p.units.delete(key)
  p.byFirst.get(u.syllables[0])?.delete(key)
}

function matchesAt(u: Unit, stream: readonly Syllable[], at: number): boolean {
  if (at + u.syllables.length > stream.length) return false
  for (let i = 0; i < u.syllables.length; i++) if (stream[at + i] !== u.syllables[i]) return false
  return true
}

/** The unit that shapes perception at a position: the longest unit at or above the threshold that matches there (p. 252, note 2). A primitive always qualifies, so the fallback is only a guard. */
function shapingUnitAt(p: Parser, stream: readonly Syllable[], at: number): Syllable[] {
  let best: Unit | null = null
  for (const key of p.byFirst.get(stream[at]) ?? []) {
    const u = p.units.get(key)!
    if (u.weight < SHAPING_THRESHOLD || (best && u.syllables.length <= best.syllables.length)) continue
    if (matchesAt(u, stream, at)) best = u
  }
  return best ? best.syllables : [stream[at]]
}

/** One time step (Fig. 1): the next percept is taken in from `p.heard`, and the store is updated. Returns false when the stream is used up. */
export function step(p: Parser, stream: readonly Syllable[]): boolean {
  if (p.heard >= stream.length) return false
  const size = PERCEPT_MIN_UNITS + p.rng.int(PERCEPT_MAX_UNITS - PERCEPT_MIN_UNITS + 1)
  const components: Syllable[][] = []
  let at = p.heard
  for (let k = 0; k < size && at < stream.length; k++) {
    const u = shapingUnitAt(p, stream, at)
    components.push(u)
    at += u.length
  }
  p.heard = at
  const percept = components.flat()
  const perceptKey = keyOf(percept)
  const gained = new Set<string>()
  let created: string | null = null
  const gain = (s: readonly Syllable[]) => {
    const k = keyOf(s)
    const u = p.units.get(k)
    if (u) u.weight += GAIN
    else add(p, s, GAIN) // a component is always a unit of PS; this branch is unreachable while the primitives stay in PS
    gained.add(k)
  }
  if (components.length === 1) {
    gain(percept) // step f
  } else if (p.units.has(perceptKey)) {
    gain(percept) // step e
    for (const c of components) gain(c)
  } else {
    add(p, percept, START_WEIGHT) // steps c and d
    created = perceptKey
    for (const c of components) gain(c)
  }
  // step g
  const inPercept = new Set<Syllable>(percept)
  for (const [key, u] of p.units) {
    if (key === created) continue
    u.weight -= FORGETTING
    if (!gained.has(key) && u.syllables.some((s) => inPercept.has(s))) u.weight -= INTERFERENCE
    if (u.syllables.length === 1) u.weight = Math.max(u.weight, START_WEIGHT) // a primitive is maintained (p. 253)
    else if (u.weight <= NULL_WEIGHT) remove(p, key, u)
  }
  return true
}

/** Take in a stream from where the learner stands to its end, one percept at a time. A learner that is to take in the first n syllables is given the first n: a run on a prefix is a fresh run. */
export function trainParser(p: Parser, stream: readonly Syllable[]): void {
  while (step(p, stream));
}

/** The weight of a string as a unit of PS, or zero if it is not one (spec §6.3). */
export function unitWeight(p: Parser, s: readonly Syllable[]): number {
  return p.units.get(keyOf(s))?.weight ?? 0
}

/** The spec's test rule (§6.3) as a scorer: the string's weight as a unit, or zero. */
export function parserScorer(p: Parser): Scorer {
  return (s) => unitWeight(p, s)
}

/** The paper's recognition (p. 256): the string is one unit of PS with weight greater than 1. `scoreTestByRecognition` applies the paper's rule with it. */
export function parserKnows(p: Parser): (s: readonly Syllable[]) => boolean {
  return (s) => unitWeight(p, s) > TEST_THRESHOLD
}

/** The strongest units of PS, heaviest first, as strings of their syllables run together: what the student can read of the store. */
export function strongestUnits(p: Parser, n = 10): { unit: string; syllables: Syllable[]; weight: number }[] {
  return [...p.units.values()]
    .sort((a, b) => b.weight - a.weight || a.syllables.length - b.syllables.length || keyOf(a.syllables).localeCompare(keyOf(b.syllables)))
    .slice(0, n)
    .map((u) => ({ unit: u.syllables.join(''), syllables: [...u.syllables], weight: u.weight }))
}
