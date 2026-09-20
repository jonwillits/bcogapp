import { it } from 'vitest'
import { lab4Digests } from './lab4Signature'

/**
 * Regenerates `lab4Regression.fixture.json`. **Run this only from a checkout
 * of the Lab 4 engine as shipped** (commit 9ebfc77, or a later one whose
 * change to Lab 4 was deliberate) — regenerating it from an engine the
 * learning layer has already touched makes the regression test agree with
 * itself and prove nothing.
 *
 *   PROBE=1 PROBE_DIR=src/sim/bilaterian/learning npx vitest run --disable-console-intercept -t "lab 4 fixture"
 */
it('lab 4 fixture', async () => {
  const host = (globalThis as { process?: { platform?: string; arch?: string } }).process
  const fs = await import('node:fs')
  const body = { generatedOn: { platform: host?.platform, arch: host?.arch }, engineCommit: '9ebfc77', runs: lab4Digests() }
  fs.writeFileSync(new URL('./lab4Regression.fixture.json', import.meta.url), JSON.stringify(body, null, 1) + '\n')
  console.log(`wrote ${body.runs.length} digests`)
}, 120_000)
