import { describe, it, expect } from 'vitest'
import { makeRng } from '../../random'
import { oneTray, trayStats, lewontinFirst, lewontinSecond, twins, TWIN_PRESET, poorAndRich, seasons, EARRINGS, PLANTS, MODEL } from './model'

describe('the corn model (spec §8, §14)', () => {
  it('heritability is 0 within a uniform line and within 0.05 of 1 for varied stock in even soil, over 20 seeds', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const rng = makeRng(seed)
      expect(trayStats(oneTray('uniform', 'even', rng)).heritability).toBe(0)
      expect(trayStats(oneTray('uniform', 'patchy', rng)).heritability).toBe(0)
      const varied = trayStats(oneTray('varied', 'even', rng))
      expect(Math.abs(varied.heritability - 1)).toBeLessThan(0.05)
      const patchy = trayStats(oneTray('varied', 'patchy', rng)).heritability
      expect(patchy).toBeGreaterThan(0.2)
      expect(patchy).toBeLessThan(0.8)
    }
  })
  it('a tray holds 48 plants', () => {
    expect(oneTray('varied', 'even', makeRng(1)).plants.length).toBe(PLANTS)
  })
  it('in Lewontin’s first experiment, heritability within each line is 0 and the lines differ; in the second, within each tray about 1 and the difference between trays is the nutrients’, by construction', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const rng = makeRng(seed)
      const [a, b] = lewontinFirst(rng)
      expect(trayStats(a).heritability).toBe(0)
      expect(trayStats(b).heritability).toBe(0)
      expect(Math.abs(trayStats(a).meanHeight - trayStats(b).meanHeight)).toBeGreaterThan(10)
      const [c, d] = lewontinSecond(rng)
      expect(Math.abs(trayStats(c).heritability - 1)).toBeLessThan(0.05)
      expect(Math.abs(trayStats(d).heritability - 1)).toBeLessThan(0.05)
      expect(c.plants.map((p) => p.genetic)).toEqual(d.plants.map((p) => p.genetic))
      const diff = trayStats(c).meanHeight - trayStats(d).meanHeight
      expect(Math.abs(diff - (MODEL.meanHeight.complete - MODEL.meanHeight.deficient))).toBeLessThan(1)
      const [, e] = lewontinSecond(makeRng(seed), 'nitratesRestored')
      expect(trayStats(c).meanHeight - trayStats(e).meanHeight).toBeGreaterThan(20)
      expect(trayStats(c).meanHeight - trayStats(e).meanHeight).toBeLessThan(diff)
    }
  })
  it('the twin estimate equals the true share from genes within sampling error when the fourth slider is at zero, and exceeds it when the slider is above zero; the preset gives the chapter’s figures', () => {
    const rng = makeRng(3)
    let sum = 0
    for (let i = 0; i < 20; i++) {
      const r = twins({ genes: 0.5, shared: 0.2, rest: 0.3, identicalOnly: 0 }, rng)
      sum += r.estimate
    }
    expect(Math.abs(sum / 20 - 0.5)).toBeLessThan(0.05)
    let over = 0
    for (let i = 0; i < 20; i++) {
      const r = twins({ genes: 0.4, shared: 0.2, rest: 0.2, identicalOnly: 0.2 }, rng)
      if (r.estimate > r.trueShare + 0.1) over++
    }
    expect(over).toBeGreaterThanOrEqual(18)
    let mz = 0
    let dz = 0
    for (let i = 0; i < 20; i++) {
      const r = twins(TWIN_PRESET, rng)
      mz += r.identical
      dz += r.fraternal
    }
    expect(Math.abs(mz / 20 - 0.71)).toBeLessThan(0.03)
    expect(Math.abs(dz / 20 - 0.44)).toBeLessThan(0.03)
  })
  it('poor soil lowers heritability by capping heights; six seasons raise the mean by about a standard deviation while heritability stays high', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const rng = makeRng(seed)
      const [poor, rich] = poorAndRich(rng)
      expect(trayStats(poor).heritability).toBeLessThan(0.3)
      expect(trayStats(rich).heritability).toBeGreaterThan(0.55)
      expect(poor.plants.map((p) => p.potential)).toEqual(rich.plants.map((p) => p.potential))
      const s = seasons(rng)
      expect(s.length).toBe(6)
      const sd0 = Math.sqrt(s[0].stats.varianceHeight)
      expect(Math.abs(s[5].stats.meanHeight - s[0].stats.meanHeight - sd0)).toBeLessThan(sd0 * 0.6)
      for (const season of s) expect(season.stats.heritability).toBeGreaterThan(0.9)
    }
  })
  it('the earrings: heritability 1 when only women wore them, 0 when anyone might', () => {
    expect(EARRINGS.then.heritability).toBe(1)
    expect(EARRINGS.now.heritability).toBe(0)
  })
})
