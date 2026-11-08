/**
 * Lab 12's timing, measured in a real browser (the in-app browser throttles
 * animation frames and timers and cannot be used for this):
 *
 *   1. Part 1, Step 3: a dispenser block's timing: the delivery at 8 s, the
 *      1-s pause after it, and the 5-s pause after a take, each to within
 *      50 ms, from the store's own trial record against wall-clock stamps;
 *      and that hiding the page stops the block.
 *   2. Part 3: the student's hominin walks under held keys and picks up a
 *      cobble; frames per second in the range with all six hominins on
 *      screen, under a 4× CPU throttle in a headed Chromium (spec §14: at
 *      least 30); the longest main-thread task while a ten-day run computes
 *      and while the history lives (asked: about 300 ms or less).
 *
 * Needs the dev server:  npm run dev   then   node scripts/m12-timing.mjs
 * `?dev=1` is accepted for symmetry with the other labs; nothing is locked.
 */
import { chromium } from 'playwright'

const BASE = process.argv[2] ?? 'http://localhost:5173'
const URL = `${BASE}/?dev=1#/m12-planning`

const click = (page, text) => page.evaluate((t) => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === t && !x.disabled); if (b) b.click(); return !!b }, text)
const clickStarting = (page, text) => page.evaluate((t) => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim().startsWith(t) && !x.disabled); if (b) b.click(); return !!b }, text)
const tab = (page, name) => page.evaluate((t) => { const b = [...document.querySelectorAll('button[role=tab]')].find((x) => x.textContent.startsWith(t)); if (b) b.click(); return !!b }, name)
const fps = (page, seconds = 4) => page.evaluate((s) => new Promise((resolve) => { let n = 0; const t0 = performance.now(); const tick = () => { n++; if (performance.now() - t0 < s * 1000) requestAnimationFrame(tick); else resolve(n / s) }; requestAnimationFrame(tick) }), seconds)
const observeLongTasks = (page) => page.evaluate(() => { window.__longest = 0; new PerformanceObserver((list) => { for (const e of list.getEntries()) window.__longest = Math.max(window.__longest, e.duration) }).observe({ entryTypes: ['longtask'] }) })
const longest = (page) => page.evaluate(() => window.__longest)

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

/** Put a saved state with a chosen seed in place, so block 1 is the blue dispenser (the order is drawn from the seed). */
async function withSeed(page, seed) {
  await page.evaluate(async (seed) => {
    const { newState } = await import('/src/sim/planning/progress/state.ts')
    localStorage.setItem('bcogapp.m12.v1', JSON.stringify(newState(seed)))
  }, seed)
  await page.reload()
  await page.waitForSelector('[role=tablist]')
}

async function dispensers(browser) {
  const page = await fresh(browser)
  // A seed whose first block is blue: makeRng(seed ^ 0xd15e).next() < 0.5.
  const seed = await page.evaluate(async () => {
    const { makeRng } = await import('/src/sim/random.ts')
    for (let s = 1; s < 10000; s++) if (makeRng((s ^ 0xd15e) >>> 0).next() < 0.5) return s
    return 1
  })
  await withSeed(page, seed)
  const f0 = await fps(page, 3)
  console.log(`baseline: the Open tab's blank canvas runs ${f0.toFixed(0)} frames a second in this window`)
  await tab(page, 'Choices'); await page.waitForTimeout(300)
  await click(page, 'Step 3'); await page.waitForTimeout(200)
  // Stamp every change of the "now" line with the page's own clock, by a mutation observer, so no polling latency enters.
  await page.evaluate(() => {
    window.__stamps = []
    const start = () => {
      const el = document.querySelector('[data-now]')
      if (!el) return setTimeout(start, 10)
      window.__stamps.push({ t: performance.now(), now: el.textContent })
      new MutationObserver(() => window.__stamps.push({ t: performance.now(), now: el.textContent })).observe(el, { childList: true, characterData: true, subtree: true })
    }
    start()
  })
  await click(page, 'Begin')
  await page.waitForTimeout(18500)
  // Take 1 point during trial 3 (which starts at 18 s), 2 s in.
  await page.waitForTimeout(1500)
  await click(page, 'Take 1 now')
  await page.waitForTimeout(6500)
  const stamps = await page.evaluate(() => window.__stamps)
  const t0 = stamps[0].t
  console.log(`dispensers (blue block): the "now" line changed at ${stamps.map((s) => `${((s.t - t0) / 1000).toFixed(3)} s "${s.now}"`).join('; ')}`)
  console.log('dispensers: asked: the delivery 8.000 s after a trial starts, the next trial 1.000 s after a delivery and 5.000 s after a take, each within 50 ms; the store advances on a 50-ms timer')
  // Hiding the page stops the block.
  await page.evaluate(() => window.dispatchEvent(new Event('blur')))
  await page.waitForTimeout(200)
  const stopped = await page.evaluate(() => !!document.querySelector('[data-block-stopped]'))
  console.log(`dispensers: a blur event stops the block: ${stopped}`)
  await page.close()
}

