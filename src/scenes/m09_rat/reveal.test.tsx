import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { HomeStore } from './homeStore'
import { HomeLeft, HomeRight } from './HomeTab'
import { RatsStore } from './ratsStore'
import { RatsLeft, RatsRight } from './RatsTab'
import { CellsStore } from './cellsStore'
import { CellsLeft } from './CellsTab'
import { PatchStore } from './patchStore'
import { PatchRight } from './PatchTab'
import { RATS } from '../../sim/rodent/rats'
import { RANGE } from '../../sim/rodent/range'
import { DT } from '../../sim/rodent/homing'

/**
 * Commit-then-reveal, tested on rendered markup (spec §12, item 3, and
 * §14): no true nest position or error before Commit my trials; no rat's
 * strategy before Commit my diagnoses; no result before Commit my
 * prediction. And the overhead inset is hidden in Part 1 until the commit
 * (§12, item 7).
 */

/** A Part 1 block driven to the end of its trials by a scripted forager. */
function drivenToCommit(block: 'dark' | 'moved'): HomeStore {
  const s = new HomeStore(21)
  // Open the block directly: practice first, then the block.
  while (s.block !== block) {
    s.begin()
    for (let guard = 0; guard < 60000 && s.state === 'trials'; guard++) {
      const t = s.trial!
      const target = t.currentBeetle ?? RANGE.nest
      const want = Math.atan2(target.y - t.body.y, target.x - t.body.x)
      const d = ((want - t.body.heading + 3 * Math.PI) % (2 * Math.PI)) - Math.PI
      s.step(DT, { forward: Math.abs(d) < 0.5 ? 1 : 0, turn: d > 0.05 ? 1 : d < -0.05 ? -1 : 0 })
      if (t.phase === 'return' && t.blackout <= 0 && Math.hypot(t.body.x - target.x, t.body.y - target.y) < 0.6) s.here()
    }
    s.commit()
    s.goOn()
  }
  s.begin()
  for (let guard = 0; guard < 120000 && s.state === 'trials'; guard++) {
    const t = s.trial!
    const target = t.currentBeetle ?? { x: RANGE.nest.x + 2, y: RANGE.nest.y + 1 }
    const want = Math.atan2(target.y - t.body.y, target.x - t.body.x)
    const d = ((want - t.body.heading + 3 * Math.PI) % (2 * Math.PI)) - Math.PI
    s.step(DT, { forward: Math.abs(d) < 0.5 ? 1 : 0, turn: d > 0.05 ? 1 : d < -0.05 ? -1 : 0 })
    if (t.phase === 'return' && t.blackout <= 0 && Math.hypot(t.body.x - target.x, t.body.y - target.y) < 0.6) s.here()
  }
  return s
}

describe('Part 1: nothing about the nest before Commit my trials', () => {
  const s = drivenToCommit('dark')
  const beforeLeft = renderToStaticMarkup(<HomeLeft store={s} header={null} />)
  const beforeRight = renderToStaticMarkup(<HomeRight store={s} />)

  it('before: a Commit button; no overhead inset, no nest, no endpoint, no error, no navigator', () => {
    expect(s.state).toBe('awaiting-commit')
    expect(beforeLeft).toContain('Commit my trials')
    for (const m of [beforeLeft, beforeRight]) {
      expect(m).not.toMatch(/data-overhead/)
      expect(m).not.toMatch(/data-nest/)
      expect(m).not.toMatch(/data-endpoint/)
      expect(m).not.toMatch(/Error from the nest/)
      expect(m).not.toMatch(/Running sum only|Landmarks only|Averaging|Following one/)
      expect(m).not.toMatch(/data-reveal/)
    }
  })

  it('after: the overhead inset for every trial, the nest, each endpoint and error, and the four navigators', () => {
    s.commit()
    const after = renderToStaticMarkup(<HomeRight store={s} />)
    expect((after.match(/data-overhead/g) ?? []).length).toBe(6)
    expect((after.match(/data-nest/g) ?? []).length).toBe(6)
    expect(after).toMatch(/Error from the nest/)
    expect(after).toMatch(/Running sum only/)
    expect(after).toMatch(/Following one/)
    expect(after).toMatch(/These navigators are programs given the same trips/)
    expect(after).toMatch(/Error against the length of the outward path/)
  })

  it('while a trial runs, the status lines give the count, the beetles taken, the phase and the light, and no position', () => {
    const t = new HomeStore(22)
    t.begin()
    for (let i = 0; i < 100; i++) t.step(DT, { forward: 1, turn: 0 })
    const m = renderToStaticMarkup(<HomeLeft store={t} header={null} />)
    expect(m).toContain('Trial 1 of 2')
    expect(m).toContain('Beetles taken 0 of 1')
    expect(m).toContain('Here is my nest')
    expect(m).not.toMatch(/data-overhead|Error from the nest/)
  })

  it('the moved block: no score on the 0-to-1 line before the commit, and one per moved trial after', () => {
    const m = drivenToCommit('moved')
    expect(m.state).toBe('awaiting-commit')
    const before = renderToStaticMarkup(<HomeRight store={m} />)
    expect(before).not.toMatch(/conflict score line|your score on the line/)
    m.commit()
    const after = renderToStaticMarkup(<HomeRight store={m} />)
    expect((after.match(/aria-label="conflict score line"/g) ?? []).length).toBe(4)
    expect(after).toMatch(/Score on the line/)
  })
})

