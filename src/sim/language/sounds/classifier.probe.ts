import { describe, it } from 'vitest'
import { makeClassifier, train, accuracy, confusion, forward, shares, splitRun1, splitOnePitch, splitOneVoice, LABELS, RATE, PASSES, HIDDEN } from './classifier'
import { loadShippedTokens, loadContinuumPatches } from './tokens.node'
import { STEPS } from './abx'

/**
 * Stop 2, Part 1 (spec §13, step 3): the classifier's held-out accuracy
 * (run 1), its accuracy trained on one pitch and on one voice (run 2), and
 * its labeling curve on the continuum (run 3), over 10 seeds.
 *   PROBE=1 PROBE_DIR=src/sim/language/sounds npx vitest run --disable-console-intercept -t "classifier"
 */
const SEEDS = [1000, 1001, 1002, 1003, 1004, 1005, 1006, 1007, 1008, 1009]
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
const sd = (xs: number[]) => Math.sqrt(mean(xs.map((x) => (x - mean(xs)) ** 2)))
const f = (x: number) => x.toFixed(1)

describe('classifier', () => {
  it('runs 1 to 3 over 10 seeds', () => {
    const s = loadShippedTokens()
    const cont = loadContinuumPatches()
    const out: string[] = [`hidden ${HIDDEN}, rate ${RATE}, passes ${PASSES}, tokens ${s.tokens.length}, held-out voices ${s.heldOutVoices.join(',')}`]
    const run1: number[] = []
    const curves: number[][] = []
    const conf = LABELS.map(() => LABELS.map(() => 0))
    const run3: number[][][] = []
    const t0 = performance.now()
    for (const seed of SEEDS) {
      const { training, test } = splitRun1(s.tokens, s.heldOutVoices)
      const c = makeClassifier(seed)
      train(c, training, test, seed)
      run1.push(accuracy(c, test))
      curves.push(c.curve)
      confusion(c, test).forEach((row, i) => row.forEach((v, j) => (conf[i][j] += v)))
      run3.push(cont.map((p) => shares(forward(c, p).o)))
    }
    const ms = (performance.now() - t0) / SEEDS.length
    out.push(`run 1 held-out accuracy: mean ${f(mean(run1))}% sd ${f(sd(run1))} (min ${f(Math.min(...run1))}, max ${f(Math.max(...run1))}); ${ms.toFixed(0)} ms per training in Node`)
    out.push(`run 1 curve by pass (mean over seeds): ${Array.from({ length: PASSES }, (_, p) => f(mean(curves.map((c) => c[p])))).join(' ')}`)
    out.push(`run 1 confusion summed over seeds (rows right label b,d,g; columns network's): ${conf.map((r) => r.join('/')).join('  ')}`)
    const pitch: number[] = []
    const voice: number[] = []
    for (const seed of SEEDS) {
      const a = splitOnePitch(s.tokens, s.heldOutVoices)
      const c = makeClassifier(seed)
      train(c, a.training, a.test, seed)
      pitch.push(accuracy(c, a.test))
      const b = splitOneVoice(s.tokens, 1)
      const d = makeClassifier(seed)
      train(d, b.training, b.test, seed)
      voice.push(accuracy(d, b.test))
    }
    out.push(`run 2 one pitch (train ${splitOnePitch(s.tokens, s.heldOutVoices).training.length}, test ${splitOnePitch(s.tokens, s.heldOutVoices).test.length}): mean ${f(mean(pitch))}% sd ${f(sd(pitch))}`)
    out.push(`run 2 one voice (train ${splitOneVoice(s.tokens, 1).training.length}, test ${splitOneVoice(s.tokens, 1).test.length}): mean ${f(mean(voice))}% sd ${f(sd(voice))}`)
    out.push(`run 3 labeling curve on the ${STEPS} continuum steps the lab plays, mean share over seeds (b / d / g), and the most likely label:`)
    for (let k = 0; k < STEPS; k++) {
      const b = mean(run3.map((r) => r[k][0]))
      const d = mean(run3.map((r) => r[k][1]))
      const g = mean(run3.map((r) => r[k][2]))
      const top = LABELS[[b, d, g].indexOf(Math.max(b, d, g))]
      out.push(`  step ${String(k + 1).padStart(2)}: ${b.toFixed(2)} / ${d.toFixed(2)} / ${g.toFixed(2)}  ${top}`)
    }
    const seq = Array.from({ length: STEPS }, (_, k) => {
      const v = [0, 1, 2].map((i) => mean(run3.map((r) => r[k][i])))
      return LABELS[v.indexOf(Math.max(...v))]
    }).join('')
    out.push(`run 3 label sequence: ${seq}`)
    console.log(out.join('\n'))
  })
})
