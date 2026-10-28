import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ProgressStore } from '../../../sim/memory/progress/store'
import type { RawStorage } from '../../../sim/memory/progress/storage'
import { makeRng } from '../../../sim/random'
import { CLEARING } from '../../../sim/memory/logs/clearings'
import { WEEK_NIGHTS } from '../../../sim/memory/logs/features'
import { NIGHT_S, PRACTICE_S, type NightSim } from '../../../sim/memory/logs/night'
import { LogsStore, NOTICE_S } from './logsStore'
import { FOG_DENSITY, MOON_LIGHT, PRACTICE_FOG_DENSITY, PRACTICE_MOON_LIGHT } from './LogsView'
import { logs, LOGS_INTRO, PRACTICE_INTRO, weekIntro } from '../PartLogs'
import { AS_A_PERSON_LINE, COUNTERBALANCE_LINE, NO_NOTES_LINE } from '../lines'
import type { PartContext } from '../contract'

/**
 * Part 4 on rendered markup (spec §12, items 1, 4 and 12; §14): nothing
 * about errors, shares or replays before the end-of-week question is
 * committed; nothing about how a night went between nights; both
 * predictions committed before night 1; the end-of-week question preceded
 * by no string that mentions it; an interrupted week restarts in the
 * same clearing; and a log's drawing reads nothing of whether it is
 * full.
 */

function memory(): RawStorage & { raw: string | null } {
  const box = { raw: null as string | null, read: () => box.raw, write: (t: string) => ((box.raw = t), true) }
  return box
}

function ctxFor(store: LogsStore, progress: ProgressStore): PartContext<LogsStore> {
  return { seed: store.seed, progress, store, view: 'eye', fov: 75, lowDetail: false, anim: makeRng(1), clock: () => 0, header: null, openTab: () => {} }
}

/** Stand the body beside a log, off its side (never on its footprint), within digging reach. */
function standBy(sim: NightSim, l: { x: number; y: number; angle: number }) {
  const off = CLEARING.reach - 0.3
  sim.place(l.x + off * Math.cos(l.angle + Math.PI / 2), l.y + off * Math.sin(l.angle + Math.PI / 2), 0)
}

/** Drive a night to dawn by digging at the chosen loose-bark log each time, by placing the body (a scripted student). */
function playNight(s: LogsStore, digger: (ids: number[]) => number | null) {
  if (s.state === 'between') s.beginNight()
  const sim = s.sim!
  let guard = 0
  while (s.state === 'night' && guard++ < 100000) {
    if (s.fade > 0 || sim.done) {
      s.tick(0.05, { forward: 0, turn: 0, dig: false })
      continue
    }
    if (sim.phase === 'called') {
      sim.place(sim.clearing.nest.x, sim.clearing.nest.y, 0)
      s.tick(0.05, { forward: 0, turn: 0, dig: false })
      continue
    }
    if (sim.phase !== 'foraging') {
      s.tick(0.05, { forward: 0, turn: 0, dig: false })
      continue
    }
    const want = digger(sim.clearing.logs.filter((l) => l.kind === 'loose' && sim.dugTonight[l.id] === 0).map((l) => l.id))
    if (want === null) {
      s.tick(0.05, { forward: 0, turn: 0, dig: false })
      continue
    }
    standBy(sim, sim.clearing.logs[want])
    s.tick(0.05, { forward: 0, turn: 0, dig: true })
  }
}

const nearestFirst = (ids: number[]) => (ids.length ? ids[0] : null)

function markAll(s: LogsStore, answer: 'tonight' | 'never' = 'never') {
  for (const l of s.clearing.logs) if (l.kind === 'loose') s.mark(l.id, answer)
}

const MENTIONS_QUESTION = /question|mark which|marked|answer as a person|end of the week/i

