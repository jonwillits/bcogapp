import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { benchClaims } from './bench'
import { STRUCTURES } from './structures'
import { CARDS } from './tree'

/**
 * The claim test of the spec's §11: every claim id the scene can print exists
 * in the chapter's claim index. The outline is read live when the course
 * folder is reachable; otherwise the pasted list below, with its date, is
 * what the ids are checked against.
 */

const OUTLINE =
  process.env.COURSE_OUTLINE ??
  '/Users/jon/Library/CloudStorage/Box-Box/teaching/bcog_web/courses/introduction_to_brain_and_cognitive_science_1/current_version/course_creation/textbook/06_vertebrate_neural_architecture/vertebrate_neural_architecture_reading_OUTLINE.md'

/**
 * Pasted 2026-09-27 from the outline: every id the scene uses, confirmed
 * present that day. Regenerate with `npx vitest run -t "prints the ids"`.
 */
const KNOWN_2026_09_27 = new Set([
  '§6.1.8-C4', '§6.1.8-C6', '§6.1.8-C8', '§6.1.8-C12', '§6.1.8-C13', '§6.1.8-C14', '§6.1.8-C15', '§6.1.8-C16', '§6.1.8-C17',
  '§6.1.8-C18', '§6.1.8-C19', '§6.1.8-C20', '§6.1.8-C24', '§6.1.8-C28',
  '§6.2.1-C1', '§6.2.4-C2', '§6.2.4-C3', '§6.2.4-C4', '§6.2.4-C8', '§6.2.4-C10', '§6.2.4-C12',
  '§6.2.5-C2', '§6.2.5-C3', '§6.2.5-C4', '§6.2.5-C8', '§6.2.5-C9', '§6.2.5-C14', '§6.2.6-C12', '§6.2.6-C13',
  '§6.2.8-C3', '§6.2.8-C4', '§6.2.8-C22', '§6.2.9-C11', '§6.2.9-C12', '§6.2.10-C1',
  '§6.3.1-C6', '§6.3.1-C8', '§6.3.1-C10', '§6.3.1-C11',
  '§6.3.2-C2', '§6.3.2-C3', '§6.3.2-C4', '§6.3.2-C10', '§6.3.2-C11', '§6.3.2-C15', '§6.3.2-C16', '§6.3.2-C17',
  '§6.3.3-C2', '§6.3.3-C4', '§6.3.3-C9', '§6.3.3-C11', '§6.3.3-C12', '§6.3.3-C13', '§6.3.3-C14',
  '§6.3.4-C6', '§6.3.4-C11', '§6.3.5-C4', '§6.3.5-C7', '§6.3.5-C9', '§6.3.5-C10', '§6.3.5-C20', '§6.3.5-C22',
  '§6.3.6-C20', '§6.3.6-C21',
  '§6.3.13-C3', '§6.3.13-C6', '§6.3.13-C7', '§6.3.13-C15', '§6.3.13-C16',
])

const TABLES = new Set(['#t-learning-structures', '#t-one-region-many-jobs', '#t-conserved-elaborated'])

/** Every claim id anything in the scene's data can print. */
export function allSceneClaims(): string[] {
  const ids = new Set<string>(benchClaims())
  for (const s of STRUCTURES) s.claims.forEach((c) => ids.add(c))
  for (const c of CARDS) c.claims.forEach((x) => ids.add(x))
  return [...ids].sort()
}

describe('claim ids', () => {
  it('every id matches the pattern §6.x(.y)-Cn or names a chapter table', () => {
    for (const id of allSceneClaims()) expect(id).toMatch(/^(§6\.\d(\.\d+)?-C\d+|#t-[a-z-]+)$/)
  })

  it('every id is in the pasted list', () => {
    for (const id of allSceneClaims()) {
      if (id.startsWith('#')) expect(TABLES.has(id), id).toBe(true)
      else expect(KNOWN_2026_09_27.has(id), id).toBe(true)
    }
  })

  it('every id exists in the live outline when it is reachable', () => {
    if (!existsSync(OUTLINE)) return
    const text = readFileSync(OUTLINE, 'utf-8')
    for (const id of allSceneClaims()) {
      if (id.startsWith('#')) expect(text.includes(id), id).toBe(true)
      else expect(text.includes(`**${id}**`), id).toBe(true)
    }
  })

  it('prints the ids', () => {
    expect(allSceneClaims().length).toBeGreaterThan(40)
  })
})
