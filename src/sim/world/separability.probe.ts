/**
 * Calibrating the separability battery against the one pair we know the answer
 * for.
 *
 * Jon cannot sort W from X by eye. That makes them an empirical negative
 * control: whatever they differ by on any measure is, by observation, below the
 * threshold of visibility. He sorted Y instantly, so Y is the positive control.
 * A measure that scores W-vs-X higher than W-vs-Y is not measuring visibility
 * and does not belong in the suite.
 *
 * Thresholds derived here, not chosen.
 */
import { it } from 'vitest'
import { CONTINUOUS_LINEAGE_DATA } from './continuousLineageData'
import { observe, CENTRE_LIGHT, PERTURBATIONS, type Perturbation } from './observation'
import { LINEAGE_DATA } from './lineageData'
import { ContinuousWorld, DEFAULT_CONTINUOUS_PARAMS } from './continuousWorld'
import { nearestVariety, type Genome } from '../creature/genome'
import { MEASURES, OBSERVE_OPTS, tells, describeGaps } from './separability'

const byId = Object.fromEntries(CONTINUOUS_LINEAGE_DATA.map((f) => [f.id, f]))
const pad = (s: string, w: number) => s.padStart(w)
const f = (n: number, w = 8, d = 3) => pad(n.toFixed(d), w)

function table(rows: { id: string; genomes: Genome[] }[]) {
  const obs = rows.map((r) => observe(r.genomes, CENTRE_LIGHT, OBSERVE_OPTS))
  const head = ['measure'.padEnd(22), ...rows.map((r) => pad(r.id, 9))].join(' |')
  console.log(head)
  console.log('-'.repeat(head.length))
  for (const m of MEASURES) {
    console.log(
      [m.key.padEnd(22), ...obs.map((o) => f(m.get(o), 9))].join(' |'),
    )
  }
  return obs
}

it('calibration: what the confirmed-invisible pair differs by', () => {
  console.log('\n=== the battery, default world ===')
  const obs = table(['W', 'X', 'Y', 'Z'].map((id) => ({ id, genomes: byId[id].genomes })))
  const [w, x, y] = obs

  console.log('\n=== gaps: W<->X is invisible (confirmed); W/X<->Y is not ===')
  console.log(
    ['measure'.padEnd(22), pad('W<->X', 9), pad('worst vs Y', 11), pad('ratio', 8)].join(' |'),
  )
  console.log('-'.repeat(56))
  for (const m of MEASURES) {
    const wx = Math.abs(m.get(w) - m.get(x))
    const vsY = Math.max(Math.abs(m.get(w) - m.get(y)), Math.abs(m.get(x) - m.get(y)))
    console.log(
      [m.key.padEnd(22), f(wx, 9), f(vsY, 11), f(wx > 1e-9 ? vsY / wx : Infinity, 8, 1)].join(' |'),
    )
  }

  const pops = ['W', 'X', 'Y'].map((id, i) => ({ id, observation: obs[i] }))
  console.log('\n--- negative control: W vs X, which Jon cannot sort ---')
  const neg = tells(pops.slice(0, 2))
  console.log(neg.length === 0 ? '  SILENT (correct)' : '  FIRES: ' + describeGaps(neg))
  console.log('\n--- positive control: W, X, Y, which Jon sorted instantly ---')
  const pos = tells(pops)
  console.log(pos.length === 0 ? '  SILENT (WRONG)' : '  FIRES on ' + pos.length + ':')
  for (const g of pos) console.log('    ' + describeGaps([g]))
})

