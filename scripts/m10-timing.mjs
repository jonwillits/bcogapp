/**
 * Lab 10's timing, measured in a real browser (the in-app browser throttles
 * animation frames and cannot be used for this):
 *
 *   1. the duration each word of a Part 1 list was actually shown, from the
 *      store's own record of the first list (performance.now at the frame
 *      the word appeared and the frame it went), headless and headed;
 *   2. frames per second in Part 4's range in both views, and in Part 3's
 *      room on its path, with and without Chrome's 4× CPU throttle, in a
 *      headed Chromium so the GPU draws;
 *   (The youth's training and the foragers' runs are timed headless by
 *   src/sim/memory/foragers/timing.probe.ts; both are paid in slices.)
 *
 * Needs the dev server:  npm run dev   then   node scripts/m10-timing.mjs
 * The `?dev=1` query opens every part; storage is cleared first.
 */
import { chromium } from 'playwright'

const BASE = process.argv[2] ?? 'http://localhost:5173'
const URL = `${BASE}/?dev=1#/m10-memory`

const click = (page, text) => page.evaluate((t) => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === t && !x.disabled); if (b) b.click(); return !!b }, text)
const tab = (page, name) => page.evaluate((t) => { const b = [...document.querySelectorAll('button[role=tab]')].find((x) => x.textContent.startsWith(t)); if (b) b.click(); return !!b }, name)
const fps = (page, seconds = 4) => page.evaluate((s) => new Promise((resolve) => { let n = 0; const t0 = performance.now(); const tick = () => { n++; if (performance.now() - t0 < s * 1000) requestAnimationFrame(tick); else resolve(n / s) }; requestAnimationFrame(tick) }), seconds)
async function wordTiming(browser, label) {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
  await page.goto(URL)
  await page.waitForSelector('[role=tablist]')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.waitForSelector('[role=tablist]')
  await tab(page, 'Lists')
  await page.waitForTimeout(500)
  await click(page, 'Begin')
  await page.waitForTimeout(500)
  await click(page, 'Begin')
  // The first list runs to its recall (at most 20 words at 1.8 s, then the then-screen); end the recall at once.
  await page.waitForSelector('[data-recall]', { timeout: 60000 })
  await click(page, 'I’m done')
  await page.waitForTimeout(500)
  const shown = await page.evaluate(() => { const st = JSON.parse(localStorage.getItem('bcogapp.m10.v1')); const r = st.units['p1-list-0'].result; return r ? r.shown : null })
  if (shown) {
    const v = shown.map((s) => s.shownMs)
    console.log(`${label}: words shown ${v.length}, mean ${Math.round(v.reduce((a, b) => a + b, 0) / v.length)} ms, from ${Math.round(Math.min(...v))} to ${Math.round(Math.max(...v))} ms`)
  } else console.log(`${label}: no record of the first list`)
  await page.close()
}

async function frames(browser, label, throttle) {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
  await page.goto(URL)
  await page.waitForSelector('[role=tablist]')
  if (throttle) {
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  }
  const out = {}
  await tab(page, 'Logs'); await page.waitForTimeout(600)
  await click(page, 'Begin'); await page.waitForTimeout(600)
  await click(page, 'Begin'); await page.waitForTimeout(2000)
  for (const view of ['Eye view', 'Follow view']) {
    await click(page, view); await page.waitForTimeout(400)
    await page.keyboard.down('ArrowUp'); await page.keyboard.down('ArrowLeft')
    out[`range, ${view}`] = Math.round(await fps(page, 4))
    await page.keyboard.up('ArrowUp'); await page.keyboard.up('ArrowLeft')
  }
  await tab(page, 'Room'); await page.waitForTimeout(3000)
  await click(page, 'Begin'); await page.waitForTimeout(1500)
  out['room, on the path'] = Math.round(await fps(page, 4))
  console.log(label, JSON.stringify(out))
  await page.close()
}

const headless = await chromium.launch({ headless: true })
await wordTiming(headless, 'headless Chromium')
await headless.close()
const headed = await chromium.launch({ headless: false })
await wordTiming(headed, 'headed Chromium')
await frames(headed, 'no throttle', false)
await frames(headed, '4× CPU throttle', true)
await headed.close()
