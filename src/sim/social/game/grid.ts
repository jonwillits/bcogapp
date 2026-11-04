import { makeRng, type Rng } from '../../random'
import { expectedPayoff } from './exact'
import { playMatch, rulePlayer, type Player } from './match'
import { predictorPlayer } from './predictor'
import { ruleById, type RuleId } from './rules'
import { entryId, entryLabel, type Entry } from './tournament'

/**
 * The cycle (spec §6.7, decisions 4 and 13): a grid of cells, each playing
 * one of a set of entries, against its neighbors for a few rounds a
 * generation, then copying a rule, then mutating a little. No cell chooses
 * anything (§12, line 13).
 *
 * The entries are any set of the tournament's (Jon, 2026-11-02): the six
 * rules, the student's rule, and Predictor, chosen on the left; the
 * default and the measured setting is the spec's three, *Always
 * cooperate*, *Always defect* and *Tit-for-tat*. A cell holds the index of
 * its entry in the grid's list.
 *
 * The settings are a search space (§6.7): four or eight neighbors; the
 * copy-the-best-neighbor update (after Nowak and May, 1992) or the legacy
 * lab's update (cull the lowest-scoring share, refill from living
 * neighbors, a random rule where none is alive); rounds per encounter;
 * noise; mutation; the grid's size; whether the edges wrap or bound the
 * grid; and whether an encounter's payoff is the exact expected value or
 * rounds played with realized noise. `cycle.probe.ts` runs the search;
 * `game.test.ts` holds the shipped setting to its targets.
 *
 * A cell's score is its average points per encounter, so that on a bounded
 * grid a cell with fewer neighbors (five on an edge, three in a corner) is
 * compared fairly; on a wrapping grid every cell has the same number of
 * neighbors and the average orders the cells exactly as the total does.
 */

export const GRID_RULES: readonly RuleId[] = ['allc', 'alld', 'tft']
/** The index of an entry in the grid's list. */
export type GridRule = number
export const GRID_RULE_LABELS = ['Always cooperate', 'Always defect', 'Tit-for-tat'] as const
/** The default entries, in the spec's order: the three indices 0, 1, 2 are always-cooperate, always-defect and tit-for-tat. */
export const DEFAULT_GRID_ENTRIES: Entry[] = GRID_RULES.map((id) => ({ kind: 'rule' as const, rule: ruleById(id) }))
/** The cycle's order, by entry id: tit-for-tat → always-cooperate → always-defect → tit-for-tat. */
export const CYCLE_NEXT_ID: Record<string, string> = { tft: 'allc', allc: 'alld', alld: 'tft' }
/** The cycle's order over the default entries' indices. */
export const CYCLE_NEXT: Record<number, number> = { 2: 0, 0: 1, 1: 2 }

export type GridUpdate = 'best' | 'legacy'
export type GridPayoff = 'exact' | 'played'
export type GridBoundary = 'wrap' | 'bounded'
/** 'mixed', or the id of the entry that fills the whole grid. */
export type StartWorld = string

export interface GridSettings {
  width: number
  height: number
  neighbors: 4 | 8
  update: GridUpdate
  rounds: number
  noise: number
  mutation: number
  payoff: GridPayoff
  boundary: GridBoundary
  /** Legacy update only: the share of cells that survive a generation. */
  keep: number
}

/** The shipped setting (§6.7): chosen by the cycle search in `cycle.probe.ts`; the as-built notes record the table. */
export const SHIPPED_GRID: GridSettings = { width: 40, height: 40, neighbors: 8, update: 'best', rounds: 10, noise: 0.05, mutation: 0.002, payoff: 'exact', boundary: 'wrap', keep: 0.5 }

export const MUTATIONS = [0, 0.002, 0.01] as const
export const START_WORLDS: { id: StartWorld; label: string }[] = [
  { id: 'tft', label: 'All tit-for-tat' },
  { id: 'allc', label: 'All always-cooperate' },
  { id: 'alld', label: 'All always-defect' },
  { id: 'mixed', label: 'Mixed at random' },
]

