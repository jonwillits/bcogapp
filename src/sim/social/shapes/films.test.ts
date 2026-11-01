import { describe, it, expect } from 'vitest'
import { FILM_1, FILM_2, FILM_3, HOUSE, SHAPES, STAGE, doorAngleAt, measure, positionAt, reversed } from './films'

/**
 * Part 3, Step 1 (spec §7.1, §16): the control film's total motion, speeds
 * and number of contacts are within 10% of Film 2's, by a measurement on
 * the keyframe data; Film 3 is Film 2 reversed frame for frame; every
 * keyframe is on the stage; and nothing in the films' data names what the
 * part tests (the strings test is in the scene's naming test).
 */

describe('the three films', () => {
  it('are 25 to 35 seconds each, with every keyframe on the stage and times in order', () => {
    for (const f of [FILM_1, FILM_2, FILM_3]) {
      expect(f.duration).toBeGreaterThanOrEqual(25)
      expect(f.duration).toBeLessThanOrEqual(35)
      for (const s of SHAPES) {
        const frames = f.shapes[s]
        for (let i = 0; i < frames.length; i++) {
          expect(frames[i].x).toBeGreaterThanOrEqual(0)
          expect(frames[i].x).toBeLessThanOrEqual(STAGE.width)
          expect(frames[i].y).toBeGreaterThanOrEqual(0)
          expect(frames[i].y).toBeLessThanOrEqual(STAGE.height)
          if (i > 0) expect(frames[i].t).toBeGreaterThanOrEqual(frames[i - 1].t)
        }
        expect(frames[0].t).toBe(0)
        expect(frames[frames.length - 1].t).toBe(f.duration)
      }
    }
  })
  it('the control’s total motion, each shape’s mean speed, and the number of contacts are within 10% of Film 2’s, and the door moves as often', () => {
    const a = measure(FILM_1)
    const b = measure(FILM_2)
    expect(Math.abs(a.motion.total - b.motion.total) / b.motion.total).toBeLessThanOrEqual(0.1)
    for (const s of SHAPES) expect(Math.abs(a.speed[s] - b.speed[s]) / b.speed[s], s).toBeLessThanOrEqual(0.1)
    expect(Math.abs(a.contactTotal - b.contactTotal) / b.contactTotal).toBeLessThanOrEqual(0.1)
    expect(a.doorMoves).toBe(b.doorMoves)
    expect(b.contactTotal).toBeGreaterThanOrEqual(3)
  })
  it('Film 3 is Film 2 reversed frame for frame', () => {
    const r = reversed(FILM_2)
    expect(FILM_3).toEqual(r)
    for (const s of SHAPES) {
      for (let i = 0; i <= 60; i++) {
        const t = (i / 60) * FILM_2.duration
        const p = positionAt(FILM_2.shapes[s], t)
        const q = positionAt(FILM_3.shapes[s], FILM_2.duration - t)
        expect(q.x).toBeCloseTo(p.x, 6)
        expect(q.y).toBeCloseTo(p.y, 6)
      }
    }
    for (let i = 0; i <= 60; i++) {
      const t = (i / 60) * FILM_2.duration
      expect(doorAngleAt(FILM_3, FILM_2.duration - t)).toBeCloseTo(doorAngleAt(FILM_2, t), 6)
    }
    expect(measure(FILM_3).motion.total).toBeCloseTo(measure(FILM_2).motion.total, 3)
  })
  it('in Film 2 the disc goes into the house while the door is open and the door shuts behind it', () => {
    const inside = (x: number, y: number) => x > HOUSE.x && x < HOUSE.x + HOUSE.width && y > HOUSE.y && y < HOUSE.y + HOUSE.height
    const d = positionAt(FILM_2.shapes.disc, 20)
    expect(inside(d.x, d.y)).toBe(true)
    expect(doorAngleAt(FILM_2, 17)).toBeGreaterThan(45)
    expect(doorAngleAt(FILM_2, 20)).toBe(0)
  })
})
