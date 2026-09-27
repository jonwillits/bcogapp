import { describe, it, expect } from 'vitest'
import { Bench, TASKS, BENCH_STRUCTURES, REMOVE_MENU, STIMULATE_MENU, ROUTES, benchClaims, recordMap, type TaskId } from './bench'

/** The bench tests of the spec's §11, each named for the row of §8.5 it guards. */

const LEARNED = TASKS.filter((t) => t.learned).map((t) => t.id)
const num = (b: Bench, t: TaskId, label: RegExp) => {
  const r = b.test(t)
  const ro = r.readouts.find((x) => label.test(x.label))
  if (!ro || ro.number === undefined) throw new Error(`no numeric readout ${label} in ${t}: ${JSON.stringify(r.readouts)}`)
  return ro.number
}

describe('the separating experiment (both halves of the dopamine pair)', () => {
  it('removing the dopamine clusters lowers movement in every task, and the learned tasks cannot be scored cleanly', () => {
    const b = new Bench(7)
    for (const t of LEARNED) b.train(t)
    expect(b.remove('dopamineClusters').ok).toBe(true)
    for (const t of TASKS) {
      const r = b.test(t.id)
      expect(r.kind, t.id).toBe('reported')
      expect(r.movement, t.id).toBe('slow')
      expect(r.claims, t.id).toContain('§6.2.9-C11')
      expect(r.speciesNote, t.id).toMatch(/lamprey.*Parkinson/i)
    }
    // Lever presses fall well below a trained intact animal's.
    const intact = new Bench(7)
    intact.train('lever')
    expect(num(b, 'lever', /presses/)).toBeLessThan(num(intact, 'lever', /presses/) / 3)
    // Freezing cannot be told from not moving: the readout is not scorable.
    expect(b.test('toneShock').readouts[0].value).toBeNull()
  })

  it('silencing the dopamine fibers during Lever training, then testing, leaves movement normal and pressing at the untrained level', () => {
    const b = new Bench(11)
    b.silence = 'dopamineFibers'
    b.train('lever')
    b.silence = null
    const r = b.test('lever')
    expect(r.kind).toBe('follows')
    expect(r.movement).toBe('normal')
    expect(r.trainedUnder).toBe('dopamineFibers')
    expect(r.claims).toEqual(expect.arrayContaining(['§6.2.5-C8', '§6.2.5-C9', '§6.2.5-C14', '§6.2.6-C13']))
    expect(r.note).toMatch(/three-systems mapping predicts/)
    const presses = r.readouts[0].number!
    // Untrained intact animals over several seeds press this little; trained ones press ten times more.
    for (let s = 1; s <= 8; s++) {
      const u = new Bench(s)
      expect(Math.abs(num(u, 'lever', /presses/) - presses)).toBeLessThanOrEqual(5)
      const tr = new Bench(s)
      tr.train('lever')
      expect(num(tr, 'lever', /presses/)).toBeGreaterThan(presses + 8)
    }
  })

  it('silencing the dopamine fibers during Timed-blink training leaves the blink learned normally', () => {
    const b = new Bench(3)
    b.silence = 'dopamineFibers'
    b.train('timedBlink')
    const r = b.test('timedBlink')
    expect(r.kind).toBe('follows')
    expect(r.claims).toContain('#t-learning-structures')
    expect(r.readouts[0].number).toBeGreaterThan(70)
  })
})

describe('the climbing-fiber row', () => {
  it('silencing climbing fibers during Timed-blink training leaves the timed blink absent and the reflex blink unchanged', () => {
    const b = new Bench(5)
    b.silence = 'climbingFibers'
    b.train('timedBlink')
    b.silence = null
    const r = b.test('timedBlink')
    expect(r.kind).toBe('reported')
    expect(r.speciesNote).toBe('Rabbit.')
    expect(r.claims).toEqual(['§6.2.4-C12', '§6.2.4-C4'])
    const timed = r.readouts.find((x) => /already closed/.test(x.label))!
    const reflex = r.readouts.find((x) => /reflex/.test(x.label))!
    expect(timed.number).toBeLessThan(15)
    expect(reflex.number).toBe(100)
    // Against an intact trained animal, which has the timed blink.
    const i = new Bench(5)
    i.train('timedBlink')
    expect(num(i, 'timedBlink', /already closed/)).toBeGreaterThan(70)
  })

  it('silencing climbing fibers during Lever training leaves the lever learned normally', () => {
    const b = new Bench(5)
    b.silence = 'climbingFibers'
    b.train('lever')
    const r = b.test('lever')
    expect(r.kind).toBe('follows')
    expect(r.readouts[0].number).toBeGreaterThan(12)
  })
})

