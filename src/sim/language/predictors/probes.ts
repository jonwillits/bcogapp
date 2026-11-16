import { makeRng, type Rng } from '../../random'
import { accepts, NOUNS, VERBS, WHO, END, type Category, type NounSpec, type VerbSpec } from './grammar'

/**
 * The probe sentences for agreement by depth (spec §8.6): a prefix ending
 * just before the main verb, with 0, 1, 2 or 3 relative clauses between the
 * subject and the main verb, in which every noun after the subject that
 * stands just before the main verb differs in number from the subject, so
 * that a predictor going by the nearest noun gets every probe wrong. The
 * two forms of one main verb are compared: the share of probes on which a
 * model gives the agreeing form more probability than the other is its
 * agreement at that depth.
 *
 * Each clause is an object-relative on the noun before it (*boys who Mary
 * chases*), which is the construction Elman (1991, Fig. 4f) reports, and
 * the kind in which the nearest noun has its own number. Every probe is a
 * sentence the parser accepts when its main verb and the end mark are
 * added. Generated from a fixed seed (spec §8.6).
 */
export interface Probe {
  depth: number
  prefix: string[]
  /** The main verb's form that agrees with the subject, and the one that does not. */
  agreeing: string
  other: string
}

const ANIMATE: Category[] = ['human', 'animalLarge', 'animalSmall']
type Num = 'sg' | 'pl'

function form(n: NounSpec, num: Num): string {
  return num === 'pl' ? n.plural! : n.singular
}

function pick<T>(rng: Rng, xs: T[]): T {
  return xs[rng.int(xs.length)]
}

/** Nouns of a category that have both numbers, so that the probe can set the number. */
const nounsOf = (cats: Category[]) => NOUNS.filter((n) => cats.includes(n.category) && n.plural)

export function makeProbe(rng: Rng, depth: number): Probe | null {
  const subj = pick(rng, nounsOf(ANIMATE))
  const subjNum: Num = rng.next() < 0.5 ? 'sg' : 'pl'
  const otherNum: Num = subjNum === 'sg' ? 'pl' : 'sg'
  const prefix: string[] = [form(subj, subjNum)]
  // Each clause: who + a subject noun of the other number (for the last clause, which is nearest the main verb) + a verb that takes the head as object.
  let head = subj
  let headNum = subjNum
  const verbsAfter: string[] = []
  for (let d = 0; d < depth; d++) {
    const verbs = VERBS.filter((v) => v.cls !== 'intransitive' && v.objects.includes(head.category) && v.subjects.some((c) => nounsOf([c]).length))
    if (!verbs.length) return null
    const v: VerbSpec = pick(rng, verbs)
    const subjects = nounsOf(v.subjects)
    const n = pick(rng, subjects)
    // The clause's subject differs in number from the main subject at every depth, so that no intervening noun agrees with it.
    const num: Num = otherNum
    prefix.push(WHO, form(n, num))
    verbsAfter.unshift(num === 'pl' ? v.plural : v.singular)
    head = n
    headNum = num
  }
  void headNum
  prefix.push(...verbsAfter)
  const mains = VERBS.filter((v) => v.subjects.includes(subj.category) && v.cls !== 'transitive')
  const main = pick(rng, mains)
  const agreeing = subjNum === 'pl' ? main.plural : main.singular
  const other = subjNum === 'pl' ? main.singular : main.plural
  const probe = { depth, prefix, agreeing, other }
  if (!accepts([...prefix, agreeing, END])) return null
  return probe
}

export function makeProbes(seed = 1991, perDepth = 50): Probe[] {
  const rng = makeRng(seed ^ 0x9e0b)
  const out: Probe[] = []
  for (const depth of [0, 1, 2, 3]) {
    const seen = new Set<string>()
    let tries = 0
    while (out.filter((p) => p.depth === depth).length < perDepth && tries++ < 5000) {
      const p = makeProbe(rng, depth)
      if (!p) continue
      const key = p.prefix.join(' ') + '|' + p.agreeing
      if (seen.has(key)) continue
      seen.add(key)
      out.push(p)
    }
  }
  return out
}
