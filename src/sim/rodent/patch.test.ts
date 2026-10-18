import { describe, it, expect } from 'vitest'
import { HABITATS, SETTINGS, averageRate, bestSetting, habitatById, predictedSetting, tryEverySetting, Night } from './patch'

/**
 * The closer's tests (spec §14): the best leaving setting is sooner in the
 * rich habitat than in the poor one over 20 seeds, and falls within one
 * step of the setting the habitat's average rate predicts.
 */
const SEEDS = Array.from({ length: 20 }, (_, i) => 500 + i)
const stepIndex = (s: number) => SETTINGS.indexOf(s)

describe('Stay or Go', () => {
  it('the habitat’s average rate predicts leaving sooner in the rich habitat', () => {
    const rich = averageRate(habitatById('rich'))
    const poor = averageRate(habitatById('poor'))
    expect(rich.rate).toBeGreaterThan(poor.rate)
    expect(rich.setting).toBeLessThan(poor.setting)
    expect(predictedSetting(habitatById('rich'))).toBeLessThan(predictedSetting(habitatById('poor')))
  })

  it('over 20 seeds the best setting is sooner in the rich habitat than in the poor one, and within one step of the predicted setting', () => {
    const best: Record<string, number[]> = { rich: [], poor: [] }
    for (const h of HABITATS) {
      for (const seed of SEEDS) best[h.id].push(bestSetting(tryEverySetting(h, seed)))
    }
    const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]
    expect(median(best.rich)).toBeLessThan(median(best.poor))
    for (const h of HABITATS) {
      const within = best[h.id].filter((b) => Math.abs(stepIndex(b) - stepIndex(predictedSetting(h))) <= 1).length
      expect(within, `${h.id}: best settings ${best[h.id].join(',')} vs predicted ${predictedSetting(h)}`).toBeGreaterThanOrEqual(SEEDS.length / 2)
    }
  })

  it('a night is seeded and the forager’s position is always somewhere definite', () => {
    const a = new Night(habitatById('rich'), 8, 3)
    const b = new Night(habitatById('rich'), 8, 3)
    a.run(600)
    b.run(600)
    expect(a.result()).toEqual(b.result())
    expect(a.beetles).toBeGreaterThan(10)
    const p = a.position()
    expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true)
  })
})
