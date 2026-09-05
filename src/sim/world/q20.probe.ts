/**
 * Two runs for Q20, generated rather than invented.
 *
 * Q20 hands the student a pair of logs, says the person changed the mutation
 * rate on purpose, and asks what *else* differed. The answer has to be really
 * there, so the confound is the one the app itself makes easy to commit: the
 * controls offer "Reset simulation", which redraws the identical founding
 * population, and "New seed", which draws a different one. Part 2 spends five
 * experiments teaching the first. Q20's imaginary experimenter pressed the
 * second.
 *
 * The strongest version of the exercise is a pair where holding the seed
 * constant makes most of the difference go away, so the answer key can say so
 * rather than merely asserting that seeds matter. That is what this searches for.
 */
import { it } from 'vitest'
import { ContinuousWorld, DEFAULT_CONTINUOUS_PARAMS } from './continuousWorld'

const DURATION = 1200

function run(seed: number, mutationScale: number) {
  const w = new ContinuousWorld(seed, { ...DEFAULT_CONTINUOUS_PARAMS, mutationScale }, 'P')
  w.run(DURATION)
  const s = w.samples
  const last = s[s.length - 1]
  // What the panel actually shows: births per minute *early on* against births
  // per minute *now*. Cumulative births are useless as an outcome — the arena
  // has a hard carrying capacity, so every run lands within a few births of
  // every other whatever is happening genetically.
  const at = (t: number) => s.reduce((best, x) => (Math.abs(x.time - t) < Math.abs(best.time - t) ? x : best), s[0])
  const rate = (t0: number, t1: number) => ((at(t1).births - at(t0).births) / (t1 - t0)) * 60
  const early = rate(0, 60)
  const now = rate(DURATION - 60, DURATION)
  const birthsPerMin = now
  return {
    seed,
    mutationScale,
    samples: s,
    births: last.births,
    birthsPerMin,
    early,
    now,
    population: last.population,
    approach: last.approachFraction,
    markConc: last.hueConcentration,
    lineages: last.survivingLineages,
    extinct: w.extinct,
  }
}

const f = (n: number, d = 2) => n.toFixed(d)

it('q20: extinction as the outcome, at Part 2\'s small-population setting', () => {
  /**
   * Births per minute cannot be the outcome. The arena has a hard carrying
   * capacity, so every run lands within a few births of every other whatever is
   * happening genetically — the first attempt at this pair selected on birth
   * rate in the final sixty seconds, which is one minute of noise, and produced
   * two logs a student would correctly call identical.
   *
   * Extinction can. At Part 2's small-population setting a run is close to a
   * coin flip, and *that is the point*: it makes the outcome almost entirely a
   * matter of which founding population was drawn, which is exactly the
   * confound Q20 is teaching.
   */
  for (const cap of [6, 8]) {
    console.log(`\n=== arena holds ${cap} ===`)
    console.log('  seed  mut | survived  final pop  born  died out at')
    for (let seed = 1; seed <= 12; seed++) {
      for (const mut of [1, 0]) {
        const w = new ContinuousWorld(
          seed,
          { ...DEFAULT_CONTINUOUS_PARAMS, mutationScale: mut, populationCap: cap },
          'P',
        )
        w.run(DURATION)
        const last = w.samples[w.samples.length - 1]
        const died = w.samples.find((x) => x.population === 0)
        console.log(
          `  ${String(seed).padStart(4)}  ${mut === 1 ? '1.0' : '0.0'} | ${(w.extinct ? 'no ' : 'yes').padStart(8)}` +
            `  ${String(last.population).padStart(9)}  ${String(last.births).padStart(4)}` +
            `  ${died ? (died.time / 60).toFixed(1) + ' min' : '—'}`,
        )
      }
    }
  }
}, 900_000)

it('q20: find a pair whose difference is mostly the seed', () => {
  console.log('\n  seed  mut | b/min early -> now  approach  markConc  lineages')
  const rows: ReturnType<typeof run>[] = []
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    for (const mut of [1, 0]) {
      const r = run(seed, mut)
      rows.push(r)
      console.log(
        `  ${String(seed).padStart(4)}  ${mut === 1 ? '1.0' : '0.0'} | ${f(r.early, 1).padStart(9)} -> ${f(
          r.now, 1,
        ).padStart(4)}  ${f(r.approach).padStart(8)}  ${f(r.markConc).padStart(8)}  ${String(
          r.lineages,
        ).padStart(8)}`,
      )
    }
  }

  console.log('\n  candidate pairs: mut=1 at seed A vs mut=0 at seed B, ranked by')
  console.log('  how much of the gap survives holding the seed fixed (lower = better trap)\n')
  const best: string[] = []
  for (const a of rows.filter((r) => r.mutationScale === 1)) {
    for (const b of rows.filter((r) => r.mutationScale === 0 && r.seed !== a.seed)) {
      const crossGap = a.now - b.now
      if (crossGap <= 1.5) continue // want run A visibly ahead
      const sameSeed = rows.find((r) => r.seed === a.seed && r.mutationScale === 0)!
      const honestGap = a.now - sameSeed.now
      const share = honestGap / crossGap
      best.push(
        `  A: seed ${a.seed} mut 1.0 (${f(a.now, 1)}/min)  vs  B: seed ${b.seed} mut 0.0 (${f(
          b.now, 1,
        )}/min)  | gap ${f(crossGap, 1)}, of which the mutation rate really accounts for ${f(
          honestGap, 1,
        )} (${(share * 100).toFixed(0)}%)`,
      )
    }
  }
  for (const line of best.slice(0, 40)) console.log(line)
}, 600_000)