describe('Part 4: commit, then reveal', () => {
  const mem = memory()
  const progress = new ProgressStore(mem, 77)
  const s = new LogsStore(77, progress)
  const ctx = ctxFor(s, progress)
  const render = () => renderToStaticMarkup(<logs.Stage ctx={ctx} />) + renderToStaticMarkup(<logs.Left ctx={ctx} />) + renderToStaticMarkup(<logs.Right ctx={ctx} />)

  it('opens on an instruction screen, with the two rules, the no-notes line, the keys, and nothing of the end-of-week question', () => {
    const m = render()
    expect(m).toMatch(/data-instruction/)
    expect(m).toContain('Logs with loose bark have beetles')
    expect(m).toContain('After you empty a log, it is still empty the next night')
    expect(m).toContain(NO_NOTES_LINE)
    expect(m).toContain('Some nights will look just like the night before')
    expect(m).toContain('The space bar pauses the night')
    expect(m).not.toMatch(MENTIONS_QUESTION)
    for (const text of [LOGS_INTRO.willDo.join(' '), LOGS_INTRO.keys.join(' '), PRACTICE_INTRO.willDo.join(' '), weekIntro(false).willDo.join(' '), weekIntro(true).willDo.join(' ')]) expect(text).not.toMatch(MENTIONS_QUESTION)
  })

  it('the practice night runs, is saved, and may be redone; then the two predictions', () => {
    s.begin()
    expect(s.state).toBe('practice-intro')
    s.beginPractice()
    expect(s.state).toBe('night')
    expect(progress.status('p4-practice')).toBe('in progress')
    expect(s.sim!.seconds).toBe(PRACTICE_S)
    expect(PRACTICE_INTRO.willDo.join(' ')).toContain(`${PRACTICE_S} seconds`)
    expect(render()).toContain('Practice night')
    playNight(s, nearestFirst)
    expect(s.state).toBe('night-over')
    expect(progress.isComplete('p4-practice')).toBe(true)
    expect(s.practice!.beetles).toBeGreaterThan(0)
    s.openPractice()
    expect(s.state).toBe('practice-intro')
    s.beginPractice()
    playNight(s, nearestFirst)
    s.goOnFromPractice()
    expect(s.state).toBe('predict')
  })

  it('both predictions are chosen and committed together before night 1, written once; the week’s screen follows', () => {
    const m = render()
    expect(m).toMatch(/data-stage="predict"/)
    expect(m).toContain('Commit my predictions')
    expect(m).not.toMatch(MENTIONS_QUESTION)
    expect(m).not.toMatch(/data-reveal|data-confusion-table|Digs at logs emptied|data-path/)
    s.commitPredictions()
    expect(s.state).toBe('predict')
    s.choosePairs('more mistakes')
    expect(s.canCommitPredictions).toBe(false)
    s.chooseTrend('fewer')
    s.commitPredictions()
    expect(s.state).toBe('week-intro')
    expect(progress.prediction('p4-pairs')).toBe('more mistakes')
    expect(progress.prediction('p4-trend')).toBe('fewer')
    s.choosePairs('fewer mistakes')
    expect(s.committed.pairs).toBe('more mistakes')
    expect(render()).toMatch(/data-instruction/)
    expect(render()).not.toMatch(MENTIONS_QUESTION)
  })

  it('the week begins on the between-nights screen for night 1, with its features line; a night shows the night label, the countdown, the energy bar and the large line, and no tally, overhead or map', () => {
    s.beginWeek()
    expect(s.state).toBe('between')
    expect(progress.status('p4-week')).toBe('in progress')
    expect(s.nextNight).toBe(1)
    let m = render()
    expect(m).toMatch(/data-stage="between"/)
    expect(m).toContain(`Night 1 of ${WEEK_NIGHTS}`)
    expect(m).toMatch(/Tonight: .*moon/)
    s.beginNight()
    expect(s.state).toBe('night')
    // The fade and a moment of walking: still well short of any log, so the large line is the plain *Foraging*.
    for (let k = 0; k < 30; k++) s.tick(0.05, { forward: 1, turn: 0, dig: false })
    m = render()
    expect(m).toMatch(/data-lines="night-status"/)
    expect(m).toMatch(/data-night-label[^>]*>Night 1 of 6</)
    expect(m).toMatch(/data-countdown="big"/)
    expect(m).toMatch(/data-energy/)
    expect(m).toMatch(/data-night-banner="plain"[^>]*>Foraging</)
    expect(m).not.toMatch(/data-clearing-overhead|Digs at logs emptied|data-confusion-table|data-reveal/)
    expect(m).not.toMatch(MENTIONS_QUESTION)
    expect(s.sim!.seconds).toBe(NIGHT_S)
  })

  it('the space bar pauses the night: the clock stops, the pause is counted, and the large line says so', () => {
    const sim = s.sim!
    const t = sim.time
    s.pause()
    expect(s.paused).toBe(true)
    for (let k = 0; k < 40; k++) s.tick(0.05, { forward: 1, turn: 0, dig: false })
    expect(sim.time).toBe(t)
    expect(render()).toMatch(/data-night-banner="pause"/)
    expect(s.statusLines()[2]).toBe('Paused')
    s.pause()
    expect(s.paused).toBe(false)
    expect(sim.record.pauses.count).toBe(1)
    expect(sim.record.pauses.seconds).toBeCloseTo(2, 5)
  })

  it('the large line: a dig, the beetles found, an empty log for a moment, the call in amber, the nursing in green, and the dawn', () => {
    const sim = s.sim!
    const phase = () => sim.phase as string
    const loose = sim.clearing.logs.find((l) => l.kind === 'loose')!
    standBy(sim, loose)
    expect(render()).toMatch(/data-night-banner="act"[^>]*>At a log/)
    s.tick(0.05, { forward: 0, turn: 0, dig: true })
    expect(render()).toMatch(/data-night-banner="act"[^>]*>Digging</)
    while (phase() === 'digging') s.tick(0.05, { forward: 0, turn: 0, dig: false })
    expect(render()).toMatch(/data-night-banner="found"[^>]*>Beetles found/)
    while (phase() === 'eating') s.tick(0.05, { forward: 0, turn: 0, dig: false })
    // The same log again: empty.
    s.tick(0.05, { forward: 0, turn: 0, dig: true })
    while (phase() === 'digging') s.tick(0.05, { forward: 0, turn: 0, dig: false })
    expect(render()).toMatch(/data-night-banner="none"[^>]*>Nothing here: the log was empty</)
    for (let k = 0; k < Math.round(NOTICE_S / 0.05) + 2; k++) s.tick(0.05, { forward: 0, turn: 0, dig: false })
    expect(render()).not.toMatch(/data-night-banner="none"/)
    while (!sim.called) s.tick(0.05, { forward: 0, turn: 0, dig: false })
    expect(render()).toMatch(/data-night-banner="call"[^>]*>The young are calling: go back to the nest</)
    sim.place(sim.clearing.nest.x, sim.clearing.nest.y, 0)
    s.tick(0.05, { forward: 0, turn: 0, dig: false })
    expect(sim.phase).toBe('nursing')
    expect(render()).toMatch(/data-night-banner="nurse"[^>]*>Nursing the young</)
    while (sim.phase === 'nursing') s.tick(0.05, { forward: 0, turn: 0, dig: false })
    while (!sim.dawning) s.tick(0.05, { forward: 0, turn: 0, dig: false })
    expect(render()).toMatch(/data-night-banner="dawn"/)
    while (!sim.done) s.tick(0.05, { forward: 0, turn: 0, dig: false })
    expect(render()).toContain('The night is over. You are home.')
    expect(s.state).toBe('night')
  })

  it('between nights: a short screen names the next night and its features, and nothing of how the last night went; no question until night 6', () => {
    playNight(s, nearestFirst)
    expect(s.state).toBe('between')
    expect(s.nextNight).toBe(2)
    const m = render()
    expect(m).toMatch(/data-stage="between"/)
    expect(m).toContain(`Night 2 of ${WEEK_NIGHTS}`)
    expect(m).not.toMatch(/Beetles eaten|Digs at logs emptied|data-clearing-overhead|data-reveal|data-path|when-error/i)
    expect(m).not.toMatch(MENTIONS_QUESTION)
    for (let n = 2; n <= WEEK_NIGHTS; n++) {
      expect(s.state).toBe('between')
      expect(s.nextNight).toBe(n)
      playNight(s, nearestFirst)
    }
    expect(s.state).toBe('question')
  })

  it('the question at the end of the week comes with no warning, as a person, with the overhead of the clearing and nothing of what happened; it must be marked for every loose-bark log', () => {
    const m = render()
    expect(m).toMatch(/data-stage="question"/)
    expect(m).toContain(AS_A_PERSON_LINE)
    expect(m).toMatch(/data-clearing-overhead/)
    expect(m).not.toMatch(/data-path|data-dig=|data-passed/)
    expect(m).toContain('Not emptied in the last three nights')
    expect(m).not.toMatch(/data-confusion-table|data-reveal|Beetles eaten/)
    expect(s.questionComplete).toBe(false)
    s.commitQuestion()
    expect(s.state).toBe('question')
    markAll(s, 'tonight')
    expect(s.questionComplete).toBe(true)
    s.commitQuestion()
    expect(s.state).toBe('revealed')
    expect(progress.isComplete('p4-week')).toBe(true)
  })

  it('the reveal: the comparison with the first prediction, the trend with the second and the counterbalancing line, six nights with replays, the question’s table, and the result line', () => {
    const m = render()
    expect(m).toMatch(/data-reveal="logs"/)
    expect(m).toMatch(/data-lines="comparison"/)
    expect(m).toContain('Your prediction: more mistakes')
    expect(m).toMatch(/data-lines="trend"/)
    expect(m).toContain('your mistakes would become fewer')
    expect(m).toContain(COUNTERBALANCE_LINE)
    expect((m.match(/data-night-reveal=/g) ?? []).length).toBe(WEEK_NIGHTS)
    expect((m.match(/data-path/g) ?? []).length).toBe(WEEK_NIGHTS)
    expect(m).toContain('Digs at logs emptied last night')
    expect(m).toMatch(/data-confusion-table="Your marks"/)
    expect(m).toMatch(/data-lines="result-line"/)
    expect(m).toMatch(/A{2}BC{2}D|AB{3}CD/)
  })

  it('a reload after the week shows the reveal again with identical results', () => {
    const again = new LogsStore(77, new ProgressStore(mem, 77))
    expect(again.state).toBe('revealed')
    expect(JSON.stringify(again.revealed())).toBe(JSON.stringify(s.revealed()))
  })
})

