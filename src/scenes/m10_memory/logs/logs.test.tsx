import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ProgressStore } from '../../../sim/memory/progress/store'
import type { RawStorage } from '../../../sim/memory/progress/storage'
import { makeRng } from '../../../sim/random'
import { CLEARING } from '../../../sim/memory/logs/clearings'
import { NIGHT_S, PRACTICE_S } from '../../../sim/memory/logs/night'
import { LogsStore } from './logsStore'
import { logs, LOGS_INTRO, PRACTICE_INTRO, blockIntro } from '../PartLogs'
import type { PartContext } from '../contract'

/**
 * Part 4 on rendered markup (spec §12, items 1 and 4; §14): nothing about
 * errors, map answers or replays before both blocks are finished; no
 * first-block result before the second block's prediction is committed;
 * the first map question is preceded by no string that mentions it; an
 * interrupted block restarts in the reserve clearing; and a log's drawing
 * reads nothing of whether it is full.
 */

function memory(): RawStorage & { raw: string | null } {
  const box = { raw: null as string | null, read: () => box.raw, write: (t: string) => ((box.raw = t), true) }
  return box
}

function ctxFor(store: LogsStore, progress: ProgressStore): PartContext<LogsStore> {
  return { seed: store.seed, progress, store, view: 'eye', fov: 75, lowDetail: false, anim: makeRng(1), clock: () => 0, header: null, openTab: () => {} }
}

/** Drive a night to dawn by digging at the nearest loose-bark log each time, by placing the body (a scripted student). */
function playNight(s: LogsStore, digger: (ids: number[]) => number | null) {
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
    const l = sim.clearing.logs[want]
    sim.place(l.x + CLEARING.reach - 0.3, l.y, 0)
    s.tick(0.05, { forward: 0, turn: 0, dig: true })
  }
}

const nearestFirst = (ids: number[]) => (ids.length ? ids[0] : null)

function markAll(s: LogsStore, answer: 'tonight' | 'never' = 'never') {
  for (const l of s.clearing.logs) if (l.kind === 'loose') s.mark(l.id, answer)
}

