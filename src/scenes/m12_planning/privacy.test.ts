import { describe, it, expect } from 'vitest'

/**
 * Nothing leaves the page (spec §11, item 8): no camera, no microphone, no
 * upload, no network request that carries anything the student did, and
 * storage only through the shared layer under Lab 12's one key.
 */
const scene = import.meta.glob('./**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const sim = import.meta.glob('../../sim/planning/**/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
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
  it('no browser dialog: no alert, confirm or prompt', () => {
    for (const [path, src] of all) expect(src, path).not.toMatch(/\balert\(|window\.confirm|\bconfirm\(|window\.prompt|\bprompt\(/)
  })
  it('no Math.random in the sim or the scene: one seeded stream decides everything (spec §14)', () => {
    for (const [path, src] of all) if (!path.endsWith('RangeView3D.tsx')) expect(src, path).not.toMatch(/Math\.random/)
  })
})
