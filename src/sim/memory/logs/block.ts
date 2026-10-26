import { makeRng, type Rng } from '../../random'
import { makeClearings, type Clearing, type ClearingId } from './clearings'
import { afterNight, freshBlock, type LastEmptied } from './refill'
import { NightSim, type NightOptions, type NightRecord } from './night'
import { planPart4, type BlockPlan, type NightFeatures, type Part4Plan } from './features'
import { confusionTable, sumTables, truths, type ConfusionTable, type MapAnswers } from './mapQuestion'
import { runScripted, type Policy } from './scripted'

/**
 * A block of three nights in one clearing (spec §8.5): each block's first
 * night starts with every loose-bark log full, and the refill rule carries
 * the state from night to night. `BlockRun` is the bookkeeping the student's
 * store and the programmed foragers share: the state, the records, the map
 * answers and the confusion tables.
 */

export interface BlockRun {
  plan: BlockPlan
  clearing: Clearing
  /** The state after each night so far; index 0 is the fresh block. */
  states: LastEmptied[]
  records: NightRecord[]
  answers: MapAnswers[]
}

export function newBlockRun(plan: BlockPlan, clearing: Clearing): BlockRun {
  return { plan, clearing, states: [freshBlock(clearing.logs.length)], records: [], answers: [] }
}

/** The stream a night draws from: the seed, the clearing, the block and the night, so a restart in the reserve clearing is a fresh night. */
export function nightRng(seed: number, clearing: ClearingId, kind: string, night: number, attempt = 0): Rng {
  const k = { practice: 1, A: 2, B: 3, reserve: 4 }[clearing]
  return makeRng((seed ^ 0x9a7) + k * 7919 + (kind === 'look-alike' ? 100 : kind === 'distinct' ? 200 : 300) + night * 31 + attempt * 104729)
}

/** Start night n (1 to 3) of a block. */
export function startNight(run: BlockRun, seed: number, attempt = 0, opts: NightOptions = {}): NightSim {
  const night = run.records.length + 1
  const features = run.plan.nights[night - 1]
  return new NightSim(run.clearing, run.states[night - 1], night, features, nightRng(seed, run.clearing.id, run.plan.kind, night, attempt), opts)
}

/** Record a finished night and carry the state forward. */
export function finishNight(run: BlockRun, sim: NightSim): void {
  run.records.push(sim.record)
  run.states.push(afterNight(run.states[run.states.length - 1], sim.record.emptiedTonight, sim.night))
}

export function answerMap(run: BlockRun, answers: MapAnswers): void {
  run.answers.push(answers)
}

/** The confusion table for one night of a run, from what was true after it. */
export function nightTable(run: BlockRun, night: number): ConfusionTable {
  return confusionTable(truths(run.clearing, run.states[night], night), run.answers[night - 1] ?? {})
}

export function blockTable(run: BlockRun): ConfusionTable {
  return sumTables(run.records.map((_, i) => nightTable(run, i + 1)))
}

/** Run a whole block under a policy, with a map-answer policy if given; the programmed foragers of Part 5 and the probes use this. */
export function runBlockScripted(plan: BlockPlan, clearing: Clearing, seed: number, policy: Policy, opts: NightOptions = {}, onNight?: (run: BlockRun, sim: NightSim) => void): BlockRun {
  const run = newBlockRun(plan, clearing)
  for (let n = 1; n <= 3; n++) {
    const sim = startNight(run, seed, 0, opts)
    runScripted(sim, policy)
    finishNight(run, sim)
    onNight?.(run, sim)
  }
  return run
}

/** The student's six nights as Part 5 needs them: the plan, the clearings, and the student's records and answers, with the practice night. */
export interface StudentNights {
  seed: number
  plan: Part4Plan
  clearings: Record<ClearingId, Clearing>
  practice: NightRecord | null
  blocks: [BlockRun, BlockRun]
  /** The prediction committed before the second block. */
  prediction: string | null
}

export function planFor(seed: number): { plan: Part4Plan; clearings: Record<ClearingId, Clearing> } {
  return { plan: planPart4(seed), clearings: makeClearings(seed) }
}

export type { BlockPlan, NightFeatures }
