/**
 * A crib sheet for watching the Lineages tab.
 *
 * Everything the acceptance tests assert, restated as counts out of the
 * population and as things visible on screen, so that looking at the scene is a
 * check against specific predictions rather than a general impression. The tests
 * are headless because the Browser pane throttles requestAnimationFrame and
 * freezes `useFrame`, so this is the only way the motion gets verified at all.
 */
import { it } from 'vitest'
import { CONTINUOUS_LINEAGE_DATA } from './continuousLineageData'
import { observe, CENTRE_LIGHT, PERTURBATIONS } from './observation'
import { OBSERVE_OPTS } from './separability'

const n = (x: number, total: number) => `${Math.round(x * total)}/${total}`

it('crib: what each population should look like', () => {
  console.log('\n=== DEFAULT WORLD — one light dead centre, 30 s ===')
  for (const fx of CONTINUOUS_LINEAGE_DATA) {
    const t = fx.genomes.length
    const o = observe(fx.genomes, CENTRE_LIGHT, OBSERVE_OPTS)
    console.log(
      `\n  ${fx.id}  (${t} creatures)` +
        `\n    reach the light:        ${n(o.arrivedFraction, t)}   (first arrivals around ${o.meanTimeToArrival.toFixed(0)} s)` +
        `\n    driving backwards:      ${(o.reverseFraction * 100).toFixed(0)}% of the time` +
        `\n    barely moving:          ${(o.stoppedFraction * 100).toFixed(0)}% of the time` +
        `\n    swings toward light:    ${o.meanTurnTowardsRate > 0 ? 'yes' : 'NO — swings away'} (${o.meanTurnTowardsRate.toFixed(2)} rad/s)` +
        `\n    settles at:             ${o.meanDistance.toFixed(1)} units from the light` +
        `\n    pinned against rim:     ${(o.wallFraction * 100).toFixed(0)}% of the time`,
    )
  }

  console.log('\n\n=== PERTURBATIONS — what each should do to Y vs W and X ===')
  for (const [i, p] of PERTURBATIONS.entries()) {
    const spread = (id: string) => {
      const fx = CONTINUOUS_LINEAGE_DATA.find((f) => f.id === id)!
      return observe(fx.genomes, p, OBSERVE_OPTS).meanDistanceSpread
    }
    const wx = (spread('W') + spread('X')) / 2
    const y = spread('Y')
    const r = Math.max(wx, y) / Math.min(wx, y)
    console.log(
      `\n  ${i + 1}. ${p.label}` +
        `\n     W and X swing over a range of ${wx.toFixed(2)} units; Y over ${y.toFixed(2)}` +
        `\n     ${r >= 2 ? `SEPARATES (${r.toFixed(1)}x) — Y should visibly hold station while W and X keep swinging past` : `does NOT separate (${r.toFixed(1)}x) — expected; kept so Q14 has failures to report`}`,
    )
  }
})
