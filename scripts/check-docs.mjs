/**
 * Do the student-facing documents still describe the app that exists?
 *
 * Every failure in the Module 2 launch was the same shape: a claim in a
 * document that nothing could check. The handout described a simulation with
 * generations, an energy readout and a "Reset (same seed)" button, none of
 * which the app had had for months; the report document then drifted from the
 * handout, and a student found that one before we did.
 *
 * This checks the mechanical half - the words. It cannot tell you whether a
 * question is answerable or whether a described behaviour actually happens;
 * that needs a test per claim. `closeout.mjs` prints which claims have one.
 *
 *   node scripts/check-docs.mjs                 # every lab
 *   node scripts/check-docs.mjs m02-evolution   # one lab
 *
 * Labs are declared in `labs.config.mjs`. Nothing here knows about any module.
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { LABS, COURSE, BANNED_EVERYWHERE } from './labs.config.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

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

/** Every string a scene can put in front of a student. */
function appStrings(sceneDir) {
  const out = new Set()
  const walk = (dir) => {
    if (!existsSync(dir)) return
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
  // Shared components count: a scene renders them too.
  walk(join(ROOT, 'src/components'))
  walk(join(ROOT, sceneDir))
  return out
}

const qNumbers = (text) => {
  const set = new Set()
  for (const m of text.matchAll(/Q(\d+[a-z]?)[.\s—-]/g)) set.add(m[1])
  return [...set].sort((a, b) => parseInt(a) - parseInt(b) || a.localeCompare(b))
}

// -------------------------------------------------------------- one lab

function checkLab(lab) {
  const problems = []
  const notes = []
  const fail = (where, msg) => problems.push({ where, msg })

  const handoutPath = join(COURSE, lab.handout)
  const reportPath = join(COURSE, lab.report)
  for (const [label, p] of [['handout', handoutPath], ['report document', reportPath]]) {
    if (!existsSync(p)) {
      fail(label, `not found at ${p} - set INTRO_TO_BCS if the course repo moved`)
      return { problems, notes }
    }
  }

  const handout = readFileSync(handoutPath, 'utf-8')
  const report = docxText(reportPath)

  // 1. wording the design has retired
  const rules = [...BANNED_EVERYWHERE, ...(lab.retired ?? [])]
  for (const [label, text] of [['handout', handout], ['report', report]]) {
    text.split('\n').forEach((line, i) => {
      const low = line.toLowerCase()
      for (const { term, why, unless = [] } of rules) {
        if (unless.some((u) => low.includes(u))) continue
        const hit = line.match(term)
        if (hit) fail(label, `line ${i + 1}: "${hit[0]}" - ${why}`)
      }
    })
  }

  // 2. controls the documents name must exist in the scene
  const strings = appStrings(lab.scene)
  const flat = [...strings].join(' | ')
  for (const c of lab.controls ?? []) {
    if (!flat.includes(c)) {
      fail('app', `the documents name "${c}", which no longer exists in ${lab.scene}`)
    }
  }
  notes.push(
    `${(lab.controls ?? []).length} control names still exist in the app (of ${strings.size} strings found)`,
  )

  // 3. both documents must ask the same questions
  const h = qNumbers(handout)
  const r = qNumbers(report)
  const onlyH = h.filter((q) => !r.includes(q))
  const onlyR = r.filter((q) => !h.includes(q))
  if (onlyH.length) fail('report', `on the website but missing from the report document: ${onlyH.map((q) => 'Q' + q).join(', ')}`)
  if (onlyR.length) fail('handout', `in the report document but not on the website: ${onlyR.map((q) => 'Q' + q).join(', ')}`)
  if (!onlyH.length && !onlyR.length) notes.push(`both documents ask the same ${h.length} questions`)

  return { problems, notes }
}

// -------------------------------------------------------------------- run

function main() {
  const only = process.argv[2]
  const labs = only ? LABS.filter((l) => l.id === only) : LABS
  if (!labs.length) {
    console.error(`\n  No lab "${only}". Known: ${LABS.map((l) => l.id).join(', ')}\n`)
    return 2
  }

  let total = 0
  for (const lab of labs) {
    const { problems, notes } = checkLab(lab)
    console.log(`\n  ${lab.name}`)
    console.log('  ' + '-'.repeat(64))
    for (const n of notes) console.log(`  ok    ${n}`)
    if (!problems.length) console.log('  ok    no retired wording in either document')
    else {
      console.log('')
      for (const { where, msg } of problems) console.log(`  FAIL  [${where}] ${msg}`)
    }
    total += problems.length
  }

  if (total) {
    console.log(`\n  ${total} problem${total === 1 ? '' : 's'}. This is what students read.\n`)
    return 1
  }
  console.log('\n  All document checks passed.\n')
  return 0
}

process.exit(main())