/** The start worlds for a set of entries: all of each entry (the spec's three worded as §6.7 words them), then mixed. */
export function startWorldsFor(entries: Entry[]): { id: StartWorld; label: string }[] {
  const named = new Map(START_WORLDS.map((w) => [w.id, w.label]))
  return [...entries.map((e) => ({ id: entryId(e), label: named.get(entryId(e)) ?? `All ${entryLabel(e)}` })), { id: 'mixed', label: 'Mixed at random' }]
}

const OFFSETS_4 = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
]
const OFFSETS_8 = [...OFFSETS_4, [1, 1], [1, -1], [-1, 1], [-1, -1]]

/** Seeds for a played pair with Predictor in the encounter table. */
export const ENCOUNTER_SEEDS = 50

function playerOf(e: Entry): Player<unknown> {
  return (e.kind === 'rule' ? rulePlayer(e.rule) : predictorPlayer(e.options)) as Player<unknown>
}

/**
 * The table of expected points per encounter at a noise level and rounds,
 * row against column, the engine's own numbers: exact for two rules; for a
 * pair with Predictor, the mean over ENCOUNTER_SEEDS played encounters,
 * since Predictor is not a table of moves.
 */
export function encounterTable(rounds: number, noise: number, entries: Entry[] = DEFAULT_GRID_ENTRIES, seeds = ENCOUNTER_SEEDS): number[][] {
  const n = entries.length
  const table: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0))
  for (let i = 0; i < n; i++) {
    for (let j = i; j < n; j++) {
      const a = entries[i]
      const b = entries[j]
      if (a.kind === 'rule' && b.kind === 'rule') {
        const e = expectedPayoff(a.rule, b.rule, rounds, noise)
        table[i][j] = e.a
        table[j][i] = e.b
      } else {
        let toA = 0
        let toB = 0
        for (let s = 0; s < seeds; s++) {
          const m = playMatch(playerOf(a), playerOf(b), rounds, noise, makeRng(7000 + s * 7919 + i * 131 + j))
          toA += m.totalA
          toB += m.totalB
        }
        table[i][j] = toA / seeds
        table[j][i] = toB / seeds
      }
    }
  }
  return table
}

export interface Change {
  generation: number
  from: GridRule
  to: GridRule
  inOrder: boolean
}

export class Grid {
  readonly settings: GridSettings
  readonly entries: Entry[]
  readonly cells: Uint8Array
  /** Each cell's average points per encounter this generation. */
  readonly scores: Float64Array
  /** The table of expected points per encounter, row against column. */
  readonly table: number[][]
  generation = 0
  /** The most common rule at each generation so far. */
  readonly mostCommon: GridRule[] = []
  private readonly rng: Rng
  /** Each cell's neighbors' indices, with the boundary applied. */
  private readonly neighbors: Int32Array[]

  constructor(settings: GridSettings, seed: number, entries: Entry[] = DEFAULT_GRID_ENTRIES) {
    if (entries.length < 2) throw new Error('a grid needs at least two entries')
    this.settings = settings
    this.entries = entries
    this.cells = new Uint8Array(settings.width * settings.height)
    this.scores = new Float64Array(settings.width * settings.height)
    this.table = encounterTable(settings.rounds, settings.noise, entries)
    this.rng = makeRng(seed)
    const offsets = settings.neighbors === 4 ? OFFSETS_4 : OFFSETS_8
    this.neighbors = []
    for (let y = 0; y < settings.height; y++) {
      for (let x = 0; x < settings.width; x++) {
        const list: number[] = []
        for (const [dx, dy] of offsets) {
          const nx = x + dx
          const ny = y + dy
          if (settings.boundary === 'bounded' && (nx < 0 || ny < 0 || nx >= settings.width || ny >= settings.height)) continue
          list.push(this.index(nx, ny))
        }
        this.neighbors.push(Int32Array.from(list))
      }
    }
  }

  get size(): number {
    return this.cells.length
  }

  get n(): number {
    return this.entries.length
  }

  /** The cell at (x, y), wrapping either coordinate. */
  index(x: number, y: number): number {
    const { width, height } = this.settings
    return ((y + height) % height) * width + ((x + width) % width)
  }

  /** The number of neighbors a cell has: 8 (or 4) everywhere on a wrapping grid, fewer on a bounded grid's edges. */
  neighborCount(i: number): number {
    return this.neighbors[i].length
  }

