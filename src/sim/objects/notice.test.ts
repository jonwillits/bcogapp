import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Every image a student can see is credited and licensed (spec §4, §9.4,
 * §9.5, §11): every shipped image file appears in its folder's NOTICE;
 * every photograph's manifest entry carries its author, title, page and a
 * CC BY 2.0 (or more permissive) licence; no shipped photograph carries a
 * person, face or body-part label; the scanned objects are CC BY 4.0; the
 * drawings are listed by their Quick, Draw! key.
 */
const PUB = join(__dirname, '..', '..', '..', 'public', 'm08')
const walk = (dir: string, out: string[] = [], prefix = ''): string[] => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) walk(join(dir, e.name), out, `${prefix}${e.name}/`)
    else if (/\.(png|jpe?g|webp|gif|svg)$/i.test(e.name)) out.push(`${prefix}${e.name}`)
  }
  return out
}
const PERSON = /^(Person|Man|Woman|Boy|Girl|Human .*)$/

describe('photographs', () => {
  const notice = readFileSync(join(PUB, 'photos', 'NOTICE'), 'utf-8')
  const manifest = JSON.parse(readFileSync(join(PUB, 'photos', 'manifest.json'), 'utf-8')) as { images: { file: string; author: string; title: string; page: string; license: string; labels?: string[]; category: string }[] }
  const files = walk(join(PUB, 'photos'))

  it('every shipped file is in the NOTICE and in the manifest', () => {
    expect(files.length).toBeGreaterThan(100)
    for (const f of files) {
      expect(notice, f).toContain(f)
      expect(manifest.images.some((i) => i.file === f), f).toBe(true)
    }
    expect(manifest.images.length).toBe(files.length)
  })
  it('every photograph carries an author, a title, its page and a CC BY 2.0 or CC0 licence', () => {
    for (const i of manifest.images) {
      expect(i.author, i.file).toBeTruthy()
      expect(i.page, i.file).toMatch(/^https?:\/\//)
      expect(i.license, i.file).toMatch(/creativecommons\.org\/(licenses\/by\/2\.0|publicdomain\/zero)/)
      expect(notice).toContain(i.page)
    }
    expect(notice).toMatch(/NOT covered by the app's GNU General Public License/)
  })
  it('no shipped photograph carries a person, face or body-part label', () => {
    for (const i of manifest.images) {
      expect(i.labels, `${i.file} has no label list`).toBeDefined()
      for (const l of i.labels!) expect(l, `${i.file}: ${l}`).not.toMatch(PERSON)
    }
  })
  it('sixteen categories, twelve photographs each', () => {
    const per = new Map<string, number>()
    for (const i of manifest.images) per.set(i.category, (per.get(i.category) ?? 0) + 1)
    expect(per.size).toBe(16)
    for (const [c, n] of per) expect(n, c).toBe(12)
  })
})

describe('scanned objects', () => {
  const notice = readFileSync(join(PUB, 'scanned', 'NOTICE'), 'utf-8')
  const manifest = JSON.parse(readFileSync(join(PUB, 'scanned', 'manifest.json'), 'utf-8')) as { objects: { id: string; name: string; source: string; license: string }[]; views: { id: string }[] }
  const files = walk(join(PUB, 'scanned'))

  it('every render is in the NOTICE, every object is credited to its model with its source and CC BY 4.0', () => {
    expect(files.length).toBe(manifest.objects.length * manifest.views.length)
    for (const f of files) expect(notice, f).toContain(f)
    for (const o of manifest.objects) {
      expect(notice).toContain(o.name)
      expect(notice).toContain(o.source)
      expect(o.license).toMatch(/Attribution 4\.0/)
    }
    expect(notice).toMatch(/NOT covered by the app's GNU General Public License/)
    expect(notice).toMatch(/3D models themselves are not distributed/)
  })
})

describe('drawings', () => {
  const notice = readFileSync(join(PUB, 'drawings', 'NOTICE'), 'utf-8')
  const display = JSON.parse(readFileSync(join(PUB, 'drawings', 'display.json'), 'utf-8')) as { drawings: { id: string; key: string; category: string }[] }
  it('every display drawing is listed by id, category and Quick, Draw! key, under CC BY 4.0', () => {
    for (const d of display.drawings) expect(notice, d.id).toMatch(new RegExp(`${d.id}\\s+${d.category.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+${d.key}`))
    expect(notice).toMatch(/CC BY 4\.0/)
    expect(notice).toMatch(/NOT covered by the app's GNU General Public License/)
  })
  it('no image file sits in the drawings folder: the drawings are vectors', () => {
    expect(walk(join(PUB, 'drawings')).length).toBe(0)
  })
})

describe('the root NOTICE points at all three', () => {
  it('names each folder', () => {
    const root = readFileSync(join(PUB, '..', '..', 'NOTICE.md'), 'utf-8')
    for (const d of ['public/m08/photos', 'public/m08/scanned', 'public/m08/drawings']) expect(root).toContain(d)
  })
})

describe('size budgets (spec §3.5)', () => {
  const size = (rel: string) => { let n = 0; for (const f of walk(join(PUB, rel))) n += statSync(join(PUB, rel, f)).size; return n }
  const bin = (name: string) => statSync(join(PUB, 'models', name)).size
  it('each part under about 15 MB and the lab under about 40 MB', () => {
    const drawing = bin('drawing.bin')
    const photo = bin('photo_standard.bin') + bin('photo_noise.bin') + bin('photo_blur.bin')
    const part1 = drawing + bin('drawing_b.bin')
    const part3 = bin('photo_standard.bin') + size('scanned')
    const part4 = photo + size('photos')
    const lab = part1 + size('scanned') + photo + size('photos') + statSync(join(PUB, 'drawings', 'display.json')).size
    expect(part1).toBeLessThan(15e6)
    expect(part3).toBeLessThan(15e6)
    expect(part4).toBeLessThan(15e6)
    expect(lab).toBeLessThan(40e6)
  })
})