it('candidate: Q16 at 2400s as Y', () => {
  const w = new ContinuousWorld(16, DEFAULT_CONTINUOUS_PARAMS, 'Q')
  w.run(2400)
  const genomes = w.creatures.map((c) => ({ ...c.genome }))
  const counts: Record<string, number> = {}
  for (const g of genomes) {
    const v = nearestVariety(g).split(' ')[0]
    counts[v] = (counts[v] ?? 0) + 1
  }
  console.log('\n=== Q16@2400 ===')
  console.log('extinct:', w.extinct, ' n:', genomes.length, ' varieties:', JSON.stringify(counts))
  console.log(
    'mean bias',
    f(genomes.reduce((a, g) => a + g.bias, 0) / genomes.length),
    ' mean |w|',
    f(
      genomes.reduce(
        (a, g) => a + (Math.abs(g.wLL) + Math.abs(g.wLR) + Math.abs(g.wRL) + Math.abs(g.wRR)) / 4,
        0,
      ) / genomes.length,
    ),
  )
  console.log('\n=== does it approach the light at all? ===')
  console.log(' id  | arrived | closest | meanDist')
  for (const [id, g] of [
    ['W', byId.W.genomes],
    ['X', byId.X.genomes],
    ['Y', byId.Y.genomes],
    ['Z', byId.Z.genomes],
    ['Q16', genomes],
  ] as [string, Genome[]][]) {
    const o = observe(g, CENTRE_LIGHT, OBSERVE_OPTS)
    console.log(
      `  ${id.padEnd(3)} | ${f(o.arrivedFraction, 7)} | ${f(o.meanClosest, 7)} | ${f(
        o.meanDistance, 8,
      )}`,
    )
  }

  console.log('\n=== battery: W, X against Q16@2400 as candidate Y ===')
  const obs = table([
    { id: 'W', genomes: byId.W.genomes },
    { id: 'X', genomes: byId.X.genomes },
    { id: 'Q16', genomes },
  ])
  const [ow, ox, oq] = obs
  console.log('\n=== gaps against the W<->X invisibility floor ===')
  console.log(
    ['measure'.padEnd(22), pad('W<->X', 9), pad('worst vs Q16', 13), pad('ratio', 8)].join(' |'),
  )
  console.log('-'.repeat(58))
  for (const m of MEASURES) {
    const wx = Math.abs(m.get(ow) - m.get(ox))
    const vsQ = Math.max(Math.abs(m.get(ow) - m.get(oq)), Math.abs(m.get(ox) - m.get(oq)))
    console.log(
      [m.key.padEnd(22), f(wx, 9), f(vsQ, 13), f(wx > 1e-9 ? vsQ / wx : Infinity, 8, 1)].join(' |'),
    )
  }

  console.log('\n--- verdict on {W, X, Q16@2400} ---')
  const t = tells([
    { id: 'W', observation: ow },
    { id: 'X', observation: ox },
    { id: 'Q16', observation: oq },
  ])
  if (t.length === 0) console.log('  SEPARABLE-PROOF on every measure in the battery')
  else for (const g of t) console.log('  TELL: ' + describeGaps([g]))
}, 600_000)

it('divergence on station-keeping alone, both engines', () => {
  const ratio = (a: number, b: number) => Math.max(a, b) / Math.max(0.02, Math.min(a, b))
  for (const [engine, data] of [
    ['continuous', CONTINUOUS_LINEAGE_DATA],
    ['discrete', LINEAGE_DATA],
  ] as const) {
    const by = Object.fromEntries(data.map((f) => [f.id, f]))
    console.log(`\n=== ${engine} — spread ratio (W/X mean vs Y) per world ===`)
    for (const [i, p] of [CENTRE_LIGHT, ...PERTURBATIONS].entries()) {
      const o = (id: string) => observe(by[id].genomes, p, OBSERVE_OPTS)
      const wx = (o('W').meanDistanceSpread + o('X').meanDistanceSpread) / 2
      const y = o('Y').meanDistanceSpread
      console.log(
        `  ${(i === 0 ? 'DEFAULT: ' + p.label : p.label).padEnd(32)} spread ${wx.toFixed(
          3,
        )} vs ${y.toFixed(3)}  ratio ${ratio(wx, y).toFixed(2)}`,
      )
    }
    console.log(`  --- same-job numbers (${engine}) ---`)
    for (const fx of data) {
      const o = observe(fx.genomes, CENTRE_LIGHT, OBSERVE_OPTS)
      console.log(
        `    ${fx.id}: arrived ${o.arrivedFraction.toFixed(2)}  meanDist ${o.meanDistance.toFixed(
          2,
        )}  timeNear ${o.timeNearFraction.toFixed(2)}`,
      )
    }
    console.log(`  --- sisters, default world (${engine}) ---`)
    const t = tells([
      { id: 'W', observation: observe(by.W.genomes, CENTRE_LIGHT, OBSERVE_OPTS) },
      { id: 'X', observation: observe(by.X.genomes, CENTRE_LIGHT, OBSERVE_OPTS) },
    ])
    console.log(`    ${t.length === 0 ? 'indistinguishable' : describeGaps(t)}`)
    console.log(`  --- Y vs W/X, default world (${engine}) ---`)
    for (const g of tells(['W', 'X', 'Y'].map((id) => ({
      id,
      observation: observe(by[id].genomes, CENTRE_LIGHT, OBSERVE_OPTS),
    }))))
      console.log(`    ${g.measure.key} ${g.gap.toFixed(3)} > ${g.measure.jnd}`)
  }
})

