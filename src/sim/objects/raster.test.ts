import { describe, it, expect } from 'vitest'
import fixtures from './fixtures/raster.json'
import { normalize, rasterize, strokeLength, transform, type Drawing, SIZE } from './raster'

/**
 * The TypeScript rasterizer agrees with the Python one (spec §11): the
 * fixtures were rasterized by `training/m08/raster.py`, and every pixel
 * must match, under the dataset's normalization and under the shift, turn
 * and shrink transforms the Draw tab applies.
 */

interface Case {
  category: string
  strokes: Drawing
  length: number
  rasters: Record<string, string>
  variants: Record<string, Drawing>
}
const cases = (fixtures as { size: number; cases: Case[] }).cases

const toBits = (img: Float32Array) => Array.from(img, (v) => (v ? '1' : '0')).join('')

describe('the rasterizer agrees with Python pixel for pixel', () => {
  it('has the fixtures, at the shared size', () => {
    expect((fixtures as { size: number }).size).toBe(SIZE)
    expect(cases.length).toBeGreaterThanOrEqual(12)
  })

  it('on raw strokes', () => {
    for (const c of cases) expect(toBits(rasterize(c.strokes)), c.category).toBe(c.rasters.raw)
  })

  it('after the dataset’s own normalization, computed here', () => {
    for (const c of cases) expect(toBits(rasterize(normalize(c.strokes))), c.category).toBe(c.rasters.normalized)
  })

  it('under a shift, a 45° turn, a 180° turn and a shrink into the corner, each computed here', () => {
    for (const c of cases) {
      const n = normalize(c.strokes)
      expect(toBits(rasterize(transform(n, { dx: 4 / ((SIZE - 8) / 255.0) }))), `${c.category} shift`).toBe(c.rasters.shift4)
      expect(toBits(rasterize(transform(n, { angleDeg: 45 }))), `${c.category} turn45`).toBe(c.rasters.turn45)
      expect(toBits(rasterize(transform(n, { angleDeg: 180 }))), `${c.category} turn180`).toBe(c.rasters.turn180)
      expect(toBits(rasterize(transform(n, { scale: 0.4, dx: -70, dy: -70 }))), `${c.category} small`).toBe(c.rasters.small)
    }
  })

  it('the transformed vectors themselves agree to 1e-9', () => {
    for (const c of cases) {
      const n = normalize(c.strokes)
      const here = transform(n, { angleDeg: 45 })
      const there = c.variants.turn45
      for (let s = 0; s < here.length; s++) for (let i = 0; i < here[s][0].length; i++) {
        expect(Math.abs(here[s][0][i] - there[s][0][i])).toBeLessThan(1e-9)
        expect(Math.abs(here[s][1][i] - there[s][1][i])).toBeLessThan(1e-9)
      }
    }
  })

  it('stroke length agrees', () => {
    for (const c of cases) expect(Math.abs(strokeLength(c.strokes) - c.length)).toBeLessThan(1e-9)
  })

  it('a drawing covers some but not most of the image', () => {
    for (const c of cases) {
      const img = rasterize(normalize(c.strokes))
      let ink = 0
      for (const v of img) ink += v
      expect(ink).toBeGreaterThan(20)
      expect(ink).toBeLessThan(SIZE * SIZE * 0.5)
    }
  })
})
