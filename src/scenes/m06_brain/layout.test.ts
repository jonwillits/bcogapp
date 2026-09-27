import { describe, it, expect } from 'vitest'

/**
 * Selection changes a control's color and never its size (Jon, 2026-09-27).
 *
 * A selected chip that goes bold is wider than it was, and a row of chips that
 * just fit then wraps the moment one is chosen, which rearranges everything
 * under it. So in this scene no button or chip keys its font weight, padding,
 * font size or border width on its state. Color, background and border color
 * are the only things allowed to change.
 */

const scene = import.meta.glob('./*.tsx', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

/** A style property whose value is a ternary or a boolean-and: keyed on state. */
const conditional = (prop: string) => new RegExp(`${prop}:\\s*[^,\\n]*(\\?|&&)[^,\\n]*`, 'g')

describe('controls keep their size when selected', () => {
  it('no button style keys font weight, padding, font size or border width on state', () => {
    for (const [path, src] of Object.entries(scene)) {
      if (path.includes('.test.')) continue
      // Only DOM controls: SVG label text may embolden, since nothing flows around it.
      const dom = src.replace(/<text[\s\S]*?<\/text>/g, '')
      for (const prop of ['fontWeight', 'padding', 'fontSize', 'borderWidth', 'width', 'minWidth']) {
        const hits = [...dom.matchAll(conditional(prop))].map((m) => m[0])
        // Widths that follow from data (a drawn specimen, a scale bar, a slider's own layout) are not selection.
        const bad = hits.filter((h) => /\b(on|sel|selected|primary|active|committed|revealed|tab === |cardId === |view\.view ===|isMag|magnified|enlarged)\b/.test(h))
        expect(bad, `${path}: ${bad.join(' | ')}`).toEqual([])
      }
      // A border that appears only when selected is a size change too: borders must always be drawn.
      const borders = [...dom.matchAll(/border:\s*[^,\n]*\?[^,\n]*/g)].map((m) => m[0])
      for (const b of borders) expect(b, `${path}: ${b}`).not.toMatch(/'none'|\b0\b/)
    }
  })
})