describe('Part 4: units and reserve materials (§4.3)', () => {
  it('the practice night runs in the week’s clearing, and the week begins with every loose-bark log full whatever the practice emptied', () => {
    const s = new LogsStore(8, new ProgressStore(memory(), 8))
    s.begin()
    s.beginPractice()
    expect(s.sim!.clearing).toBe(s.clearing)
    playNight(s, nearestFirst)
    expect(s.practice!.emptiedTonight.some(Boolean)).toBe(true)
    s.goOnFromPractice()
    s.choosePairs('about as many')
    s.chooseTrend('about the same')
    s.commitPredictions()
    s.beginWeek()
    s.beginNight()
    expect(s.sim!.clearing).toBe(s.clearing)
    expect(s.sim!.record.fullAtStart.filter(Boolean).length).toBe(7)
  })

  it('a week interrupted partway restarts in the same clearing from night 1 with every loose-bark log full and the same order, as a fresh night, and the results say so', () => {
    const mem = memory()
    let progress = new ProgressStore(mem, 5)
    let s = new LogsStore(5, progress)
    s.begin()
    s.beginPractice()
    playNight(s, nearestFirst)
    s.goOnFromPractice()
    s.choosePairs('about as many')
    s.chooseTrend('about the same')
    s.commitPredictions()
    s.beginWeek()
    const order = s.plan.order
    const clearing = s.clearing
    s.beginNight()
    const firstHeading = s.sim!.pose.heading
    playNight(s, nearestFirst)
    playNight(s, nearestFirst)
    s.beginNight()
    // Night 3 begun; the page is left.
    expect(s.state).toBe('night')
    progress = new ProgressStore(mem, 5)
    expect(progress.interrupted.map((i) => i.unit)).toEqual(['p4-week'])
    s = new LogsStore(5, progress)
    s.begin()
    expect(s.state).toBe('week-intro')
    s.beginWeek()
    expect(JSON.stringify(s.clearing)).toBe(JSON.stringify(clearing))
    expect(s.plan.order).toBe(order)
    expect(s.restarted).toBe(true)
    expect(s.nextNight).toBe(1)
    s.beginNight()
    expect(s.sim!.record.fullAtStart.filter(Boolean).length).toBe(7)
    expect(s.sim!.pose.heading).not.toBe(firstHeading)
  })

  it('the practice night interrupted restarts as the practice night again', () => {
    const mem = memory()
    let progress = new ProgressStore(mem, 6)
    let s = new LogsStore(6, progress)
    s.begin()
    s.beginPractice()
    for (let k = 0; k < 200; k++) s.tick(0.05, { forward: 1, turn: 0, dig: false })
    progress = new ProgressStore(mem, 6)
    expect(progress.interrupted.map((i) => i.unit)).toEqual(['p4-practice'])
    s = new LogsStore(6, progress)
    s.begin()
    expect(s.state).toBe('practice-intro')
  })

  it('every log is in view on every night: the farthest log keeps at least two fifths of its own color through the thickest fog; the practice night is lit and cleared above any scored night; fog is thicker than rain, rain than clear', () => {
    expect(PRACTICE_FOG_DENSITY).toBeLessThan(FOG_DENSITY.clear)
    expect(FOG_DENSITY.clear).toBeLessThan(FOG_DENSITY['light rain'])
    expect(FOG_DENSITY['light rain']).toBeLessThan(FOG_DENSITY.fog)
    expect(PRACTICE_MOON_LIGHT).toBeGreaterThan(Math.max(...MOON_LIGHT))
    // exp² fog: a thing d meters off keeps exp(−(d·density)²) of its own color.
    expect(Math.exp(-((CLEARING.maxRadius * FOG_DENSITY.fog) ** 2))).toBeGreaterThan(0.4)
  })

  it('the view draws the range bare, with none of Lab 9’s landmarks and none of the range’s own lights or fog, so nothing is seen that cannot be reached and the night’s fog is the one set here', () => {
    const src = (import.meta.glob('./LogsView.tsx', { query: '?raw', import: 'default', eager: true }) as Record<string, string>)['./LogsView.tsx']
    expect(src).toMatch(/<RangeView[^>]*\sbare\s[^>]*atmosphere=\{false\}/)
    expect(src).toMatch(/ClearingEdge/)
  })

  it('the night’s length on screen is the sim’s', () => {
    expect(LOGS_INTRO.willDo.join(' ')).toContain(`${NIGHT_S} seconds`)
  })
})

