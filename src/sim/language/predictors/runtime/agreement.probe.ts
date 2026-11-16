import { describe, it } from 'vitest'
import { readDesc } from './loadModels.node'

/**
 * Stop 2, Part 4 (spec §13, step 3): each model's held-out accuracy and
 * agreement by depth at every snapshot, as measured by the training script
 * and recorded in the models' descriptions.
 *   PROBE=1 PROBE_DIR=src/sim/language/predictors npx vitest run --disable-console-intercept -t "snapshots table"
 */
describe('snapshots table', () => {
  it('prints', () => {
    const out: string[] = []
    for (const kind of ['transformer', 'srn'] as const) {
      const d = readDesc(kind)
      out.push(`${kind}: ${d.params} parameters; width ${d.dModel}, layers ${d.nLayers}, heads ${d.nHeads}, positions ${d.maxLen}; hidden ${d.hidden}`)
      out.push('  updates   held-out acc   loss   agreement depth 0 / 1 / 2 / 3')
      for (const s of d.snapshots) out.push(`  ${String(s.updates).padStart(7)}   ${(100 * s.heldOutAccuracy).toFixed(1).padStart(6)}%   ${s.loss === null ? '  --- ' : s.loss.toFixed(3)}   ${[0, 1, 2, 3].map((k) => (100 * s.agreementByDepth[String(k)]).toFixed(0).padStart(3) + '%').join(' / ')}`)
    }
    console.log(out.join('\n'))
  })
})
