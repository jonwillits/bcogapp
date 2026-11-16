import { describe, it } from 'vitest'
import { makeRng } from '../random'
import { loadShippedTokens, loadContinuumPatches } from './sounds/tokens.node'
import { makeClassifier, train, splitRun1, forward, shares } from './sounds/classifier'
import { streamFor, SYLLABLES_PER_MINUTE } from './stream/language'
import { testTrials, scoreTest } from './stream/test'
import { trainDips, dipsScorer } from './stream/learners/dips'
import { makeSrn, trainSrn, srnScorer } from './stream/learners/srn'
import { makeDesign } from './words/design'
import { keyMeasure } from './words/keyMeasure'
import { fit, runs, runModel } from './words/fit'
import { corpus, SETTINGS, VOCABULARY } from './predictors/grammar'
import { makeCountModel, countStream, principalPlane, embedding, clusterTree } from './predictors/counts'
import { makeProbes } from './predictors/probes'
import { loadShipped } from './predictors/runtime/loadModels.node'
import { transformerForward, srnForward } from './predictors/runtime/seqNet'

/**
 * Every synchronous path a click runs, timed headless (APP_DEVELOPMENT_PROCESS
 * Phase 2): multiply by about four for a student laptop; anything over about
 * 300 ms on a click path is sliced.
 *   PROBE=1 PROBE_DIR=src/sim/language npx vitest run --disable-console-intercept -t "timing"
 */
const ms = (f: () => void) => {
  const t0 = performance.now()
  f()
  return performance.now() - t0
}

describe('timing', () => {
  it('prints', () => {
    const out: string[] = []
    const s = loadShippedTokens()
    const cont = loadContinuumPatches()
    const { training, test } = splitRun1(s.tokens, s.heldOutVoices)
    const net = makeClassifier(1)
    out.push(`classifier: one pass over 450 tokens ${ms(() => train(net, training, test, 1, 1)).toFixed(0)} ms (12 passes in slices)`)
    out.push(`classifier: run 3 on 14 sounds ${ms(() => cont.forEach((p) => shares(forward(net, p).o))).toFixed(1)} ms`)
    const st = streamFor(7, 1512)
    const n = 21 * SYLLABLES_PER_MINUTE
    out.push(`dips at 21 min, one stream, train and both tests ${ms(() => { const d = trainDips(st.syllables.slice(0, n)); scoreTest(testTrials('nonword', makeRng(1)), dipsScorer(d), makeRng(2)); scoreTest(testTrials('partword', makeRng(1)), dipsScorer(d), makeRng(2)) }).toFixed(1)} ms`)
    out.push(`srn at 21 min, one stream, train and both tests ${ms(() => { const r = makeSrn(7); trainSrn(r, st.syllables, 0, n); scoreTest(testTrials('nonword', makeRng(1)), srnScorer(r), makeRng(2)); scoreTest(testTrials('partword', makeRng(1)), srnScorer(r), makeRng(2)) }).toFixed(0)} ms (one stream per slice, 20 slices)`)
    const d = makeDesign(5, 0)
    const target = keyMeasure(d, runModel('tally', 2, d, 9)).accuracy
    out.push(`words: fit guess and check (41 values × 50 runs) ${ms(() => fit('guessCheck', d, target, 1)).toFixed(0)} ms; fit tallying ${ms(() => fit('tally', d, target, 1)).toFixed(0)} ms; 200 runs ${ms(() => runs('tally', 2, d, 3)).toFixed(0)} ms`)
    const toks = corpus(makeRng(SETTINGS.corpusSeed), SETTINGS.corpusSentences).flat().map((t) => VOCABULARY.indexOf(t))
    out.push(`count model over ${toks.length} tokens, window 8, one slice of 2,000 ${ms(() => countStream(makeCountModel(8, true), toks, 0, 2000)).toFixed(1)} ms; the whole corpus ${ms(() => countStream(makeCountModel(8, true), toks)).toFixed(0)} ms (sliced)`)
    const m = countStream(makeCountModel(4, true), toks)
    const words = VOCABULARY.slice(0, 50).map((_, i) => i)
    out.push(`principal plane of 50 embeddings ${ms(() => principalPlane(words.map((w) => embedding(m, w)))).toFixed(0)} ms; cluster tree of 30 ${ms(() => clusterTree(words.slice(0, 30).map((w) => embedding(m, w)))).toFixed(0)} ms`)
    const tf = loadShipped('transformer')
    const sr = loadShipped('srn')
    const prompt = ['boys', 'who', 'Mary', 'chases', 'cats', 'who', 'dogs', 'chase', 'walk'].map((t) => VOCABULARY.indexOf(t))
    out.push(`transformer forward, 9 tokens ${ms(() => transformerForward(tf, prompt)).toFixed(1)} ms; srn forward ${ms(() => srnForward(sr, prompt)).toFixed(1)} ms`)
    const probes = makeProbes()
    out.push(`agreement by depth, 200 probes × 2 models ${ms(() => { for (const p of probes) { const ids = p.prefix.map((t) => VOCABULARY.indexOf(t)); transformerForward(tf, ids); srnForward(sr, ids) } }).toFixed(0)} ms`)
    out.push(`generate 32 tokens ${ms(() => { let ctx = [VOCABULARY.length - 1]; for (let k = 0; k < 32; k++) { transformerForward(tf, ctx); ctx = [...ctx, 3].slice(-31) } }).toFixed(0)} ms`)
    console.log(out.join('\n'))
  })
})
