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
 * The rule writes weights and nothing else. A baseline, a threshold and a
 * routing switch still have one writer.
 */

const sim = import.meta.glob('../**/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const scenes = import.meta.glob('../../../scenes/{m04_bilaterian,m05_learning}/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const production = Object.entries({ ...sim, ...scenes }).filter(([p]) => !p.includes('.test.') && !p.includes('.probe.'))

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

  it('the rule never writes a baseline, a threshold or a routing switch: those still have one writer', () => {
    for (const [path, src] of production) {
      if (path.endsWith('/circuit.ts')) continue
      expect(src, path).not.toMatch(/\.baseline\s*[-+*/]?=(?!=)/)
      expect(src, path).not.toMatch(/\.threshold\s*[-+*/]?=(?!=)/)
      expect(src, path).not.toMatch(/\.routes\s*\[[^\]]*\]\s*=(?!=)/)
    }
  })

  it('the learner reaches a weight only through that one write', () => {
    const learner = production.find(([p]) => p === './learner.ts')![1]
    expect(learner).toMatch(/learnWeights\(this\.actor/)
    expect(learner).toMatch(/learnWeights\(this\.critic/)
  })
})
