import { describe, it, expect } from 'vitest'

/**
 * Nothing leaves the page (spec §12, item 9): no network request carries
 * anything the student did; no camera, no microphone; storage only under
 * `bcogapp.m10.v1`, through the one module that touches it; the one file
 * input is Load my results, which reads a local file and uploads nothing.
 */
const scene = import.meta.glob('./**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const sim = import.meta.glob('../../sim/memory/**/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const all = [...Object.entries(scene), ...Object.entries(sim)].filter(([p]) => !p.includes('.test.') && !p.includes('.probe.'))

describe('nothing leaves the page', () => {
  it('no fetch, no POST, no XMLHttpRequest, no WebSocket, no beacon, no form submission, no EventSource', () => {
    for (const [path, src] of all) expect(src, path).not.toMatch(/\bfetch\(|method:\s*['"]POST|XMLHttpRequest|WebSocket|sendBeacon|<form|EventSource|navigator\.share/)
  })
  it('no camera, no microphone', () => {
    for (const [path, src] of all) expect(src, path).not.toMatch(/mediaDevices|getUserMedia/)
  })
  it('storage is touched only by progress/storage.ts, under the one key, and nothing names sessionStorage or indexedDB', () => {
    for (const [path, src] of all) {
      if (path.endsWith('/progress/storage.ts')) {
        expect(src).toMatch(/'bcogapp\.m10\.v1'/)
        continue
      }
      expect(src, path).not.toMatch(/localStorage|sessionStorage|indexedDB/)
      expect(src, path).not.toMatch(/'bcogapp\.(?!m10 saved results)/)
    }
  })
  it('the only file input is Load my results, and it reads the file as text in the page', () => {
    const inputs = all.filter(([, src]) => /type="file"|type: 'file'/.test(src)).map(([p]) => p)
    expect(inputs).toEqual(['./progress/ExportLoad.tsx'])
    const el = scene['./progress/ExportLoad.tsx']
    expect(el).toMatch(/\.text\(\)|FileReader/)
    expect(el).not.toMatch(/fetch\(|FormData/)
  })
  it('no script is evaluated from a loaded file: no eval and no Function constructor anywhere', () => {
    for (const [path, src] of all) expect(src, path).not.toMatch(/\beval\(|new Function\(/)
  })
})
