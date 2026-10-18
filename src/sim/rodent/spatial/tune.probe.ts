import { it } from 'vitest'
import { makeRng } from '../../random'
import { HeadDirection, N, NUDGE_MAX, CONTROL_BAR, RING, type LandmarkView } from './ring'
import { deg, rad, angleDiff, wrapPositive } from './angles'

/**
 * How the ring's constants were chosen. Not a test: a table to read.
 *
 *   PROBE=1 PROBE_DIR=src/sim/rodent npx vitest run --disable-console-intercept -t "tune: ring"
 */
const say = (s: string) => console.log(`m09 ring · ${s}`)
const DT = 0.02

/** A card at allocentric direction `cardAt` from the rat, seen when within ±100° of the heading. */
function cardView(trueHeading: number, cardAt: number): LandmarkView[] {
  const bearing = angleDiff(trueHeading, cardAt)
  return Math.abs(bearing) < rad(100) ? [{ id: 'card', bearing, strength: 1 }] : []
}

it('tune: ring', () => {
  // 1. Settled bump: profile, strength, drift with no turn and no noise.
  {
    const hd = new HeadDirection(makeRng(1), ['card'], rad(90))
    const d0 = hd.decodeLower()
    const peak = Math.max(...hd.lowerRate)
    const active = [...hd.lowerRate].filter((r) => r > 0.5).length
    say(`settled: peak ${peak.toFixed(2)}, units over 0.5: ${active}, strength ${d0.strength.toFixed(2)}, heading ${deg(d0.heading).toFixed(1)}°`)
    say(`  far-from-bump rate ${Math.min(...hd.lowerRate).toFixed(3)}, upper peak ${Math.max(...hd.upperRate).toFixed(2)} min ${Math.min(...hd.upperRate).toFixed(3)}`)
    for (let t = 0; t < 60 / DT; t++) hd.step(DT, 0, [], true)
    say(`  drift in 60 s with no turn and no noise: ${deg(angleDiff(d0.heading, hd.decodeLower().heading)).toFixed(2)}°`)
    const up = hd.decodeUpper()
    say(`  upper vs lower: ${deg(angleDiff(hd.decodeLower().heading, up.heading)).toFixed(2)}°`)
  }
  // 2. Turn gain, quiet, at several speeds.
  for (const speed of [30, 90, 180, 360]) {
    const hd = new HeadDirection(makeRng(2), ['card'], 0)
    const h0 = hd.decodeLower().heading
    const T = 2
    for (let t = 0; t < T / DT; t++) hd.step(DT, rad(speed), [], true)
    const moved = wrapPositive(angleDiff(h0, hd.decodeLower().heading))
    const expected = speed * T
    say(`turn ${speed}°/s for ${T} s: bump moved ${deg(moved).toFixed(1)}° (expected ${expected}°; ratio ${(deg(moved) / expected).toFixed(3)}), strength after ${hd.decodeLower().strength.toFixed(2)}`)
  }
  // 3. With noise, still, how the bump wanders by itself (the ring's own diffusion).
  {
    const sds: number[] = []
    for (let seed = 0; seed < 6; seed++) {
      const hd = new HeadDirection(makeRng(10 + seed), ['card'], 0)
      const h0 = hd.decodeLower().heading
      for (let t = 0; t < 300 / DT; t++) hd.step(DT, 0, [])
      sds.push(deg(angleDiff(h0, hd.decodeLower().heading)))
    }
    say(`noise alone, 5 min still: errors ${sds.map((x) => x.toFixed(0)).join(', ')}°; rms ${Math.sqrt(sds.reduce((a, b) => a + b * b, 0) / sds.length).toFixed(1)}°`)
  }
  // 4. Lesion: the bump goes, firing stays.
  {
    const hd = new HeadDirection(makeRng(3), ['card'], 0)
    hd.pathway = false
    const samples: number[] = []
    let sumRate = 0
    let n = 0
    for (let t = 0; t < 120 / DT; t++) {
      hd.step(DT, 0, [])
      if (t % 50 === 0) samples.push(hd.decodeLower().strength)
      sumRate += hd.lowerRate.reduce((a, b) => a + b, 0) / N
      n++
    }
    say(`lesion: lower strength over 2 min ${samples.slice(0, 8).map((s) => s.toFixed(2)).join(' ')}… mean rate ${(sumRate / n).toFixed(3)}, peak now ${Math.max(...hd.lowerRate).toFixed(2)}, upper peak ${Math.max(...hd.upperRate).toFixed(2)} mean ${(hd.upperRate.reduce((a, b) => a + b, 0) / N).toFixed(3)}`)
  }
  // 5. Learning a card: control over simulated minutes while the rat turns about with the card at +90° allocentric.
  {
    const hd = new HeadDirection(makeRng(4), ['card'], 0)
    let heading = 0
    const rng = makeRng(5)
    let omega = 0
    const line: string[] = []
    for (let t = 0; t <= 12 * 60 / DT; t++) {
      // A rat turning this way and that: an Ornstein–Uhlenbeck turn rate.
      omega += (-omega * 0.5 + rng.normal() * 1.2) * DT
      heading += omega * DT
      hd.step(DT, omega + 0.15 * rng.normal(), cardView(heading, rad(90)))
      if (t % (60 / DT) === 0) line.push(`${(t * DT / 60).toFixed(0)}m ${hd.controlOf('card').toFixed(2)} err ${deg(angleDiff(heading, hd.heading())).toFixed(0)}°`)
    }
    say(`learning: control by minute: ${line.join(' | ')}`)
    const peak = Math.max(...hd.learnedWeights())
    say(`  peak learned weight ${peak.toFixed(3)}, nudge max ${NUDGE_MAX}, bar ${CONTROL_BAR}`)
    // 5b. Displace the bump 45° in the light; does it return?
    const h = hd.decodeLower().heading
    hd.settle(h + rad(45), 0.5)
    const e0 = deg(angleDiff(heading, hd.heading()))
    let back = -1
    for (let t = 0; t < 60 / DT; t++) {
      hd.step(DT, 0.15 * rng.normal(), cardView(heading, rad(90)))
      if (back < 0 && Math.abs(deg(angleDiff(heading, hd.heading()))) < 8) back = t * DT
    }
    say(`  displaced 45° (error ${e0.toFixed(0)}°): back within 8° after ${back < 0 ? 'never' : back.toFixed(1) + ' s'}; error now ${deg(angleDiff(heading, hd.heading())).toFixed(0)}°`)
    // 5c. Lesion with the learned card in view: does a bump form?
    hd.pathway = false
    const strengths: number[] = []
    for (let t = 0; t < 120 / DT; t++) {
      hd.step(DT, 0, cardView(heading, rad(90)))
      if (t % 100 === 0) strengths.push(hd.decodeLower().strength)
    }
    say(`  lesioned with the learned card in view: lower strength ${strengths.slice(0, 10).map((s) => s.toFixed(2)).join(' ')}, lower peak ${Math.max(...hd.lowerRate).toFixed(2)}, upper peak ${Math.max(...hd.upperRate).toFixed(2)}`)
    // 5d. In the dark with the pathway intact: drift over 5 minutes.
    hd.pathway = true
    hd.settle(heading, 0.5)
    const drift: string[] = []
    for (let t = 0; t <= 300 / DT; t++) {
      omega += (-omega * 0.5 + rng.normal() * 1.2) * DT
      heading += omega * DT
      hd.step(DT, omega + 0.15 * rng.normal(), [])
      if (t % (60 / DT) === 0) drift.push(`${(t * DT / 60).toFixed(0)}m ${deg(angleDiff(heading, hd.heading())).toFixed(0)}°`)
    }
    say(`  dark drift: ${drift.join(', ')}`)
  }
})

