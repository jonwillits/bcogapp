import type { ProgressStore } from '../../../sim/memory/progress/store'
import { arrangementFor, checklistOrder, type Arrangement } from '../../../sim/memory/room/arrangements'
import { itemById } from '../../../sim/memory/room/items'
import { scoreChecklist, type ChecklistAnswer, type ChecklistScore, type Confidence, type Part3Result } from '../../../sim/memory/room/checklist'
import { PATH_SECONDS } from '../../../sim/memory/room/path'
import type { PartStore } from '../contract'

/**
 * Part 3's state (spec §7): one unit, `p3-room`, from the room through the
 * checklist. The instruction screen, the room for 30 seconds on its fixed
 * path, the counting task, the checklist's own instruction screen, the
 * checklist one item at a time, then the reveal. An interrupted unit
 * restarts with the other arrangement (the progress store's materials
 * slot). Nothing about an item's type, and no mark of present or absent,
 * is computed for display before the commit (`room.test.tsx`).
 */

export type RoomPhase = 'intro' | 'room' | 'count' | 'checklist-intro' | 'checklist' | 'revealed'

export const COUNT_SECONDS = 30
export const UNIT = 'p3-room' as const

export class RoomStore implements PartStore {
  readonly seed: number
  readonly progress: ProgressStore
  phase: RoomPhase = 'intro'
  /** The arrangement this run shows, from the materials slot. */
  arrangement: Arrangement
  readonly restarted: boolean
  /** Seconds of the path shown so far, from the frame loop. */
  roomT = 0
  /** Wall-clock seconds the room was shown, measured. */
  roomSeconds = 0
  private roomStartedAt = 0
  /** The checklist's order and the answers so far. */
  readonly order: string[]
  readonly answers: ChecklistAnswer[] = []
  /** The item being answered: first in or not, then how sure. */
  pendingInRoom: boolean | null = null
  /** The result once complete. */
  result: Part3Result | null = null
  score: ChecklistScore | null = null
  /** Whether the models have loaded, so Begin can be pressed. */
  loaded = false
  version = 0
  private listeners = new Set<() => void>()

  constructor(seed: number, progress: ProgressStore) {
    this.seed = seed
    this.progress = progress
    const slot = progress.materialsSlot(UNIT)
    this.restarted = progress.restarts(UNIT) > 0
    const saved = progress.isComplete(UNIT) ? (progress.result(UNIT) as Part3Result) : null
    this.arrangement = saved ? saved.arrangement : arrangementFor(seed, slot)
    this.order = checklistOrder(seed, this.arrangement)
    if (saved) {
      this.result = saved
      this.answers.push(...saved.answers)
      this.score = scoreChecklist(saved.arrangement, saved.answers)
      this.phase = 'revealed'
    }
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  changed(): void {
    this.version++
    for (const fn of this.listeners) fn()
  }

  setLoaded(): void {
    if (this.loaded) return
    this.loaded = true
    this.changed()
  }

  /** Begin: the unit is in progress from here, and the room shows for PATH_SECONDS. */
  begin(): void {
    if (this.phase !== 'intro' || !this.loaded) return
    this.progress.begin(UNIT)
    this.phase = 'room'
    this.roomT = 0
    this.roomStartedAt = performance.now()
    this.changed()
  }

  /** The frame loop: the path advances while the room shows. */
  tick(dt: number): void {
    if (this.phase !== 'room') return
    this.roomT += dt
    if (this.roomT >= PATH_SECONDS) {
      this.roomSeconds = (performance.now() - this.roomStartedAt) / 1000
      this.phase = 'count'
      this.changed()
    }
  }

  /** The counting task is over. */
  countDone(): void {
    if (this.phase !== 'count') return
    this.phase = 'checklist-intro'
    this.changed()
  }

  beginChecklist(): void {
    if (this.phase !== 'checklist-intro') return
    this.phase = 'checklist'
    this.changed()
  }

  get currentItem(): { id: string; name: string; index: number } | null {
    if (this.phase !== 'checklist') return null
    const i = this.answers.length
    if (i >= this.order.length) return null
    return { id: this.order[i], name: itemById(this.order[i]).name, index: i }
  }

  answerInRoom(inRoom: boolean): void {
    if (this.phase !== 'checklist' || !this.currentItem) return
    this.pendingInRoom = inRoom
    this.changed()
  }

  answerConfidence(c: Confidence): void {
    const item = this.currentItem
    if (this.phase !== 'checklist' || !item || this.pendingInRoom === null) return
    this.answers.push({ id: item.id, inRoom: this.pendingInRoom, confidence: c })
    this.pendingInRoom = null
    if (this.answers.length >= this.order.length) this.commit()
    this.changed()
  }

  private commit(): void {
    const result: Part3Result = { arrangement: this.arrangement, answers: [...this.answers], roomSeconds: this.roomSeconds, restarted: this.restarted }
    this.progress.complete(UNIT, result)
    this.result = result
    this.score = scoreChecklist(result.arrangement, result.answers)
    this.phase = 'revealed'
  }

  /** The fixed status lines beside the view. */
  statusLines(): string[] {
    switch (this.phase) {
      case 'room':
        return [`Room shown ${String(Math.min(PATH_SECONDS, Math.floor(this.roomT))).padStart(3)} s of ${PATH_SECONDS}`, 'Look at the room']
      case 'count':
        return ['The room is over', 'Count backward']
      case 'checklist':
        return [`Item ${String(this.answers.length + 1).padStart(2)} of ${this.order.length}`, this.pendingInRoom === null ? 'In the room, or not?' : 'How sure are you?']
      default:
        return []
    }
  }
}
