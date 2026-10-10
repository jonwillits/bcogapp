import { describe, it, expect } from 'vitest'

/**
 * Selection changes a control's color and never its size (Lab 6's rule).
 * No button or chip in this scene keys its font weight, padding, font size
 * or border width on its state.
 */
const scene = import.meta.glob('./*.tsx', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const conditional = (prop: string) => new RegExp(`${prop}:\\s*[^,\\n]*(\\?|&&)[^,\\n]*`, 'g')

describe('controls keep their size when selected', () => {
  it('no button style keys font weight, padding, font size or border width on state', () => {
    for (const [path, src] of Object.entries(scene)) {
      if (path.includes('.test.')) continue
      const dom = src.replace(/<text[\s\S]*?<\/text>/g, '')
      for (const prop of ['fontWeight', 'padding', 'fontSize', 'borderWidth']) {
        const hits = [...dom.matchAll(conditional(prop))].map((m) => m[0])
        const bad = hits.filter((h) => /\b(on|sel|selected|primary|active|committed|revealed|tab === |phase ===|learning|checked)\b/.test(h))
        expect(bad, `${path}: ${bad.join(' | ')}`).toEqual([])
      }
      const borders = [...dom.matchAll(/border:\s*[^,\n]*\?[^,\n]*/g)].map((m) => m[0])
      for (const b of borders) expect(b, `${path}: ${b}`).not.toMatch(/'none'|\b0\b/)
    }
  })
})
