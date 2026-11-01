import { byteLength, isSavedState, MAX_STATE_BYTES, STATE_VERSION, type ProgressSchema, type SavedState } from './state'

/**
 * Export and Load (Lab 10's spec §4.2; Jon, 2026-10-25), for any lab that
 * saves progress. Export writes a small file to the student's own device;
 * Load reads one back. Nothing is uploaded. The file is plain JSON with a
 * kind and a version, and nothing executable. Load parses it as JSON only,
 * caps its size, checks the kind, the version and the shape against the
 * lab's schema, and rejects anything malformed with a plain sentence saying
 * what went wrong. It never replaces saved results without the in-page
 * confirmation the scene shows from `describeReplacement`.
 */

export interface TransferSpec<U extends string, P extends number, F extends string> {
  /** The kind written into the file, naming the lab: `bcogapp.m10 saved results`. */
  kind: string
  /** The lab's name in a refusal: `Lab 10`. */
  labName: string
  /** The exported file's stem: `lab10-results`. */
  fileStem: string
  schema: ProgressSchema<U, F>
  /** The parts that have units, in order, with the name each has in the confirmation. */
  parts: { part: P; name: string }[]
  unitsOfPart(part: P): U[]
}

export interface ExportFile<U extends string, F extends string> {
  kind: string
  exported: string
  state: SavedState<U, F>
}

export type ImportResult<U extends string, F extends string> = { ok: true; state: SavedState<U, F> } | { ok: false; reason: string }

export interface Transfer<U extends string, F extends string> {
  EXPORT_KIND: string
  IMPORT_REASONS: { tooLarge: string; notJson: string; wrongKind: string; wrongVersion: string; wrongShape: string }
  exportText(state: SavedState<U, F>): string
  exportFileName(seed: number): string
  parseImport(text: string): ImportResult<U, F>
  describeReplacement(current: SavedState<U, F>, incoming: SavedState<U, F>): string[]
}

export function makeTransfer<U extends string, P extends number, F extends string>(spec: TransferSpec<U, P, F>): Transfer<U, F> {
  const IMPORT_REASONS = {
    tooLarge: 'The file is too large to be a saved-results file.',
    notJson: 'The file is not valid JSON.',
    wrongKind: `This is not a ${spec.labName} saved-results file.`,
    wrongVersion: 'This file was saved by a different version of the lab.',
    wrongShape: 'The file’s contents do not have the expected shape.',
  } as const

  const exportText = (state: SavedState<U, F>): string => {
    const file: ExportFile<U, F> = { kind: spec.kind, exported: new Date().toISOString(), state }
    return JSON.stringify(file, null, 2)
  }

  const exportFileName = (seed: number): string => `${spec.fileStem}-${seed}.json`

  const parseImport = (text: string): ImportResult<U, F> => {
    if (typeof text !== 'string' || byteLength(text) > MAX_STATE_BYTES) return { ok: false, reason: IMPORT_REASONS.tooLarge }
    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      return { ok: false, reason: IMPORT_REASONS.notJson }
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return { ok: false, reason: IMPORT_REASONS.wrongKind }
    const file = parsed as Record<string, unknown>
    if (file.kind !== spec.kind) return { ok: false, reason: IMPORT_REASONS.wrongKind }
    const state = file.state
    if (typeof state !== 'object' || state === null || Array.isArray(state)) return { ok: false, reason: IMPORT_REASONS.wrongShape }
    if ((state as Record<string, unknown>).version !== STATE_VERSION) return { ok: false, reason: IMPORT_REASONS.wrongVersion }
    if (!isSavedState(state, spec.schema)) return { ok: false, reason: IMPORT_REASONS.wrongShape }
    return { ok: true, state }
  }

  const completedParts = (s: SavedState<U, F>): string[] => {
    const out: string[] = []
    for (const { part, name } of spec.parts) {
      const units = spec.unitsOfPart(part)
      const done = units.filter((u) => s.units[u]?.status === 'complete').length
      if (done === units.length && units.length > 0) out.push(name)
      else if (done > 0) out.push(`${name} (partly)`)
    }
    return out
  }

  /** What Load would replace, as lines for the in-page confirmation. */
  const describeReplacement = (current: SavedState<U, F>, incoming: SavedState<U, F>): string[] => {
    const here = completedParts(current)
    const there = completedParts(incoming)
    const lines: string[] = []
    lines.push(here.length ? `Saved here now: ${here.join(', ')} finished, with seed ${current.seed}.` : `Saved here now: nothing finished, with seed ${current.seed}.`)
    lines.push(there.length ? `In the file: ${there.join(', ')} finished, with seed ${incoming.seed}.` : `In the file: nothing finished, with seed ${incoming.seed}.`)
    lines.push('Loading replaces everything saved here with the file’s contents. What is saved here now is not kept.')
    return lines
  }

  return { EXPORT_KIND: spec.kind, IMPORT_REASONS, exportText, exportFileName, parseImport, describeReplacement }
}
