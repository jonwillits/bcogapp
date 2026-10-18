import { describe, it, expect } from 'vitest'
import { makeRng } from '../../random'
import { SpatialSystem } from './system'
import { HeadDirection, N, VIEW_UNITS } from './ring'
import { RecordingSession } from '../recording'
import { BOX_A } from '../rooms'

/**
 * The structural boundaries of the Module 9 spec's §12, held by reading
 * the source and by scripted sessions.
 */

const spatial = import.meta.glob('./*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const production = Object.entries(spatial).filter(([p]) => !p.includes('.test.') && !p.includes('.probe.'))
const imports = (src: string) => src.match(/^import .*$/gm)?.join('\n') ?? ''

describe('the cells never read the rat’s true position (§12, item 4)', () => {
  it('finds the sources', () => {
    for (const f of ['./ring.ts', './estimate.ts', './maps.ts', './system.ts', './stability.ts', './angles.ts']) expect(production.some(([p]) => p === f), f).toBe(true)
  })

  it('nothing under spatial/ imports the body, the rooms, the recording session, or any scene', () => {
    for (const [path, src] of production) {
      expect(imports(src), path).not.toMatch(/\.\.\/body|\.\.\/rooms|\.\.\/recording|\.\.\/homing|\.\.\/rats|\.\.\/patch|scenes\//)
      expect(src, path).not.toMatch(/\btruePose\b|\bbody\.(x|y|heading)\b/)
    }
  })

  it('the only pose the system sees is in Senses: a turn, a step, bearings and distances, a contact, the seen center, and the room', () => {
    const sys = production.find(([p]) => p === './system.ts')![1]
    const block = sys.slice(sys.indexOf('export interface Senses'), sys.indexOf('export interface SpatialOptions'))
    const fields = [...block.matchAll(/^\s{2}(\w+)\??:/gm)].map((m) => m[1])
    expect(fields.sort()).toEqual(['center', 'contact', 'dt', 'landmarks', 'room', 'step', 'turn'])
  })
})

describe('landmark input reaches the lower ring only through the bounded nudge (§14)', () => {
  it('the lower ring’s inputs are its own rates, the turn signal times them, the background drive, and the nudge', () => {
    const ring = production.find(([p]) => p === './ring.ts')![1]
    // The nudge is computed from the landmark drive by one function, and that is the one write into the lower input slot for it.
    expect(ring).toMatch(/this\.nudge\[j\] = boundedNudge\(drive\[j\]\)/)
    expect(ring).toMatch(/inp\[2 \* N \+ 1\] = this\.nudge\[j\]/)
    // The landmark drive itself goes to the upper ring and nowhere else on the lower one.
    const lowerLoop = ring.slice(ring.indexOf('// 3. The lower ring'), ring.indexOf('// 4. The upper ring'))
    expect(lowerLoop).not.toMatch(/drive\[/)
    expect(lowerLoop).not.toMatch(/viewActivity|\bx\[/)
  })

  it('the nudge is clamped to NUDGE_MAX in every case', () => {
    const ring = production.find(([p]) => p === './ring.ts')![1]
    const fn = ring.slice(ring.indexOf('export function boundedNudge'), ring.indexOf('function decode'))
    expect(fn).toMatch(/n > NUDGE_MAX \? NUDGE_MAX : n < -NUDGE_MAX \? -NUDGE_MAX : n/)
  })
})

describe('no running the map without moving (§12, item 1)', () => {
  it('ratesAt throws unless the system was built offline, and this scene never builds it offline', () => {
    const sys = new SpatialSystem(makeRng(1), { landmarks: ['card'] })
    expect(() => sys.ratesAt(0.1, 0.1)).toThrow(/does not run the map without moving/)
    const open = new SpatialSystem(makeRng(1), { landmarks: ['card'], offline: true })
    expect(() => open.ratesAt(0.1, 0.1)).not.toThrow()
    const scene = import.meta.glob('../../../scenes/m09_rat/**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
    const session = import.meta.glob('../*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
    for (const [path, src] of [...Object.entries(scene), ...Object.entries(session)]) {
      if (path.includes('.test.') || path.includes('.probe.')) continue
      expect(src, path).not.toMatch(/offline:\s*true/)
      expect(src, path).not.toMatch(/\bratesAt\(/)
    }
  })
})

describe('one learner (§12, item 10)', () => {
  it('during a scripted session the only numbers that change by learning are the view weights onto the upper ring', () => {
    const s = new RecordingSession(5, BOX_A)
    const hd = s.spatial.hd
    const lowerBefore = hd.lower.map((u) => [u.baseline, u.threshold, ...u.weights].join(','))
    const upperFixed = hd.upper.map((u) => [u.baseline, u.threshold, u.weights[0]].join(','))
    const viewBefore = hd.learnedWeights()
    s.exploring = true
    s.run(180)
    expect(hd.lower.map((u) => [u.baseline, u.threshold, ...u.weights].join(','))).toEqual(lowerBefore)
    expect(hd.upper.map((u) => [u.baseline, u.threshold, u.weights[0]].join(','))).toEqual(upperFixed)
    const viewAfter = hd.learnedWeights()
    expect(viewAfter.length).toBe(N * VIEW_UNITS * 2)
    expect(viewAfter.some((w, i) => w !== viewBefore[i])).toBe(true)
    // And only the card that was in view learned anything.
    const black = hd.landmarkWeights('black card').flat()
    expect(black.every((w) => w === 0)).toBe(true)
  })

  it('the learned weights go through thirdFactor on the Coincidence setting and learnWeights, and nothing else', () => {
    const ring = production.find(([p]) => p === './ring.ts')![1]
    expect(ring).toMatch(/thirdFactor\('coincidence'/)
    expect(ring).toMatch(/learnWeights\(this\.upper\[j\], changes, this\.limits, false\)/)
    expect(ring).not.toMatch(/thirdFactor\('(prediction|teacher|verdict|passed-back)'/)
    for (const [path, src] of production) {
      if (path === './ring.ts') continue
      expect(src, path).not.toMatch(/learnWeights|thirdFactor/)
    }
    // Nothing else in the rodent directory learns either.
    const rest = import.meta.glob('../*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
    for (const [path, src] of Object.entries(rest)) {
      if (path.includes('.test.') || path.includes('.probe.')) continue
      expect(src, path).not.toMatch(/learnWeights|thirdFactor/)
    }
  })

  it('the rings are Lab 4’s rate units', () => {
    const hd = new HeadDirection(makeRng(1), ['card'])
    for (const u of [...hd.lower, ...hd.upper]) {
      expect(typeof u.baseline).toBe('number')
      expect(typeof u.threshold).toBe('number')
      expect(Array.isArray(u.weights)).toBe(true)
    }
    const ring = production.find(([p]) => p === './ring.ts')![1]
    expect(imports(ring)).toMatch(/from '\.\.\/\.\.\/bilaterian\/unit'/)
    expect(ring).toMatch(/activate\('sigmoid', net, u\.threshold, RING\.width\)/)
  })
})

describe('determinism', () => {
  it('the same seed reproduces every number of a session, and no file in the rodent directory calls Math.random', () => {
    const a = new RecordingSession(77, BOX_A)
    const b = new RecordingSession(77, BOX_A)
    a.exploring = b.exploring = true
    a.run(30)
    b.run(30)
    expect(a.body.pose).toEqual(b.body.pose)
    expect([...a.spatial.hd.upperRate]).toEqual([...b.spatial.hd.upperRate])
    expect(a.spatial.estimate.x).toBe(b.spatial.estimate.x)
    expect([...a.maps.occupancy]).toEqual([...b.maps.occupancy])
    const all = import.meta.glob('../**/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
    for (const [path, src] of Object.entries(all)) if (!path.includes('.test.')) expect(src, path).not.toMatch(/Math\.random/)
  })
})
