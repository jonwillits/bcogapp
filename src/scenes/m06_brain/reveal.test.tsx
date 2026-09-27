import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { SpecimensTab } from './SpecimensTab'
import { TreeTab } from './TreeTab'
import { CARDS, emptyPlacements, togglePlacement, type Placements } from '../../sim/brain/tree'
import type { Manifest } from '../../sim/brain/specimens'

/**
 * The reveal-gating tests of the spec's §11, asserted on what is rendered:
 * the tabs are rendered headlessly to markup, and the markup is searched.
 *
 * In the Specimens tab, before *Commit my matches*: no species name is
 * attached to any image, no correctness, no credit line, no scientific
 * name, no source link, no original file. (The matching list itself holds
 * the names, since matching is the task, and lives in <option> elements —
 * so the search runs over the markup with the options removed.)
 *
 * In the Tree tab, before *Reveal the answer*: no answer-key information.
 */

const manifest: Manifest = JSON.parse(readFileSync(join(__dirname, '..', '..', '..', 'public', 'm06', 'specimens', 'manifest.json'), 'utf-8'))
const names = manifest.specimens.map((s) => s.name)

const strip = (html: string) => html.replace(/<option[^>]*>[^<]*<\/option>/g, '').replace(/<select[^>]*aria-label="name for specimen \d+"[^>]*>/g, '')

function specimensMarkup(committed: boolean, extra: Partial<{ trueScale: boolean; credits: boolean }> = {}) {
  const guesses: Record<string, string> = {}
  for (const s of manifest.specimens) guesses[s.id] = s.id === 'human' ? 'bottlenose dolphin' : s.name
  return renderToStaticMarkup(<SpecimensTab seed={7} onNewSeed={() => {}} manifest={manifest} initial={{ guesses, committed, ...extra }} />)
}

