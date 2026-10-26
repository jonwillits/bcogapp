import { makeRng } from '../../../sim/random'
import type { ProgressStore } from '../../../sim/memory/progress/store'
import { makeClearings, type Clearing, type ClearingId } from '../../../sim/memory/logs/clearings'
import { answerMap, blockTable, newBlockRun, planFor, runBlockScripted, type BlockRun } from '../../../sim/memory/logs/block'
import { tallies, type NightRecord, type NightTallies } from '../../../sim/memory/logs/night'
import { truthOf, type Truth } from '../../../sim/memory/logs/refill'
import type { MapAnswers } from '../../../sim/memory/logs/mapQuestion'
import { SECOND_BLOCK_KEY, type Part4BlockResult, type SecondBlockPrediction, type StudentNights } from '../../../sim/memory/logs/results'

/**
 * The student's own six nights, as Part 5 needs them (spec §4.3, §9): read
 * from the progress store once Part 4 is finished, or the sample set, a
 * recorded set from the build's own play, for a student whose saved nights
 * are lost. Every Part 5 panel says when the nights are someone else's.
 */

export const SAMPLE_SEED = 4242

export function studentNights(progress: ProgressStore, seed: number): StudentNights | null {
  const a = progress.result('p4-block-1') as Part4BlockResult | undefined
  const b = progress.result('p4-block-2') as Part4BlockResult | undefined
  if (!a || !b || !progress.isComplete('p4-block-1') || !progress.isComplete('p4-block-2')) return null
  const { plan } = planFor(seed)
  return { seed, plan, blocks: [a, b], prediction: (progress.prediction(SECOND_BLOCK_KEY) as SecondBlockPrediction | null) ?? null, sample: false }
}

/**
 * The sample set: a scripted forager that digs loose-bark logs not yet dug
 * tonight in a seeded order, whose map answers are right for the logs it
 * emptied tonight and, for logs emptied on earlier nights, right seven
 * times in ten and otherwise marked the other night. Deterministic.
 */
export function sampleNights(): StudentNights {
  const seed = SAMPLE_SEED
  const { plan, clearings } = planFor(seed)
  const blocks = plan.blocks.map((block, index) => {
    const clearing = clearings[block.clearing]
    const order = makeRng(seed ^ 0x5a3 ^ index)
    const marks = makeRng(seed ^ 0x7c1 ^ index)
    const run = runBlockScripted(
      block,
      clearing,
      seed,
      {
        next(sim) {
          const c = sim.clearing.logs.filter((l) => l.kind === 'loose' && sim.dugTonight[l.id] === 0)
          return c.length ? c[order.int(c.length)] : null
        },
      },
      {},
      (r, sim) => {
        const night = sim.night
        const after = r.states[r.states.length - 1]
        const answers: MapAnswers = {}
        for (const l of clearing.logs) {
          if (l.kind !== 'loose') continue
          const t = truthOf(after[l.id], night)
          let a: Truth = t
          if (t === 'last night' || t === 'two nights ago') {
            if (marks.next() >= 0.7) a = t === 'last night' ? (night >= 3 ? 'two nights ago' : 'tonight') : 'last night'
          }
          answers[l.id] = a
        }
        answerMap(r, answers)
      },
    )
    const result: Part4BlockResult = { index: index as 0 | 1, plan: block, clearing: block.clearing, records: run.records, answers: run.answers, states: run.states, restarted: false }
    return result
  }) as [Part4BlockResult, Part4BlockResult]
  return { seed, plan, blocks, prediction: null, sample: true }
}

/** The clearing a saved block ran in. */
export function clearingOf(nights: StudentNights, index: 0 | 1): Clearing {
  return makeClearings(nights.seed)[nights.blocks[index].clearing as ClearingId]
}

/** A saved block as a BlockRun, for the confusion tables. */
export function toBlockRun(nights: StudentNights, index: 0 | 1): BlockRun {
  const b = nights.blocks[index]
  const run = newBlockRun(b.plan, clearingOf(nights, index))
  run.states.splice(0, run.states.length, ...b.states)
  run.records.push(...b.records)
  run.answers.push(...b.answers)
  return run
}

export function studentTallies(nights: StudentNights, index: 0 | 1): NightTallies[] {
  return nights.blocks[index].records.map(tallies)
}

export function studentTable(nights: StudentNights, index: 0 | 1) {
  return blockTable(toBlockRun(nights, index))
}

export function studentRecord(nights: StudentNights, index: 0 | 1, night: number): NightRecord {
  return nights.blocks[index].records[night - 1]
}

/** Beetles per minute over a night. */
export function perMinute(r: NightRecord): number {
  return r.seconds > 0 ? (r.beetles / r.seconds) * 60 : 0
}
