import { makeRng, type Rng } from '../../random'
import type { Clearing, Log } from '../logs/clearings'
import { featureVector, type BlockPlan } from '../logs/features'
import { runBlockScripted, type BlockRun } from '../logs/block'
import { answerMap, blockTable } from '../logs/block'
import { tallies, type NightTallies } from '../logs/night'
import type { Policy } from '../logs/scripted'
import type { NightSim } from '../logs/night'
import type { MapAnswers } from '../logs/mapQuestion'
import type { Truth } from '../logs/refill'
import { FastStore, SeparationStage, driftContext, freshContext, nightInput, type Retrieval, type Separation } from './store'
import { SlowLearner, YOUTH_PASSES, oldPatterns, trainInterleaved } from './slow'
import { TendencyUnit } from './tendency'
import { PROPERTIES } from './world'

/**
 * The programmed foragers of Part 5 (spec §9.2): four programs that each
 * run the student's own six nights, the same clearings, starting states,
 * features, night length and nursing call. They walk perfectly, so the
 * comparison is of digs, not of navigation. Each has a list for tonight,
 * the logs already dug tonight, cleared at dawn (working memory in the
 * second sense of §10.2.3; no forager is scored on it).
 *
 * | Forager | Uses | Has no |
 * | Usual only | the slow learner's knowledge of which kind of log has beetles | store of any night |
 * | Tendency only | one weight per log, learned by Lab 5's rule | store; knowledge of kinds beyond what its weights learn |
 * | Tonight too | the slow learner and the fast store, with strong separation | — |
 * | Tonight too, nights blurred | the same, with weak separation | — |
 *
 * Every forager digs in a seeded order among the logs it treats as worth
 * digging, except Tendency only, whose order is its weights'. These are
 * programs given your nights; ending with the same score does not show
 * the same procedure (§11, line 6).
 */

export type ForagerId = 'usual' | 'tendency' | 'tonight' | 'blurred'

export interface ForagerSpec {
  id: ForagerId
  label: string
  uses: string
  hasNo: string
  separation: Separation | null
}

export const FORAGERS: ForagerSpec[] = [
  { id: 'usual', label: 'Usual only', uses: 'the slow learner’s knowledge of which kind of log has beetles; the list for tonight', hasNo: 'store of any night', separation: null },
  { id: 'tendency', label: 'Tendency only', uses: 'the tendency weights, one per log; the list for tonight', hasNo: 'store of any night; knowledge of kinds of log beyond what its weights learn', separation: null },
  { id: 'tonight', label: 'Tonight too', uses: 'the slow learner; the fast store, with strong separation; the list for tonight', hasNo: '—', separation: 'strong' },
  { id: 'blurred', label: 'Tonight too, nights blurred', uses: 'the same, with weak separation', hasNo: '—', separation: 'weak' },
]

export const foragerById = (id: ForagerId): ForagerSpec => FORAGERS.find((f) => f.id === id)!

/** The damage of §9.5, applied to Tonight too. */
export interface Damage {
  /** Remove the fast store. */
  noStore?: boolean
  /** Noise on the slow learner's hidden units, 0 to 1. */
  slowNoise?: number
}

/** The index of the property *has beetles under it*. */
export const HAS_BEETLES = PROPERTIES.findIndex((p) => p.relation === 'has' && p.name === 'beetles under it')

/** A trained slow learner from the seed: its youth, the old world's patterns interleaved. Cached per seed, since every forager and panel reads it. */
const trained = new Map<number, SlowLearner>()
export function trainedSlowLearner(seed: number): SlowLearner {
  let net = trained.get(seed)
  if (!net) {
    const rng = makeRng(seed ^ 0x510)
    net = new SlowLearner(rng.fork())
    trainInterleaved(net, oldPatterns(), YOUTH_PASSES, rng.fork())
    trained.set(seed, net)
  }
  return net
}

/** What the slow learner says about a log's kind: whether it has beetles under it, with the damage now set. */
function kindHasBeetles(slow: SlowLearner, kind: Log['kind']): boolean {
  return slow.says(kind === 'loose' ? 'loose-bark log' : 'smooth log', 'has', HAS_BEETLES) >= 0.5
}

/** One stored night's retrieval and what the forager made of it, for the panels. */
export interface NightRetrieval {
  night: number
  retrieval: Retrieval
  /** The logs the forager treated as emptied last night. */
  treatedEmptied: boolean[]
}

export interface ForagerBlock {
  run: BlockRun
  tallies: NightTallies[]
  retrievals: NightRetrieval[]
  /** The store's contents at the end of the block, for the panels. */
  store: FastStore | null
}

