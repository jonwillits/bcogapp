import { makeRng } from '../../../sim/random'
import type { ProgressStore } from '../../../sim/social/progress/store'
import type { UnitId } from '../../../sim/social/parts'
import { FILMS, MIN_DESCRIPTION_CHARS, type CheckId } from '../../../sim/social/shapes/films'
import { reservePaths, shownPaths, pathById, type AuthoredPath } from '../../../sim/social/paths/pool'
import { INVERSE_PLANNING, HEURISTIC, at, type Distribution } from '../../../sim/social/paths/models'
import { mazeOf } from '../../../sim/social/paths/pool'
import type { PartStore } from '../contract'

/**
 * Part 3's state (spec §7): Step 1, the three films with their
 * descriptions, a unit; then the ratings and checklist, committed
 * together; Step 2, the paths, a unit that resumes, with a judgment at
 * every pause; then the two models described and a prediction committed;
 * then the reveal. Nothing is rated until all three films are described,
 * and no model output is rendered before the prediction (`shapes.test.tsx`).
 */

export type ShapesState = 'intro' | 'film' | 'describe' | 'rate' | 'step1-done' | 'paths-intro' | 'path' | 'models-intro' | 'revealed'

export const FILMS_UNIT: UnitId = 'p3-films'
export const PATHS_UNIT: UnitId = 'p3-paths'
export const MODELS_PREDICTION = 'p3-models-overall'
export const MODELS_PREDICTION_DISAGREE = 'p3-models-disagree'
export const MAX_DESCRIPTION_CHARS = 1500
export const STEP_SECONDS = 0.7

export interface FilmsResult {
  descriptions: string[]
  ratings: number[]
  checks: CheckId[][]
  restarts: number
}

export interface PathJudgment {
  path: string
  steps: number
  split: [number, number, number]
}

export interface PathsPartial {
  judged: PathJudgment[]
  /** Paths started, in the order shown; the one in progress on an interruption is replaced by a reserve of its kind. */
  shown: string[]
}

export interface PathsResult extends PathsPartial {
  restarts: number
}

export class ShapesStore implements PartStore {
  readonly seed: number
  readonly progress: ProgressStore
  state: ShapesState = 'intro'
  version = 0
  // Step 1
  film: 1 | 2 | 3 = 1
  descriptions: string[] = ['', '', '']
  ratings: (number | null)[] = [null, null, null]
  checks: CheckId[][] = [[], [], []]
  /** The film's clock, seconds, driven by the player. */
  filmClock = 0
  filmPlaying = false
  // Step 2
  order: string[] = []
  pathIndex = 0
  steps = 0
  judged: PathJudgment[] = []
  shown: string[] = []
  /**
   * The three sliders' points, kept as fractions of 100 so that moving one
   * rescales the other two in proportion without drift (Jon, 2026-11-02:
   * rounding at every move had sent all of a slider's loss to one of the
   * others). `splitRounded` gives the integers shown and committed.
   */
  split: [number, number, number] = [100 / 3, 100 / 3, 100 / 3]
  /** Paused at a judgment point. */
  atJudgment = false
  draftOverall: string | null = null
  draftDisagree: string | null = null
  private timer: ReturnType<typeof setInterval> | null = null
  private listeners = new Set<() => void>()

