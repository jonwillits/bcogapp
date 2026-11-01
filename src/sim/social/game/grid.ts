import { makeRng, type Rng } from '../../random'
import { expectedPayoff } from './exact'
import { playMatch, rulePlayer } from './match'
import { ruleById, type RuleId } from './rules'

/**
 * The cycle (spec §6.7, decisions 4 and 13): a grid of cells, each playing
 * one of three rules, *Always cooperate*, *Always defect* and *Tit-for-tat*,
 * against its neighbors for a few rounds a generation, then copying a
 * rule, then mutating a little. No cell chooses anything (§12, line 13).
 *
 * The settings are a search space (§6.7): four or eight neighbors; the
 * copy-the-best-neighbor update (after Nowak and May, 1992) or the legacy
 * lab's update (cull the lowest-scoring share, refill from living
 * neighbors, a random rule where none is alive); rounds per encounter;
 * noise; mutation; the grid's size; and whether an encounter's payoff is
 * the exact expected value or rounds played with realized noise.
 * `cycle.probe.ts` runs the search; `game.test.ts` holds the shipped
 * setting to its targets.
 */

export const GRID_RULES: readonly RuleId[] = ['allc', 'alld', 'tft']
export type GridRule = 0 | 1 | 2
export const GRID_RULE_LABELS = ['Always cooperate', 'Always defect', 'Tit-for-tat'] as const
/** The cycle's order: tit-for-tat → always-cooperate → always-defect → tit-for-tat. */
export const CYCLE_NEXT: Record<GridRule, GridRule> = { 2: 0, 0: 1, 1: 2 }

export type GridUpdate = 'best' | 'legacy'
export type GridPayoff = 'exact' | 'played'
export type StartWorld = 'tft' | 'allc' | 'alld' | 'mixed'

export interface GridSettings {
  width: number
  height: number
  neighbors: 4 | 8
  update: GridUpdate
  rounds: number
  noise: number
  mutation: number
  payoff: GridPayoff
  /** Legacy update only: the share of cells that survive a generation. */
  keep: number
}

/** The shipped setting (§6.7): chosen by the cycle search in `cycle.probe.ts`; the as-built notes record the table. */
export const SHIPPED_GRID: GridSettings = { width: 40, height: 40, neighbors: 8, update: 'best', rounds: 10, noise: 0.05, mutation: 0.002, payoff: 'exact', keep: 0.5 }

export const MUTATIONS = [0, 0.002, 0.01] as const
export const START_WORLDS: { id: StartWorld; label: string }[] = [
  { id: 'tft', label: 'All tit-for-tat' },
  { id: 'allc', label: 'All always-cooperate' },
  { id: 'alld', label: 'All always-defect' },
  { id: 'mixed', label: 'Mixed at random' },
]

const OFFSETS_4 = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
]
const OFFSETS_8 = [...OFFSETS_4, [1, 1], [1, -1], [-1, 1], [-1, -1]]

/** The 3 × 3 table of expected points per encounter at a noise level and rounds, the engine's own numbers. */
export function encounterTable(rounds: number, noise: number): number[][] {
  return GRID_RULES.map((a) => GRID_RULES.map((b) => expectedPayoff(ruleById(a), ruleById(b), rounds, noise).a))
}

export interface Change {
  generation: number
  from: GridRule
  to: GridRule
  inOrder: boolean
}

export class Grid {
  readonly settings: GridSettings
  readonly cells: Uint8Array
  readonly scores: Float64Array
  generation = 0
  /** The most common rule at each generation so far. */
  readonly mostCommon: GridRule[] = []
  private readonly table: number[][]
  private readonly rng: Rng
  private readonly offsets: number[][]

  constructor(settings: GridSettings, seed: number) {
    this.settings = settings
    this.cells = new Uint8Array(settings.width * settings.height)
    this.scores = new Float64Array(settings.width * settings.height)
    this.table = encounterTable(settings.rounds, settings.noise)
    this.rng = makeRng(seed)
    this.offsets = settings.neighbors === 4 ? OFFSETS_4 : OFFSETS_8
  }

  get size(): number {
    return this.cells.length
  }

  index(x: number, y: number): number {
    const { width, height } = this.settings
    return ((y + height) % height) * width + ((x + width) % width)
  }