it('q20: the two logs, as a student would read them', () => {
  /**
   * Run 1 is seed 5 with mutation on; Run 2 is seed 7 with mutation off. The
   * person changed the mutation rate on purpose and the outcomes differ sharply
   * — one population survives, the other dies out. **Both controls come out
   * clean**: seed 5 with mutation *off* also survives, and seed 7 with mutation
   * *on* also dies. The mutation rate accounts for none of the difference; the
   * founding population accounts for all of it.
   *
   * That is the strongest form of the exercise, because the answer key can say
   * so from real runs rather than asserting in the abstract that seeds matter.
   */
  const CAP = 8

  const go = (seed: number, mutationScale: number) => {
    const w = new ContinuousWorld(
      seed,
      {
        ...DEFAULT_CONTINUOUS_PARAMS,
        mutationScale,
        // Both, because the scene sets both from one slider. Setting only the
        // cap starts the arena with sixteen and lets it fall to six, which is
        // not what a student would see.
        populationCap: CAP,
        initialPopulation: CAP,
      },
      // 'diverse' is what SETTING_DEFAULTS.founders is, so it is what a student
      // running the defaults gets. An earlier version of this used pool P while
      // the search that chose the seeds used 'diverse', and the two disagreed
      // about whether the same seed lived or died.
      'diverse',
    )
    w.run(DURATION)
    return w
  }

  const log = (label: string, seed: number, mutationScale: number) => {
    const w = go(seed, mutationScale)
    const s = w.samples
    const at = (t: number) =>
      s.reduce((best, x) => (Math.abs(x.time - t) < Math.abs(best.time - t) ? x : best), s[0])
    console.log(`\n\n### ${label}`)
    console.log(`Mutation rate: ${mutationScale.toFixed(1)}      Seed: ${seed}`)
    console.log(
      `Inheritance: on   Selection: on   Light: food   How many the arena holds: ${CAP}   Food patches: 4`,
    )
    console.log('\n  time    creatures alive   born so far   how uniform the mark is')
    console.log('  ' + '-'.repeat(62))
    for (let t = 0; t <= DURATION; t += 120) {
      const x = at(t)
      // Once the run has ended, stop printing stale rows.
      if (t > 0 && x.time < t - 30) break
      console.log(
        `  ${(x.time / 60).toFixed(0).padStart(3)}m ${String(x.population).padStart(16)} ` +
          `${String(x.births).padStart(13)} ${(x.hueConcentration * 100).toFixed(0).padStart(20)}%`,
      )
    }
    const end = s[s.length - 1]
    if (w.extinct) {
      console.log(
        `\n  The last creature died at ${(end.time / 60).toFixed(1)} minutes. ` +
          `${end.births} were born in total. The run ended there.`,
      )
    } else {
      console.log(
        `\n  Still running at ${(DURATION / 60).toFixed(0)} minutes: ${end.population} alive, ` +
          `${end.births} born in total.`,
      )
    }
    return w
  }

  log('Run A', 5, 1)
  log('Run B', 2, 0)

  console.log('\n\n### Answer key — not for the student handout')
  for (const [seed, mut] of [[5, 1], [5, 0], [2, 1], [2, 0]] as [number, number][]) {
    const w = go(seed, mut)
    const end = w.samples[w.samples.length - 1]
    console.log(
      `  seed ${seed}, mutation ${mut.toFixed(1)}: ` +
        `${w.extinct ? `died out at ${(end.time / 60).toFixed(1)} min` : `survived, ${end.population} alive`}` +
        `, ${end.births} born`,
    )
  }
  console.log(
    '\n  Seed 5 survives whether mutation is on or off. Seed 2 dies out whether mutation',
  )
  console.log(
    '  is on or off. The mutation rate accounted for none of the difference between the',
  )
  console.log('  two runs; the founding population accounted for all of it.')
}, 900_000)

it('q20: search for a valid pair, with the scene’s own settings', () => {
  /**
   * The first pair was wrong. It set the arena capacity to six but left the
   * *initial* population at sixteen, so the run began with a surplus of ten that
   * carried it — and the scene sets both from one slider, so no student could
   * ever have produced that log. Corrected, every run at capacity six dies out,
   * and the pair said the opposite.
   *
   * Searching properly this time: capacity and initial population tied together
   * the way the scene ties them, across capacities and seeds, for a pair that
   * reaches genuinely different outcomes while the *controls* stay clean — same
   * seed, both mutation rates, same outcome. That last part is what lets the
   * answer key say the mutation rate accounted for none of it.
   */
  const DUR = 1200
  const go = (cap: number, seed: number, mutationScale: number) => {
    const w = new ContinuousWorld(
      seed,
      {
        ...DEFAULT_CONTINUOUS_PARAMS,
        mutationScale,
        populationCap: cap,
        initialPopulation: cap,
      },
      'diverse',
    )
    w.run(DUR)
    const last = w.samples[w.samples.length - 1]
    return { extinct: w.extinct, at: last.time, births: last.births, alive: last.population }
  }

  for (const cap of [8, 10, 12, 16]) {
    const survives: number[] = []
    const dies: number[] = []
    for (let seed = 1; seed <= 14; seed++) {
      const on = go(cap, seed, 1)
      const off = go(cap, seed, 0)
      // A clean control: the seed decides the outcome, not the mutation rate.
      if (!on.extinct && !off.extinct) survives.push(seed)
      if (on.extinct && off.extinct) dies.push(seed)
    }
    console.log(
      `  capacity ${String(cap).padStart(2)} | survives either way: [${survives.join(', ')}]  ` +
        `dies either way: [${dies.join(', ')}]`,
    )
  }
}, 900_000)