it('finding a second perturbation that diverges on station-keeping', () => {
  /**
   * Measured on within-vehicle spread of distance alone — the station-keeping
   * signal, which is the mechanism evidence Q14 asks a student to uncover.
   *
   * Speed is deliberately excluded from divergence now. It is signed, so the old
   * ratio is meaningless across a sign flip (0.67 against -1.05 scores 33), and
   * more importantly the speed difference is visible in the *default* world, so
   * it is the baseline rather than something a perturbation reveals. A test that
   * counted it would pass without any perturbation doing any work.
   *
   * Only worlds a student can build: lights are strength 4, on the floor or up
   * on the rim, plus the noise slider and removing a light mid-run.
   */
  const ratio = (a: number, b: number) => Math.max(a, b) / Math.max(0.02, Math.min(a, b))
  const spread = (data: readonly { id: string; genomes: Genome[] }[], p: Perturbation) => {
    const by = Object.fromEntries(data.map((f) => [f.id, f]))
    const o = (id: string) => observe(by[id].genomes, p, OBSERVE_OPTS).meanDistanceSpread
    return ratio((o('W') + o('X')) / 2, o('Y'))
  }

  const cands: Perturbation[] = []
  const L = (x: number, y: number, z: number): [number, number, number] => [x, y, z]
  for (const d of [4.5, 6, 7.5, 9])
    for (const h of [0.7, 1.7, 2.7])
      cands.push({ label: `rim light d=${d} h=${h}`, lights: [L(0, h, d)] })
  for (const d of [4.5, 6, 7.5, 9])
    for (const h of [0.7, 1.7, 2.7])
      cands.push({ label: `two lights +-${d} h=${h}`, lights: [L(-d, h, 0), L(d, h, 0)] })
  for (const d of [6, 7.5])
    cands.push({ label: `two rim lights +-${d}`, lights: [L(-d, 1.7, 0), L(d, 1.7, 0)] })
  for (const d of [4.5, 6, 7.5])
    cands.push({ label: `centre + rim at ${d}`, lights: [L(0, 0.7, 0), L(0, 1.7, d)] })
  for (const t of [2, 5, 8, 12])
    cands.push({ label: `removed at ${t}s`, lights: [L(0, 0.7, 0)], removeAt: { index: 0, time: t } })
  for (const n of [0.15, 0.3, 0.45, 0.6])
    cands.push({ label: `noise ${n}`, lights: [L(0, 0.7, 0)], sensorNoise: n })
  for (const d of [4.5, 6, 7.5])
    cands.push({
      label: `three lights r=${d}`,
      lights: [0, 1, 2].map((k) => {
        const a = (k / 3) * Math.PI * 2
        return L(Math.cos(a) * d, 0.7, Math.sin(a) * d)
      }),
    })

  const rows = cands.map((p) => ({
    p,
    cont: spread(CONTINUOUS_LINEAGE_DATA, p),
    disc: spread(LINEAGE_DATA, p),
  }))
  rows.sort((a, b) => Math.min(b.cont, b.disc) - Math.min(a.cont, a.disc))

  console.log('\nspread-ratio under each candidate perturbation (both engines must clear 2.0)')
  console.log('  continuous  discrete | perturbation')
  console.log('  ' + '-'.repeat(60))
  for (const r of rows.slice(0, 16))
    console.log(
      `  ${r.cont.toFixed(2).padStart(10)}  ${r.disc.toFixed(2).padStart(8)} | ${r.p.label}` +
        (Math.min(r.cont, r.disc) >= 2 ? '   <- clears both' : ''),
    )
}, 600_000)

