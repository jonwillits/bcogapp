import { it } from 'vitest'
import { RecordingSession, CELL_KEYS, DT } from './recording'
import { BOX_A, BOX_B, BOX_A_STRETCHED } from './rooms'
import { HomingTrial, planBlock, runNavigators, NAVIGATORS, type TrialPlan, type Block } from './homing'
import { RANGE } from './range'
import { RATS, outcomeOf, runTest } from './rats'
import { DEFAULT_TEST, type TestSettings } from './lab'
import { HABITATS, averageRate, bestSetting, predictedSetting, tryEverySetting } from './patch'
import { angleDiff, deg, rad, wrap } from './spatial/angles'
import { CONTROL_BAR } from './spatial/ring'

/**
 * The viewing crib for Module 9, and the measured numbers behind
 * `docs/M09_AS_BUILT_NOTES.md` and `LAB_9_WALKTHROUGH.md`. Motion cannot be
 * verified headlessly, so these are predictions to check by eye at
 * localhost:5173: what the panels should read. Seeds 1000 to 1005 unless a
 * line says twenty (1000 to 1019).
 *
 *   PROBE=1 PROBE_DIR=src/sim/rodent npx vitest run --disable-console-intercept -t "crib:"
 */
const SEEDS = [1000, 1001, 1002, 1003, 1004, 1005]
const SEEDS20 = Array.from({ length: 20 }, (_, i) => 1000 + i)
const say = (s: string) => console.log(`m09 · ${s}`)
const f = (v: number, d = 0) => v.toFixed(d)
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
const range = (xs: number[], d = 0) => `${f(Math.min(...xs), d)} to ${f(Math.max(...xs), d)} (mean ${f(mean(xs), d)})`
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]

function scripted(plan: TrialPlan, seed: number): HomingTrial {
  const trial = new HomingTrial(plan, seed)
  let guard = 0
  while (!trial.done && guard++ < 20000) {
    const target = trial.currentBeetle ?? RANGE.nest
    const want = Math.atan2(target.y - trial.body.y, target.x - trial.body.x)
    const d = angleDiff(trial.body.heading, want)
    trial.step(DT, { forward: Math.abs(d) < 0.5 ? 1 : 0, turn: d > 0.05 ? 1 : d < -0.05 ? -1 : 0 })
    if (trial.phase === 'return' && trial.blackout <= 0 && Math.hypot(trial.body.x - target.x, trial.body.y - target.y) < 0.5) trial.here()
  }
  return trial
}

