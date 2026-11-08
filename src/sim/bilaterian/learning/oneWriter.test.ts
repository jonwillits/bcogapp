import { describe, it, expect } from 'vitest'

/**
 * The one-writer test of the Module 5 spec's §9 — the other half of what
 * replaces `noLearning.test.ts`.
 *
 * Lab 4 asserted that `setWiring` was the only code path that writes a stored
 * weight, because the student was the only thing in the room that could
 * change one. Module 5 adds a second writer on purpose, and exactly one:
 * `learnWeights`, the learning rule's write. This walks the simulation and
 * both scenes and fails if a third appears, or if either moves.
 *
 * In Labs 4 and 5 the rule writes weights and nothing else. A threshold and
 * a routing switch still have one writer everywhere.
 *
 * Module 7 extended this test rather than loosening it. The fish's hidden
 * layer adds weights but no writer: `src/sim/fish/` and its scene are walked
 * too and must contain no write at all. And the fish's rule moves a baseline
 * — the weight on an input that is always 1 — through `learnWeights` itself,
 * which only Module 7 asks it to do.
 *
 * Module 9 extends it again. The rat's two head-direction rings are built
 * from rate units whose weights are set at construction and never written;
 * the landmark weights onto the upper ring are the scene's one learner and
 * are written only by `learnWeights`. `src/sim/rodent/` and its scene are
 * walked and must contain no write at all.
 */