  start(world: StartWorld): void {
    const fill: Record<Exclude<StartWorld, 'mixed'>, GridRule> = { tft: 2, allc: 0, alld: 1 }
    for (let i = 0; i < this.cells.length; i++) this.cells[i] = world === 'mixed' ? (this.rng.int(3) as GridRule) : fill[world]
    this.generation = 0
    this.mostCommon.length = 0
    this.majority.length = 0
    this.mostCommon.push(this.commonest())
    this.logMajority()
  }

  /** Drop a block of tit-for-tat at the grid's middle (§6.7). */
  dropBlock(side: 2 | 3): void {
    const x0 = Math.floor(this.settings.width / 2) - 1
    const y0 = Math.floor(this.settings.height / 2) - 1
    for (let dy = 0; dy < side; dy++) for (let dx = 0; dx < side; dx++) this.cells[this.index(x0 + dx, y0 + dy)] = 2
  }

  shares(): [number, number, number] {
    const n = [0, 0, 0]
    for (let i = 0; i < this.cells.length; i++) n[this.cells[i]]++
    return [n[0] / this.cells.length, n[1] / this.cells.length, n[2] / this.cells.length]
  }

  commonest(): GridRule {
    const s = this.shares()
    let best: GridRule = 0
    for (const r of [1, 2] as GridRule[]) if (s[r] > s[best]) best = r
    return best
  }

  private score(): void {
    const { width, height } = this.settings
    this.scores.fill(0)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x
        let total = 0
        for (const [dx, dy] of this.offsets) {
          const j = this.index(x + dx, y + dy)
          if (this.settings.payoff === 'exact') total += this.table[this.cells[i]][this.cells[j]]
          else if (j > i) {
            // Play each pair once and credit both sides.
            const m = playMatch(rulePlayer(ruleById(GRID_RULES[this.cells[i]])), rulePlayer(ruleById(GRID_RULES[this.cells[j]])), this.settings.rounds, this.settings.noise, this.rng)
            total += m.totalA
            this.scores[j] += m.totalB
          }
        }
        this.scores[i] += total
      }
    }
  }

  /** One generation: score, copy, mutate. */
  step(): void {
    const { width, height, update, mutation } = this.settings
    this.score()
    const next = new Uint8Array(this.cells.length)
    if (update === 'best') {
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const i = y * width + x
          let best = this.scores[i]
          let candidates = [i]
          for (const [dx, dy] of this.offsets) {
            const j = this.index(x + dx, y + dy)
            if (this.scores[j] > best + 1e-9) {
              best = this.scores[j]
              candidates = [j]
            } else if (Math.abs(this.scores[j] - best) <= 1e-9) candidates.push(j)
          }
          next[i] = this.cells[candidates.length === 1 ? candidates[0] : candidates[this.rng.int(candidates.length)]]
        }
      }
    } else {
      // The legacy update: the lowest-scoring share die; each dead cell takes the rule of a random living neighbor, or a random rule if none is alive.
      const order = Array.from(this.cells, (_, i) => i).sort((a, b) => this.scores[a] - this.scores[b] || a - b)
      const dead = new Uint8Array(this.cells.length)
      const culled = Math.floor(this.cells.length * (1 - this.settings.keep))
      for (let k = 0; k < culled; k++) dead[order[k]] = 1
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const i = y * width + x
          if (!dead[i]) {
            next[i] = this.cells[i]
            continue
          }
          const alive: number[] = []
          for (const [dx, dy] of this.offsets) {
            const j = this.index(x + dx, y + dy)
            if (!dead[j]) alive.push(j)
          }
          next[i] = alive.length ? this.cells[alive[this.rng.int(alive.length)]] : (this.rng.int(3) as GridRule)
        }
      }
    }
    if (mutation > 0) for (let i = 0; i < next.length; i++) if (this.rng.next() < mutation) next[i] = this.rng.int(3) as GridRule
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
      if (holder !== -1) out.push({ generation: g, from: holder, to: m, inOrder: CYCLE_NEXT[holder] === m })
      holder = m
    }
    return out
  }

  private logMajority(): void {
    const s = this.shares()
    let m: GridRule | -1 = -1
    for (const r of [0, 1, 2] as GridRule[]) if (s[r] > 0.5) m = r
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
