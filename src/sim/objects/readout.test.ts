import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { makeRng } from '../random'
import { emptyCounts, tally } from '../fish/sdt'
import { loadShippedModel } from './loadModels.node'
import { penultimate } from './net'
import { decodeGrayPng } from './png.node'
import { makeReadout, readoutLearn, readoutSays, DEFAULT_READOUT_RATE, READOUT_INPUTS } from './readout'
import { CONDITIONS, LEARNED_VIEWS, WOBBLE_FRAMES, viewTrials } from './views'

/**
 * The readout is Lab 7's output unit learning by Lab 5's rule, on the
 * frozen Standard network's penultimate layer (spec §1, §6.3, §11): it
 * reaches 95% on its training images within 500 steps, and it takes the
 * matched-distance test. One shape: every change is η · xᵢ · Φ through
 * `thirdFactor` and `learnWeights` (the structural half is in
 * `oneWriter.test.ts` below).
 */
const SCANNED = join(__dirname, '..', '..', '..', 'public', 'm08', 'scanned')
const manifest = JSON.parse(readFileSync(join(SCANNED, 'manifest.json'), 'utf-8')) as { objects: { id: string; set: string }[] }

describe('the readout on one target shoe', () => {
  const model = loadShippedModel('photo_standard')
  const feats = new Map<string, Float32Array>()
  const feat = (o: string, v: string) => {
    const k = `${o}/${v}`
    if (!feats.has(k)) feats.set(k, penultimate(model, decodeGrayPng(readFileSync(join(SCANNED, o, `${v}.png`))).data))
    return feats.get(k)!
  }
  const shoes = manifest.objects.filter((o) => o.set === 'shoe').map((o) => o.id)
  const target = shoes[5]
  const others = shoes.filter((s) => s !== target)

  it('its inputs are the 1,024 units of the penultimate layer', () => {
    expect(feat(target, 'h000').length).toBe(READOUT_INPUTS)
  })

  it('reaches 95% on its training images within 500 steps, and then takes the test', () => {
    const rng = makeRng(1000)
    const unit = makeReadout(rng)
    const train: { x: Float32Array; a: 0 | 1 }[] = []
    for (const lv of LEARNED_VIEWS) for (const f of WOBBLE_FRAMES[lv]) { train.push({ x: feat(target, f), a: 1 }); for (const o of others) train.push({ x: feat(o, f), a: 0 }) }
    let reached = -1
    for (let step = 1; step <= 500; step++) {
      const ex = train[rng.int(train.length)]
      const r = readoutLearn(unit, ex.x, ex.a, DEFAULT_READOUT_RATE)
      expect(Number.isFinite(r.phi)).toBe(true)
      if (step % 10 === 0 && train.filter((e) => readoutSays(unit, e.x) === (e.a === 1)).length / train.length >= 0.95) { reached = step; break }
    }
    expect(reached).toBeGreaterThan(0)
    expect(reached).toBeLessThanOrEqual(500)
    const trials = viewTrials(target, others, rng)
    for (const c of CONDITIONS) {
      const counts = emptyCounts()
      for (const t of trials.filter((x) => x.condition === c)) tally(counts, t.target, readoutSays(unit, feat(t.object, t.view.id)))
      expect(counts.hits + counts.misses).toBe(4)
      expect(counts.falseAlarms + counts.correctRejections).toBe(4)
    }
  })

  it('the criterion is never written by learning', () => {
    const rng = makeRng(2)
    const unit = makeReadout(rng)
    unit.threshold = 0.7
    for (let i = 0; i < 50; i++) readoutLearn(unit, feat(target, 'h000'), 1, 0.05)
    expect(unit.threshold).toBe(0.7)
  })
})
