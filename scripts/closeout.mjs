/**
 * Close-out: everything that must be true before a lab change reaches students.
 *
 * Module 2 shipped three times in two days with something wrong each time - a
 * broken build that CI caught, a handout describing a simulation that had not
 * existed for months, and a report document that a student found before we did.
 * None of those needed cleverness to catch. They needed one command that looks
 * at everything at once and refuses to be optimistic.
 *
 * It checks, it does not push. The last two steps are yours, in the order it
 * prints, because deploying to a live class should take a deliberate act.
 *
 *   npm run closeout
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, statSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const COURSE =
  process.env.INTRO_TO_BCS ??
  '/Users/jon/Library/CloudStorage/Box-Box/teaching/bcog_web/courses/introduction_to_brain_and_cognitive_science_1/current_version/intro_to_bcs'

const LAB_FILES = [
  'comparative_approaches/evolution_lab/evolution_lab.md',
  'comparative_approaches/evolution_lab/evolution_lab_report.docx',
]

let failed = 0
const head = (s) => console.log(`\n  ${s}\n  ${'-'.repeat(64)}`)
const ok = (s) => console.log(`  ok    ${s}`)
const bad = (s) => {
  console.log(`  FAIL  ${s}`)
  failed++
}
const warn = (s) => console.log(`  note  ${s}`)

/** Run a command for its exit code. Never pipe these - a pipe hides the code. */
function run(cmd, args, cwd = ROOT, env = {}) {
  const r = spawnSync(cmd, args, {
    cwd,
    encoding: 'utf-8',
    env: { ...process.env, ...env },
    maxBuffer: 32 * 1024 * 1024,
  })
  return { code: r.status, out: (r.stdout ?? '') + (r.stderr ?? '') }
}

const git = (args, cwd) => run('git', args, cwd).out.trim()

// ------------------------------------------------------------- 1. the app

head('1. The app')

const tests = run('npm', ['run', 'test'])
const testLine = (tests.out.match(/Tests\s+.*/) ?? ['(no summary)'])[0].trim()
tests.code === 0 ? ok(`tests pass - ${testLine}`) : bad(`tests FAILED - ${testLine}`)

const build = run('npm', ['run', 'build'])
if (build.code === 0) ok('production build clean')
else {
  bad('production build FAILED')
  console.log(
    build.out
      .split('\n')
      .filter((l) => /error/i.test(l))
      .slice(0, 5)
      .map((l) => `        ${l}`)
      .join('\n'),
  )
}

// ------------------------------------------------------- 2. the documents

head('2. The documents students read')

const docs = run('node', ['scripts/check-docs.mjs'])
console.log(
  docs.out
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => (l.startsWith('  ') ? l : '  ' + l))
    .join('\n'),
)
if (docs.code !== 0) failed++

// ------------------------------------------ 3. claims that carry a test

head('3. Claims the handout makes about what a student will see')

/**
 * The half a word-checker cannot reach. A document can name every control
 * correctly and still promise something the simulation does not do - Q18 did
 * exactly that, with valid strings and an exercise that demonstrated nothing.
 * So each claim is listed with the test that would go red if it stopped being
 * true, and the ones with no test are named rather than assumed.
 */
const CLAIMS = [
  ['W, X and Y all reach the light and stay; Z does not', 'reach the light and stay near it'],
  ['W and X cannot be told apart by watching', 'sisters are indistinguishable'],
  ['Y differs by driving backwards and by nothing else', 'nothing a student is not told about'],
  ['a designed perturbation separates Y from W and X', 'perturbations separate Y'],
  ['the default world does not already give the mechanism away', 'not already given away'],
  ['each population fails in the other world (Q18)', 'fails in the other'],
  ['the saved lineages are genuine engine output', 'reproduces exactly from its recipe'],
  ['Part 1: a population visibly adapts', null],
]

const suite = ['continuousLineages', 'lineages', 'evolution', 'world', 'random']
  .map((f) => {
    const p = join(ROOT, 'src/sim/world', `${f}.test.ts`)
    return existsSync(p) ? readFileSync(p, 'utf-8') : ''
  })
  .join('\n')
