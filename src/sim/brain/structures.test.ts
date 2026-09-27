import { describe, it, expect } from 'vitest'
import { SPECIES, STRUCTURES, species, labelIn, structure, layersLine } from './structures'
import { REGIONS } from './proportions'

describe('the species parameter sets', () => {
  it('the lamprey has no cerebellum, and every other vertebrate set has one', () => {
    expect(species('lamprey').cerebellum).toBe('absent')
    for (const sp of SPECIES) if (sp.id !== 'lamprey') expect(sp.cerebellum, sp.id).toBe('present')
  })

  it('the lamprey’s pallium has three layers, the mammal’s six, and the bird’s is clustered', () => {
    expect(species('lamprey').palliumLayers).toBe(3)
    expect(species('mammal').palliumLayers).toBe(6)
    expect(species('bird').palliumLayers).toBe('clustered')
    expect(layersLine(species('bird'))).toMatch(/clusters rather than in layers/)
  })

  it('only the lamprey’s amygdala is drawn as not settled', () => {
    expect(species('lamprey').amygdala).toBe('notSettled')
    for (const sp of SPECIES) if (sp.id !== 'lamprey') expect(sp.amygdala, sp.id).toBe('present')
  })

  it('every species names a proportions row that exists', () => {
    for (const sp of SPECIES) expect(SPECIES.some((x) => x.proportions === sp.proportions)).toBe(true)
  })
})

describe('the named structures', () => {
  it('holds the fifteen structures of the spec’s §3.3, each in a figure region', () => {
    expect(STRUCTURES.length).toBe(15)
    for (const s of STRUCTURES) {
      if (s.id === 'spinalCord') expect(s.region).toBeNull()
      else expect(REGIONS.some((r) => r.id === s.region), s.id).toBe(true)
      expect(s.claims.length, s.id).toBeGreaterThan(0)
      for (const c of s.claims) expect(c, s.id).toMatch(/^§6\.\d(\.\d+)?-C\d+$/)
    }
  })

  it('uses the chapter’s naming convention: pallium in a non-mammal, pallium (neocortex) in a mammal', () => {
    expect(labelIn(structure('pallium'), species('lamprey'))).toBe('pallium')
    expect(labelIn(structure('pallium'), species('mammal'))).toBe('pallium (neocortex)')
    expect(labelIn(structure('tectum'), species('mammal'))).toBe('tectum (superior colliculus)')
    expect(labelIn(structure('tectum'), species('bird'))).toBe('tectum')
  })

  it('the hippocampus and the thalamus are named, not spent', () => {
    expect(structure('hippocampus').namedNotSpent).toMatch(/Modules 9 and 10/)
    expect(structure('thalamus').namedNotSpent).toMatch(/later modules/)
    expect(structure('hippocampus').description).not.toMatch(/memor|spatial|map|navigat/i)
  })
})
