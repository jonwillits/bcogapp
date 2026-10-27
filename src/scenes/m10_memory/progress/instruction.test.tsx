import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { InstructionScreen, SITTING_LINES } from './InstructionScreen'
import { StorageLine, SAVED_HERE_LINE, STORAGE_UNAVAILABLE_LINE } from './StorageLine'

/**
 * The instruction screen says its five things in the spec's order (§4.1),
 * and the Export and Load controls use no form and no browser dialog.
 */
const sources = import.meta.glob('./*.tsx', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

describe('the instruction screen', () => {
  const html = renderToStaticMarkup(
    <InstructionScreen title="Part 1 — Lists of Words" willDo={['You will see lists of words, one word at a time.', 'After each list, type every word you remember.']} minutes={19} sitting="one sitting" keys={['Enter adds the word you typed.', '“I’m done” ends recall early.']} content={['One content line.']} onBegin={() => {}} />,
  )

  it('renders the five things in order: what, how long, pausing, what to have ready, the keys', () => {
    expect(html).toMatch(/data-instruction/)
    const at = (s: string) => {
      const i = html.indexOf(s)
      expect(i, s).toBeGreaterThanOrEqual(0)
      return i
    }
    const what = at('You will see lists of words, one word at a time.')
    const second = at('After each list, type every word you remember.')
    const minutes = at('About 19 minutes.')
    const sitting = at(SITTING_LINES['one sitting'].slice(0, 40))
    const ready = at('Nothing is needed')
    const keys = at('Enter adds the word you typed.')
    expect(what).toBeLessThan(second)
    expect(second).toBeLessThan(minutes)
    expect(minutes).toBeLessThan(sitting)
    expect(sitting).toBeLessThan(ready)
    expect(ready).toBeLessThan(keys)
    expect(html).toContain('One content line.')
    expect(html).toMatch(/<button[^>]*>Begin<\/button>/)
  })

  it('the sitting wording is the spec’s, for both kinds of step', () => {
    expect(SITTING_LINES['one sitting']).toBe('Once you press “Begin”, finish this part in one sitting. If you leave partway, you will start this part again with new materials.')
    expect(SITTING_LINES['leave any time']).toBe('You can leave and come back at any time.')
    const explore = renderToStaticMarkup(<InstructionScreen title="Step 1" willDo={['Look.']} minutes={5} sitting="leave any time" onBegin={() => {}} />)
    expect(explore).toContain('You can leave and come back at any time.')
    expect(explore).toMatch(/data-sitting="leave any time"/)
    expect(explore).not.toMatch(/data-keys/)
  })

  it('one minute is singular', () => {
    const one = renderToStaticMarkup(<InstructionScreen title="t" willDo={['x']} minutes={1} sitting="leave any time" onBegin={() => {}} />)
    expect(one).toContain('About 1 minute.')
  })
})

describe('the storage line', () => {
  it('says saved here only, or that results will be lost', () => {
    expect(renderToStaticMarkup(<StorageLine available />)).toContain(SAVED_HERE_LINE)
    expect(renderToStaticMarkup(<StorageLine available={false} />)).toContain(STORAGE_UNAVAILABLE_LINE)
    expect(SAVED_HERE_LINE).toMatch(/this browser on this computer only/)
    expect(STORAGE_UNAVAILABLE_LINE).toMatch(/lost if this page is closed/)
  })
})

describe('Export and Load', () => {
  it('uses no form, no browser dialog, and uploads nothing', () => {
    const src = sources['./ExportLoad.tsx']
    expect(src).toBeDefined()
    expect(src).not.toMatch(/<form|window\.confirm|window\.alert|window\.prompt|\bconfirm\(|\balert\(|\bprompt\(|\bfetch\(|XMLHttpRequest|WebSocket|sendBeacon/)
    expect(src).toMatch(/Export my results/)
    expect(src).toMatch(/Load my results/)
    expect(src).toMatch(/Replace my saved results/)
    expect(src).toMatch(/Keep what I have/)
    expect(src).toMatch(/data-confirm/)
    expect(src).toMatch(/data-load-error/)
  })

  it('no file in the folder spells color the British way or has the program know, notice or decide', () => {
    for (const [path, src] of Object.entries(sources)) {
      if (path.includes('.test.')) continue
      expect(src, path).not.toMatch(/\bcolour|\bbehaviour|\bcentre\b|\bgrey\b/i)
      expect(src, path).not.toMatch(/\b(program|store|lab|browser) (knows|notices|decides|remembers|wants)\b/i)
    }
  })
})
