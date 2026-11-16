import { describe, it } from 'vitest'
import { makeRng } from '../random'
import { makeClassifier, train, accuracy, forward, labelOf, splitRun1, splitOnePitch, splitOneVoice, HIDDEN as C_HIDDEN, RATE as C_RATE, PASSES } from './sounds/classifier'
import { loadShippedTokens, loadContinuumPatches } from './sounds/tokens.node'
import { streamFor, SYLLABLES_PER_MINUTE, SYLLABLES, WORDS, tpTable, syllablesOf } from './stream/language'
import { testTrials, scoreTest, nonwords, partwords } from './stream/test'
import { trainDips, dipsScorer } from './stream/learners/dips'
import { makeSrn, trainSrn, srnScorer, HIDDEN as S_HIDDEN, RATE as S_RATE } from './stream/learners/srn'
import { makeDesign } from './words/design'
import { runs, type ModelId } from './words/fit'
import { corpus, SETTINGS, VOCABULARY } from './predictors/grammar'
import { readDesc } from './predictors/runtime/loadModels.node'
import { REFERENCES } from './references'

/**
 * The crib: what the parts should read, printed from the engine over the
 * seeds stated, for the walk-through and the close-out. Every line starts
 * with "m13 · " so the close-out keeps it.
 *
 *   PROBE=1 PROBE_DIR=src/sim/language npx vitest run --disable-console-intercept -t "crib: m13"
 */
const log = (s: string) => console.log(`m13 · ${s}`)
const pct = (x: number) => `${Math.round(100 * x)}%`
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length