async function range(browser, throttle) {
  const page = await fresh(browser, throttle)
  await tab(page, 'Band'); await page.waitForTimeout(500)
  await click(page, 'Begin'); await page.waitForTimeout(500)
  // Drive: the body starts facing north; turn right 90° and walk east to the riverbank, 15 m, at 3.25 m/s.
  await page.keyboard.down('ArrowRight'); await page.waitForTimeout(750); await page.keyboard.up('ArrowRight')
  await page.keyboard.down('ArrowUp'); await page.waitForTimeout(4600); await page.keyboard.up('ArrowUp')
  await page.waitForTimeout(200)
  const near = await page.evaluate(() => [...document.querySelectorAll('[data-lines="day-status"] [data-line]')].map((e) => e.textContent.trim()))
  await page.keyboard.press('Enter'); await page.waitForTimeout(800)
  const during = await page.evaluate(() => !!document.querySelector('[data-act-progress]'))
  await page.waitForTimeout(6000)
  const after = await page.evaluate(() => [...document.querySelectorAll('[data-lines="day-status"] [data-line]')].map((e) => e.textContent.trim()))
  console.log(`range${throttle ? ' (4× throttle)' : ''}: after the drive: ${near.join(' | ')}; act in progress 0.8 s after Enter: ${during}; after 6.8 s: ${after.join(' | ')}`)
  const f1 = await fps(page, 4)
  console.log(`range${throttle ? ' (4× throttle)' : ''}: Step 1, the student and the elder on screen: ${f1.toFixed(0)} frames a second`)
  // Step 2: live the history (sliced), then run T1 and watch day 1 with all six on screen.
  await observeLongTasks(page)
  await click(page, 'Step 2'); await page.waitForTimeout(300)
  await click(page, 'Begin'); await page.waitForTimeout(200)
  await page.evaluate(() => { const b = [...document.querySelectorAll('[data-predict] button[aria-pressed]')][0]; b?.click() })
  await click(page, 'Commit my prediction')
  const tH = Date.now()
  for (let i = 0; i < 1200; i++) { const ready = await page.evaluate(() => !!document.querySelector('[data-run-controls] button') && ![...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Run T1 for all five')?.disabled); if (ready) break; await page.waitForTimeout(100) }
  const historyLongest = await longest(page)
  console.log(`range${throttle ? ' (4× throttle)' : ''}: the history lived in ${((Date.now() - tH) / 1000).toFixed(1)} s in slices; longest main-thread task ${Math.round(historyLongest)} ms (asked: about 300 ms or less)`)
  await page.evaluate(() => { window.__longest = 0 })
  const tR = Date.now()
  await click(page, 'Run T1 for all five')
  await page.waitForTimeout(500)
  const runLongest = await longest(page)
  console.log(`range${throttle ? ' (4× throttle)' : ''}: a ten-day run of T1 for all five took the click handler about ${Date.now() - tR - 500} ms of wall clock; longest main-thread task ${Math.round(runLongest)} ms`)
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'from above'); b?.click() })
  await page.waitForTimeout(300)
  const f2 = await fps(page, 4)
  console.log(`range${throttle ? ' (4× throttle)' : ''}: watching day 1 of T1 from above, six hominins on screen: ${f2.toFixed(0)} frames a second (asked: at least 30 under the throttle)`)
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'A'); b?.click() })
  await page.waitForTimeout(300)
  const f3 = await fps(page, 4)
  console.log(`range${throttle ? ' (4× throttle)' : ''}: following A: ${f3.toFixed(0)} frames a second`)
  await page.close()
}

const browser = await chromium.launch({ headless: false })
try {
  await dispensers(browser)
  await range(browser, false)
  await range(browser, true)
} finally {
  await browser.close()
}