describe('the amygdala row', () => {
  it('removing the amygdala leaves both Tone-and-shock and Cue-and-food unlearned at test', () => {
    const b = new Bench(9)
    b.remove('amygdala')
    b.train('toneShock')
    b.train('cueFood')
    for (const t of ['toneShock', 'cueFood'] as const) {
      const r = b.test(t)
      expect(r.kind, t).toBe('reported')
      expect(r.speciesNote, t).toBe('Rat.')
      expect(r.claims, t).toEqual(['§6.3.13-C6', '§6.3.13-C7'])
      expect(r.movement, t).toBe('normal')
      expect(r.readouts[0].number, t).toBeLessThan(25)
    }
    const i = new Bench(9)
    i.train('toneShock')
    expect(num(i, 'toneShock', /freezing/)).toBeGreaterThan(50)
  })
})

describe('the tectum map', () => {
  it('stimulating neighboring points turns the animal toward neighboring places, monotonically', () => {
    const b = new Bench(2)
    const points = [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1]
    const dirs = points.map((p) => b.stimulate('tectum', { point: p }).direction!)
    for (let i = 1; i < dirs.length; i++) expect(dirs[i]).toBeGreaterThan(dirs[i - 1])
    expect(b.stimulate('tectum', { point: 0.5 }).direction).toBe(0)
    expect(b.stimulate('tectum', { point: 0 }).text).toMatch(/left/)
    expect(b.stimulate('tectum', { point: 1 }).text).toMatch(/right/)
    expect(b.stimulate('tectum', { point: 0.3 }).claims).toEqual(['§6.2.8-C3', '§6.2.8-C4', '§6.3.2-C4'])
  })
})

describe('the hindbrain refusal', () => {
  it('the hindbrain cannot be removed, and the refusal is shown', () => {
    const b = new Bench(1)
    const r = b.remove('hindbrain')
    expect(r.ok).toBe(false)
    expect(r.text).toMatch(/would not survive/)
    expect(r.text).toMatch(/breathing and heart rate/)
    expect(r.claims).toEqual(['§6.1.8-C6', '§6.3.1-C6'])
    expect(b.removed).toBeNull()
    expect(b.test('openField').movement).toBe('normal')
  })
})

describe('the other reported rows', () => {
  it('removing the neocortex leaves walking, grooming and exploring in the open field, and every other task grey', () => {
    const b = new Bench(4)
    for (const t of LEARNED) b.train(t)
    b.remove('pallium')
    const r = b.test('openField')
    expect(r.kind).toBe('reported')
    expect(r.claims).toEqual(['§6.2.8-C22'])
    expect(r.speciesNote).toMatch(/Cat, with the basal ganglia intact/)
    expect(r.readouts.map((x) => x.value)).toEqual(['continues', 'continues', 'continues'])
    for (const t of TASKS) if (t.id !== 'openField') expect(b.test(t.id).kind, t.id).toBe('notReported')
  })

  it('stimulating the periaqueductal gray gives the whole defensive pattern, in a rat', () => {
    const r = new Bench(1).stimulate('periaqueductalGray')
    expect(r.kind).toBe('reported')
    expect(r.speciesNote).toBe('Rat.')
    expect(r.text).toMatch(/whole defensive pattern.*freezing or fleeing.*reduced response to pain/)
  })

  it('raising dopamine is reported in the open field and grey elsewhere', () => {
    const b = new Bench(1)
    expect(b.stimulate('dopamineClusters', { task: 'openField' })).toMatchObject({ kind: 'reported', claims: ['§6.2.9-C12'], text: 'Unwanted movements break through.' })
    expect(b.stimulate('dopamineClusters', { task: 'lever' }).kind).toBe('notReported')
  })
})

describe('the grey cells', () => {
  it('a cell with no claim renders as no result reported, with no number and no movement', () => {
    const b = new Bench(1)
    b.remove('amygdala')
    for (const t of ['orient', 'lever', 'timedBlink', 'openField'] as const) {
      const r = b.test(t)
      expect(r.kind, t).toBe('notReported')
      expect(r.text, t).toMatch(/^No result reported\./)
      expect(r.readouts, t).toEqual([])
      expect(r.movement, t).toBeNull()
      expect(r.claims, t).toEqual([])
    }
    const bb = new Bench(1)
    bb.silence = 'climbingFibers'
    bb.train('toneShock')
    expect(bb.test('toneShock').kind).toBe('notReported')
  })

  it('the recording map’s grey cells are grey, not zero', () => {
    const b = new Bench(1)
    for (const t of TASKS) {
      for (const cell of b.record(t.id)) {
        if (cell.level === null) {
          expect(cell.kind, `${cell.structure}/${t.id}`).toBe('notReported')
          expect(cell.claims).toEqual([])
        } else {
          expect(cell.kind).toBe('follows')
          expect(cell.claims.length, `${cell.structure}/${t.id}`).toBeGreaterThan(0)
        }
      }
    }
  })

  it('no bench cell for the hippocampus is non-grey, and no menu offers it', () => {
    const b = new Bench(1)
    for (const t of TASKS) expect(b.record(t.id).find((c) => c.structure === 'hippocampus')!.level).toBeNull()
    expect(REMOVE_MENU.map((m) => m.id as string)).not.toContain('hippocampus')
    expect(STIMULATE_MENU.map((m) => m.id as string)).not.toContain('hippocampus')
    expect(BENCH_STRUCTURES.some((s) => s.id === 'hippocampus')).toBe(true)
  })

  it('the serotonin clusters are grey in every task', () => {
    const b = new Bench(1)
    for (const t of TASKS) expect(b.record(t.id).find((c) => c.structure === 'serotoninClusters')!.level).toBeNull()
  })
})