/** Build one forager's policy for one block; the forager's own stream is drawn from the seed and the forager. */
export function makeForager(id: ForagerId, seed: number, clearing: Clearing, slow: SlowLearner, damage: Damage = {}, separation?: Separation): { policy: Policy; retrievals: NightRetrieval[]; store: FastStore | null; mapAnswers: (sim: NightSim) => MapAnswers } {
  const spec = foragerById(id)
  const rng = makeRng((seed ^ 0xf0a) + { usual: 1, tendency: 2, tonight: 3, blurred: 4 }[id] * 7919)
  const sep = separation ?? spec.separation
  const useStore = sep !== null && !damage.noStore
  const store = useStore ? new FastStore(new SeparationStage(sep!, rng.fork())) : null
  const tendency = id === 'tendency' ? new TendencyUnit(clearing.logs.length) : null
  const orderRng = rng.fork()
  const contextRng = rng.fork()
  const decideRng = rng.fork()
  // The context drifts a little each night. The forager holds, as one register overwritten at each dawn, what last
  // night was like: its features and the context as it was then. That register is its cue for last night; which logs
  // were emptied then is the store's to say, and a store whose codes for two nights overlap answers with both.
  let context = freshContext(contextRng)
  let lastNightWasLike: number[] | null = null
  let night = 0
  let treated: boolean[] = clearing.logs.map(() => false)
  let lastRetrieval: Retrieval | null = null
  const retrievals: NightRetrieval[] = []
  slow.damage = { noise: damage.slowNoise ?? 0 }

  const startNight = (sim: NightSim) => {
    night = sim.night
    if (night > 1) context = driftContext(context, contextRng)
    treated = clearing.logs.map(() => false)
    lastRetrieval = null
    if (store && night > 1 && lastNightWasLike) {
      const r = store.retrieve(lastNightWasLike)
      lastRetrieval = r
      // The forager acts on the store's answer with the strength the store gives it: a log the store puts at 0.5
      // is treated as emptied last night half the time. Nothing else decides; the strength is the overlap's.
      treated = clearing.logs.map((l) => decideRng.next() < (r.blended[l.id] ?? 0))
      retrievals.push({ night, retrieval: r, treatedEmptied: [...treated] })
    } else if (store) retrievals.push({ night, retrieval: { contributions: [], blended: clearing.logs.map(() => 0), ranked: [] }, treatedEmptied: [...treated] })
  }

  const policy: Policy = {
    next(sim) {
      if (sim.night !== night) startNight(sim)
      if (tendency) {
        // The log with the highest weight among those not dug tonight, ties broken by the forager's stream.
        let best: Log[] = []
        let bestW = -Infinity
        for (const l of sim.clearing.logs) {
          if (sim.dugTonight[l.id] > 0) continue
          const w = tendency.unit.weights[l.id]
          if (w > bestW + 1e-9) {
            bestW = w
            best = [l]
          } else if (Math.abs(w - bestW) <= 1e-9) best.push(l)
        }
        if (!best.length) return null
        const pick = best[orderRng.int(best.length)]
        tendency.begin(pick.id)
        return pick
      }
      const candidates = sim.clearing.logs.filter((l) => sim.dugTonight[l.id] === 0 && !treated[l.id] && kindHasBeetles(slow, l.kind))
      if (!candidates.length) return null
      return candidates[orderRng.int(candidates.length)]
    },
    outcome(_log, outcome) {
      tendency?.outcome(outcome === 'beetles' ? 1 : 0)
    },
  }

  /**
   * At dawn: answer the map question as the forager would, then store the
   * night. *Tonight* is its own list. For a log it has emptied on some
   * stored night, the store's answer to "emptied last night?" has the
   * strength the blend gives it, and the forager marks *last night* that
   * often, and otherwise *two nights ago* (or *not emptied*, on night 2,
   * when there is no night before last). A store whose codes for two
   * nights overlap therefore marks the wrong night as often as the overlap
   * says. Then the night is stored once, with the logs emptied tonight.
   */
  const mapAnswers = (sim: NightSim): MapAnswers => {
    if (sim.night !== night) startNight(sim)
    const answers: MapAnswers = {}
    const emptied = sim.record.emptiedTonight
    const blended = lastRetrieval?.blended ?? []
    const ever = clearing.logs.map((l) => (store ? store.nights.some((n) => n.content[l.id] >= 0.5) : false))
    for (const l of clearing.logs) {
      if (l.kind !== 'loose') continue
      let a: Truth = 'never'
      if (emptied[l.id]) a = 'tonight'
      else if (ever[l.id]) a = decideRng.next() < (blended[l.id] ?? 0) ? 'last night' : night >= 3 ? 'two nights ago' : 'never'
      answers[l.id] = a
    }
    const tonight = nightInput(featureVector(sim.features), context)
    if (store) store.store(tonight, emptied.map((e) => (e ? 1 : 0)), `night ${night}`)
    lastNightWasLike = tonight
    return answers
  }
  return { policy, retrievals, store, mapAnswers }
}

/** Run one forager over one block of the student's nights (the same plan and clearing; its own digs), with its map answers. */
export function runForagerBlock(id: ForagerId, seed: number, plan: BlockPlan, clearing: Clearing, damage: Damage = {}, separation?: Separation): ForagerBlock {
  const slow = trainedSlowLearner(seed)
  const f = makeForager(id, seed, clearing, slow, damage, separation)
  const run = runBlockScripted(plan, clearing, seed, f.policy, {}, (r, sim) => answerMap(r, f.mapAnswers(sim)))
  slow.damage = { noise: 0 }
  return { run, tallies: run.records.map(tallies), retrievals: f.retrievals, store: f.store }
}

/** The forager's confusion table over a block, from its own map answers. */
export function foragerTable(b: ForagerBlock) {
  return blockTable(b.run)
}

export type { Rng }