  constructor(seed: number, progress: ProgressStore) {
    this.seed = seed
    this.progress = progress
    this.order = planOrder(seed)
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

  private resume(): void {
    if (this.progress.isComplete(PATHS_UNIT)) {
      const r = this.progress.result(PATHS_UNIT) as PathsResult
      this.judged = r.judged
      this.shown = r.shown
      this.state = this.progress.prediction(MODELS_PREDICTION) ? 'revealed' : 'models-intro'
      return
    }
    if (!this.progress.isComplete(FILMS_UNIT)) {
      this.state = 'intro'
      return
    }
    const partial = this.progress.partial(PATHS_UNIT) as PathsPartial | undefined
    if (partial && this.progress.status(PATHS_UNIT) === 'in progress') {
      // The path in progress is replaced by a reserve of its kind, so no path is shown twice.
      this.judged = partial.judged
      this.shown = partial.shown.slice()
      const judgedPaths = new Set(this.judged.map((j) => j.path))
      const inProgress = this.shown.filter((id) => !this.pathFinished(id, judgedPaths))
      for (const id of inProgress) {
        const kind = pathById(id).kind
        const reserve = reservePaths().find((p) => p.kind === kind && !this.order.includes(p.id) && !this.shown.includes(p.id))
        if (reserve) this.order = this.order.map((x) => (x === id ? reserve.id : x))
      }
      // Remove the replaced paths' partial judgments.
      this.judged = this.judged.filter((j) => this.order.includes(j.path))
      this.pathIndex = this.order.findIndex((id) => !this.pathFinished(id, new Set(this.judged.map((j) => j.path))))
      if (this.pathIndex < 0) this.pathIndex = this.order.length
      this.state = 'paths-intro'
      return
    }
    this.state = 'step1-done'
  }

  private pathFinished(id: string, judgedPaths: Set<string>): boolean {
    const p = pathById(id)
    return p.judgments.every((j) => this.judged.some((x) => x.path === id && x.steps === j.steps)) && judgedPaths.has(id)
  }

  get filmsDone(): boolean {
    return this.progress.isComplete(FILMS_UNIT)
  }

  filmsResult(): FilmsResult | null {
    return this.filmsDone ? (this.progress.result(FILMS_UNIT) as FilmsResult) : null
  }

  // --------------------------------------------------------------- Step 1

  beginFilms(): void {
    if (this.state !== 'intro') return
    this.progress.begin(FILMS_UNIT)
    this.film = 1
    this.descriptions = ['', '', '']
    this.state = 'film'
    this.filmClock = 0
    this.filmPlaying = true
    this.changed()
  }

  /** The player reports the film's clock; at the end the description box opens. */
  setFilmClock(t: number): void {
    this.filmClock = t
    if (this.state === 'film' && t >= FILMS[this.film - 1].duration) this.filmEnded()
    else this.changed()
  }

  filmEnded(): void {
    if (this.state !== 'film') return
    this.filmPlaying = false
    this.state = 'describe'
    this.changed()
  }

  setDescription(text: string): void {
    this.descriptions[this.film - 1] = text.slice(0, MAX_DESCRIPTION_CHARS)
    this.changed()
  }

  get canFinishDescription(): boolean {
    return this.descriptions[this.film - 1].trim().length >= MIN_DESCRIPTION_CHARS
  }

  /** After the description: the next film, or, after the third, the ratings. */
  finishDescription(): void {
    if (this.state !== 'describe' || !this.canFinishDescription) return
    if (this.film < 3) {
      this.film = (this.film + 1) as 1 | 2 | 3
      this.filmClock = 0
      this.filmPlaying = true
      this.state = 'film'
    } else this.state = 'rate'
    this.changed()
  }

  rate(film: number, rating: number): void {
    this.ratings[film] = rating
    this.changed()
  }

  toggleCheck(film: number, id: CheckId): void {
    const set = new Set(this.checks[film])
    if (id === 'c4') {
      this.checks[film] = set.has('c4') ? [] : ['c4']
    } else {
      set.delete('c4')
      if (set.has(id)) set.delete(id)
      else set.add(id)
      this.checks[film] = [...set]
    }
    this.changed()
  }

  get canCommitRatings(): boolean {
    return this.state === 'rate' && this.ratings.every((r) => r !== null) && this.checks.every((c) => c.length > 0)
  }

  commitRatings(): void {
    if (!this.canCommitRatings) return
    const result: FilmsResult = { descriptions: this.descriptions, ratings: this.ratings as number[], checks: this.checks, restarts: this.progress.restarts(FILMS_UNIT) }
    this.progress.complete(FILMS_UNIT, result)
    this.state = 'step1-done'
    this.changed()
  }

  openPaths(): void {
    if (this.state !== 'step1-done') return
    this.state = 'paths-intro'
    this.changed()
  }

  // --------------------------------------------------------------- Step 2

  get path(): AuthoredPath | null {
    const id = this.order[this.pathIndex]
    return id ? pathById(id) : null
  }

  get pathsDone(): boolean {
    return this.progress.isComplete(PATHS_UNIT)
  }

  beginPaths(): void {
    if (this.state !== 'paths-intro') return
    this.progress.begin(PATHS_UNIT)
    this.state = 'path'
    this.startPath()
    this.changed()
  }

  private startPath(): void {
    const p = this.path
    if (!p) {
      this.finishPaths()
      return
    }
    if (!this.shown.includes(p.id)) this.shown.push(p.id)
    this.steps = 0
    this.atJudgment = p.judgments.some((j) => j.steps === 0)
    this.split = [100 / 3, 100 / 3, 100 / 3]
    this.savePartial()
    this.startTimer()
  }

  private startTimer(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = setInterval(() => this.tickTimer(), STEP_SECONDS * 1000)
  }

  private tickTimer(): void {
    if (this.state !== 'path' || this.atJudgment) return
    this.advance()
  }

  /** The dot takes one step; at a judgment point it pauses. */
  advance(): void {
    const p = this.path
    if (!p) return
    if (this.steps + 1 >= p.cells.length) {
      // The goal is reached: the next path.
      this.pathIndex++
      this.startPath()
      this.changed()
      return
    }
    this.steps++
    // At a later pause on the same path the sliders stay where the student left them (Jon, 2026-11-02); they reset to thirds at each new path.
    if (p.judgments.some((j) => j.steps === this.steps) && !this.judged.some((j) => j.path === p.id && j.steps === this.steps)) this.atJudgment = true
    this.changed()
  }

  /** Move one slider: the other two rescale in proportion to their current values so the three sum to 100; two at zero split the rest equally. */
  setSplit(i: 0 | 1 | 2, value: number): void {
    const v = Math.max(0, Math.min(100, value))
    const others = [0, 1, 2].filter((k) => k !== i) as (0 | 1 | 2)[]
    const rest = 100 - v
    const sum = this.split[others[0]] + this.split[others[1]]
    const next: [number, number, number] = [...this.split] as [number, number, number]
    next[i] = v
    if (sum > 1e-9) {
      next[others[0]] = (this.split[others[0]] / sum) * rest
      next[others[1]] = rest - next[others[0]]
    } else {
      next[others[0]] = rest / 2
      next[others[1]] = rest / 2
    }
    this.split = next
    this.changed()
  }

  /** The sliders as integers summing to 100 (largest remainders rounded up), as shown and as committed. */
  splitRounded(): [number, number, number] {
    const floors = this.split.map((v) => Math.floor(v + 1e-9))
    let short = 100 - floors.reduce((a, b) => a + b, 0)
    const order = [0, 1, 2].sort((a, b) => this.split[b] - floors[b] - (this.split[a] - floors[a]))
    for (const k of order) {
      if (short <= 0) break
      floors[k]++
      short--
    }
    return floors as [number, number, number]
  }

  commitJudgment(): void {
    const p = this.path
    if (this.state !== 'path' || !this.atJudgment || !p) return
    this.judged.push({ path: p.id, steps: this.steps, split: this.splitRounded() })
    this.atJudgment = false
    this.savePartial()
    this.changed()
  }

  private savePartial(): void {
    const partial: PathsPartial = { judged: this.judged, shown: this.shown }
    this.progress.savePartial(PATHS_UNIT, partial)
  }

  private finishPaths(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    const result: PathsResult = { judged: this.judged, shown: this.shown, restarts: this.progress.restarts(PATHS_UNIT) }
    this.progress.complete(PATHS_UNIT, result)
    this.state = 'models-intro'
  }

  judgmentsSoFar(): number {
    return this.judged.length
  }

  judgmentsInAll(): number {
    return this.order.reduce((a, id) => a + pathById(id).judgments.length, 0)
  }

  // --------------------------------------------------------------- the models and the reveal

  chooseOverall(v: string): void {
    this.draftOverall = v
    this.changed()
  }

  chooseDisagree(v: string): void {
    this.draftDisagree = v
    this.changed()
  }

  get canCommitModels(): boolean {
    return this.state === 'models-intro' && this.draftOverall !== null && this.draftDisagree !== null
  }

  commitModels(): void {
    if (!this.canCommitModels) return
    this.progress.commitPrediction(MODELS_PREDICTION, this.draftOverall!)
    this.progress.commitPrediction(MODELS_PREDICTION_DISAGREE, this.draftDisagree!)
    this.state = 'revealed'
    this.changed()
  }

  /** The models' distributions at every judgment the student made, with the student's, for the reveal. */
  comparison(): { judgment: PathJudgment; inverse: Distribution; heuristic: Distribution; disagreement: number }[] {
    return this.judged.map((j) => {
      const p = pathById(j.path)
      const maze = mazeOf(p.layout)
      const inverse = at(maze, p.cells, INVERSE_PLANNING, j.steps)
      const heuristic = at(maze, p.cells, HEURISTIC, j.steps)
      const jp = p.judgments.find((x) => x.steps === j.steps)
      return { judgment: j, inverse, heuristic, disagreement: jp?.disagreement ?? 0 }
    })
  }
}

/** The order the 16 shown paths come in, drawn by the seed. */
export function planOrder(seed: number): string[] {
  const rng = makeRng(seed ^ 0x7a7)
  const ids = shownPaths().map((p) => p.id)
  for (let i = ids.length - 1; i > 0; i--) {
    const j = rng.int(i + 1)
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
  }
  return ids
}
