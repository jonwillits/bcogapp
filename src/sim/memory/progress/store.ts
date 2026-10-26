import { randomSeed } from '../../random'
import { partOf, reservesFor, unitsOfPart, type Part, type UnitId } from '../parts'
import { BROWSER_STORAGE, type RawStorage } from './storage'
import { isSavedState, newState, type SavedState } from './state'

/**
 * Saved progress on the student's own device (spec §4.2–§4.4). One state,
 * saved whole after every change through the one storage key; when the
 * storage cannot be written the state lives in memory and `storageAvailable`
 * says so, so the scene can show the line that results will be lost if the
 * page is closed.
 *
 * **Units.** A completed unit is saved and never redone. A unit found 'in
 * progress' when the page loads was interrupted: it is discarded, the
 * materials it showed are consumed, and it starts again on the next reserve
 * (`reservesFor`). The recognition test is the exception: it resumes with
 * the items already answered (`partial`).
 *
 * **Locks.** Parts 2 and 3 open once Part 1 is finished; Part 5 once Part 4
 * is, or through *Use a sample set of nights*. Parts 0, 1 and 4 are always
 * open.
 */

export interface InterruptedUnit {
  unit: UnitId
  /** The slot the restart uses. */
  materials: number
  /** No reserve was left: the last slot is reused, and the scene says so. */
  exhausted: boolean
}

export class ProgressStore {
  state: SavedState
  storageAvailable: boolean
  /** Units found interrupted on load, for the restarted-unit line (spec §11, line 12). */
  readonly interrupted: InterruptedUnit[] = []
  version = 0
  private readonly storage: RawStorage
  private readonly listeners = new Set<() => void>()

  constructor(storage: RawStorage = BROWSER_STORAGE, seed?: number) {
    this.storage = storage
    const raw = storage.read()
    let parsed: unknown = null
    if (raw !== null && raw !== '') {
      try {
        parsed = JSON.parse(raw)
      } catch {
        parsed = null
      }
    }
    if (isSavedState(parsed)) {
      this.state = parsed
      this.storageAvailable = true
      this.discardInterrupted()
      this.save()
    } else {
      this.state = newState(seed ?? randomSeed())
      // The first write says whether the storage can be used at all.
      this.storageAvailable = this.storage.write(JSON.stringify(this.state))
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
    if (!this.storage.write(JSON.stringify(this.state))) this.storageAvailable = false
  }

  private discardInterrupted(): void {
    for (const unit of Object.keys(this.state.units) as UnitId[]) {
      const rec = this.state.units[unit]
      if (rec.status !== 'in progress') continue
      if (unit === 'p1-recognition') continue // resumes with its partial
      const last = reservesFor(unit) - 1
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
  materialsSlot(unit: UnitId): number {
    return this.state.units[unit].materials
  }

  restarts(unit: UnitId): number {
    return this.state.units[unit].restarts
  }

  status(unit: UnitId) {
    return this.state.units[unit].status
  }

  /** Begin a unit: it is in progress until completed, and an interrupted one is discarded on the next load. */
  begin(unit: UnitId): void {
    const rec = this.state.units[unit]
    if (rec.status === 'complete') return
    rec.status = 'in progress'
    this.save()
    this.changed()
  }

  complete(unit: UnitId, result: unknown): void {
    const rec = this.state.units[unit]
    if (rec.status === 'complete') return
    rec.status = 'complete'
    rec.result = result
    delete rec.partial
    this.save()
    this.changed()
  }

  /** The recognition test's answers so far, so an interrupted test resumes. */
  savePartial(unit: UnitId, partial: unknown): void {
    const rec = this.state.units[unit]
    if (rec.status === 'complete') return
    rec.partial = partial
    this.save()
    this.changed()
  }

  partial(unit: UnitId): unknown {
    return this.state.units[unit].partial
  }

  result(unit: UnitId): unknown {
    return this.state.units[unit].result
  }

  isComplete(unit: UnitId): boolean {
    return this.state.units[unit].status === 'complete'
  }

  partComplete(part: Part): boolean {
    if (part === 0 || part === 5) return false
    return unitsOfPart(part).every((u) => this.isComplete(u))
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

  canOpen(part: Part): boolean {
    switch (part) {
      case 2:
      case 3:
        return this.partComplete(1)
      case 5:
        return this.partComplete(4) || this.state.sampleNights
      default:
        return true
    }
  }

  /** One line saying why a tab cannot open yet, naming the part that unlocks it; null when it can. */
  lockReason(part: Part): string | null {
    if (this.canOpen(part)) return null
    if (part === 5) return 'Opens once Part 4 is finished, or with a sample set of nights.'
    return 'Opens once Part 1 is finished.'
  }

  useSampleNights(): void {
    this.state.sampleNights = true
    this.save()
    this.changed()
  }

  /** Clear my saved results: a new seed and an empty state. The confirmation is the scene's, in a panel on the page. */
  clear(): void {
    this.state = newState(randomSeed())
    this.interrupted.length = 0
    this.save()
    this.changed()
  }

  /** Load my results: applied only after the in-page confirmation (`transfer.ts`). */
  replaceWith(state: SavedState): void {
    this.state = state
    this.interrupted.length = 0
    this.discardInterrupted()
    this.save()
    this.changed()
  }

  /** Which part a unit belongs to, for the panels. */
  static partOf(unit: UnitId): Part {
    return partOf(unit)
  }
}