it('perturbations a student can actually place', () => {
  /**
   * The arena floor is at ground height 0 and the plateau outside it at
   * RIM_HEIGHT = 2, with nothing in between — the cliff walls are deliberately
   * not pointer targets. A placed light sits ORB_HOVER = 0.7 above whichever
   * surface was clicked. So the only two heights a student can ever create are
   * **0.7 inside the arena** and **2.7 outside it**.
   *
   * The shipped `a light up on the rim` perturbation is [0, 1.7, 7.5]: height
   * 1.7 implies a ground height of 1.0, and z = 7.5 is inside the bounds where
   * the ground is flat at 0. It describes a world nobody can build, and it is
   * the strongest of the four. Same family of mistake as the rest of this file's
   * subject: an acceptance test measuring something outside what anyone can
   * reach.
   */
  const BOUNDS = 9
  const ratio = (a: number, b: number) => Math.max(a, b) / Math.max(0.02, Math.min(a, b))
  const placeable = (l: [number, number, number]) => {
    const outside = Math.max(Math.abs(l[0]), Math.abs(l[2])) > BOUNDS
    return outside ? l[1] === 2.7 : l[1] === 0.7 && Math.abs(l[0]) <= BOUNDS && Math.abs(l[2]) <= BOUNDS
  }
  const spread = (data: readonly { id: string; genomes: Genome[] }[], p: Perturbation) => {
    const by = Object.fromEntries(data.map((f) => [f.id, f]))
    const o = (id: string) => observe(by[id].genomes, p, OBSERVE_OPTS).meanDistanceSpread
    return ratio((o('W') + o('X')) / 2, o('Y'))
  }

  const cands: Perturbation[] = []
  const F = (x: number, z: number): [number, number, number] => [x, 0.7, z]
  const R = (x: number, z: number): [number, number, number] => [x, 2.7, z]
  for (const d of [9.5, 10, 11, 13, 16]) cands.push({ label: `one rim light at ${d}`, lights: [R(0, d)] })
  for (const d of [9.5, 10, 11, 13]) cands.push({ label: `two rim lights +-${d}`, lights: [R(-d, 0), R(d, 0)] })
  for (const d of [4.5, 6, 7.5, 8.8]) cands.push({ label: `two floor lights +-${d}`, lights: [F(-d, 0), F(d, 0)] })
  for (const d of [10, 11, 13]) cands.push({ label: `centre + rim at ${d}`, lights: [F(0, 0), R(0, d)] })
  for (const d of [6, 8.8]) cands.push({ label: `floor light out at ${d}`, lights: [F(0, d)] })
  for (const t of [2, 5, 8]) cands.push({ label: `removed at ${t}s`, lights: [F(0, 0)], removeAt: { index: 0, time: t } })
  for (const n of [0.3, 0.45, 0.6]) cands.push({ label: `noise ${n}`, lights: [F(0, 0)], sensorNoise: n })

  for (const c of cands)
    for (const l of c.lights)
      if (!placeable(l)) throw new Error(`candidate "${c.label}" is not placeable: ${l}`)

  const rows = cands.map((p) => ({ p, cont: spread(CONTINUOUS_LINEAGE_DATA, p), disc: spread(LINEAGE_DATA, p) }))
  rows.sort((a, b) => Math.min(b.cont, b.disc) - Math.min(a.cont, a.disc))
  console.log('\nstation-keeping divergence, placeable worlds only (both engines must clear 2.0)')
  console.log('  continuous  discrete | perturbation')
  console.log('  ' + '-'.repeat(58))
  for (const r of rows)
    console.log(
      `  ${r.cont.toFixed(2).padStart(10)}  ${r.disc.toFixed(2).padStart(8)} | ${r.p.label}` +
        (Math.min(r.cont, r.disc) >= 2 ? '   <- clears both' : ''),
    )
}, 600_000)
