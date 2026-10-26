import { it } from 'vitest'
import { mean } from '../bilaterian/measure'
import { planFor } from './logs/block'
import { NIGHT_S, DIG_S, EAT_S, NURSE_S } from './logs/night'
import { makeClearings } from './logs/clearings'
import { FORAGERS, foragerTable, runForagerBlock, trainedSlowLearner, type ForagerId } from './foragers/foragers'
import { SEPARATIONS } from './foragers/store'
import { THINGS } from './foragers/world'
import { planPart1 } from './words/design'
import { planRecognition } from './words/recognition'
import { ASSOCIATE_LISTS } from './words/lists'
import { WORD_SETS } from './words/sets'
import { ITEMS, FITTING, UNFITTING } from './room/items'

/**
 * The viewing crib for Module 10: what a person should see on each part,
 * with the numbers measured over twenty seeds (1000 to 1019). Motion, the
 * look of the room and the night, and the timing of the words on a real
 * screen cannot be verified headlessly and are Jon's to check at
 * localhost:5173/#/m10-memory.
 *
 *   PROBE=1 PROBE_DIR=src/sim/memory npx vitest run --disable-console-intercept -t "crib:"
 */
const SEEDS = Array.from({ length: 20 }, (_, i) => 1000 + i)
const say = (s: string) => console.log(`m10 · ${s}`)
const f1 = (v: number) => v.toFixed(1)
const f2 = (v: number) => v.toFixed(2)

it('crib: what the parts should read', () => {
  // Part 1
  const p1 = planPart1(1000)
  say(`Part 1: seven lists of fifteen words in the seed's order; for seed 1000 the lists of associates sit at slots ${p1.slots.map((s, i) => (s.list.kind === 'associates' ? i + 1 : null)).filter(Boolean).join(', ')} (never 1 or 7, never adjacent); studied ${p1.studied.map((l) => l.critical).join(', ')}, controls ${p1.controls.map((l) => l.critical).join(', ')}.`)
  say(`Part 1: the recognition test has ${planRecognition(p1).length} words; the six lists of associates are ${ASSOCIATE_LISTS.map((l) => l.critical).join(', ')}.`)
  say(`Part 2: three word sets (${WORD_SETS.map((w) => w.id).join(', ')}), the scrambled one always first.`)
  say(`Part 3: ${ITEMS.length} checklist items, ${FITTING.length} fitting and ${UNFITTING.length} not, each present in one arrangement; every present item in view at least 4 s of 30, by frustum test.`)
  // Part 4
  say(`Part 4: a night lasts ${NIGHT_S} s; a dig ${DIG_S} s and a meal ${EAT_S} s more; the young call at ${NIGHT_S / 2} s and nursing takes ${NURSE_S} s.`)
  const c = makeClearings(1000)
  say(`Part 4: seed 1000's first block is ${planFor(1000).plan.blocks[0].kind} in clearing ${planFor(1000).plan.blocks[0].clearing}; clearing A's nest at (${c.A.nest.x}, ${c.A.nest.y}) with ${c.A.logs.length} logs and ${c.A.landmarks.length} landmarks.`)
  // Part 5
  const rows: Record<ForagerId, { e2: number[]; e3: number[]; beetles: number[]; smooth: number[]; alike: number[]; distinct: number[] }> = {} as never
  for (const f of FORAGERS) rows[f.id] = { e2: [], e3: [], beetles: [], smooth: [], alike: [], distinct: [] }
  const store: Record<string, { alike: number[]; distinct: number[] }> = {}
  for (const sep of SEPARATIONS) store[sep] = { alike: [], distinct: [] }
  for (const seed of SEEDS) {
    const { plan, clearings } = planFor(seed)
    for (const block of plan.blocks) {
      for (const f of FORAGERS) {
        const b = runForagerBlock(f.id, seed, block, clearings[block.clearing])
        rows[f.id].e2.push(b.tallies[1].digsAtEmptiedLastNight)
        rows[f.id].e3.push(b.tallies[2].digsAtEmptiedLastNight)
        rows[f.id].beetles.push(b.tallies.reduce((a, t) => a + t.beetles, 0))
        rows[f.id].smooth.push(b.tallies.reduce((a, t) => a + t.digsAtSmooth, 0))
        const t = foragerTable(b)
        ;(block.kind === 'look-alike' ? rows[f.id].alike : rows[f.id].distinct).push(t.couldBeConfused ? t.confusions / t.couldBeConfused : 0)
      }
      for (const sep of SEPARATIONS) {
        const t = foragerTable(runForagerBlock('tonight', seed, block, clearings[block.clearing], {}, sep))
        ;(block.kind === 'look-alike' ? store[sep].alike : store[sep].distinct).push(t.couldBeConfused ? t.confusions / t.couldBeConfused : 0)
      }
    }
  }
  for (const f of FORAGERS) {
    const r = rows[f.id]
    say(`Part 5, ${f.label}: digs at logs emptied last night ${f1(mean(r.e2))} on night 2 and ${f1(mean(r.e3))} on night 3; beetles over a block ${f1(mean(r.beetles))}; digs at smooth logs over a block ${f1(mean(r.smooth))}; confusions share look-alike ${f2(mean(r.alike))}, distinct ${f2(mean(r.distinct))}.`)
  }
  for (const sep of SEPARATIONS) say(`Part 5, the store at ${sep} separation: confusions share look-alike ${f2(mean(store[sep].alike))}, distinct ${f2(mean(store[sep].distinct))}.`)
  const net = trainedSlowLearner(1000)
  net.damage = { noise: 0.5 }
  say(`Part 5, the slow learner at noise 0.5 (seed 1000, 20 draws): properties the things have still said yes, general ${f2(net.kept(THINGS, 'general', 20))}, middle ${f2(net.kept(THINGS, 'middle', 20))}, specific ${f2(net.kept(THINGS, 'specific', 20))}.`)
  net.damage = { noise: 0 }
  say('Part 5: with replay off the old things’ specific properties fall to about 0.4 of those still said yes; with replay on they stay at 1.0 (six seeds; foragers.test.ts).')
}, 1_200_000)