describe('Part 4: commit, then reveal', () => {
  const mem = memory()
  const progress = new ProgressStore(mem, 77)
  const s = new LogsStore(77, progress)
  const ctx = ctxFor(s, progress)
  const render = () => renderToStaticMarkup(<logs.Stage ctx={ctx} />) + renderToStaticMarkup(<logs.Left ctx={ctx} />) + renderToStaticMarkup(<logs.Right ctx={ctx} />)

  it('opens on an instruction screen, with the two rules, and nothing of a map question', () => {
    const m = render()
    expect(m).toMatch(/data-instruction/)
    expect(m).toContain('Logs with loose bark have beetles')
    expect(m).toContain('After you empty a log, it is still empty the next night')
    expect(m).not.toMatch(/map question|the map/i)
    expect(LOGS_INTRO.willDo.join(' ')).not.toMatch(/map/i)
    expect(PRACTICE_INTRO.willDo.join(' ')).not.toMatch(/map/i)
    expect(blockIntro('look-alike', false, false).willDo.join(' ')).not.toMatch(/map/i)
    expect(blockIntro('look-alike', false, false).willDo[0]).toBe('These three nights will look alike.')
    expect(blockIntro('distinct', false, false).willDo[0]).toBe('Each of these three nights will look different.')
  })

  it('the practice night runs, is saved, and may be redone; the first block then opens on its screen', () => {
    s.begin()
    expect(s.state).toBe('practice-intro')
    s.beginPractice()
    expect(s.state).toBe('night')
    expect(progress.status('p4-practice')).toBe('in progress')
    // The practice night is the long one, and says so.
    expect(s.sim!.seconds).toBe(PRACTICE_S)
    expect(PRACTICE_INTRO.willDo.join(' ')).toContain(`${PRACTICE_S} seconds`)
    playNight(s, nearestFirst)
    expect(s.state).toBe('night-over')
    expect(progress.isComplete('p4-practice')).toBe(true)
    expect(s.practice!.beetles).toBeGreaterThan(0)
    s.openPractice()
    expect(s.state).toBe('practice-intro')
    s.beginPractice()
    playNight(s, nearestFirst)
    s.goOnFromPractice()
    expect(s.state).toBe('block-intro')
    expect(s.blockIndex).toBe(0)
  })

  it('during a night, the view shows status lines and no tally of errors, no overhead and no map', () => {
    s.beginBlock()
    expect(progress.status('p4-block-1')).toBe('in progress')
    for (let k = 0; k < 100; k++) s.tick(0.05, { forward: 1, turn: 0, dig: false })
    const m = render()
    expect(m).toMatch(/data-lines="night-status"/)
    expect(m).toContain('Night 1 of 3')
    expect(m).toMatch(/data-countdown="big"/)
    expect(m).not.toMatch(/data-night-banner/)
    expect(m).not.toMatch(/data-clearing-overhead|Digs at logs emptied|data-confusion-table|data-reveal/)
    expect(s.sim!.seconds).toBe(NIGHT_S)
  })

  it('the large line over the view: the call in amber, the nursing in green, and the dawn, each only while it holds', () => {
    const sim = s.sim!
    while (!sim.called) s.tick(0.05, { forward: 0, turn: 0, dig: false })
    expect(render()).toMatch(/data-night-banner="call"[^>]*>The young are calling: go back to the nest</)
    sim.place(sim.clearing.nest.x, sim.clearing.nest.y, 0)
    s.tick(0.05, { forward: 0, turn: 0, dig: false })
    expect(sim.phase).toBe('nursing')
    expect(render()).toMatch(/data-night-banner="nurse"[^>]*>Nursing the young</)
    while (sim.phase === 'nursing') s.tick(0.05, { forward: 0, turn: 0, dig: false })
    expect(render()).not.toMatch(/data-night-banner/)
    while (!sim.dawning) s.tick(0.05, { forward: 0, turn: 0, dig: false })
    expect(render()).toMatch(/data-night-banner="dawn"/)
    expect(render()).toContain('Dawn: the night is over')
    while (!sim.done) s.tick(0.05, { forward: 0, turn: 0, dig: false })
    expect(render()).toContain('The night is over. You are home.')
    expect(s.state).toBe('night')
  })

  it('the first map question comes after the first night with no string before it that mentioned it, and offers only tonight and not emptied', () => {
    playNight(s, nearestFirst)
    expect(s.state).toBe('map')
    expect(s.mapNight).toBe(1)
    expect(s.mapAnswers()).toEqual(['tonight', 'never'])
    const m = render()
    expect(m).toMatch(/data-stage="map"/)
    expect(m).toMatch(/data-clearing-overhead/)
    expect(m).not.toMatch(/data-path|data-dig=/)
    expect(m).not.toContain('A map question like this follows every night')
    expect(m).not.toMatch(/Emptied last night|Emptied two nights ago/)
    expect(m).not.toMatch(/data-confusion-table|Confusions between nights|data-reveal/)
  })

  it('the map must be marked for every loose-bark log before it commits; after the first, the line says a map follows every night; night 2 offers last night', () => {
    expect(s.mapComplete).toBe(false)
    s.commitMap()
    expect(s.state).toBe('map')
    markAll(s, 'tonight')
    expect(s.mapComplete).toBe(true)
    s.commitMap()
    expect(s.state).toBe('night')
    playNight(s, nearestFirst)
    expect(s.mapNight).toBe(2)
    expect(s.mapAnswers()).toEqual(['tonight', 'last night', 'never'])
    expect(render()).toContain('A map question like this follows every night')
    markAll(s, 'never')
    s.commitMap()
    playNight(s, nearestFirst)
    expect(s.mapAnswers()).toEqual(['tonight', 'last night', 'two nights ago', 'never'])
    markAll(s, 'never')
    s.commitMap()
  })

  it('after the first block: the prediction screen, with no first-block result anywhere until it is committed', () => {
    expect(s.state).toBe('predict')
    expect(progress.isComplete('p4-block-1')).toBe(true)
    const m = render()
    expect(m).toContain('Commit my prediction')
    expect(m).not.toMatch(/data-reveal|data-confusion-table|Digs at logs emptied|data-path|Beetles over the block/)
    s.commitPrediction()
    expect(s.state).toBe('predict')
    s.predict('less often')
    s.commitPrediction()
    expect(s.state).toBe('block-intro')
    expect(progress.prediction('p4-second-block')).toBe('less often')
    // Still nothing of the first block.
    expect(render()).not.toMatch(/data-reveal|data-confusion-table|Digs at logs emptied/)
  })

  it('the second block runs; the reveal opens only after it, with both blocks side by side, the tallies, the tables, the replays and the prediction', () => {
    s.beginBlock()
    for (let n = 0; n < 3; n++) {
      playNight(s, nearestFirst)
      expect(s.state).toBe('map')
      markAll(s, 'tonight')
      s.commitMap()
    }
    expect(s.state).toBe('revealed')
    expect(progress.isComplete('p4-block-2')).toBe(true)
    const m = render()
    expect(m).toMatch(/data-reveal="logs"/)
    expect((m.match(/data-block-reveal=/g) ?? []).length).toBe(2)
    expect((m.match(/data-night-reveal=/g) ?? []).length).toBe(6)
    expect((m.match(/data-path/g) ?? []).length).toBe(6)
    expect(m).toContain('Digs at logs emptied last night')
    expect(m).toContain('Your prediction: in the second block you would confuse nights less often')
    expect(m).toMatch(/data-confusion-table="The whole block"/)
  })

  it('a reload after both blocks shows the reveal again with identical results', () => {
    const again = new LogsStore(77, new ProgressStore(mem, 77))
    expect(again.state).toBe('revealed')
    expect(JSON.stringify(again.revealed())).toBe(JSON.stringify(s.revealed()))
  })
})

