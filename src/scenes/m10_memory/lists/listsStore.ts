import type { ProgressStore } from '../../../sim/memory/progress/store'
import type { UnitId } from '../../../sim/memory/parts'
import { BLANK_S, SLOTS, WORD_ON_S, materialsFor, planPart1, recallSecondsFor, type Part1Plan, type Recall, type SlotMaterials } from '../../../sim/memory/words/design'
import { ASSOCIATE_LISTS, listById, type StudyList } from '../../../sim/memory/words/lists'
import { allRecognitionAnswered, planRecognition, type Judgment, type RecognitionAnswer, type RecognitionItem } from '../../../sim/memory/words/recognition'
import type { PartStore } from '../contract'
import type { ShownRecord } from '../ui'

/**
 * Part 1's state (spec §5): seven study lists in the plan's order, each a
 * unit of work, then the recognition test, then the reveal. Nothing typed
 * is scored or compared with a list, and no list word is shown back,
 * until the recognition test is complete (`'revealed'`): the panels render
 * nothing from a record before then (`lists.test.tsx`).
 *
 * The presentation runs on wall-clock timers, injected so that the tests
 * need no real time, and records how long each word was actually shown.
 */

export type ListsState = 'intro' | 'list-start' | 'present' | 'then' | 'count' | 'recall' | 'recognition-intro' | 'recognition' | 'revealed'

/** What a finished list unit saves. */
export interface ListResult {
  slot: number
  listId: string
  recall: Recall
  typed: string[]
  countFrom: number | null
  /** The counting task's right and wrong clicks (`countTyped` in records saved before 2026-10-27, when the task was typed). */
  countRight: number
  countWrong: number
  lostAssociates: boolean
  /** The reserves were exhausted and the last one was used again. */
  exhausted: boolean
  shown: ShownRecord[]
  restarts: number
}

export interface RecognitionResult {
  items: RecognitionItem[]
  answers: RecognitionAnswer[]
}

export interface Timers {
  set(fn: () => void, ms: number): unknown
  clear(id: unknown): void
  now(): number
}

const REAL_TIMERS: Timers = {
  set: (fn, ms) => setTimeout(fn, ms),
  clear: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
  now: () => performance.now(),
}

/** The fixed screen between a list and its task is shown this long. */
export const THEN_S = 1.5
export const SLOT_COUNT = SLOTS
export const RECOGNITION_UNIT: UnitId = 'p1-recognition'

export const unitOfSlot = (slot: number): UnitId => `p1-list-${slot}` as UnitId

export class ListsStore implements PartStore {
  readonly seed: number
  readonly progress: ProgressStore
  readonly plan: Part1Plan
  state: ListsState = 'intro'
  /** The slot now running, or the next to run. */
  slot = 0
  /** The materials of the slot now running. */
  materials: SlotMaterials | null = null
  exhausted = false
  /** During presentation: which word, and whether it is on. */
  wordIndex = -1
  showing = false
  /** During the recognition test: which item, and whether Old was just said and a judgment is wanted. */
  item = 0
  awaitingJudgment = false
  items: RecognitionItem[] = []
  answers: (RecognitionAnswer | null)[] = []
  version = 0
  private readonly timers: Timers
  private timer: unknown = null
  private shownAt = 0
  private shown: ShownRecord[] = []
  private listeners = new Set<() => void>()

