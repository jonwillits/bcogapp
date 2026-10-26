import { byteLength, isSavedState, MAX_STATE_BYTES, STATE_VERSION, type SavedState } from './state'
import type { Part } from '../parts'
import { unitsOfPart } from '../parts'

/**
 * Export and Load (spec §4.2; Jon's answer 4 of 2026-10-25). Export writes
 * a small file to the student's own device; Load reads one back. Nothing is
 * uploaded. The file is plain JSON with a kind and a version, and nothing
 * executable. Load parses it as JSON only, caps its size, checks the kind,
 * the version and the shape against the schema, and rejects anything
 * malformed with a plain sentence saying what went wrong. It never replaces
 * saved results without the in-page confirmation the scene shows from
 * `describeReplacement`.
 */

export const EXPORT_KIND = 'bcogapp.m10 saved results'

export interface ExportFile {
  kind: typeof EXPORT_KIND
  exported: string
  state: SavedState
}

export function exportText(state: SavedState): string {
  const file: ExportFile = { kind: EXPORT_KIND, exported: new Date().toISOString(), state }
  return JSON.stringify(file, null, 2)
}

export function exportFileName(seed: number): string {
  return `lab10-results-${seed}.json`
}

export type ImportResult = { ok: true; state: SavedState } | { ok: false; reason: string }

export const IMPORT_REASONS = {
  tooLarge: 'The file is too large to be a saved-results file.',
  notJson: 'The file is not valid JSON.',
  wrongKind: 'This is not a Lab 10 saved-results file.',
  wrongVersion: 'This file was saved by a different version of the lab.',
  wrongShape: 'The file’s contents do not have the expected shape.',
} as const

export function parseImport(text: string): ImportResult {
  if (typeof text !== 'string' || byteLength(text) > MAX_STATE_BYTES) return { ok: false, reason: IMPORT_REASONS.tooLarge }
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { ok: false, reason: IMPORT_REASONS.notJson }
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return { ok: false, reason: IMPORT_REASONS.wrongKind }
  const file = parsed as Record<string, unknown>
  if (file.kind !== EXPORT_KIND) return { ok: false, reason: IMPORT_REASONS.wrongKind }
  const state = file.state
  if (typeof state !== 'object' || state === null || Array.isArray(state)) return { ok: false, reason: IMPORT_REASONS.wrongShape }
  if ((state as Record<string, unknown>).version !== STATE_VERSION) return { ok: false, reason: IMPORT_REASONS.wrongVersion }
  if (!isSavedState(state)) return { ok: false, reason: IMPORT_REASONS.wrongShape }
  return { ok: true, state }
}

const PART_NAMES: Record<Exclude<Part, 0 | 5>, string> = { 1: 'Part 1', 2: 'Part 2', 3: 'Part 3', 4: 'Part 4' }

function completedParts(s: SavedState): string[] {
  const out: string[] = []
  for (const p of [1, 2, 3, 4] as const) {
    const units = unitsOfPart(p)
    const done = units.filter((u) => s.units[u]?.status === 'complete').length
    if (done === units.length) out.push(PART_NAMES[p])
    else if (done > 0) out.push(`${PART_NAMES[p]} (partly)`)
  }
  return out
}

/** What Load would replace, as lines for the in-page confirmation. */
export function describeReplacement(current: SavedState, incoming: SavedState): string[] {
  const here = completedParts(current)
  const there = completedParts(incoming)
  const lines: string[] = []
  lines.push(here.length ? `Saved here now: ${here.join(', ')} finished, with seed ${current.seed}.` : `Saved here now: nothing finished, with seed ${current.seed}.`)
  lines.push(there.length ? `In the file: ${there.join(', ')} finished, with seed ${incoming.seed}.` : `In the file: nothing finished, with seed ${incoming.seed}.`)
  lines.push('Loading replaces everything saved here with the file’s contents. What is saved here now is not kept.')
  return lines
}