describe('Part 4: units and reserve materials (§4.3)', () => {
  it('a block interrupted partway restarts in the reserve clearing with every loose-bark log full, and the results say so', () => {
    const mem = memory()
    let progress = new ProgressStore(mem, 5)
    let s = new LogsStore(5, progress)
    s.begin()
    s.beginPractice()
    playNight(s, nearestFirst)
    s.goOnFromPractice()
    const own = s.clearingFor(0)
    s.beginBlock()
    playNight(s, nearestFirst)
    markAll(s, 'tonight')
    s.commitMap()
    // Night 2 begun; the page is left.
    expect(s.state).toBe('night')
    progress = new ProgressStore(mem, 5)
    expect(progress.interrupted.map((i) => i.unit)).toEqual(['p4-block-1'])
    s = new LogsStore(5, progress)
    s.begin()
    expect(s.state).toBe('block-intro')
    expect(s.blockIndex).toBe(0)
    expect(s.clearingFor(0)).toBe('reserve')
    expect(s.clearingFor(0)).not.toBe(own)
    s.beginBlock()
    expect(s.clearingId).toBe('reserve')
    expect(s.sim!.record.fullAtStart.filter(Boolean).length).toBe(7)
    expect(s.restarted[0]).toBe(true)
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

  it('the night’s length on screen is the sim’s', () => {
    expect(LOGS_INTRO.willDo.join(' ')).toContain(`${NIGHT_S} seconds`)
  })
})

describe('Part 4: a log never shows whether it has beetles (§12, item 4)', () => {
  const files = import.meta.glob('./*.tsx', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
  const strip = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  const view = strip(Object.entries(files).find(([p]) => p.endsWith('LogsView.tsx'))![1])
  it('the view reads nothing of a log’s state: no full, fullAtStart, emptiedTonight, lastEmptied or outcome', () => {
    expect(view).not.toMatch(/\bfull\b|fullAtStart|emptiedTonight|lastEmptied|outcome|\.digs\b|record\./)
  })
  it('no minimap, mark or trail is drawn while a night runs: the overhead is rendered only on the map question and the reveal', () => {
    const part = (import.meta.glob('../PartLogs.tsx', { query: '?raw', import: 'default', eager: true }) as Record<string, string>)['../PartLogs.tsx']
    const stage = part.slice(part.indexOf('function Stage('), part.indexOf('function MapQuestion('))
    expect(stage).not.toMatch(/ClearingOverhead/)
    expect(view).not.toMatch(/Overhead|trail|minimap/i)
  })
  it('the sound reads the night’s sound and nothing else', () => {
    const sound = strip((import.meta.glob('./sound.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>)['./sound.ts'])
    expect(sound).not.toMatch(/full|empty|beetle|outcome|dig/i)
  })
})
