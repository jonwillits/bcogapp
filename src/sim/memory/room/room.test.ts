import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { FITTING, ITEMS, UNFITTING, FURNITURE, itemById } from './items'
import { CHECKLIST_LENGTH, arrangementFor, checklistOrder, isPresent, otherArrangement, presentIn, typeOf, type Arrangement } from './arrangements'
import { scoreChecklist, type ChecklistAnswer } from './checklist'
import { FURNITURE_PLACES, ITEM_PLACES, ROOM, sphereCenter, sphereRadius } from './layout'
import { PATH_SECONDS, cameraAt, secondsInView } from './path'
import { byHand } from '../../fish/sdt'
import { MODEL_FILES } from './models'

const MANIFEST = JSON.parse(readFileSync(join(__dirname, '..', '..', '..', '..', 'public', 'm10', 'room', 'manifest.json'), 'utf-8')) as { models: { id: string; file: string }[] }
const SIZES = JSON.parse(readFileSync(join(__dirname, '..', '..', '..', '..', 'training', 'm10', 'room', 'sizes.json'), 'utf-8')) as Record<string, { width: number; height: number; depth: number }>

describe('the items (§7.1, §7.3)', () => {
  it('twelve fitting and twelve unfitting items, every one a shipped model, every name with no hint of its kind', () => {
    expect(FITTING.length).toBe(12)
    expect(UNFITTING.length).toBe(12)
    expect(ITEMS.length).toBe(CHECKLIST_LENGTH)
    for (const it of ITEMS) {
      expect(MANIFEST.models.some((m) => m.id === it.id), it.id).toBe(true)
      expect(it.name).not.toMatch(/fit|typical|usual|odd|strange|dorm|consistent|expected|schema/i)
    }
    for (const f of FURNITURE) expect(MANIFEST.models.some((m) => m.id === f), f).toBe(true)
    expect(new Set(ITEMS.map((i) => i.id)).size).toBe(24)
    // The model table the scene loads from matches the manifest, id for id.
    for (const [id, file] of Object.entries(MODEL_FILES)) expect(MANIFEST.models.find((m) => m.id === id)?.file, id).toBe(file)
    for (const it of ITEMS) expect(MODEL_FILES[it.id], it.id).toBeDefined()
    for (const f of FURNITURE) expect(MODEL_FILES[f], f).toBeDefined()
  })
  it('every checklist item is present in exactly one arrangement, six of each kind per arrangement', () => {
    for (const it of ITEMS) expect(Number(isPresent('A', it.id)) + Number(isPresent('B', it.id)), it.id).toBe(1)
    for (const arr of ['A', 'B'] as Arrangement[]) {
      const p = presentIn(arr)
      expect(p.length).toBe(12)
      expect(p.filter((i) => i.kind === 'fitting').length).toBe(6)
      const types = ITEMS.map((i) => typeOf(arr, i.id))
      for (const t of ['present-fitting', 'present-unfitting', 'absent-fitting', 'absent-unfitting'] as const) expect(types.filter((x) => x === t).length, `${arr} ${t}`).toBe(6)
    }
  })
  it('the seed assigns an arrangement, the restart takes the other, and both occur over seeds', () => {
    const firsts = new Set<Arrangement>()
    for (let seed = 1; seed <= 40; seed++) {
      const a = arrangementFor(seed, 0)
      firsts.add(a)
      expect(arrangementFor(seed, 1)).toBe(otherArrangement(a))
    }
    expect(firsts.size).toBe(2)
  })
  it('the checklist order is the seed’s, holds every item once, and differs between seeds', () => {
    const a = checklistOrder(3, 'A')
    expect([...a].sort()).toEqual(ITEMS.map((i) => i.id).sort())
    expect(checklistOrder(3, 'A')).toEqual(a)
    expect(checklistOrder(4, 'A')).not.toEqual(a)
  })
})

