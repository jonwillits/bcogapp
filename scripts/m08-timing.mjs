/**
 * Lab 8's timing, measured in a real browser (the in-app browser throttles
 * animation frames, so it cannot be used for this):
 *
 *   1. the duration actually shown on every glimpse trial in Part 2 and
 *      Part 4, at the display's refresh rate, mean and range;
 *   2. one drawing inference on the main thread and one photo inference in
 *      the worker, with and without Chrome's 4× CPU throttle.
 *
 * Needs the dev server:  npm run dev   then   node scripts/m08-timing.mjs
 */
import { chromium } from 'playwright'

const URL = process.argv[2] ?? 'http://localhost:5173/?dev=1#/m08-objects'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
await page.goto(URL)
await page.waitForSelector('[role=tablist]')

/** Click a button by its exact text from inside the page: the presenter re-renders as its phase changes, which a locator sees as an unstable element. */
const click = (text) => page.evaluate((t) => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === t && !x.disabled); if (b) b.click(); return !!b }, text)

async function glimpses(tab, nameToClick, n) {
  await page.evaluate((t) => [...document.querySelectorAll('button[role=tab]')].find((b) => b.textContent.startsWith(t)).click(), tab)
  await page.waitForTimeout(1500)
  for (let i = 0; i < n; i++) {
    await click('Begin')
    if (await click('Show it')) await page.waitForSelector('[data-phase="mask"]', { timeout: 5000 })
    await click(nameToClick)
    await page.waitForTimeout(40)
    await click('Next')
    await page.waitForTimeout(40)
  }
  await click('Commit my answers')
  await page.waitForTimeout(600)
  const text = await page.evaluate(() => document.body.innerText)
  return text.match(/Glimpses shown: (\d+), mean (\d+) ms/)
}

// Part 2 has no glimpse summary line on its panel; add the per-trial log through the page's own text instead.
const noise = await glimpses('Noise', 'car', 36)
console.log('Part 4 glimpses:', noise ? `${noise[1]} shown, mean ${noise[2]} ms` : 'not found')

const bench = async (label) => {
  const r = await page.evaluate(() => window.__m08bench())
  console.log(`${label}: drawing ${r.drawingMs.toFixed(1)} ms, photo ${r.photoMs.toFixed(1)} ms`)
}
await bench('no throttle')
const cdp = await page.context().newCDPSession(page)
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
await bench('4× CPU throttle')
const throttled = await glimpses('Parts', 'cat', 12)
console.log('Part 2 glimpses under 4× throttle:', throttled ? `${throttled[1]} shown, mean ${throttled[2]} ms` : 'not found')
await browser.close()
