import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { makeRng } from '../random'
import { loadShippedModel } from './loadModels.node'
import { classify, penultimate, weightsHash } from './net'
import { decodeGrayPng } from './png.node'
import { normalize, rasterize, type Drawing } from './raster'
import { makeReadout, readoutLearn, readoutSays } from './readout'
import display from '../../../public/m08/drawings/display.json'

/**
 * Nothing a student does changes a shipped model (spec §3.5, §9.1): every
 * model's weights hash the same before and after a scripted session that
 * runs every kind of inference the scene runs, and trains the readout on
 * the Standard network's features for hundreds of steps.
 */
const PUB = join(__dirname, '..', '..', '..', 'public', 'm08')
const NAMES = ['drawing', 'drawing_b', 'photo_standard', 'photo_noise', 'photo_blur'] as const

describe('every shipped model hashes the same before and after a scripted session', () => {
  it('runs the session', () => {
    const models = Object.fromEntries(NAMES.map((n) => [n, loadShippedModel(n)]))
    const before = Object.fromEntries(NAMES.map((n) => [n, weightsHash(models[n])]))
    const drawings = (display as unknown as { drawings: { strokes: Drawing }[] }).drawings.slice(0, 6)
    for (const d of drawings) { classify(models.drawing, rasterize(normalize(d.strokes))); classify(models.drawing_b, rasterize(normalize(d.strokes))) }
    const photo = decodeGrayPng(readFileSync(join(PUB, 'photos', 'cat', readdirFirst('cat')))).data
    for (const n of ['photo_standard', 'photo_noise', 'photo_blur'] as const) classify(models[n], photo)
    const f1 = penultimate(models.photo_standard, decodeGrayPng(readFileSync(join(PUB, 'scanned', 'shoe00', 'h000.png'))).data)
    const f0 = penultimate(models.photo_standard, decodeGrayPng(readFileSync(join(PUB, 'scanned', 'shoe01', 'h000.png'))).data)
    const rng = makeRng(3)
    const unit = makeReadout(rng)
    for (let i = 0; i < 300; i++) readoutLearn(unit, rng.next() < 0.5 ? f1 : f0, rng.next() < 0.5 ? 1 : 0, 0.05)
    readoutSays(unit, f1)
    for (const n of NAMES) expect(weightsHash(models[n]), n).toBe(before[n])
  })
})

function readdirFirst(cat: string): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require('node:fs') as typeof import('node:fs')
  return fs.readdirSync(join(PUB, 'photos', cat)).find((f) => f.endsWith('.png'))!
}
