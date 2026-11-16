/**
 * Lab 13's timing in a real browser (spec §14, Audio and Performance), the
 * things the in-app pane cannot measure because it throttles frames:
 *
 *   1. audio sync: while Part 2's minute plays, the cursor the strip drew
 *      against the audio clock at the moment it was drawn, sampled many
 *      times; the spec wants the drawn cursor within one frame (about 17 ms)
 *      of the clock
 *   2. the classifier's training time in Part 1, Step 4, under a 4× CPU
 *      throttle (the spec wants under 5 seconds)
 *   3. the longest main-thread task while Part 2, Step 3 runs both learners
 *      on 20 streams at 21 minutes, under the throttle (the spec wants no
 *      task over about 300 ms)
 *
 * Usage, with the dev server running:  node scripts/m13-timing.mjs http://localhost:5173
 */
import { chromium } from 'playwright'

const url = (process.argv[2] ?? 'http://localhost:5173').replace(/\/$/, '')
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const cdp = await page.context().newCDPSession(page)
const out = []

await page.goto(`${url}/#/m13-language`)
await page.getByRole('tab', { name: 'Stream' }).click()
await page.getByRole('button', { name: 'Begin' }).first().click()
await page.getByRole('button', { name: 'Play the minute' }).click({ timeout: 30000 })
await page.waitForFunction(() => Boolean(window.__m13player?.context) && window.__m13cursor?.cursorS !== null && window.__m13cursor?.cursorS !== undefined, null, { timeout: 20000 })
// Sample the drawn cursor against the clock at the moment of sampling: the difference is the draw's age, since the clock advances at one second per second.
const samples = await page.evaluate(async () => {
  const p = window.__m13player
  const res = []
  const t0 = performance.now()
  const start = p.now() - window.__m13cursor.cursorS
  while (performance.now() - t0 < 5000) {
    await new Promise((r) => setTimeout(r, 37))
    const c = window.__m13cursor
    if (c && c.cursorS !== null) res.push({ drawn: c.cursorS, clockNow: p.now() - start, age: performance.now() - c.at })
  }
  return res
})
const lags = samples.map((s) => Math.abs(s.clockNow - s.drawn) * 1000)
lags.sort((a, b) => a - b)
out.push(`audio sync: ${samples.length} samples over 5 s; |clock − drawn cursor| median ${lags[Math.floor(lags.length / 2)].toFixed(1)} ms, 95th percentile ${lags[Math.floor(lags.length * 0.95)].toFixed(1)} ms, max ${lags[lags.length - 1].toFixed(1)} ms`)

// The classifier under a 4× throttle.
await page.goto(`${url}/#/m13-language`)
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
await page.getByRole('tab', { name: 'Sounds' }).click()
await page.getByRole('button', { name: 'Step 4', exact: true }).click()
await page.getByRole('button', { name: 'Begin' }).first().click()
await page.getByRole('button', { name: '75% to 90%' }).click()
await page.getByRole('button', { name: 'Commit my prediction' }).first().click()
await page.waitForFunction(() => !document.querySelector('[data-step4-controls] [data-loading]'), null, { timeout: 120000 })
const t1 = Date.now()
await page.getByRole('button', { name: 'Train', exact: true }).click()
await page.waitForFunction(() => /Training is done/.test(document.body.innerText), null, { timeout: 120000 })
out.push(`classifier training, 12 passes over 450 tokens, 4× CPU throttle: ${((Date.now() - t1) / 1000).toFixed(1)} s`)

// The learners' slider at 21 minutes under the throttle: the longest task.
await page.goto(`${url}/#/m13-language`)
await page.getByRole('tab', { name: 'Stream' }).click()
await page.getByRole('button', { name: 'Step 3', exact: true }).click()
await page.getByRole('button', { name: 'Open anyway' }).click()
await page.getByRole('button', { name: 'Begin' }).first().click()
for (const c of ['harder', '1 minute', 'they will tie']) await page.getByRole('button', { name: c, exact: true }).click()
await page.getByRole('button', { name: 'Commit my predictions' }).click()
await page.evaluate(() => {
  window.__longTasks = []
  new PerformanceObserver((list) => list.getEntries().forEach((e) => window.__longTasks.push(e.duration))).observe({ entryTypes: ['longtask'] })
})
await page.getByLabel('How much of the stream').fill('6')
const t2 = Date.now()
await page.getByRole('button', { name: 'Run the learners' }).click()
await page.waitForFunction(() => /This amount is run/.test(document.body.innerText), null, { timeout: 300000 })
const tasks = await page.evaluate(() => window.__longTasks)
out.push(`learners at 21 minutes, 20 streams, 4× CPU throttle: ${((Date.now() - t2) / 1000).toFixed(1)} s in all; long tasks over 50 ms: ${tasks.length}, longest ${tasks.length ? Math.max(...tasks).toFixed(0) : 0} ms`)
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })
console.log(out.join('\n'))
await browser.close()
