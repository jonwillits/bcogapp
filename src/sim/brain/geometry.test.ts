import { describe, it, expect } from 'vitest'
import { brainGeometry } from './geometry'
import { SPECIES, species } from './structures'

describe('the one drawing rule', () => {
  it('draws the lamprey’s cerebellum as an absent outline and every other species’ as present', () => {
    expect(brainGeometry(species('lamprey')).regions.find((r) => r.region === 'cerebellum')!.absent).toBe(true)
    for (const sp of SPECIES) if (sp.id !== 'lamprey') expect(brainGeometry(sp).regions.find((r) => r.region === 'cerebellum')!.absent, sp.id).toBeFalsy()
  })

  it('dashes the lamprey’s amygdala and no other', () => {
    expect(brainGeometry(species('lamprey')).markers.find((m) => m.structure === 'amygdala')!.dashed).toBe(true)
    expect(brainGeometry(species('mammal')).markers.find((m) => m.structure === 'amygdala')!.dashed).toBeFalsy()
  })

  it('the mammal’s forebrain roof is taller and wider than the lamprey’s, and its hindbrain shorter', () => {
    const l = brainGeometry(species('lamprey'))
    const m = brainGeometry(species('mammal'))
    const roof = (g: typeof l) => g.regions.find((r) => r.region === 'forebrainRoof')!.box
    const hind = (g: typeof l) => g.regions.find((r) => r.region === 'hindbrain')!.box
    expect(roof(m).h).toBeGreaterThan(roof(l).h)
    expect(roof(m).w).toBeGreaterThan(roof(l).w)
    expect(hind(m).w).toBeLessThan(hind(l).w)
  })

  it('every species fits the canvas and lays its regions front to back', () => {
    for (const sp of SPECIES) {
      const g = brainGeometry(sp)
      for (const r of g.regions) {
        expect(r.box.x, sp.id).toBeGreaterThanOrEqual(0)
        expect(r.box.x + r.box.w, sp.id).toBeLessThanOrEqual(g.width)
        expect(r.box.y, sp.id).toBeGreaterThanOrEqual(0)
        expect(r.box.y + r.box.h, sp.id).toBeLessThanOrEqual(g.height)
      }
      const x = (id: string) => g.regions.find((r) => r.region === id)!.box.x
      expect(x('forebrainRoof')).toBeLessThan(x('midbrainRoof'))
      expect(x('midbrainRoof')).toBeLessThan(x('hindbrain'))
      expect(g.spinalCord.x).toBeGreaterThanOrEqual(x('hindbrain'))
      expect(Object.keys(g.anchors).length).toBe(15)
    }
  })
})
