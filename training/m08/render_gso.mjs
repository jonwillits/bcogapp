/**
 * Render Google Scanned Objects models to fixed views with Three.js in
 * headless Chromium (Playwright). The app's stack already has both.
 *
 *   node render_gso.mjs <gso_dir> <out_dir> <views.json>
 *
 * views.json: { "objects": [{ "name": ..., "baseYaw": 0, "basePitch": 0, "baseRoll": 0 }],
 *               "views": [{ "id": "v015", "heading": 15, "pitch": 0 }, ...] }
 * Writes <out_dir>/<name>/<view id>.png, 224 × 224, on a neutral gray.
 */
import { createServer } from 'node:http'
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, dirname, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const [gsoDir, outDir, viewsPath] = process.argv.slice(2)
const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..')
const spec = JSON.parse(readFileSync(viewsPath, 'utf-8'))

const MIME = { '.js': 'text/javascript', '.html': 'text/html', '.obj': 'text/plain', '.mtl': 'text/plain', '.png': 'image/png', '.jpg': 'image/jpeg' }
const server = createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0])
  let file
  if (url === '/render.html') file = join(HERE, 'render', 'render.html')
  else if (url.startsWith('/three/')) file = join(ROOT, 'node_modules', 'three', url.slice('/three/'.length))
  else if (url.startsWith('/models/')) file = join(gsoDir, 'models', url.slice('/models/'.length))
  if (!file || !existsSync(file)) {
    res.writeHead(404); res.end(); return
  }
  res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' })
  res.end(readFileSync(file))
})
await new Promise((r) => server.listen(0, '127.0.0.1', r))
const port = server.address().port

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const page = await browser.newPage({ viewport: { width: 300, height: 300 } })
page.on('console', (m) => { if (m.type() === 'error') console.error('page:', m.text()) })
await page.goto(`http://127.0.0.1:${port}/render.html`)
await page.waitForFunction(() => window.ready === true)

const t0 = Date.now()
for (const o of spec.objects) {
  const info = await page.evaluate((n) => window.loadModel(n), o.name)
  mkdirSync(join(outDir, o.name), { recursive: true })
  for (const v of spec.views) {
    const data = await page.evaluate(([h, p, y, r, pp]) => window.renderView(h, p, y, r, pp), [v.heading, v.pitch, o.baseYaw ?? 0, o.baseRoll ?? 0, o.basePitch ?? 0])
    writeFileSync(join(outDir, o.name, `${v.id}.png`), Buffer.from(data.split(',')[1], 'base64'))
  }
  console.log(o.name, JSON.stringify(info), `${spec.views.length} views`, `${((Date.now() - t0) / 1000).toFixed(0)}s`)
}
await browser.close()
server.close()
