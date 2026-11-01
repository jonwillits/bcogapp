/**
 * Lab 11's timing, measured in a real browser (the in-app browser throttles
 * animation frames and timers and cannot be used for this):
 *
 *   1. the grid: generations per second at 40 × 40 while it runs at
 *      "fast", and the longest task on the main thread while Skip ahead
 *      pays 1,000 generations (spec §16: at least 20 a second; no more than
 *      about 300 ms at a time);
 *   2. frames per second in Part 6's table scene, with and without Chrome's
 *      4× CPU throttle, in a headed Chromium so the GPU draws (spec §16: at
 *      least 30 under the throttle);
 *   3. a film's measured length on a real screen, from the store's clock.
 *
 * Needs the dev server:  npm run dev   then   node scripts/m11-timing.mjs
 * The `?dev=1` query opens every part; storage is cleared first.
 */
import { chromium } from 'playwright'

const BASE = process.argv[2] ?? 'http://localhost:5173'
const URL = `${BASE}/?dev=1#/m11-social`

const click = (page, text) => page.evaluate((t) => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === t && !x.disabled); if (b) b.click(); return !!b }, text)
const tab = (page, name) => page.evaluate((t) => { const b = [...document.querySelectorAll('button[role=tab]')].find((x) => x.textContent.startsWith(t)); if (b) b.click(); return !!b }, name)
const fps = (page, seconds = 4) => page.evaluate((s) => new Promise((resolve) => { let n = 0; const t0 = performance.now(); const tick = () => { n++; if (performance.now() - t0 < s * 1000) requestAnimationFrame(tick); else resolve(n / s) }; requestAnimationFrame(tick) }), seconds)
const commitFirst = (page) => page.evaluate(() => { const chips = [...document.querySelectorAll('[data-predict] button[aria-pressed]')]; const seen = new Set(); for (const c of chips) { const g = c.parentElement; if (!seen.has(g)) { seen.add(g); c.click() } } })

async function fresh(browser, throttle = false) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await page.goto(URL)
  await page.waitForSelector('[role=tablist]')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.waitForSelector('[role=tablist]')
  if (throttle) {
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  }
  return page
}

async function grid(browser) {
  const page = await fresh(browser)
  await tab(page, 'Tournament'); await page.waitForTimeout(400)
  await click(page, 'Step 7'); await page.waitForTimeout(300)
  await click(page, 'Begin'); await page.waitForTimeout(200)
  await commitFirst(page); await page.waitForTimeout(100)
  await click(page, 'Commit my prediction'); await page.waitForTimeout(300)
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'fast (20)'); b?.click() })
  await click(page, 'Run')
  const gen = (p) => p.evaluate(() => { const l = document.querySelector('[data-lines="grid-status"]'); const m = l?.innerText.match(/Generation\s+(\d+)/); return m ? Number(m[1]) : 0 })
  const g0 = await gen(page)
  await page.waitForTimeout(5000)
  const g1 = await gen(page)
  console.log(`grid: ${((g1 - g0) / 5).toFixed(1)} generations a second at "fast" (asked: 20)`)
  await click(page, 'Pause')
  // The longest main-thread task while skipping ahead, by a long-task observer.
  await page.evaluate(() => { window.__longest = 0; new PerformanceObserver((list) => { for (const e of list.getEntries()) window.__longest = Math.max(window.__longest, e.duration) }).observe({ entryTypes: ['longtask'] }) })
  const gBefore = await gen(page)
  const t0 = Date.now()
  await click(page, 'Skip ahead 1,000 generations')
  let last = -1
  for (let i = 0; i < 600; i++) { await page.waitForTimeout(100); const g = await gen(page); if (g === last && g >= gBefore + 1000) break; last = g }
  const ms = Date.now() - t0
  const longest = await page.evaluate(() => window.__longest)
  const gEnd = await gen(page)
  console.log(`grid: Skip ahead reached generation ${gEnd} in ${(ms / 1000).toFixed(1)} s; longest main-thread task ${Math.round(longest)} ms (asked: about 300 ms or less)`)
  await page.close()
}

async function mirror(browser, throttle) {
  const page = await fresh(browser, throttle)
  await tab(page, 'Mirror'); await page.waitForTimeout(600)
  await click(page, 'Step 2'); await page.waitForTimeout(300)
  await click(page, 'Begin'); await page.waitForTimeout(200)
  await commitFirst(page); await page.waitForTimeout(100)
  await click(page, 'Commit my prediction'); await page.waitForTimeout(400)
  await click(page, 'Run 40 grasps'); await page.waitForTimeout(1500)
  const f = await fps(page, 4)
  console.log(`Part 6: ${f.toFixed(0)} frames per second${throttle ? ' under the 4× throttle' : ''} while grasps run (asked: at least 30 under the throttle)`)
  await page.evaluate(() => { const c = document.querySelector('input[type=checkbox]'); c?.click() })
  await page.waitForTimeout(500)
  const f2 = await fps(page, 3)
  console.log(`Part 6: ${f2.toFixed(0)} frames per second${throttle ? ' under the 4× throttle' : ''} in the side view`)
  await page.close()
}

async function film(browser) {
  const page = await fresh(browser)
  await tab(page, 'Shapes'); await page.waitForTimeout(400)
  await click(page, 'Begin'); await page.waitForTimeout(300)
  const t0 = Date.now()
  await page.waitForSelector('[data-stage="describe"]', { timeout: 60000 })
  console.log(`Part 3: Film 1 ran ${((Date.now() - t0) / 1000).toFixed(1)} s on a real screen (authored: 30 s)`)
  const f = await page.evaluate(() => new Promise((resolve) => { let n = 0; const t = performance.now(); const tick = () => { n++; if (performance.now() - t < 1000) requestAnimationFrame(tick); else resolve(n) }; requestAnimationFrame(tick) }))
  console.log(`Part 3: the page runs ${f} frames a second with the film over (for reference)`)
  await page.close()
}

const browser = await chromium.launch({ headless: false })
try {
  await grid(browser)
  await mirror(browser, false)
  await mirror(browser, true)
  await film(browser)
} finally {
  await browser.close()
}
