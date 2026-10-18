import { describe, it, expect } from 'vitest'
import { makeRng } from '../../random'
import { HeadDirection, N, NUDGE_MAX, RING, CRITICAL_DRIVE, LANDMARK_WEIGHT_MAX, VIEW_UNITS, boundedNudge, type LandmarkView } from './ring'
import { angleDiff, deg, rad, wrapPositive } from './angles'

/**
 * The spatial-system tests of the Module 9 spec's §14 that concern the
 * rings alone, headless. The session-level ones (a card's takeover, its
 * rotation, moves in sight, the lesion over a day) are in
 * `../recording.test.ts`, because they need a body in a room.
 */

const DT = 0.02
const card = (bearing: number, strength = 1): LandmarkView[] => [{ id: 'card', bearing, strength }]

/** Hand-set weights, as a test may: the card at bearing 0 drives upper units around `alignment` with a bell peaking at `peak`. */
function teach(hd: HeadDirection, alignment: number, peak: number) {
  for (let j = 0; j < N; j++) {
    const d = angleDiff(alignment, HeadDirection.preferred(j))
    hd.upper[j].weights[1] = peak * Math.exp(-(d * d) / (2 * RING.excitationWidth * RING.excitationWidth))
  }
  hd.learning = false
}

describe('the lower ring: a ring attractor built from Lab 4’s rate units', () => {
  it('settles into a single bump from any starting state, and with no turn and no noise the bump holds its place (drift under 5° a minute)', () => {
    for (const start of [0, rad(90), rad(200), rad(-45)]) {
      const hd = new HeadDirection(makeRng(1), ['card'], start)
      const d0 = hd.decodeLower()
      expect(d0.strength).toBeGreaterThan(0.75)
      expect(Math.abs(deg(angleDiff(start, d0.heading)))).toBeLessThan(3)
      // Exactly one bump: the units over half-max form one contiguous run around the ring.
      const over = [...hd.lowerRate].map((r) => r > 0.5)
      let runs = 0
      for (let j = 0; j < N; j++) if (over[j] && !over[(j + N - 1) % N]) runs++
      expect(runs).toBe(1)
      for (let t = 0; t < 60 / DT; t++) hd.step(DT, 0, [], true)
      expect(Math.abs(deg(angleDiff(d0.heading, hd.decodeLower().heading)))).toBeLessThan(5)
    }
  })

  it('from a flat start with the pathway intact, a bump forms', () => {
    const hd = new HeadDirection(makeRng(2), ['card'], 0)
    hd.lowerRate.fill(0.1)
    for (let t = 0; t < 5 / DT; t++) hd.step(DT, 0, [])
    expect(hd.decodeLower().strength).toBeGreaterThan(0.7)
  })

  it('the upper ring’s bump sits where the lower ring’s does, within the width of one unit', () => {
    const hd = new HeadDirection(makeRng(3), ['card'], rad(120))
    for (let t = 0; t < 10 / DT; t++) {
      hd.step(DT, rad(45), [])
      const gap = Math.abs(deg(angleDiff(hd.decodeLower().heading, hd.decodeUpper().heading)))
      expect(gap).toBeLessThan(360 / N)
    }
    expect(hd.decodeUpper().strength).toBeGreaterThan(0.6)
  })

  it('a turn moves the bump by the same angle, within 5%, for slow and fast turns (30°/s and 180°/s)', () => {
    for (const speed of [30, 180]) {
      for (const sign of [1, -1]) {
        const hd = new HeadDirection(makeRng(4), ['card'], 0)
        const h0 = hd.decodeLower().heading
        for (let t = 0; t < 0.8 / DT; t++) hd.step(DT, sign * rad(speed), [], true)
        const moved = deg(angleDiff(h0, hd.decodeLower().heading))
        const expected = sign * speed * 0.8
        expect(Math.abs(moved - expected) / Math.abs(expected), `${sign * speed}°/s`).toBeLessThan(0.05)
      }
    }
  })

  it('in the dark, with noise, the bump’s error grows over simulated minutes', () => {
    const errors: number[] = []
    for (const minutes of [1, 5]) {
      let sum = 0
      for (let seed = 0; seed < 8; seed++) {
        const hd = new HeadDirection(makeRng(100 + seed), ['card'], 0)
        const rng = makeRng(200 + seed)
        let heading = 0
        let omega = 0
        for (let t = 0; t < (minutes * 60) / DT; t++) {
          omega += -omega * DT + 1.2 * Math.sqrt(2 * DT) * rng.normal()
          heading += omega * DT
          hd.step(DT, omega + 0.1 * rng.normal(), [])
        }
        sum += angleDiff(heading, hd.heading()) ** 2
      }
      errors.push(deg(Math.sqrt(sum / 8)))
    }
    expect(errors[1]).toBeGreaterThan(errors[0])
    expect(errors[1]).toBeGreaterThan(10)
  })
})

