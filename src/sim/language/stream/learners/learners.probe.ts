import { describe, it } from 'vitest'
import { makeRng } from '../../../random'
import { streamFor, SYLLABLES_PER_MINUTE } from '../language'
import { testTrials, scoreTest, scoreTestByRecognition, nonwords, partwords } from '../test'
import { trainDips, dipsScorer, dipsCuts } from './dips'
import { makeSrn, trainSrn, srnScorer, HIDDEN, RATE } from './srn'
import { makeParser, trainParser, step, parserScorer, parserKnows, strongestUnits, FORGETTING, GAIN, INTERFERENCE, SHAPING_THRESHOLD, START_WEIGHT } from './parser'

/**
 * Stop 2, Part 2 (spec §13, step 3): the learners' scores on both 36-trial
 * tests at the seven amounts of listening, over 20 streams; and the dips
 * learner's two shares on the made-up language.
 *   PROBE=1 PROBE_DIR=src/sim/language/stream npx vitest run --disable-console-intercept -t "learners table"
 * And PARSER's two test rules (the spec's §6.3 and the paper's, p. 256)
 * at the same amounts over the same 20 streams, with its strongest units:
 *   PROBE=1 PROBE_DIR=src/sim/language/stream npx vitest run --disable-console-intercept -t "parser rules"
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
    const table: Record<string, number[][]> = { 'dips nonword': [], 'dips partword': [], 'srn nonword': [], 'srn partword': [], 'parser nonword': [], 'parser partword': [] }
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
        const parser = makeParser(seed)
        trainParser(parser, s.syllables.slice(0, n))
        table['parser nonword'][ai].push(scoreTest(nw, parserScorer(parser), makeRng(seed + 7)))
        table['parser partword'][ai].push(scoreTest(pw, parserScorer(parser), makeRng(seed + 8)))
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

describe('parser rules', () => {
  it('prints', () => {
    const out: string[] = [
      `PARSER (Perruchet and Vinter, 1998): percept 1 to 3 units, start ${START_WEIGHT}, gain ${GAIN}, forgetting ${FORGETTING}, interference ${INTERFERENCE}, threshold ${SHAPING_THRESHOLD}; 20 streams (seeds ${SEEDS[0]} to ${SEEDS[SEEDS.length - 1]}); amounts (min) ${AMOUNTS_MIN.join(' ')}`,
      'spec rule (§6.3): the string with the higher weight as a unit (zero if not one) is chosen; a tie by the seeded stream.',
      'paper rule (p. 256): the word is chosen if it is a unit with weight above 1; otherwise at random.',
      'percent correct on 36 trials, mean [min-max] over the 20 streams',
    ]
    const amounts = AMOUNTS_MIN.map((m) => Math.round(m * SYLLABLES_PER_MINUTE))
    const rows: Record<string, number[][]> = { 'spec, nonwords': [], 'spec, part-words': [], 'paper, nonwords': [], 'paper, part-words': [] }
    for (const k of Object.keys(rows)) rows[k] = amounts.map(() => [])
    const wordsOnTop: number[] = amounts.map(() => 0)
    const unitsAbove: number[][] = amounts.map(() => [])
    const examples: string[] = []
    const t0 = performance.now()
    for (const seed of SEEDS) {
      const s = streamFor(seed, 1512)
      const nw = testTrials('nonword', makeRng(seed + 1))
      const pw = testTrials('partword', makeRng(seed + 2))
      amounts.forEach((n, ai) => {
        const p = makeParser(seed)
        trainParser(p, s.syllables.slice(0, n))
        rows['spec, nonwords'][ai].push(scoreTest(nw, parserScorer(p), makeRng(seed + 7)))
        rows['spec, part-words'][ai].push(scoreTest(pw, parserScorer(p), makeRng(seed + 8)))
        rows['paper, nonwords'][ai].push(scoreTestByRecognition(nw, parserKnows(p), makeRng(seed + 9)))
        rows['paper, part-words'][ai].push(scoreTestByRecognition(pw, parserKnows(p), makeRng(seed + 10)))
        const top = strongestUnits(p, 6)
        if (top.every((u) => u.syllables.length === 3 && nw.some((t) => t.word.join('') === u.unit))) wordsOnTop[ai]++
        unitsAbove[ai].push([...p.units.values()].filter((u) => u.weight >= SHAPING_THRESHOLD && u.syllables.length > 1).length)
        if (seed === SEEDS[0]) examples.push(`  seed ${seed}, ${AMOUNTS_MIN[ai]} min: ${strongestUnits(p, 8).map((u) => `${u.unit} ${u.weight.toFixed(2)}`).join(', ')}`)
      })
    }
    out.push(`time ${((performance.now() - t0) / 1000).toFixed(1)} s for 20 streams at 7 amounts`)
    out.push('rule, test'.padEnd(18) + AMOUNTS_MIN.map((m) => `${m}m`.padStart(16)).join(''))
    for (const [k, xs] of Object.entries(rows)) out.push(k.padEnd(18) + xs.map((v) => `${f(mean(v))} [${f(Math.min(...v))}-${f(Math.max(...v))}]`.padStart(16)).join(''))
    out.push('paper minus spec, mean'.padEnd(18) + amounts.map((_, ai) => `nw ${(mean(rows['paper, nonwords'][ai]) - mean(rows['spec, nonwords'][ai])).toFixed(1).padStart(5)} pw ${(mean(rows['paper, part-words'][ai]) - mean(rows['spec, part-words'][ai])).toFixed(1).padStart(5)}`.padStart(16)).join(' |'))
    out.push('streams whose six strongest units are the six words'.padEnd(52) + wordsOnTop.map((c) => `${c}/20`.padStart(8)).join(''))
    out.push('multi-syllable units at or above the threshold, mean'.padEnd(52) + unitsAbove.map((xs) => mean(xs).toFixed(1).padStart(8)).join(''))
    out.push('the strongest units of one stream:')
    out.push(...examples)
    console.log(out.join('\n'))
  })
})

describe('parser criterion', () => {
  it('prints', () => {
    // The paper's loose criterion (p. 253): the six words are units of PS with the highest weights. Study 1 (p. 254): reached after a mean of 2064 syllables, range 735 to 4479, over 100 runs; all 100 by 4536.
    // Two rankings: over every unit of PS, and over the units of two or more syllables only, as the paper's Tables 2 and 3 list them (the primitives at their initial weight are omitted there).
    const out: string[] = ['parser loose criterion, 100 runs (seeds 3000 to 3099), checked after every percept; paper p. 254: mean 2064 syllables, range 735 to 4479, all 100 by 4536']
    for (const multiOnly of [false, true]) {
      const first: number[] = []
      let notReached = 0
      const t0 = performance.now()
      for (let seed = 3000; seed < 3100; seed++) {
        const s = streamFor(seed, 3000) // 9000 syllables
        const p = makeParser(seed)
        const words = new Set<string>(s.words)
        let reached = -1
        while (step(p, s.syllables)) {
          const top = strongestUnits(p, multiOnly ? 6 + 12 : 6).filter((u) => !multiOnly || u.syllables.length > 1).slice(0, 6)
          if (top.length === 6 && top.every((u) => words.has(u.unit))) {
            reached = p.heard
            break
          }
        }
        if (reached < 0) notReached++
        else first.push(reached)
      }
      const sorted = [...first].sort((a, b) => a - b)
      out.push(`  ranking ${multiOnly ? 'units of 2 or more syllables' : 'every unit'}: mean ${mean(first).toFixed(0)} syllables, range ${sorted[0]} to ${sorted[sorted.length - 1]}, median ${sorted[Math.floor(sorted.length / 2)]}; not reached within 9000 syllables: ${notReached}; by 4536 syllables: ${first.filter((x) => x <= 4536).length} of 100; time ${((performance.now() - t0) / 1000).toFixed(1)} s`)
    }
    console.log(out.join('\n'))
  })
})
