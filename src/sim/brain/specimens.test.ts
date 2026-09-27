import { describe, it, expect } from 'vitest'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cmPerPx, drawnSizePx, trueSizeCm, shuffledOrder, matchingList, score, allNamed, defaultView, type Manifest, type Specimen } from './specimens'

/** The manifest, true-scale and grayscale tests of the spec's §11, on the shipped files. */

const DIR = join(__dirname, '..', '..', '..', 'public', 'm06', 'specimens')
const manifest: Manifest = JSON.parse(readFileSync(join(DIR, 'manifest.json'), 'utf-8'))
const specimens = manifest.specimens

/** Files that were considered in the sourcing folder and must never ship (spec §5.3). */
const MUST_NOT_SHIP = [/\.pdf$/i, /^ChatGPT/i, /^Shark_brain/i, /generated/i, /engraving/i]

describe('the manifest', () => {
  it('lists at least eight specimens, each with a credit, a licence, a source URL and a crop box', () => {
    expect(specimens.length).toBeGreaterThanOrEqual(8)
    for (const s of specimens) {
      expect(s.credit.length, s.id).toBeGreaterThan(40)
      expect(s.credit, s.id).not.toMatch(/PLACEHOLDER/)
      expect(s.licence.length, s.id).toBeGreaterThan(10)
      expect(s.source, s.id).toMatch(/^https:\/\//)
      expect(s.views.length, s.id).toBeGreaterThan(0)
      for (const v of s.views) {
        expect(v.box.length).toBe(4)
        expect(v.box[2]).toBeGreaterThan(v.box[0])
        expect(v.box[3]).toBeGreaterThan(v.box[1])
        expect(existsSync(join(DIR, v.derived)), `${s.id} ${v.derived}`).toBe(true)
      }
      expect(existsSync(join(DIR, s.file)), s.file).toBe(true)
    }
  })

  it('every image file in the folder is listed, and none is a PDF, a drawing or a generated image', () => {
    const files = readdirSync(DIR).filter((f) => !f.startsWith('.') && f !== 'manifest.json' && f !== 'NOTICE' && f !== 'derived')
    const listed = new Set(specimens.map((s) => s.file))
    for (const f of files) {
      expect(listed.has(f), `unlisted file ${f}`).toBe(true)
      for (const bad of MUST_NOT_SHIP) expect(f, f).not.toMatch(bad)
    }
    const derived = readdirSync(join(DIR, 'derived'))
    const listedDerived = new Set(specimens.flatMap((s) => s.views.map((v) => v.derived.replace('derived/', ''))))
    for (const f of derived) expect(listedDerived.has(f), `unlisted derived ${f}`).toBe(true)
  })

  it('the CMBC mammals carry the collections’ requested attribution, and the kiwi its CC BY 2.5 licence', () => {
    for (const s of specimens) {
      if (s.source.includes('brainmuseum.org')) {
        expect(s.credit).toMatch(/University of Wisconsin and Michigan State Comparative Mammalian Brain Collections/)
        expect(s.credit).toMatch(/National Museum of Health and Medicine/)
        expect(s.credit).toMatch(/National Science Foundation/)
        expect(s.credit).toMatch(/National Institutes of Health/)
      }
      if (s.id === 'kiwi') {
        expect(s.licence).toMatch(/CC BY 2\.5/)
        expect(s.credit).toMatch(/Martin GR, Wilson K-J, Wild JM, Parsons S, Kubke MF, Corfield J/)
        expect(s.credit).toMatch(/cropped|grayscale/)
      }
    }
  })

  it('derived file names carry no species name', () => {
    for (const s of specimens) for (const v of s.views) expect(v.derived, s.id).toMatch(/^derived\/[0-9a-f]{10}\.png$/)
  })

  it('the NOTICE exists, names every file, and excludes them from the GPL', () => {
    const notice = readFileSync(join(DIR, 'NOTICE'), 'utf-8')
    for (const s of specimens) expect(notice, s.file).toContain(s.file)
    expect(notice).toMatch(/NOT covered by this repository's GPL/)
    expect(notice).toMatch(/Comparative Mammalian Brain Collections/)
    expect(notice).toMatch(/CC BY 2\.5/)
    const root = readFileSync(join(__dirname, '..', '..', '..', 'NOTICE.md'), 'utf-8')
    expect(root).toContain('public/m06/specimens/NOTICE')
  })
})

/** The first 29 bytes of a PNG: signature, IHDR length and type, width, height, bit depth, color type. */
function pngColorType(path: string): number {
  const b = readFileSync(path)
  expect(b.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
  expect(b.subarray(12, 16).toString()).toBe('IHDR')
  return b[25]
}

describe('grayscale', () => {
  it('every derived cutout is a grayscale PNG (color type 0 or 4), so nothing before the reveal is in color', () => {
    for (const s of specimens) for (const v of s.views) expect([0, 4], `${s.id} ${v.derived}`).toContain(pngColorType(join(DIR, v.derived)))
  })

  it('the originals are color files and are available for after the reveal', () => {
    for (const s of specimens) expect(existsSync(join(DIR, s.file))).toBe(true)
  })
})

describe('true scale', () => {
  it('every shipped specimen has a measured scale bar', () => {
    for (const s of specimens) expect(cmPerPx(s), s.id).not.toBeNull()
  })

  it('a specimen’s drawn size in centimeters is the same at every zoom', () => {
    for (const s of specimens) {
      const v = defaultView(s)
      const cm = trueSizeCm(s, v)!
      for (const z of [3, 8, 20, 37.5]) {
        const d = drawnSizePx(s, v, z)!
        expect(d[0] / z).toBeCloseTo(cm[0], 9)
        expect(d[1] / z).toBeCloseTo(cm[1], 9)
      }
    }
  })

  it('the ratio of two drawn sizes equals the ratio of their true sizes', () => {
    const a = specimens.find((s) => s.id === 'elephant')!
    const b = specimens.find((s) => s.id === 'marmoset')!
    const da = drawnSizePx(a, defaultView(a), 8)!
    const db = drawnSizePx(b, defaultView(b), 8)!
    const ta = trueSizeCm(a, defaultView(a))!
    const tb = trueSizeCm(b, defaultView(b))!
    expect(da[0] / db[0]).toBeCloseTo(ta[0] / tb[0], 9)
    expect(ta[0]).toBeGreaterThan(4 * tb[0])
  })

  it('the span runs from a few centimeters to about twenty', () => {
    const widths = specimens.map((s) => trueSizeCm(s, defaultView(s))![0])
    expect(Math.min(...widths)).toBeLessThan(4)
    expect(Math.max(...widths)).toBeGreaterThan(18)
  })

  it('a specimen without a scale bar has no computed size', () => {
    const s: Specimen = { ...specimens[0], scaleBar: null }
    expect(cmPerPx(s)).toBeNull()
    expect(drawnSizePx(s, defaultView(s), 8)).toBeNull()
  })
})

describe('the game', () => {
  it('the same seed gives the same order, and different seeds differ', () => {
    const a = shuffledOrder(specimens, 42).map((s) => s.id)
    expect(shuffledOrder(specimens, 42).map((s) => s.id)).toEqual(a)
    expect(shuffledOrder(specimens, 43).map((s) => s.id)).not.toEqual(a)
    expect([...a].sort()).toEqual(specimens.map((s) => s.id).sort())
  })

  it('the matching list holds exactly the common names present', () => {
    expect(matchingList(specimens)).toEqual([...new Set(specimens.map((s) => s.name))].sort((x, y) => x.localeCompare(y)))
    expect(matchingList(specimens)).toContain('kiwi')
    expect(matchingList(specimens)).toContain('bottlenose dolphin')
  })

  it('commit needs every image named, and scoring marks each match', () => {
    const g: Record<string, string> = {}
    expect(allNamed(specimens, g)).toBe(false)
    for (const s of specimens) g[s.id] = s.id === 'human' ? 'bottlenose dolphin' : s.name
    expect(allNamed(specimens, g)).toBe(true)
    const m = score(specimens, g)
    expect(m.filter((x) => x.correct).length).toBe(specimens.length - 1)
    expect(m.find((x) => x.specimen.id === 'human')!.correct).toBe(false)
  })
})