describe('Part 2: no rat’s strategy before Commit my diagnoses', () => {
  const s = new RatsStore(5)
  s.run()
  s.skipToResult()
  const before = renderToStaticMarkup(<RatsRight store={s} />)
  const left = renderToStaticMarkup(<RatsLeft store={s} header={null} />)

  it('before: the result lines, the hidden rats marked hidden, and no reveal text for any hidden rat', () => {
    expect(before).toMatch(/data-lines="result-lines"/)
    for (const r of RATS.filter((x) => x.hidden)) {
      expect(before).not.toContain(r.reveal)
      expect(before).not.toMatch(new RegExp(`data-revealed="${r.id}"`))
    }
    expect(before).toContain(RATS[0].reveal)
    expect((before.match(/hidden until the commit/g) ?? []).length).toBe(6)
    expect(left).toContain('Commit my diagnoses')
    expect(left).toMatch(/disabled/)
  })

  it('after the commit and a Reveal, that rat’s strategy and line appear, and only that rat’s', () => {
    for (const r of RATS.filter((x) => x.hidden)) s.diagnose(r.id, 'map')
    expect(s.canCommit).toBe(true)
    s.commit()
    const committed = renderToStaticMarkup(<RatsRight store={s} />)
    expect(committed).toMatch(/>Reveal</)
    for (const r of RATS.filter((x) => x.hidden)) expect(committed).not.toContain(r.reveal)
    s.reveal('R1')
    const revealed = renderToStaticMarkup(<RatsRight store={s} />)
    expect(revealed).toContain(RATS[1].reveal)
    expect(revealed).toMatch(/data-revealed="R1"/)
    expect(revealed).not.toContain(RATS[2].reveal)
  })
})

describe('Part 3: no result before Commit my prediction', () => {
  it('a step that changes something asks first, and prints its result only after the commit', () => {
    const s = new CellsStore(9)
    s.begin()
    s.session.exploring = true
    s.session.run(30)
    s.finishStep()
    s.open(2)
    s.begin()
    expect(s.state).toBe('predict')
    const before = renderToStaticMarkup(<CellsLeft store={s} header={null} />)
    expect(before).toMatch(/data-predict/)
    expect(before).toContain('Commit my prediction')
    expect(before).not.toMatch(/Lights: /)
    expect(before).not.toMatch(/Your prediction/)
    expect(s.session.lit).toBe(true)
    s.choose('they smear and drift')
    s.commitPrediction()
    expect(s.session.lit).toBe(false)
    const after = renderToStaticMarkup(<CellsLeft store={s} header={null} />)
    expect(after).toContain('Your prediction: they smear and drift')
    expect(after).toMatch(/Lights: off/)
  })

  it('Step 1 has no prediction and opens straight into driving; any step can be opened, a finished one reopens to its result, and Redo opens it again', () => {
    const s = new CellsStore(3)
    expect(s.canOpen(2)).toBe(true)
    s.begin()
    expect(s.state).toBe('running')
    s.finishStep()
    expect(s.state).toBe('done')
    s.open(3)
    expect(s.state).toBe('intro')
    s.open(1)
    expect(s.state).toBe('done')
    s.redo()
    expect(s.state).toBe('intro')
  })
})

describe('the closer: the answer only after Commit my prediction', () => {
  it('before: no answer line; after: the prediction and the answer', () => {
    const s = new PatchStore(4)
    const before = renderToStaticMarkup(<PatchRight store={s} />)
    expect(before).not.toMatch(/data-lines="answer"/)
    s.predict('rich')
    s.commit()
    const after = renderToStaticMarkup(<PatchRight store={s} />)
    expect(after).toMatch(/data-lines="answer"/)
    expect(after).toContain('Your prediction: the rich habitat')
  })
})
