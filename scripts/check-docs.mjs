/**
 * Do the student-facing documents still describe the app that exists?
 *
 * Every failure in the Module 2 launch was the same shape: a claim in a
 * document that nothing could check. The handout described a simulation with
 * generations, an energy readout and a "Reset (same seed)" button, none of
 * which the app has had for months; the report document then drifted from the
 * handout, and a student found that one before we did.
 *
 * This checks the mechanical half - the words. It cannot tell you whether a
 * question is answerable or whether a described behaviour actually happens;
 * that needs a test per claim, written deliberately. `closeout.mjs` prints
 * which claims have one.
 *
 *   node scripts/check-docs.mjs
 *   INTRO_TO_BCS=/some/path node scripts/check-docs.mjs
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

export const COURSE =
  process.env.INTRO_TO_BCS ??
  '/Users/jon/Library/CloudStorage/Box-Box/teaching/bcog_web/courses/introduction_to_brain_and_cognitive_science_1/current_version/intro_to_bcs'

const LAB = join(COURSE, 'comparative_approaches/evolution_lab')
const HANDOUT = join(LAB, 'evolution_lab.md')
const REPORT = join(LAB, 'evolution_lab_report.docx')

const problems = []
const notes = []
const fail = (where, msg) => problems.push({ where, msg })

// ----------------------------------------------------------------- reading

/** A .docx is a zip; pull its text without adding a dependency. */
export function docxText(path) {
  const xml = execFileSync('unzip', ['-p', path, 'word/document.xml'], {
    encoding: 'utf-8',
    maxBuffer: 32 * 1024 * 1024,
  })
  return xml
    .replace(/<w:p[ >]/g, '\n<w:p ')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/[ \t]+/g, ' ')
}

/** Every string the app can put in front of a student. */
function appStrings() {
  const out = new Set()
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name)
      if (e.isDirectory()) walk(p)
      else if (e.name.endsWith('.tsx')) {
        const t = readFileSync(p, 'utf-8')
        for (const re of [
          /label="([^"]+)"/g,
          /label:\s*'([^']+)'/g,
          /title="([^"]+)"/g,
          />\s*([A-Z][^<>{}\n]{2,44})\s*</g,
        ]) {
          for (const m of t.matchAll(re)) out.add(m[1].trim())
        }
      }
    }
  }
  walk(join(ROOT, 'src'))
  return out
}

// -------------------------------------------------------- 1. banned wording

/**
 * Wording the simulation retired. Each may carry `unless` phrases: the places
 * the term is used *correctly*, which is usually to tell students it no longer
 * applies. Add a row whenever a design change strands a word in the documents.
 */
const BANNED = [
  {
    term: /\bgenerations?\b/gi,
    why: 'the engine has no generations - use a duration or a birth count',
    unless: ['there are no generations'],
  },
  {
    term: /\b(average|mean) energy\b/gi,
    why: 'no energy readout exists; the panel shows births per minute',
  },
  { term: /Reset \(same seed\)/gi, why: 'the button is "Reset simulation"' },
  { term: /\bpopulation size\b/gi, why: 'the control is "How many the arena holds"' },
  { term: /\bthe pit\b/gi, why: 'it is called the arena' },
  {
    term: /body colou?r (you recorded|of most)/gi,
    why: 'the neutral trait is the mark; body colour is computed from the wiring',
  },
  {
    term: /\bcolour\b|\bbehaviour\b|\bfavour[a-z]*\b|\bcentre\b/gi,
    why: 'US spelling in student-facing text',
  },
  {
    term: /light (dims|runs out|is used up)/gi,
    why: 'food patches drift and never deplete',
  },
]

function checkBanned(text, label) {
  const lines = text.split('\n')
  for (const { term, why, unless = [] } of BANNED) {
    lines.forEach((line, i) => {
      const low = line.toLowerCase()
      if (unless.some((u) => low.includes(u))) return
      const hits = line.match(term)
      if (hits) fail(label, `line ${i + 1}: "${hits[0]}" - ${why}`)
    })
  }
}

// -------------------------------------------------------- 2. control names

/**
 * Controls the labs are allowed to name. Each must exist in the app verbatim,
 * so renaming one in the scene fails this until the documents follow. Add a row
 * when a document starts naming a new control.
 */
const CONTROLS = [
  'Reset simulation', 'New seed', 'Founders', 'Mutation rate', 'Inheritance',
  'Selection', 'Light regime', 'How many the arena holds', 'Size of the arena',
  'Size of a food patch', 'How many food patches', 'How fast the patches drift',
  'Sensor noise', 'Reveal wiring', 'Reveal tree', 'Creature Options',
  'World Options', 'Run Options', 'View Options', 'Population W', 'Population Z',
  'Born since the start', 'Creatures alive', 'Births per minute, early on',
  'Births per minute, now', 'Food', 'Poison', 'Neutral',
]

function checkControls() {
  const strings = appStrings()
  const flat = [...strings].join(' | ')
  for (const c of CONTROLS) {
    if (!flat.includes(c)) {
      fail('app', `the documents name "${c}", which no longer exists in the scene`)
    }
  }
  notes.push(
    `${CONTROLS.length} control names still exist in the app (of ${strings.size} strings found)`,
  )
}

// ------------------------- 3. handout and report must ask the same questions

const qNumbers = (text) => {
  const set = new Set()
  for (const m of text.matchAll(/Q(\d+b?)[.\s—-]/g)) set.add(m[1])
  return [...set].sort(
    (a, b) => parseInt(a) - parseInt(b) || a.localeCompare(b),
  )
}

function checkQuestionSets(handout, report) {
  const h = qNumbers(handout)
  const r = qNumbers(report)
  const onlyH = h.filter((q) => !r.includes(q))
  const onlyR = r.filter((q) => !h.includes(q))
  if (onlyH.length) {
    fail('report', `asked on the website but missing from the report document: ${onlyH.map((q) => 'Q' + q).join(', ')}`)
  }
  if (onlyR.length) {
    fail('handout', `in the report document but not on the website: ${onlyR.map((q) => 'Q' + q).join(', ')}`)
  }
  if (!onlyH.length && !onlyR.length) {
    notes.push(`both documents ask the same ${h.length} questions`)
  }
}

// -------------------------------------------------------------------- run

function main() {
  for (const [label, p] of [['handout', HANDOUT], ['report document', REPORT]]) {
    if (!existsSync(p)) {
      console.error(`\n  Cannot find the ${label}: ${p}`)
      console.error('  Set INTRO_TO_BCS if the course repo lives elsewhere.\n')
      return 2
    }
  }
  const handout = readFileSync(HANDOUT, 'utf-8')
  const report = docxText(REPORT)

  checkBanned(handout, 'handout')
  checkBanned(report, 'report')
  checkControls()
  checkQuestionSets(handout, report)

  console.log('\n  Document checks')
  console.log('  ' + '-'.repeat(64))
  for (const n of notes) console.log(`  ok    ${n}`)
  if (!problems.length) {
    console.log('  ok    no retired wording in either document')
    console.log('\n  All document checks passed.\n')
    return 0
  }
  console.log('')
  for (const { where, msg } of problems) console.log(`  FAIL  [${where}] ${msg}`)
  const n = problems.length
  console.log(`\n  ${n} problem${n === 1 ? '' : 's'}. This is what students read.\n`)
  return 1
}

process.exit(main())