describe('without the turn pathway', () => {
  it('the background drive is what holds the bump: the critical drive is below the intact one and above what is left after the lesion plus the nudge', () => {
    // A settled bump dies below CRITICAL_DRIVE and lives above it.
    for (const [scale, lives] of [
      [1.0, true],
      [CRITICAL_DRIVE + 0.07, true],
      [CRITICAL_DRIVE - 0.05, false],
      [RING.lesionedBackground + NUDGE_MAX, false],
    ] as const) {
      const hd = new HeadDirection(makeRng(5), ['card'], 0)
      hd.driveScale = scale
      for (let t = 0; t < 20 / DT; t++) hd.step(DT, 0, [], true)
      expect(hd.decodeLower().strength > 0.5, `drive ${scale}`).toBe(lives)
    }
  })

  it('the lower ring holds no stable bump: its activity wanders and breaks up, and its units keep firing', () => {
    const hd = new HeadDirection(makeRng(6), ['card'], rad(30))
    hd.pathway = false
    const strengths: number[] = []
    let rate = 0
    let n = 0
    for (let t = 0; t < 60 / DT; t++) {
      hd.step(DT, 0, [])
      if (t > 10 / DT && t % 25 === 0) {
        strengths.push(hd.decodeLower().strength)
        rate += hd.upperRate.reduce((a, b) => a + b, 0) / N
        n++
      }
    }
    const mean = strengths.reduce((a, b) => a + b, 0) / strengths.length
    expect(mean).toBeLessThan(0.25)
    expect(Math.max(...strengths)).toBeLessThan(0.6)
    // Kept firing, but not for any one heading.
    expect(rate / n).toBeGreaterThan(0.05)
  })

  it('the nudge cannot make a bump: with the pathway removed and the card’s learned input at its strongest, no stable bump forms', () => {
    const hd = new HeadDirection(makeRng(7), ['card'], 0)
    hd.pathway = false
    // Every view weight at its ceiling, aligned so the card ahead drives one place on the ring as sharply as learning ever could.
    for (let j = 0; j < N; j++) {
      const d = angleDiff(rad(90), HeadDirection.preferred(j))
      const w = LANDMARK_WEIGHT_MAX * Math.exp(-(d * d) / (2 * RING.excitationWidth * RING.excitationWidth))
      for (let i = 0; i < VIEW_UNITS; i++) hd.upper[j].weights[1 + i] = w
    }
    hd.learning = false
    for (let t = 0; t < 30 / DT; t++) hd.step(DT, 0, card(0), true)
    expect(Math.max(...hd.nudge)).toBeLessThanOrEqual(NUDGE_MAX + 1e-9)
    expect(hd.decodeLower().strength).toBeLessThan(0.4)
    expect(Math.max(...hd.lowerRate)).toBeLessThan(0.5)
  })

  it('and the clamp is the bound: the nudge never exceeds NUDGE_MAX whatever the learned input', () => {
    expect(boundedNudge(100)).toBe(NUDGE_MAX)
    expect(boundedNudge(-100)).toBe(-NUDGE_MAX)
    expect(boundedNudge(0)).toBe(0)
  })
})

describe('the nudge, with the pathway intact', () => {
  it('returns a bump displaced by 45° in the light to the card’s alignment', () => {
    const hd = new HeadDirection(makeRng(8), ['card'], 0)
    teach(hd, rad(45), LANDMARK_WEIGHT_MAX)
    let back = -1
    for (let t = 0; t < 60 / DT; t++) {
      hd.step(DT, 0, card(0))
      if (back < 0 && Math.abs(deg(angleDiff(rad(45), hd.decodeLower().heading))) < 8) back = t * DT
    }
    expect(back).toBeGreaterThanOrEqual(0)
    expect(back).toBeLessThan(40)
  })

  it('pulls slower than any turn: at full strength under 10° a second, against the body’s 120° a second', () => {
    const hd = new HeadDirection(makeRng(9), ['card'], 0)
    teach(hd, rad(90), LANDMARK_WEIGHT_MAX)
    const h0 = hd.decodeLower().heading
    for (let t = 0; t < 2 / DT; t++) hd.step(DT, 0, card(0), true)
    const speed = deg(wrapPositive(angleDiff(h0, hd.decodeLower().heading))) / 2
    expect(speed).toBeGreaterThan(1)
    expect(speed).toBeLessThan(10)
  })

  it('a card the system has no view units for is not seen', () => {
    const hd = new HeadDirection(makeRng(10), ['card'], 0)
    teach(hd, rad(45), LANDMARK_WEIGHT_MAX)
    const h0 = hd.decodeLower().heading
    for (let t = 0; t < 20 / DT; t++) hd.step(DT, 0, [{ id: 'poster', bearing: 0, strength: 1 }], true)
    expect(Math.abs(deg(angleDiff(h0, hd.decodeLower().heading)))).toBeLessThan(2)
  })
})
