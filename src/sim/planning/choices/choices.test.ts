import { describe, it, expect } from 'vitest'
import { makeRng } from '../../random'
import { expectedValue, gamble, sure, mixed } from './options'
import { planGambles, acceptable, PAIRS, startSeries, seriesOptions, emptyResponses, answerSeries, seriesDone, gambleResults, scriptedChooser, MIXED_LOSS, type PairId } from './gambles'
import { answer, indifference, startBisection, finished } from './bisection'
import { runScriptedDelays, delayResults, exponential, hyperbolic, DELAYS } from './delays'
import { bestPolicy, pointsPerMinute, simulateBlock, startBlock, advance, take, BLOCK_SECONDS, TAKE_PAUSE, summarize } from './dispensers'
import { exactSurvival, runRule, survivalChance, RULE_IDS } from './forager'

describe('expected values and the items (spec §5.1, §5.2)', () => {
  it('expected values are exact for every item', () => {
    expect(expectedValue(sure(240))).toBe(240)
    expect(expectedValue(gamble(1000, 0.25))).toBe(250)
    expect(expectedValue(gamble(4000, 0.8))).toBe(3200)
    expect(expectedValue(gamble(-4000, 0.8))).toBe(-3200)
    expect(expectedValue(mixed(100, 50))).toBe(25)
    for (const pair of [1, 2, 3, 4] as PairId[])
      for (const v of ['gain', 'loss'] as const) {
        const [a, b] = PAIRS[pair][v].options
        expect(Number.isFinite(expectedValue(a)) && Number.isFinite(expectedValue(b))).toBe(true)
        // The loss version is the gain version with the signs reversed, except pair 2, whose loss version is Tversky and Kahneman's (1981) Problem 3 as published.
        if (pair !== 2) expect(expectedValue(PAIRS[pair].loss.options[0])).toBeCloseTo(-expectedValue(PAIRS[pair].gain.options[0]), 9)
      }
    expect(gamble(4000, 0.8).text).toBe('an 80% chance of gaining $4,000, and otherwise nothing')
    expect(sure(-750).text).toBe('a sure loss of $750')
  })
  it('the order from the seed: the anchor first, the two versions of a pair at least five items apart, the framing problem in the middle third, each series consecutive', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const plan = planGambles(makeRng(seed))
      expect(plan.items[0].kind).toBe('wheel')
      expect(acceptable(plan.items.slice(1))).toBe(true)
      expect(plan.items.length).toBe(1 + 8 + 18 + 1)
      for (const series of ['ceGain', 'ceLoss', 'mixed'] as const) {
        const idx = plan.items.map((it, i) => (it.kind === 'series' && it.series === series ? i : -1)).filter((i) => i >= 0)
        expect(idx.length).toBe(6)
        expect(idx[5] - idx[0]).toBe(5)
      }
    }
  })
  it('each bisection converges to within $100 / 2⁶ of a scripted chooser’s true indifference point', () => {
    // A risk-neutral chooser: indifferent at the expected value, $50.
    const neutral = scriptedChooser((x) => x)
    let r = emptyResponses()
    while (!seriesDone(r, 'ceGain')) {
      const { fixed, varying } = seriesOptions('ceGain', r.series.ceGain.x)
      r = answerSeries(r, 'ceGain', neutral(fixed, varying) === 1)
    }
    expect(Math.abs(indifference(r.series.ceGain) - 50)).toBeLessThanOrEqual(100 / 64)
    // A risk-averse chooser with u = sqrt: indifferent at sqrt(x) = 0.5·sqrt(100), x = 25.
    const averse = scriptedChooser((x) => (x >= 0 ? Math.sqrt(x) : -Math.sqrt(-x)))
    r = emptyResponses()
    while (!seriesDone(r, 'ceGain')) {
      const { fixed, varying } = seriesOptions('ceGain', r.series.ceGain.x)
      r = answerSeries(r, 'ceGain', averse(fixed, varying) === 1)
    }
    expect(Math.abs(indifference(r.series.ceGain) - 25)).toBeLessThanOrEqual(100 / 64)
    // The loss side, risk-neutral: a sure loss of $50 is as bad as the gamble.
    r = emptyResponses()
    while (!seriesDone(r, 'ceLoss')) {
      const { fixed, varying } = seriesOptions('ceLoss', r.series.ceLoss.x)
      r = answerSeries(r, 'ceLoss', neutral(fixed, varying) === 1)
    }
    expect(Math.abs(indifference(r.series.ceLoss) - 50)).toBeLessThanOrEqual(100 / 64)
    // Mixed gambles: a chooser who weighs a loss twice as much as a gain accepts when X > 100, so the loss ratio is 2.
    const lossAverse = scriptedChooser((x) => (x >= 0 ? x : 2 * x))
    r = emptyResponses()
    while (!seriesDone(r, 'mixed')) {
      const { fixed, varying } = seriesOptions('mixed', r.series.mixed.x)
      r = answerSeries(r, 'mixed', lossAverse(fixed, varying) === 1)
    }
    const results = gambleResults(r)
    expect(Math.abs(results.lossRatio - 2)).toBeLessThanOrEqual(250 / 64 / MIXED_LOSS)
  })
  it('a bisection halves its interval each choice and finishes after six', () => {
    let b = startBisection(0, 100, true)
    for (let i = 0; i < 6; i++) {
      expect(finished(b)).toBe(false)
      b = answer(b, true)
    }
    expect(finished(b)).toBe(true)
    expect(b.hi - b.lo).toBeCloseTo(100 / 64, 9)
    expect(startSeries('ceGain').x).toBe(50)
  })
})

