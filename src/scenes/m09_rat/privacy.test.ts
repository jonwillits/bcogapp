import { describe, it, expect } from 'vitest'

/**
 * No camera, no microphone, no upload, no storage beyond the open page, and
 * no network request that sends anything the student did (spec §12, item 9).
 */
const scene = import.meta.glob('./*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const sim = import.meta.glob('../../sim/rodent/**/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const all = [...Object.entries(scene), ...Object.entries(sim)].filter(([p]) => !p.includes('.test.') && !p.includes('.probe.'))

describe('nothing leaves the page', () => {
  it('no fetch, no POST, no XMLHttpRequest, no WebSocket, no beacon, no form submission', () => {
    for (const [path, src] of all) expect(src, path).not.toMatch(/\bfetch\(|method:\s*['"]POST|XMLHttpRequest|WebSocket|sendBeacon|<form|EventSource/)
  })
  it('no camera, no microphone, no file input, no storage', () => {
    for (const [path, src] of all) expect(src, path).not.toMatch(/mediaDevices|getUserMedia|type="file"|type: 'file'|localStorage|sessionStorage|indexedDB|navigator\.share/)
  })
})
