/**
 * What does a Part 1 student actually see, at the scene's real defaults?
 *
 * The handout says "run for 50 generations" and asks for the generation number
 * and the average energy at generation 1 and 50. None of those exist any more.
 * Whatever replaces them has to name something that (a) the panel displays and
 * (b) reliably happens — so this measures it across seeds rather than guessing a
 * round number.
 *
 * Defaults per `SETTING_DEFAULTS`: founders 'diverse', mutation 1, inheritance
 * and selection on, capacity 16, food regime, no sensor noise.
 */
import { it } from 'vitest'
import { ContinuousWorld, DEFAULT_CONTINUOUS_PARAMS } from './continuousWorld'

it('part 1: when does adaptation become visible', () => {
  const MARKS = [60, 120, 180, 300, 480, 600]
  console.log('\n  seed | ' + MARKS.map((t) => `${t}s`.padStart(24)).join(''))
  console.log('       | ' + MARKS.map(() => 'born  b/min approach mark'.padStart(24)).join(''))
  console.log('  ' + '-'.repeat(7 + 24 * MARKS.length))

  const rows: { born: number[]; rate: number[]; approach: number[]; mark: number[] }[] = []
  for (let seed = 1; seed <= 10; seed++) {
    const w = new ContinuousWorld(seed, { ...DEFAULT_CONTINUOUS_PARAMS }, 'diverse')
    w.run(MARKS[MARKS.length - 1])
    const s = w.samples
    const at = (t: number) =>
      s.reduce((b, x) => (Math.abs(x.time - t) < Math.abs(b.time - t) ? x : b), s[0])
    const row = { born: [] as number[], rate: [] as number[], approach: [] as number[], mark: [] as number[] }
    let cells = ''
    for (const t of MARKS) {
      const x = at(t)
      const prev = at(Math.max(0, t - 60))
      const dt = x.time - prev.time
      const rate = dt > 0 ? ((x.births - prev.births) / dt) * 60 : 0
      row.born.push(x.births); row.rate.push(rate)
      row.approach.push(x.approachFraction); row.mark.push(x.hueConcentration)
      cells += `${String(x.births).padStart(5)} ${rate.toFixed(0).padStart(5)} ${(x.approachFraction * 100).toFixed(0).padStart(7)}% ${(x.hueConcentration * 100).toFixed(0).padStart(4)}%`
    }
    rows.push(row)
    console.log(`  ${String(seed).padStart(4)} | ${cells}`)
  }

  const mean = (f: (r: (typeof rows)[0]) => number[], i: number) =>
    rows.reduce((a, r) => a + f(r)[i], 0) / rows.length
  console.log('\n  mean over 10 seeds:')
  console.log('   t      born   b/min   approach   one mark   seeds where approach >= 80%')
  MARKS.forEach((t, i) => {
    const hi = rows.filter((r) => r.approach[i] >= 0.8).length
    console.log(
      `  ${String(t).padStart(4)}s ${mean((r) => r.born, i).toFixed(0).padStart(7)} ${mean((r) => r.rate, i).toFixed(1).padStart(7)} ${(mean((r) => r.approach, i) * 100).toFixed(0).padStart(9)}% ${(mean((r) => r.mark, i) * 100).toFixed(0).padStart(10)}% ${String(hi).padStart(20)}/10`,
    )
  })
}, 900_000)

it('part 1: is selection doing anything visible at the defaults', () => {
  /**
   * The decisive check. Part 1 asks a student to watch a population adapt, and
   * Part 2 asks them to switch selection off and see the difference. Both need
   * selection to produce a visible effect at the shipped defaults.
   */
  const DUR = 600
  const run = (seed: number, selection: boolean) => {
    const w = new ContinuousWorld(seed, { ...DEFAULT_CONTINUOUS_PARAMS, selection }, 'diverse')
    w.run(DUR)
    const s = w.samples
    const last = s[s.length - 1]
    const first = s.reduce((b, x) => (Math.abs(x.time - 30) < Math.abs(b.time - 30) ? x : b), s[0])
    return {
      approachStart: first.approachFraction,
      approachEnd: last.approachFraction,
      births: last.births,
      crossStart: first.meanCrossing,
      crossEnd: last.meanCrossing,
    }
  }
  console.log('\n  Same seed, selection on vs off. 600 s, scene defaults.')
  console.log('  seed |  ON: approach start->end  births |  OFF: approach start->end  births')
  let onGain = 0, offGain = 0
  for (let seed = 1; seed <= 10; seed++) {
    const on = run(seed, true)
    const off = run(seed, false)
    onGain += on.approachEnd - on.approachStart
    offGain += off.approachEnd - off.approachStart
    console.log(
      `  ${String(seed).padStart(4)} |     ${(on.approachStart * 100).toFixed(0).padStart(3)}% -> ${(on.approachEnd * 100).toFixed(0).padStart(3)}%   ${String(on.births).padStart(4)}  |      ${(off.approachStart * 100).toFixed(0).padStart(3)}% -> ${(off.approachEnd * 100).toFixed(0).padStart(3)}%   ${String(off.births).padStart(4)}`,
    )
  }
  console.log(
    `\n  mean change in the fraction that steer toward light:  selection ON ${(onGain / 10 * 100).toFixed(1)} points,  OFF ${(offGain / 10 * 100).toFixed(1)} points`,
  )
}, 900_000)
