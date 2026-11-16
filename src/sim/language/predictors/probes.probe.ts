import { describe, it } from 'vitest'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { makeProbes } from './probes'

/** Writes the probe sentences for the offline training's agreement measure: PROBE=1 PROBE_DIR=src/sim/language/predictors npx vitest run --disable-console-intercept -t "write probes" */
describe('write probes', () => {
  it('writes', () => {
    const dir = join(__dirname, '..', '..', '..', '..', 'training', 'm13', 'corpus')
    const probes = makeProbes()
    writeFileSync(join(dir, 'probes.json'), JSON.stringify(probes, null, 1))
    console.log(`wrote ${probes.length} probes`, probes.filter((p) => p.depth === 2)[0])
  })
})
