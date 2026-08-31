import { it } from 'vitest'
import { ContinuousWorld, DEFAULT_CONTINUOUS_PARAMS, type ContinuousParams } from './continuousWorld'

const f = (n: number, w = 6) => n.toFixed(2).padStart(w)
const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / (a.length || 1)
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

function run(label: string, patch: Partial<ContinuousParams>, seconds = 900) {
  const starved: number[] = []
  const aged: number[] = []
  const ends: number[] = []
  const extinctAt: number[] = []
  for (const seed of SEEDS) {
    const w = new ContinuousWorld(seed, { ...DEFAULT_CONTINUOUS_PARAMS, ...patch })
    w.run(seconds)
    starved.push(w.starved)
    aged.push(w.diedOfAge)
    ends.push(w.samples[w.samples.length - 1]?.population ?? 0)
    if (w.extinct) extinctAt.push(w.time)
  }
  console.log(
    `  ${label.padEnd(34)} starved ${f(mean(starved), 7)} | aged ${f(mean(aged), 7)} | final pop ${f(
      mean(ends), 5,
    )} | extinct ${String(extinctAt.length).padStart(2)}/10${
      extinctAt.length ? ` (mean ${f(mean(extinctAt), 5)}s)` : ''
    }`,
  )
}

it('what the world settings do to starvation', () => {
  const food = DEFAULT_CONTINUOUS_PARAMS.food
  console.log('\nover 900s x 10 seeds:')
  run('default', {})
  run('arena 14 (biggest)', { bounds: 14 })
  run('2 patches', { food: { ...food, count: 2 } })
  run('1 patch', { food: { ...food, count: 1 } })
  run('arena 14 + 2 patches', { bounds: 14, food: { ...food, count: 2 } })
  run('arena 14 + 1 patch', { bounds: 14, food: { ...food, count: 1 } })
  run('smallest patches (1.5)', { food: { ...food, strength: 1.5 } })
  run('arena 14 + smallest + 2 patches', {
    bounds: 14,
    food: { ...food, count: 2, strength: 1.5 },
  })
  run('patches stationary (drift 0)', { food: { ...food, driftSpeed: 0 } })
  console.log('')
  run('light regime: neutral', { regime: 'neutral' })
  run('light regime: poison', { regime: 'poison' })
}, 900_000)

it('compensate for a bigger arena', () => {
  const food = DEFAULT_CONTINUOUS_PARAMS.food
  console.log('\ndoes Jon\'s compensation work? 900s x 10 seeds')
  for (const bounds of [9, 11, 14]) {
    for (const count of [4, 6, 8, 10]) {
      run(`arena ${bounds}, ${count} patches`, { bounds, food: { ...food, count } })
    }
    console.log('')
  }
})

it('would ambient food make neutral and poison habitable', () => {
  console.log('\nregimes with a little food that is not the light:')
  for (const ambientIncome of [0, 0.15, 0.3]) {
    for (const regime of ['neutral', 'poison'] as const) {
      run(`${regime}, ambient ${ambientIncome}`, {
        regime,
        energy: { baseCost: 0.05, moveCost: 0.06, ambientIncome },
      })
    }
  }
}, 900_000)

it('the regime switch as a student will now meet it', () => {
  console.log('\nevolve under food for 600s, then switch — with grazing available:')
  for (const [label, regime, ambient] of [
    ['stay on food', 'food', 0],
    ['switch to neutral', 'neutral', 0.3],
    ['switch to poison', 'poison', 0.3],
  ] as const) {
    const pops: number[] = []
    const before: number[] = []
    const starvedAfter: number[] = []
    let extinct = 0
    for (const seed of SEEDS) {
      const w = new ContinuousWorld(seed, DEFAULT_CONTINUOUS_PARAMS)
      w.run(600)
      before.push(w.samples[w.samples.length - 1]?.population ?? 0)
      const s0 = w.starved
      w.params.regime = regime
      w.params.energy = { ...w.params.energy, ambientIncome: ambient }
      w.run(300)
      pops.push(w.samples[w.samples.length - 1]?.population ?? 0)
      starvedAfter.push(w.starved - s0)
      if (w.extinct) extinct++
    }
    console.log(
      `  ${label.padEnd(20)} pop ${f(mean(before), 5)} -> ${f(mean(pops), 5)} | starved after the switch ${f(
        mean(starvedAfter), 6,
      )} | extinct ${extinct}/10`,
    )
  }
}, 900_000)