describe('Part 4: a log never shows whether it has beetles (§12, item 4)', () => {
  const files = import.meta.glob('./*.tsx', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
  const strip = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  const view = strip(Object.entries(files).find(([p]) => p.endsWith('LogsView.tsx'))![1])
  it('the view reads nothing of a log’s state: no full, fullAtStart, emptiedTonight, lastEmptied or outcome; a log’s mesh is its kind, place, angle and look', () => {
    expect(view).not.toMatch(/\bfull\b|fullAtStart|emptiedTonight|lastEmptied|outcome|\.digs\b|record\./)
  })
  it('no minimap, mark or trail is drawn while a night runs: the overhead is rendered only on the question and the reveal', () => {
    const part = (import.meta.glob('../PartLogs.tsx', { query: '?raw', import: 'default', eager: true }) as Record<string, string>)['../PartLogs.tsx']
    const stage = part.slice(part.indexOf('function Stage('), part.indexOf('function Predictions('))
    expect(stage).not.toMatch(/ClearingOverhead/)
    expect(view).not.toMatch(/Overhead|trail|minimap/i)
  })
  it('the sound reads the night’s sound and nothing else', () => {
    const sound = strip((import.meta.glob('./sound.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>)['./sound.ts'])
    expect(sound).not.toMatch(/full|empty|beetle|outcome|dig/i)
  })
})