  indexOfEntry(id: string): GridRule {
    const k = this.entries.findIndex((e) => entryId(e) === id)
    if (k < 0) throw new Error(`no entry ${id} in this grid`)
    return k
  }

  start(world: StartWorld): void {
    const fill = world === 'mixed' ? -1 : this.indexOfEntry(world)
    for (let i = 0; i < this.cells.length; i++) this.cells[i] = fill < 0 ? this.rng.int(this.n) : fill
    this.generation = 0
    this.mostCommon.length = 0
    this.majority.length = 0
    this.mostCommon.push(this.commonest())
    this.logMajority()
  }

  /** Drop a block of tit-for-tat (or another entry) at the grid's middle (§6.7). */
  dropBlock(side: 2 | 3, id = 'tft'): void {
    const rule = this.indexOfEntry(id)
    const x0 = Math.floor(this.settings.width / 2) - 1
    const y0 = Math.floor(this.settings.height / 2) - 1
    for (let dy = 0; dy < side; dy++) for (let dx = 0; dx < side; dx++) this.cells[this.index(x0 + dx, y0 + dy)] = rule
  }

  shares(): number[] {
    const n = new Array<number>(this.n).fill(0)
    for (let i = 0; i < this.cells.length; i++) n[this.cells[i]]++
    return n.map((c) => c / this.cells.length)
  }

  commonest(): GridRule {
    const s = this.shares()
    let best: GridRule = 0
    for (let r = 1; r < this.n; r++) if (s[r] > s[best]) best = r
    return best
  }

  private score(): void {
    this.scores.fill(0)
    if (this.settings.payoff === 'exact') {
      for (let i = 0; i < this.cells.length; i++) {
        const nb = this.neighbors[i]
        let total = 0
        for (let k = 0; k < nb.length; k++) total += this.table[this.cells[i]][this.cells[nb[k]]]
        this.scores[i] = nb.length ? total / nb.length : 0
      }
      return
    }
    // Play each pair once and credit both sides, then average.
    const totals = new Float64Array(this.cells.length)
    for (let i = 0; i < this.cells.length; i++) {
      const nb = this.neighbors[i]
      for (let k = 0; k < nb.length; k++) {
        const j = nb[k]
        if (j <= i) continue
        const m = playMatch(playerOf(this.entries[this.cells[i]]), playerOf(this.entries[this.cells[j]]), this.settings.rounds, this.settings.noise, this.rng)
        totals[i] += m.totalA
        totals[j] += m.totalB
      }
    }
    for (let i = 0; i < this.cells.length; i++) this.scores[i] = this.neighbors[i].length ? totals[i] / this.neighbors[i].length : 0
  }

  /** One generation: score, copy, mutate. */
  step(): void {
    const { update, mutation } = this.settings
    this.score()
    const next = new Uint8Array(this.cells.length)
    if (update === 'best') {
      for (let i = 0; i < this.cells.length; i++) {
        let best = this.scores[i]
        let candidates = [i]
        const nb = this.neighbors[i]
        for (let k = 0; k < nb.length; k++) {
          const j = nb[k]
          if (this.scores[j] > best + 1e-9) {
            best = this.scores[j]
            candidates = [j]
          } else if (Math.abs(this.scores[j] - best) <= 1e-9) candidates.push(j)
        }
        next[i] = this.cells[candidates.length === 1 ? candidates[0] : candidates[this.rng.int(candidates.length)]]
      }
    } else {
      // The legacy update: the lowest-scoring share die; each dead cell takes the rule of a random living neighbor, or a random rule if none is alive.
      const order = Array.from(this.cells, (_, i) => i).sort((a, b) => this.scores[a] - this.scores[b] || a - b)
      const dead = new Uint8Array(this.cells.length)
      const culled = Math.floor(this.cells.length * (1 - this.settings.keep))
      for (let k = 0; k < culled; k++) dead[order[k]] = 1
      for (let i = 0; i < this.cells.length; i++) {
        if (!dead[i]) {
          next[i] = this.cells[i]
          continue
        }
        const alive: number[] = []
        const nb = this.neighbors[i]
        for (let k = 0; k < nb.length; k++) if (!dead[nb[k]]) alive.push(nb[k])
        next[i] = alive.length ? this.cells[alive[this.rng.int(alive.length)]] : this.rng.int(this.n)
      }
    }
    if (mutation > 0) for (let i = 0; i < next.length; i++) if (this.rng.next() < mutation) next[i] = this.rng.int(this.n)
    this.cells.set(next)
    this.generation++
    this.mostCommon.push(this.commonest())
    this.logMajority()
  }

