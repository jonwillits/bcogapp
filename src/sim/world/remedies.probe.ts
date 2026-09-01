/**
 * Options B and C of the §6 separability problem, measured rather than argued.
 *
 * Neither is adopted here and nothing regenerates a fixture. Both run the saved
 * populations through the calibrated battery under a changed rule, so the cost
 * of each is a number instead of a prediction.
 */
import { it } from 'vitest'
import { CONTINUOUS_LINEAGE_DATA } from './continuousLineageData'
import { observe, CENTRE_LIGHT, type ObserveOptions } from './observation'
import { MEASURES, OBSERVE_OPTS, tells } from './separability'
import type { Genome } from '../creature/genome'

const byId = Object.fromEntries(CONTINUOUS_LINEAGE_DATA.map((f) => [f.id, f]))
const f = (n: number, w = 8, d = 3) => n.toFixed(d).padStart(w)

const look = (genomes: readonly Genome[], opts: ObserveOptions) =>
  observe(genomes, CENTRE_LIGHT, { ...OBSERVE_OPTS, ...opts })

/** The three approachers, as the battery wants them. */
const trio = (ys: readonly Genome[], opts: ObserveOptions) => [
  { id: 'W', observation: look(byId.W.genomes, opts) },
  { id: 'X', observation: look(byId.X.genomes, opts) },
  { id: 'Y', observation: look(ys, opts) },
]

it('option B: what clamping reverse actually costs', () => {
  for (const clampReverse of [false, true]) {
    console.log(`\n=== clampReverse: ${clampReverse} ===`)
    const rows = ['W', 'X', 'Y', 'Z'].map((id) => ({
      id,
      o: look(byId[id].genomes, { clampReverse }),
    }))
    const head = ['measure'.padEnd(22), ...rows.map((r) => r.id.padStart(9))].join(' |')
    console.log(head)
    console.log('-'.repeat(head.length))
    for (const m of MEASURES)
      console.log([m.key.padEnd(22), ...rows.map((r) => f(m.get(r.o), 9))].join(' |'))
    console.log(
      ['arrivedFraction'.padEnd(22), ...rows.map((r) => f(r.o.arrivedFraction, 9))].join(' |'),
    )

    const t = tells(trio(byId.Y.genomes, { clampReverse }))
    console.log(`  tells: ${t.length}`)
    for (const g of t)
      console.log(
        `    ${g.measure.key} ${g.gap.toFixed(3)} > ${g.measure.jnd} (${g.worst.join(
          ' vs ',
        )}) — ${g.measure.visible}`,
      )
  }
})

it('option C: a bias floor against light strength, and the cross with B', () => {
  const FLOORS = [0, 0.15, 0.3, 0.6, 0.9, 1.2, 1.5]
  const STRENGTHS = [4, 3, 2.5, 2, 1.5, 1]

  const grid = (
    title: string,
    cell: (floor: number, lightStrength: number) => string,
  ) => {
    console.log(`\n${title}`)
    console.log('  bias |' + STRENGTHS.map((x) => `  S=${x}`.padStart(9)).join(''))
    console.log('  ' + '-'.repeat(6 + 9 * STRENGTHS.length))
    for (const floor of FLOORS)
      console.log(
        `  ${f(floor, 4, 2)} |` +
          STRENGTHS.map((x) => cell(floor, x).padStart(9)).join(''),
      )
  }

  const flooredY = (floor: number) =>
    byId.Y.genomes.map((g) => ({ ...g, bias: Math.max(g.bias, floor) }))

  for (const clampReverse of [false, true]) {
    const tag = clampReverse ? 'B+C: reverse clamped' : 'C alone: reverse allowed'

    grid(
      `${tag} — Y's arrivedFraction (W and X reach 0.81 at S>=2.5)`,
      (floor, lightStrength) =>
        f(
          look(flooredY(floor), { lightStrength, clampReverse }).arrivedFraction,
          0,
          2,
        ),
    )
    /**
     * `arrivedFraction` counts a 1.5-unit radius, and a clamped creature stalls
     * at its own reversal radius — 1.92 units at bias 1.5. That would read as
     * "never arrived" while the creature sits plainly at the light, so the
     * closest-approach distance is printed beside it rather than trusted to a
     * threshold. W and X reach 0.61-0.63.
     */
    grid(
      `${tag} — Y's meanClosest, the distance it actually gets to (W/X: 0.62)`,
      (floor, lightStrength) =>
        f(look(flooredY(floor), { lightStrength, clampReverse }).meanClosest, 0, 2),
    )
    grid(
      `${tag} — measures on which {W, X, Y} are tellable apart (0 is the goal)`,
      (floor, lightStrength) =>
        String(tells(trio(flooredY(floor), { lightStrength, clampReverse })).length),
    )
  }

  console.log('\nW and X alone, to show what the light strength costs them:')
  console.log('     S | W arrived  X arrived | W arrive-t  X arrive-t')
  for (const lightStrength of STRENGTHS) {
    const w = look(byId.W.genomes, { lightStrength })
    const x = look(byId.X.genomes, { lightStrength })
    console.log(
      `  ${f(lightStrength, 4, 1)} | ${f(w.arrivedFraction, 9, 2)} ${f(
        x.arrivedFraction, 9, 2,
      )} | ${f(w.meanTimeToArrival, 10, 1)} ${f(x.meanTimeToArrival, 10, 1)}`,
    )
  }
}, 600_000)