describe('crib: m13', () => {
  it('what the parts should read', { timeout: 600_000 }, () => {
    log('== Part 1, Step 4 — the classifier (hidden ' + C_HIDDEN + ', rate ' + C_RATE + ', ' + PASSES + ' passes), one seed each; the Stop 2 means over 10 seeds are 77% / 73% / 55%')
    const s = loadShippedTokens()
    const cont = loadContinuumPatches()
    const seeds = [1000, 1001, 1002]
    const run1 = seeds.map((seed) => { const { training, test } = splitRun1(s.tokens, s.heldOutVoices); const c = makeClassifier(seed); train(c, training, test, seed); return { seed, acc: accuracy(c, test), labels: cont.map((p) => labelOf(forward(c, p).o)).join(' ') } })
    for (const r of run1) log(`run 1, seed ${r.seed}: held-out accuracy ${r.acc.toFixed(1)}% on the two held-out voices; the 14 continuum sounds read ${r.labels}`)
    const pitch = seeds.map((seed) => { const { training, test } = splitOnePitch(s.tokens, s.heldOutVoices); const c = makeClassifier(seed); train(c, training, test, seed); return accuracy(c, test) })
    const voice = seeds.map((seed) => { const { training, test } = splitOneVoice(s.tokens); const c = makeClassifier(seed); train(c, training, test, seed); return accuracy(c, test) })
    log(`run 2: trained on one pitch ${mean(pitch).toFixed(1)}%; trained on one voice ${mean(voice).toFixed(1)}% (means over 3 seeds); a sharp 50% to 100% jump between neighbors is what the Stop 2 curves did NOT show`)

    log('== Part 2 — the language and the learners (SRN hidden ' + S_HIDDEN + ', rate ' + S_RATE + ')')
    log(`words: ${WORDS.join(' ')}; ${SYLLABLES_PER_MINUTE} syllables a minute; nonwords ${nonwords().map((x) => x.syllables.join('')).join(' ')}; part-words ${partwords().map((x) => x.syllables.join('')).join(' ')}`)
    const st = streamFor(1000, 1512)
    const tp = tpTable(st.syllables)
    const at = (a: string, b: string) => tp[SYLLABLES.indexOf(a as (typeof SYLLABLES)[number])][SYLLABLES.indexOf(b as (typeof SYLLABLES)[number])]
    const within = WORDS.flatMap((w) => { const sy = syllablesOf(w); return [at(sy[0], sy[1]), at(sy[1], sy[2])] })
    const between = WORDS.flatMap((w) => WORDS.filter((v) => v !== w).map((v) => at(syllablesOf(w)[2], syllablesOf(v)[0])))
    log(`seed 1000, 7 minutes: within-word transitional probabilities ${Math.min(...within).toFixed(2)} to ${Math.max(...within).toFixed(2)}; between words ${Math.min(...between).toFixed(2)} to ${Math.max(...between).toFixed(2)}`)
    const amounts = [1, 2, 7, 21].map((m) => Math.round(m * SYLLABLES_PER_MINUTE))
    const rows: Record<string, number[]> = { 'dips, nonwords': [], 'dips, part-words': [], 'network, nonwords': [], 'network, part-words': [] }
    const streams = [2000, 2001, 2002, 2003, 2004]
    for (const [ai, n] of amounts.entries()) {
      const acc: Record<string, number[]> = { 'dips, nonwords': [], 'dips, part-words': [], 'network, nonwords': [], 'network, part-words': [] }
      for (const seed of streams) {
        const str = streamFor(seed, 1512)
        const nw = testTrials('nonword', makeRng(seed + 1))
        const pw = testTrials('partword', makeRng(seed + 2))
        const d = trainDips(str.syllables.slice(0, n))
        acc['dips, nonwords'].push(scoreTest(nw, dipsScorer(d), makeRng(seed + 3)))
        acc['dips, part-words'].push(scoreTest(pw, dipsScorer(d), makeRng(seed + 4)))
        const net = makeSrn(seed)
        trainSrn(net, str.syllables, 0, n)
        acc['network, nonwords'].push(scoreTest(nw, srnScorer(net), makeRng(seed + 5)))
        acc['network, part-words'].push(scoreTest(pw, srnScorer(net), makeRng(seed + 6)))
      }
      for (const k of Object.keys(rows)) rows[k][ai] = mean(acc[k])
    }
    log(`Step 4's plot, means over 5 streams at 1, 2, 7, 21 minutes (adults' 2 minutes read 76% nonwords, 65% part-words):`)
    for (const k of Object.keys(rows)) log(`  ${k.padEnd(20)} ${rows[k].map((x) => x.toFixed(0).padStart(3) + '%').join('  ')}`)

    log('== Part 3, Step 3 — the two models on the sample sequence (seed 1234), 200 runs: accuracy, after a right pick, after a wrong pick')
    const d = makeDesign(1234, 0)
    for (const [model, params] of [['guessCheck', [0.5, 1]], ['tally', [1, 4]]] as [ModelId, number[]][]) {
      for (const p of params) { const r = runs(model, p, d, 77); log(`  ${model === 'guessCheck' ? 'guess and check α' : 'tallying β'} ${p}: accuracy ${pct(r.accuracy.mean)} [${pct(r.accuracy.lo)}–${pct(r.accuracy.hi)}], after right ${pct(r.afterRight.mean)}, after wrong ${pct(r.afterWrong.mean)}`) }
    }
    log('  guess and check never tops about 44%; its after-wrong share stays near 1 in 5 while tallying’s rises with its after-right share')

    log('== Part 4 — the corpus and the snapshots')
    const c = corpus(makeRng(SETTINGS.corpusSeed), SETTINGS.corpusSentences)
    const rel = c.filter((sen) => sen.includes('who')).length
    log(`corpus: ${c.length} sentences, ${c.reduce((a, sen) => a + sen.length, 0)} tokens, ${VOCABULARY.length} vocabulary items; ${pct(rel / c.length)} of the sentences hold a relative clause; the longest has ${Math.max(...c.map((sen) => sen.length))} tokens`)
    for (const kind of ['transformer', 'srn'] as const) {
      const desc = readDesc(kind)
      log(`${kind === 'srn' ? 'simple recurrent network' : kind}: ${desc.params} parameters, snapshots at ${desc.snapshots.map((x) => x.updates).join(', ')} updates`)
      log(`  held-out accuracy by snapshot ${desc.snapshots.map((x) => pct(x.heldOutAccuracy)).join(' ')}; depth-3 agreement ${desc.snapshots.map((x) => pct(x.agreementByDepth['3'])).join(' ')}`)
    }
    log(`== References: ${REFERENCES.filter((r) => r.values !== null).length} with a page, ${REFERENCES.filter((r) => r.values === null).length} pending (${REFERENCES.filter((r) => r.values === null).map((r) => r.id).join(', ')})`)
  })
})