describe('the recording map', () => {
  it('matches §8.5 row for row', () => {
    const rows = Object.fromEntries(recordMap().map((r) => [r.structure, Object.values(r.levels).map((l) => (l === null ? '—' : l))]))
    expect(rows).toEqual({
      hindbrainReticular: ['moderate', 'moderate', 'moderate', 'moderate', 'moderate', 'moderate'],
      norepinephrineCluster: ['low', 'high', 'low', 'low', 'low', 'low'],
      cerebellum: ['low', '—', '—', 'moderate', 'high', 'moderate'],
      tectum: ['high', '—', 'low', '—', '—', 'low'],
      periaqueductalGray: ['—', 'high', '—', '—', '—', '—'],
      dopamineClusters: ['—', '—', 'moderate', 'moderate', '—', '—'],
      hypothalamus: ['—', '—', 'moderate', 'moderate', '—', '—'],
      thalamus: ['moderate', 'moderate', 'moderate', 'moderate', 'moderate', 'low'],
      striatum: ['moderate', 'moderate', 'high', 'high', 'moderate', 'moderate'],
      amygdala: ['low', 'high', 'high', '—', '—', '—'],
      pallium: ['moderate', 'moderate', 'moderate', 'moderate', 'moderate', 'moderate'],
      hippocampus: ['—', '—', '—', '—', '—', '—'],
      serotoninClusters: ['—', '—', '—', '—', '—', '—'],
    })
  })

  it('the dopamine cells in the two food tasks show Module 5’s shift, as a primate result', () => {
    const b = new Bench(1)
    for (const t of ['cueFood', 'lever'] as const) {
      const c = b.record(t).find((x) => x.structure === 'dopamineClusters')!
      expect(c.shift).toEqual({ early: 'at the food, not at the cue', late: 'at the cue, not at the food' })
      expect(c.crossRef).toMatch(/Module 5 §5.3.7.*primate/)
    }
    expect(b.record('orient').find((x) => x.structure === 'dopamineClusters')!.shift).toBeUndefined()
  })

  it('the amygdala is active in the threat task and the food task alike', () => {
    const b = new Bench(1)
    expect(b.record('toneShock').find((x) => x.structure === 'amygdala')!.level).toBe('high')
    expect(b.record('cueFood').find((x) => x.structure === 'amygdala')!.level).toBe('high')
  })
})

describe('determinism', () => {
  it('the same seed reproduces every bench number', () => {
    const run = (seed: number) => {
      const b = new Bench(seed)
      const out: string[] = []
      for (const t of LEARNED) b.train(t)
      for (const t of TASKS) out.push(JSON.stringify(b.test(t.id).readouts))
      b.remove('dopamineClusters')
      for (const t of TASKS) out.push(JSON.stringify(b.test(t.id).readouts))
      b.restore()
      b.silence = 'dopamineFibers'
      b.train('lever')
      out.push(JSON.stringify(b.test('lever').readouts))
      return out.join('\n')
    }
    expect(run(2026)).toBe(run(2026))
    expect(run(2026)).not.toBe(run(2027))
  })

  it('the run record keeps the last few runs only', () => {
    const b = new Bench(1)
    for (let i = 0; i < 20; i++) b.test('lever')
    expect(b.runs.lever.length).toBeLessThanOrEqual(6)
  })
})

describe('claims', () => {
  it('every non-grey result carries a claim id, and the menus list only structures with a row', () => {
    for (const id of benchClaims()) expect(id).toMatch(/^(§6\.\d(\.\d+)?-C\d+|#t-[a-z-]+)$/)
    expect(benchClaims().length).toBeGreaterThan(20)
    expect(REMOVE_MENU.map((m) => m.id)).toEqual(['pallium', 'dopamineClusters', 'amygdala', 'hindbrain'])
    expect(STIMULATE_MENU.map((m) => m.id)).toEqual(['dopamineClusters', 'periaqueductalGray', 'tectum'])
    expect(ROUTES.map((r) => r.id)).toEqual(['climbingFibers', 'dopamineFibers'])
  })
})