describe('Specimens: nothing is revealed before Commit my matches', () => {
  const before = strip(specimensMarkup(false))

  it('renders the gallery with a card per specimen and a Commit button', () => {
    expect((before.match(/data-card="/g) ?? []).length).toBe(manifest.specimens.length)
    expect(before).toContain('Commit my matches')
  })

  it('attaches no species name, scientific name or credit to any image', () => {
    for (const n of names) expect(before, n).not.toMatch(new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'))
    for (const s of manifest.specimens) {
      expect(before, s.scientificName).not.toContain(s.scientificName)
      expect(before, s.id).not.toContain(s.credit.slice(0, 40))
      expect(before, s.source).not.toContain(s.source)
      expect(before, s.file).not.toContain(s.file)
    }
    expect(before).not.toMatch(/brainmuseum|Wisconsin|Commons|PLoS/i)
  })

  it('shows no correctness and no reveal-only controls', () => {
    expect(before).not.toMatch(/data-verdict/)
    expect(before).not.toMatch(/✓|✗/)
    expect(before).not.toMatch(/See the original/)
    expect(before).not.toMatch(/True scale/)
    expect(before).not.toMatch(/Credits: showing|>Credits</)
    expect(before).not.toMatch(/data-specimen-image="original"/)
  })

  it('shows every image as a grayscale cutout on the neutral stage, identified by a number', () => {
    const imgs = before.match(/<img[^>]*data-specimen-image="cutout"[^>]*>/g) ?? []
    expect(imgs.length).toBe(manifest.specimens.length)
    for (const img of imgs) {
      expect(img).toMatch(/derived\/[0-9a-f]{10}\.png/)
      expect(img).toMatch(/grayscale\(1\)/)
      expect(img).toMatch(/alt="specimen \d+, from/)
    }
  })

  it('the run seed fixes the order', () => {
    const a = renderToStaticMarkup(<SpecimensTab seed={7} onNewSeed={() => {}} manifest={manifest} />)
    const b = renderToStaticMarkup(<SpecimensTab seed={7} onNewSeed={() => {}} manifest={manifest} />)
    const c = renderToStaticMarkup(<SpecimensTab seed={8} onNewSeed={() => {}} manifest={manifest} />)
    expect(a).toBe(b)
    expect(a).not.toBe(c)
  })
})

describe('Specimens: after the reveal', () => {
  const after = specimensMarkup(true)

  it('marks each match right or wrong, names it, shows the original and links to its source', () => {
    expect((after.match(/data-verdict="right"/g) ?? []).length).toBe(manifest.specimens.length - 1)
    expect((after.match(/data-verdict="wrong"/g) ?? []).length).toBe(1)
    for (const n of names) expect(after).toContain(n)
    expect((after.match(/data-specimen-image="original"/g) ?? []).length).toBe(manifest.specimens.length)
    for (const s of manifest.specimens) expect(after).toContain(s.file)
    expect((after.match(/See the original/g) ?? []).length).toBeGreaterThanOrEqual(manifest.specimens.length)
    expect(after).toContain('True scale')
    expect(after).toContain('Credits')
  })

  it('the Credits view lists every credit, licence and source', () => {
    const credits = specimensMarkup(true, { credits: true })
    for (const s of manifest.specimens) {
      expect(credits).toMatch(new RegExp(`data-credit="${s.id}"`))
      expect(credits).toContain(s.source)
    }
    expect(credits).toContain('Comparative Mammalian Brain Collections')
    expect(credits).toContain('CC BY 2.5')
  })

  it('the true-scale view draws each specimen from its scale bar, and the magnifier and its line are there', () => {
    const ts = specimensMarkup(true, { trueScale: true })
    expect((ts.match(/data-drawn-width=/g) ?? []).length).toBe(manifest.specimens.length)
    expect(ts).not.toMatch(/data-size-not-recorded/)
    expect(ts).toContain('Size and folding evolved more than once. §6.3.5.')
    expect(ts).toContain('magnify')
  })

  it('a specimen without a scale bar is drawn greyed with size not recorded', () => {
    const m2: Manifest = { ...manifest, specimens: manifest.specimens.map((s) => (s.id === 'rat' ? { ...s, scaleBar: null } : s)) }
    const guesses: Record<string, string> = {}
    for (const s of m2.specimens) guesses[s.id] = s.name
    const ts = renderToStaticMarkup(<SpecimensTab seed={7} onNewSeed={() => {}} manifest={m2} initial={{ guesses, committed: true, trueScale: true }} />)
    expect((ts.match(/data-size-not-recorded/g) ?? []).length).toBe(1)
    expect((ts.match(/data-drawn-width=/g) ?? []).length).toBe(m2.specimens.length - 1)
    expect(ts).toContain('size not recorded')
  })
})

describe('Tree: no answer key before Reveal the answer', () => {
  const full = (): Placements => {
    let p = emptyPlacements()
    for (const c of CARDS) p = togglePlacement(p, c.id, 'mammals').placements
    return p
  }

  it('before the reveal, no key branch, no mark and no reveal line is rendered', () => {
    const html = renderToStaticMarkup(<TreeTab initial={{ placements: full(), revealed: false }} />)
    expect(html).toContain('Reveal the answer')
    expect(html).not.toMatch(/the key:/)
    expect(html).not.toMatch(/✓|✗/)
    expect(html).not.toMatch(/missing from your placements/)
    expect(html).not.toMatch(/neither right nor wrong/)
    for (const c of CARDS) if (c.revealLine) expect(html, c.id).not.toContain(c.revealLine.slice(0, 30))
    expect(html).not.toMatch(/separate origin/)
    // The key's rings are drawn only after the reveal.
    expect(html).not.toMatch(/stroke-dasharray="3 2"[^>]*\/>\s*<text[^>]*>\d<\/text>/)
    expect(html).not.toContain('The answer')
  })

  it('before any placement, Reveal is disabled', () => {
    const html = renderToStaticMarkup(<TreeTab />)
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Reveal the answer/)
  })

  it('after the reveal, the key, the marks and the reveal lines are rendered', () => {
    const html = renderToStaticMarkup(<TreeTab initial={{ placements: full(), revealed: true }} />)
    expect(html).toContain('the key:')
    expect(html).toMatch(/✓|✗/)
    expect(html).toContain('separate origin')
    for (const c of CARDS) if (c.revealLine) expect(html, c.id).toContain(c.revealLine.slice(0, 30))
    expect(html).toContain('neither right nor wrong')
  })
})