  run(generations: number): void {
    for (let g = 0; g < generations; g++) this.step()
  }

  /** The rule holding more than half the grid at each generation so far, or -1 where none does. */
  readonly majority: (GridRule | -1)[] = []

  /**
   * The changes of the rule that holds the grid: a change is counted when a
   * rule passes half the grid after another rule held it, each marked
   * whether it ran in the cycle's order. A flicker between two rules that
   * each hold under half is not a change (the spec's 3 to 8 changes per
   * 1,000 generations count takeovers, not flickers).
   */
  changes(): Change[] {
    const out: Change[] = []
    let holder: GridRule | -1 = -1
    for (let g = 0; g < this.majority.length; g++) {
      const m = this.majority[g]
      if (m === -1 || m === holder) continue
      if (holder !== -1) out.push({ generation: g, from: holder, to: m, inOrder: CYCLE_NEXT_ID[entryId(this.entries[holder])] === entryId(this.entries[m]) })
      holder = m
    }
    return out
  }

  private logMajority(): void {
    const s = this.shares()
    let m: GridRule | -1 = -1
    for (let r = 0; r < this.n; r++) if (s[r] > 0.5) m = r
    this.majority.push(m)
  }

  /** Run until `rule` passes half the grid, or `limit` generations; returns the generation or null. */
  runUntilMajority(rule: GridRule, limit: number): number | null {
    for (let g = 0; g < limit; g++) {
      if (this.shares()[rule] > 0.5) return this.generation
      this.step()
    }
    return this.shares()[rule] > 0.5 ? this.generation : null
  }
}

/** A table of the cycle search's outcomes for one setting over seeds (§6.7 targets). */
export interface CycleOutcome {
  settings: GridSettings
  seeds: number
  /** Generations to pass half the grid from each start world, per seed; null where it never did within the limit. */
  tftToAllc: (number | null)[]
  allcToAlld: (number | null)[]
  alldToTftMutants: (number | null)[]
  alldToTftBlock: (number | null)[]
  /** Changes of the most common rule in 1,000 generations from a mixed start, per seed, and how many ran in the cycle's order. */
  mixedChanges: { changes: number; inOrder: number }[]
}

export function measureCycle(settings: GridSettings, seeds: number, seedBase = 1000, limit = 1000, blockSide: 2 | 3 = 2): CycleOutcome {
  const out: CycleOutcome = { settings, seeds, tftToAllc: [], allcToAlld: [], alldToTftMutants: [], alldToTftBlock: [], mixedChanges: [] }
  for (let s = 0; s < seeds; s++) {
    const seed = seedBase + s
    let g = new Grid(settings, seed)
    g.start('tft')
    out.tftToAllc.push(g.runUntilMajority(0, limit))
    g = new Grid(settings, seed)
    g.start('allc')
    out.allcToAlld.push(g.runUntilMajority(1, limit))
    g = new Grid(settings, seed)
    g.start('alld')
    out.alldToTftMutants.push(g.runUntilMajority(2, limit))
    g = new Grid(settings, seed)
    g.start('alld')
    g.dropBlock(blockSide)
    out.alldToTftBlock.push(g.runUntilMajority(2, limit))
    g = new Grid(settings, seed)
    g.start('mixed')
    g.run(limit)
    const ch = g.changes()
    out.mixedChanges.push({ changes: ch.length, inOrder: ch.filter((c) => c.inOrder).length })
  }
  return out
}

export const median = (v: (number | null)[]): number | null => {
  const nums = v.filter((x): x is number => x !== null).sort((a, b) => a - b)
  if (!nums.length) return null
  return nums[Math.floor(nums.length / 2)]
}
