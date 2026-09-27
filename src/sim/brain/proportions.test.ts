import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { REGIONS, PROPORTIONS, shares, proportionsFor } from './proportions'

/**
 * The proportions test of the spec's §11: the constants match the chapter's
 * figure function row for row, color for color.
 *
 * Two checks. First against a pasted copy of the source, so the test is
 * self-contained and a change to the constants fails here. Second, when the
 * course folder is reachable, against the live `make_figures.py`, so a change
 * to the figure fails here too.
 */

/**
 * Pasted 2026-09-27 from
 * course_creation/figures/06_vertebrate_neural_architecture/make_figures.py,
 * function f_one_plan_many_brains.
 */
const SOURCE = `
    REG = [("forebrain roof", "#13294B"), ("basal ganglia", "#4f6a91"),
           ("thalamus and hypothalamus", "#8aa0bd"), ("midbrain roof", "#FF5F05"),
           ("cerebellum", "#f7b98a"), ("hindbrain", "#c9ced6")]
    rows = [("lamprey", [14, 8, 10, 20, 0, 48]),
            ("shark", [16, 8, 9, 18, 18, 31]),
            ("bony fish", [14, 8, 9, 26, 16, 27]),
            ("frog", [22, 9, 10, 20, 6, 33]),
            ("lizard", [26, 10, 10, 18, 8, 28]),
            ("bird", [44, 10, 8, 10, 14, 14]),
            ("mammal", [52, 8, 8, 6, 16, 10])]
`

const COURSE_FIGURES =
  process.env.COURSE_FIGURES ??
  '/Users/jon/Library/CloudStorage/Box-Box/teaching/bcog_web/courses/introduction_to_brain_and_cognitive_science_1/current_version/course_creation/figures/06_vertebrate_neural_architecture/make_figures.py'

/** Parse the figure function's REG and rows out of Python source. */
function parseFigure(src: string) {
  const fn = src.includes('def f_one_plan_many_brains')
    ? src.slice(src.indexOf('def f_one_plan_many_brains'), src.indexOf('\ndef ', src.indexOf('def f_one_plan_many_brains') + 10))
    : src
  const regions = [...fn.matchAll(/\("([^"]+)",\s*"(#[0-9a-fA-F]{6})"\)/g)].map((m) => ({ label: m[1], color: m[2] }))
  const rows = [...fn.matchAll(/\("([a-z ]+)",\s*\[([\d,\s]+)\]\)/g)].map((m) => ({
    species: m[1],
    parts: m[2].split(',').map((s) => Number(s.trim())),
  }))
  return { regions, rows }
}

describe('proportions — pinned to #f-one-plan-many-brains', () => {
  it('the six regions match the pasted source, label and color', () => {
    const { regions } = parseFigure(SOURCE)
    expect(regions.length).toBe(6)
    expect(REGIONS.map((r) => ({ label: r.label, color: r.color }))).toEqual(regions)
  })

  it('the seven rows match the pasted source, number for number', () => {
    const { rows } = parseFigure(SOURCE)
    expect(rows.length).toBe(7)
    expect(PROPORTIONS.map((r) => ({ species: r.species, parts: [...r.parts] }))).toEqual(rows)
  })

  it('matches the live figure source when the course folder is reachable', () => {
    if (!existsSync(COURSE_FIGURES)) return
    const live = parseFigure(readFileSync(COURSE_FIGURES, 'utf-8'))
    expect(live.regions).toEqual(REGIONS.map((r) => ({ label: r.label, color: r.color })))
    expect(live.rows).toEqual(PROPORTIONS.map((r) => ({ species: r.species, parts: [...r.parts] })))
  })

  it('shares sum to one and the lamprey has no cerebellum share', () => {
    for (const row of PROPORTIONS) {
      const s = shares(row)
      expect(s.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10)
    }
    expect(shares(proportionsFor('lamprey'))[4]).toBe(0)
  })
})