describe('scoring (§7.4)', () => {
  const answerAll = (say: (id: string) => boolean, conf: (id: string) => 1 | 2 | 3 | 4): ChecklistAnswer[] => ITEMS.map((i) => ({ id: i.id, inRoom: say(i.id), confidence: conf(i.id) }))
  it('a perfect checklist gives six hits and six correct rejections per kind, with the rates repaired at the ends', () => {
    const s = scoreChecklist('A', answerAll((id) => isPresent('A', id), () => 4))
    for (const k of [s.fitting, s.unfitting]) {
      expect(k.counts).toEqual({ hits: 6, misses: 0, falseAlarms: 0, correctRejections: 6 })
      expect(k.repaired).toBe(true)
      expect(k.byHand.dPrime).toBeGreaterThan(2)
      expect(k.confidence.hit).toBe(4)
      expect(k.confidence.miss).toBeNull()
    }
    expect(s.rows.length).toBe(24)
  })
  it('saying "in the room" to every fitting item and "not" to every unfitting one scores six false alarms on the fitting side and six misses on the other', () => {
    const s = scoreChecklist('B', answerAll((id) => itemById(id).kind === 'fitting', (id) => (itemById(id).kind === 'fitting' ? 3 : 1)))
    expect(s.fitting.counts).toEqual({ hits: 6, misses: 0, falseAlarms: 6, correctRejections: 0 })
    expect(s.unfitting.counts).toEqual({ hits: 0, misses: 6, falseAlarms: 0, correctRejections: 6 })
    expect(s.fitting.meanConfidence).toBe(3)
    expect(s.confidence.falseAlarm).toBe(3)
    expect(s.confidence.miss).toBe(1)
  })
  it('d′ and the criterion are Lab 7’s: 42, 8, 8, 42 gives 1.99 and a neutral criterion', () => {
    const r = byHand({ hits: 42, misses: 8, falseAlarms: 8, correctRejections: 42 })
    expect(r.dPrime).toBeCloseTo(1.99, 2)
    expect(Math.abs(r.criterion)).toBeLessThan(0.01)
  })
})

describe('the layout and the camera path (§7.1)', () => {
  it('every item and every piece of furniture has a place inside the room, and a model size to scale from', () => {
    for (const it of ITEMS) {
      const p = ITEM_PLACES[it.id]
      expect(p, it.id).toBeDefined()
      expect(Math.abs(p.x)).toBeLessThan(ROOM.width / 2)
      expect(Math.abs(p.z)).toBeLessThan(ROOM.depth / 2)
      const file = MANIFEST.models.find((m) => m.id === it.id)!.file
      expect(SIZES[file], file).toBeDefined()
    }
    for (const f of FURNITURE) expect(FURNITURE_PLACES[f], f).toBeDefined()
  })
  it('two items present together never share a place', () => {
    for (const arr of ['A', 'B'] as Arrangement[]) {
      const p = presentIn(arr)
      for (let i = 0; i < p.length; i++)
        for (let j = i + 1; j < p.length; j++) {
          const a = ITEM_PLACES[p[i].id]
          const b = ITEM_PLACES[p[j].id]
          const d = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)
          expect(d, `${arr}: ${p[i].id} and ${p[j].id}`).toBeGreaterThan(0.25)
        }
    }
  })
  it('the path stays inside the room at eye height, is closed, and lasts 30 seconds', () => {
    for (let t = 0; t < PATH_SECONDS; t += 0.5) {
      const c = cameraAt(t)
      expect(Math.abs(c.x)).toBeLessThan(ROOM.width / 2 - 0.4)
      expect(Math.abs(c.z)).toBeLessThan(ROOM.depth / 2 - 0.4)
      expect(c.y).toBeCloseTo(1.5, 5)
    }
    expect(cameraAt(0).distanceTo(cameraAt(PATH_SECONDS))).toBeLessThan(1e-6)
  })
  it('every present item is in view for at least 4 of the 30 seconds in both arrangements, by frustum test, and within 4 m for at least 1 second', () => {
    const report: { label: string; inView: number; near: number }[] = []
    for (const arr of ['A', 'B'] as Arrangement[]) {
      for (const it of presentIn(arr)) {
        const p = ITEM_PLACES[it.id]
        const { inView, near } = secondsInView(sphereCenter(p), sphereRadius(p.height))
        report.push({ label: `${arr} ${it.id}`, inView, near })
      }
    }
    if (process.env.ROOM_REPORT) console.log(report.map((r) => `${r.label} ${r.inView.toFixed(1)} s in view, ${r.near.toFixed(1)} s near`).join('\n'))
    for (const r of report) {
      expect(r.inView, r.label).toBeGreaterThanOrEqual(4.0)
      expect(r.near, r.label).toBeGreaterThanOrEqual(1.0)
    }
  })
})