it('the untried lever: light height, which shrinks the reversal zone by subtraction', () => {
  /**
   * Intensity is `S / (1 + r² + h²)` in true 3D, so a light raised by `h` above
   * the sensors enters an inhibitory creature's reversal radius as
   * `sqrt(S|w|/bias - 1 - h²)` — subtracted, where light strength divides. That
   * matters because strength and wiring cancel exactly: at the boundary where a
   * 3a stops reversing, its turning radius is a constant of the geometry, which
   * is why the whole bias x strength grid is dead. Height is not a scaling, so
   * it is not obviously caught by that argument. Testing it rather than
   * reasoning about it.
   */
  const HEIGHTS = [0.7, 1.5, 2.5, 4, 6, 9]
  const STRENGTHS = [4, 6, 10, 20]

  for (const label of ['tells', 'Y meanClosest', 'W meanClosest'] as const) {
    console.log(`\n${label} — rows are light height, columns light strength`)
    console.log('     h |' + STRENGTHS.map((x) => `  S=${x}`.padStart(9)).join(''))
    console.log('  ' + '-'.repeat(6 + 9 * STRENGTHS.length))
    for (const h of HEIGHTS) {
      const cells = STRENGTHS.map((lightStrength) => {
        const world = { label: `h=${h}`, lights: [[0, h, 0]] as [number, number, number][] }
        const o = (g: readonly Genome[]) =>
          observe(g, world, { ...OBSERVE_OPTS, lightStrength })
        const pops = [
          { id: 'W', observation: o(byId.W.genomes) },
          { id: 'X', observation: o(byId.X.genomes) },
          { id: 'Y', observation: o(byId.Y.genomes) },
        ]
        if (label === 'tells') return String(tells(pops).length)
        if (label === 'Y meanClosest') return f(pops[2].observation.meanClosest, 0, 2)
        return f(pops[0].observation.meanClosest, 0, 2)
      })
      console.log(`  ${f(h, 4, 1)} |` + cells.map((c) => c.padStart(9)).join(''))
    }
  }
}, 600_000)

it('the best surviving cells, inspected rather than counted', () => {
  const cells: [string, number, number][] = [
    ['default', 0.7, 4],
    ['h=6 S=10', 6, 10],
    ['h=6 S=20', 6, 20],
    ['h=4 S=20', 4, 20],
  ]
  for (const [label, h, lightStrength] of cells) {
    const world = { label, lights: [[0, h, 0]] as [number, number, number][] }
    const o = (g: readonly Genome[]) => observe(g, world, { ...OBSERVE_OPTS, lightStrength })
    const pops = [
      { id: 'W', observation: o(byId.W.genomes) },
      { id: 'X', observation: o(byId.X.genomes) },
      { id: 'Y', observation: o(byId.Y.genomes) },
    ]
    console.log(`\n=== ${label} ===`)
    console.log(
      '  arrived  ' +
        pops.map((p) => `${p.id} ${f(p.observation.arrivedFraction, 5, 2)}`).join('  ') +
        '   | meanDist ' +
        pops.map((p) => f(p.observation.meanDistance, 5, 2)).join(' ') +
        '   | reverse ' +
        pops.map((p) => f(p.observation.reverseFraction, 5, 2)).join(' '),
    )
    for (const g of tells(pops))
      console.log(
        `    ${g.measure.key.padEnd(22)} ${f(g.gap, 6)} > ${f(g.measure.jnd, 5)}  ` +
          `(${(g.gap / g.measure.jnd).toFixed(1)}x over) — ${g.measure.visible}`,
      )
  }
})
