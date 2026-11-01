import { randomSeed } from '../random'
import type { RawStorage } from './storage'
import { isSavedState, newState, type ProgressSchema, type SavedState } from './state'

/**
 * Saved progress on the student's own device (Lab 10's spec §4.2–§4.4,
 * generalized). One state, saved whole after every change through the one
 * storage the lab hands in; when the storage cannot be written the state
 * lives in memory and `storageAvailable` says so, so the scene can show the
 * line that results will be lost if the page is closed.
 *
 * **Units.** A completed unit is saved and never redone. A unit found 'in
 * progress' when the page loads was interrupted: it is discarded, the
 * materials it showed are consumed, and it starts again on the next reserve
 * (`spec.reservesFor`). A unit the lab marks as resuming is the exception:
 * it resumes with the items already answered (`partial`).
 *
 * **Locks.** Which parts can open, and why not, is the lab's
 * (`spec.canOpen`, `spec.lockReason`).
 */

export interface ProgressSpec<U extends string, P extends number, F extends string> {
  schema: ProgressSchema<U, F>
  storage: RawStorage
  /** How many sets of materials a unit has: the first is its own, the rest are reserves for a restart. */
  reservesFor(unit: U): number
  /** Whether an interrupted unit resumes with its partial rather than restarting. */
  resumes(unit: U): boolean
  partOf(unit: U): P
  /** The units a part must have completed before it counts as finished; a part with none never does. */
  unitsOfPart(part: P): U[]
  canOpen(part: P, state: SavedState<U, F>): boolean
  /** One line saying why a tab cannot open yet, naming the part that unlocks it. */
  lockReason(part: P, state: SavedState<U, F>): string
}

export interface InterruptedUnit<U extends string> {
  unit: U
  /** The slot the restart uses. */
  materials: number
  /** No reserve was left: the last slot is reused, and the scene says so. */
  exhausted: boolean
}

export class ProgressStore<U extends string, P extends number, F extends string> {
  state: SavedState<U, F>
  storageAvailable: boolean
  /** Units found interrupted on load, for the restarted-unit line. */
  readonly interrupted: InterruptedUnit<U>[] = []
  version = 0
  readonly spec: ProgressSpec<U, P, F>
  private readonly listeners = new Set<() => void>()

  constructor(spec: ProgressSpec<U, P, F>, seed?: number) {
    this.spec = spec
    const raw = spec.storage.read()
    let parsed: unknown = null
    if (raw !== null && raw !== '') {
      try {
        parsed = JSON.parse(raw)
      } catch {
        parsed = null
      }
    }
    if (isSavedState(parsed, spec.schema)) {
      this.state = parsed
      this.storageAvailable = true
      this.discardInterrupted()
      this.save()
    } else {
      this.state = newState(seed ?? randomSeed(), spec.schema)
      // The first write says whether the storage can be used at all.
      this.storageAvailable = this.spec.storage.write(JSON.stringify(this.state))
    }
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private changed(): void {
    this.version++
    for (const fn of this.listeners) fn()
  }

  /** Every save writes the whole state; a failed write turns the storage off for the session. */
  private save(): void {
    if (!this.storageAvailable) return
    if (!this.spec.storage.write(JSON.stringify(this.state))) this.storageAvailable = false
  }

  private discardInterrupted(): void {
    for (const unit of Object.keys(this.state.units) as U[]) {
      const rec = this.state.units[unit]
      if (rec.status !== 'in progress') continue
      if (this.spec.resumes(unit)) continue // resumes with its partial
      const last = this.spec.reservesFor(unit) - 1
      const exhausted = rec.materials >= last
      rec.status = 'not started'
      rec.materials = Math.min(last, rec.materials + 1)
      rec.restarts += 1
      delete rec.result
      delete rec.partial
      this.interrupted.push({ unit, materials: rec.materials, exhausted })
    }
  }

  get seed(): number {
    return this.state.seed
  }

  /** The materials slot the unit uses now: 0 its own, then the reserves. */
  materialsSlot(unit: U): number {
    return this.state.units[unit].materials
  }

  restarts(unit: U): number {
    return this.state.units[unit].restarts
  }

  status(unit: U) {
    return this.state.units[unit].status
  }

  /** Begin a unit: it is in progress until completed, and an interrupted one is discarded on the next load. */
  begin(unit: U): void {
    const rec = this.state.units[unit]
    if (rec.status === 'complete') return
    rec.status = 'in progress'
    this.save()
    this.changed()
  }

  complete(unit: U, result: unknown): void {
    const rec = this.state.units[unit]
    if (rec.status === 'complete') return
    rec.status = 'complete'
    rec.result = result
    delete rec.partial
    this.save()
    this.changed()
  }

  /** A resuming unit's answers so far, so an interrupted unit resumes. */
  savePartial(unit: U, partial: unknown): void {
    const rec = this.state.units[unit]
    if (rec.status === 'complete') return
    rec.partial = partial
    this.save()
    this.changed()
  }

  partial(unit: U): unknown {
    return this.state.units[unit].partial
  }

  result(unit: U): unknown {
    return this.state.units[unit].result
  }

  isComplete(unit: U): boolean {
    return this.state.units[unit].status === 'complete'
  }

  partComplete(part: P): boolean {
    const units = this.spec.unitsOfPart(part)
    return units.length > 0 && units.every((u) => this.isComplete(u))
  }

  /** A committed prediction is written once and never overwritten. */
  commitPrediction(key: string, value: string): void {
    if (key in this.state.predictions) return
    this.state.predictions[key] = value
    this.save()
    this.changed()
  }

  prediction(key: string): string | null {
    return this.state.predictions[key] ?? null
  }

  canOpen(part: P): boolean {
    return this.spec.canOpen(part, this.state)
  }

  /** One line saying why a tab cannot open yet, naming the part that unlocks it; null when it can. */
  lockReason(part: P): string | null {
    if (this.canOpen(part)) return null
    return this.spec.lockReason(part, this.state)
  }

  flag(name: F): boolean {
    return this.state[name]
  }

  /** Set one of the lab's flags; saved like everything else. */
  setFlag(name: F, value: boolean): void {
    ;(this.state as Record<F, boolean>)[name] = value
    this.save()
    this.changed()
  }

  /** Clear my saved results: a new seed and an empty state. The confirmation is the scene's, in a panel on the page. */
  clear(): void {
    this.state = newState(randomSeed(), this.spec.schema)
    this.interrupted.length = 0
    this.save()
    this.changed()
  }

  /** Load my results: applied only after the in-page confirmation (`transfer.ts`). */
  replaceWith(state: SavedState<U, F>): void {
    this.state = state
    this.interrupted.length = 0
    this.discardInterrupted()
    this.save()
    this.changed()
  }

  /** Which part a unit belongs to, for the panels. */
  partOf(unit: U): P {
    return this.spec.partOf(unit)
  }
}