it('crib: what the panels should read', () => {
  // ───── Part 3, the spatial system
  say('PART 3 · the card and the heading')
  const controlAt: number[] = []
  const litSpread: number[] = []
  const dark5: number[] = []
  for (const seed of SEEDS) {
    const s = new RecordingSession(seed, BOX_A)
    s.exploring = true
    s.run(12 * 60)
    controlAt.push((s.controlAt ?? Infinity) / 60)
    const offs: number[] = []
    for (let i = 0; i < 60; i++) {
      s.run(1)
      offs.push(s.errors().heading)
    }
    const m = Math.atan2(mean(offs.map((o) => Math.sin(rad(o)))), mean(offs.map((o) => Math.cos(rad(o)))))
    litSpread.push(deg(Math.sqrt(mean(offs.map((o) => wrap(rad(o) - m) ** 2)))))
    s.lightsOut()
    s.run(300)
    const after = s.errors().heading
    dark5.push(Math.abs(deg(wrap(rad(after) - m))))
  }
  say(`  the card takes control (control ≥ ${CONTROL_BAR}) after ${range(controlAt, 1)} min; none within the first minute`)
  say(`  in the light the bump's offset from the true heading wanders by ${range(litSpread, 0)}° (sd over a minute)`)
  say(`  after 5 min in the dark it is ${range(dark5, 0)}° from where it stood`)
  // Rotation out of sight; moves in sight; lesion.
  const shifts: number[] = []
  const lost: number[] = []
  const lesionTuning: { before: number; after: number; day: number }[] = []
  for (const seed of SEEDS.slice(0, 4)) {
    const s = new RecordingSession(seed, BOX_A)
    s.exploring = true
    s.run(12 * 60)
    s.clearMaps()
    s.run(120)
    const before = s.hdPreferred()
    s.carry()
    s.turnCard(90)
    s.carry()
    s.run(150)
    s.clearMaps()
    s.run(120)
    const after = s.hdPreferred()
    shifts.push(mean(after.map((a, i) => deg(angleDiff(rad(before[i]), rad(a))))))
    // Moves in sight.
    let seen = 0
    let lostAt = -1
    for (let attempt = 0; attempt < 10 && lostAt < 0 && seen < 6; attempt++) {
      s.exploring = true
      s.clearMaps()
      s.run(60)
      const b = s.hdPreferred()
      s.exploring = false
      for (let i = 0; i < 10 / DT; i++) {
        const l = s.cardMoved.get(s.cardId) ?? s.room.landmarks[0]
        const bearing = angleDiff(s.body.heading, Math.atan2(l.y - s.body.y, l.x - s.body.x))
        if (Math.abs(bearing) < rad(10)) break
        s.drive({ forward: 0, turn: bearing > 0 ? 1 : -1 })
        s.step()
      }
      s.drive({ forward: 0, turn: 0 })
      s.run(0.5)
      const degrees = s.cardStaysInView(90) ? 90 : s.cardStaysInView(-90) ? -90 : 0
      if (!degrees || !s.turnCard(degrees)) continue
      seen++
      s.exploring = true
      s.run(90)
      s.clearMaps()
      s.run(90)
      const a = s.hdPreferred()
      const followed = a.every((x, i) => Math.abs(wrap(rad(deg(angleDiff(rad(b[i]), rad(x))) - degrees))) < rad(25))
      if (!followed) lostAt = seen
    }
    lost.push(lostAt)
    // Lesion.
    const t = new RecordingSession(seed + 50, BOX_A)
    t.exploring = true
    t.run(12 * 60)
    t.clearMaps()
    t.run(120)
    const tb = t.hdTuningIndex()
    t.removeTurnPathway()
    t.run(30 * 60)
    t.clearMaps()
    t.run(120)
    const ta = t.hdTuningIndex()
    t.run(60 * 60)
    t.clearMaps()
    t.run(120)
    lesionTuning.push({ before: tb, after: ta, day: t.hdTuningIndex() })
  }
  say(`  card turned 90° out of sight: the eight cells' preferred directions turn by ${range(shifts, 0)}° (mean over the eight, per seed)`)
  say(`  moves in sight before the card loses control: ${lost.map((l) => (l < 0 ? 'not in 6' : String(l))).join(', ')} (stability halves at each seen move)`)
  say(`  lesion: tuning index before ${range(lesionTuning.map((x) => x.before), 2)}; 30 min after ${range(lesionTuning.map((x) => x.after), 2)}; 90 min after ${range(lesionTuning.map((x) => x.day), 2)}`)
  // Coverage, the estimate's gap, remapping.
  const coverage: number[] = []
  const gapLit: number[] = []
  const gapDark: number[] = []
  const silentB: number[] = []
  const newRoomControl: number[] = []
  for (const seed of SEEDS) {
    const s = new RecordingSession(seed, BOX_A)
    s.exploring = true
    s.run(600)
    coverage.push(s.coverage())
    const g: number[] = []
    for (let i = 0; i < 60; i++) {
      s.run(1)
      g.push(s.errors().position)
    }
    gapLit.push(mean(g) * 100)
    s.lightsOut()
    const gd: number[] = []
    for (let i = 0; i < 120; i++) {
      s.run(1)
      gd.push(s.errors().position)
    }
    gapDark.push(mean(gd) * 100)
    s.lightsOn()
    s.carry(BOX_B)
    silentB.push(s.spatial.map!.fields.filter((x) => !x).length)
    s.run(12 * 60)
    newRoomControl.push((s.controlAt ?? Infinity) / 60)
  }
  say(`  Let it explore by itself covers ${range(coverage.map((c) => c * 100), 0)}% of the floor bins in 10 min`)
  say(`  gap between the estimate and the true position: lit ${range(gapLit, 0)} cm; dark (mean over 2 min) ${range(gapDark, 0)} cm`)
  say(`  the round box: place cells silent ${range(silentB, 0)} of 30; the black card takes control after ${range(newRoomControl, 1)} min`)
  // Stretch.
  {
    const s = new RecordingSession(1002, BOX_A)
    s.exploring = true
    s.run(180)
    s.clearMaps()
    s.run(480)
    const before = CELL_KEYS.place.map((k) => s.maps.centroid(k))
    s.carry(BOX_A_STRETCHED)
    s.run(600)
    const after = CELL_KEYS.place.map((k) => s.maps.centroid(k))
    const ratios: number[] = []
    for (let i = 0; i < before.length; i++) {
      const b = before[i]
      const a = after[i]
      if (!b || !a || b.peak < 2 || a.peak < 2 || Math.abs(b.x) < 0.12) continue
      ratios.push(a.x / b.x)
    }
    say(`  stretched by half: fields' x moves by a factor of ${f(median(ratios), 2)} (median; a full stretch is 1.50, half is 1.25)`)
  }

  // ───── Part 1
  say('PART 1 · the navigators')
  const byLegs = new Map<number, Record<string, number[]>>()
  for (const seed of SEEDS20) {
    for (const plan of planBlock('dark', 4000 + seed)) {
      const t = scripted(plan, 4000 + seed)
      const navs = runNavigators(t.record, 4000 + seed)
      const rec = byLegs.get(plan.legs.length) ?? {}
      for (const n of navs) (rec[n.id] ??= []).push(n.error)
      ;(rec.length ??= []).push(t.record.outwardLength)
      byLegs.set(plan.legs.length, rec)
    }
  }
  for (const legs of [2, 3, 4]) {
    const r = byLegs.get(legs)!
    say(`  dark, ${legs} legs (outward ${range(r.length, 0)} m): Running sum only error ${range(r.runningSum, 1)} m; Landmarks only ${range(r.landmarks, 1)} m (stops at the last beetle); Averaging ${range(r.averaging, 1)} m; Following one ${range(r.followingOne, 1)} m`)
  }
  const moon: Record<string, number[]> = {}
  for (const seed of SEEDS20) for (const plan of planBlock('moonlight', 5000 + seed)) {
    const t = scripted(plan, 5000 + seed)
    for (const n of runNavigators(t.record, 5000 + seed)) (moon[n.id] ??= []).push(n.error)
  }
  say(`  moonlight, 3 legs: ${NAVIGATORS.map((n) => `${n.label} ${range(moon[n.id], 1)} m`).join('; ')}`)
  const scores: Record<string, { small: number[]; large: number[] }> = {}
  for (const seed of SEEDS20) for (const plan of planBlock('moved', 6000 + seed)) {
    const t = scripted(plan, 6000 + seed)
    for (const n of runNavigators(t.record, 6000 + seed)) {
      const s = (scores[n.id] ??= { small: [], large: [] })
      ;(Math.abs(plan.move) < 0.5 ? s.small : s.large).push(n.conflictScore!)
    }
  }
  say(`  moved landmarks, score on the 0-to-1 line (median): ${NAVIGATORS.map((n) => `${n.label} small ${f(median(scores[n.id].small), 2)} large ${f(median(scores[n.id].large), 2)}`).join('; ')}`)
  const pic = planBlock('picture', 7000)
  say(`  picture block set-downs: ${pic.map((p) => `${f(Math.hypot(p.setDown!.x, p.setDown!.y), 0)} m`).join(', ')} from the nest; a near landmark is in view at a set-down within 10 m of one`)
  void (['practice', 'dark', 'moonlight', 'picture', 'moved'] as Block[])

  // ───── Part 2
  say('PART 2 · the table, majority over 20 seeds')
  const rows: [string, Partial<TestSettings>][] = [
    ['plus, rich, 4', { apparatus: 'plus', training: 4 }],
    ['plus, rich, 64', { apparatus: 'plus', training: 64 }],
    ['plus, plain', { apparatus: 'plus', room: 'plain' }],
    ['water, visible', { apparatus: 'water', platform: 'visible' }],
    ['water, hidden', { apparatus: 'water' }],
    ['water, cues removed', { apparatus: 'water', removeCues: true }],
    ['water, rotated', { apparatus: 'water', rotateCues: true }],
    ['water, dark after start', { apparatus: 'water', darkness: 'afterStart' }],
    ['paths, lamp on', { apparatus: 'paths', lamp: 'on' }],
    ['paths, lamp off', { apparatus: 'paths', lamp: 'off' }],
    ['paths, lamp moved', { apparatus: 'paths', lamp: 'moved' }],
  ]
  for (const [name, settings] of rows) {
    const cells = RATS.map((r) => {
      const counts: Record<string, number> = {}
      for (const seed of SEEDS20) {
        const o = outcomeOf(runTest(r, { ...DEFAULT_TEST, ...settings }, seed))
        counts[o] = (counts[o] ?? 0) + 1
      }
      const best = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0]
      return `${r.id} ${best} ${counts[best]}/20`
    })
    say(`  ${name}: ${cells.join(' | ')}`)
  }

  // ───── Closer
  say('CLOSER · stay or go')
  for (const h of HABITATS) {
    const best = SEEDS20.map((seed) => bestSetting(tryEverySetting(h, seed)))
    const avg = averageRate(h)
    say(`  ${h.label}: average rate one every ${f(avg.setting, 1)} s (predicted setting ${predictedSetting(h)} s); best setting over 20 seeds: median ${median(best)} s, range ${Math.min(...best)} to ${Math.max(...best)} s`)
  }
})
