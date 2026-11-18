import { parse } from 'yaml'
import raw from './params.yaml?raw'

/**
 * Lab 13's parameters, read from `params.yaml` (Jon, 2026-11-18): the file a
 * walk-through edits. This module parses it once, checks its shape, and
 * hands out typed values; a missing part or step, an unknown key, or a
 * value of the wrong kind throws here, at import, with the path that is
 * wrong, so that a typo in the file fails the first test that touches it
 * and never reaches a student. The lists of parts and steps are the code's
 * own (`PART_STEPS`), and the file must name exactly those.
 */

export type PartKey = 'sounds' | 'stream' | 'words' | 'predictors'
export type Consequence = 'pause' | 'restart' | 'continue'
/** What can be under way when a step is left. The stores report one of these; the file gives its consequence. */
export type UnderWay = 'labels' | 'block' | 'minute' | 'trials' | 'test' | 'run'

export interface StepParams {
  kind: 'experiment' | 'exploration'
  minutes: number
  underWay: Partial<Record<UnderWay, Consequence>>
  /** Minutes a pause may last before the step restarts anyway; null for no limit; absent when nothing pauses. */
  pauseLimitMinutes: number | null | undefined
}

export interface Params {
  mainPanel: { tabs: { current: string; results: string } }
  parts: Record<PartKey, { steps: Record<number, StepParams> }>
}

/** The parts and their steps, as the code has them. The file must match. */
export const PART_STEPS: Record<PartKey, readonly number[]> = { sounds: [1, 2, 3, 4], stream: [1, 2, 3, 4], words: [1, 2, 3], predictors: [1, 2, 3, 4, 5] }

const UNDER_WAY: readonly UnderWay[] = ['labels', 'block', 'minute', 'trials', 'test', 'run']
const CONSEQUENCES: readonly Consequence[] = ['pause', 'restart', 'continue']

function fail(path: string, what: string): never {
  throw new Error(`params.yaml, ${path}: ${what}`)
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function onlyKeys(obj: Record<string, unknown>, path: string, allowed: string[]): void {
  for (const k of Object.keys(obj)) if (!allowed.includes(k)) fail(`${path}.${k}`, `unknown key; allowed: ${allowed.join(', ')}`)
}

function readStep(v: unknown, path: string): StepParams {
  if (!isRecord(v)) fail(path, 'must be a map')
  onlyKeys(v, path, ['kind', 'minutes', 'under_way', 'pause_limit_minutes'])
  const kind = v.kind
  if (kind !== 'experiment' && kind !== 'exploration') fail(`${path}.kind`, 'must be experiment or exploration')
  const minutes = v.minutes
  if (typeof minutes !== 'number' || !Number.isInteger(minutes) || minutes < 1) fail(`${path}.minutes`, 'must be a whole number of minutes, at least 1')
  const underWay: Partial<Record<UnderWay, Consequence>> = {}
  if (v.under_way !== undefined) {
    if (!isRecord(v.under_way)) fail(`${path}.under_way`, 'must be a map of what can be under way to its consequence')
    for (const [k, c] of Object.entries(v.under_way)) {
      if (!UNDER_WAY.includes(k as UnderWay)) fail(`${path}.under_way.${k}`, `unknown; allowed: ${UNDER_WAY.join(', ')}`)
      if (!CONSEQUENCES.includes(c as Consequence)) fail(`${path}.under_way.${k}`, `must be one of ${CONSEQUENCES.join(', ')}`)
      underWay[k as UnderWay] = c as Consequence
    }
  }
  const pauses = Object.values(underWay).includes('pause')
  const limit = v.pause_limit_minutes
  if (pauses) {
    if (!('pause_limit_minutes' in v)) fail(`${path}.pause_limit_minutes`, 'a step that pauses must say its limit in minutes, or null for none')
    if (limit !== null && (typeof limit !== 'number' || limit <= 0)) fail(`${path}.pause_limit_minutes`, 'must be a number of minutes above 0, or null')
  } else if ('pause_limit_minutes' in v) fail(`${path}.pause_limit_minutes`, 'given, but nothing in this step pauses')
  return { kind, minutes, underWay, pauseLimitMinutes: pauses ? (limit as number | null) : undefined }
}

function readParams(doc: unknown): Params {
  if (!isRecord(doc)) fail('(root)', 'must be a map')
  onlyKeys(doc, '(root)', ['main_panel', 'parts'])
  const mp = doc.main_panel
  if (!isRecord(mp) || !isRecord(mp.tabs)) fail('main_panel.tabs', 'must give the two tabs')
  onlyKeys(mp, 'main_panel', ['tabs'])
  onlyKeys(mp.tabs, 'main_panel.tabs', ['current', 'results'])
  const current = mp.tabs.current
  const results = mp.tabs.results
  if (typeof current !== 'string' || !current.trim()) fail('main_panel.tabs.current', 'must be a name')
  if (typeof results !== 'string' || !results.trim()) fail('main_panel.tabs.results', 'must be a name')
  if (current.trim().toLowerCase() === results.trim().toLowerCase()) fail('main_panel.tabs', 'the two tabs must have different names')
  const parts = doc.parts
  if (!isRecord(parts)) fail('parts', 'must be a map of the four parts')
  onlyKeys(parts, 'parts', Object.keys(PART_STEPS))
  const out = {} as Record<PartKey, { steps: Record<number, StepParams> }>
  for (const part of Object.keys(PART_STEPS) as PartKey[]) {
    const p = parts[part]
    if (!isRecord(p) || !isRecord(p.steps)) fail(`parts.${part}.steps`, 'must be a map of the steps')
    onlyKeys(p, `parts.${part}`, ['steps'])
    const steps: Record<number, StepParams> = {}
    const want = PART_STEPS[part].map(String)
    const have = Object.keys(p.steps)
    for (const k of have) if (!want.includes(k)) fail(`parts.${part}.steps.${k}`, `no such step; the steps are ${want.join(', ')}`)
    for (const k of want) {
      if (!(k in p.steps)) fail(`parts.${part}.steps.${k}`, 'missing')
      steps[Number(k)] = readStep(p.steps[k], `parts.${part}.steps.${k}`)
    }
    out[part] = { steps }
  }
  return { mainPanel: { tabs: { current: current.trim(), results: results.trim() } }, parts: out }
}

/** Parse a YAML text as this lab's parameters, with every check; for the tests of the checks. */
export function parseParams(text: string): Params {
  return readParams(parse(text))
}

export const PARAMS: Params = parseParams(raw)

export function stepParams(part: PartKey, step: number): StepParams {
  const p = PARAMS.parts[part].steps[step]
  if (!p) throw new Error(`params: no step ${step} in ${part}`)
  return p
}

/** The main panel's two tab names, as the file gives them. */
export const MAIN_TABS = PARAMS.mainPanel.tabs