it('tune: critical drive', () => {
  const exc0 = RING.excitation
  for (const exc of [0.18, 0.15, 0.13, 0.11, 0.10, 0.09]) {
    RING.excitation = exc
    const row: string[] = []
    for (const scale of [1.0, 0.9, 0.8, 0.7, 0.6, 0.5]) {
      const hd = new HeadDirection(makeRng(7), ['card'], 0)
      hd.driveScale = scale
      for (let t = 0; t < 10 / DT; t++) hd.step(DT, 0, [], true)
      const quiet = hd.decodeLower()
      for (let t = 0; t < 30 / DT; t++) hd.step(DT, 0, [])
      const noisy = hd.decodeLower()
      const mean = hd.lowerRate.reduce((a, b) => a + b, 0) / N
      row.push(`${scale.toFixed(1)}: q${quiet.strength.toFixed(2)}/p${Math.max(...hd.lowerRate).toFixed(2)} n${noisy.strength.toFixed(2)} m${mean.toFixed(2)}`)
    }
    say(`exc ${exc}: ${row.join(' | ')}`)
  }
  RING.excitation = exc0
})

it('tune: fine drive sweep', () => {
  const exc0 = RING.excitation
  for (const exc of [0.155, 0.16, 0.165, 0.17]) {
    RING.excitation = exc
    const row: string[] = []
    for (const scale of [1.0, 0.9, 0.85, 0.8, 0.75, 0.7, 0.65, 0.6]) {
      const hd = new HeadDirection(makeRng(7), ['card'], 0)
      hd.driveScale = scale
      for (let t = 0; t < 10 / DT; t++) hd.step(DT, 0, [], true)
      const quiet = hd.decodeLower()
      let minStrength = 1
      for (let t = 0; t < 60 / DT; t++) {
        hd.step(DT, 0, [])
        if (t % 25 === 0) minStrength = Math.min(minStrength, hd.decodeLower().strength)
      }
      row.push(`${scale.toFixed(2)}: q${quiet.strength.toFixed(2)} n≥${minStrength.toFixed(2)}`)
    }
    say(`exc ${exc}: ${row.join(' | ')}`)
  }
  RING.excitation = exc0
})

