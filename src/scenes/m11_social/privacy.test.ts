import { describe, it, expect } from 'vitest'

/**
 * Nothing leaves the page (spec §13, item 9): no camera, no microphone, no
 * upload, no network request that carries anything the student did, and
 * storage only through the shared layer under Lab 11's one key. The free
 * text boxes of Parts 1 and 3 are saved locally like every other response.
 */
const scene = import.meta.glob('./**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const sim = import.meta.glob('../../sim/social/**/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const all = [...Object.entries(scene), ...Object.entries(sim)].filter(([p]) => !p.includes('.test.') && !p.includes('.probe.'))

describe('nothing leaves the page', () => {
  it('no fetch, no POST, no XMLHttpRequest, no WebSocket, no beacon, no form submission', () => {
    for (const [path, src] of all) expect(src, path).not.toMatch(/\bfetch\(|method:\s*['"]POST|XMLHttpRequest|WebSocket|sendBeacon|<form|EventSource/)
  })
  it('no camera, no microphone, no storage outside the shared layer', () => {
    for (const [path, src] of all) expect(src, path).not.toMatch(/mediaDevices|getUserMedia|localStorage|sessionStorage|indexedDB|navigator\.share/)
  })
  it('the only file input is Load my results, in Lab 10’s shared control', () => {
    for (const [path, src] of all) expect(src, path).not.toMatch(/type="file"/)
  })
  it('the free-text boxes have autocomplete, autocorrect and spellcheck off', () => {
    const boxes = all.filter(([, src]) => /<textarea/.test(src))
    expect(boxes.length).toBeGreaterThanOrEqual(2)
    for (const [path, src] of boxes) {
      for (const m of src.matchAll(/<textarea[\s\S]*?\/>/g)) {
        expect(m[0], path).toMatch(/autoComplete="off"/)
        expect(m[0], path).toMatch(/autoCorrect="off"/)
        expect(m[0], path).toMatch(/spellCheck=\{false\}/)
      }
    }
  })
})
