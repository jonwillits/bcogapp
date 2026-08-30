import { describe, it, expect } from 'vitest'
import { makeRng } from './random'

describe('seeded randomness', () => {
  it('the same seed replays the same stream', () => {
    const a = makeRng(12345)
    const b = makeRng(12345)
    const draws = 200
    for (let i = 0; i < draws; i++) {
      expect(a.next()).toBe(b.next())
    }
  })

  it('different seeds diverge', () => {
    const a = makeRng(1)
    const b = makeRng(2)
    const first = Array.from({ length: 20 }, () => a.next())
    const second = Array.from({ length: 20 }, () => b.next())
    expect(first).not.toEqual(second)
  })

  it('mixed draw kinds stay reproducible together', () => {
    // The real usage pattern: a run interleaves uniforms, normals and integers
    // from one stream. Reproducibility has to survive that interleaving, not
    // just a run of identical calls.
    const take = (r: ReturnType<typeof makeRng>) => [
      r.next(),
      r.normal(),
      r.int(10),
      r.range(-3, 3),
      r.normal(),
      r.next(),
    ]
    expect(take(makeRng(99))).toEqual(take(makeRng(99)))
  })

  it('uniforms stay in [0, 1) and integers in [0, n)', () => {
    const r = makeRng(7)
    for (let i = 0; i < 5000; i++) {
      const u = r.next()
      expect(u).toBeGreaterThanOrEqual(0)
      expect(u).toBeLessThan(1)
      const n = r.int(6)
      expect(n).toBeGreaterThanOrEqual(0)
      expect(n).toBeLessThan(6)
      expect(Number.isInteger(n)).toBe(true)
    }
  })

  it('normal draws are roughly standard normal', () => {
    // Mutation size is a normal draw, and the acceptance tests tune sigma
    // against it, so a mis-scaled normal would quietly move every tuning
    // target. Loose bounds -- this is a smoke test, not a statistics exam.
    const r = makeRng(2026)
    const n = 20000
    let sum = 0
    let sumSq = 0
    for (let i = 0; i < n; i++) {
      const v = r.normal()
      sum += v
      sumSq += v * v
    }
    const mean = sum / n
    const sd = Math.sqrt(sumSq / n - mean * mean)
    expect(Math.abs(mean)).toBeLessThan(0.05)
    expect(sd).toBeGreaterThan(0.95)
    expect(sd).toBeLessThan(1.05)
  })

  it('a forked stream is independent but still reproducible from the seed', () => {
    const parent = makeRng(42)
    const childA = parent.fork()
    const parent2 = makeRng(42)
    const childB = parent2.fork()
    expect(childA.next()).toBe(childB.next())
  })

  it('nothing in the sim layer calls Math.random()', async () => {
    // The rule that Part 2 rests on, enforced rather than remembered. Only
    // `randomSeed()` may reach for it, and that runs once before a run starts.
    const { readdirSync, readFileSync, statSync } = await import('node:fs')
    const { join } = await import('node:path')
    const root = new URL('.', import.meta.url).pathname

    const offenders: string[] = []
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const p = join(dir, entry)
        if (statSync(p).isDirectory()) {
          walk(p)
        } else if (entry.endsWith('.ts') && !entry.endsWith('.test.ts')) {
          const src = readFileSync(p, 'utf8')
          // `random.ts` itself is the one sanctioned caller.
          if (entry === 'random.ts') continue
          if (src.includes('Math.random(')) offenders.push(entry)
        }
      }
    }
    walk(root)
    expect(offenders).toEqual([])
  })
})
