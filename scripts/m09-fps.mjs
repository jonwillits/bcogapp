/**
 * Lab 9's frame rate, measured in a real browser (the in-app browser
 * throttles animation frames, so it cannot be used for this): frames per
 * second in the range in eye view and follow view, with and without
 * Chrome's 4× CPU throttle, which stands in for a Chromebook; and in the
 * recording box. Also one skip of Part 3 timed on the main thread.
 *
 * Needs the dev server:  npm run dev   then   node scripts/m09-fps.mjs
 */
import { chromium } from 'playwright'

const URL = process.argv[2] ?? 'http://localhost:5173/#/m09-rat'
// Headed, so the GPU draws: headless Chromium falls back to a software renderer and its frame rate means nothing.
const browser = await chromium.launch({ headless: false })
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
await page.goto(URL)
await page.waitForSelector('[role=tablist]')
const click = (text) => page.evaluate((t) => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim().startsWith(t) && !x.disabled); if (b) b.click(); return !!b }, text)
const fps = async (seconds = 4) => page.evaluate((s) => new Promise((resolve) => { let n = 0; const t0 = performance.now(); const tick = () => { n++; if (performance.now() - t0 < s * 1000) requestAnimationFrame(tick); else resolve(n / s) }; requestAnimationFrame(tick) }), seconds)
const hold = async (key, ms) => { await page.keyboard.down(key); await page.waitForTimeout(ms); await page.keyboard.up(key) }

async function measure(label) {
  // Home tab, practice trial: drive forward and turn while measuring, in both views.
  await click('Home'); await page.waitForTimeout(600)
  await click('Begin'); await page.waitForTimeout(1500)
  const out = {}
  for (const view of ['Eye view', 'Follow view']) {
    await click(view); await page.waitForTimeout(400)
    await page.keyboard.down('ArrowUp'); await page.keyboard.down('ArrowLeft')
    out[view] = await fps(4)
    await page.keyboard.up('ArrowUp'); await page.keyboard.up('ArrowLeft')
  }
  await click('Low detail'); // toggles the checkbox by its label? no: labels are not buttons
  await page.evaluate(() => { const l = [...document.querySelectorAll('label')].find((x) => x.textContent.includes('Low detail')); const i = l && l.querySelector('input'); if (i && !i.checked) i.click() })
  await page.waitForTimeout(600)
  await page.keyboard.down('ArrowUp')
  out['Eye view, low detail'] = await fps(4)
  await page.keyboard.up('ArrowUp')
  await page.evaluate(() => { const l = [...document.querySelectorAll('label')].find((x) => x.textContent.includes('Low detail')); const i = l && l.querySelector('input'); if (i && i.checked) i.click() })
  // The box.
  await click('Cells'); await page.waitForTimeout(600)
  await click('Begin'); await page.waitForTimeout(800)
  await click('Eye view'); await page.waitForTimeout(300)
  await page.keyboard.down('ArrowUp'); await page.keyboard.down('ArrowRight')
  out['Box, eye view'] = await fps(4)
  await page.keyboard.up('ArrowUp'); await page.keyboard.up('ArrowRight')
  await click('Follow view'); await page.waitForTimeout(300)
  await page.keyboard.down('ArrowUp'); await page.keyboard.down('ArrowRight')
  out['Box, follow view'] = await fps(4)
  await page.keyboard.up('ArrowUp'); await page.keyboard.up('ArrowRight')
  // One skip of two minutes: the longest main-thread block during it.
  const block = await page.evaluate(() => new Promise((resolve) => {
    let worst = 0
    const obs = new PerformanceObserver((list) => { for (const e of list.getEntries()) worst = Math.max(worst, e.duration) })
    obs.observe({ type: 'longtask', buffered: true })
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim().startsWith('Skip ahead 2 minutes'))
    const t0 = performance.now()
    b.click()
    const poll = () => { if (document.body.innerText.includes('Skipped ahead')) { obs.disconnect(); resolve({ worstBlockMs: worst, totalMs: performance.now() - t0 }) } else setTimeout(poll, 50) }
    poll()
  }))
  console.log(label, JSON.stringify({ ...Object.fromEntries(Object.entries(out).map(([k, v]) => [k, Math.round(v)])), skip2min: { worstBlockMs: Math.round(block.worstBlockMs), totalMs: Math.round(block.totalMs) } }))
  void hold
}

await measure('no throttle')
const cdp = await page.context().newCDPSession(page)
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
await page.reload(); await page.waitForSelector('[role=tablist]')
await measure('4× CPU throttle')
await browser.close()
