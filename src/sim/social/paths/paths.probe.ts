import { describe, it } from 'vitest'
import { thePool, disagreementSummary } from './pool'

/**
 * Prints every path with its cells, and at each judgment point the two
 * models' distributions and their disagreement:
 *
 *   PROBE=1 PROBE_DIR=src/sim/social/paths npx vitest run --disable-console-intercept -t "paths:"
 */
describe('paths:', () => {
  it('the pool', () => {
    const f = (d: Record<string, number>) => `A ${d.A.toFixed(2)} B ${d.B.toFixed(2)} C ${d.C.toFixed(2)}`
    for (const p of thePool()) {
      console.log(`\n${p.id} ${p.kind} ${p.layout} ${p.reserve ? '(reserve)' : ''} goal ${p.goal}: ${p.cells.map((c) => `${c.x},${c.y}`).join(' ')}`)
      for (const j of p.judgments) console.log(`   at step ${j.steps} (${p.cells[j.steps].x},${p.cells[j.steps].y}): inverse ${f(j.inverse)} | heuristic ${f(j.heuristic)} | disagreement ${j.disagreement.toFixed(2)}${j.substantial ? ' *' : ''}`)
    }
    const s = disagreementSummary()
    console.log(`\nshown judgment points ${s.total}, substantial disagreements ${s.substantial} (${(100 * s.share).toFixed(0)}%)`)
    const r = disagreementSummary(thePool().filter((p) => p.reserve))
    console.log(`reserve judgment points ${r.total}, substantial ${r.substantial}`)
  })
})
