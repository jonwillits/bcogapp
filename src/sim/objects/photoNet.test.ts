import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import standard from './fixtures/photo_standard.json'
import noise from './fixtures/photo_noise.json'
import blur from './fixtures/photo_blur.json'
import { loadShippedModel } from './loadModels.node'
import { classify, penultimate, run, weightsHash } from './net'
import { decodeGrayPng } from './png.node'

/**
 * The browser agrees with Python for each photo network (spec §11): on 50
 * of the shipped photographs, decoded from the same PNG files, the top
 * label matches every time and the probabilities agree to within 0.01. The
 * penultimate layer, the readout's input, agrees too.
 */
interface Case { file: string; category: string; probs: number[]; top: number; penultimate?: number[] }
const PHOTOS = join(__dirname, '..', '..', '..', 'public', 'm08', 'photos')
const image = (file: string) => decodeGrayPng(readFileSync(join(PHOTOS, file))).data

const fixtures = [standard, noise, blur] as unknown as { model: string; cases: Case[] }[]

describe.each(fixtures)('$model runs here as it ran in Python', ({ model: name, cases }) => {
  const model = loadShippedModel(name)

  it('loads with 16 labels and a 160 × 160 grayscale input', () => {
    expect(model.desc.labels.length).toBe(16)
    expect(model.desc.input.size).toBe(160)
    expect(model.desc.input.channels).toBe(1)
    expect(cases.length).toBe(50)
  })

  it('gives the same top label on every fixed input, and probabilities within 0.01', () => {
    let worst = 0
    for (const c of cases) {
      const img = image(c.file)
      expect(img.length).toBe(160 * 160)
      const out = classify(model, img)
      expect(out.top, c.file).toBe(c.top)
      for (let i = 0; i < 16; i++) worst = Math.max(worst, Math.abs(out.probs[i] - c.probs[i]))
    }
    expect(worst).toBeLessThan(0.01)
  })

  it('the penultimate layer agrees to 1e-2 on every unit (1024 of them)', () => {
    for (const c of cases.filter((x) => x.penultimate)) {
      const here = penultimate(model, image(c.file))
      expect(here.length).toBe(1024)
      let worst = 0
      for (let i = 0; i < here.length; i++) worst = Math.max(worst, Math.abs(here[i] - c.penultimate![i]))
      expect(worst, c.file).toBeLessThan(1e-2)
    }
  })

  it('running the model changes no weight', () => {
    const before = weightsHash(model)
    for (const c of cases.slice(0, 3)) classify(model, image(c.file))
    expect(weightsHash(model)).toBe(before)
  })
})

describe('speed', () => {
  it('one photo inference is under 75 ms here (300 ms under a 4× throttle)', () => {
    const model = loadShippedModel('photo_standard')
    const img = image(standard.cases[0].file)
    classify(model, img)
    const t0 = performance.now()
    for (let i = 0; i < 5; i++) classify(model, img)
    const ms = (performance.now() - t0) / 5
    const profile = new Map<string, number>()
    for (let i = 0; i < 5; i++) run(model, img, undefined, profile)
    console.log(`photo inference ${ms.toFixed(1)} ms`, JSON.stringify(Object.fromEntries([...profile].map(([k, v]) => [k, +(v / 5).toFixed(1)]))))
    expect(ms).toBeLessThan(75)
  })
})
