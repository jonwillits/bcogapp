import { describe, it, expect } from 'vitest'
import { liveHistory, bandForRun, RUN_ORDER } from './history'
import { makeRng } from '../random'
import { runDay } from './day'
import { HANDS, RECIPES } from './range/places'
import { NEEDS } from './range/needs'

/**
 * The history before the lab (spec §7.4.2, §11 item 5, §14): no hidden
 * hominin was ever rewarded for carrying a probe or a digging stick, each saw
 * every step of the termite and tuber chains, and no hominin ever held more
 * than two items or made an item anywhere but where the table says.
 */
const SEEDS = [1000, 1001, 1002, 1003, 1004]

describe('the history before the lab', () => {
  const bands = SEEDS.map((s) => liveHistory(s))

  it('no hidden hominin has been rewarded for carrying a probe or a digging stick', () => {
    for (const b of bands)
      for (const c of b.counts) {
        expect(c.ate.termites, `${b.seed} ${c.kind}`).toBe(0)
        expect(c.ate.tubers, `${b.seed} ${c.kind}`).toBe(0)
      }
  })

  it('each hidden hominin saw every step of the termite and tuber chains, and the usual chains', () => {
    const steps = ['pick up sapling', 'make probe', 'wait at mounds', 'eat termites', 'pick up cobble', 'make flake', 'make diggingStick', 'wait at flats', 'eat tubers', 'eat carcass', 'eat marrow']
    for (const b of bands) for (const c of b.counts) for (const s of steps) expect(c.sawElder[s] ?? 0, `${b.seed} ${c.kind} saw ${s}`).toBeGreaterThan(0)
  })

  it('each was rewarded for the usual needs, carcasses and marrow', () => {
    for (const b of bands)
      for (const c of b.counts) {
        if (c.kind === 'adapted') continue
        expect(c.ate.carcass, `${b.seed} ${c.kind}`).toBeGreaterThan(50)
        expect(c.ate.marrow, `${b.seed} ${c.kind}`).toBeGreaterThan(5)
      }
  })

  it('the usual needs fill about seven tenths and three tenths of their days', () => {
    for (const b of bands) {
      const usual = b.dayKinds.filter((d) => d === 'carcass' || d === 'marrow').length
      const carcass = b.dayKinds.filter((d) => d === 'carcass').length / usual
      expect(carcass).toBeGreaterThan(0.6)
      expect(carcass).toBeLessThan(0.8)
    }
  })

  it('on a day, no hominin holds more than two items, and every item is made where and from what the table says', () => {
    const band = bands[0]
    const rng = makeRng(7)
    for (const need of NEEDS) {
      const result = runDay({ cue: need === 'carcass' ? 'vultures' : need === 'marrow' ? 'hyenas' : need === 'termites' ? 'rain' : 'dry', needPresent: true, elder: 'atCamp' }, bandForRun(band, 'A', rng), rng)
      for (const hd of [...result.hominins, result.elder]) {
        let hands = 0
        for (const s of hd.segments) {
          if (s.kind === 'pickUp') hands++
          if (s.kind === 'putDown') hands--
          if (s.kind === 'make') {
            const r = RECIPES[s.what]
            if (r.at) expect(s.place).toBe(r.at)
            expect(s.from).toEqual([...r.inputs])
            if (!r.consumes) hands++
          }
          expect(hands).toBeLessThanOrEqual(HANDS)
        }
        expect(hd.final.hands.length).toBeLessThanOrEqual(HANDS)
      }
    }
  })

  it('a run starts each hominin from the end of its history, so two runs from the same band agree', () => {
    const band = bands[1]
    const a = runDay({ cue: 'vultures', needPresent: true, elder: 'atCamp' }, bandForRun(band, 'A', makeRng(3)), makeRng(4))
    const b = runDay({ cue: 'vultures', needPresent: true, elder: 'atCamp' }, bandForRun(band, 'A', makeRng(3)), makeRng(4))
    expect(a.hominins.map((h) => h.errands)).toEqual(b.hominins.map((h) => h.errands))
    expect(RUN_ORDER.length).toBe(5)
  })
})