  constructor(seed: number, progress: ProgressStore, timers: Timers = REAL_TIMERS) {
    this.seed = seed
    this.progress = progress
    this.timers = timers
    this.plan = planPart1(seed)
    this.resume()
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private changed(): void {
    this.version++
    for (const fn of this.listeners) fn()
  }

  /** Where a reload lands: the next list to run, the recognition test, or the reveal. */
  private resume(): void {
    let next = 0
    while (next < SLOT_COUNT && this.progress.isComplete(unitOfSlot(next))) next++
    this.slot = next
    if (next < SLOT_COUNT) {
      this.state = next === 0 && this.progress.restarts(unitOfSlot(0)) === 0 ? 'intro' : 'list-start'
      return
    }
    if (this.progress.isComplete(RECOGNITION_UNIT)) {
      const r = this.progress.result(RECOGNITION_UNIT) as RecognitionResult
      this.items = r.items
      this.answers = r.answers
      this.state = 'revealed'
      return
    }
    this.items = planRecognition(this.plan, this.studiedLists())
    const partial = this.progress.partial(RECOGNITION_UNIT) as (RecognitionAnswer | null)[] | undefined
    this.answers = partial && partial.length === this.items.length ? partial : this.items.map(() => null)
    this.item = this.answers.findIndex((a) => a === null)
    if (this.item < 0) this.item = this.items.length
    this.state = partial && this.progress.status(RECOGNITION_UNIT) === 'in progress' ? 'recognition' : 'recognition-intro'
  }

  /** The results of every finished list, in slot order. */
  results(): ListResult[] {
    const out: ListResult[] = []
    for (let s = 0; s < SLOT_COUNT; s++) if (this.progress.isComplete(unitOfSlot(s))) out.push(this.progress.result(unitOfSlot(s)) as ListResult)
    return out
  }

  /** The lists actually studied so far, in slot order. */
  studiedLists(): StudyList[] {
    return this.results().map((r) => listById(r.listId))
  }

  /** How many reserves were consumed by restarts before this slot (one pool for the part), plus this slot's own restarts. */
  reservesUsed(slot: number): number {
    let used = 0
    for (let s = 0; s < slot; s++) used += this.progress.materialsSlot(unitOfSlot(s))
    return used + this.progress.materialsSlot(unitOfSlot(slot))
  }

  /** The materials a slot runs with now: its own list, or a reserve after a restart; the last reserve again when none is left. */
  materialsForSlot(slot: number): { materials: SlotMaterials; exhausted: boolean } {
    let used = this.reservesUsed(slot)
    let m = materialsFor(this.plan, slot, used)
    let exhausted = false
    while (!m && used > 0) {
      used--
      m = materialsFor(this.plan, slot, used)
      exhausted = true
    }
    return { materials: m!, exhausted }
  }

  get listsDone(): number {
    return this.results().length
  }

  /** Begin the slot now due: the unit is marked in progress and the presentation starts. */
  beginList(): void {
    if (this.state !== 'intro' && this.state !== 'list-start') return
    if (this.slot >= SLOT_COUNT) return
    const { materials, exhausted } = this.materialsForSlot(this.slot)
    this.materials = materials
    this.exhausted = exhausted
    this.progress.begin(unitOfSlot(this.slot))
    this.shown = []
    this.wordIndex = -1
    this.showing = false
    this.state = 'present'
    this.changed()
    this.nextWord()
  }

  private nextWord(): void {
    const words = this.materials!.list.words
    this.wordIndex++
    if (this.wordIndex >= words.length) {
      this.showing = false
      this.state = 'then'
      this.changed()
      this.timer = this.timers.set(() => this.afterThen(), THEN_S * 1000)
      return
    }
    this.showing = true
    this.shownAt = this.timers.now()
    this.changed()
    this.timer = this.timers.set(() => this.hideWord(), WORD_ON_S * 1000)
  }

  private hideWord(): void {
    this.shown.push({ index: this.wordIndex, shownMs: this.timers.now() - this.shownAt })
    this.showing = false
    this.changed()
    this.timer = this.timers.set(() => this.nextWord(), BLANK_S * 1000)
  }

  private afterThen(): void {
    this.state = this.materials!.recall === 'delayed' ? 'count' : 'recall'
    this.changed()
  }

  /** The word on screen now, or null between words. */
  get word(): string | null {
    return this.state === 'present' && this.showing && this.materials ? this.materials.list.words[this.wordIndex] : null
  }

  get recallSeconds(): number {
    return this.materials ? recallSecondsFor(this.materials.list) : 0
  }

  private countRight = 0
  private countWrong = 0

  countDone(right: number, wrong: number): void {
    if (this.state !== 'count') return
    this.countRight = right
    this.countWrong = wrong
    this.state = 'recall'
    this.changed()
  }

  /** Recall ends: the record is saved and the next list is due. Nothing is scored. */
  recallDone(typed: string[]): void {
    if (this.state !== 'recall' || !this.materials) return
    const unit = unitOfSlot(this.slot)
    const result: ListResult = {
      slot: this.slot,
      listId: this.materials.list.id,
      recall: this.materials.recall,
      typed: [...typed],
      countFrom: this.materials.recall === 'delayed' ? this.materials.countFrom : null,
      countRight: this.countRight,
      countWrong: this.countWrong,
      lostAssociates: this.materials.lostAssociates,
      exhausted: this.exhausted,
      shown: [...this.shown],
      restarts: this.progress.restarts(unit),
    }
    this.countRight = 0
    this.countWrong = 0
    this.progress.complete(unit, result)
    this.materials = null
    this.slot++
    if (this.slot < SLOT_COUNT) this.state = 'list-start'
    else {
      this.items = planRecognition(this.plan, this.studiedLists())
      this.answers = this.items.map(() => null)
      this.item = 0
      this.state = 'recognition-intro'
    }
    this.changed()
  }

  beginRecognition(): void {
    if (this.state !== 'recognition-intro') return
    this.progress.begin(RECOGNITION_UNIT)
    this.progress.savePartial(RECOGNITION_UNIT, this.answers)
    this.state = 'recognition'
    this.changed()
  }

  get currentItem(): RecognitionItem | null {
    return this.state === 'recognition' && this.item < this.items.length ? this.items[this.item] : null
  }

  /** Old or New for the item on screen; after Old, a judgment is asked for. */
  answerOld(old: boolean): void {
    if (this.state !== 'recognition' || this.awaitingJudgment || this.item >= this.items.length) return
    if (old) {
      this.answers[this.item] = { old: true, judgment: null }
      this.awaitingJudgment = true
      this.changed()
      return
    }
    this.answers[this.item] = { old: false, judgment: null }
    this.advanceItem()
  }

  judge(j: Judgment): void {
    if (this.state !== 'recognition' || !this.awaitingJudgment) return
    this.answers[this.item] = { old: true, judgment: j }
    this.awaitingJudgment = false
    this.advanceItem()
  }

  private advanceItem(): void {
    this.item++
    if (this.item < this.items.length) {
      this.progress.savePartial(RECOGNITION_UNIT, this.answers)
      this.changed()
      return
    }
    if (allRecognitionAnswered(this.answers)) {
      const result: RecognitionResult = { items: this.items, answers: this.answers as RecognitionAnswer[] }
      this.progress.complete(RECOGNITION_UNIT, result)
      this.state = 'revealed'
    }
    this.changed()
  }

  get recognitionResult(): RecognitionResult | null {
    return this.state === 'revealed' ? { items: this.items, answers: this.answers as RecognitionAnswer[] } : null
  }

  /** The lists of associates this seed studies and holds back, for the reveal only. */
  get associateLists(): { studied: StudyList[]; controls: StudyList[]; all: StudyList[] } {
    return { studied: this.plan.studied, controls: this.plan.controls, all: ASSOCIATE_LISTS }
  }

  /** The phase line for the side panel: one fact, worded one way. */
  phaseLine(): string {
    switch (this.state) {
      case 'intro':
      case 'list-start':
        return 'Waiting to begin'
      case 'present':
        return 'Words on screen'
      case 'then':
        return 'The list has ended'
      case 'count':
        return 'Counting backward'
      case 'recall':
        return 'Typing the words'
      case 'recognition-intro':
        return 'One last test'
      case 'recognition':
        return `Word ${Math.min(this.item + 1, this.items.length)} of ${this.items.length}`
      case 'revealed':
        return 'Finished'
    }
  }

  /** Stop any timer (a component unmounting mid-presentation). The unit stays in progress and restarts on return. */
  dispose(): void {
    if (this.timer !== null) this.timers.clear(this.timer)
    this.timer = null
  }
}
