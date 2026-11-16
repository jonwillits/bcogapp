import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { loadShipped, readDesc } from './loadModels.node'
import { srnForward, transformerForward, weightsHash, softmax } from './seqNet'
import { accepts, END, VOCABULARY } from '../grammar'
import { makeRng } from '../../../random'

/**
 * Spec §14, Part 4: the runtime's next-token probabilities and attention
 * weights match PyTorch's on a fixture of prompts within 1e-4; the
 * transformer is causal (no position attends to a later one, and a later
 * token changes no earlier position's output); the snapshots are frozen
 * through a scripted session; the vocabulary is the grammar's.
 */
const FX = join(__dirname, '..', 'fixtures')
const have = existsSync(join(FX, 'transformer.json')) && existsSync(join(FX, 'srn.json'))

describe.skipIf(!have)('the runtime against PyTorch', () => {
  const tf = loadShipped('transformer')
  const srn = loadShipped('srn')
  const idx = (t: string) => tf.desc.vocab.indexOf(t)
  it('the vocabulary is the grammar’s, in order', () => {
    expect(tf.desc.vocab).toEqual(VOCABULARY)
    expect(srn.desc.vocab).toEqual(VOCABULARY)
    expect(tf.desc.snapshots.length).toBe(8)
  })
  it('transformer: probabilities and attention weights within 1e-4 on every fixture prompt', () => {
    const fixtures = JSON.parse(readFileSync(join(FX, 'transformer.json'), 'utf-8')) as { prompt: string[]; probs: number[][]; attention: number[][][][] }[]
    expect(fixtures.length).toBeGreaterThanOrEqual(30)
    let worst = 0
    for (const f of fixtures) {
      const out = transformerForward(tf, f.prompt.map(idx))
      f.probs.forEach((row, i) => row.forEach((p, j) => (worst = Math.max(worst, Math.abs(p - out.probs[i][j])))))
      f.attention.forEach((layer, L) => layer.forEach((head, hh) => head.forEach((row, i) => row.forEach((a, j) => (worst = Math.max(worst, Math.abs(a - out.attention[L][hh][i][j])))))))
    }
    expect(worst).toBeLessThan(1e-4)
  })
  it('simple recurrent network: probabilities and hidden states within 1e-4 on every fixture prompt', () => {
    const fixtures = JSON.parse(readFileSync(join(FX, 'srn.json'), 'utf-8')) as { prompt: string[]; probs: number[][]; hidden: number[][] }[]
    let worst = 0
    for (const f of fixtures) {
      const out = srnForward(srn, f.prompt.map(idx))
      f.probs.forEach((row, i) => row.forEach((p, j) => (worst = Math.max(worst, Math.abs(p - out.probs[i][j])))))
      f.hidden.forEach((row, i) => row.forEach((p, j) => (worst = Math.max(worst, Math.abs(p - out.hidden[i][j])))))
    }
    expect(worst).toBeLessThan(1e-4)
  })
  it('the transformer is causal: no weight on a later key, and a later token changes no earlier output', () => {
    const a = transformerForward(tf, ['boys', 'who', 'Mary', 'chases'].map(idx))
    for (const layer of a.attention) for (const head of layer) head.forEach((row, i) => row.forEach((w, j) => (j > i ? expect(w).toBe(0) : expect(w).toBeGreaterThanOrEqual(0))))
    for (const layer of a.attention) for (const head of layer) for (const row of head) expect(row.reduce((s, w) => s + w, 0)).toBeCloseTo(1, 6)
    const b = transformerForward(tf, ['boys', 'who', 'Mary', 'chases', 'cats'].map(idx))
    for (let i = 0; i < 4; i++) for (let j = 0; j < VOCABULARY.length; j++) expect(b.probs[i][j]).toBeCloseTo(a.probs[i][j], 10)
  })
  it('every snapshot hashes the same before and after a scripted session of prompts and generation', () => {
    for (const kind of ['transformer', 'srn'] as const) {
      const desc = readDesc(kind)
      for (const s of desc.snapshots) {
        const m = loadShipped(kind, s.updates)
        const before = weightsHash(m)
        const run = kind === 'transformer' ? (t: number[]) => transformerForward(m, t).probs : (t: number[]) => srnForward(m, t).probs
        run(['boys', 'who', 'Mary', 'chases'].map(idx))
        const rng = makeRng(1)
        let toks = [idx('dogs')]
        for (let k = 0; k < 20 && toks[toks.length - 1] !== idx(END); k++) {
          const p = softmax(run(toks)[toks.length - 1], 1.5)
          let r = rng.next()
          let pick = 0
          for (let j = 0; j < p.length; j++) {
            r -= p[j]
            if (r <= 0) {
              pick = j
              break
            }
          }
          toks.push(pick)
        }
        expect(weightsHash(m)).toBe(before)
        void accepts(toks.map((t) => VOCABULARY[t]))
      }
    }
  })
})