it('tune: pull', () => {
  const exc0 = RING.excitation
  for (const exc of [0.16]) {
    RING.excitation = exc
    for (const amp of [0.001, 0.002, 0.004, 0.006, 0.01, 0.02, 0.05]) {
      for (const quiet of [true, false]) {
        const hd = new HeadDirection(makeRng(8), ['card'], 0)
        // Hand-set weights (a probe may): the view unit for bearing 0 drives upper units around 45° with a bell, peak `amp` after the nudge's gain.
        for (let j = 0; j < N; j++) {
          const d = angleDiff(rad(45), HeadDirection.preferred(j))
          hd.upper[j].weights[1] = (amp * Math.exp(-(d * d) / (2 * RING.excitationWidth * RING.excitationWidth))) / 1.0
        }
        hd.learning = false
        let back = -1
        let last = 0
        let at10 = 0
        for (let t = 0; t < 120 / DT; t++) {
          hd.step(DT, 0, [{ id: 'card', bearing: 0, strength: 1 }], quiet)
          last = deg(hd.decodeLower().heading)
          if (t === 10 / DT) at10 = last
          if (back < 0 && Math.abs(last - 45) < 8) back = t * DT
        }
        say(`exc ${exc} nudge peak ${amp}${quiet ? ' quiet' : ' noisy'}: after 10 s at ${at10.toFixed(1)}° (${(at10 / 10).toFixed(2)}°/s); ${back < 0 ? 'never within 8°' : `within 8° after ${back.toFixed(1)} s`}; ends at ${last.toFixed(0)}° (target 45)`)
      }
    }
  }
  RING.excitation = exc0
})
