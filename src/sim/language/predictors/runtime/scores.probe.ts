import { describe, it, expect } from 'vitest'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { loadShipped, readDesc } from './loadModels.node'
import { srnForward, transformerForward, type SeqDesc } from './seqNet'
import { scoreSentences, type Scores } from '../scoring'
import { corpus, SETTINGS } from '../grammar'
import { makeRng } from '../../../random'

/**
 * The networks' three scores at every snapshot (Jon, 2026-11-20; scoring.ts
 * says what they are), on the 1,000 held-out sentences and on the 9,000
 * training sentences, written into the shipped descriptions as `scores` on
 * each snapshot. The held-out `exact` must reproduce the file's
 * `heldOutAccuracy`, which the training script measured by the same rule.
 *   PROBE=1 PROBE_DIR=src/sim/language/predictors/runtime npx vitest run --disable-console-intercept -t "snapshot scores"
 */
const MODELS = join(__dirname, '..', '..', '..', '..', '..', 'public', 'm13', 'models')
const r4 = (x: number) => Math.round(x * 1e4) / 1e4
const round = (s: Scores): Scores => ({ ...s, agreement: r4(s.agreement), kind: r4(s.kind), exact: r4(s.exact) })

describe('snapshot scores', () => {
  it('scores every snapshot and writes the descriptions', () => {
    const all = corpus(makeRng(SETTINGS.corpusSeed), SETTINGS.corpusSentences)
    const training = all.slice(0, SETTINGS.trainingSentences)
    const heldOut = all.slice(SETTINGS.trainingSentences)
    const rows: string[] = ['kind         updates   held-out agreement / kind / exact   training agreement / kind / exact']
    for (const kind of ['transformer', 'srn'] as const) {
      const file = join(MODELS, `${kind}.json`)
      const raw = readFileSync(file, 'utf-8')
      const desc = JSON.parse(raw) as SeqDesc
      const fresh = readDesc(kind)
      for (const snap of desc.snapshots) {
        const m = loadShipped(kind, snap.updates)
        const predictions = (ids: number[]): Float64Array[] => (kind === 'transformer' ? transformerForward(m, ids.slice(0, -1)).probs : srnForward(m, ids.slice(0, -1)).probs)
        const h = round(scoreSentences(heldOut, predictions))
        const t = round(scoreSentences(training, predictions))
        const ref = fresh.snapshots.find((s) => s.updates === snap.updates)!.heldOutAccuracy
        expect(Math.abs(h.exact - ref), `${kind} ${snap.updates}: exact ${h.exact} against the file's ${ref}`).toBeLessThanOrEqual(0.002)
        snap.scores = { heldOut: h, training: t }
        rows.push(`${kind.padEnd(12)} ${String(snap.updates).padStart(7)}   ${(100 * h.agreement).toFixed(1).padStart(5)}% / ${(100 * h.kind).toFixed(1).padStart(5)}% / ${(100 * h.exact).toFixed(1).padStart(5)}%          ${(100 * t.agreement).toFixed(1).padStart(5)}% / ${(100 * t.kind).toFixed(1).padStart(5)}% / ${(100 * t.exact).toFixed(1).padStart(5)}%`)
      }
      // Insert the field textually after each snapshot's "loss" line, so that nothing else in the file changes.
      let k = 0
      const out = raw.replace(/^(\s*)"loss": ([^\n]*?)(,?)$/gm, (_whole, indent: string, value: string, comma: string) => {
        const snap = desc.snapshots[k++]
        const block = JSON.stringify(snap.scores, null, 1)
          .split('\n')
          .map((line, i) => (i === 0 ? line : indent + line))
          .join('\n')
        return `${indent}"loss": ${value},\n${indent}"scores": ${block}${comma}`
      })
      expect(k).toBe(desc.snapshots.length)
      expect(JSON.parse(out)).toEqual(desc)
      writeFileSync(file, out)
    }
    console.log(rows.join('\n'))
  }, 1_200_000)
})