for (const [claim, needle] of CLAIMS) {
  if (needle === null) warn(`NO TEST - "${claim}"`)
  else if (suite.includes(needle)) ok(`"${claim}"`)
  else bad(`the test for "${claim}" is gone (looked for "${needle}")`)
}

// ------------------------------------------------------- 4. repository state

head('4. What would be pushed')

const repos = [
  { name: 'app (bcogapp)', dir: ROOT, branch: 'main', paths: null },
  { name: 'course (intro_to_bcs)', dir: COURSE, branch: 'master', paths: LAB_FILES },
]

for (const r of repos) {
  if (!existsSync(join(r.dir, '.git'))) {
    bad(`${r.name}: not a git repo at ${r.dir}`)
    continue
  }
  const lock = join(r.dir, '.git/index.lock')
  if (existsSync(lock)) {
    const age = Math.round((Date.now() - statSync(lock).mtimeMs) / 60000)
    warn(`${r.name}: a .git/index.lock exists, ${age} min old. If no git process is running it is stale:`)
    console.log(`            rm "${lock}"`)
  }
  git(['fetch', 'origin'], r.dir)
  const ahead = git(['log', '--oneline', `origin/${r.branch}..HEAD`], r.dir)
  const behind = git(['log', '--oneline', `HEAD..origin/${r.branch}`], r.dir)
  const dirty = git(['status', '--porcelain'], r.dir)
    .split('\n')
    .filter(Boolean)

  console.log(`\n  ${r.name}`)
  if (behind) bad(`  behind origin/${r.branch} - pull before pushing`)
  console.log(
    ahead
      ? `    ${ahead.split('\n').length} commit(s) to push:\n` +
          ahead.split('\n').map((l) => `        ${l}`).join('\n')
      : '    nothing committed to push',
  )
  if (dirty.length) {
    const relevant = r.paths
      ? dirty.filter((l) => r.paths.some((p) => l.includes(p)))
      : dirty
    const other = dirty.filter((l) => !relevant.includes(l))
    if (relevant.length) {
      console.log('    uncommitted lab changes:')
      relevant.forEach((l) => console.log(`        ${l}`))
    }
    if (other.length) {
      console.log(`    ${other.length} other uncommitted path(s) - must NOT be swept in:`)
      other.forEach((l) => console.log(`        ${l}`))
    }
  }
}

// -------------------------------------------------------- 5. what only you can see

head('5. What only a person can confirm')

// Probes are excluded from the unit suite by vitest.config.ts, so ask for them.
const crib = run(
  'npx',
  ['vitest', 'run', '--disable-console-intercept', '-t', 'crib: what each population should look like'],
  ROOT,
  { PROBE: '1' },
)
const cribLines = crib.out
  .split('\n')
  .filter((l) => /reach the light|driving backwards|swings toward|SEPARATES|does NOT separate|^  [WXYZ] /.test(l))
if (cribLines.length) {
  console.log('  Run the scene and check these by eye - tests cannot see motion:')
  console.log('      npm run dev     then open  http://localhost:5173/#/m02-evolution\n')
  cribLines.slice(0, 14).forEach((l) => console.log(`  ${l.trim()}`))
  console.log('\n  Full list:  npx vitest run --disable-console-intercept -t "crib:"')
} else {
  warn('could not produce the viewing crib')
}

// ------------------------------------------------------------------ verdict

head(failed ? 'NOT READY' : 'Ready to push, in this order')

if (failed) {
  console.log(`  ${failed} check(s) failed. Nothing should go to students until they pass.\n`)
  process.exit(1)
}

console.log(`  1. The app first when the documents describe something new in it;
     the documents first when they are correcting something already wrong.

     cd ${ROOT} && git push origin main

     Watch it - the tests gate the deploy:
     cd ${ROOT} && gh run watch $(gh run list --branch main --limit 1 --json databaseId --jq '.[0].databaseId')

  2. Then the documents. Name the files: never 'git add -A' in the course repo.

     cd "${COURSE}" && git add -- ${LAB_FILES.join(' ')}
     cd "${COURSE}" && git status --short
     cd "${COURSE}" && git commit -m "Lab 2: ..." && git push origin master

  The handout is fetched live, so it reaches students in minutes with no redeploy.
`)
process.exit(0)
