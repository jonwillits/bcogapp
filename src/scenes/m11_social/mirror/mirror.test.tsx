import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ProgressStore } from '../../../sim/social/progress/store'
import type { RawStorage } from '../../../sim/social/progress/storage'
import { restingFiring } from '../../../sim/social/mirror/schedule'
import { DT } from '../contract'
import { MirrorStore } from './store'
import { STEPS, type Step } from './steps'
import { TestLines, Traces, WeightTable } from './RecordingPanel'

/**
 * Part 6 (spec §13 item 1, §16): every step opens on an instruction screen
 * and asks its prediction first; before learning neither cell responds to
 * watching; the live loop reproduces the headless steps' directions; the
 * test runs with learning off; the recording panel reads the cells.
 */

function memoryStorage(): RawStorage {
  let text: string | null = null
  return { read: () => text, write: (t) => ((text = t), true) }
}
function fresh(seed = 5) {
  const progress = new ProgressStore(memoryStorage(), seed)
  return { store: new MirrorStore(seed, progress), progress }
}
function commitAll(store: MirrorStore, step: Step) {
  for (const p of STEPS[step - 1].predictions) store.choose(p.key, p.choices[0])
  store.commitPredictions()
}
/** Advance the live loop by seconds. */
function run(store: MirrorStore, seconds: number) {
  for (let t = 0; t < seconds; t += DT) store.tick(DT)
}
function runTest(store: MirrorStore) {
  store.runTest()
  expect(store.testing).not.toBeNull()
  run(store, store.testSecondsLeft + 0.5)
  expect(store.testing).toBeNull()
  return store.testResults[store.step]!
}
const rest = restingFiring()

describe('the steps', () => {
  it('each step opens on its instruction screen, asks its prediction, and runs nothing before the commit', () => {
    const { store } = fresh()
    for (const st of STEPS) {
      store.open(st.step)
      expect(store.state).toBe('intro')
      store.begin()
      expect(store.state).toBe('predict')
      expect(store.grasp('precision')).toBe(false)
      commitAll(store, st.step)
      expect(store.state).toBe('running')
    }
  })
  it('Step 1: a few own grasps, then the test shows no response to watching; the across weights stay exactly zero', () => {
    const { store } = fresh(7)
    store.open(1)
    store.begin()
    commitAll(store, 1)
    for (let i = 0; i < 4; i++) {
      expect(store.grasp(i % 2 ? 'precision' : 'wholeHand')).toBe(true)
      expect(store.grasp('precision')).toBe(false) // one at a time
      run(store, 2.5)
    }
    expect(store.graspsThisStep).toBe(4)
    const r = runTest(store)
    expect(r.precisionCell.toPrecision).toBeCloseTo(rest, 2)
    expect(r.wholeHandCell.toWholeHand).toBeCloseTo(rest, 2)
    expect(store.cells.precision.unit.weights[2]).toBe(0)
    expect(store.cells.wholeHand.unit.weights[3]).toBe(0)
  })
  it('Step 2: 40 copied grasps by Run 40 grasps give each cell a response to its own grasp seen from across; Step 3 at random stays weak; Step 4 reverses from Step 2’s cells', () => {
    const { store } = fresh(11)
    store.open(2)
    store.begin()
    commitAll(store, 2)
    store.runForty()
    expect(store.autoLeft).toBe(40)
    run(store, 40 * 2.7 + 3)
    expect(store.autoLeft).toBe(0)
    expect(store.graspsThisStep).toBe(40)
    const r2 = runTest(store)
    expect(r2.precisionCell.toPrecision).toBeGreaterThan(rest + 0.3)
    expect(r2.wholeHandCell.toWholeHand).toBeGreaterThan(rest + 0.3)
    expect(r2.precisionCell.toWholeHand).toBeLessThan(rest + 0.1)
    store.finish()
    expect(store.afterStep2).not.toBeNull()
    store.open(3)
    store.begin()
    commitAll(store, 3)
    store.resetCells()
    expect(store.cells.table().flat().every((w) => w === 0)).toBe(true)
    store.runForty()
    run(store, 40 * 2.7 + 3)
    const r3 = runTest(store)
    expect((r3.precisionCell.toPrecision + r3.wholeHandCell.toWholeHand) / 2).toBeLessThan((r2.precisionCell.toPrecision + r2.wholeHandCell.toWholeHand) / 2 - 0.3)
    store.open(4)
    const t4 = store.cells.table().flat()
    store.afterStep2!.table().flat().forEach((w, i) => expect(t4[i]).toBeCloseTo(w, 9))
    store.begin()
    commitAll(store, 4)
    store.runForty()
    run(store, 40 * 2.7 + 3)
    const r4 = runTest(store)
    expect(r4.precisionCell.toWholeHand).toBeGreaterThan(r4.precisionCell.toPrecision + 0.3)
    expect(r4.wholeHandCell.toPrecision).toBeGreaterThan(r4.wholeHandCell.toWholeHand + 0.3)
  })
  it('during the test learning is off and the student’s grasps are refused', () => {
    const { store } = fresh(3)
    store.open(2)
    store.begin()
    commitAll(store, 2)
    store.grasp('precision')
    run(store, 2)
    const before = store.cells.table()
    store.runTest()
    expect(store.grasp('precision')).toBe(false)
    run(store, 5)
    expect(store.cells.table()).toEqual(before)
  })
  it('the recording panel renders the traces with marks, the weights and the test', () => {
    const { store } = fresh(4)
    store.open(2)
    store.begin()
    commitAll(store, 2)
    store.grasp('wholeHand')
    run(store, 3)
    const m = renderToStaticMarkup(<Traces trace={store.trace} marks={store.marks} now={store.time} />)
    expect(m).toMatch(/data-mark="you-wholeHand"/)
    expect(m).toMatch(/data-mark="other-wholeHand"/)
    expect(renderToStaticMarkup(<WeightTable cells={store.cells} />)).toMatch(/data-lines="weights"/)
    expect(renderToStaticMarkup(<TestLines result={null} rest={rest} />)).toMatch(/No test run yet/)
  })
})
