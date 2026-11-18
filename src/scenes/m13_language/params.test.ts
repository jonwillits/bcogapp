import { describe, it, expect } from 'vitest'
import { PARAMS, PART_STEPS, parseParams, stepParams, type PartKey } from './params'
import { SCREENS as SOUNDS } from './sounds/screens'
import { SCREENS as STREAM } from './stream/screens'
import { SCREENS as WORDS } from './words/screens'
import { SCREENS as PREDICTORS } from './predictors/screens'
import type { StepScreen } from './steps'

/**
 * `params.yaml` is what a walk-through edits (Jon, 2026-11-18), so a wrong
 * edit must fail here, not on a student's screen: every part and step is
 * named, no key is unknown, every value is of the right kind, and the
 * screens are built from the values: a step's minutes, and the Pausing
 * line of an experiment that pauses names “Pause” and its limit, while one
 * that does not pause never names “Pause”.
 */
const SCREENS: Record<PartKey, Record<number, StepScreen>> = { sounds: SOUNDS, stream: STREAM, words: WORDS, predictors: PREDICTORS }

const base = `
main_panel:
  tabs: { current: Current Part, results: All Results }
parts:
  sounds:
    steps:
      1: { kind: exploration, minutes: 5 }
      2: { kind: experiment, minutes: 4, under_way: { labels: pause }, pause_limit_minutes: null }
      3: { kind: experiment, minutes: 5, under_way: { block: restart } }
      4: { kind: exploration, minutes: 6, under_way: { run: continue } }
  stream:
    steps:
      1: { kind: experiment, minutes: 2, under_way: { minute: restart } }
      2: { kind: experiment, minutes: 6 }
      3: { kind: exploration, minutes: 5, under_way: { run: continue } }
      4: { kind: exploration, minutes: 3 }
  words:
    steps:
      1: { kind: experiment, minutes: 6, under_way: { trials: pause }, pause_limit_minutes: 5 }
      2: { kind: experiment, minutes: 1, under_way: { test: restart } }
      3: { kind: exploration, minutes: 7, under_way: { run: continue } }
  predictors:
    steps:
      1: { kind: exploration, minutes: 3 }
      2: { kind: exploration, minutes: 5 }
      3: { kind: exploration, minutes: 5 }
      4: { kind: exploration, minutes: 6 }
      5: { kind: exploration, minutes: 4 }
`

describe('params.yaml', () => {
  it('names every part and every step the code has, and nothing else', () => {
    for (const part of Object.keys(PART_STEPS) as PartKey[]) {
      expect(Object.keys(PARAMS.parts[part].steps).map(Number).sort()).toEqual([...PART_STEPS[part]])
      for (const step of PART_STEPS[part]) expect(SCREENS[part][step].minutes, `${part} ${step}`).toBe(stepParams(part, step).minutes)
    }
    expect(PARAMS.mainPanel.tabs.current).not.toBe(PARAMS.mainPanel.tabs.results)
  })
  it('a step that pauses has a limit or null, and the others no limit key', () => {
    expect(stepParams('sounds', 2).pauseLimitMinutes).toBeNull()
    expect(stepParams('words', 1).pauseLimitMinutes).toBe(5)
    expect(stepParams('sounds', 3).pauseLimitMinutes).toBeUndefined()
  })
  it('the Pausing line of each experiment says Pause exactly when the step pauses, and names the limit', () => {
    for (const part of Object.keys(PART_STEPS) as PartKey[]) {
      for (const step of PART_STEPS[part]) {
        const p = stepParams(part, step)
        const line = SCREENS[part][step].sittingLine
        const pauses = Object.values(p.underWay).includes('pause')
        if (pauses) {
          expect(line, `${part} ${step}`).toMatch(/“Pause”/)
          if (p.pauseLimitMinutes !== null) expect(line, `${part} ${step}`).toContain(`${p.pauseLimitMinutes} minutes`)
          else expect(line, `${part} ${step}`).toContain('as long as you like')
        } else expect(line, `${part} ${step}`).not.toMatch(/“Pause”/)
        if (p.kind === 'exploration') expect(SCREENS[part][step].kind).toBe('exploration')
      }
    }
  })
  it('the file as shipped parses as the base here does', () => {
    expect(parseParams(base).parts.words.steps[1]).toEqual(PARAMS.parts.words.steps[1])
  })
  it('a wrong edit fails with the path that is wrong', () => {
    expect(() => parseParams(base.replace('minutes: 5 }\n      2:', 'minute: 5 }\n      2:'))).toThrow(/parts\.sounds\.steps\.1\.minute: unknown key/)
    expect(() => parseParams(base.replace('      4: { kind: exploration, minutes: 6, under_way: { run: continue } }\n  stream', '  stream'))).toThrow(/parts\.sounds\.steps\.4: missing/)
    expect(() => parseParams(base.replace('labels: pause', 'labels: stop'))).toThrow(/under_way\.labels: must be one of pause, restart, continue/)
    expect(() => parseParams(base.replace('labels: pause }, pause_limit_minutes: null', 'labels: pause }'))).toThrow(/pause_limit_minutes: a step that pauses must say its limit/)
    expect(() => parseParams(base.replace('block: restart }', 'block: restart }, pause_limit_minutes: 3'))).toThrow(/given, but nothing in this step pauses/)
    expect(() => parseParams(base.replace('minutes: 2,', 'minutes: two,'))).toThrow(/parts\.stream\.steps\.1\.minutes: must be a whole number/)
    expect(() => parseParams(base.replace('results: All Results', 'results: Current Part'))).toThrow(/the two tabs must have different names/)
    expect(() => parseParams(base.replace('under_way: { minute: restart }', 'under_way: { hour: restart }'))).toThrow(/under_way\.hour: unknown/)
  })
})
