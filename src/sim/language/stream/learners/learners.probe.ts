import { describe, it } from 'vitest'
import { makeRng } from '../../../random'
import { streamFor, SYLLABLES_PER_MINUTE } from '../language'
import { testTrials, scoreTest, nonwords, partwords } from '../test'
import { trainDips, dipsScorer, dipsCuts } from './dips'
import { makeSrn, trainSrn, srnScorer, HIDDEN, RATE } from './srn'

/**
 * Stop 2, Part 2 (spec §13, step 3): the learners' scores on both 36-trial
 * tests at the seven amounts of listening, over 20 streams; and the dips
 * learner's two shares on the made-up language. PARSER waits on its paper.
 *   PROBE=1 PROBE_DIR=src/sim/language/stream npx vitest run --disable-console-intercept -t "learners table"
 */
export const AMOUNTS_MIN = [0.5, 1, 2, 4, 7, 14, 21]
const SEEDS = Array.from({ length: 20 }, (_, i) => 2000 + i)
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
const f = (x: number) => x.toFixed(1).padStart(5)

describe('learners table', () => {
  it('prints', () => {
    const out: string[] = [`SRN hidden ${HIDDEN}, rate ${RATE}; 20 streams; amounts (min) ${AMOUNTS_MIN.join(' ')}`]
    out.push(`nonwords: ${nonwords().map((x) => x.syllables.join('')).join(' ')}; part-words: ${partwords().map((x) => x.syllables.join('')).join(' ')}`)
    const amounts = AMOUNTS_MIN.map((m) => Math.round(m * SYLLABLES_PER_MINUTE))
    const table: Record<string, number[][]> = { 'dips nonword': [], 'dips partword': [], 'srn nonword': [], 'srn partword': [] }
    for (const k of Object.keys(table)) table[k] = amounts.map(() => [])
    const precision: number[] = []
    const recall: number[] = []
    const t0 = performance.now()
    for (const seed of SEEDS) {
      const s = streamFor(seed, 1512)
      const nw = testTrials('nonword', makeRng(seed + 1))
      const pw = testTrials('partword', makeRng(seed + 2))
      const srn = makeSrn(seed)
      let fed = 0
      amounts.forEach((n, ai) => {
        const dips = trainDips(s.syllables.slice(0, n))
        table['dips nonword'][ai].push(scoreTest(nw, dipsScorer(dips), makeRng(seed + 3)))
        table['dips partword'][ai].push(scoreTest(pw, dipsScorer(dips), makeRng(seed + 4)))
        trainSrn(srn, s.syllables, fed === 0 ? 0 : fed - 1, n)
        fed = n
        table['srn nonword'][ai].push(scoreTest(nw, srnScorer(srn), makeRng(seed + 5)))
        table['srn partword'][ai].push(scoreTest(pw, srnScorer(srn), makeRng(seed + 6)))
      })
      const dips = trainDips(s.syllables)
      const cuts = dipsCuts(dips, s.syllables)
      const boundaries = new Set<number>()
      for (let i = 1; i < s.syllables.length; i++) if (s.position[i] === 0) boundaries.add(i)
      const onB = cuts.filter((c) => boundaries.has(c)).length
      precision.push(onB / cuts.length)
      recall.push(onB / boundaries.size)
    }
    out.push(`time ${((performance.now() - t0) / 1000).toFixed(1)} s for 20 streams`)
    out.push('learner / test'.padEnd(16) + AMOUNTS_MIN.map((m) => `${m}m`.padStart(13)).join(''))
    for (const [k, rows] of Object.entries(table)) out.push(k.padEnd(16) + rows.map((xs) => `${f(mean(xs))} [${f(Math.min(...xs))}-${f(Math.max(...xs))}]`.padStart(13)).join(''))
    out.push(`dips on the made-up language, 21 minutes: share of cuts on boundaries ${(100 * mean(precision)).toFixed(1)}%, share of boundaries found ${(100 * mean(recall)).toFixed(1)}%`)
    console.log(out.join('\n'))
  })
})
