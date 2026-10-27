import { makeRng } from '../../../sim/random'
import type { ProgressStore } from '../../../sim/memory/progress/store'
import type { UnitId } from '../../../sim/memory/parts'
import { WORD_SETS, part2MaterialsFor, planPart2, scrambledGrid, type Part2Plan, type WordSet } from '../../../sim/memory/words/sets'
import type { PartStore } from '../contract'

/**
 * Part 2's state (spec §6): two units, always in this order, the first set
 * as a grid with no labels and the second as a tree with its labels. Each
 * unit runs study, the counting task and typed recall, and is saved when
 * recall ends. A unit begun and left is restarted with the reserve set.
 * Nothing typed is scored until both units are complete, and the only
 * screen that names what the two conditions are is the reveal
 * (`Reveal.tsx`).
 */

export type StudyUnit = 'first' | 'second'
export const UNITS: StudyUnit[] = ['first', 'second']
export const UNIT_ID: Record<StudyUnit, UnitId> = { first: 'p2-first', second: 'p2-second' }

export type StudyPhase = 'intro' | 'study' | 'count' | 'recall' | 'done'

/** What a unit saves: plain data, so it round-trips through JSON. */
export interface StudyResult {
  unit: StudyUnit
  set: string
  grid?: string[][]
  typed: string[]
  restarted: boolean
  /** The counting task's right and wrong clicks (`countTyped` in records saved before 2026-10-27, when the task was typed). */
  countRight: number
  countWrong: number
}

export interface StudyMaterials {
  set: WordSet
  grid?: string[][]
  /** No reserve was left, so the set shown before was used again. */
  exhausted: boolean
}

export class StudyStore implements PartStore {
  readonly seed: number
  readonly progress: ProgressStore
  readonly plan: Part2Plan
  unit: StudyUnit = 'first'
  phase: StudyPhase = 'intro'
  materials: StudyMaterials | null = null
  countFrom = 0
  countRight = 0
  countWrong = 0
  version = 0
  private listeners = new Set<() => void>()

  constructor(seed: number, progress: ProgressStore) {
    this.seed = seed
    this.progress = progress
    this.plan = planPart2(seed)
    this.unit = this.result('first') ? 'second' : 'first'
    this.phase = this.bothDone ? 'done' : 'intro'
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private changed(): void {
    this.version++
    for (const fn of this.listeners) fn()
  }

  result(unit: StudyUnit): StudyResult | null {
    return (this.progress.isComplete(UNIT_ID[unit]) ? (this.progress.result(UNIT_ID[unit]) as StudyResult) : null) ?? null
  }

  get bothDone(): boolean {
    return !!this.result('first') && !!this.result('second')
  }

  /** The materials for a unit now, given the restarts the progress store has recorded. */
  materialsFor(unit: StudyUnit): StudyMaterials {
    const restarts = this.progress.materialsSlot(UNIT_ID[unit])
    const other = UNITS.find((u) => u !== unit)!
    const otherUsedReserve = this.result(other)?.set === this.plan.reserve.id
    const m = restarts === 0 ? part2MaterialsFor(this.plan, unit, 0)! : otherUsedReserve ? null : part2MaterialsFor(this.plan, unit, 1)
    if (m) return { set: m.set, grid: m.grid, exhausted: false }
    // Nothing left: the unit's own set again, drawn afresh where it is a grid.
    const own = part2MaterialsFor(this.plan, unit, 0)!
    const rng = makeRng(this.seed ^ 0x2a7d ^ (0x77 * (restarts + 1)))
    return { set: own.set, grid: unit === 'first' ? scrambledGrid(own.set, rng) : undefined, exhausted: true }
  }

  /** Begin the current unit: it is in progress until recall ends, and an interrupted one restarts with the reserve. */
  begin(): void {
    if (this.phase !== 'intro' || this.bothDone) return
    const id = UNIT_ID[this.unit]
    this.progress.begin(id)
    this.materials = this.materialsFor(this.unit)
    this.countFrom = makeRng(this.seed ^ 0x2c0 ^ (this.unit === 'first' ? 1 : 2) ^ (this.progress.materialsSlot(id) << 4)).int(800) + 200
    this.countRight = 0
    this.countWrong = 0
    this.phase = 'study'
    this.changed()
  }

  studyDone(): void {
    if (this.phase !== 'study') return
    this.phase = 'count'
    this.changed()
  }

  countDone(right: number, wrong: number): void {
    if (this.phase !== 'count') return
    this.countRight = right
    this.countWrong = wrong
    this.phase = 'recall'
    this.changed()
  }

  recallDone(typed: string[]): void {
    if (this.phase !== 'recall' || !this.materials) return
    const id = UNIT_ID[this.unit]
    const result: StudyResult = {
      unit: this.unit,
      set: this.materials.set.id,
      grid: this.materials.grid,
      typed: [...typed],
      restarted: this.progress.restarts(id) > 0,
      countRight: this.countRight,
      countWrong: this.countWrong,
    }
    this.progress.complete(id, result)
    this.materials = null
    if (this.unit === 'first' && !this.result('second')) {
      this.unit = 'second'
      this.phase = 'intro'
    } else this.phase = 'done'
    this.changed()
  }

  /** The set a saved result used. */
  static setOf(r: StudyResult): WordSet {
    return WORD_SETS.find((s) => s.id === r.set)!
  }
}
