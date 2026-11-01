/**
 * The shape of saved progress, for any lab that tests a student (Lab 10's
 * spec §4.2, generalized for Lab 11 under its own key). A lab names its
 * units and its boolean flags in a `ProgressSchema`; everything else is the
 * same: the version, the seed, one record per unit, every committed
 * prediction, and inside each unit's `result` the part's own object, opaque
 * here. A file loaded from disk is checked against this shape, field by
 * field, before it replaces anything (`transfer.ts`).
 *
 * Lab 10's own files (`src/sim/memory/progress/`) configure this layer with
 * Lab 10's units and its one flag, so a state Lab 10 saved before this
 * layer existed still passes its check unchanged.
 */

export const STATE_VERSION = 1 as const

export type UnitStatus = 'not started' | 'in progress' | 'complete'

export interface UnitRecord {
  status: UnitStatus
  /** The index of the materials slot in use or used: 0 is the unit's own, the rest are reserves. */
  materials: number
  /** How many times the unit was interrupted and restarted. */
  restarts: number
  /** The part's own result object, saved on completion. */
  result?: unknown
  /** For a unit that resumes: what was answered so far, so an interrupted unit resumes. */
  partial?: unknown
}

export interface ProgressSchema<U extends string, F extends string> {
  unitIds: readonly U[]
  /** Boolean flags saved beside the units, each false in a new state. */
  flags: readonly F[]
}

export type SavedState<U extends string, F extends string> = {
  version: typeof STATE_VERSION
  seed: number
  units: Record<U, UnitRecord>
  predictions: Record<string, string>
  /** Rewritable string settings (Lab 11's rule from chips); absent until one is written, so a Lab 10 state is unchanged. */
  settings?: Record<string, string>
} & Record<F, boolean>

/** The largest text a lab will parse as a saved state, bytes. A full run is a few tens of kilobytes. */
export const MAX_STATE_BYTES = 256 * 1024
/** The longest string value allowed anywhere inside a saved state. Nothing a student types is long; a free-text box is capped below this. */
export const MAX_STRING_LENGTH = 2000

export function newUnitRecord(): UnitRecord {
  return { status: 'not started', materials: 0, restarts: 0 }
}

export function newState<U extends string, F extends string>(seed: number, schema: ProgressSchema<U, F>): SavedState<U, F> {
  const units = {} as Record<U, UnitRecord>
  for (const u of schema.unitIds) units[u] = newUnitRecord()
  const flags = {} as Record<F, boolean>
  for (const f of schema.flags) flags[f] = false
  return { version: STATE_VERSION, seed, units, predictions: {}, ...flags }
}

const STATUSES = new Set<string>(['not started', 'in progress', 'complete'])

const isPlainObject = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)

/**
 * No value anywhere in a state may be a function, a symbol, an overlong
 * string, or an object with a prototype-shaped key. Walks the whole tree,
 * including the opaque results.
 */
function valuesAreSafe(x: unknown, depth = 0): boolean {
  if (depth > 32) return false
  if (x === null) return true
  switch (typeof x) {
    case 'string':
      return x.length <= MAX_STRING_LENGTH
    case 'number':
      return Number.isFinite(x)
    case 'boolean':
    case 'undefined':
      return true
    case 'object':
      if (Array.isArray(x)) return x.every((v) => valuesAreSafe(v, depth + 1))
      if (!isPlainObject(x)) return false
      for (const k of Object.keys(x)) {
        if (k === '__proto__' || k === 'constructor' || k === 'prototype') return false
        if (!valuesAreSafe(x[k], depth + 1)) return false
      }
      // Own-property check catches an object parsed with a `__proto__` key by a parser that keeps it as data.
      if (Object.prototype.hasOwnProperty.call(x, '__proto__')) return false
      return true
    default:
      return false
  }
}

function isUnitRecord(x: unknown): x is UnitRecord {
  if (!isPlainObject(x)) return false
  if (typeof x.status !== 'string' || !STATUSES.has(x.status)) return false
  if (typeof x.materials !== 'number' || !Number.isInteger(x.materials) || x.materials < 0 || x.materials > 8) return false
  if (typeof x.restarts !== 'number' || !Number.isInteger(x.restarts) || x.restarts < 0 || x.restarts > 64) return false
  for (const k of Object.keys(x)) if (!['status', 'materials', 'restarts', 'result', 'partial'].includes(k)) return false
  return true
}

/** The schema check: version, seed, every unit a known one with a well-typed record, predictions strings, every flag a boolean, nothing else, nothing executable, nothing oversized. */
export function isSavedState<U extends string, F extends string>(x: unknown, schema: ProgressSchema<U, F>): x is SavedState<U, F> {
  if (!isPlainObject(x)) return false
  if (x.version !== STATE_VERSION) return false
  if (typeof x.seed !== 'number' || !Number.isInteger(x.seed) || x.seed < 0) return false
  if (!isPlainObject(x.units)) return false
  const unitSet = new Set<string>(schema.unitIds)
  for (const [k, v] of Object.entries(x.units)) {
    if (!unitSet.has(k)) return false
    if (!isUnitRecord(v)) return false
  }
  for (const u of schema.unitIds) if (!(u in x.units)) return false
  if (!isPlainObject(x.predictions)) return false
  for (const v of Object.values(x.predictions)) if (typeof v !== 'string') return false
  for (const f of schema.flags) if (typeof x[f] !== 'boolean') return false
  if ('settings' in x) {
    if (!isPlainObject(x.settings)) return false
    for (const v of Object.values(x.settings)) if (typeof v !== 'string') return false
  }
  const allowed = new Set<string>(['version', 'seed', 'units', 'predictions', 'settings', ...schema.flags])
  for (const k of Object.keys(x)) if (!allowed.has(k)) return false
  if (!valuesAreSafe(x)) return false
  let text: string
  try {
    text = JSON.stringify(x)
  } catch {
    return false
  }
  return byteLength(text) <= MAX_STATE_BYTES
}

/** UTF-8 bytes of a string, without a TextEncoder dependency on the host. */
export function byteLength(s: string): number {
  let n = 0
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    if (c < 0x80) n += 1
    else if (c < 0x800) n += 2
    else if (c >= 0xd800 && c <= 0xdbff) {
      n += 4
      i++
    } else n += 3
  }
  return n
}
