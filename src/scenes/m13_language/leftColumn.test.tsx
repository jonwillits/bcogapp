import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { ReactElement } from 'react'
import { ProgressStore } from '../../sim/language/progress/store'
import { sounds, SoundsStore } from './PartSounds'
import { stream, StreamStore } from './PartStream'
import { words, WordsStore } from './PartWords'
import { predictors, PredictorsStore } from './PartPredictors'
import { memoryStorage } from './reveal.test'

/**
 * The navigation panel is navigation only (Jon, 2026-11-16; LAB_COMMON_FEATURES
 * §1): the header, the step buttons, the progress rows, Begin, Go on and
 * Go back, Show the instructions again. No step's content, no prediction,
 * no setting and no button that runs anything lives there. Tested on
 * rendered markup for every part and every step, before and after Begin.
 */
type Mod = { Nav: unknown }
const CONTENT = /data-predict|type="range"|type="checkbox"|<select|Commit my|Run the|Run on|Count<|Compute|Generate a sentence|Show stress|Change the prompt|Start block|Train|Play the minute|Check this word|Show me|Pause</

function navMarkup(mod: Mod, store: unknown, progress: ProgressStore): string {
  const ctx = { seed: 7, progress, store, anim: undefined as never, header: null, openTab: () => {}, openStep: () => {} } as never
  const Nav = mod.Nav as (p: { ctx: never }) => ReactElement
  return renderToStaticMarkup(<Nav ctx={ctx} />)
}

describe('the navigation panel is navigation only', () => {
  it('no part puts a prediction, a setting or a running control in its navigation panel, on any step, before or after Begin', () => {
    const parts: [string, Mod, (p: ProgressStore) => { open: (s: never) => void; begin: () => void; acceptNotice: () => void; steps: readonly number[] }][] = [
      ['Part 1', sounds as Mod, (p) => new SoundsStore(7, p)],
      ['Part 2', stream as Mod, (p) => new StreamStore(7, p)],
      ['Part 3', words as Mod, (p) => new WordsStore(7, p)],
      ['Part 4', predictors as Mod, (p) => new PredictorsStore(7, p)],
    ]
    for (const [name, mod, make] of parts) {
      const progress = new ProgressStore(memoryStorage(), 7)
      const store = make(progress)
      for (const step of store.steps) {
        store.open(step as never)
        const before = navMarkup(mod, store, progress)
        expect(before, `${name}, step ${step}, before Begin`).not.toMatch(CONTENT)
        store.acceptNotice()
        store.begin()
        const after = navMarkup(mod, store, progress)
        expect(after, `${name}, step ${step}, after Begin`).not.toMatch(CONTENT)
        expect(after, `${name}, step ${step}: the navigation is there`).toMatch(/Show the instructions again|This step is done/)
      }
    }
  })
})