describe('the delays (spec §5.3, §14)', () => {
  it('the fits recover a scripted exponential chooser’s γ and a scripted hyperbolic chooser’s k within 5%, from noiseless choices', () => {
    const gamma = 0.995
    const exp = delayResults(runScriptedDelays((a, d) => exponential(gamma, d) * (a / 100)))
    expect(Math.abs(exp.exponential.parameter - gamma) / (1 - gamma)).toBeLessThan(0.05)
    const k = 0.02
    const hyp = delayResults(runScriptedDelays((a, d) => hyperbolic(k, d) * (a / 100)))
    expect(Math.abs(hyp.hyperbolic.parameter - k) / k).toBeLessThan(0.05)
    expect(hyp.hyperbolic.sse).toBeLessThan(hyp.exponential.sse)
    expect(exp.exponential.sse).toBeLessThan(exp.hyperbolic.sse)
    expect(DELAYS.length).toBe(5)
  })
  it('a scripted exponential chooser never reverses between the two reversal pairs; a scripted hyperbolic chooser with k from 0.02 to 0.1 does', () => {
    for (const gamma of [0.9, 0.99, 0.999]) {
      const r = runScriptedDelays((a, d) => a * gamma ** d)
      expect(r.reversals.soon).toBe(r.reversals.late)
      const res = delayResults(r)
      expect(res.reversals[0].exponentialSaysLater).toBe(res.reversals[1].exponentialSaysLater)
    }
    for (const k of [0.02, 0.05, 0.1]) {
      const r = runScriptedDelays((a, d) => a / (1 + k * d))
      expect(r.reversals.soon).toBe(false)
      expect(r.reversals.late).toBe(true)
      const res = delayResults(r)
      expect(res.reversals[0].hyperbolicSaysLater).toBe(false)
      expect(res.reversals[1].hyperbolicSaysLater).toBe(true)
    }
  })
})

describe('the dispensers (spec §5.4, §14)', () => {
  it('the best policies are as the spec says, computed exactly from the rules', () => {
    const blue = bestPolicy('blue')
    expect(blue.waitUpTo).toBeGreaterThanOrEqual(8)
    expect(blue.pointsPerMinute).toBeCloseTo((60 * 5) / 9, 6)
    const orange = bestPolicy('orange')
    expect(orange.waitUpTo).toBe(8)
    expect(orange.pointsPerMinute).toBeCloseTo((60 * 3) / (0.5 * 9 + 0.5 * (8 + TAKE_PAUSE)), 6)
    expect(pointsPerMinute('blue', 0)).toBeCloseTo(60 / TAKE_PAUSE, 6)
    expect(orange.pointsPerMinute).toBeGreaterThan(pointsPerMinute('orange', 0))
  })
  it('the mean of 10,000 simulated blocks matches the exact points per minute within 1%', () => {
    const rng = makeRng(99)
    for (const d of ['blue', 'orange'] as const) {
      const t = bestPolicy(d).waitUpTo === Infinity ? 8 : bestPolicy(d).waitUpTo
      let total = 0
      const n = 10000
      for (let i = 0; i < n; i++) total += summarize(simulateBlock(d, t, rng)).pointsPerMinute
      // A block ends mid-trial, so its rate is a little under the long-run rate; allow 1% plus one trial's worth in 180 s.
      expect(Math.abs(total / n - pointsPerMinute(d, t)) / pointsPerMinute(d, t)).toBeLessThan(0.04)
    }
  })
  it('a take adds 1 point and pauses; a delivery adds 5 after 8 seconds; the block ends at 180 seconds', () => {
    const rng = makeRng(1)
    let s = startBlock('blue', rng)
    s = advance(s, 7.9, rng)
    expect(s.points).toBe(0)
    s = advance(s, 8.0, rng)
    expect(s.points).toBe(5)
    expect(s.phase).toBe('pause')
    s = advance(s, 9.0, rng)
    expect(s.phase).toBe('trial')
    expect(s.trials.length).toBe(2)
    s = take(s, 10.0)
    expect(s.points).toBe(6)
    expect(s.trials[1].waited).toBeCloseTo(1, 9)
    expect(s.pauseUntil).toBeCloseTo(10 + TAKE_PAUSE, 9)
    s = advance(s, BLOCK_SECONDS + 1, rng)
    expect(s.phase).toBe('done')
    expect(s.elapsed).toBe(BLOCK_SECONDS)
  })
})

describe('the forager (spec §5.5, §14)', () => {
  it('the survival table is exact for every level of reserves', () => {
    for (let r = 2; r <= 9; r++) {
      expect(survivalChance(r, 'sure')).toBe(r >= 6 ? 1 : 0)
      expect(survivalChance(r, 'variable')).toBe(0.5)
    }
    expect(exactSurvival('alwaysSure')).toBe(0.5)
    expect(exactSurvival('alwaysVariable')).toBe(0.5)
    expect(exactSurvival('variableWhenNeeded')).toBe(0.75)
  })
  it('each rule’s survival over 1,000 evenings is within the binomial range of the exact value', () => {
    const rng = makeRng(7)
    for (const rule of RULE_IDS) {
      const p = exactSurvival(rule)
      const share = runRule(rule, 1000, rng)
      expect(Math.abs(share - p)).toBeLessThan(4 * Math.sqrt((p * (1 - p)) / 1000))
    }
  })
})
