import { describe, it, expect } from 'vitest'
import fixtures from './fixtures/drawing_net.json'
import fixturesB from './fixtures/drawing_net_b.json'
import { loadShippedModel } from './loadModels.node'
import { chw, classify, run, topK, weightsHash } from './net'
import { normalize, rasterize, type Drawing } from './raster'

/**
 * The browser agrees with Python (spec §11): on 50 held-out drawings the
 * runtime's top label matches PyTorch's every time and the probabilities
 * agree to within 0.01; and every layer's activity agrees closely, since
 * the layer strip shows it.
 */
interface Case { category: string; strokes: Drawing; probs: number[]; top: number; layers?: number[][] }
const cases = (fixtures as unknown as { cases: Case[] }).cases
const model = loadShippedModel('drawing')
const casesB = (fixturesB as unknown as { cases: Case[] }).cases
const modelB = loadShippedModel('drawing_b')

describe('the drawing network runs here as it ran in Python', () => {
  it('loads with 24 labels and a 64 × 64 input', () => {
    expect(model.desc.labels.length).toBe(24)
    expect(model.desc.input.size).toBe(64)
    expect(model.desc.layers?.length).toBe(4)
  })

  it('gives the same top label on every one of the fixed inputs, and probabilities within 0.01', () => {
    expect(cases.length).toBeGreaterThanOrEqual(48)
    let worst = 0
    for (const c of cases) {
      const out = classify(model, rasterize(normalize(c.strokes)))
      expect(out.top, c.category).toBe(c.top)
      for (let i = 0; i < c.probs.length; i++) worst = Math.max(worst, Math.abs(out.probs[i] - c.probs[i]))
    }
    expect(worst).toBeLessThan(0.01)
    expect(worst).toBeLessThan(1e-4)
  })

  it('every layer’s activity agrees with Python to 1e-4', () => {
    for (const c of cases.filter((x) => x.layers)) {
      const t = run(model, rasterize(normalize(c.strokes)))
      model.desc.layers!.forEach((layer, i) => {
        const here = chw(t.get(layer.pooled)!)
        const there = c.layers![i]
        expect(here.length).toBe(there.length)
        let worst = 0
        for (let j = 0; j < here.length; j++) worst = Math.max(worst, Math.abs(here[j] - there[j]))
        expect(worst, `${c.category} ${layer.pooled}`).toBeLessThan(1e-4)
      })
    }
  })

  it('names the right category for most of the fixed inputs (the model’s own accuracy)', () => {
    let right = 0
    for (const c of cases) if (model.desc.labels[c.top] === c.category) right++
    expect(right / cases.length).toBeGreaterThan(0.85)
  })

  it('topK orders labels by probability', () => {
    const out = classify(model, rasterize(normalize(cases[0].strokes)))
    const k = topK(out.probs, 5)
    expect(k.length).toBe(5)
    for (let i = 1; i < k.length; i++) expect(k[i - 1].p).toBeGreaterThanOrEqual(k[i].p)
    expect(k[0].label).toBe(out.top)
  })

  it('one inference is fast enough for a live label after each stroke', () => {
    const img = rasterize(normalize(cases[0].strokes))
    classify(model, img)
    const t0 = performance.now()
    for (let i = 0; i < 10; i++) classify(model, img)
    const ms = (performance.now() - t0) / 10
    // 300 ms under a 4× throttle means 75 ms here.
    expect(ms).toBeLessThan(75)
  })

  it('Version B agrees with Python too', () => {
    let worst = 0
    for (const c of casesB) {
      const out = classify(modelB, rasterize(normalize(c.strokes)))
      expect(out.top, c.category).toBe(c.top)
      for (let i = 0; i < c.probs.length; i++) worst = Math.max(worst, Math.abs(out.probs[i] - c.probs[i]))
    }
    expect(worst).toBeLessThan(1e-4)
  })

  it('running the model changes no weight', () => {
    const before = weightsHash(model)
    for (const c of cases.slice(0, 5)) classify(model, rasterize(normalize(c.strokes)))
    expect(weightsHash(model)).toBe(before)
  })
})