const sim = import.meta.glob('../**/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const scenes = import.meta.glob('../../../scenes/{m04_bilaterian,m05_learning}/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

// Module 7's fish has a hidden layer, and so more weights to write. It gets no writer of its own.
const fish = import.meta.glob('../../fish/**/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const fishScene = import.meta.glob('../../../scenes/m07_fish/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

// Module 9's rat: two rings and learned landmark weights, and again no writer of its own.
const rodent = import.meta.glob('../../rodent/**/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const ratScene = import.meta.glob('../../../scenes/m09_rat/**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

// Module 10's memory layer: the tendency unit, the fast store's fixed stage and the slow learner's hidden layer, with no writer of their own.
const memory = import.meta.glob('../../memory/**/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const memoryScene = import.meta.glob('../../../scenes/m10_memory/**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

// Module 11's learners: Part 4's contest learner and Part 6's two cells, and again no writer of their own.
const social = import.meta.glob('../../social/**/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const socialScene = import.meta.glob('../../../scenes/m11_social/**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

// Module 12's hominins: Learned value, the Copier's fallback and the Shallow planner's critic, on the Verdict setting, and again no writer of their own.
const planning = import.meta.glob('../../planning/**/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const planningScene = import.meta.glob('../../../scenes/m12_planning/**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const production = Object.entries({ ...sim, ...scenes, ...fish, ...fishScene, ...rodent, ...ratScene, ...memory, ...memoryScene, ...social, ...socialScene, ...planning, ...planningScene }).filter(
  ([p]) => !p.includes('.test.') && !p.includes('.probe.'),
)

const WEIGHT_WRITE = /\.weights\s*\[[^\]]*\]\s*[-+*/]?=(?!=)/g
const WEIGHTS_REPLACED = /\.weights\s*=(?!=)/g

/** The body of a top-level `export function name(...) { ... }`, by brace matching. */
function bodyOf(src: string, name: string): string {
  const at = src.indexOf(`export function ${name}(`)
  expect(at, name).toBeGreaterThanOrEqual(0)
  // Skip the parameter list — a default value may hold braces — then the return type.
  let i = src.indexOf('(', at)
  for (let depth = 0; i < src.length; i++) {
    if (src[i] === '(') depth++
    else if (src[i] === ')' && --depth === 0) break
  }
  const open = src.indexOf('{', i)
  let depth = 0
  for (let k = open; k < src.length; k++) {
    if (src[k] === '{') depth++
    else if (src[k] === '}' && --depth === 0) return src.slice(open, k + 1)
  }
  throw new Error(`unterminated ${name}`)
}

describe('exactly two code paths write a stored weight', () => {
  it('finds the sources', () => {
    expect(production.some(([p]) => p.endsWith('/circuit.ts'))).toBe(true)
    expect(production.some(([p]) => p === './rule.ts')).toBe(true)
    expect(production.some(([p]) => p === './learner.ts')).toBe(true)
    expect(production.some(([p]) => p.includes('/scenes/m04_bilaterian/'))).toBe(true)
    expect(production.some(([p]) => p.endsWith('/fish/brain.ts'))).toBe(true)
    expect(production.some(([p]) => p.endsWith('/fish/world.ts'))).toBe(true)
  })

  it('setWiring, and the learning rule — and nothing else', () => {
    const writers = production
      .map(([path, src]) => ({ path, writes: [...src.matchAll(WEIGHT_WRITE)].length }))
      .filter((w) => w.writes > 0)
    expect(writers.map((w) => w.path).sort()).toEqual(['../circuit.ts', './rule.ts'])
    for (const w of writers) expect(w.writes, w.path).toBe(1)
    for (const [path, src] of production) expect([...src.matchAll(WEIGHTS_REPLACED)].length, path).toBe(0)
  })

  it('each write sits inside the function that owns it', () => {
    const circuit = production.find(([p]) => p.endsWith('/circuit.ts'))![1]
    const rule = production.find(([p]) => p === './rule.ts')![1]
    expect([...bodyOf(circuit, 'setWiring').matchAll(WEIGHT_WRITE)].length).toBe(1)
    expect([...bodyOf(rule, 'learnWeights').matchAll(WEIGHT_WRITE)].length).toBe(1)
  })

  it('the rule never writes a threshold or a routing switch: those still have one writer', () => {
    for (const [path, src] of production) {
      if (path.endsWith('/circuit.ts')) continue
      expect(src, path).not.toMatch(/\.threshold\s*[-+*/]?=(?!=)/)
      expect(src, path).not.toMatch(/\.routes\s*\[[^\]]*\]\s*=(?!=)/)
    }
  })

  it('a baseline has the same two writers as a weight, and the second only when Module 7 asks', () => {
    // The baseline is the weight on an input that is always 1. `learnWeights`
    // moves it when it is handed `alwaysOn`, in the same statement block as
    // the weights. Labs 4 and 5 never hand it one.
    const BASELINE_WRITE = /\.baseline\s*[-+*/]?=(?!=)/g
    const writers = production
      .map(([path, src]) => ({ path, writes: [...src.matchAll(BASELINE_WRITE)].length }))
      .filter((w) => w.writes > 0)
    expect(writers.map((w) => w.path).sort()).toEqual(['../circuit.ts', './rule.ts'])
    for (const w of writers) expect(w.writes, w.path).toBe(1)
    const rule = production.find(([p]) => p === './rule.ts')![1]
    expect([...bodyOf(rule, 'learnWeights').matchAll(BASELINE_WRITE)].length).toBe(1)
    expect(bodyOf(rule, 'learnWeights')).toMatch(/if \(alwaysOn\) unit\.baseline =/)
    for (const [path, src] of production) {
      if (path.includes('/fish/') || path === './rule.ts') continue
      expect(src, path).not.toMatch(/alwaysOn/)
    }
  })

  it('the fish reaches a weight only through those two writes', () => {
    const brain = production.find(([p]) => p.endsWith('/fish/brain.ts'))![1]
    expect(brain).toMatch(/learnWeights\(out, /)
    expect(brain).toMatch(/learnWeights\(hidden\[j\], /)
    for (const [path, src] of production) {
      if (!path.includes('/fish/') && !path.includes('/m07_fish/')) continue
      expect([...src.matchAll(WEIGHT_WRITE)].length, path).toBe(0)
      expect([...src.matchAll(WEIGHTS_REPLACED)].length, path).toBe(0)
    }
  })

  it('the rat reaches a weight only through learnWeights, and only for the upper ring’s view weights', () => {
    const ring = production.find(([p]) => p.endsWith('/rodent/spatial/ring.ts'))![1]
    expect(ring).toMatch(/learnWeights\(this\.upper\[j\], /)
    for (const [path, src] of production) {
      if (!path.includes('/rodent/') && !path.includes('/m09_rat/')) continue
      expect([...src.matchAll(WEIGHT_WRITE)].length, path).toBe(0)
      expect([...src.matchAll(WEIGHTS_REPLACED)].length, path).toBe(0)
      expect(src, path).not.toMatch(/alwaysOn/)
    }
  })

  it('Module 10 reaches a weight only through learnWeights: the tendency unit, the slow learner’s two layers, and nothing in the store or the scene', () => {
    const tendency = production.find(([p]) => p.endsWith('/memory/foragers/tendency.ts'))![1]
    const slow = production.find(([p]) => p.endsWith('/memory/foragers/slow.ts'))![1]
    expect(tendency).toMatch(/learnWeights\(this\.unit, /)
    expect(slow).toMatch(/learnWeights\(this\.outputs\[k\], /)
    expect(slow).toMatch(/learnWeights\(this\.hidden\[j\], /)
    for (const [path, src] of production) {
      if (!path.includes('/memory/') && !path.includes('/m10_memory/')) continue
      expect([...src.matchAll(WEIGHT_WRITE)].length, path).toBe(0)
      expect([...src.matchAll(WEIGHTS_REPLACED)].length, path).toBe(0)
    }
    // The fast store's separation stage is fixed: nothing in store.ts learns.
    const store = production.find(([p]) => p.endsWith('/memory/foragers/store.ts'))![1]
    expect(store).not.toMatch(/learnWeights/)
  })

  it('Module 11 reaches a weight only through learnWeights: Part 4’s learner and Part 6’s cells, and nothing in the game, the arena or the scene', () => {
    const learner = production.find(([p]) => p.endsWith('/social/arena/learner.ts'))![1]
    const cells = production.find(([p]) => p.endsWith('/social/mirror/cells.ts'))![1]
    expect(learner).toMatch(/learnWeights\(this\.output, /)
    expect(learner).toMatch(/learnWeights\(this\.hidden\[j\], /)
    expect(cells).toMatch(/learnWeights\(this\.unit, /)
    expect(cells).toMatch(/thirdFactor\('prediction'/)
    for (const [path, src] of production) {
      if (!path.includes('/social/') && !path.includes('/m11_social/')) continue
      expect([...src.matchAll(WEIGHT_WRITE)].length, path).toBe(0)
      expect([...src.matchAll(WEIGHTS_REPLACED)].length, path).toBe(0)
    }
    // The game's rules are tables of moves, not weights, and learn nothing.
    for (const [path, src] of production) if (path.includes('/social/game/')) expect(src, path).not.toMatch(/learnWeights|thirdFactor/)
  })

  it('Module 12 reaches a weight only through learnWeights: the value learner’s actors and critic, on the Verdict setting, and nothing in the range, the day or the scene', () => {
    const learner = production.find(([p]) => p.endsWith('/planning/hominins/valueLearner.ts'))![1]
    expect(learner).toMatch(/learnWeights\(this\.actors\[a\], /)
    expect(learner).toMatch(/learnWeights\(this\.critic, /)
    expect(learner).toMatch(/thirdFactor\('verdict'/)
    for (const [path, src] of production) {
      if (!path.includes('/planning/') && !path.includes('/m12_planning/')) continue
      expect([...src.matchAll(WEIGHT_WRITE)].length, path).toBe(0)
      expect([...src.matchAll(WEIGHTS_REPLACED)].length, path).toBe(0)
      expect(src, path).not.toMatch(/alwaysOn/)
    }
    // The planners' model is counts and estimates, not weights, and learns nothing by the rule.
    for (const [path, src] of production) if (path.endsWith('/planning/hominins/model.ts') || path.endsWith('/planning/hominins/planners.ts')) expect(src, path).not.toMatch(/learnWeights|thirdFactor/)
  })

  it('the learner reaches a weight only through that one write', () => {
    const learner = production.find(([p]) => p === './learner.ts')![1]
    expect(learner).toMatch(/learnWeights\(this\.actor/)
    expect(learner).toMatch(/learnWeights\(this\.critic/)
  })
})
