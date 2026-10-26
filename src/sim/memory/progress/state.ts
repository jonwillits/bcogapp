import { UNIT_IDS, type UnitId } from '../parts'

/**
 * What is saved (spec §4.2): the seed, which units are complete, every
 * response the student made and every result computed from it (inside each
 * unit's `result`, which is the part's own object and opaque here), and
 * every committed prediction. Version 1. A file loaded from disk is checked
 * against this shape, field by field, before it replaces anything
 * (`transfer.ts`).
 */

export const STATE_VERSION = 1 as const

export type UnitStatus = 'not started' | 'in progress' | 'complete'

export interface UnitRecord {
  status: UnitStatus
  /** The index of the materials slot in use or used: 0 is the unit's own, the rest are reserves (`reservesFor`). */
  materials: number
  /** How many times the unit was interrupted and restarted. */
  restarts: number
  /** The part's own result object, saved on completion. */
  result?: unknown
  /** For `p1-recognition` only: the items answered so far, so an interrupted test resumes. */
  partial?: unknown
}

export interface SavedState {
  version: typeof STATE_VERSION
  seed: number
  units: Record<UnitId, UnitRecord>
  predictions: Record<string, string>
  sampleNights: boolean
}

/** The largest text the lab will parse as a saved state, bytes. A full run is a few tens of kilobytes. */
export const MAX_STATE_BYTES = 256 * 1024
/** The longest string value allowed anywhere inside a saved state. A typed word is a few letters; nothing a student types is long. */
export const MAX_STRING_LENGTH = 2000

export function newUnitRecord(): UnitRecord {
  return { status: 'not started', materials: 0, restarts: 0 }
}

export function newState(seed: number): SavedState {
  const units = {} as Record<UnitId, UnitRecord>
  for (const u of UNIT_IDS) units[u] = newUnitRecord()
  return { version: STATE_VERSION, seed, units, predictions: {}, sampleNights: false }
}

const UNIT_SET = new Set<string>(UNIT_IDS)
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

/** The schema check: version, seed, every unit a known one with a well-typed record, predictions strings, nothing executable, nothing oversized. */
export function isSavedState(x: unknown): x is SavedState {
  if (!isPlainObject(x)) return false
  if (x.version !== STATE_VERSION) return false
  if (typeof x.seed !== 'number' || !Number.isInteger(x.seed) || x.seed < 0) return false
  if (!isPlainObject(x.units)) return false
  for (const [k, v] of Object.entries(x.units)) {
    if (!UNIT_SET.has(k)) return false
    if (!isUnitRecord(v)) return false
  }
  for (const u of UNIT_IDS) if (!(u in x.units)) return false
  if (!isPlainObject(x.predictions)) return false
  for (const v of Object.values(x.predictions)) if (typeof v !== 'string') return false
  if (typeof x.sampleNights !== 'boolean') return false
  for (const k of Object.keys(x)) if (!['version', 'seed', 'units', 'predictions', 'sampleNights'].includes(k)) return false
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
